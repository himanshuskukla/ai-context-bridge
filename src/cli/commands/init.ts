import * as path from 'node:path';
import { initCtxDir, findCtxRoot } from '../../core/config.js';
import { getAllAdapters } from '../../adapters/registry.js';
import { addRule } from '../../core/rules.js';
import { isGitRepo } from '../../core/git.js';
import { log } from '../../utils/logger.js';

export async function initCommand(args: { import?: boolean }): Promise<void> {
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

  // Check git
  const isGit = await isGitRepo(cwd);
  if (isGit) {
    log.info('  Git repo detected — sessions will be organized by branch.');
  } else {
    log.dim('  Not a git repo — sessions will use "main" as default branch.');
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

  log.header('Next steps');
  log.info('  1. Edit .ctx/rules/01-project.md with your project context');
  log.info('  2. Run `ctx save "starting work"` to create your first session');
  log.info('  3. Run `ctx switch <tool>` when you need to switch AI tools');
  log.info('');
  log.dim('  Tip: Add .ctx/rules/ to git, .ctx/sessions/ is already gitignored.');
}
