/* =======================================================================
   Photographier chaque libellé dont la flèche a été retirée.

   **Sa demande du 25 août 2026 :** *« fais-moi une photo de chaque flèche
   que tu as supprimée, parce qu'il y a des flèches qui servent à faire
   des retours ou ouvrir des pages : celles-là il ne faut pas les
   supprimer, seulement celles qui sont sur un bouton comme celle de
   créer la facture »*.

   Il ne peut pas trancher sur une liste de libellés : il faut qu'il VOIE
   où chacun se trouve, et de quoi il a l'air maintenant.

   **Deux chantiers, et c'est nécessaire.** Le chantier de démonstration
   « Rénovation salle de bain » porte une vraie dictée — sans elle, les
   écrans de transcription et de note vocale se replient sur un état vide
   et ne montrent aucun des libellés. Un chantier neuf sert pour le reste,
   parce qu'on y envoie le devis, ce qui ne se défait pas.

   **Ce qui n'a pas pu être atteint est ÉCRIT**, jamais passé sous
   silence : un écran manquant se lirait sinon comme un écran sans
   flèche.

   Le serveur doit tourner (`npm run dev`) et la base porter le jeu de
   démo (`npm run db:seed`).

   Usage :
     npx tsx scripts/capture-fleches-retirees.mts /tmp/captures
   ======================================================================= */
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import type { Page } from "playwright";
import { devices } from "playwright";
import { lancerNavigateur } from "./e2e-browser";
import { creerPuisFiche } from "./_creer-chantier-e2e";

const dossier = process.argv[2];
if (!dossier) {
  console.error("usage: capture-fleches-retirees.mts <dossier>");
  process.exit(1);
}
mkdirSync(dossier, { recursive: true });

const BASE = "http://localhost:3000";

/** `bouton` : ce qu'il voulait voir partir. `lien` : ce dont il veut décider. */
type Genre = "bouton" | "lien";
type Releve = {
  libelle: string;
  avant: string;
  genre: Genre;
  ecran: string;
  image: string | null;
  absent?: string;
};

const releve: Releve[] = [];

/**
 * Photographie le voisinage d'un libellé, pas la page entière.
 *
 * Une capture de page complète oblige à chercher le bouton à l'œil ; ce
 * qu'il demande, c'est de voir LA flèche — donc son bouton, en gros.
 */
async function photographier(
  page: Page,
  ecran: string,
  libelle: string,
  avant: string,
  genre: Genre,
  motif: RegExp,
) {
  const cible = page.getByText(motif).first();
  const nom = `${ecran}-${libelle.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}.png`;
  try {
    await cible.waitFor({ state: "visible", timeout: 8_000 });
    /* **Sans cela, un libellé sous la ligne de flottaison rend une découpe
       « hors de l'image »** : la découpe se compte dans la fenêtre, pas dans
       la page. Le message accusait la capture, pas le défilement. */
    await cible.scrollIntoViewIfNeeded();
    await page.waitForTimeout(350);
    const boite = await cible.boundingBox();
    /* **Refuser de conclure sur une boîte de zéro pixel** (`CLAUDE.md` §5) :
       une image de 0 × 0 serait vide, et une planche d'images vides se lit
       comme « il n'y a rien à voir ». */
    if (!boite || boite.width < 20 || boite.height < 8) {
      throw new Error(`boîte de ${Math.round(boite?.width ?? 0)} × ${Math.round(boite?.height ?? 0)} px`);
    }
    const marge = 26;
    const taille = page.viewportSize() ?? { width: 390, height: 844 };
    await page.screenshot({
      path: path.join(dossier, nom),
      clip: {
        x: Math.max(0, boite.x - marge),
        y: Math.max(0, boite.y - marge),
        width: Math.min(taille.width, boite.width + marge * 2),
        height: boite.height + marge * 2,
      },
    });
    releve.push({ libelle, avant, genre, ecran, image: nom });
    console.log(`  ✓ ${ecran} · ${libelle}`);
  } catch (e) {
    releve.push({ libelle, avant, genre, ecran, image: null, absent: (e as Error).message.split("\n")[0] });
    console.log(`  ⚠ ${ecran} · ${libelle} — pas atteint (${(e as Error).message.split("\n")[0]})`);
  }
}

const navigateur = await lancerNavigateur();
const contexte = await navigateur.newContext({ ...devices["iPhone 13"], deviceScaleFactor: 2 });
const page = await contexte.newPage();

await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
await page.fill('input[name="email"]', "demo@atlas.local");
await page.fill('input[name="password"]', "demo1234");
await page.click('button[type="submit"]');
await page.waitForURL(`${BASE}/`, { timeout: 30_000 });

// ─── Le chantier de démonstration, qui porte une vraie dictée ───────────
await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
await page.locator(".atlas-ligne", { hasText: "Rénovation salle de bain" }).first().click();
await page.waitForURL(/\/chantiers\/[0-9a-f-]{36}/, { timeout: 15_000 });
const dicte = page.url().replace(/(\/chantiers\/[0-9a-f-]{36}).*$/, "$1");

await page.goto(`${dicte}/transcription`, { waitUntil: "networkidle" });
await photographier(page, "transcription", "Continuer vers les informations", "Continuer vers les informations →", "lien", /Continuer vers les informations/);
await photographier(page, "transcription", "Ou vérifier les informations une par une", "Ou vérifier les informations une par une →", "lien", /vérifier les informations une par une/);
await photographier(page, "transcription", "Aller à la note vocale", "Aller à la note vocale →", "lien", /Aller à la note vocale/);

/* « Ouvrir mes tarifs » ne s'affiche qu'avec une proposition de tarif, que
   seul le chantier de démonstration porte — d'où cette visite ici. */
await page.goto(`${dicte}/prix`, { waitUntil: "networkidle" });
await photographier(page, "prix", "Ouvrir mes tarifs", "Ouvrir mes tarifs →", "lien", /Ouvrir mes tarifs/);

await page.goto(`${dicte}/note-vocale`, { waitUntil: "networkidle" });
await photographier(page, "note-vocale", "Ou rédiger le devis à la main", "Ou rédiger le devis à la main →", "lien", /rédiger le devis à la main/);

await page.goto(dicte, { waitUntil: "networkidle" });
await photographier(page, "fiche", "Mon devis", "Mon devis →", "bouton", /^Mon devis$/);
await photographier(page, "fiche", "Ouvrir le devis et poser les prix", "Ouvrir le devis et poser les prix →", "lien", /Ouvrir le devis et poser les prix/);

// ─── Un chantier neuf : on y envoie le devis, ce qui ne se défait pas ───
await page.goto(`${BASE}/chantiers/nouveau`, { waitUntil: "networkidle" });
await page.getByLabel(/Nom du client/i).fill(`Flèches ${Date.now()}`);
await page.fill('input[placeholder="06 12 34 56 78"]', "07 11 22 33 44");
await photographier(page, "nouveau-chantier", "Enregistrer", "Enregistrer →", "bouton", /^Enregistrer$/);
const neuf = await creerPuisFiche(page, BASE);

await page.goto(`${BASE}/chantiers/${neuf}/devis-complet`, { waitUntil: "networkidle" });
await page.waitForSelector("text=Total TTC", { timeout: 60_000 });
await page.getByRole("button", { name: "+ Ajouter une ligne" }).click();
await page.waitForTimeout(900);
await page.getByLabel("Description 1").fill("Taille d'une haie de laurier");
await page.getByLabel("Prix unitaire 1").fill("850");
await page.getByLabel("Description 1").click();
await page.waitForTimeout(1200);

await page.goto(`${BASE}/chantiers/${neuf}/prix`, { waitUntil: "networkidle" });
await photographier(page, "prix", "Préparer le devis", "Préparer le devis →", "bouton", /^Préparer le devis$/);
await photographier(page, "prix", "Voir la proposition de prix", "Voir la proposition de prix →", "lien", /Voir la proposition de prix/);

await page.goto(`${BASE}/reglages/prix`, { waitUntil: "networkidle" });
await photographier(page, "reglages-prix", "Régler mes mesures", "Régler mes mesures →", "lien", /Régler mes mesures/);

await page.goto(`${BASE}/reglages/agenda`, { waitUntil: "networkidle" });
await photographier(page, "reglages-agenda", "mes identifiants Google", "…mes identifiants Google →", "lien", /mes identifiants Google/);

await page.goto(`${BASE}/paysage/fiche`, { waitUntil: "networkidle" });
await photographier(page, "paysage", "Composer ma fiche", "Composer ma fiche →", "lien", /Composer ma fiche/);

// Le devis part : c'est ce qui ouvre l'écran de transmission et la facture.
await page.goto(`${BASE}/chantiers/${neuf}/devis-complet`, { waitUntil: "networkidle" });
await page.getByRole("button", { name: "Choisir la date" }).click();
await page.waitForSelector('[data-atlas="invite-dates"]', { timeout: 30_000 });
await page.getByRole("button", { name: "Envoyer le devis" }).click();
await page.waitForURL(/localhost:3000\/$/, { timeout: 30_000 });

await page.goto(`${BASE}/chantiers/${neuf}/export`, { waitUntil: "networkidle" });
await photographier(page, "export", "Modifier mon devis", "Modifier mon devis ›", "lien", /Modifier mon devis/);

await page.goto(`${BASE}/chantiers/${neuf}/devis-complet`, { waitUntil: "networkidle" });
await photographier(page, "devis-complet", "Le corriger et le renvoyer", "Le corriger et le renvoyer →", "lien", /Le corriger et le renvoyer/);

await page.goto(`${BASE}/chantiers/${neuf}/facture`, { waitUntil: "networkidle" });
await photographier(page, "facture", "Créer la facture", "Créer la facture →", "bouton", /^Créer la facture$/);
const creer = page.getByRole("button", { name: /^Créer la facture$/ });
if (await creer.count()) {
  await creer.click();
  await page.waitForSelector('[data-atlas="envoyer-la-facture"]', { timeout: 60_000 });
  await photographier(page, "facture", "Envoyer la facture au client", "Envoyer la facture au client →", "bouton", /Envoyer la facture au client/);
}

writeFileSync(path.join(dossier, "releve.json"), JSON.stringify(releve, null, 2));
const vus = releve.filter((r) => r.image).length;
console.log(`\n${vus}/${releve.length} libellés photographiés. Relevé : ${path.join(dossier, "releve.json")}`);
await navigateur.close();
