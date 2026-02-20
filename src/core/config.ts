import * as fs from 'node:fs/promises';
import * as path from 'node:path';

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

/** Get the .ctx directory path, throwing if not initialized. */
export async function getCtxDir(): Promise<string> {
  const root = await findCtxRoot();
  if (!root) {
    throw new Error('Not in a ctx project. Run `ctx init` first.');
  }
  return path.join(root, CTX_DIR);
}

/** Get the project root (parent of .ctx/). */
export async function getProjectRoot(): Promise<string> {
  const root = await findCtxRoot();
  if (!root) {
    throw new Error('Not in a ctx project. Run `ctx init` first.');
  }
  return root;
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
    await fs.writeFile(gitignorePath, 'sessions/\n');
  }

  return ctxDir;
}

export function getDefaultConfig(): CtxConfig {
  return { ...DEFAULT_CONFIG };
}
