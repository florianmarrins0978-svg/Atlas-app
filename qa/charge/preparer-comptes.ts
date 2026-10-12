/**
 * Prépare les entreprises de la campagne de charge, sur la base QA (55432).
 *
 * Pourquoi plusieurs entreprises : la connexion est limitée à 5 tentatives par
 * compte et par adresse sur un quart d'heure, et la séparation entre
 * entreprises ne se mesure qu'avec plusieurs entreprises qui travaillent en
 * même temps.
 *
 * Tout passe par les fonctions du produit (`creerSonCompte`, `creerClient`,
 * `creerChantier`, `planifierChantier`), sous le rôle `atlas_app` du `.env` :
 * c'est le chemin qu'emprunte un vrai artisan, RLS comprise.
 *
 * Rejouable : un compte qui existe déjà est repris, pas recréé.
 *
 * Usage : npx tsx --env-file=.env qa/charge/preparer-comptes.ts <dossier-sortie> [nombre]
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { pool } from "../../src/server/db/client";
import { creerSonCompte } from "../../src/server/repositories/creation-compte";
import { creerClient } from "../../src/server/repositories/clients";
import { creerChantier, planifierChantier, listerChantiers } from "../../src/server/repositories/chantiers";
import type { Ctx } from "../../src/server/repositories/context";

const sortie = process.argv[2];
const nombre = Number(process.argv[3] ?? 20);
if (!sortie) throw new Error("Dossier de sortie manquant");

const url = process.env.DATABASE_URL ?? "";
if (!url.includes(":55432/") || !url.startsWith("postgresql://atlas_app:")) {
  throw new Error("Refus : ce script ne tourne que sur la base QA (55432) sous atlas_app.");
}

const MOT_DE_PASSE = "Charge-QA-2026-Tondeuse!";
const CLIENTS = 30;
const CHANTIERS = 30;
const PLANIFIES = 15;

function jour(decalage: number): string {
  const d = new Date();
  d.setDate(d.getDate() + decalage);
  return d.toISOString().slice(0, 10);
}

type Compte = { email: string; motDePasse: string; entrepriseId: string; nom: string; chantierIds: string[] };

// Même lecture que `getCurrentCtx` : `membres_entreprise` est sous FORCE RLS, et
// seul le contexte d'amorçage `app.utilisateur_id` en laisse lire sa propre ligne.
async function retrouver(email: string): Promise<{ utilisateurId: string; entrepriseId: string } | null> {
  const { rows: u } = await pool.query(`SELECT id FROM users WHERE email = $1`, [email]);
  if (!u[0]) return null;
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(`SELECT set_config('app.utilisateur_id', $1, true)`, [u[0].id]);
    const { rows } = await client.query(
      `SELECT entreprise_id FROM membres_entreprise WHERE utilisateur_id = $1 ORDER BY created_at LIMIT 1`,
      [u[0].id]
    );
    await client.query("COMMIT");
    if (!rows[0]) throw new Error(`${email} existe sans entreprise lisible`);
    return { utilisateurId: u[0].id, entrepriseId: rows[0].entreprise_id };
  } finally {
    client.release();
  }
}

async function main() {
  mkdirSync(sortie, { recursive: true });
  const comptes: Compte[] = [];

  for (let n = 1; n <= nombre; n++) {
    const rang = String(n).padStart(2, "0");
    const email = `charge${rang}@qa.local`;
    const nom = `Paysages Charge ${rang}`;

    let ids = await retrouver(email);
    let neuf = false;
    if (!ids) {
      const r = await creerSonCompte({
        civilite: "mr",
        prenom: "Testeur",
        nom: `Charge${rang}`,
        email,
        motDePasse: MOT_DE_PASSE,
        entreprise: nom,
        forme: "EI",
        tva: "franchise",
      });
      if (!r.ok) throw new Error(`${email} : ${r.refus}`);
      ids = { utilisateurId: r.utilisateurId, entrepriseId: r.entrepriseId };
      neuf = true;
    }
    const ctx = { utilisateurId: ids.utilisateurId, entrepriseId: ids.entrepriseId } as Ctx;

    if (neuf) {
      for (let c = 0; c < CHANTIERS; c++) {
        const client = c < CLIENTS ? await creerClient(ctx, { nom: `Client ${rang}-${c + 1}`, telephone: "0600000000" }) : null;
        const chantier = await creerChantier(ctx, {
          nom: `Jardin ${rang}-${c + 1}`,
          adresseChantier: `${c + 1} rue des Essais, 33000 Bordeaux`,
          clientId: client?.id ?? null,
        });
        if (c < PLANIFIES) await planifierChantier(ctx, chantier.id, jour(c % 20));
      }
    }

    const chantiers = await listerChantiers(ctx);
    comptes.push({
      email,
      motDePasse: MOT_DE_PASSE,
      entrepriseId: ids.entrepriseId,
      nom,
      chantierIds: chantiers.map((c: { id: string }) => c.id),
    });
    console.log(`${email} ${neuf ? "créé" : "repris"} : ${chantiers.length} chantiers`);
  }

  writeFileSync(join(sortie, "comptes.json"), JSON.stringify(comptes, null, 2));
  console.log(`${comptes.length} comptes écrits dans ${join(sortie, "comptes.json")}`);
  await pool.end();
}

main().catch(async (e) => {
  console.error(e);
  await pool.end().catch(() => undefined);
  process.exit(1);
});
