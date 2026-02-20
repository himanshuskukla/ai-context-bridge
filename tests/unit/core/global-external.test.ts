import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as os from 'node:os';

let tmpGlobalDir: string;
let tmpProjectDir: string;

// Mock the global dir path and git
vi.mock('../../../src/core/git.js', () => ({
  isGitRepo: () => Promise.resolve(true),
  getBranch: () => Promise.resolve('main'),
  getGitRoot: () => Promise.resolve(tmpProjectDir),
}));

// We need to mock homedir to control the global dir
vi.mock('node:os', async () => {
  const actual = await vi.importActual('node:os') as any;
  return {
    ...actual,
    homedir: () => tmpGlobalDir,
  };
});

const { registerProject, readRegistry, getProjectCtxPath, listProjects } = await import('../../../src/core/global.js');

describe('global registry external support', () => {
  beforeEach(async () => {
    tmpGlobalDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ctx-global-ext-test-'));
    tmpProjectDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ctx-project-ext-test-'));
  });

  afterEach(async () => {
    await fs.rm(tmpGlobalDir, { recursive: true, force: true });
    await fs.rm(tmpProjectDir, { recursive: true, force: true });
  });

  it('registers a project with external storage', async () => {
    const externalPath = path.join(tmpGlobalDir, '.ctx-global', 'projects', 'test-project');
    await registerProject(tmpProjectDir, { external: true, ctxPath: externalPath });

    const registry = await readRegistry();
    expect(registry.projects).toHaveLength(1);
    expect(registry.projects[0].storage).toBe('external');
    expect(registry.projects[0].ctxPath).toBe(externalPath);
  });

  it('defaults to git storage without external flag', async () => {
    await registerProject(tmpProjectDir);

    const registry = await readRegistry();
    expect(registry.projects).toHaveLength(1);
    expect(registry.projects[0].storage).toBe('git');
    expect(registry.projects[0].ctxPath).toBeUndefined();
  });

  it('getProjectCtxPath returns ctxPath for external projects', async () => {
    const externalPath = path.join(tmpGlobalDir, '.ctx-global', 'projects', 'test-project');
    await registerProject(tmpProjectDir, { external: true, ctxPath: externalPath });

    const result = await getProjectCtxPath(tmpProjectDir);
    expect(result).toBe(externalPath);
  });

  it('getProjectCtxPath falls back to .ctx for internal projects', async () => {
    await registerProject(tmpProjectDir);

    const result = await getProjectCtxPath(tmpProjectDir);
    // Should end with .ctx since no .ctx/ dir exists (fallback)
    expect(result).toBe(path.join(path.resolve(tmpProjectDir), '.ctx'));
  });

  it('listProjects handles external projects with live sessions', async () => {
    const externalPath = path.join(tmpGlobalDir, '.ctx-global', 'projects', 'test-project');
    await fs.mkdir(path.join(externalPath, 'sessions'), { recursive: true });
    await fs.writeFile(
      path.join(externalPath, 'sessions', 'live.json'),
      JSON.stringify({ branch: 'feature-x', task: 'test task', timestamp: new Date().toISOString() }),
    );

    await registerProject(tmpProjectDir, { external: true, ctxPath: externalPath });

    const projects = await listProjects();
    expect(projects).toHaveLength(1);
    expect(projects[0].exists).toBe(true);
    expect(projects[0].hasLiveSession).toBe(true);
    expect(projects[0].branch).toBe('feature-x');
    expect(projects[0].task).toBe('test task');
  });

  it('re-registering updates storage mode', async () => {
    // First register as internal
    await registerProject(tmpProjectDir);
    let registry = await readRegistry();
    expect(registry.projects[0].storage).toBe('git');

    // Re-register as external
    const externalPath = path.join(tmpGlobalDir, 'external-ctx');
    await registerProject(tmpProjectDir, { external: true, ctxPath: externalPath });
    registry = await readRegistry();
    expect(registry.projects).toHaveLength(1);
    expect(registry.projects[0].storage).toBe('external');
    expect(registry.projects[0].ctxPath).toBe(externalPath);
  });
});
