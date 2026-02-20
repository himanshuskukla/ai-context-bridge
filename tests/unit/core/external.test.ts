import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as os from 'node:os';
import { initExternalCtxDir, initCtxDir, findCtxRoot } from '../../../src/core/config.js';

describe('external storage mode', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ctx-external-test-'));
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  describe('initExternalCtxDir', () => {
    it('creates directory structure at ~/.ctx-global/projects/<name>/', async () => {
      // We'll create a fake project dir and init external
      const projectDir = path.join(tmpDir, 'my-project');
      await fs.mkdir(projectDir, { recursive: true });

      // Override homedir for test — initExternalCtxDir uses homedir() directly
      // So we test the structure it creates
      const ctxDir = await initExternalCtxDir(projectDir);

      // Verify the path contains the project name
      expect(ctxDir).toContain('my-project');

      // Verify directory structure
      const rulesDir = await fs.stat(path.join(ctxDir, 'rules'));
      expect(rulesDir.isDirectory()).toBe(true);

      const sessionsDir = await fs.stat(path.join(ctxDir, 'sessions'));
      expect(sessionsDir.isDirectory()).toBe(true);

      const resumePromptsDir = await fs.stat(path.join(ctxDir, 'resume-prompts'));
      expect(resumePromptsDir.isDirectory()).toBe(true);

      // Verify config.json was created
      const configFile = await fs.readFile(path.join(ctxDir, 'config.json'), 'utf-8');
      const config = JSON.parse(configFile);
      expect(config.version).toBe('0.1.0');
      expect(config.enabledTools).toContain('claude');
    });

    it('does not create .gitignore (not needed outside project)', async () => {
      const projectDir = path.join(tmpDir, 'my-project');
      await fs.mkdir(projectDir, { recursive: true });

      const ctxDir = await initExternalCtxDir(projectDir);

      // .gitignore should NOT exist in external mode
      await expect(fs.access(path.join(ctxDir, '.gitignore'))).rejects.toThrow();
    });

    it('does not create anything inside the project directory', async () => {
      const projectDir = path.join(tmpDir, 'my-project');
      await fs.mkdir(projectDir, { recursive: true });

      await initExternalCtxDir(projectDir);

      // The project dir should be empty (no .ctx/ inside)
      const entries = await fs.readdir(projectDir);
      expect(entries).toHaveLength(0);
    });

    it('does not overwrite existing config', async () => {
      const projectDir = path.join(tmpDir, 'my-project');
      await fs.mkdir(projectDir, { recursive: true });

      const ctxDir = await initExternalCtxDir(projectDir);

      // Modify config
      const configPath = path.join(ctxDir, 'config.json');
      await fs.writeFile(configPath, JSON.stringify({ version: '0.1.0', custom: true }, null, 2));

      // Re-init
      await initExternalCtxDir(projectDir);
      const config = JSON.parse(await fs.readFile(configPath, 'utf-8'));
      expect(config.custom).toBe(true);
    });
  });

  describe('findCtxRoot does NOT find external projects', () => {
    it('returns null for a directory with no .ctx/', async () => {
      const projectDir = path.join(tmpDir, 'my-project');
      await fs.mkdir(projectDir, { recursive: true });

      // Even after external init, findCtxRoot should return null
      await initExternalCtxDir(projectDir);
      const root = await findCtxRoot(projectDir);
      expect(root).toBeNull();
    });
  });

  describe('internal mode still works', () => {
    it('creates .ctx inside the project', async () => {
      const ctxDir = await initCtxDir(tmpDir);
      expect(ctxDir).toBe(path.join(tmpDir, '.ctx'));

      const root = await findCtxRoot(tmpDir);
      expect(root).toBe(tmpDir);
    });
  });
});
