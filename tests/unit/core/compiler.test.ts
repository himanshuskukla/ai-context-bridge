import { describe, it, expect } from 'vitest';
import { compile } from '../../../src/core/compiler.js';
import type { Session } from '../../../src/core/session.js';
import type { RuleFile } from '../../../src/core/rules.js';

const mockSession: Session = {
  id: 'sess_2026-02-19T10-30-00',
  branch: 'feature/auth',
  timestamp: '2026-02-19T10:30:00Z',
  tool: 'claude-code',
  task: 'Implementing JWT auth middleware',
  decisions: ['RS256 over HS256 for key rotation'],
  nextSteps: ['Add token refresh endpoint', 'Write integration tests'],
  filesChanged: ['src/middleware/auth.ts', 'src/routes/login.ts'],
  diffSummary: '4 files changed, 127 insertions(+)',
  recentCommits: ['abc1234 Add auth endpoint', 'def5678 Set up JWT config'],
  headHash: 'abc1234',
};

const mockRules: RuleFile[] = [
  {
    name: 'project',
    path: '/tmp/rules/01-project.md',
    content: '# Project\n\nThis is a Node.js API with Express and TypeScript.',
    priority: 1,
    chars: 60,
  },
  {
    name: 'code-style',
    path: '/tmp/rules/02-code-style.md',
    content: '# Code Style\n\n- Use ESM imports\n- Strict TypeScript\n- Prefer async/await',
    priority: 2,
    chars: 75,
  },
];

describe('compiler', () => {
  it('compiles session and rules into output', () => {
    const result = compile({
      session: mockSession,
      rules: mockRules,
      charBudget: 100_000,
      toolName: 'claude',
    });

    expect(result.content).toContain('JWT auth middleware');
    expect(result.content).toContain('RS256 over HS256');
    expect(result.content).toContain('Node.js API');
    expect(result.content).toContain('Code Style');
    expect(result.rulesIncluded).toBe(2);
    expect(result.rulesTruncated).toBe(0);
    expect(result.chars).toBeGreaterThan(0);
  });

  it('generates a resume prompt', () => {
    const result = compile({
      session: mockSession,
      rules: [],
      charBudget: 100_000,
      toolName: 'claude',
    });

    expect(result.resumePrompt).toContain('Continue the following task');
    expect(result.resumePrompt).toContain('JWT auth middleware');
    expect(result.resumePrompt).toContain('RS256 over HS256');
    expect(result.resumePrompt).toContain('Add token refresh endpoint');
    expect(result.resumePrompt).toContain('feature/auth');
  });

  it('respects character budget — truncates rules', () => {
    const largeRule: RuleFile = {
      name: 'large',
      path: '/tmp/rules/03-large.md',
      content: 'x'.repeat(500),
      priority: 3,
      chars: 500,
    };

    const result = compile({
      session: null,
      rules: [mockRules[0], largeRule],
      charBudget: 200, // Very tight budget
      toolName: 'windsurf',
    });

    // Should include first rule (or partial) but not all of large rule
    expect(result.chars).toBeLessThanOrEqual(200);
  });

  it('never truncates session content', () => {
    const result = compile({
      session: mockSession,
      rules: mockRules,
      charBudget: 300, // Tight but session should still be there
      toolName: 'windsurf',
    });

    // Session content should always be present
    expect(result.content).toContain('JWT auth middleware');
  });

  it('compresses when requested', () => {
    const result = compile({
      session: null,
      rules: mockRules,
      charBudget: 100_000,
      compress: true,
      toolName: 'windsurf',
    });

    // Compressed output should still have content
    expect(result.content.length).toBeGreaterThan(0);
    expect(result.rulesIncluded).toBe(2);
  });

  it('handles null session gracefully', () => {
    const result = compile({
      session: null,
      rules: mockRules,
      charBudget: 100_000,
      toolName: 'claude',
    });

    expect(result.resumePrompt).toBe('');
    expect(result.content).toContain('Project');
    expect(result.rulesIncluded).toBe(2);
  });

  it('handles empty rules gracefully', () => {
    const result = compile({
      session: mockSession,
      rules: [],
      charBudget: 100_000,
      toolName: 'claude',
    });

    expect(result.rulesIncluded).toBe(0);
    expect(result.content).toContain('JWT auth middleware');
  });
});
