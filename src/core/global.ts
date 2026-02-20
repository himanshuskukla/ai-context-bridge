import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { homedir } from 'node:os';
import { findCtxRoot, readConfig } from './config.js';
import { readLiveSession } from './live.js';
import { getBranch, isGitRepo } from './git.js';

const PROJECTS_FILE = 'projects.json';

function getGlobalDirPath(): string {
  return path.join(homedir(), '.ctx-global');
}

export interface ProjectEntry {
  name: string;
  path: string;
  lastActive: string;
  branch: string | null;
  task: string | null;
  storage: 'git' | 'local' | 'external';
  ctxPath?: string;  // Only set for external mode — absolute path to ctx data dir
}

export interface GlobalRegistry {
  version: string;
  projects: ProjectEntry[];
}

function defaultRegistry(): GlobalRegistry {
  return { version: '0.1.0', projects: [] };
}

/** Ensure the global directory exists. */
async function ensureGlobalDir(): Promise<string> {
  const dir = getGlobalDirPath();
  await fs.mkdir(dir, { recursive: true });
  return dir;
}

/** Read the global project registry. */
export async function readRegistry(): Promise<GlobalRegistry> {
  await ensureGlobalDir();
  const filePath = path.join(getGlobalDirPath(), PROJECTS_FILE);
  try {
    const raw = await fs.readFile(filePath, 'utf-8');
    return { ...defaultRegistry(), ...JSON.parse(raw) };
  } catch {
    return defaultRegistry();
  }
}

/** Write the global project registry. */
async function writeRegistry(registry: GlobalRegistry): Promise<void> {
  await ensureGlobalDir();
  const filePath = path.join(getGlobalDirPath(), PROJECTS_FILE);
  await fs.writeFile(filePath, JSON.stringify(registry, null, 2) + '\n');
}

/** Register a project in the global registry. Called by `ctx init`. */
export async function registerProject(
  projectPath: string,
  opts?: { external?: boolean; ctxPath?: string },
): Promise<void> {
  const registry = await readRegistry();
  const absPath = path.resolve(projectPath);
  const name = path.basename(absPath);

  const isGit = await isGitRepo(absPath);
  const branch = await getBranch(absPath);

  // Determine storage mode
  let storage: ProjectEntry['storage'];
  if (opts?.external) {
    storage = 'external';
  } else {
    storage = isGit ? 'git' : 'local';
  }

  // Update if exists, add if new
  const existing = registry.projects.findIndex((p) => p.path === absPath);
  const entry: ProjectEntry = {
    name,
    path: absPath,
    lastActive: new Date().toISOString(),
    branch,
    task: null,
    storage,
    ...(opts?.ctxPath ? { ctxPath: opts.ctxPath } : {}),
  };

  if (existing >= 0) {
    registry.projects[existing] = { ...registry.projects[existing], ...entry };
  } else {
    registry.projects.push(entry);
  }

  await writeRegistry(registry);
}

/** Update the lastActive timestamp and current task for a project. */
export async function touchProject(projectPath: string, task?: string): Promise<void> {
  const registry = await readRegistry();
  const absPath = path.resolve(projectPath);
  const entry = registry.projects.find((p) => p.path === absPath);

  if (entry) {
    entry.lastActive = new Date().toISOString();
    entry.branch = await getBranch(absPath);
    if (task) entry.task = task;
    await writeRegistry(registry);
  }
}

/** Remove a project from the global registry. */
export async function unregisterProject(projectPath: string): Promise<boolean> {
  const registry = await readRegistry();
  const absPath = path.resolve(projectPath);
  const before = registry.projects.length;
  registry.projects = registry.projects.filter((p) => p.path !== absPath);
  if (registry.projects.length < before) {
    await writeRegistry(registry);
    return true;
  }
  return false;
}

/**
 * Resolve the ctx data directory for a given project.
 * For external projects, returns the ctxPath from registry.
 * For internal projects, returns <projectPath>/.ctx.
 */
export async function getProjectCtxPath(projectPath: string): Promise<string> {
  const absPath = path.resolve(projectPath);
  const registry = await readRegistry();
  const entry = registry.projects.find((p) => p.path === absPath);

  if (entry?.storage === 'external' && entry.ctxPath) {
    return entry.ctxPath;
  }

  // Fall back to internal .ctx/ (or check findCtxRoot)
  const ctxRoot = await findCtxRoot(projectPath);
  if (ctxRoot) {
    return path.join(ctxRoot, '.ctx');
  }

  return path.join(absPath, '.ctx');
}

/**
 * List all registered projects with their current status.
 * Enriches each entry with live session data if available.
 */
export async function listProjects(): Promise<(ProjectEntry & {
  exists: boolean;
  hasLiveSession: boolean;
})[]> {
  const registry = await readRegistry();
  const results: (ProjectEntry & { exists: boolean; hasLiveSession: boolean })[] = [];

  for (const project of registry.projects) {
    let exists = false;
    let hasLiveSession = false;

    try {
      await fs.access(project.path);
      exists = true;

      // Resolve the ctx data path (supports both internal and external)
      const ctxPath = project.storage === 'external' && project.ctxPath
        ? project.ctxPath
        : await (async () => {
            const ctxRoot = await findCtxRoot(project.path);
            return ctxRoot ? path.join(ctxRoot, '.ctx') : null;
          })();

      if (ctxPath) {
        const livePath = path.join(ctxPath, 'sessions', 'live.json');
        try {
          await fs.access(livePath);
          hasLiveSession = true;
          // Update branch from live session
          const raw = await fs.readFile(livePath, 'utf-8');
          const live = JSON.parse(raw);
          project.branch = live.branch || project.branch;
          project.task = live.task || project.task;
        } catch {
          // no live session
        }
      }
    } catch {
      // project path doesn't exist
    }

    results.push({ ...project, exists, hasLiveSession });
  }

  // Sort by lastActive descending
  return results.sort((a, b) => b.lastActive.localeCompare(a.lastActive));
}

/** Get the global directory path. */
export function getGlobalDir(): string {
  return getGlobalDirPath();
}
