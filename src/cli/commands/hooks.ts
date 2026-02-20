import { installHooks, uninstallHooks, checkHooks } from '../../core/hooks.js';
import { log } from '../../utils/logger.js';

export async function hooksCommand(args: {
  subcommand: string;
}): Promise<void> {
  const { subcommand } = args;

  switch (subcommand) {
    case 'install': {
      try {
        const installed = await installHooks();
        if (installed.length === 0) {
          log.info('Git hooks already installed.');
        } else {
          log.success(`Installed git hooks: ${installed.join(', ')}`);
          log.dim('  Context will auto-save on commit, checkout, and merge.');
        }
      } catch (err) {
        log.error(err instanceof Error ? err.message : String(err));
        process.exit(1);
      }
      break;
    }

    case 'uninstall': {
      const removed = await uninstallHooks();
      if (removed.length === 0) {
        log.info('No ctx git hooks found.');
      } else {
        log.success(`Removed git hooks: ${removed.join(', ')}`);
      }
      break;
    }

    case 'status': {
      const { installed, missing } = await checkHooks();
      log.header('Git Hooks');
      if (installed.length > 0) {
        for (const h of installed) log.success(`${h} — installed`);
      }
      if (missing.length > 0) {
        for (const h of missing) log.dim(`  ${h} — not installed`);
      }
      if (installed.length === 0) {
        log.dim('\n  Run `ctx hooks install` to enable auto-save on git events.');
      }
      break;
    }

    default:
      log.error(`Unknown subcommand: ${subcommand}. Use: install, uninstall, status`);
      process.exit(1);
  }
}
