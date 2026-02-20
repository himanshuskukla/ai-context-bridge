import * as fs from 'node:fs/promises';
import { getLatestSession } from '../../core/session.js';
import { readRules } from '../../core/rules.js';
import { getAdapter } from '../../adapters/registry.js';
import { getBranch } from '../../core/git.js';
import { copyToClipboard } from '../../core/clipboard.js';
import { compile } from '../../core/compiler.js';
import { getProjectRoot } from '../../core/config.js';
import { log } from '../../utils/logger.js';
import { formatChars } from '../../utils/chars.js';

export async function resumeCommand(args: {
  tool: string;
  sessionId?: string;
  dryRun?: boolean;
  noClipboard?: boolean;
}): Promise<void> {
  const { tool, dryRun, noClipboard } = args;

  // Validate tool
  const adapter = getAdapter(tool);
  if (!adapter) {
    log.error(`Unknown tool: "${tool}". Run \`ctx tools list\` to see supported tools.`);
    process.exit(1);
  }

  // Get latest session
  const branch = await getBranch();
  const session = await getLatestSession(branch);
  if (!session) {
    log.warn('No saved session found. Run `ctx save` first.');
    log.dim('Generating config from rules only...');
  }

  // Get rules
  const rules = await readRules();
  const projectRoot = await getProjectRoot();

  // Generate tool config files
  const files = await adapter.generate({ rules, session, projectRoot });

  if (dryRun) {
    log.header(`Dry run — would generate for ${adapter.displayName}:`);
    for (const [filePath, content] of Object.entries(files)) {
      log.info(`  ${filePath} (${formatChars(content.length)})`);
    }
    return;
  }

  // Write files
  for (const [filePath, content] of Object.entries(files)) {
    await fs.mkdir((await import('node:path')).dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, content);
  }

  log.success(`Generated config for ${adapter.displayName}`);
  for (const filePath of Object.keys(files)) {
    log.dim(`  ${filePath}`);
  }

  // Build and copy resume prompt
  if (session && !noClipboard) {
    const compiled = compile({
      session,
      rules: [],
      charBudget: adapter.charBudget,
      compress: adapter.compress,
      toolName: adapter.name,
    });

    const copied = await copyToClipboard(compiled.resumePrompt);
    if (copied) {
      log.success('Resume prompt copied to clipboard — paste it into ' + adapter.displayName);
    } else {
      log.warn('Could not copy to clipboard. Resume prompt:');
      console.log('\n' + compiled.resumePrompt + '\n');
    }
  }
}
