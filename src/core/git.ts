import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const exec = promisify(execFile);

interface ExecResult {
  stdout: string;
  stderr: string;
}

async function git(args: string[], cwd?: string): Promise<ExecResult | null> {
  try {
    return await exec('git', args, { cwd: cwd || process.cwd(), timeout: 5000 });
  } catch {
    return null;
  }
}

/** Check if cwd is inside a git repository. */
export async function isGitRepo(cwd?: string): Promise<boolean> {
  const result = await git(['rev-parse', '--is-inside-work-tree'], cwd);
  return result?.stdout.trim() === 'true';
}

/** Get the current branch name. */
export async function getBranch(cwd?: string): Promise<string | null> {
  const result = await git(['rev-parse', '--abbrev-ref', 'HEAD'], cwd);
  return result?.stdout.trim() || null;
}

/** Get a short diff summary (e.g. "4 files changed, 127 insertions(+)"). */
export async function getDiffSummary(cwd?: string): Promise<string | null> {
  const result = await git(['diff', '--stat', '--stat-width=80'], cwd);
  if (!result?.stdout) return null;
  const lines = result.stdout.trim().split('\n');
  return lines[lines.length - 1]?.trim() || null;
}

/** Get list of changed files (staged + unstaged). */
export async function getChangedFiles(cwd?: string): Promise<string[]> {
  const result = await git(['diff', '--name-only', 'HEAD'], cwd);
  if (!result?.stdout) {
    // Maybe no commits yet, try diff of staged
    const staged = await git(['diff', '--name-only', '--cached'], cwd);
    if (!staged?.stdout) return [];
    return staged.stdout.trim().split('\n').filter(Boolean);
  }
  return result.stdout.trim().split('\n').filter(Boolean);
}

/** Get the last N commit messages. */
export async function getRecentCommits(n = 5, cwd?: string): Promise<string[]> {
  const result = await git(['log', `--oneline`, `-${n}`], cwd);
  if (!result?.stdout) return [];
  return result.stdout.trim().split('\n').filter(Boolean);
}

/** Get the short HEAD hash. */
export async function getHeadHash(cwd?: string): Promise<string | null> {
  const result = await git(['rev-parse', '--short', 'HEAD'], cwd);
  return result?.stdout.trim() || null;
}

/** Get git root directory. */
export async function getGitRoot(cwd?: string): Promise<string | null> {
  const result = await git(['rev-parse', '--show-toplevel'], cwd);
  return result?.stdout.trim() || null;
}

/** Auto-detect current working context from git state. */
export async function autoDetectContext(cwd?: string): Promise<{
  branch: string | null;
  diffSummary: string | null;
  changedFiles: string[];
  recentCommits: string[];
  headHash: string | null;
}> {
  const [branch, diffSummary, changedFiles, recentCommits, headHash] = await Promise.all([
    getBranch(cwd),
    getDiffSummary(cwd),
    getChangedFiles(cwd),
    getRecentCommits(5, cwd),
    getHeadHash(cwd),
  ]);
  return { branch, diffSummary, changedFiles, recentCommits, headHash };
}
