import { startWatcher, writePidFile, isWatcherRunning } from '../../core/watcher.js';
import { log } from '../../utils/logger.js';

export async function watchCommand(args: {
  interval?: number;
  noFileWatch?: boolean;
}): Promise<void> {
  // Check if already running
  const running = await isWatcherRunning();
  if (running) {
    log.warn('A watcher is already running for this project.');
    log.dim('  Stop it first, or use `ctx status` to see its state.');
    return;
  }

  log.header('Starting context watcher');
  log.info('Your context will be auto-saved continuously.');
  log.info('When a rate limit hits, your resume prompts are already ready in:');
  log.info('  .ctx/resume-prompts/<tool>.md');
  log.info('');

  // Write PID file so we can detect if watcher is running
  await writePidFile();

  await startWatcher({
    intervalMs: (args.interval || 30) * 1000,
    onChange: !args.noFileWatch,
  });
}
