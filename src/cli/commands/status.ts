import { readConfig } from '../../core/config.js';
import { readRules } from '../../core/rules.js';
import { getLatestSession, listSessions } from '../../core/session.js';
import { getBranch, isGitRepo, getHeadHash } from '../../core/git.js';
import { log } from '../../utils/logger.js';
import { formatChars } from '../../utils/chars.js';

export async function statusCommand(): Promise<void> {
  const config = await readConfig();

  // Git info
  const gitEnabled = await isGitRepo();
  const branch = await getBranch();
  const hash = await getHeadHash();

  log.header('Project Status');
  log.table([
    ['Git', gitEnabled ? `${branch || 'unknown'} (${hash || 'no commits'})` : 'not a git repo'],
    ['Default tool', config.defaultTool || 'none'],
    ['Enabled tools', config.enabledTools.join(', ')],
    ['Auto-save', config.autoSave ? 'on' : 'off'],
    ['Auto-detect', config.autoDetect ? 'on' : 'off'],
  ]);

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

  // Session info
  const latest = await getLatestSession(branch);
  const allSessions = await listSessions();

  log.header('Sessions');
  if (!latest) {
    log.dim('  No sessions saved. Run `ctx save` to create one.');
  } else {
    log.table([
      ['Latest', latest.id],
      ['Task', latest.task],
      ['Time', latest.timestamp],
      ['Branch', latest.branch || 'main'],
      ['Tool', latest.tool || 'unknown'],
      ['Files changed', String(latest.filesChanged.length)],
    ]);
    log.dim(`  Total sessions: ${allSessions.length}`);
  }
}
