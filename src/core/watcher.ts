import * as fs from 'node:fs';
import * as path from 'node:path';
import { getProjectRoot, getCtxDir } from './config.js';
import { autoRefresh } from './live.js';
import { log } from '../utils/logger.js';

interface WatcherOptions {
  intervalMs?: number;  // How often to refresh (default: 30 seconds)
  onChange?: boolean;    // Also refresh on file changes (default: true)
}

/**
 * Background watcher that keeps the live session and resume prompts
 * always up to date. Runs as a foreground process (ctrl+c to stop).
 *
 * Two refresh strategies:
 * 1. Timer-based: refreshes every N seconds regardless
 * 2. Change-based: refreshes when files in the project change
 */
export async function startWatcher(opts: WatcherOptions = {}): Promise<void> {
  const intervalMs = opts.intervalMs ?? 30_000;
  const onChange = opts.onChange ?? true;

  const projectRoot = await getProjectRoot();
  const ctxDir = await getCtxDir();

  log.info(`Watching ${projectRoot}`);
  log.dim(`  Refresh interval: ${intervalMs / 1000}s`);
  log.dim(`  File change detection: ${onChange ? 'on' : 'off'}`);
  log.dim(`  Press Ctrl+C to stop.\n`);

  // Initial refresh
  await doRefresh();

  // Timer-based refresh
  const timer = setInterval(doRefresh, intervalMs);

  // File-change-based refresh (debounced)
  let fsWatcher: fs.FSWatcher | null = null;
  if (onChange) {
    let debounceTimer: ReturnType<typeof setTimeout> | null = null;

    try {
      fsWatcher = fs.watch(projectRoot, { recursive: true }, (eventType, filename) => {
        // Ignore changes inside .ctx/ and .git/ and node_modules/
        if (!filename) return;
        if (filename.startsWith('.ctx') || filename.startsWith('.git') || filename.includes('node_modules')) return;

        // Debounce: wait 2 seconds after last change before refreshing
        if (debounceTimer) clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
          log.debug(`File changed: ${filename}`);
          doRefresh();
        }, 2000);
      });
    } catch {
      log.warn('File watching not available on this platform. Using timer only.');
    }
  }

  // Handle graceful shutdown
  const cleanup = () => {
    clearInterval(timer);
    if (fsWatcher) fsWatcher.close();
    log.info('\nWatcher stopped.');
    process.exit(0);
  };

  process.on('SIGINT', cleanup);
  process.on('SIGTERM', cleanup);

  // Keep alive
  await new Promise(() => {}); // Never resolves — watcher runs until killed
}

async function doRefresh(): Promise<void> {
  try {
    const { session, resumeCount } = await autoRefresh();
    const time = new Date().toLocaleTimeString();
    log.debug(`[${time}] Refreshed: ${session.filesChanged.length} files, ${resumeCount} resume prompts`);
  } catch (err) {
    log.debug(`Refresh failed: ${err instanceof Error ? err.message : String(err)}`);
  }
}

/**
 * Write a PID file so other processes can check if a watcher is running.
 */
export async function writePidFile(): Promise<void> {
  const ctxDir = await getCtxDir();
  const pidPath = path.join(ctxDir, 'watcher.pid');
  await fs.promises.writeFile(pidPath, String(process.pid));

  // Clean up PID file on exit
  const cleanup = async () => {
    try { await fs.promises.unlink(pidPath); } catch {}
  };
  process.on('exit', cleanup);
  process.on('SIGINT', cleanup);
  process.on('SIGTERM', cleanup);
}

/** Check if a watcher is currently running. */
export async function isWatcherRunning(): Promise<boolean> {
  const ctxDir = await getCtxDir();
  const pidPath = path.join(ctxDir, 'watcher.pid');

  try {
    const pid = parseInt(await fs.promises.readFile(pidPath, 'utf-8'), 10);
    // Check if process is alive
    process.kill(pid, 0); // Signal 0 = just check, don't actually kill
    return true;
  } catch {
    return false;
  }
}
