import * as path from 'node:path';
import { initCtxDir, initExternalCtxDir, findCtxRoot, resolveExternalCtxDir } from '../../core/config.js';
import { getAllAdapters } from '../../adapters/registry.js';
import { addRule } from '../../core/rules.js';
import { isGitRepo } from '../../core/git.js';
import { installHooks } from '../../core/hooks.js';
import { registerProject } from '../../core/global.js';
import { autoRefresh } from '../../core/live.js';
import { log } from '../../utils/logger.js';

export async function initCommand(args: { import?: boolean; noHooks?: boolean; external?: boolean }): Promise<void> {
  const cwd = process.cwd();

  // Check if already initialized (internal mode)
  const existing = await findCtxRoot(cwd);
  if (existing && path.resolve(existing) === path.resolve(cwd)) {
    log.warn('.ctx/ already exists in this directory.');
    return;
  }

  // Check if already initialized (external mode)
  const existingExternal = await resolveExternalCtxDir(cwd);
  if (existingExternal) {
    log.warn(`Already initialized in external mode at ${existingExternal.ctxPath}`);
    return;
  }

  // Initialize
  let ctxDir: string;
  if (args.external) {
    ctxDir = await initExternalCtxDir(cwd);
    log.success(`Initialized ctx (external) at ${ctxDir}`);
    log.dim('  Zero files created in the project directory.');
  } else {
    ctxDir = await initCtxDir(cwd);
    log.success(`Initialized .ctx/ in ${cwd}`);
  }

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
    if (args.external) {
      await registerProject(cwd, { external: true, ctxPath: ctxDir });
    } else {
      await registerProject(cwd);
    }
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
    const rulesDisplay = args.external ? `${ctxDir}/rules/01-project.md` : '.ctx/rules/01-project.md';
    log.success(`Created starter rule: ${rulesDisplay}`);
  } catch {
    // Rule already exists from import
  }

  // Create initial live session + pre-generate resume prompts
  try {
    const { resumeCount } = await autoRefresh({ cwd });
    const promptsDir = args.external ? `${ctxDir}/resume-prompts/` : '.ctx/resume-prompts/';
    log.success(`Pre-generated ${resumeCount} resume prompts (always ready in ${promptsDir})`);
  } catch {
    // non-fatal
  }

  const sessionDisplay = args.external ? `${ctxDir}/sessions/live.json` : '.ctx/sessions/live.json';
  const promptsDisplay = args.external ? `${ctxDir}/resume-prompts/<tool>.md` : '.ctx/resume-prompts/<tool>.md';

  log.header('Autonomous features enabled');
  if (isGit && !args.noHooks) {
    log.info('  Git hooks: auto-save context on commit/checkout/merge');
  }
  log.info(`  Live session: ${sessionDisplay} (always current)`);
  log.info(`  Resume prompts: ${promptsDisplay} (pre-generated)`);
  log.info('');
  log.info('  When a rate limit hits, your context is ALREADY saved.');
  log.info('  Just open the resume prompt for your tool and paste it in.');
  log.info('');
  log.dim('  Optional: run `ctx watch` for continuous background updates.');
  log.dim('  Optional: run `ctx projects list` to see all your projects.');
}
