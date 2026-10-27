// SON ENTREPRISE SANS PLAFOND DE CRÉDITS IA — sa décision du 26 octobre 2026.
//
// L'appli sert tous les artisans : la sienne ne s'écrit pas dans le code. Elle
// se désigne ici, par l'adresse de son compte, et le banc la passe au serveur
// (`ATLAS_IA_SANS_PLAFOND`, `src/lib/credits-ia.ts`). Le fichier vit à côté de
// la clé de l'espace, hors du dépôt (`secret-de-l-espace.ts`).
//
//   npm run ia:sans-plafond -- son@adresse.fr     # puis rallumer l'espace
//   npm run ia:sans-plafond -- --retirer          # le plafond revient
//
// Ne touche à aucune donnée : il LIT l'entreprise du compte, et écrit un fichier.

import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import pg from "pg";
import { dossierDesSecrets } from "./secret-de-l-espace";

export const FICHIER = "ia-sans-plafond";

async function main() {
  const fichier = path.join(dossierDesSecrets(), FICHIER);
  const arg = process.argv.slice(2).find((a) => a !== "--");
  if (arg === "--retirer") {
    if (existsSync(fichier)) rmSync(fichier);
    console.log("Le plafond de crédits IA s'applique de nouveau. Rallumez l'espace.");
    return;
  }
  if (!arg || !arg.includes("@")) {
    console.error("Donnez l'adresse de votre compte : npm run ia:sans-plafond -- vous@exemple.fr");
    process.exit(2);
  }
  const adresse = process.env.DATABASE_SUPER_URL;
  if (!adresse) {
    console.error("DATABASE_SUPER_URL absent : impossible de lire votre entreprise.");
    process.exit(1);
  }
  const client = new pg.Client({ connectionString: adresse });
  await client.connect();
  try {
    const { rows } = await client.query(
      `SELECT DISTINCT me.entreprise_id AS id, e.nom FROM membres_entreprise me
         JOIN users u ON u.id = me.utilisateur_id JOIN entreprises e ON e.id = me.entreprise_id
        WHERE lower(u.email) = lower($1) AND me.role = 'proprietaire'`,
      [arg.trim()]
    );
    if (rows.length === 0) {
      console.error(`Aucune entreprise dont ${arg} est le patron.`);
      process.exit(1);
    }
    mkdirSync(dossierDesSecrets(), { recursive: true, mode: 0o700 });
    writeFileSync(fichier, rows.map((r) => r.id).join(","), { mode: 0o600 });
    console.log(`Sans plafond de crédits IA : ${rows.map((r) => r.nom).join(", ")}. Rallumez l'espace.`);
  } finally {
    await client.end();
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(__filename)) {
  main().catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exit(1);
  });
}
