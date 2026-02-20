import * as fs from 'node:fs/promises';
import { readRules, addRule, deleteRule, validateBudget } from '../../core/rules.js';
import { getToolBudgets } from '../../adapters/registry.js';
import { log } from '../../utils/logger.js';
import { formatChars } from '../../utils/chars.js';
import { ask } from '../../utils/prompt.js';

export async function rulesCommand(args: {
  subcommand: string;
  name?: string;
  file?: string;
  priority?: number;
}): Promise<void> {
  const { subcommand, name, file, priority } = args;

  switch (subcommand) {
    case 'list': {
      const rules = await readRules();
      if (rules.length === 0) {
        log.info('No rules defined. Run `ctx rules add` to create one.');
        return;
      }
      log.header('Rules');
      for (const rule of rules) {
        log.info(`  ${String(rule.priority).padStart(2, '0')} ${rule.name} (${formatChars(rule.chars)})`);
      }
      break;
    }

    case 'add': {
      let ruleName = name;
      let content: string;

      if (file) {
        // Import from file
        content = await fs.readFile(file, 'utf-8');
        ruleName = ruleName || file.replace(/^.*\//, '').replace(/\.\w+$/, '');
      } else {
        // Interactive
        if (!ruleName) {
          ruleName = await ask('Rule name (e.g. code-style, testing)');
          if (!ruleName) {
            log.error('Rule name is required.');
            process.exit(1);
          }
        }
        content = `# ${ruleName}\n\n<!-- Edit this file with your rules -->\n`;
      }

      const filePath = await addRule(ruleName, content, priority);
      log.success(`Created rule: ${filePath}`);
      if (!file) {
        log.dim('  Edit the file to add your rules.');
      }
      break;
    }

    case 'delete':
    case 'remove': {
      if (!name) {
        log.error('Rule name required. Use: ctx rules delete <name>');
        process.exit(1);
      }
      const deleted = await deleteRule(name);
      if (deleted) {
        log.success(`Deleted rule: ${name}`);
      } else {
        log.error(`Rule not found: ${name}`);
      }
      break;
    }

    case 'validate': {
      const rules = await readRules();
      if (rules.length === 0) {
        log.info('No rules to validate.');
        return;
      }
      const budgets = getToolBudgets();
      const results = validateBudget(rules, budgets);

      log.header('Budget Validation');
      for (const r of results) {
        if (r.overflow) {
          log.error(`  ${r.tool.padEnd(14)} ${r.display}`);
        } else {
          log.success(`${r.tool.padEnd(14)} ${r.display}`);
        }
      }
      break;
    }

    default:
      log.error(`Unknown subcommand: ${subcommand}. Use: list, add, delete, validate`);
      process.exit(1);
  }
}
