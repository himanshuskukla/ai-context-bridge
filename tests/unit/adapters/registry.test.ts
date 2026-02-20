import { describe, it, expect } from 'vitest';
import { getAdapter, getAllAdapters, getAdapterNames, getToolBudgets } from '../../../src/adapters/registry.js';

describe('adapter registry', () => {
  it('has all 11 adapters registered', () => {
    const adapters = getAllAdapters();
    expect(adapters).toHaveLength(11);
  });

  it('has all expected tool names', () => {
    const names = getAdapterNames();
    expect(names).toEqual(
      expect.arrayContaining([
        'claude', 'cursor', 'codex', 'copilot', 'windsurf',
        'cline', 'aider', 'continue', 'amazonq', 'zed', 'antigravity',
      ])
    );
  });

  it('resolves adapters by name', () => {
    const claude = getAdapter('claude');
    expect(claude).toBeDefined();
    expect(claude!.displayName).toBe('Claude Code');

    const cursor = getAdapter('cursor');
    expect(cursor).toBeDefined();
    expect(cursor!.displayName).toBe('Cursor');

    const ag = getAdapter('antigravity');
    expect(ag).toBeDefined();
    expect(ag!.displayName).toBe('Antigravity (Google)');
  });

  it('resolves aliases', () => {
    expect(getAdapter('claude-code')?.name).toBe('claude');
    expect(getAdapter('github-copilot')?.name).toBe('copilot');
    expect(getAdapter('amazon-q')?.name).toBe('amazonq');
    expect(getAdapter('openai-codex')?.name).toBe('codex');
  });

  it('returns undefined for unknown tools', () => {
    expect(getAdapter('nonexistent')).toBeUndefined();
  });

  it('provides budget map', () => {
    const budgets = getToolBudgets();
    expect(budgets.claude).toBe(100_000);
    expect(budgets.codex).toBe(32_768);
    expect(budgets.windsurf).toBe(12_000);
    expect(budgets.antigravity).toBe(100_000);
  });

  it('each adapter has required interface fields', () => {
    for (const adapter of getAllAdapters()) {
      expect(adapter.name).toBeTruthy();
      expect(adapter.displayName).toBeTruthy();
      expect(adapter.charBudget).toBeGreaterThan(0);
      expect(typeof adapter.compress).toBe('boolean');
      expect(adapter.configPaths.length).toBeGreaterThan(0);
      expect(typeof adapter.generate).toBe('function');
      expect(typeof adapter.importExisting).toBe('function');
      expect(typeof adapter.detect).toBe('function');
    }
  });
});
