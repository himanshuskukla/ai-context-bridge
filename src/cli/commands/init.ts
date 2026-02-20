import * as path from 'node:path';
import { initCtxDir, findCtxRoot } from '../../core/config.js';
import { getAllAdapters } from '../../adapters/registry.js';
import { addRule } from '../../core/rules.js';
import { isGitRepo } from '../../core/git.js';
import { installHooks } from '../../core/hooks.js';
import { registerProject } from '../../core/global.js';
import { autoRefresh } from '../../core/live.js';
import { log } from '../../utils/logger.js';

export async function initCommand(args: { import?: boolean; noHooks?: boolean }): Promise<void> {
  const cwd = process.cwd();

  // Check if already initialized
  const existing = await findCtxRoot(cwd);
  if (existing && path.resolve(existing) === path.resolve(cwd)) {
    log.warn('.ctx/ already exists in this directory.');
    return;
  }

  // Initialize
  const ctxDir = await initCtxDir(cwd);
  log.success(`Initialized .ctx/ in ${cwd}`);

  // Check git and install hooks automatically
  const isGit = await isGitRepo(cwd);
  if (isGit) {
    log.info('  Git repo detected — sessions will be organized by branch.');

    // Auto-install git hooks unless opted out
    if (!args.noHooks) {
      try {
        const installed = await installHooks(cwd);
        if (installed.length > 0) {
          log.success(`Auto-installed git hooks: ${installed.join(', ')}`);
          log.dim('  Context auto-saves on commit/checkout/merge. Disable with: ctx hooks uninstall');
        }
      } catch {
        log.dim('  Could not install git hooks (non-fatal).');
      }
    }
  } else {
    log.dim('  Not a git repo — sessions will use "main" as default branch.');
    log.dim('  Storage mode: local directory (no git features).');
  }

  // Register in global project registry
  try {
    await registerProject(cwd);
    log.success('Registered in global project registry (~/.ctx-global/)');
  } catch {
    // non-fatal
  }

  // Auto-import existing tool configs
  if (args.import !== false) {
    log.header('Importing existing tool configs...');
    const adapters = getAllAdapters();
    let imported = 0;

    for (const adapter of adapters) {
      const content = await adapter.importExisting(cwd);
      if (content) {
        await addRule(`imported-${adapter.name}`, content);
        log.success(`Imported rules from ${adapter.displayName}`);
        imported++;
      }
    }

    if (imported === 0) {
      log.dim('  No existing tool configs found to import.');
    }
  }

  // Create a starter rule file
  const starterRule = `# Project Overview

<!-- Edit this file with your project's context -->
<!-- This will be synced to all your AI coding tools -->

## Stack
-

## Key Conventions
-

## Important Files
-
`;

  try {
    await addRule('project', starterRule, 1);
    log.success('Created starter rule: .ctx/rules/01-project.md');
  } catch {
    // Rule already exists from import
  }

  // Create initial live session + pre-generate resume prompts
  try {
    const { resumeCount } = await autoRefresh({ cwd });
    log.success(`Pre-generated ${resumeCount} resume prompts (always ready in .ctx/resume-prompts/)`);
  } catch {
    // non-fatal
  }

  log.header('Autonomous features enabled');
  if (isGit && !args.noHooks) {
    log.info('  Git hooks: auto-save context on commit/checkout/merge');
  }
  log.info('  Live session: .ctx/sessions/live.json (always current)');
  log.info('  Resume prompts: .ctx/resume-prompts/<tool>.md (pre-generated)');
  log.info('');
  log.info('  When a rate limit hits, your context is ALREADY saved.');
  log.info('  Just open .ctx/resume-prompts/cursor.md and paste into Cursor.');
  log.info('');
  log.dim('  Optional: run `ctx watch` for continuous background updates.');
  log.dim('  Optional: run `ctx projects list` to see all your projects.');
}
