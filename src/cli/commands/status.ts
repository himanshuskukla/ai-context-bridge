import { readConfig, getCtxDir } from '../../core/config.js';
import { readRules } from '../../core/rules.js';
import { getLatestSession, listSessions } from '../../core/session.js';
import { readLiveSession } from '../../core/live.js';
import { getBranch, isGitRepo, getHeadHash } from '../../core/git.js';
import { checkHooks } from '../../core/hooks.js';
import { isWatcherRunning } from '../../core/watcher.js';
import { log } from '../../utils/logger.js';
import { formatChars } from '../../utils/chars.js';

export async function statusCommand(): Promise<void> {
  const config = await readConfig();
  const ctxDir = await getCtxDir();

  // Git info
  const gitEnabled = await isGitRepo();
  const branch = await getBranch();
  const hash = await getHeadHash();

  // Determine storage display
  const isExternal = !ctxDir.includes('.ctx') || ctxDir.includes('.ctx-global');
  const storageDisplay = isExternal ? `external (${ctxDir})` : gitEnabled ? 'git' : 'local directory';

  log.header('Project Status');
  log.table([
    ['Git', gitEnabled ? `${branch || 'unknown'} (${hash || 'no commits'})` : 'not a git repo'],
    ['Storage', storageDisplay],
    ['Default tool', config.defaultTool || 'none'],
    ['Enabled tools', config.enabledTools.join(', ')],
  ]);

  // Autonomous features
  log.header('Autonomous Features');
  const hooksStatus = await checkHooks();
  const watcherRunning = await isWatcherRunning();
  const live = await readLiveSession();

  log.table([
    ['Git hooks', hooksStatus.installed.length > 0 ? `active (${hooksStatus.installed.join(', ')})` : 'not installed'],
    ['Watcher', watcherRunning ? 'running' : 'stopped'],
    ['Live session', live ? `ready (${live.timestamp})` : 'none'],
    ['Resume prompts', live ? `pre-generated in ${ctxDir}/resume-prompts/` : 'not available'],
  ]);

  if (!hooksStatus.installed.length && !watcherRunning) {
    log.dim('\n  No auto-save active. Run `ctx hooks install` or `ctx watch`.');
  }

  // Rules info
  const rules = await readRules();
  const totalChars = rules.reduce((sum, r) => sum + r.chars, 0);

  log.header('Rules');
  if (rules.length === 0) {
    log.dim('  No rules defined. Run `ctx rules add` to create one.');
  } else {
    for (const rule of rules) {
      log.info(`  ${String(rule.priority).padStart(2, '0')} ${rule.name} (${formatChars(rule.chars)})`);
    }
    log.dim(`  Total: ${formatChars(totalChars)}`);
  }

  // Live session info
  if (live) {
    log.header('Live Session (always current)');
    log.table([
      ['Task', live.task],
      ['Branch', live.branch || 'main'],
      ['Head', live.headHash || 'n/a'],
      ['Files changed', String(live.filesChanged.length)],
      ['Diff', live.diffSummary || 'none'],
      ['Updated', live.timestamp],
    ]);
  }

  // Saved sessions info
  const latest = await getLatestSession(branch);
  const allSessions = await listSessions();

  log.header('Saved Sessions');
  if (!latest) {
    log.dim('  No sessions saved. Run `ctx save` to create one.');
  } else {
    log.table([
      ['Latest', latest.id],
      ['Task', latest.task],
      ['Time', latest.timestamp],
    ]);
    log.dim(`  Total sessions: ${allSessions.length}`);
  }
}
