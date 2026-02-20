import { getAllAdapters, getAdapter } from '../../adapters/registry.js';
import { readConfig } from '../../core/config.js';
import { log } from '../../utils/logger.js';
import { formatChars } from '../../utils/chars.js';

export async function toolsCommand(args: {
  subcommand: string;
}): Promise<void> {
  const { subcommand } = args;

  switch (subcommand) {
    case 'list': {
      const config = await readConfig();
      const adapters = getAllAdapters();

      log.header('Supported Tools');
      for (const adapter of adapters) {
        const enabled = config.enabledTools.includes(adapter.name);
        const status = enabled ? 'enabled' : 'disabled';
        log.info(`  ${adapter.name.padEnd(14)} ${adapter.displayName.padEnd(22)} ${formatChars(adapter.charBudget).padEnd(12)} ${status}`);
      }
      log.dim(`\n  ${adapters.length} tools supported. Edit .ctx/config.json to enable/disable.`);
      break;
    }

    case 'check': {
      const adapters = getAllAdapters();

      log.header('Tool Detection');
      const checks = await Promise.all(
        adapters.map(async (adapter) => ({
          adapter,
          detected: await adapter.detect(),
        }))
      );

      for (const { adapter, detected } of checks) {
        if (detected) {
          log.success(`${adapter.name.padEnd(14)} ${adapter.displayName} — detected`);
        } else {
          log.dim(`  ${adapter.name.padEnd(14)} ${adapter.displayName} — not found`);
        }
      }
      break;
    }

    default:
      log.error(`Unknown subcommand: ${subcommand}. Use: list, check`);
      process.exit(1);
  }
}
