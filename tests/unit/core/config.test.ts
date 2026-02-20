import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as os from 'node:os';
import { initCtxDir, findCtxRoot, readConfig, writeConfig, getDefaultConfig } from '../../../src/core/config.js';

describe('config', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ctx-test-'));
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  describe('initCtxDir', () => {
    it('creates .ctx directory structure', async () => {
      const ctxDir = await initCtxDir(tmpDir);
      expect(ctxDir).toBe(path.join(tmpDir, '.ctx'));

      const stat = await fs.stat(ctxDir);
      expect(stat.isDirectory()).toBe(true);

      const rulesDir = await fs.stat(path.join(ctxDir, 'rules'));
      expect(rulesDir.isDirectory()).toBe(true);

      const sessionsDir = await fs.stat(path.join(ctxDir, 'sessions'));
      expect(sessionsDir.isDirectory()).toBe(true);

      const configFile = await fs.readFile(path.join(ctxDir, 'config.json'), 'utf-8');
      const config = JSON.parse(configFile);
      expect(config.version).toBe('0.1.0');
      expect(config.enabledTools).toContain('claude');
      expect(config.enabledTools).toContain('antigravity');
    });

    it('creates .gitignore for sessions', async () => {
      await initCtxDir(tmpDir);
      const gitignore = await fs.readFile(path.join(tmpDir, '.ctx', '.gitignore'), 'utf-8');
      expect(gitignore).toContain('sessions/');
    });

    it('does not overwrite existing config', async () => {
      await initCtxDir(tmpDir);
      // Modify config
      const configPath = path.join(tmpDir, '.ctx', 'config.json');
      await fs.writeFile(configPath, JSON.stringify({ version: '0.1.0', custom: true }, null, 2));
      // Re-init
      await initCtxDir(tmpDir);
      const config = JSON.parse(await fs.readFile(configPath, 'utf-8'));
      expect(config.custom).toBe(true);
    });
  });

  describe('findCtxRoot', () => {
    it('finds .ctx in the given directory', async () => {
      await initCtxDir(tmpDir);
      const root = await findCtxRoot(tmpDir);
      expect(root).toBe(tmpDir);
    });

    it('finds .ctx in parent directory', async () => {
      await initCtxDir(tmpDir);
      const subDir = path.join(tmpDir, 'src', 'lib');
      await fs.mkdir(subDir, { recursive: true });
      const root = await findCtxRoot(subDir);
      expect(root).toBe(tmpDir);
    });

    it('returns null when no .ctx found', async () => {
      const root = await findCtxRoot(tmpDir);
      expect(root).toBeNull();
    });
  });

  describe('getDefaultConfig', () => {
    it('returns config with all 11 tools', () => {
      const config = getDefaultConfig();
      expect(config.enabledTools).toHaveLength(11);
      expect(config.enabledTools).toContain('claude');
      expect(config.enabledTools).toContain('cursor');
      expect(config.enabledTools).toContain('codex');
      expect(config.enabledTools).toContain('copilot');
      expect(config.enabledTools).toContain('windsurf');
      expect(config.enabledTools).toContain('cline');
      expect(config.enabledTools).toContain('aider');
      expect(config.enabledTools).toContain('continue');
      expect(config.enabledTools).toContain('amazonq');
      expect(config.enabledTools).toContain('zed');
      expect(config.enabledTools).toContain('antigravity');
    });
  });
});
