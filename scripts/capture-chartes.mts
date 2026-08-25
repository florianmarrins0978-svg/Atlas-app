// Prend les captures de la rubrique « Apparence » et de l'effet de chaque charte.
//   npx tsx scripts/capture-chartes.mts <dossier>
//
// **REGARDER L'ÉCRAN, et pas seulement le réglage.** Une charte qui s'écrit en
// base sans repeindre l'application serait exactement l'interrupteur mort que
// le patron a interdit — « on le touche, rien ne bouge, et on croit à une
// panne ». Ces captures montrent l'accueil APRÈS chaque choix.
import { lancerNavigateur } from "./e2e-browser";
import type { Page } from "playwright";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { Client } from "pg";
import { CHARTES } from "../src/lib/chartes";

const BASE = process.env.ATLAS_BASE ?? "http://localhost:3000";
const dossier = process.argv[2] ?? "/tmp/captures-chartes";
mkdirSync(dossier, { recursive: true });

async function connecter(page: Page) {
  await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  await page.fill('input[name="email"]', "demo@atlas.local");
  await page.fill('input[name="password"]', "demo1234");
  await page.click('button[type="submit"]');
  await page.waitForURL(`${BASE}/`, { timeout: 30_000 });
}

// Le rôle qui TRAVERSE la RLS : `FORCE ROW LEVEL SECURITY` s'applique même au
// propriétaire, et une lecture sous le mauvais rôle rend zéro ligne sans rien
// dire (piège payé le 14 août 2026 sur `capture-trois-rubriques.mts`).
const client = new Client({ connectionString: process.env.DATABASE_URL ?? process.env.DATABASE_ADMIN_URL });
await client.connect();

const navigateur = await lancerNavigateur();
const contexte = await navigateur.newContext({ viewport: { width: 390, height: 844 } });
const page = await contexte.newPage();

try {
  await connecter(page);

  const prendre = async (nom: string) => {
    await page.waitForTimeout(400);
    const chemin = path.join(dossier, `${nom}.png`);
    await page.screenshot({ path: chemin });
    console.log(`  · ${chemin}`);
  };

  await page.goto(`${BASE}/reglages/apparence`, { waitUntil: "networkidle" });
  await prendre("0-la-liste");

  // Chaque charte est POSÉE EN BASE puis l'accueil rechargé : c'est le chemin
  // réel, celui que le gabarit lit à chaque page.
  // **LA LISTE SE LIT, ELLE NE SE RECOPIE PLUS.** Elle était écrite à la main
  // ici, et « Brume moderne » — ajoutée le 24 août 2026 sur son choix — n'a donc
  // PAS été capturée : l'outil qui existe pour regarder l'écran était aveugle à
  // la seule charte neuve. Une énumération recopiée ne suit jamais la source
  // qu'elle prétend montrer.
  for (const nom of CHARTES.map((c) => c.nom)) {
    await client.query(`UPDATE users SET charte = $1 WHERE email = 'demo@atlas.local'`, [
      nom === "origine" ? null : nom,
    ]);
    await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
    await prendre(`accueil-${nom}`);
  }

  // Rendue à l'origine : une capture qui laisse la base modifiée fait mentir
  // la suivante, et la batterie derrière.
  await client.query(`UPDATE users SET charte = NULL WHERE email = 'demo@atlas.local'`);
} finally {
  await navigateur.close();
  await client.end();
}
