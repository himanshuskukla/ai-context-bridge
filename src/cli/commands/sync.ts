import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { readConfig, getProjectRoot } from '../../core/config.js';
import { readRules } from '../../core/rules.js';
import { getLatestSession } from '../../core/session.js';
import { getBranch } from '../../core/git.js';
import { getAdapter, getAllAdapters } from '../../adapters/registry.js';
import { log } from '../../utils/logger.js';
import { formatChars } from '../../utils/chars.js';

export async function syncCommand(args: {
  tools?: string[];
  dryRun?: boolean;
  includeSession?: boolean;
}): Promise<void> {
  const { dryRun, includeSession } = args;
  const config = await readConfig();
  const rules = await readRules();
  const projectRoot = await getProjectRoot();

  // Get session if requested
  let session = null;
  if (includeSession) {
    const branch = await getBranch();
    session = await getLatestSession(branch);
  }

  // Determine which tools to sync
  const toolNames = args.tools && args.tools.length > 0 ? args.tools : config.enabledTools;
  const adapters = toolNames.map((name) => getAdapter(name)).filter(Boolean);

  if (adapters.length === 0) {
    log.warn('No tools to sync. Check your .ctx/config.json enabledTools.');
    return;
  }

  log.header(`Syncing rules to ${adapters.length} tool(s)`);
  if (rules.length === 0) {
    log.warn('No rules found in .ctx/rules/. Add some with `ctx rules add`.');
  }

  let totalFiles = 0;

  for (const adapter of adapters) {
    if (!adapter) continue;

    try {
      const files = await adapter.generate({ rules, session, projectRoot });
      const fileCount = Object.keys(files).length;
      const totalChars = Object.values(files).reduce((sum, c) => sum + c.length, 0);

      if (dryRun) {
        log.info(`  ${adapter.displayName}: ${fileCount} file(s), ${formatChars(totalChars)}`);
        for (const filePath of Object.keys(files)) {
          log.dim(`    ${filePath}`);
        }
      } else {
        for (const [filePath, content] of Object.entries(files)) {
          await fs.mkdir(path.dirname(filePath), { recursive: true });
          await fs.writeFile(filePath, content);
        }
        log.success(`${adapter.displayName}: ${fileCount} file(s) written (${formatChars(totalChars)})`);
      }

      totalFiles += fileCount;
    } catch (err) {
      log.error(`Failed to sync ${adapter.displayName}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  if (dryRun) {
    log.dim(`\nDry run complete. ${totalFiles} file(s) would be written.`);
  } else {
    log.success(`\nSynced ${totalFiles} file(s) across ${adapters.length} tool(s).`);
  }
}
