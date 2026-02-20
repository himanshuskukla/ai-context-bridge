# ai-context-bridge (`ctx`)

**Switch between AI coding tools without losing context.** Autonomous, always-ready context that survives rate limits.

```bash
npm i -g ai-context-bridge
```

## The Problem

You're deep in a coding session with Claude Code. Rate limit hits. You **can't even run a save command** — the session is dead. Switch to Cursor? You'd have to re-explain everything from scratch.

Working on multiple projects side by side? Every tool has its own config format. Context doesn't transfer. 45% of developers spend more time debugging AI code than expected, largely due to context loss.

## The Solution

```bash
ctx init   # One-time setup: installs git hooks, pre-generates everything
```

**That's it.** From now on, your context is **always ready**:

- Git hooks auto-save on every commit, checkout, and merge
- Resume prompts for all 11 tools sit ready at `.ctx/resume-prompts/<tool>.md`
- When a rate limit hits, just open the file and paste into your next tool

For manual switching:
```bash
ctx switch cursor    # Saves session + generates Cursor config + copies resume prompt
```

## How It Stays Autonomous

| Trigger | What Happens | You Do Nothing |
|---------|-------------|----------------|
| `git commit` | Auto-saves context, refreshes all resume prompts | Yes |
| `git checkout` | Updates branch context, refreshes prompts | Yes |
| `git merge` | Updates context with merge state | Yes |
| `ctx watch` | Background watcher refreshes every 30s + on file changes | Yes |
| Rate limit hits | Resume prompts already in `.ctx/resume-prompts/` | Just open & paste |

### The Rate Limit Scenario (Solved)

**Before ctx**: Rate limit hits → session dead → open Cursor → re-explain everything → 15 min wasted

**With ctx**: Rate limit hits → open `.ctx/resume-prompts/cursor.md` → paste into Cursor → keep working in 10 seconds

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
| **Antigravity (Google)** | `AGENTS.md` + `.antigravity/*.md` | No limit |

## Quick Start

```bash
# 1. Initialize (auto-installs hooks, registers project, pre-generates everything)
cd my-project
ctx init

# 2. Edit your project rules (shared across all tools)
# Edit .ctx/rules/01-project.md

# 3. (Optional) Start background watcher for continuous updates
ctx watch

# 4. Work normally. Context auto-saves on every commit.

# 5. When rate limit hits, your resume prompts are already ready:
#    .ctx/resume-prompts/cursor.md
#    .ctx/resume-prompts/codex.md
#    ...

# 6. Or manually switch:
ctx switch cursor
```

## Multi-Project Support

Working on multiple projects? `ctx` tracks them all:

```bash
# Each project gets its own .ctx/ (auto-registered on init)
cd ~/project-a && ctx init
cd ~/project-b && ctx init

# See all your projects in one place
ctx projects list
```

Output:
```
Projects (2)
  project-a [feature/auth] (live)
    ~/project-a (git) — Implementing JWT auth
    Last active: 5m ago

  project-b [main] (live)
    ~/project-b (git) — Building dashboard
    Last active: 2h ago

  2 project(s) with live context ready.
```

## Commands

| Command | Description |
|---------|-------------|
| `ctx init` | Initialize + hooks + global registry + pre-generate |
| `ctx save [message]` | Manual session snapshot |
| `ctx resume --tool <name>` | Generate config + resume prompt for target tool |
| `ctx switch <tool> [msg]` | Save + resume in one step |
| `ctx sync` | Generate configs for all enabled tools |
| `ctx status` | Full status with autonomous feature info |
| `ctx watch` | Background watcher (continuous auto-save) |
| `ctx hooks install\|uninstall\|status` | Manage git hooks |
| `ctx projects list\|remove` | Multi-project dashboard |
| `ctx session list\|show\|delete` | Manage sessions |
| `ctx rules add\|list\|delete\|validate` | Manage rules |
| `ctx tools list\|check` | Show/detect supported tools |

### Flags

- `--dry-run` — Preview changes without writing
- `--verbose` — Detailed output
- `--quiet` / `-q` — Minimal output
- `--no-clipboard` — Don't copy resume prompt
- `--no-hooks` — Skip git hook installation on init

## How It Works

### The `.ctx/` Directory

```
.ctx/
  config.json              # Tool preferences, enabled tools
  rules/                   # Universal rules (git-tracked, shared)
    01-project.md
    02-code-style.md
  sessions/                # Session snapshots (gitignored)
    live.json              # Always-current live session
    main/
      sess_2026-02-19T10-30-00_001.json
  resume-prompts/          # Pre-generated, always ready (gitignored)
    claude.md
    cursor.md
    codex.md
    ...
```

- **Rules** → git-tracked, shared with team
- **Sessions + resume prompts** → gitignored, personal/ephemeral
- **No git?** Works fine as local directory mode — just no auto-hooks

### Storage Options

| Mode | How | Auto-Save |
|------|-----|-----------|
| **Git** (default) | Git hooks + watcher | On commit/checkout/merge |
| **Local** | No git, just `.ctx/` dir | `ctx watch` or manual `ctx save` |

Install via `npm i -g ai-context-bridge`. No forking needed. Your `.ctx/` data stays local in each project.

### Token-Aware Compilation

Each tool has different size limits. `ctx` compiles your rules + session to fit:

- Session context has priority (never truncated)
- Rules added in priority order until budget exhausted
- Windsurf gets aggressive compression (6K/file, 12K total)

## Zero Dependencies

Zero production dependencies. Only Node.js built-ins:
- `node:util`, `node:fs`, `node:readline`, `node:child_process`, `node:os`

Fast startup. No native compilation. No bloat.

## Comparison

| Feature | ctx | ContextPilot | ai-rules-sync | SaveContext |
|---------|-----|-------------|---------------|------------|
| Autonomous auto-save | Yes (hooks + watcher) | No | No | No |
| Survives rate limits | Yes (pre-generated) | No | No | No |
| Multi-project dashboard | Yes | No | No | No |
| Token-aware compilation | Yes | No | No | No |
| Zero dependencies | Yes | No | No | No |
| Quick-switch command | `ctx switch` | No | No | No |
| Rules sync | Yes | Yes | Yes | No |
| Tools supported | 11 | 5 | 6 | 4 |
| Works without git | Yes | No | N/A | No |

## Development

```bash
git clone https://github.com/himanshuskukla/ctxswitch
cd ctxswitch
npm install
npm run build
npm test          # 103 tests
```

## License

MIT
