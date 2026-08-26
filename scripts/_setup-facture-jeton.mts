import { pool } from "../src/server/db/client";
import { terminerChantier, emettreFacture } from "../src/server/repositories/factures";
import { creerEnvoiFacture } from "../src/server/repositories/envois-factures";

const u = await pool.query<{ id: string }>(`SELECT id FROM users WHERE email='demo@atlas.local' LIMIT 1`);
const e = await pool.query<{ id: string }>(`SELECT id FROM entreprises ORDER BY created_at LIMIT 1`);
const ctx = { utilisateurId: u.rows[0].id, entrepriseId: e.rows[0].id };
const ch = await pool.query<{ id: string }>(
  `SELECT ch.id FROM chantiers ch JOIN devis d ON d.chantier_id=ch.id WHERE d.statut='envoye' ORDER BY ch.created_at LIMIT 1`
);
const chantierId = ch.rows[0].id;
const fac = await terminerChantier(ctx, chantierId);
try { await emettreFacture(ctx, fac.id); } catch { /* déjà émise */ }
const envoi = await creerEnvoiFacture(ctx, fac.id, "sms");
console.log("JETON=" + envoi.jeton);
await pool.end();
