import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import type { ToolAdapter } from './types.js';
import { compile } from '../core/compiler.js';
import { yamlFrontmatter } from '../utils/markdown.js';

export const continueAdapter: ToolAdapter = {
  name: 'continue',
  displayName: 'Continue',
  charBudget: 100_000,
  compress: false,
  configPaths: ['.continue/rules/'],

  async generate({ rules, session, projectRoot }) {
    const output: Record<string, string> = {};
    const rulesDir = path.join(projectRoot, '.continue', 'rules');
    await fs.mkdir(rulesDir, { recursive: true });

    // One file per rule with YAML frontmatter
    for (const rule of rules) {
      const frontmatter = yamlFrontmatter({
        name: rule.name,
        globs: '**/*',
        alwaysApply: true,
      });
      const filename = `${String(rule.priority).padStart(2, '0')}-${rule.name}.md`;
      output[path.join(rulesDir, filename)] = frontmatter + '\n\n' + rule.content;
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
      const frontmatter = yamlFrontmatter({
        name: 'Session Resume',
        globs: '**/*',
        alwaysApply: true,
      });
      output[path.join(rulesDir, '_session-resume.md')] = frontmatter + '\n\n' + result.content;
    }

    return output;
  },

  async importExisting(projectRoot) {
    const rulesDir = path.join(projectRoot, '.continue', 'rules');
    try {
      const files = await fs.readdir(rulesDir);
      const mdFiles = files.filter((f) => f.endsWith('.md'));
      if (mdFiles.length === 0) return null;

      const parts: string[] = [];
      for (const file of mdFiles.sort()) {
        const content = await fs.readFile(path.join(rulesDir, file), 'utf-8');
        const stripped = content.replace(/^---[\s\S]*?---\n*/m, '').trim();
        if (stripped) parts.push(`## ${file.replace('.md', '')}\n\n${stripped}`);
      }
      return parts.join('\n\n') || null;
    } catch {
      return null;
    }
  },

  async detect() {
    return false; // VS Code extension
  },
};
