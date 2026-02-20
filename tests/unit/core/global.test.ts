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

const { registerProject, listProjects, unregisterProject, readRegistry } = await import('../../../src/core/global.js');

describe('global project registry', () => {
  beforeEach(async () => {
    tmpGlobalDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ctx-global-test-'));
    tmpProjectDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ctx-project-test-'));
  });

  afterEach(async () => {
    await fs.rm(tmpGlobalDir, { recursive: true, force: true });
    await fs.rm(tmpProjectDir, { recursive: true, force: true });
  });

  it('registers a project', async () => {
    await registerProject(tmpProjectDir);
    const registry = await readRegistry();
    expect(registry.projects).toHaveLength(1);
    expect(registry.projects[0].path).toBe(path.resolve(tmpProjectDir));
    expect(registry.projects[0].storage).toBe('git');
  });

  it('does not duplicate on re-register', async () => {
    await registerProject(tmpProjectDir);
    await registerProject(tmpProjectDir);
    const registry = await readRegistry();
    expect(registry.projects).toHaveLength(1);
  });

  it('lists projects', async () => {
    await registerProject(tmpProjectDir);
    const projects = await listProjects();
    expect(projects).toHaveLength(1);
    expect(projects[0].exists).toBe(true);
  });

  it('unregisters a project', async () => {
    await registerProject(tmpProjectDir);
    const removed = await unregisterProject(tmpProjectDir);
    expect(removed).toBe(true);
    const registry = await readRegistry();
    expect(registry.projects).toHaveLength(0);
  });

  it('handles multiple projects', async () => {
    const proj2 = await fs.mkdtemp(path.join(os.tmpdir(), 'ctx-proj2-'));
    try {
      await registerProject(tmpProjectDir);
      await registerProject(proj2);
      const registry = await readRegistry();
      expect(registry.projects).toHaveLength(2);
    } finally {
      await fs.rm(proj2, { recursive: true, force: true });
    }
  });
});
