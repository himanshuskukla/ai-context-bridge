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
  storage: 'git' | 'local';
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
export async function registerProject(projectPath: string): Promise<void> {
  const registry = await readRegistry();
  const absPath = path.resolve(projectPath);
  const name = path.basename(absPath);

  const isGit = await isGitRepo(absPath);
  const branch = await getBranch(absPath);

  // Update if exists, add if new
  const existing = registry.projects.findIndex((p) => p.path === absPath);
  const entry: ProjectEntry = {
    name,
    path: absPath,
    lastActive: new Date().toISOString(),
    branch,
    task: null,
    storage: isGit ? 'git' : 'local',
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

      // Check if .ctx/ still exists
      const ctxRoot = await findCtxRoot(project.path);
      if (ctxRoot) {
        // Try to read live session (we need to be careful about cwd)
        const livePath = path.join(ctxRoot, '.ctx', 'sessions', 'live.json');
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
