import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as os from 'node:os';

let tmpDir: string;
let ctxDir: string;

vi.mock('../../../src/core/config.js', async () => {
  const actual = await vi.importActual('../../../src/core/config.js') as any;
  return {
    ...actual,
    getCtxDir: () => Promise.resolve(ctxDir),
    getProjectRoot: () => Promise.resolve(tmpDir),
    readConfig: () => Promise.resolve({
      version: '0.2.0',
      enabledTools: ['claude', 'cursor', 'codex'],
      autoSave: true,
      autoDetect: true,
      sessionDefaults: { includeGitDiff: true, includeBranch: true, includeFiles: true },
    }),
  };
});

vi.mock('../../../src/core/git.js', () => ({
  autoDetectContext: () => Promise.resolve({
    branch: 'feature/auth',
    diffSummary: '3 files changed',
    changedFiles: ['src/auth.ts'],
    recentCommits: ['abc1234 Add auth'],
    headHash: 'abc1234',
  }),
  getBranch: () => Promise.resolve('feature/auth'),
  isGitRepo: () => Promise.resolve(true),
  getGitRoot: () => Promise.resolve(tmpDir),
}));

const { updateLiveSession, readLiveSession, preGenerateResumes, autoRefresh } = await import('../../../src/core/live.js');
const { initCtxDir } = await import('../../../src/core/config.js');

describe('live session', () => {
  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ctx-live-test-'));
    ctxDir = path.join(tmpDir, '.ctx');
    await initCtxDir(tmpDir);
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it('creates a live session with auto-detected context', async () => {
    const live = await updateLiveSession({ task: 'Building auth' });
    expect(live.id).toBe('live');
    expect(live.task).toBe('Building auth');
    expect(live.branch).toBe('feature/auth');
    expect(live.filesChanged).toEqual(['src/auth.ts']);
  });

  it('preserves task from previous live session', async () => {
    await updateLiveSession({ task: 'Original task' });
    // Second update without task should keep the original
    const live = await updateLiveSession();
    expect(live.task).toBe('Original task');
  });

  it('reads the live session from disk', async () => {
    await updateLiveSession({ task: 'Test read' });
    const live = await readLiveSession();
    expect(live).not.toBeNull();
    expect(live!.task).toBe('Test read');
  });

  it('returns null when no live session exists', async () => {
    const live = await readLiveSession();
    expect(live).toBeNull();
  });

  it('pre-generates resume prompts for enabled tools', async () => {
    await updateLiveSession({ task: 'Auth work' });

    // Add a rule file for the compiler to include
    await fs.mkdir(path.join(ctxDir, 'rules'), { recursive: true });
    await fs.writeFile(path.join(ctxDir, 'rules', '01-project.md'), '# Project\nNode.js API');

    const count = await preGenerateResumes();
    expect(count).toBe(3); // claude, cursor, codex

    // Check files exist
    const resumeDir = path.join(ctxDir, 'resume-prompts');
    const files = await fs.readdir(resumeDir);
    expect(files).toContain('claude.md');
    expect(files).toContain('cursor.md');
    expect(files).toContain('codex.md');
    expect(files).toContain('README.md');

    // Check content
    const claudeResume = await fs.readFile(path.join(resumeDir, 'claude.md'), 'utf-8');
    expect(claudeResume).toContain('Auth work');
    expect(claudeResume).toContain('READY-TO-PASTE');
  });

  it('autoRefresh updates live session and generates resumes', async () => {
    await fs.mkdir(path.join(ctxDir, 'rules'), { recursive: true });
    await fs.writeFile(path.join(ctxDir, 'rules', '01-project.md'), '# Test');

    const { session, resumeCount } = await autoRefresh({ task: 'Full refresh' });
    expect(session.task).toBe('Full refresh');
    expect(resumeCount).toBe(3);
  });
});
