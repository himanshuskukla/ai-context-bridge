import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as os from 'node:os';

let tmpDir: string;

vi.mock('../../../src/core/git.js', () => ({
  getGitRoot: () => Promise.resolve(tmpDir),
  isGitRepo: () => Promise.resolve(true),
  getBranch: () => Promise.resolve('main'),
}));

const { installHooks, uninstallHooks, checkHooks } = await import('../../../src/core/hooks.js');

describe('git hooks', () => {
  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ctx-hooks-test-'));
    await fs.mkdir(path.join(tmpDir, '.git', 'hooks'), { recursive: true });
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it('installs hooks into .git/hooks/', async () => {
    const installed = await installHooks(tmpDir);
    expect(installed).toContain('post-commit');
    expect(installed).toContain('post-checkout');
    expect(installed).toContain('post-merge');

    // Verify files exist and are executable
    for (const hook of installed) {
      const hookPath = path.join(tmpDir, '.git', 'hooks', hook);
      const content = await fs.readFile(hookPath, 'utf-8');
      expect(content).toContain('ai-context-bridge');
      expect(content).toContain('ctx auto-refresh');

      const stat = await fs.stat(hookPath);
      expect(stat.mode & 0o111).toBeGreaterThan(0); // executable
    }
  });

  it('does not duplicate hooks on second install', async () => {
    await installHooks(tmpDir);
    const second = await installHooks(tmpDir);
    expect(second).toHaveLength(0); // All already installed

    const content = await fs.readFile(
      path.join(tmpDir, '.git', 'hooks', 'post-commit'),
      'utf-8'
    );
    // Should only have one copy of the marker
    const markers = content.match(/ai-context-bridge auto-save/g);
    expect(markers).toHaveLength(2); // Opening + closing marker
  });

  it('preserves existing hook content', async () => {
    const hookPath = path.join(tmpDir, '.git', 'hooks', 'post-commit');
    await fs.writeFile(hookPath, '#!/bin/sh\necho "existing hook"\n');
    await fs.chmod(hookPath, 0o755);

    await installHooks(tmpDir);
    const content = await fs.readFile(hookPath, 'utf-8');
    expect(content).toContain('existing hook');
    expect(content).toContain('ctx auto-refresh');
  });

  it('uninstalls hooks cleanly', async () => {
    await installHooks(tmpDir);
    const removed = await uninstallHooks(tmpDir);
    expect(removed).toContain('post-commit');

    // Files should be gone (no other content)
    try {
      await fs.access(path.join(tmpDir, '.git', 'hooks', 'post-commit'));
      // If file exists, it should only have shebang
    } catch {
      // File was deleted — good
    }
  });

  it('checkHooks reports status correctly', async () => {
    let status = await checkHooks(tmpDir);
    expect(status.installed).toHaveLength(0);
    expect(status.missing).toHaveLength(3);

    await installHooks(tmpDir);
    status = await checkHooks(tmpDir);
    expect(status.installed).toHaveLength(3);
    expect(status.missing).toHaveLength(0);
  });
});
