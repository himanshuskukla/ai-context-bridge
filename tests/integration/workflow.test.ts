import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as os from 'node:os';

let tmpDir: string;
let ctxDir: string;

// Mock config module to use temp directory
vi.mock('../../src/core/config.js', async () => {
  const actual = await vi.importActual('../../src/core/config.js') as any;
  return {
    ...actual,
    getCtxDir: () => Promise.resolve(ctxDir),
    getProjectRoot: () => Promise.resolve(tmpDir),
    findCtxRoot: () => Promise.resolve(tmpDir),
  };
});

vi.mock('../../src/core/git.js', () => ({
  autoDetectContext: () => Promise.resolve({
    branch: 'feature/auth',
    diffSummary: '3 files changed, 89 insertions(+)',
    changedFiles: ['src/auth.ts', 'src/routes.ts', 'tests/auth.test.ts'],
    recentCommits: ['abc1234 Add JWT middleware'],
    headHash: 'abc1234',
  }),
  getBranch: () => Promise.resolve('feature/auth'),
  isGitRepo: () => Promise.resolve(true),
  getHeadHash: () => Promise.resolve('abc1234'),
}));

vi.mock('../../src/core/clipboard.js', () => ({
  copyToClipboard: () => Promise.resolve(true),
}));

const { initCtxDir } = await import('../../src/core/config.js');
const { createSession, getLatestSession } = await import('../../src/core/session.js');
const { addRule, readRules } = await import('../../src/core/rules.js');
const { getAdapter } = await import('../../src/adapters/registry.js');
const { compile } = await import('../../src/core/compiler.js');

describe('full save → switch workflow', () => {
  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ctx-integration-'));
    ctxDir = path.join(tmpDir, '.ctx');
    await initCtxDir(tmpDir);
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it('simulates the hero workflow: save → switch to cursor', async () => {
    // Step 1: Add rules
    await addRule('project', '# My Project\n\nNext.js + TypeScript API', 1);
    await addRule('code-style', '# Code Style\n\n- ESM imports\n- Strict TS', 2);

    const rules = await readRules();
    expect(rules).toHaveLength(2);

    // Step 2: Save session
    const session = await createSession({
      task: 'Implementing JWT auth with RS256',
      decisions: ['RS256 over HS256', 'httpOnly cookies for tokens'],
      nextSteps: ['Add refresh endpoint', 'Write integration tests'],
    });

    expect(session.branch).toBe('feature/auth');
    expect(session.filesChanged).toHaveLength(3);

    // Step 3: Resume in Cursor
    const cursorAdapter = getAdapter('cursor')!;
    const files = await cursorAdapter.generate({
      rules,
      session,
      projectRoot: tmpDir,
    });

    // Should have rule files + session file
    const mdcFiles = Object.keys(files).filter((f) => f.endsWith('.mdc'));
    const sessionFiles = Object.keys(files).filter((f) => f.includes('_session-resume'));
    expect(mdcFiles.length).toBeGreaterThanOrEqual(2);
    expect(sessionFiles).toHaveLength(1);

    // Session file should contain context
    const sessionContent = files[sessionFiles[0]];
    expect(sessionContent).toContain('JWT auth');

    // Step 4: Generate resume prompt
    const compiled = compile({
      session,
      rules,
      charBudget: cursorAdapter.charBudget,
      compress: false,
      toolName: 'cursor',
    });

    expect(compiled.resumePrompt).toContain('Continue the following task');
    expect(compiled.resumePrompt).toContain('RS256 over HS256');
    expect(compiled.resumePrompt).toContain('Add refresh endpoint');
    expect(compiled.rulesIncluded).toBe(2);
  });

  it('simulates switching from claude to codex', async () => {
    await addRule('project', '# API Project\n\nExpress + Prisma', 1);

    const session = await createSession({
      task: 'Building CRUD endpoints',
      tool: 'claude-code',
      nextSteps: ['Add pagination', 'Add error handling'],
    });

    const codexAdapter = getAdapter('codex')!;
    const files = await codexAdapter.generate({
      rules: await readRules(),
      session,
      projectRoot: tmpDir,
    });

    const agentsMd = Object.entries(files).find(([k]) => k.endsWith('AGENTS.md'));
    expect(agentsMd).toBeDefined();
    expect(agentsMd![1]).toContain('CRUD endpoints');
    expect(agentsMd![1].length).toBeLessThanOrEqual(codexAdapter.charBudget);
  });

  it('simulates sync across all tools', async () => {
    await addRule('project', '# Universal Project Rules', 1);
    const rules = await readRules();

    const adapters = ['claude', 'cursor', 'codex', 'copilot', 'windsurf', 'cline', 'antigravity'];
    let totalFiles = 0;

    for (const name of adapters) {
      const adapter = getAdapter(name)!;
      const files = await adapter.generate({ rules, session: null, projectRoot: tmpDir });
      totalFiles += Object.keys(files).length;

      for (const [, content] of Object.entries(files)) {
        expect(content.length).toBeGreaterThan(0);
      }
    }

    expect(totalFiles).toBeGreaterThan(7);
  });
});
