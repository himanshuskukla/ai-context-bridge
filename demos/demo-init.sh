#!/bin/bash
# Demo 1: ctx init — One command, everything set up
# Record with: asciinema rec demos/recordings/init.cast -c "bash demos/demo-init.sh"

set -e

# Typing simulation
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

DEMO_DIR=$(mktemp -d /tmp/my-project-XXXX)
cd "$DEMO_DIR"
git init -q
echo "# My Project" > README.md
git add . && git commit -q -m "initial"

clear
echo ""
echo "  Welcome to ai-context-bridge (ctx)"
echo "  One command. Context for 11 AI tools. Always ready."
echo ""
sleep 2

type_cmd "cd my-project"
sleep 0.5

type_cmd "ctx init"
ctx init 2>&1
sleep 2

type_cmd "ls .ctx/resume-prompts/"
ls .ctx/resume-prompts/
sleep 2

type_cmd "head -5 .ctx/resume-prompts/cursor.md"
head -5 .ctx/resume-prompts/cursor.md
sleep 2

type_cmd "ctx status"
ctx status 2>&1
sleep 3

echo ""
echo "  ✓ Done. Context auto-saves on every commit."
echo "  ✓ Resume prompts ready for all 11 tools."
echo ""
sleep 2

# Cleanup
rm -rf "$DEMO_DIR"
