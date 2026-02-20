import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { getCtxDir } from './config.js';
import { SESSIONS_DIR } from './config.js';
import { autoDetectContext } from './git.js';

export interface Session {
  id: string;
  branch: string | null;
  timestamp: string;
  tool: string | null;
  task: string;
  decisions: string[];
  nextSteps: string[];
  filesChanged: string[];
  diffSummary: string | null;
  recentCommits: string[];
  headHash: string | null;
  metadata?: Record<string, unknown>;
}

let sessionCounter = 0;

function makeSessionId(): string {
  const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const suffix = String(++sessionCounter).padStart(3, '0');
  return `sess_${ts}_${suffix}`;
}

function makeTimestamp(): string {
  return new Date().toISOString();
}

/** Get sessions directory for a given branch. */
async function getSessionDir(branch?: string | null): Promise<string> {
  const ctxDir = await getCtxDir();
  const safeBranch = (branch || 'main').replace(/\//g, path.sep);
  const sessionDir = path.join(ctxDir, SESSIONS_DIR, safeBranch);
  await fs.mkdir(sessionDir, { recursive: true });
  return sessionDir;
}

/** Create a new session, auto-detecting git context. */
export async function createSession(opts: {
  task: string;
  tool?: string;
  decisions?: string[];
  nextSteps?: string[];
  cwd?: string;
}): Promise<Session> {
  const ctx = await autoDetectContext(opts.cwd);
  const session: Session = {
    id: makeSessionId(),
    branch: ctx.branch,
    timestamp: makeTimestamp(),
    tool: opts.tool || null,
    task: opts.task,
    decisions: opts.decisions || [],
    nextSteps: opts.nextSteps || [],
    filesChanged: ctx.changedFiles,
    diffSummary: ctx.diffSummary,
    recentCommits: ctx.recentCommits,
    headHash: ctx.headHash,
  };

  const dir = await getSessionDir(ctx.branch);
  const filename = session.id + '.json';
  await fs.writeFile(path.join(dir, filename), JSON.stringify(session, null, 2) + '\n');

  return session;
}

/** Get the latest session for the current branch (or any branch). */
export async function getLatestSession(branch?: string | null): Promise<Session | null> {
  const ctxDir = await getCtxDir();
  const sessionsRoot = path.join(ctxDir, SESSIONS_DIR);

  try {
    await fs.access(sessionsRoot);
  } catch {
    return null;
  }

  if (branch) {
    const safeBranch = branch.replace(/\//g, path.sep);
    const dir = path.join(sessionsRoot, safeBranch);
    return getLatestInDir(dir);
  }

  // Search all branch dirs for most recent
  return findLatestAcrossDirs(sessionsRoot);
}

async function findLatestAcrossDirs(dir: string): Promise<Session | null> {
  let latest: Session | null = null;

  try {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        const sess = await findLatestAcrossDirs(fullPath);
        if (sess && (!latest || sess.timestamp > latest.timestamp)) {
          latest = sess;
        }
      } else if (entry.name.endsWith('.json')) {
        const sess = await readSessionFile(fullPath);
        if (sess && (!latest || sess.timestamp > latest.timestamp)) {
          latest = sess;
        }
      }
    }
  } catch {
    // dir doesn't exist
  }

  return latest;
}

async function getLatestInDir(dir: string): Promise<Session | null> {
  try {
    const files = await fs.readdir(dir);
    const jsonFiles = files.filter((f) => f.endsWith('.json')).sort().reverse();
    if (jsonFiles.length === 0) return null;
    return readSessionFile(path.join(dir, jsonFiles[0]));
  } catch {
    return null;
  }
}

async function readSessionFile(filePath: string): Promise<Session | null> {
  try {
    const raw = await fs.readFile(filePath, 'utf-8');
    return JSON.parse(raw) as Session;
  } catch {
    return null;
  }
}

/** List all sessions, optionally filtered by branch. */
export async function listSessions(branch?: string): Promise<Session[]> {
  const ctxDir = await getCtxDir();
  const sessionsRoot = path.join(ctxDir, SESSIONS_DIR);
  const sessions: Session[] = [];

  async function walk(dir: string): Promise<void> {
    try {
      const entries = await fs.readdir(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          await walk(fullPath);
        } else if (entry.name.endsWith('.json')) {
          const sess = await readSessionFile(fullPath);
          if (sess) sessions.push(sess);
        }
      }
    } catch {
      // skip
    }
  }

  if (branch) {
    const safeBranch = branch.replace(/\//g, path.sep);
    await walk(path.join(sessionsRoot, safeBranch));
  } else {
    await walk(sessionsRoot);
  }

  return sessions.sort((a, b) => {
    const ts = b.timestamp.localeCompare(a.timestamp);
    if (ts !== 0) return ts;
    return b.id.localeCompare(a.id);
  });
}

/** Get a specific session by ID. */
export async function getSession(id: string): Promise<Session | null> {
  const sessions = await listSessions();
  return sessions.find((s) => s.id === id) || null;
}

/** Delete a session by ID. Returns true if found and deleted. */
export async function deleteSession(id: string): Promise<boolean> {
  const ctxDir = await getCtxDir();
  const sessionsRoot = path.join(ctxDir, SESSIONS_DIR);

  async function walk(dir: string): Promise<boolean> {
    try {
      const entries = await fs.readdir(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          if (await walk(fullPath)) return true;
        } else if (entry.name === `${id}.json`) {
          await fs.unlink(fullPath);
          return true;
        }
      }
    } catch {
      // skip
    }
    return false;
  }

  return walk(sessionsRoot);
}
