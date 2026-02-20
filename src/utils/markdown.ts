/** Build a markdown section with a heading and body. */
export function mdSection(heading: string, body: string, level = 2): string {
  const prefix = '#'.repeat(level);
  return `${prefix} ${heading}\n\n${body.trim()}\n`;
}

/** Build a markdown list from items. */
export function mdList(items: string[]): string {
  return items.map((item) => `- ${item}`).join('\n');
}

/** Build a YAML frontmatter block. */
export function yamlFrontmatter(fields: Record<string, string | boolean | string[]>): string {
  const lines = ['---'];
  for (const [key, val] of Object.entries(fields)) {
    if (Array.isArray(val)) {
      lines.push(`${key}:`);
      for (const v of val) lines.push(`  - ${v}`);
    } else if (typeof val === 'boolean') {
      lines.push(`${key}: ${val}`);
    } else {
      lines.push(`${key}: ${val}`);
    }
  }
  lines.push('---');
  return lines.join('\n');
}

/** Compress markdown aggressively for tools with tight limits (e.g. Windsurf). */
export function compressMarkdown(text: string): string {
  return text
    .replace(/\n{3,}/g, '\n\n')           // collapse triple+ newlines
    .replace(/^#{1,3} /gm, '**')          // headings to bold (saves space)
    .replace(/\*\*(.+?)$/gm, '**$1**')    // close bold
    .replace(/^\s*[-*] /gm, '• ')         // normalize bullets
    .replace(/```[\s\S]*?```/g, (m) => {  // shrink code blocks
      const lines = m.split('\n');
      if (lines.length > 10) {
        return lines.slice(0, 8).join('\n') + '\n... (truncated)\n```';
      }
      return m;
    })
    .trim();
}
