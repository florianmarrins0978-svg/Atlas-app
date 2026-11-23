// LA CARTE DE LA VISITE GUIDÉE, SUR L'ACCUEIL D'UN COMPTE NEUF.
//
// Sa planche du 23 novembre 2026 (`appli/vente/cause-2-inscription.html`) et
// son oui : *« une seule fois au premier accueil ; et qu'il puisse, s'il ne
// veut pas la faire, enlever le bouton »*. Puis sa règle du même soir : *« pour
// les personnes déjà dans l'application, s'ils quittent la visite, ils
// reviennent à la page Chantiers »*.
//
// Ce que la suite joue, par la porte qu'il emprunte (`CLAUDE.md` §5 quater) :
//   · un compte neuf voit la carte sur son accueil ;
//   · « Non merci » la retire, et elle ne revient pas au rechargement ;
//   · « Faire la visite » ouvre la visite servie par l'appli, et « Quitter la
//     visite » ramène à l'accueil, Chantiers ;
//   · revenu de la visite, la carte ne se propose plus.
import { lancerNavigateur, ECRAN_DU_PATRON } from "./e2e-browser";
import assert from "node:assert/strict";
import { Pool } from "pg";
import type { Page } from "playwright";
import { creerSonCompte } from "../src/server/repositories/creation-compte";
import { documentsAAccepter, enregistrerAcceptations } from "../src/server/repositories/documents-legaux";
import { ADRESSE } from "./_adresse";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const BASE = ADRESSE;
const MOT_DE_PASSE = "trois-mots-tres-courts";
const CARTE = '[data-atlas="carte-visite"]';

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

/** Un compte neuf, conditions acceptées, prêt à entrer. */
async function compteNeuf(suffixe: string) {
  const email = `carte-visite-${suffixe}-${Date.now()}@essai.local`;
  const compte = await creerSonCompte({
    civilite: "mr",
    prenom: "Lucien",
    nom: "Vidal",
    email,
    motDePasse: MOT_DE_PASSE,
    entreprise: `Jardins Vidal ${suffixe}`,
    forme: "EI",
    tva: "franchise",
  });
  assert.ok(compte.ok, `le compte d'essai n'a pas pu être créé : ${compte.ok ? "" : compte.refus}`);
  const aAccepter = await documentsAAccepter(compte.utilisateurId);
  if (aAccepter.length > 0) {
    await enregistrerAcceptations(
      compte.utilisateurId,
      aAccepter.map((d) => d.id),
      { adresseIp: "127.0.0.1", agentUtilisateur: "suite d'essai", formuleAcceptee: null }
    );
  }
  return { email, entrepriseId: compte.entrepriseId };
}

async function entrer(page: Page, email: string) {
  await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  await page.fill('input[name="email"]', email);
  await page.fill('input[name="password"]', MOT_DE_PASSE);
  await page.click('button[type="submit"]');
  await page.waitForURL(`${BASE}/`, { timeout: 30_000 });
  await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
  await page.locator('[data-atlas="compteur"]').waitFor({ state: "visible", timeout: 30_000 });
}

async function main() {
  console.log("=== La carte de la visite guidée sur l'accueil ===\n");
  const refuse = await compteNeuf("non");
  const suit = await compteNeuf("oui");
  const navigateur = await lancerNavigateur();

  try {
    await cas("un compte neuf voit la carte, puis « Non merci » la retire pour de bon", async () => {
      const contexte = await navigateur.newContext({ ...ECRAN_DU_PATRON });
      const page = await contexte.newPage();
      await entrer(page, refuse.email);
      await page.locator(CARTE).waitFor({ state: "visible", timeout: 30_000 });
      await page.locator('[data-atlas="carte-visite-non"]').click();
      await page.locator(CARTE).waitFor({ state: "detached", timeout: 10_000 });
      // La marque est en base : rechargé, l'accueil ne la propose plus.
      await page.waitForTimeout(800);
      await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
      await page.locator('[data-atlas="compteur"]').waitFor({ state: "visible", timeout: 30_000 });
      assert.equal(await page.locator(CARTE).count(), 0, "la carte refusée revient au rechargement");
      await contexte.close();
    });

    await cas("« Faire la visite » ouvre la visite de l'appli, et « Quitter » ramène à Chantiers", async () => {
      const contexte = await navigateur.newContext({ ...ECRAN_DU_PATRON });
      const page = await contexte.newPage();
      await entrer(page, suit.email);
      await page.locator(CARTE).waitFor({ state: "visible", timeout: 30_000 });
      await Promise.all([page.waitForURL(`${BASE}/visite-guidee`, { timeout: 30_000 }), page.locator('[data-atlas="carte-visite-faire"]').click()]);
      // C'est bien la visite, servie d'ici : son écran d'ouverture répond.
      const ouverture = page.locator(".v-ouverture");
      await ouverture.waitFor({ state: "visible", timeout: 30_000 });
      await ouverture.click();
      await page.locator(".g-quitter:visible").first().click();
      await Promise.all([
        page.waitForURL(`${BASE}/`, { timeout: 30_000 }),
        page.locator('[data-action="quitter"]:visible').first().click(),
      ]);
      await page.locator('[data-atlas="compteur"]').waitFor({ state: "visible", timeout: 30_000 });
      assert.equal(await page.locator(CARTE).count(), 0, "revenu de la visite, la carte se propose encore");
      await contexte.close();
    });
  } finally {
    await navigateur.close();
    for (const c of [refuse, suit]) {
      await pool.query(`DELETE FROM entreprises WHERE id = $1`, [c.entrepriseId]);
      await pool.query(`DELETE FROM users WHERE email = $1`, [c.email]);
    }
    await pool.end();
  }

  console.log("");
  console.log(`La carte de la visite guidée — ${echecs} échec(s).`);
  process.exit(echecs > 0 ? 1 : 0);
}

main().catch(async (e) => {
  console.error(e);
  await pool.end().catch((fin) => console.error("la base ne s'est pas refermée :", fin));
  process.exit(1);
});
