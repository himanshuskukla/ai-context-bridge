#!/bin/bash
# Demo 2: Rate limit recovery — 10 seconds to switch tools
# Record with: asciinema rec demos/recordings/rate-limit.cast -c "bash demos/demo-rate-limit.sh"

set -e

type_cmd() {
  echo ""
  printf "\033[1;32m❯\033[0m "
  for ((i=0; i<${#1}; i++)); do
    printf "${1:$i:1}"
    sleep 0.04
  done
  echo ""
  sleep 0.3
}

DEMO_DIR=$(mktemp -d /tmp/auth-project-XXXX)
cd "$DEMO_DIR"
git init -q
mkdir -p src
echo "export function login() { /* TODO */ }" > src/auth.ts
echo "# Auth Project" > README.md
git add . && git commit -q -m "initial"
ctx init --quiet 2>&1

# Simulate some work + commit
echo "export function login(user: string, pass: string) { return jwt.sign({user}); }" > src/auth.ts
git add . && git commit -q -m "Add JWT auth login"

clear
echo ""
echo "  ⚡ Rate Limit Scenario"
echo "  You're coding in Claude Code... rate limit hits."
echo "  Your context is ALREADY saved. Watch:"
echo ""
sleep 3

echo "  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  ❌ Claude Code: Rate limit exceeded."
echo "  ❌ Session is dead. Can't run any commands."
echo "  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
sleep 3

echo ""
echo "  But ctx already auto-saved on your last commit."
echo "  Just open the resume prompt:"
echo ""
sleep 2

type_cmd "cat .ctx/resume-prompts/cursor.md"
cat .ctx/resume-prompts/cursor.md
sleep 3

echo ""
echo "  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  ✓ Copy. Paste into Cursor. Keep working."
echo "  ✓ Total time: ~10 seconds."
echo "  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
sleep 2

# Cleanup
rm -rf "$DEMO_DIR"
