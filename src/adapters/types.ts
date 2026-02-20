import type { Session } from '../core/session.js';
import type { RuleFile } from '../core/rules.js';

export interface ToolAdapter {
  /** Tool identifier (e.g. 'claude', 'cursor'). */
  name: string;

  /** Display name (e.g. 'Claude Code', 'Cursor'). */
  displayName: string;

  /** Character budget for the tool's config file(s). */
  charBudget: number;

  /** Whether this tool uses aggressive compression. */
  compress: boolean;

  /** Config file paths this tool uses (relative to project root). */
  configPaths: string[];

  /** Generate tool-specific config files from rules + session. Returns map of path→content. */
  generate(opts: {
    rules: RuleFile[];
    session: Session | null;
    projectRoot: string;
  }): Promise<Record<string, string>>;

  /** Import existing tool config into universal rules. Returns imported rule content or null. */
  importExisting(projectRoot: string): Promise<string | null>;

  /** Check if this tool is installed / detectable. */
  detect(): Promise<boolean>;
}
