#!/bin/bash
# Demo 3: ctx switch — Save + switch in one command
# Record with: asciinema rec demos/recordings/switch.cast -c "bash demos/demo-switch.sh"

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

DEMO_DIR=$(mktemp -d /tmp/dashboard-XXXX)
cd "$DEMO_DIR"
git init -q
mkdir -p src/components
echo "export default function Dashboard() { return <div>Dashboard</div> }" > src/components/Dashboard.tsx
echo "# Dashboard App" > README.md
git add . && git commit -q -m "initial"
ctx init --quiet 2>&1

# Simulate work
echo "export default function Dashboard() { return <div><Chart data={metrics} /><Table rows={users} /></div> }" > src/components/Dashboard.tsx
git add . && git commit -q -m "Add dashboard with charts and user table"

clear
echo ""
echo "  🔄 ctx switch — One command to switch tools"
echo ""
sleep 2

type_cmd "ctx save 'Building dashboard with charts and user table'"
ctx save "Building dashboard with charts and user table" --no-clipboard 2>&1
sleep 2

type_cmd "ctx switch cursor"
ctx switch cursor --no-clipboard 2>&1
sleep 3

echo ""
type_cmd "ctx projects list"
ctx projects list 2>&1
sleep 3

echo ""
echo "  ✓ Session saved. Cursor config generated."
echo "  ✓ Resume prompt copied to clipboard."
echo "  ✓ Open Cursor and paste. That's it."
echo ""
sleep 2

# Cleanup
rm -rf "$DEMO_DIR"
