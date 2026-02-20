import { createSession } from '../../core/session.js';
import { readRules } from '../../core/rules.js';
import { getAdapter } from '../../adapters/registry.js';
import { getBranch, autoDetectContext } from '../../core/git.js';
import { copyToClipboard } from '../../core/clipboard.js';
import { compile } from '../../core/compiler.js';
import { getProjectRoot } from '../../core/config.js';
import { autoRefresh } from '../../core/live.js';
import { touchProject } from '../../core/global.js';
import { log } from '../../utils/logger.js';
import { formatChars } from '../../utils/chars.js';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';

export async function switchCommand(args: {
  tool: string;
  message?: string;
  dryRun?: boolean;
}): Promise<void> {
  const startTime = Date.now();
  const { tool, dryRun } = args;

  // Validate tool
  const adapter = getAdapter(tool);
  if (!adapter) {
    log.error(`Unknown tool: "${tool}". Run \`ctx tools list\` to see supported tools.`);
    process.exit(1);
  }

  // Auto-detect context for autonomous session creation
  const ctx = await autoDetectContext();
  const task = args.message || `Continuing work on ${ctx.branch || 'main'}`;

  // Auto-save session
  log.info('Saving session...');
  const session = await createSession({
    task,
    tool: 'switching-to-' + adapter.name,
  });
  log.success(`Session saved: ${session.id}`);

  // Get rules
  const rules = await readRules();
  const projectRoot = await getProjectRoot();

  // Generate tool config
  const files = await adapter.generate({ rules, session, projectRoot });

  if (dryRun) {
    log.header(`Dry run — would generate for ${adapter.displayName}:`);
    for (const [filePath, content] of Object.entries(files)) {
      log.info(`  ${filePath} (${formatChars(content.length)})`);
    }
    return;
  }

  // Write all config files
  for (const [filePath, content] of Object.entries(files)) {
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, content);
  }

  log.success(`Generated ${adapter.displayName} config`);

  // Build resume prompt and copy to clipboard
  const compiled = compile({
    session,
    rules,
    charBudget: adapter.charBudget,
    compress: adapter.compress,
    toolName: adapter.name,
  });

  const copied = await copyToClipboard(compiled.resumePrompt);

  const elapsed = Date.now() - startTime;

  log.header(`Ready to switch to ${adapter.displayName}`);
  log.table([
    ['Session', session.id],
    ['Branch', session.branch || 'main'],
    ['Rules included', `${compiled.rulesIncluded} (${formatChars(compiled.chars)})`],
    ['Time', `${elapsed}ms`],
  ]);

  if (copied) {
    log.success('Resume prompt copied to clipboard');
    log.info(`Open ${adapter.displayName} and paste to continue where you left off.`);
  } else {
    log.warn('Could not copy to clipboard. Resume prompt:');
    console.log('\n---\n' + compiled.resumePrompt + '\n---\n');
  }

  // Update live session and global registry
  try {
    await autoRefresh({ task });
    await touchProject(projectRoot, task);
  } catch {
    // non-fatal
  }
}
