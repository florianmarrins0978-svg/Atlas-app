#!/usr/bin/env node
import fs from 'fs';
import path from 'path';

function loadDotEnv() {
  const p = path.resolve(process.cwd(), '.env');
  if (!fs.existsSync(p)) return {};
  const raw = fs.readFileSync(p, 'utf8');
  const out = {};
  for (const line of raw.split(/\r?\n/)) {
    const m = line.match(/^\s*([^#=\s]+)=(.*)$/);
    if (m) out[m[1]] = m[2];
  }
  return out;
}

const env = loadDotEnv();
const appUrl = process.env.DATABASE_URL ?? env.DATABASE_URL;
if (!appUrl) {
  console.error('DATABASE_URL not set');
  process.exit(2);
}
console.log('Using app URL:', appUrl.replace(/:[^@]+@/, ':****@'));
process.env.DATABASE_URL = appUrl;

import('./db-inspect.mjs').catch((err) => { console.error(err); process.exit(1); });
