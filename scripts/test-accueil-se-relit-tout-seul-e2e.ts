import { lancerNavigateur } from "./e2e-browser";
import assert from "node:assert";
import { pool } from "../src/server/db/client";
import { creerPuisFiche } from "./_creer-chantier-e2e";
import { ADRESSE } from "./_adresse";

/**
 * LA RÉPONSE DU CLIENT ARRIVE SANS QU'IL RECHARGE.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * **Sa remarque du 17 septembre 2026 :** *« mon client vient d'accepter mon
 * devis, sauf que j'ai l'impression qu'il n'apparaîtra dans mes notifications
 * que si je réactualise la page »*.
 *
 * Il avait raison, et ce n'était pas un mécanisme en panne : il n'y en avait
 * aucun. L'accueil lit les réponses une fois, au moment où il est demandé ; la
 * réponse, elle, arrive plus tard et sur le téléphone du client. Rien, dans son
 * navigateur à lui, ne pouvait l'apprendre (`VeilleDesNouvelles`).
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * **CE QUE CE CONTRÔLE FIXE, ET CE QU'IL NE FIXE PAS.** Il fixe la PROMESSE —
 * la carte arrive toute seule, et vite — non le rythme choisi ni le crochet
 * employé. Un contrôle qui compterait les trente secondes se contredirait au
 * premier réglage, et ne défendrait rien de ce qu'il voit, lui
 * (`CLAUDE.md` §5 bis).
 *
 * **L'acceptation est jouée par le VRAI chemin** : une seconde fenêtre, sans sa
 * session, sur la page publique du devis — c'est exactement ce que fait son
 * client. Écrire la réponse en base à la main éprouverait la moitié qu'on vient
 * d'écrire, pas le chemin qu'elle emprunte (`CLAUDE.md` §5 quater).
 *
 * **Sait échouer** : jouée sur le code d'avant ce lot, elle tombe sur « rien
 * n'est arrivé sur son accueil » au bout de sa minute d'attente — et la même
 * carte apparaît au rechargement qui suit, ce que la suite vérifie pour ne pas
 * accuser le produit d'un défaut qui serait dans l'envoi.
 */

const BASE = ADRESSE;

/** Combien de temps son accueil a le droit de rester en retard. */
const PATIENCE_MS = 75_000;

async function main() {
  const navigateur = await lancerNavigateur();
  const contexte = await navigateur.newContext();
  const page = await contexte.newPage();

  await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  await page.fill('input[name="email"]', "demo@atlas.local");
  await page.fill('input[name="password"]', "demo1234");
  await page.click('button[type="submit"]');
  await page.waitForURL(`${BASE}/`, { timeout: 15_000 });

  // ── Un devis parti chez un client, par le chemin du patron ────────────────
  const nom = `Veille ${Date.now().toString().slice(-6)}`;
  await page.goto(`${BASE}/chantiers/nouveau`, { waitUntil: "networkidle" });
  await page.fill('input[placeholder="Bernard"]', nom);
  await page.fill('input[placeholder="06 12 34 56 78"]', "0612345678");
  const chantierId = await creerPuisFiche(page);

  await page.goto(`${BASE}/chantiers/${chantierId}/devis-complet`, { waitUntil: "networkidle" });
  await page.waitForSelector("text=Total TTC", { timeout: 30_000 });
  await page.getByRole("button", { name: "+ Ajouter une ligne" }).click();
  await page.waitForTimeout(900);
  await page.getByLabel("Description 1").fill("Taille d'une haie de charmille");
  await page.getByLabel("Prix unitaire 1").fill("420");
  await page.getByLabel("Description 1").click();
  await page.waitForTimeout(1400);

  await page.goto(`${BASE}/chantiers/${chantierId}/devis-complet`, { waitUntil: "networkidle" });
  await page.click("text=Choisir la date");
  await page.getByRole("button", { name: /Envoyer le devis/i }).click();

  // **Attendre l'ÉTAT, jamais un délai fixe** : sous soixante suites enchaînées,
  // l'envoi met plus de temps, et un délai court accuserait le produit d'une
  // impatience (le piège des 12 et 13 août 2026).
  let jeton: string | undefined;
  for (let i = 0; i < 60 && !jeton; i++) {
    const { rows } = await pool.query(
      `SELECT e.jeton FROM envois_devis e JOIN devis d ON d.id = e.devis_id WHERE d.chantier_id = $1`,
      [chantierId]
    );
    jeton = rows[0]?.jeton as string | undefined;
    if (!jeton) await page.waitForTimeout(500);
  }
  assert.ok(
    jeton,
    "Aucun envoi après trente secondes : ce n'est pas l'accueil qui est en cause, c'est l'envoi."
  );

  // ── Son accueil, OUVERT et laissé tel quel ────────────────────────────────
  await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
  const carte = page.locator(`[data-atlas="carte-reponse"][data-chantier="${chantierId}"]`);
  assert.equal(
    await carte.count(),
    0,
    "La carte est déjà là avant la réponse du client : il n'y a plus rien à mesurer ici."
  );

  // ── Le client accepte, de son côté, sans toucher à la fenêtre du patron ───
  const cotClient = await navigateur.newContext();
  const pageClient = await cotClient.newPage();
  await pageClient.goto(`${BASE}/devis/${jeton}`, { waitUntil: "networkidle" });
  const bouton = pageClient.getByRole("button", { name: /J'accepte ce devis/i });
  await bouton.waitFor({ state: "visible", timeout: 30_000 });
  // **Une date d'abord** : « Choisissez une date d'intervention avant de
  // valider » est un refus qui s'affiche sur SA page à lui — la suite croirait
  // alors l'accueil muet alors que rien ne serait jamais parti. Il retient ici
  // la date que l'artisan proposait, la plus ordinaire des réponses.
  const dateProposee = pageClient.locator('input[type="radio"][name="choixDate"]').first();
  await dateProposee.waitFor({ state: "visible", timeout: 15_000 });
  await dateProposee.check();
  await pageClient.waitForTimeout(400);
  await bouton.click();
  await pageClient.waitForTimeout(2500);

  const { rows: repondu } = await pool.query(
    `SELECT e.reponse FROM envois_devis e JOIN devis d ON d.id = e.devis_id WHERE d.chantier_id = $1`,
    [chantierId]
  );
  assert.equal(
    repondu[0]?.reponse,
    "acceptee",
    "Le client n'a pas pu accepter : ce contrôle ne dit alors rien de l'accueil."
  );

  // ── Et son accueil, qu'il n'a pas touché ? ────────────────────────────────
  let vue = false;
  const limite = Date.now() + PATIENCE_MS;
  while (Date.now() < limite && !vue) {
    if ((await carte.count()) > 0) vue = true;
    else await page.waitForTimeout(1000);
  }

  if (!vue) {
    // **On sépare les deux causes avant d'accuser.** Une carte qui n'apparaît
    // pas davantage au rechargement ne dit rien de la veille : le défaut serait
    // ailleurs, et le message enverrait chercher au mauvais endroit.
    await page.reload({ waitUntil: "networkidle" });
    const auRechargement = await carte.count();
    assert.fail(
      auRechargement > 0
        ? `Rien n'est arrivé sur son accueil en ${PATIENCE_MS / 1000} s — la carte n'apparaît qu'au rechargement, c'est exactement ce qu'il signale.`
        : "La carte manque même après rechargement : le défaut n'est pas dans la veille de l'accueil."
    );
  }

  await navigateur.close();
  console.log("✓ La réponse du client arrive sur l'accueil sans rechargement.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
