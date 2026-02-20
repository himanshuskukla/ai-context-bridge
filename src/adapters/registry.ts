import type { ToolAdapter } from './types.js';
import { claudeAdapter } from './claude.js';
import { cursorAdapter } from './cursor.js';
import { codexAdapter } from './codex.js';
import { copilotAdapter } from './copilot.js';
import { windsurfAdapter } from './windsurf.js';
import { clineAdapter } from './cline.js';
import { aiderAdapter } from './aider.js';
import { continueAdapter } from './continue.js';
import { amazonqAdapter } from './amazonq.js';
import { zedAdapter } from './zed.js';
import { antigravityAdapter } from './antigravity.js';

const adapters: ToolAdapter[] = [
  claudeAdapter,
  cursorAdapter,
  codexAdapter,
  copilotAdapter,
  windsurfAdapter,
  clineAdapter,
  aiderAdapter,
  continueAdapter,
  amazonqAdapter,
  zedAdapter,
  antigravityAdapter,
];

const adapterMap = new Map<string, ToolAdapter>();
for (const adapter of adapters) {
  adapterMap.set(adapter.name, adapter);
}

// Also register common aliases
adapterMap.set('claude-code', claudeAdapter);
adapterMap.set('github-copilot', copilotAdapter);
adapterMap.set('amazon-q', amazonqAdapter);
adapterMap.set('openai-codex', codexAdapter);

/** Get an adapter by tool name. */
export function getAdapter(name: string): ToolAdapter | undefined {
  return adapterMap.get(name.toLowerCase());
}

/** Get all registered adapters. */
export function getAllAdapters(): ToolAdapter[] {
  return [...adapters];
}

/** Get all adapter names. */
export function getAdapterNames(): string[] {
  return adapters.map((a) => a.name);
}

/** Get budget map for all tools (for rules validation). */
export function getToolBudgets(): Record<string, number> {
  const budgets: Record<string, number> = {};
  for (const adapter of adapters) {
    budgets[adapter.name] = adapter.charBudget;
  }
  return budgets;
}
