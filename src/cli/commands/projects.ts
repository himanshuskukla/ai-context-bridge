import { listProjects, unregisterProject } from '../../core/global.js';
import { log } from '../../utils/logger.js';

export async function projectsCommand(args: {
  subcommand: string;
  projectPath?: string;
}): Promise<void> {
  const { subcommand } = args;

  switch (subcommand) {
    case 'list': {
      const projects = await listProjects();

      if (projects.length === 0) {
        log.info('No projects registered. Run `ctx init` in a project to register it.');
        return;
      }

      log.header(`Projects (${projects.length})`);
      for (const p of projects) {
        const status = !p.exists
          ? '(missing)'
          : p.hasLiveSession
            ? '(live)'
            : '(idle)';

        const branchInfo = p.branch ? `[${p.branch}]` : '';
        const taskInfo = p.task ? ` — ${p.task}` : '';
        const storageIcon = p.storage === 'git' ? 'git' : 'local';

        log.info(`  ${p.name} ${branchInfo} ${status}`);
        log.dim(`    ${p.path} (${storageIcon})${taskInfo}`);

        const lastActive = new Date(p.lastActive);
        const ago = timeSince(lastActive);
        log.dim(`    Last active: ${ago}`);
      }

      const liveCount = projects.filter((p) => p.hasLiveSession).length;
      if (liveCount > 0) {
        log.info(`\n  ${liveCount} project(s) with live context ready.`);
      }
      break;
    }

    case 'remove': {
      if (!args.projectPath) {
        log.error('Project path required. Use: ctx projects remove <path>');
        process.exit(1);
      }
      const removed = await unregisterProject(args.projectPath);
      if (removed) {
        log.success(`Removed project: ${args.projectPath}`);
      } else {
        log.error(`Project not found in registry: ${args.projectPath}`);
      }
      break;
    }

    default:
      log.error(`Unknown subcommand: ${subcommand}. Use: list, remove`);
      process.exit(1);
  }
}

function timeSince(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);

  if (seconds < 60) return 'just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
  return date.toLocaleDateString();
}
