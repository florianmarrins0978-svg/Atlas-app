// Le rappel « facture impayée », PHOTOGRAPHIÉ sur l'application réelle.
//
// **Pourquoi une photo, et pas seulement des suites vertes.** Quatre défauts de
// ce dépôt sont sortis d'une image et d'aucun test — le dernier, des noms
// coupés qu'une suite mesurait à zéro pixel (`CLAUDE.md` §5). Les trois suites
// du rappel disent que la règle est juste et que la carte existe ; elles ne
// disent pas à quoi elle ressemble sous le pouce.
//
// Deux scènes, celles de sa planche du 16 août 2026 :
//   1. l'accueil — une facture entièrement due, et une partiellement réglée
//      (« restant sur »), qui est le cas où l'on se trompe de somme ;
//   2. « Réglages › Notifications » — le quatrième réglage et ses trois rythmes.
import { mkdirSync } from "node:fs";
import { devices } from "playwright";
import { lancerNavigateur } from "./e2e-browser";
import { pool } from "../src/server/db/client";
import { noterPaiement } from "../src/server/repositories/paiements-facture";

const dossier = process.argv[2];
if (!dossier) {
  console.error("usage: capture-facture-impayee.mts <dossier>");
  process.exit(1);
}
mkdirSync(dossier, { recursive: true });

const BASE = "http://localhost:3000";
const echecs: string[] = [];

const navigateur = await lancerNavigateur();
const page = await (await navigateur.newContext({ ...devices["iPhone 13"] })).newPage();

await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
await page.fill('input[name="email"]', "demo@atlas.local");
await page.fill('input[name="password"]', "demo1234");
await page.click('button[type="submit"]');
await page.waitForURL(`${BASE}/`, { timeout: 60_000 });

const { rows: qui } = await pool.query(
  `SELECT utilisateur_id AS utilisateur, entreprise_id AS entreprise
     FROM membres_entreprise ORDER BY role = 'proprietaire' DESC LIMIT 1`
);
const ctx = { utilisateurId: qui[0].utilisateur as string, entrepriseId: qui[0].entreprise as string };

/** Le délai de paiement réglé, relu — c'est lui qui fait courir l'échéance. */
async function poserDelai(jours: number) {
  const r = await pool.query("UPDATE entreprises SET delai_paiement_jours = $2 WHERE id = $1", [
    ctx.entrepriseId,
    jours,
  ]);
  if (r.rowCount !== 1) throw new Error(`le délai de paiement n'a pas été posé (${r.rowCount} ligne)`);
}
await poserDelai(30);

/** Un chantier chiffré, devis parti, facture émise — par le vrai chemin. */
async function factureEmise(nomClient: string, prix: string): Promise<string> {
  await page.goto(`${BASE}/chantiers/nouveau`, { waitUntil: "networkidle" });
  await page.locator('input[placeholder="Bernard"]').fill(nomClient);
  await page.locator('input[placeholder="06 12 34 56 78"]').fill("06 79 98 45 14");
  await page.click('[data-atlas="action-dicter"]');
  await page.waitForURL(/\/chantiers\/[0-9a-f-]{36}/, { timeout: 30_000 });
  const url = page.url().split("?")[0];
  const chantierId = url.split("/").pop()!;

  await page.goto(`${url}/prix`, { waitUntil: "networkidle" });
  await page.click("text=+ Ajouter une ligne");
  await page.waitForTimeout(300);
  const champs = page.locator("form input");
  await champs.nth(0).fill("Abattage et évacuation");
  await champs.nth(1).fill(prix);
  await champs.nth(1).blur();
  await page.waitForTimeout(600);

  await page.goto(`${url}/export`, { waitUntil: "networkidle" });
  await page.click("text=Envoyer au client");
  await page.waitForSelector("text=Une date, ou deux au choix du client ?", { timeout: 30_000 });
  await page.getByRole("button", { name: "Envoyer le devis" }).click();
  await page.waitForSelector("text=Devis prêt pour", { timeout: 30_000 });

  await pool.query("UPDATE chantiers SET date_planifiee = CURRENT_DATE - 3 WHERE id = $1", [chantierId]);
  await page.goto(`${BASE}/chantiers/${chantierId}/facture`, { waitUntil: "networkidle" });
  await page.click("text=Créer la facture");
  await page.waitForSelector("text=Rien n'a changé depuis le devis ?", { timeout: 30_000 });
  await page.click("text=Confirmer le départ de la facture");
  await page.waitForSelector("text=arrêtée", { timeout: 30_000 });
  return chantierId;
}

// Une facture entièrement due, partie il y a soixante jours : échéance dépassée
// de trente.
const entiere = await factureEmise("Mme Félicie", "1200.00");
// Une seconde, dont un acompte est arrivé — le cas où l'on réclamerait le total.
const partielle = await factureEmise("M. Ravel", "2400.00");

const vieilli = await pool.query(
  "UPDATE chantiers SET facture_envoyee_at = now() - interval '60 days' WHERE id = ANY($1::uuid[])",
  [[entiere, partielle]]
);
if (vieilli.rowCount !== 2) {
  echecs.push(`${vieilli.rowCount} facture(s) vieillie(s) au lieu de 2 : la scène n'est pas celle qu'on montre`);
}

// **Relu APRÈS l'émission des factures, et ce n'est pas de la superstition.**
// La première image annonçait « échéance dépassée depuis 60 jours » là où le
// délai de trente en imposait trente : le parcours d'émission avait remis le
// délai à zéro entre-temps. Une capture qui se fie à un montage posé au début
// photographie une scène qui n'existe plus.
const { rows: relu } = await pool.query("SELECT delai_paiement_jours AS d FROM entreprises WHERE id = $1", [
  ctx.entrepriseId,
]);
if (relu[0]?.d !== 30) {
  echecs.push(`le délai de paiement vaut ${relu[0]?.d} après l'émission, au lieu de 30`);
}

const { rows: fp } = await pool.query("SELECT id FROM factures WHERE chantier_id = $1", [partielle]);
await noterPaiement(ctx, fp[0].id, {
  date: new Date().toISOString().slice(0, 10),
  montant: "1000.00",
  moyen: "virement",
});

await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
await page.waitForTimeout(700);
// L'accueil ne pose que deux cartes : on déplie, sinon la photo montrerait le
// repli plutôt que le rappel.
const deplier = page.getByRole("button", { name: /autres? devis à regarder/ });
if ((await deplier.count()) > 0) {
  await deplier.first().click();
  await page.waitForTimeout(400);
}

// **Les cartes vivent dans un cadre qui DÉFILE tout seul** (`.atlas-fil-defile`),
// et c'est ce qui a gâché la première image : `fullPage` avait photographié le
// milieu de ce cadre, sans une seule carte. Le contrôle, lui, était vert — il
// lisait le DOM, pas la photo. C'est le « contrôle qui mesure zéro » de
// `CLAUDE.md` §5, transposé à une capture : ce qu'on vérifie doit être ce qu'on
// montre.
await page.evaluate(() => document.querySelector(".atlas-fil-defile")?.scrollTo({ top: 0 }));
await page.waitForTimeout(400);

/**
 * Amène une carte dans le cadre, puis photographie l'écran — et REFUSE de
 * rendre une image où elle n'est pas entièrement visible.
 *
 * **Une image par cas, et c'est mesuré, pas choisi.** La première tentative
 * voulait les deux cartes sur la même photo : sur son écran de 390 × 844, le
 * cadre qui défile n'en tient qu'une seule à la fois. Les entasser aurait rendu
 * une image où la seconde est coupée — précisément le défaut que les photos
 * servent à trouver.
 */
async function photographierCarte(motif: RegExp, fichier: string) {
  const place = await page.evaluate((source) => {
    const re = new RegExp(source, "i");
    const cadre = document.querySelector<HTMLElement>(".atlas-fil-defile");
    const carte = [...document.querySelectorAll<HTMLElement>('[data-atlas="carte-reponse"]')].find((c) =>
      re.test(c.innerText)
    );
    if (!cadre || !carte) return false;
    cadre.scrollTop += carte.getBoundingClientRect().top - cadre.getBoundingClientRect().top - 6;
    return true;
  }, motif.source);
  if (!place) {
    echecs.push(`aucune carte « ${motif.source} » à l'accueil : ${fichier} ne montrerait rien`);
    return;
  }
  await page.waitForTimeout(500);

  // **Entièrement dans le cadre, et d'une hauteur non nulle.** Une boîte de zéro
  // pixel n'est pas « visible » : c'est une mesure impossible, et la compter
  // pour vraie rendrait ce contrôle inutile (`CLAUDE.md` §5).
  const vue = await page.evaluate((source) => {
    const re = new RegExp(source, "i");
    const carte = [...document.querySelectorAll<HTMLElement>('[data-atlas="carte-reponse"]')].find((c) =>
      re.test(c.innerText)
    );
    if (!carte) return null;
    const r = carte.getBoundingClientRect();
    return { haut: Math.round(r.top), bas: Math.round(r.bottom), hauteur: Math.round(r.height), ecran: window.innerHeight };
  }, motif.source);
  if (!vue || vue.hauteur < 10) {
    echecs.push(`« ${motif.source} » mesure ${vue?.hauteur ?? 0} px : rien à photographier`);
  } else if (vue.haut < 0 || vue.bas > vue.ecran) {
    echecs.push(
      `« ${motif.source} » déborde du cadre (${vue.haut} → ${vue.bas} pour ${vue.ecran} px) : ` +
        `${fichier} la montrerait coupée`
    );
  }
  // Le viewport, et non `fullPage` : c'est ce qu'il voit, pouce compris.
  await page.screenshot({ path: `${dossier}/${fichier}` });
}

await photographierCarte(/Facture impayée/, "1-accueil-impayee.png");
await photographierCarte(/restant sur/, "2-accueil-acompte.png");

await page.goto(`${BASE}/reglages/notifications`, { waitUntil: "networkidle" });
await page.waitForSelector("text=Ce que vous réglez", { timeout: 30_000 });
await page.waitForTimeout(400);
const reglages = await page.locator("body").innerText();
if (!/Facture impayée/.test(reglages)) echecs.push("le quatrième réglage n'est pas à l'image");
if (!/Tous les 15 jours/.test(reglages)) echecs.push("les rythmes ne sont pas à l'image");
await page.screenshot({ path: `${dossier}/3-reglage-rythme.png`, fullPage: true });

await navigateur.close();
await pool.end();

if (echecs.length > 0) {
  console.error("❌ Les images ne montrent pas la scène annoncée :");
  for (const e of echecs) console.error(`   · ${e}`);
  process.exit(1);
}
console.log(`✅ Trois images dans ${dossier}`);
