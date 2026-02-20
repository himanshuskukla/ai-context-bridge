import { listSessions, getSession, deleteSession } from '../../core/session.js';
import { log } from '../../utils/logger.js';

export async function sessionCommand(args: {
  subcommand: string;
  sessionId?: string;
  branch?: string;
}): Promise<void> {
  const { subcommand, sessionId, branch } = args;

  switch (subcommand) {
    case 'list': {
      const sessions = await listSessions(branch);
      if (sessions.length === 0) {
        log.info('No sessions found.');
        return;
      }
      log.header(`Sessions${branch ? ` (branch: ${branch})` : ''}`);
      for (const sess of sessions) {
        const branchLabel = sess.branch ? ` [${sess.branch}]` : '';
        log.info(`  ${sess.id}${branchLabel} — ${sess.task}`);
        log.dim(`    ${sess.timestamp} | ${sess.filesChanged.length} files | ${sess.tool || 'unknown tool'}`);
      }
      log.dim(`\n  Total: ${sessions.length} session(s)`);
      break;
    }

    case 'show': {
      if (!sessionId) {
        log.error('Session ID required. Use: ctx session show <id>');
        process.exit(1);
      }
      const sess = await getSession(sessionId);
      if (!sess) {
        log.error(`Session not found: ${sessionId}`);
        process.exit(1);
      }
      log.header(`Session: ${sess.id}`);
      log.table([
        ['Task', sess.task],
        ['Branch', sess.branch || 'main'],
        ['Time', sess.timestamp],
        ['Tool', sess.tool || 'unknown'],
        ['Head', sess.headHash || 'n/a'],
        ['Diff', sess.diffSummary || 'none'],
      ]);
      if (sess.decisions.length > 0) {
        log.header('Decisions');
        for (const d of sess.decisions) log.info(`  - ${d}`);
      }
      if (sess.nextSteps.length > 0) {
        log.header('Next Steps');
        for (const s of sess.nextSteps) log.info(`  - ${s}`);
      }
      if (sess.filesChanged.length > 0) {
        log.header('Files Changed');
        for (const f of sess.filesChanged) log.info(`  - ${f}`);
      }
      if (sess.recentCommits.length > 0) {
        log.header('Recent Commits');
        for (const c of sess.recentCommits) log.info(`  ${c}`);
      }
      break;
    }

    case 'delete': {
      if (!sessionId) {
        log.error('Session ID required. Use: ctx session delete <id>');
        process.exit(1);
      }
      const deleted = await deleteSession(sessionId);
      if (deleted) {
        log.success(`Deleted session: ${sessionId}`);
      } else {
        log.error(`Session not found: ${sessionId}`);
      }
      break;
    }

    default:
      log.error(`Unknown subcommand: ${subcommand}. Use: list, show, delete`);
      process.exit(1);
  }
}
