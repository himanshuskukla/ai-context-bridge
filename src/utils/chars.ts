/** Count characters in a string. Tool limits are in chars, not tokens. */
export function charCount(text: string): number {
  return text.length;
}

/** Truncate text to fit within a character budget, adding a truncation notice. */
export function truncateToChars(text: string, maxChars: number): string {
  if (text.length <= maxChars) return text;
  const notice = '\n\n[... truncated to fit tool limits ...]\n';
  return text.slice(0, maxChars - notice.length) + notice;
}

/** Format a character count for display. */
export function formatChars(chars: number): string {
  if (chars < 1024) return `${chars} chars`;
  if (chars < 1024 * 1024) return `${(chars / 1024).toFixed(1)}K chars`;
  return `${(chars / (1024 * 1024)).toFixed(1)}M chars`;
}
