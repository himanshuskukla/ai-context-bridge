import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import type { ToolAdapter } from './types.js';
import { compile } from '../core/compiler.js';

export const clineAdapter: ToolAdapter = {
  name: 'cline',
  displayName: 'Cline',
  charBudget: 200_000, // No hard limit
  compress: false,
  configPaths: ['.clinerules/'],

  async generate({ rules, session, projectRoot }) {
    const output: Record<string, string> = {};
    const rulesDir = path.join(projectRoot, '.clinerules');
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
    const rulesDir = path.join(projectRoot, '.clinerules');
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
    return false; // VS Code extension, not detectable via CLI
  },
};
