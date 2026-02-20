import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import type { ToolAdapter } from './types.js';
import { compile } from '../core/compiler.js';

export const amazonqAdapter: ToolAdapter = {
  name: 'amazonq',
  displayName: 'Amazon Q Developer',
  charBudget: 100_000,
  compress: false,
  configPaths: ['.amazonq/rules/'],

  async generate({ rules, session, projectRoot }) {
    const output: Record<string, string> = {};
    const rulesDir = path.join(projectRoot, '.amazonq', 'rules');
    await fs.mkdir(rulesDir, { recursive: true });

    // One file per rule
    for (const rule of rules) {
      const filename = `${String(rule.priority).padStart(2, '0')}-${rule.name}.md`;
      output[path.join(rulesDir, filename)] = rule.content;
    }

    // Session file
    if (session) {
      const result = compile({
        session,
        rules: [],
        charBudget: this.charBudget,
        compress: false,
        toolName: this.name,
      });
      output[path.join(rulesDir, '_session-resume.md')] = result.content;
    }

    return output;
  },

  async importExisting(projectRoot) {
    const rulesDir = path.join(projectRoot, '.amazonq', 'rules');
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
      await promisify(execFile)('q', ['--version'], { timeout: 3000 });
      return true;
    } catch {
      return false;
    }
  },
};
