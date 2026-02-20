# ai-context-bridge (`ctx`)

**Switch between AI coding tools without losing context.** Save your session in Claude Code, resume in Cursor — in under 3 seconds.

```bash
npm i -g ai-context-bridge
```

## The Problem

You're deep in a coding session with Claude Code. Rate limit hits. You need to switch to Cursor *right now* — but that means re-explaining everything from scratch. Your decisions, your progress, your context... gone.

45% of developers report spending more time debugging AI code than expected, largely due to context loss when switching tools.

## The Solution

```bash
# You're in Claude Code, rate limit hits...
ctx switch cursor

# That's it. Session saved, Cursor config generated, resume prompt copied.
# Paste into Cursor and keep working.
```

`ctx` captures what you're working on and compiles optimized resume prompts for any target tool — respecting each tool's format and size limits.

## Supported Tools (11)

| Tool | Config Format | Size Limit |
|------|--------------|------------|
| **Claude Code** | `CLAUDE.md` | ~100K chars |
| **Cursor** | `.cursor/rules/*.mdc` | ~2.5K/file |
| **OpenAI Codex** | `AGENTS.md` | 32 KiB |
| **GitHub Copilot** | `.github/copilot-instructions.md` | No limit |
| **Windsurf** | `.windsurf/rules/*.md` | 6K/file, 12K total |
| **Cline** | `.clinerules/*.md` | No limit |
| **Aider** | `CONVENTIONS.md` + `.aider.conf.yml` | No limit |
| **Continue** | `.continue/rules/*.md` | No limit |
| **Amazon Q** | `.amazonq/rules/*.md` | No limit |
| **Zed** | `.rules` | No limit |
| **Antigravity** | `AGENTS.md` + `.antigravity/*.md` | No limit |

## Quick Start

```bash
# 1. Initialize in your project
cd my-project
ctx init

# 2. Edit your project rules (shared across all tools)
# Edit .ctx/rules/01-project.md

# 3. Save a session snapshot
ctx save "implementing JWT auth with RS256"

# 4. Switch tools when you need to
ctx switch cursor      # or: codex, copilot, windsurf, cline, etc.

# 5. Sync rules to all tools at once
ctx sync
```

## Commands

| Command | Description |
|---------|-------------|
| `ctx init` | Initialize `.ctx/` in project, import existing configs |
| `ctx save [message]` | Capture current session (auto-detects git context) |
| `ctx resume --tool <name>` | Generate config + resume prompt for target tool |
| `ctx switch <tool> [msg]` | **Hero command**: save + resume in one step |
| `ctx sync` | Generate all tool config files from rules |
| `ctx status` | Show current session, branch, active rules |
| `ctx session list\|show\|delete` | Manage sessions |
| `ctx rules add\|list\|delete\|validate` | Manage rules files |
| `ctx tools list\|check` | Show supported tools, detect installed |

### Flags

- `--dry-run` — Preview changes without writing files
- `--verbose` — Detailed output
- `--quiet` / `-q` — Minimal output
- `--no-clipboard` — Don't copy resume prompt to clipboard

## How It Works

### The `.ctx/` Directory

```
.ctx/
  config.json              # Tool preferences, enabled tools
  rules/                   # Universal rules (git-tracked, shared)
    01-project.md          # Project overview, stack, conventions
    02-code-style.md       # Coding standards
  sessions/                # Session snapshots (gitignored, local-only)
    feature/auth/
      sess_2026-02-19T10-30-00_001.json
```

- **Rules** are shared across all tools and team members (git-tracked)
- **Sessions** are personal and ephemeral (gitignored)

### Token-Aware Compilation

Each tool has different size limits. `ctx` compiles your rules + session context to fit:

- Session context always has priority (never truncated)
- Rules are added in priority order until the tool's budget is exhausted
- Windsurf gets aggressive compression (6K/file, 12K total limit)

```bash
ctx rules validate    # See budget usage per tool
```

### Autonomous Context Detection

When you run `ctx save` or `ctx switch`, it automatically detects:

- Current git branch
- Changed files and diff summary
- Recent commit history
- HEAD hash

No manual input needed for basic session capture.

## Zero Dependencies

`ctx` has **zero production dependencies**. It uses only Node.js built-ins:

- `node:util` parseArgs for CLI
- `node:fs/promises` for file I/O
- `node:readline/promises` for interactive prompts
- `node:child_process` for git and clipboard

Fast startup. No native compilation. No bloat.

## Comparison

| Feature | ctx | ContextPilot | ai-rules-sync | SaveContext |
|---------|-----|-------------|---------------|------------|
| Session handoff | Core focus | Basic | No | Yes |
| Token-aware compilation | Yes | No | No | No |
| Zero dependencies | Yes | No | No | No |
| Quick-switch command | `ctx switch` | No | No | No |
| Rules sync | Yes | Yes | Yes | No |
| Git-branch sessions | Yes | No | N/A | No |
| Tools supported | 11 | 5 | 6 | 4 |

## Development

```bash
git clone https://github.com/himanshuskukla/ctxswitch
cd ctxswitch
npm install
npm run build
npm test
```

## License

MIT
