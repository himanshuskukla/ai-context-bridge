import { parseArgs } from 'node:util';
import { setLogLevel } from './utils/logger.js';
import { log } from './utils/logger.js';

const VERSION = '0.1.0';

const HELP = `
ai-context-bridge (ctx) v${VERSION}
Cross-AI-tool context portability CLI

USAGE
  ctx <command> [options]

COMMANDS
  init                    Initialize .ctx/ in current project
  save [message]          Save current session state
  resume --tool <name>    Generate config + resume prompt for target tool
  switch <tool> [message] Save session + generate config in one step
  sync [--tools ...]      Generate config files for all enabled tools
  status                  Show current session, branch, rules
  session list|show|delete  Manage saved sessions
  rules add|list|delete|validate  Manage rule files
  tools list|check        Show supported tools, detect installed ones

OPTIONS
  --help, -h              Show this help
  --version, -v           Show version
  --verbose               Verbose output
  --quiet, -q             Minimal output
  --dry-run               Preview changes without writing files
  --tool <name>           Target tool name
  --no-clipboard          Don't copy resume prompt to clipboard

SUPPORTED TOOLS
  claude, cursor, codex, copilot, windsurf, cline,
  aider, continue, amazonq, zed, antigravity

EXAMPLES
  ctx init                        # Set up .ctx/ in your project
  ctx save "implementing auth"    # Save session snapshot
  ctx switch cursor               # Save + generate Cursor config + copy prompt
  ctx resume --tool codex         # Generate Codex config from latest session
  ctx sync                        # Generate configs for all enabled tools
  ctx rules validate              # Check rules fit within tool budgets
`;

async function main(): Promise<void> {
  const args = process.argv.slice(2);

  // Handle empty args or help
  if (args.length === 0 || args[0] === '--help' || args[0] === '-h') {
    console.log(HELP);
    return;
  }

  if (args[0] === '--version' || args[0] === '-v') {
    console.log(VERSION);
    return;
  }

  const command = args[0];
  const rest = args.slice(1);

  // Parse global flags
  let verbose = false;
  let quiet = false;
  let dryRun = false;
  let noClipboard = false;

  const filteredRest: string[] = [];
  for (let i = 0; i < rest.length; i++) {
    switch (rest[i]) {
      case '--verbose':
        verbose = true;
        break;
      case '--quiet':
      case '-q':
        quiet = true;
        break;
      case '--dry-run':
        dryRun = true;
        break;
      case '--no-clipboard':
        noClipboard = true;
        break;
      default:
        filteredRest.push(rest[i]);
    }
  }

  if (verbose) setLogLevel('verbose');
  if (quiet) setLogLevel('quiet');

  try {
    switch (command) {
      case 'init': {
        const { initCommand } = await import('./cli/commands/init.js');
        const noImport = filteredRest.includes('--no-import');
        await initCommand({ import: !noImport });
        break;
      }

      case 'save': {
        const { saveCommand } = await import('./cli/commands/save.js');
        // Collect --decisions and --next-steps flags
        let message = '';
        let tool: string | undefined;
        const decisions: string[] = [];
        const nextSteps: string[] = [];
        let interactive = true;

        for (let i = 0; i < filteredRest.length; i++) {
          if (filteredRest[i] === '--tool' && filteredRest[i + 1]) {
            tool = filteredRest[++i];
          } else if (filteredRest[i] === '--decision' && filteredRest[i + 1]) {
            decisions.push(filteredRest[++i]);
          } else if (filteredRest[i] === '--next' && filteredRest[i + 1]) {
            nextSteps.push(filteredRest[++i]);
          } else if (filteredRest[i] === '--no-interactive') {
            interactive = false;
          } else if (!filteredRest[i].startsWith('-')) {
            message = filteredRest[i];
          }
        }

        await saveCommand({ message, tool, decisions, nextSteps, interactive });
        break;
      }

      case 'resume': {
        const { resumeCommand } = await import('./cli/commands/resume.js');
        let tool = '';
        let sessionId: string | undefined;

        for (let i = 0; i < filteredRest.length; i++) {
          if ((filteredRest[i] === '--tool' || filteredRest[i] === '-t') && filteredRest[i + 1]) {
            tool = filteredRest[++i];
          } else if (filteredRest[i] === '--session' && filteredRest[i + 1]) {
            sessionId = filteredRest[++i];
          } else if (!filteredRest[i].startsWith('-')) {
            tool = tool || filteredRest[i];
          }
        }

        if (!tool) {
          log.error('Tool name required. Use: ctx resume --tool <name>');
          process.exit(1);
        }

        await resumeCommand({ tool, sessionId, dryRun, noClipboard });
        break;
      }

      case 'switch': {
        const { switchCommand } = await import('./cli/commands/switch.js');
        const tool = filteredRest[0];
        const message = filteredRest[1];

        if (!tool || tool.startsWith('-')) {
          log.error('Tool name required. Use: ctx switch <tool> [message]');
          process.exit(1);
        }

        await switchCommand({ tool, message, dryRun });
        break;
      }

      case 'sync': {
        const { syncCommand } = await import('./cli/commands/sync.js');
        const tools: string[] = [];
        let includeSession = false;

        for (let i = 0; i < filteredRest.length; i++) {
          if (filteredRest[i] === '--tools' && filteredRest[i + 1]) {
            tools.push(...filteredRest[++i].split(','));
          } else if (filteredRest[i] === '--with-session') {
            includeSession = true;
          } else if (!filteredRest[i].startsWith('-')) {
            tools.push(filteredRest[i]);
          }
        }

        await syncCommand({ tools, dryRun, includeSession });
        break;
      }

      case 'status': {
        const { statusCommand } = await import('./cli/commands/status.js');
        await statusCommand();
        break;
      }

      case 'session': {
        const { sessionCommand } = await import('./cli/commands/session.js');
        const subcommand = filteredRest[0] || 'list';
        const sessionId = filteredRest[1];
        let branch: string | undefined;

        for (let i = 0; i < filteredRest.length; i++) {
          if (filteredRest[i] === '--branch' && filteredRest[i + 1]) {
            branch = filteredRest[++i];
          }
        }

        await sessionCommand({ subcommand, sessionId, branch });
        break;
      }

      case 'rules': {
        const { rulesCommand } = await import('./cli/commands/rules.js');
        const subcommand = filteredRest[0] || 'list';
        let name: string | undefined;
        let file: string | undefined;
        let priority: number | undefined;

        for (let i = 1; i < filteredRest.length; i++) {
          if (filteredRest[i] === '--file' && filteredRest[i + 1]) {
            file = filteredRest[++i];
          } else if (filteredRest[i] === '--priority' && filteredRest[i + 1]) {
            priority = parseInt(filteredRest[++i], 10);
          } else if (!filteredRest[i].startsWith('-')) {
            name = name || filteredRest[i];
          }
        }

        await rulesCommand({ subcommand, name, file, priority });
        break;
      }

      case 'tools': {
        const { toolsCommand } = await import('./cli/commands/tools.js');
        const subcommand = filteredRest[0] || 'list';
        await toolsCommand({ subcommand });
        break;
      }

      default:
        log.error(`Unknown command: ${command}. Run \`ctx --help\` for usage.`);
        process.exit(1);
    }
  } catch (err) {
    if (err instanceof Error) {
      log.error(err.message);
      if (verbose) console.error(err.stack);
    } else {
      log.error(String(err));
    }
    process.exit(1);
  }
}

main();
