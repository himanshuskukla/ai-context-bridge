import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { getGitRoot } from './git.js';

const CTX_HOOK_MARKER = '# --- ai-context-bridge auto-save ---';

/**
 * The script that git hooks execute.
 * It calls `ctx` in quiet mode to auto-refresh the live session.
 */
function hookScript(): string {
  return `
${CTX_HOOK_MARKER}
# Auto-save context on git events so it's always ready when rate limits hit.
# Installed by: ctx init --hooks
# Remove by: ctx hooks uninstall
if command -v ctx >/dev/null 2>&1; then
  ctx auto-refresh --quiet &
fi
${CTX_HOOK_MARKER}
`;
}

const HOOK_NAMES = ['post-commit', 'post-checkout', 'post-merge'];

/** Install git hooks that auto-refresh context. */
export async function installHooks(cwd?: string): Promise<string[]> {
  const gitRoot = await getGitRoot(cwd);
  if (!gitRoot) {
    throw new Error('Not a git repository. Git hooks require a git repo.');
  }

  const hooksDir = path.join(gitRoot, '.git', 'hooks');
  await fs.mkdir(hooksDir, { recursive: true });

  const installed: string[] = [];
  const script = hookScript();

  for (const hookName of HOOK_NAMES) {
    const hookPath = path.join(hooksDir, hookName);
    let existing = '';

    try {
      existing = await fs.readFile(hookPath, 'utf-8');
    } catch {
      // Hook doesn't exist yet
    }

    // Don't duplicate
    if (existing.includes(CTX_HOOK_MARKER)) {
      continue;
    }

    // Append to existing hook or create new one
    if (existing) {
      await fs.writeFile(hookPath, existing.trimEnd() + '\n' + script);
    } else {
      await fs.writeFile(hookPath, '#!/bin/sh\n' + script);
    }

    // Make executable
    await fs.chmod(hookPath, 0o755);
    installed.push(hookName);
  }

  return installed;
}

/** Uninstall git hooks. Removes only the ctx sections, preserves other hooks. */
export async function uninstallHooks(cwd?: string): Promise<string[]> {
  const gitRoot = await getGitRoot(cwd);
  if (!gitRoot) return [];

  const hooksDir = path.join(gitRoot, '.git', 'hooks');
  const removed: string[] = [];

  for (const hookName of HOOK_NAMES) {
    const hookPath = path.join(hooksDir, hookName);
    try {
      let content = await fs.readFile(hookPath, 'utf-8');
      if (!content.includes(CTX_HOOK_MARKER)) continue;

      // Remove the ctx section (between the two markers, inclusive)
      const regex = new RegExp(
        `\n?${CTX_HOOK_MARKER}[\\s\\S]*?${CTX_HOOK_MARKER}\n?`,
        'g'
      );
      content = content.replace(regex, '\n');

      // If only the shebang remains, delete the file
      if (content.trim() === '#!/bin/sh' || content.trim() === '') {
        await fs.unlink(hookPath);
      } else {
        await fs.writeFile(hookPath, content);
      }
      removed.push(hookName);
    } catch {
      // hook doesn't exist
    }
  }

  return removed;
}

/** Check if hooks are installed. */
export async function checkHooks(cwd?: string): Promise<{ installed: string[]; missing: string[] }> {
  const gitRoot = await getGitRoot(cwd);
  if (!gitRoot) return { installed: [], missing: HOOK_NAMES };

  const hooksDir = path.join(gitRoot, '.git', 'hooks');
  const installed: string[] = [];
  const missing: string[] = [];

  for (const hookName of HOOK_NAMES) {
    const hookPath = path.join(hooksDir, hookName);
    try {
      const content = await fs.readFile(hookPath, 'utf-8');
      if (content.includes(CTX_HOOK_MARKER)) {
        installed.push(hookName);
      } else {
        missing.push(hookName);
      }
    } catch {
      missing.push(hookName);
    }
  }

  return { installed, missing };
}
