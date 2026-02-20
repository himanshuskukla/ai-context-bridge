import { createSession } from '../../core/session.js';
import { log } from '../../utils/logger.js';
import { ask } from '../../utils/prompt.js';

export async function saveCommand(args: {
  message?: string;
  tool?: string;
  decisions?: string[];
  nextSteps?: string[];
  interactive?: boolean;
}): Promise<void> {
  let task = args.message || '';
  let decisions = args.decisions || [];
  let nextSteps = args.nextSteps || [];

  // Interactive mode if no message provided
  if (!task) {
    if (args.interactive !== false) {
      task = await ask('What are you working on?');
      if (!task) {
        log.error('Task description is required.');
        process.exit(1);
      }

      const decisionsRaw = await ask('Key decisions made (comma-separated, or empty)');
      if (decisionsRaw) decisions = decisionsRaw.split(',').map((d) => d.trim());

      const stepsRaw = await ask('Next steps (comma-separated, or empty)');
      if (stepsRaw) nextSteps = stepsRaw.split(',').map((s) => s.trim());
    } else {
      log.error('Task description is required. Use: ctx save "your message"');
      process.exit(1);
    }
  }

  const session = await createSession({
    task,
    tool: args.tool,
    decisions,
    nextSteps,
  });

  log.success(`Session saved: ${session.id}`);
  log.table([
    ['Branch', session.branch || 'main'],
    ['Task', session.task],
    ['Files changed', String(session.filesChanged.length)],
    ['Diff', session.diffSummary || 'none'],
  ]);
}
