import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as os from 'node:os';
import { initCtxDir } from '../../../src/core/config.js';

// We need to mock getCtxDir to point to our temp dir
let tmpDir: string;
let ctxDir: string;

vi.mock('../../../src/core/config.js', async () => {
  const actual = await vi.importActual('../../../src/core/config.js') as any;
  return {
    ...actual,
    getCtxDir: () => Promise.resolve(ctxDir),
    getProjectRoot: () => Promise.resolve(tmpDir),
  };
});

vi.mock('../../../src/core/git.js', () => ({
  autoDetectContext: () => Promise.resolve({
    branch: 'main',
    diffSummary: '2 files changed, 42 insertions(+)',
    changedFiles: ['src/auth.ts', 'src/middleware.ts'],
    recentCommits: ['abc1234 Add auth endpoint'],
    headHash: 'abc1234',
  }),
  getBranch: () => Promise.resolve('main'),
  isGitRepo: () => Promise.resolve(true),
}));

const { createSession, getLatestSession, listSessions, getSession, deleteSession } = await import('../../../src/core/session.js');
const { initCtxDir: actualInit } = await import('../../../src/core/config.js');

describe('session', () => {
  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ctx-session-test-'));
    ctxDir = path.join(tmpDir, '.ctx');
    await actualInit(tmpDir);
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it('creates a session with auto-detected context', async () => {
    const session = await createSession({ task: 'Implementing JWT auth' });

    expect(session.id).toMatch(/^sess_/);
    expect(session.task).toBe('Implementing JWT auth');
    expect(session.branch).toBe('main');
    expect(session.filesChanged).toEqual(['src/auth.ts', 'src/middleware.ts']);
    expect(session.diffSummary).toBe('2 files changed, 42 insertions(+)');
    expect(session.headHash).toBe('abc1234');
  });

  it('persists session to disk', async () => {
    const session = await createSession({ task: 'Test persistence' });

    // Check file exists
    const sessionDir = path.join(ctxDir, 'sessions', 'main');
    const files = await fs.readdir(sessionDir);
    expect(files).toHaveLength(1);
    expect(files[0]).toMatch(/\.json$/);

    const raw = await fs.readFile(path.join(sessionDir, files[0]), 'utf-8');
    const saved = JSON.parse(raw);
    expect(saved.id).toBe(session.id);
    expect(saved.task).toBe('Test persistence');
  });

  it('retrieves the latest session', async () => {
    await createSession({ task: 'First session' });
    // Small delay to ensure different timestamps
    await new Promise((r) => setTimeout(r, 10));
    await createSession({ task: 'Second session' });

    const latest = await getLatestSession('main');
    expect(latest).not.toBeNull();
    expect(latest!.task).toBe('Second session');
  });

  it('lists all sessions', async () => {
    await createSession({ task: 'Session A' });
    await createSession({ task: 'Session B' });
    await createSession({ task: 'Session C' });

    const sessions = await listSessions();
    expect(sessions).toHaveLength(3);
    // Sorted newest first
    expect(sessions[0].task).toBe('Session C');
  });

  it('gets a specific session by ID', async () => {
    const session = await createSession({ task: 'Find me' });
    const found = await getSession(session.id);
    expect(found).not.toBeNull();
    expect(found!.task).toBe('Find me');
  });

  it('deletes a session', async () => {
    const session = await createSession({ task: 'Delete me' });
    const deleted = await deleteSession(session.id);
    expect(deleted).toBe(true);

    const found = await getSession(session.id);
    expect(found).toBeNull();
  });

  it('returns null for non-existent session', async () => {
    const found = await getSession('sess_nonexistent');
    expect(found).toBeNull();
  });

  it('stores decisions and next steps', async () => {
    const session = await createSession({
      task: 'Auth implementation',
      decisions: ['Use RS256', 'Store tokens in httpOnly cookies'],
      nextSteps: ['Add refresh endpoint', 'Write tests'],
    });

    expect(session.decisions).toEqual(['Use RS256', 'Store tokens in httpOnly cookies']);
    expect(session.nextSteps).toEqual(['Add refresh endpoint', 'Write tests']);
  });
});
