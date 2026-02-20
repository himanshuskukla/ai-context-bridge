import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { getCtxDir, readConfig, getProjectRoot, SESSIONS_DIR } from './config.js';
import { autoDetectContext } from './git.js';
import { readRules } from './rules.js';
import { compile } from './compiler.js';
import { getAdapter, getAllAdapters } from '../adapters/registry.js';
import type { Session } from './session.js';

const LIVE_FILE = 'live.json';
const RESUME_DIR = 'resume-prompts';

/**
 * The "live" session — always kept up to date so it's ready
 * when rate limits hit. Unlike regular sessions (point-in-time snapshots),
 * this one is continuously overwritten.
 */
export async function updateLiveSession(opts?: {
  task?: string;
  decisions?: string[];
  nextSteps?: string[];
  cwd?: string;
}): Promise<Session> {
  const ctxDir = await getCtxDir();
  const livePath = path.join(ctxDir, SESSIONS_DIR, LIVE_FILE);

  // Read existing live session to preserve task/decisions/nextSteps
  let existing: Partial<Session> = {};
  try {
    const raw = await fs.readFile(livePath, 'utf-8');
    existing = JSON.parse(raw);
  } catch {
    // no existing live session
  }

  // Auto-detect fresh git context
  const ctx = await autoDetectContext(opts?.cwd);

  const live: Session = {
    id: 'live',
    branch: ctx.branch,
    timestamp: new Date().toISOString(),
    tool: existing.tool || null,
    task: opts?.task || existing.task || `Working on ${ctx.branch || 'main'}`,
    decisions: opts?.decisions || existing.decisions || [],
    nextSteps: opts?.nextSteps || existing.nextSteps || [],
    filesChanged: ctx.changedFiles,
    diffSummary: ctx.diffSummary,
    recentCommits: ctx.recentCommits,
    headHash: ctx.headHash,
  };

  await fs.mkdir(path.join(ctxDir, SESSIONS_DIR), { recursive: true });
  await fs.writeFile(livePath, JSON.stringify(live, null, 2) + '\n');

  return live;
}

/** Read the live session. Returns null if none exists. */
export async function readLiveSession(): Promise<Session | null> {
  const ctxDir = await getCtxDir();
  const livePath = path.join(ctxDir, SESSIONS_DIR, LIVE_FILE);
  try {
    const raw = await fs.readFile(livePath, 'utf-8');
    return JSON.parse(raw) as Session;
  } catch {
    return null;
  }
}

/**
 * Pre-generate resume prompts for all enabled tools.
 * These files sit ready in .ctx/resume-prompts/ so when a rate limit
 * hits, the user can immediately open the file or the target tool.
 */
export async function preGenerateResumes(): Promise<number> {
  const ctxDir = await getCtxDir();
  const projectRoot = await getProjectRoot();
  const config = await readConfig();
  const rules = await readRules();
  const live = await readLiveSession();

  if (!live) return 0;

  const resumeDir = path.join(ctxDir, RESUME_DIR);
  await fs.mkdir(resumeDir, { recursive: true });

  let count = 0;

  for (const toolName of config.enabledTools) {
    const adapter = getAdapter(toolName);
    if (!adapter) continue;

    try {
      // Generate the resume prompt
      const compiled = compile({
        session: live,
        rules,
        charBudget: adapter.charBudget,
        compress: adapter.compress,
        toolName: adapter.name,
      });

      // Write resume prompt to a ready-to-paste file
      const promptPath = path.join(resumeDir, `${adapter.name}.md`);
      const header = `<!-- READY-TO-PASTE resume prompt for ${adapter.displayName} -->\n`;
      const meta = `<!-- Generated: ${new Date().toISOString()} | Branch: ${live.branch} -->\n\n`;
      await fs.writeFile(promptPath, header + meta + compiled.resumePrompt);

      count++;
    } catch {
      // Skip tools that fail
    }
  }

  // Also write a quick-reference index
  const indexLines = [
    `# Resume Prompts (auto-generated)`,
    ``,
    `**Last updated**: ${new Date().toISOString()}`,
    `**Branch**: ${live.branch || 'main'}`,
    `**Task**: ${live.task}`,
    ``,
    `## Quick Switch`,
    `Open the file for your target tool and paste its contents:`,
    ``,
  ];

  for (const toolName of config.enabledTools) {
    indexLines.push(`- **${toolName}**: \`.ctx/resume-prompts/${toolName}.md\``);
  }

  indexLines.push('', '> These files are auto-updated on every commit and periodically by `ctx watch`.');

  await fs.writeFile(path.join(resumeDir, 'README.md'), indexLines.join('\n'));

  return count;
}

/**
 * Full auto-refresh: update live session + pre-generate all resume files.
 * Called by git hooks and the watcher.
 */
export async function autoRefresh(opts?: {
  task?: string;
  cwd?: string;
}): Promise<{ session: Session; resumeCount: number }> {
  const session = await updateLiveSession(opts);
  const resumeCount = await preGenerateResumes();
  return { session, resumeCount };
}
