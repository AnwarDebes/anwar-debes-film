#!/bin/bash
# Runs Claude-Code-In-Motion's own test command from a fresh clone, on Linux (WSL2),
# where the account may create symlinks, and records the terminal exactly as printed.
set -u
D="${CCIM_CHECK_DIR:-$HOME/ccim-check}"
mkdir -p /tmp/ccimbin
printf '#!/bin/sh\nexec %s/nodelx/bin/node %s/nodelx/lib/node_modules/npm/bin/npm-cli.js "$@"\n' "$D" "$D" > /tmp/ccimbin/npm
ln -sf "$D/nodelx/bin/node" /tmp/ccimbin/node
chmod +x /tmp/ccimbin/npm
export PATH=/tmp/ccimbin:/usr/bin:/bin
export TERM=xterm-256color COLUMNS=110 LINES=60 NPM_CONFIG_UPDATE_NOTIFIER=false
cd "$D/ccim-fresh"
echo "commit: $(git log -1 --format='%H')"
echo "node: $(node --version)  npm: $(npm --version)  $(uname -sr)"
script -q -e -T /tmp/ccim-npm-test.timing -c 'npm test' /tmp/ccim-npm-test.typescript
code=$?
echo "EXIT=$code"
cp /tmp/ccim-npm-test.typescript "$D/ccim-npm-test.typescript"; cp /tmp/ccim-npm-test.timing "$D/ccim-npm-test.timing"
