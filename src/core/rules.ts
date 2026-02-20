import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { getCtxDir, RULES_DIR } from './config.js';
import { charCount, formatChars } from '../utils/chars.js';

export interface RuleFile {
  name: string;
  path: string;
  content: string;
  priority: number; // Lower = higher priority (from filename prefix)
  chars: number;
}

/** Read all rules from .ctx/rules/, sorted by priority (filename prefix). */
export async function readRules(): Promise<RuleFile[]> {
  const ctxDir = await getCtxDir();
  const rulesDir = path.join(ctxDir, RULES_DIR);

  try {
    const files = await fs.readdir(rulesDir);
    const mdFiles = files.filter((f) => f.endsWith('.md')).sort();
    const rules: RuleFile[] = [];

    for (const file of mdFiles) {
      const filePath = path.join(rulesDir, file);
      const content = await fs.readFile(filePath, 'utf-8');
      const priorityMatch = file.match(/^(\d+)-/);
      const priority = priorityMatch ? parseInt(priorityMatch[1], 10) : 99;

      rules.push({
        name: file.replace(/^\d+-/, '').replace(/\.md$/, ''),
        path: filePath,
        content,
        priority,
        chars: charCount(content),
      });
    }

    return rules.sort((a, b) => a.priority - b.priority);
  } catch {
    return [];
  }
}

/** Add a new rule file. */
export async function addRule(name: string, content: string, priority?: number): Promise<string> {
  const ctxDir = await getCtxDir();
  const rulesDir = path.join(ctxDir, RULES_DIR);
  await fs.mkdir(rulesDir, { recursive: true });

  const existing = await readRules();
  const nextPriority = priority ?? (existing.length > 0 ? Math.max(...existing.map((r) => r.priority)) + 1 : 1);
  const paddedPriority = String(nextPriority).padStart(2, '0');
  const safeName = name.replace(/[^a-zA-Z0-9_-]/g, '-').toLowerCase();
  const filename = `${paddedPriority}-${safeName}.md`;
  const filePath = path.join(rulesDir, filename);

  await fs.writeFile(filePath, content);
  return filePath;
}

/** Delete a rule by name or filename. */
export async function deleteRule(nameOrFile: string): Promise<boolean> {
  const rules = await readRules();
  const rule = rules.find((r) => r.name === nameOrFile || path.basename(r.path) === nameOrFile);
  if (!rule) return false;
  await fs.unlink(rule.path);
  return true;
}

/** Validate rules against tool budgets. Returns budget info per tool. */
export function validateBudget(rules: RuleFile[], toolBudgets: Record<string, number>): {
  tool: string;
  budget: number;
  used: number;
  remaining: number;
  overflow: boolean;
  display: string;
}[] {
  const totalChars = rules.reduce((sum, r) => sum + r.chars, 0);

  return Object.entries(toolBudgets).map(([tool, budget]) => {
    const used = totalChars;
    const remaining = budget - used;
    const overflow = used > budget;
    const pct = Math.round((used / budget) * 100);
    const display = `${formatChars(used)} / ${formatChars(budget)} (${pct}%)${overflow ? ' OVERFLOW' : ''}`;
    return { tool, budget, used, remaining, overflow, display };
  });
}
