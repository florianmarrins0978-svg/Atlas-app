#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { Client } from 'pg';

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
const admin = process.env.DATABASE_ADMIN_URL ?? env.DATABASE_ADMIN_URL;
if (!admin) {
  console.error('DATABASE_ADMIN_URL not set');
  process.exit(2);
}
console.log('Using admin URL:', admin.replace(/:[^@]+@/, ':****@'));

const chantierIds = [
  '3a5686f4-58ef-431c-80a3-541c68d9881e',
  'e5488be9-8f33-44ad-b9f5-de1b2114d4be'
];

async function main() {
  const client = new Client({ connectionString: admin });
  await client.connect();
  try {
    for (const id of chantierIds) {
      console.log('\n=== Inspecting chantier', id, '===');
      const ch = await client.query('SELECT id, entreprise_id, nom, created_at FROM chantiers WHERE id=$1', [id]);
      if (ch.rowCount === 0) {
        console.log('CHANTIER EXISTS: false');
        continue;
      }
      console.log('CHANTIER:', ch.rows[0]);
      const factures = await client.query('SELECT id, numero, montant, statut, created_at FROM factures WHERE chantier_id=$1 ORDER BY created_at DESC', [id]);
      console.log('FACTURES_COUNT', factures.rowCount);
      if (factures.rowCount > 0) console.log('FACTURES:', factures.rows);
      const factureIds = factures.rows.map(r => r.id);
      if (factureIds.length > 0) {
        const paiements = await client.query('SELECT * FROM paiements_facture WHERE facture_id = ANY($1::uuid[])', [factureIds]);
        console.log('PAIEMENTS_COUNT', paiements.rowCount);
        if (paiements.rowCount > 0) console.log('PAIEMENTS:', paiements.rows);
      }
    }
  } catch (err) {
    console.error('Inspect failed', err);
    process.exit(1);
  } finally {
    await client.end().catch(()=>{});
  }
}

main();
