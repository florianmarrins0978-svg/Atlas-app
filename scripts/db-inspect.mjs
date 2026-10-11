import { Client } from 'pg';

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error('DATABASE_URL not set');
    process.exit(2);
  }
  const client = new Client({ connectionString: url });
  try {
    await client.connect();
    const paiements = await client.query('SELECT count(*)::int AS n FROM paiements_facture');
    const factures = await client.query('SELECT count(*)::int AS n FROM factures');
    console.log('PAIEMENTS_FACTURE_COUNT', paiements.rows[0].n);
    console.log('FACTURES_COUNT', factures.rows[0].n);
  } catch (err) {
    console.error('DB inspect failed', err);
    process.exit(1);
  } finally {
    await client.end().catch(() => undefined);
  }
}

main();
