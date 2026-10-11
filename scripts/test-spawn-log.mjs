import { openSync, readFileSync } from 'fs';
import { tmpdir } from 'os';
import path from 'path';
import { spawn } from 'child_process';

const JOURNAL_SERVEUR = path.join(tmpdir(), 'atlas-serveur-e2e.log');
const journalFd = openSync(JOURNAL_SERVEUR, 'w');
const NODE = process.execPath;

console.log('Journal path:', JOURNAL_SERVEUR);

const child = spawn(NODE, ['-e', "console.log('child stdout'); console.error('child stderr');"], {
  stdio: ['ignore', journalFd, journalFd],
  detached: false,
});

child.on('exit', (code, signal) => {
  try {
    const content = readFileSync(JOURNAL_SERVEUR, 'utf8');
    console.log('--- journal file content start ---');
    console.log(content);
    console.log('--- journal file content end ---');
  } catch (err) {
    console.error('Failed to read journal file', err);
  }
});
