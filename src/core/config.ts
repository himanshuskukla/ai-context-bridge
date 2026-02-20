import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { homedir } from 'node:os';

export interface CtxConfig {
  version: string;
  defaultTool?: string;
  enabledTools: string[];
  autoSave: boolean;
  autoDetect: boolean;
  sessionDefaults: {
    includeGitDiff: boolean;
    includeBranch: boolean;
    includeFiles: boolean;
  };
}

const DEFAULT_CONFIG: CtxConfig = {
  version: '0.1.0',
  enabledTools: ['claude', 'cursor', 'codex', 'copilot', 'windsurf', 'cline', 'aider', 'continue', 'amazonq', 'zed', 'antigravity'],
  autoSave: true,
  autoDetect: true,
  sessionDefaults: {
    includeGitDiff: true,
    includeBranch: true,
    includeFiles: true,
  },
};

export const CTX_DIR = '.ctx';
export const CONFIG_FILE = 'config.json';
export const RULES_DIR = 'rules';
export const SESSIONS_DIR = 'sessions';
export const RESUME_PROMPTS_DIR = 'resume-prompts';
const GLOBAL_CTX_DIR = '.ctx-global';
const GLOBAL_PROJECTS_DIR = 'projects';
const GLOBAL_PROJECTS_FILE = 'projects.json';

/** Find the .ctx directory by walking up from cwd. Returns null if not found. */
export async function findCtxRoot(startDir?: string): Promise<string | null> {
  let dir = startDir || process.cwd();
  const root = path.parse(dir).root;

  while (dir !== root) {
    try {
      await fs.access(path.join(dir, CTX_DIR));
      return dir;
    } catch {
      dir = path.dirname(dir);
    }
  }
  return null;
}

/**
 * Resolve external ctx directory by looking up the global registry.
 * Returns the external ctxPath if found, null otherwise.
 */
export async function resolveExternalCtxDir(startDir?: string): Promise<{ ctxPath: string; projectRoot: string } | null> {
  const cwd = startDir || process.cwd();

  // Determine project root: git root or cwd
  let projectRoot: string;
  try {
    const { execFile } = await import('node:child_process');
    const { promisify } = await import('node:util');
    const exec = promisify(execFile);
    const result = await exec('git', ['rev-parse', '--show-toplevel'], { cwd, timeout: 3000 });
    projectRoot = result.stdout.trim();
  } catch {
    projectRoot = cwd;
  }

  // Read the global registry directly (avoid circular dependency with global.ts)
  const registryPath = path.join(homedir(), GLOBAL_CTX_DIR, GLOBAL_PROJECTS_FILE);
  try {
    const raw = await fs.readFile(registryPath, 'utf-8');
    const registry = JSON.parse(raw);
    const entry = registry.projects?.find((p: { path: string }) => p.path === projectRoot);
    if (entry?.storage === 'external' && entry.ctxPath) {
      return { ctxPath: entry.ctxPath, projectRoot };
    }
  } catch {
    // No registry or parse error
  }

  return null;
}

/** Get the .ctx directory path, throwing if not initialized. */
export async function getCtxDir(): Promise<string> {
  // 1. Try internal mode: walk up looking for .ctx/
  const root = await findCtxRoot();
  if (root) {
    return path.join(root, CTX_DIR);
  }

  // 2. Try external mode: look up global registry
  const external = await resolveExternalCtxDir();
  if (external) {
    return external.ctxPath;
  }

  throw new Error('Not in a ctx project. Run `ctx init` first.');
}

/** Get the project root (parent of .ctx/, or git root for external mode). */
export async function getProjectRoot(): Promise<string> {
  // 1. Try internal mode
  const root = await findCtxRoot();
  if (root) {
    return root;
  }

  // 2. Try external mode
  const external = await resolveExternalCtxDir();
  if (external) {
    return external.projectRoot;
  }

  throw new Error('Not in a ctx project. Run `ctx init` first.');
}

/** Read the config file. */
export async function readConfig(): Promise<CtxConfig> {
  const ctxDir = await getCtxDir();
  const configPath = path.join(ctxDir, CONFIG_FILE);
  try {
    const raw = await fs.readFile(configPath, 'utf-8');
    return { ...DEFAULT_CONFIG, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULT_CONFIG };
  }
}

/** Write the config file. */
export async function writeConfig(config: CtxConfig): Promise<void> {
  const ctxDir = await getCtxDir();
  const configPath = path.join(ctxDir, CONFIG_FILE);
  await fs.writeFile(configPath, JSON.stringify(config, null, 2) + '\n');
}

/** Initialize the .ctx directory structure. */
export async function initCtxDir(projectDir: string): Promise<string> {
  const ctxDir = path.join(projectDir, CTX_DIR);
  await fs.mkdir(path.join(ctxDir, RULES_DIR), { recursive: true });
  await fs.mkdir(path.join(ctxDir, SESSIONS_DIR), { recursive: true });

  const configPath = path.join(ctxDir, CONFIG_FILE);
  try {
    await fs.access(configPath);
  } catch {
    await fs.writeFile(configPath, JSON.stringify(DEFAULT_CONFIG, null, 2) + '\n');
  }

  // Create .gitignore for sessions
  const gitignorePath = path.join(ctxDir, '.gitignore');
  try {
    await fs.access(gitignorePath);
  } catch {
    await fs.writeFile(gitignorePath, 'sessions/\nresume-prompts/\nwatcher.pid\n');
  }

  return ctxDir;
}

/**
 * Initialize an external .ctx directory at ~/.ctx-global/projects/<name>/.
 * Creates the full directory structure outside the project directory.
 * Returns the absolute path to the created ctx directory.
 */
export async function initExternalCtxDir(projectDir: string): Promise<string> {
  const projectName = path.basename(path.resolve(projectDir));
  const externalCtxDir = path.join(homedir(), GLOBAL_CTX_DIR, GLOBAL_PROJECTS_DIR, projectName);

  await fs.mkdir(path.join(externalCtxDir, RULES_DIR), { recursive: true });
  await fs.mkdir(path.join(externalCtxDir, SESSIONS_DIR), { recursive: true });
  await fs.mkdir(path.join(externalCtxDir, RESUME_PROMPTS_DIR), { recursive: true });

  const configPath = path.join(externalCtxDir, CONFIG_FILE);
  try {
    await fs.access(configPath);
  } catch {
    await fs.writeFile(configPath, JSON.stringify(DEFAULT_CONFIG, null, 2) + '\n');
  }

  // No .gitignore needed — this directory is outside the project repo
  return externalCtxDir;
}

export function getDefaultConfig(): CtxConfig {
  return { ...DEFAULT_CONFIG };
}
