# Contributing to ai-context-bridge

## Adding a New Tool Adapter

Each AI coding tool has an adapter in `src/adapters/`. To add support for a new tool:

### 1. Create the adapter file

Create `src/adapters/yourtool.ts` implementing the `ToolAdapter` interface:

```typescript
import type { ToolAdapter } from './types.js';
import { compile } from '../core/compiler.js';

export const yourtoolAdapter: ToolAdapter = {
  name: 'yourtool',
  displayName: 'Your Tool',
  charBudget: 100_000,    // Max chars the tool accepts
  compress: false,         // true if tool has tight limits
  configPaths: ['.yourtool/rules/'],

  async generate({ rules, session, projectRoot }) {
    // Generate the tool's native config format
    // Return a map of filePath → content
  },

  async importExisting(projectRoot) {
    // Read existing tool config and return as universal markdown
    // Return null if no config found
  },

  async detect() {
    // Return true if the tool is installed
  },
};
```

### 2. Register the adapter

Add it to `src/adapters/registry.ts`:

```typescript
import { yourtoolAdapter } from './yourtool.js';

// Add to the adapters array
const adapters: ToolAdapter[] = [
  // ...existing adapters
  yourtoolAdapter,
];
```

### 3. Add to default config

Add the tool name to `enabledTools` in `src/core/config.ts`.

### 4. Write tests

Add tests in `tests/unit/adapters/` — the existing `adapters.test.ts` will automatically test basic generation for all registered adapters.

### 5. Update README

Add the tool to the supported tools table in `README.md`.

## Development

```bash
npm install       # Install dev dependencies
npm run build     # Build with tsup
npm test          # Run vitest
npm run dev       # Watch mode build
```

## Key Design Principles

- **Zero prod dependencies** — Only use Node.js built-ins
- **Session-first** — Session context is never truncated
- **Tool-native formats** — Each adapter outputs the tool's native format
- **Character budgets** — Tool limits are in chars, not tokens
- **Git-aware** — Sessions are organized by branch

## Project Structure

```
src/
  index.ts                  # CLI entry point
  cli/commands/             # One file per CLI command
  adapters/                 # One file per tool + registry + types
  core/                     # Config, session, rules, compiler, git, clipboard
  utils/                    # Chars, markdown, logger, prompt helpers
tests/
  unit/adapters/            # Adapter tests
  unit/core/                # Core module tests
  integration/              # End-to-end workflow tests
```
