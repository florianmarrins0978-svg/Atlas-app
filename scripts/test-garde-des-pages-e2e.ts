// Un écran fermé à un rôle le reste, MÊME par une navigation interne.
//
// ─────────────────────────────────────────────────────────────────────────────
// **Audit du 25 octobre 2026, E8, reproduit à l'écran.** La garde des rôles
// vivait dans le gabarit racine (`GardeAcces`, `src/app/layout.tsx`). Un
// chargement complet la jouait ; une navigation interne, non : Next.js ne
// rejoue pas un gabarit partagé d'un écran à l'autre, et l'écran fermé partait
// quand même dans la réponse (`node_modules/next/dist/docs/01-app/02-guides/
// authentication.md`, « Layouts and auth checks »). Un commercial passé par
// `/chantiers` lisait Ma TVA, collectée et déductible.
//
// **Ce que cette suite fait comme lui** : elle ne tape pas l'adresse (le
// chargement complet était déjà refusé), elle navigue DE L'INTÉRIEUR, par le
// routeur de l'application, depuis un écran qui lui est ouvert.

import { lancerNavigateur } from "./e2e-browser";
import assert from "node:assert/strict";
import { Pool } from "pg";
import { donnerUnAcces, listerAcces } from "../src/server/repositories/membres-entreprise";
import { documentsAAccepter, enregistrerAcceptations } from "../src/server/repositories/documents-legaux";
import type { Ctx } from "../src/server/repositories/context";
import { ADRESSE } from "./_adresse";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const BASE = ADRESSE;
const MOT_DE_PASSE = "trois-mots-courts-et-un";

let echecs = 0;
async function cas(nom: string, fn: () => Promise<void>) {
  try {
    await fn();
    console.log(`  ✓ ${nom}`);
  } catch (e) {
    echecs++;
    console.error(`  ✗ ${nom}\n    ${(e as Error).message}`);
  }
}

async function main() {
  console.log("=== Un écran fermé le reste, même par une navigation interne ===\n");

  const { rows } = await pool.query(
    `SELECT me.utilisateur_id AS u, me.entreprise_id AS e
       FROM membres_entreprise me JOIN users usr ON usr.id = me.utilisateur_id
      WHERE usr.email = 'demo@atlas.local' AND me.role = 'proprietaire' LIMIT 1`
  );
  assert.ok(rows[0], "le compte de démonstration n'est pas patron : rien à éprouver");
  const ctxPatron: Ctx = { utilisateurId: rows[0].u, entrepriseId: rows[0].e };

  const membre = async (role: "commercial" | "salarie") => {
    const email = `${role}-pages-${Date.now()}@essai.local`;
    const donne = await donnerUnAcces(ctxPatron, { nom: role, email, motDePasse: MOT_DE_PASSE, confirmation: MOT_DE_PASSE, role });
    assert.deepEqual(donne, { ok: true }, `le compte ${role} n'a pas pu être créé`);
    const lui = (await listerAcces(ctxPatron)).find((l) => l.email === email)!;
    const aAccepter = await documentsAAccepter(lui.utilisateurId);
    if (aAccepter.length > 0) {
      await enregistrerAcceptations(lui.utilisateurId, aAccepter.map((d) => d.id), {
        adresseIp: "127.0.0.1",
        agentUtilisateur: "suite d'essai",
        formuleAcceptee: null,
      });
    }
    return email;
  };
  const commercial = await membre("commercial");
  const salarie = await membre("salarie");

  const navigateur = await lancerNavigateur();

  /** Se connecte, ouvre un écran OUVERT, puis navigue de l'intérieur vers `cible`. */
  async function depuisLInterieur(email: string, motDePasse: string, depart: string, cible: string) {
    const contexte = await navigateur.newContext({ viewport: { width: 390, height: 844 } });
    const page = await contexte.newPage();
    await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
    await page.fill('input[name="email"]', email);
    await page.fill('input[name="password"]', motDePasse);
    await page.click('button[type="submit"]');
    await page.waitForURL((u) => !u.toString().includes("/login"), { timeout: 30_000 });
    await page.goto(`${BASE}${depart}`, { waitUntil: "networkidle" });
    assert.ok(page.url().includes(depart), `l'écran de départ ${depart} n'est pas ouvert (${page.url()}) : rien à éprouver`);
    await page.evaluate((c) => (window as unknown as { next: { router: { push: (u: string) => void } } }).next.router.push(c), cible);
    // Le temps que la réponse arrive et que l'écran se peigne, ou que la garde renvoie ailleurs.
    await page.waitForTimeout(5000);
    await page.waitForLoadState("networkidle");
    const url = new URL(page.url()).pathname;
    const texte = await page.locator("body").innerText();
    await contexte.close();
    return { url, texte };
  }

  await cas("un COMMERCIAL n'atteint pas Ma TVA par une navigation interne", async () => {
    const { url, texte } = await depuisLInterieur(commercial, MOT_DE_PASSE, "/chantiers", "/termines/tva");
    assert.notEqual(url, "/termines/tva", "le commercial est resté sur Ma TVA");
    assert.ok(!/TVA collectée/i.test(texte), "LA TVA DE L'ENTREPRISE S'EST AFFICHÉE À UN COMMERCIAL");
  });

  await cas("un SALARIÉ n'atteint pas la liste des clients par une navigation interne", async () => {
    const { url } = await depuisLInterieur(salarie, MOT_DE_PASSE, "/planning", "/clients");
    assert.notEqual(url, "/clients", "le salarié est resté sur la liste des clients");
  });

  await cas("le PATRON, lui, y arrive (sinon le refus ne prouve rien)", async () => {
    const { url, texte } = await depuisLInterieur("demo@atlas.local", "demo1234", "/chantiers", "/termines/tva");
    assert.equal(url, "/termines/tva", `le patron a été renvoyé vers ${url}`);
    assert.match(texte, /TVA collectée/i);
  });

  await navigateur.close();
  await pool.end();
  console.log(echecs === 0 ? "\n✅ Un écran fermé le reste, même de l'intérieur." : `\n❌ ${echecs} échec(s).`);
  process.exit(echecs === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
