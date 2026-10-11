#!/usr/bin/env node
const { spawnSync } = require('child_process');

// Simple shim that accepts: bash -c "some command"
// It executes the command via cmd.exe on Windows, preserving exit code.
const args = process.argv.slice(2);
if (args.length >= 2 && args[0] === '-c') {
  const cmd = args.slice(1).join(' ');
  const r = spawnSync('cmd.exe', ['/c', cmd], { stdio: 'inherit' });
  process.exit(r.status ?? 1);
} else {
  // Fallback: run each arg as a command
  const r = spawnSync('cmd.exe', ['/c', args.join(' ')], { stdio: 'inherit' });
  process.exit(r.status ?? 1);
}
