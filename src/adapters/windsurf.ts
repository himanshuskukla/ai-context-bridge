import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import type { ToolAdapter } from './types.js';
import { compile } from '../core/compiler.js';
import { charCount } from '../utils/chars.js';

const MAX_PER_FILE = 6_000;
const MAX_TOTAL = 12_000;

export const windsurfAdapter: ToolAdapter = {
  name: 'windsurf',
  displayName: 'Windsurf',
  charBudget: MAX_TOTAL,
  compress: true, // Aggressive compression due to tight limits
  configPaths: ['.windsurf/rules/'],

  async generate({ rules, session, projectRoot }) {
    const output: Record<string, string> = {};
    const rulesDir = path.join(projectRoot, '.windsurf', 'rules');
    await fs.mkdir(rulesDir, { recursive: true });

    let totalUsed = 0;

    // Session always gets priority
    if (session) {
      const sessionResult = compile({
        session,
        rules: [],
        charBudget: MAX_PER_FILE,
        compress: true,
        toolName: this.name,
      });
      const sessionPath = path.join(rulesDir, '_session-resume.md');
      output[sessionPath] = sessionResult.content;
      totalUsed += charCount(sessionResult.content);
    }

    // Add rules, compressed, respecting per-file and total limits
    for (const rule of rules) {
      if (totalUsed >= MAX_TOTAL) break;

      const remainingTotal = MAX_TOTAL - totalUsed;
      const fileBudget = Math.min(MAX_PER_FILE, remainingTotal);

      const result = compile({
        session: null,
        rules: [rule],
        charBudget: fileBudget,
        compress: true,
        toolName: this.name,
      });

      const filename = `${String(rule.priority).padStart(2, '0')}-${rule.name}.md`;
      output[path.join(rulesDir, filename)] = result.content;
      totalUsed += charCount(result.content);
    }

    return output;
  },

  async importExisting(projectRoot) {
    const rulesDir = path.join(projectRoot, '.windsurf', 'rules');
    try {
      const files = await fs.readdir(rulesDir);
      const mdFiles = files.filter((f) => f.endsWith('.md'));
      if (mdFiles.length === 0) return null;

      const parts: string[] = [];
      for (const file of mdFiles.sort()) {
        const content = await fs.readFile(path.join(rulesDir, file), 'utf-8');
        if (content.trim()) parts.push(`## ${file.replace('.md', '')}\n\n${content.trim()}`);
      }
      return parts.join('\n\n') || null;
    } catch {
      return null;
    }
  },

  async detect() {
    try {
      const { execFile } = await import('node:child_process');
      const { promisify } = await import('node:util');
      await promisify(execFile)('windsurf', ['--version'], { timeout: 3000 });
      return true;
    } catch {
      return false;
    }
  },
};
