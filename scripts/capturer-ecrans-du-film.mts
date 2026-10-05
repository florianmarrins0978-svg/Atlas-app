// ═══════════════════════════════════════════════════════════════════════════
// LES ÉCRANS DU FILM DE PROMOTION, photographiés sur l'application servie
// ═══════════════════════════════════════════════════════════════════════════
//
// Tout ce qui s'affiche dans le téléphone du film est une capture réelle, au
// format des premières (appli/video-promo/film/*.jpg) : iPhone 13, 390 × 844 à
// l'échelle 3, JPEG à 92. Les PDF sont rendus à 300 dpi, page 1.
//
//   npx tsx scripts/capturer-ecrans-du-film.mts            → le planning et la fiche d'intervention
//   npx tsx scripts/capturer-ecrans-du-film.mts facture    → la facture et la TVA
//   npx tsx scripts/capturer-ecrans-du-film.mts editeur    → le devis rédigé à la main (l'éditeur de lignes)
//   … --dossier <où>                                        → ailleurs que dans le film
//
// L'ordre compte : la première série se prend AVANT
// `preparer-jeu-du-film.mts --facturer`, parce qu'un chantier terminé quitte
// le planning (`src/lib/onglet-chantier.ts`). La seconde se prend après.
//
// Le serveur doit tourner sur ATLAS_ADRESSE (ou localhost:3000, jamais
// 127.0.0.1 : Next refuse ses ressources à une origine étrangère, et l'écran
// n'arrive jamais hydraté). Rien n'est lu en base : les identifiants viennent
// des écrans eux-mêmes, comme le patron les atteint.
//
// Le script écrit aussi, sur la sortie standard, les repères de chaque geste
// que la vidéo doit montrer (en pixels de l'application, largeur 390) : la case
// du 13, la ligne du chantier, les gestes de la fiche, les cases des travaux.
// ═══════════════════════════════════════════════════════════════════════════
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, renameSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { devices, type Browser, type Page } from "playwright";
import { lancerNavigateur } from "./e2e-browser";
import { ADRESSE } from "./_adresse";
import { fichierDemandeALaVisionneuse } from "../src/lib/visionneuse-pdf";
import { CHANTIER_NOM, CLIENTE, COMPTE_DEMO, COMPTE_SALARIE, JOUR_DU_CHANTIER, LIGNES, PERIODE_TVA } from "./_jeu-du-film";

const args = process.argv.slice(2);
const serie = args.includes("facture") ? "facture" : args.includes("editeur") ? "editeur" : "planning";
const rangDossier = args.indexOf("--dossier");
const DOSSIER = rangDossier >= 0 && args[rangDossier + 1] ? args[rangDossier + 1] : "appli/video-promo/film";
const BASE = ADRESSE;

// L'écran du film : celui des premières captures (1170 × 2532), et non les
// 390 × 664 des suites, qui retirent la barre d'adresse du navigateur.
const ECRAN_DU_FILM = { ...devices["iPhone 13"], viewport: { width: 390, height: 844 } };
const PDF_DPI = 300;

mkdirSync(DOSSIER, { recursive: true });

type Repere = { x: number; y: number; largeur: number; hauteur: number; centre: { x: number; y: number } };
type Reperes = Record<string, Repere | Repere[]>;
/** Les repères de chaque série, par compte : le patron et le gars n'ont pas la même page. */
const reperesParCompte: Record<string, Reperes> = {};
let reperes: Reperes = {};

function dire(message: string) {
  console.log(`→ ${message}`);
}

/**
 * La connexion, puis les deux murs qui interceptent tout écran (acceptation
 * des documents, bienvenue) : les franchir fait partie du geste, s'arrêter là
 * revient à photographier une porte (`voir-un-ecran.mts`).
 */
async function seConnecter(page: Page, compte: { email: string; motDePasse: string }) {
  await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
  await page.fill('input[name="email"]', compte.email);
  await page.fill('input[name="password"]', compte.motDePasse);
  await page.click('button[type="submit"]');
  await page.waitForURL((url) => !url.pathname.startsWith("/login"), { timeout: 60_000 });
  for (let essai = 0; essai < 3 && /documents-legaux|bienvenue/.test(page.url()); essai++) {
    const cases = page.locator('input[type="checkbox"]');
    for (let i = 0; i < (await cases.count()); i++) await cases.nth(i).check();
    await page.getByRole("button", { name: /continuer|j'accepte|commencer/i }).click();
    await page.waitForLoadState("domcontentloaded");
    await page.waitForTimeout(800);
  }
}

/**
 * On attend que l'écran soit POSÉ avant de le photographier : une image prise
 * sur « CHARGEMENT… » n'est pas un écran, et un zéro n'est pas une mesure.
 */
async function ouvrir(page: Page, chemin: string) {
  await page.goto(`${BASE}${chemin}`, { waitUntil: "domcontentloaded", timeout: 60_000 });
  await page.waitForFunction(() => !document.body.innerText.includes("CHARGEMENT"), null, { timeout: 30_000 });
  await page.waitForTimeout(700);
}

async function photographier(page: Page, nom: string, entier: boolean) {
  const chemin = path.join(DOSSIER, `${nom}.jpg`);
  // Les transitions de l'écran (le pli des travaux, la fiche qui s'ouvre)
  // durent 300 ms : on les laisse finir, sinon l'image les fige à moitié.
  await page.waitForTimeout(450);
  // **La barre du bas est fixe** (`AtlasBottomNav`) : une capture de la page
  // entière la peint là où était l'écran au moment de la prise, c'est-à-dire
  // au milieu de l'image, par-dessus la fiche. On la retire de ces captures-là
  // seulement ; les captures à la hauteur de l'écran la gardent à sa place.
  const sansLaBarre = entier
    ? await page.addStyleTag({ content: 'nav[aria-label="Navigation principale"] { visibility: hidden }' })
    : null;
  await page.screenshot({ path: chemin, type: "jpeg", quality: 92, fullPage: entier });
  // `addStyleTag` rend une poignée sur un Node, qui n'a pas `remove()` : on
  // passe par son parent, ce que tout Node sait faire.
  if (sansLaBarre) await sansLaBarre.evaluate((el) => el.parentNode?.removeChild(el));
  const defilement = await page.evaluate(() => Math.round(window.scrollY));
  dire(`${chemin}${entier ? " (page entière, sans la barre du bas)" : ` (écran, défilé de ${defilement} px)`}`);
  return chemin;
}

/** L'écran posé sur un élément : son bord haut à `marge` pixels du haut de l'écran. */
async function defilerJusquA(page: Page, selecteur: string, marge: number) {
  await page.locator(selecteur).first().evaluate((el, m) => {
    window.scrollTo(0, Math.max(0, el.getBoundingClientRect().top + window.scrollY - m));
  }, marge);
  await page.waitForTimeout(150);
}

/** Où se trouve un élément, en pixels de la PAGE (largeur 390), pour guider le doigt du film. */
async function repere(page: Page, selecteur: string, rang = 0): Promise<Repere> {
  const r = await page.locator(selecteur).nth(rang).evaluate((el) => {
    const b = el.getBoundingClientRect();
    return { x: b.left, y: b.top + window.scrollY, largeur: b.width, hauteur: b.height };
  });
  const arrondi = (n: number) => Math.round(n * 10) / 10;
  return {
    x: arrondi(r.x),
    y: arrondi(r.y),
    largeur: arrondi(r.largeur),
    hauteur: arrondi(r.hauteur),
    centre: { x: arrondi(r.x + r.largeur / 2), y: arrondi(r.y + r.hauteur / 2) },
  };
}

/** Le calendrier sur octobre 2026, quel que soit le mois d'aujourd'hui. */
async function allerAuMoisDuChantier(page: Page) {
  const titre = page.locator('[data-atlas="mois-titre"]');
  await titre.waitFor();
  const [annee, mois] = JOUR_DU_CHANTIER.split("-").map(Number);
  const voulu = new Intl.DateTimeFormat("fr-FR", { month: "long", year: "numeric", timeZone: "UTC" }).format(
    new Date(Date.UTC(annee, mois - 1, 1))
  );
  for (let essai = 0; essai < 24; essai++) {
    const lu = (await titre.innerText()).trim().toLowerCase();
    if (lu === voulu.toLowerCase()) return;
    const [nomDuMois, anneeLue] = lu.split(" ");
    const rangLu = Number(anneeLue) * 12 + moisDuNom(nomDuMois);
    const rangVoulu = annee * 12 + mois;
    await page.getByRole("button", { name: rangLu < rangVoulu ? "Mois suivant" : "Mois précédent" }).click();
    await page.waitForTimeout(400);
  }
  throw new Error(`le calendrier n'arrive pas sur ${voulu}`);
}

function moisDuNom(nom: string): number {
  const noms = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];
  return noms.indexOf(nom) + 1;
}

/** Le 13 touché : la carte de la journée s'ouvre sous sa semaine, avec le chantier. */
async function toucherLeJour(page: Page): Promise<string> {
  // `:visible` : le calendrier peut tenir plusieurs mois côte à côte pour le
  // balayage, et seule la case qu'il voit est celle qu'il touche.
  const case13 = page.locator(`[data-jour="${JOUR_DU_CHANTIER}"]:visible`).first();
  reperes.caseDu13 = await repere(page, `[data-jour="${JOUR_DU_CHANTIER}"]:visible`);
  await case13.click();
  const carte = page.locator(`[data-atlas="carte-jour"][data-jour="${JOUR_DU_CHANTIER}"]`);
  await carte.waitFor();
  const bloc = carte.locator('[data-atlas="bloc-chantier"]').first();
  await bloc.waitFor();
  const chantierId = await bloc.getAttribute("data-chantier");
  if (!chantierId) throw new Error("la carte du 13 ne porte aucun chantier");
  reperes.ligneDuChantier = await repere(page, '[data-atlas="carte-jour"] [data-atlas="nom-du-jour"]');
  return chantierId;
}

/** La fiche d'intervention s'ouvre en touchant le nom du chantier dans la carte. */
async function ouvrirLaFiche(page: Page) {
  await page.locator('[data-atlas="carte-jour"] [data-atlas="nom-du-jour"]').first().click();
  await page.locator('[data-atlas="feuille"]').waitFor();
  // « Lecture du devis… » le temps que les lignes arrivent : la fiche n'est
  // complète qu'avec le bandeau des travaux.
  await page.locator('[data-atlas="travaux-a-faire"]').waitFor({ timeout: 30_000 });
  reperes.maps = await repere(page, '[data-atlas="feuille"] [data-atlas="geste-de-la-fiche"]', 0);
  reperes.waze = await repere(page, '[data-atlas="feuille"] [data-atlas="geste-de-la-fiche"]', 1);
  reperes.copierLAdresse = await repere(page, '[data-atlas="feuille"] [data-atlas="geste-de-la-fiche"]', 2);
  reperes.appelerLeClient = await repere(page, '[data-atlas="feuille"] [data-atlas="geste-de-la-fiche"]', 3);
  if ((await page.locator('[data-atlas="ouvrir-fiche-de-securite"]').count()) > 0) {
    reperes.ficheDeSecurite = await repere(page, '[data-atlas="ouvrir-fiche-de-securite"]');
  }
  reperes.travauxAFaire = await repere(page, '[data-atlas="ouvrir-travaux"]');
  if ((await page.locator('[data-atlas="pdf-sans-prix"]').count()) > 0) {
    reperes.devisSansLesPrix = await repere(page, '[data-atlas="pdf-sans-prix"]');
  }
}

/** Le bandeau « Travaux à faire » déplié : les lignes du devis en cases, et le bouton du retour. */
async function deplierLesTravaux(page: Page) {
  await page.locator('[data-atlas="ouvrir-travaux"]').click();
  const cases = page.locator('[data-atlas="tache-du-retour"]');
  await page.waitForFunction(
    (n) => document.querySelectorAll('[data-atlas="tache-du-retour"]').length === n,
    LIGNES.length,
    { timeout: 30_000 }
  );
  await page.locator('[data-atlas="envoyer-le-retour"]').waitFor();
  const lesCases: Repere[] = [];
  for (let i = 0; i < (await cases.count()); i++) lesCases.push(await repere(page, '[data-atlas="tache-du-retour"]', i));
  reperes.cases = lesCases;
  reperes.envoyerLeRetour = await repere(page, '[data-atlas="envoyer-le-retour"]');
}

async function cocher(page: Page, rang: number) {
  const laCase = page.locator('[data-atlas="tache-du-retour"]').nth(rang);
  await laCase.click();
  await page.waitForFunction(
    (i) => document.querySelectorAll('[data-atlas="tache-du-retour"]')[i]?.getAttribute("aria-pressed") === "true",
    rang
  );
}

/**
 * Un PDF servi par l'application, rendu en image à 300 dpi, page 1.
 *
 * Demandé hors navigation, avec le cookie de session : c'est ce que fait la
 * visionneuse. Sans `pdftoppm`, on le dit et l'on garde le PDF.
 */
async function rendreLePdf(page: Page, chemin: string, nom: string) {
  const reponse = await page.request.get(`${BASE}${chemin}`);
  const type = reponse.headers()["content-type"] ?? "";
  if (reponse.status() !== 200 || !type.includes("application/pdf")) {
    throw new Error(`${chemin} ne rend pas un PDF (${reponse.status()}, ${type})`);
  }
  const pdf = path.join(tmpdir(), `${nom}.pdf`);
  writeFileSync(pdf, await reponse.body());
  try {
    execFileSync("pdftoppm", ["-jpeg", "-r", String(PDF_DPI), "-f", "1", "-l", "1", "-singlefile", "-jpegopt", "quality=92", pdf, path.join(tmpdir(), nom)]);
  } catch (e) {
    console.error(`⚠ ${nom} : pdftoppm n'a pas rendu le PDF (${e instanceof Error ? e.message.split("\n")[0] : e}). Le PDF est dans ${pdf}.`);
    return;
  }
  const image = path.join(DOSSIER, `${nom}.jpg`);
  renameSync(path.join(tmpdir(), `${nom}.jpg`), image);
  dire(`${image} (PDF, page 1 à ${PDF_DPI} dpi)`);
}

/** Le planning du 13, la fiche fermée puis ouverte, les cases cochées : la même suite pour le patron et pour un gars. */
async function serieDuPlanning(page: Page, noms: { planning: string; fiche: string }, complete: boolean) {
  reperes = {};
  reperesParCompte[noms.planning] = reperes;
  await ouvrir(page, "/planning");
  await allerAuMoisDuChantier(page);
  const chantierId = await toucherLeJour(page);
  // La carte s'ouvre sous la semaine du 13 : l'écran se pose sur le titre du
  // mois, et la carte tient dessous en entier, la case touchée au-dessus.
  await defilerJusquA(page, '[data-atlas="mois-titre"]', 28);
  await photographier(page, noms.planning, false);
  if (complete) await photographier(page, `${noms.planning}-entier`, true);

  await ouvrirLaFiche(page);
  if (complete) {
    await photographier(page, noms.fiche, true);
    await defilerJusquA(page, '[data-atlas="feuille"]', 12);
    await photographier(page, `${noms.fiche}-ecran`, false);
  }

  await deplierLesTravaux(page);
  if (complete) {
    await photographier(page, `${noms.fiche}-ouverte`, true);
    await cocher(page, 0);
    await cocher(page, 1);
    await photographier(page, `${noms.fiche}-cochee`, true);
  } else {
    await photographier(page, noms.fiche, true);
  }
  return chantierId;
}

async function avecUnePage(navigateur: Browser, fn: (page: Page) => Promise<void>) {
  const contexte = await navigateur.newContext(ECRAN_DU_FILM);
  const page = await contexte.newPage();
  const pannes: string[] = [];
  page.on("pageerror", (e) => pannes.push(`page : ${e.message.split("\n")[0]}`));
  page.on("response", (r) => {
    if (r.status() >= 500) pannes.push(`${r.status()} sur ${new URL(r.url()).pathname}`);
  });
  try {
    await fn(page);
  } finally {
    if (pannes.length > 0) console.error(`⚠ le serveur a signalé : ${[...new Set(pannes)].join(" · ")}`);
    await contexte.close();
  }
}

async function main() {
  const navigateur = await lancerNavigateur();
  try {
    if (serie === "editeur") {
      // « Je rédige à la main », sous le micro de la fiche client, ouvre
      // l'éditeur de lignes (/chantiers/<id>/devis-complet). Le film doit
      // montrer qu'on peut dicter OU rédiger (sa remarque du 5 octobre 2026) :
      // voici l'écran où l'on rédige, vide puis avec la première ligne tapée,
      // par les mêmes gestes que preparer-jeu-du-film.mts. Le devis de
      // démonstration, lui, est parti chez la cliente et ne se modifie plus :
      // son écran n'est plus un éditeur.
      await avecUnePage(navigateur, async (page) => {
        await seConnecter(page, COMPTE_DEMO);
        await ouvrir(page, "/chantiers/nouveau");
        await page.waitForSelector('[data-atlas="civilite-mme"]');
        await page.click('[data-atlas="civilite-mme"]');
        await page.getByLabel(/Nom du client/i).fill(CLIENTE.nom);
        await page.fill('input[placeholder="06 12 34 56 78"]', CLIENTE.telephone);
        await page.getByRole("combobox", { name: "Adresse du chantier" }).fill(CLIENTE.adresse);
        await page.keyboard.press("Escape");
        await page.click('[data-atlas="action-ecrire"]');
        await page.waitForURL(/\/chantiers\/[0-9a-f-]{36}\/devis-complet/, { timeout: 30_000 });
        await page.waitForSelector("text=Total TTC", { timeout: 60_000 });
        await page.getByLabel("Description 1").waitFor();
        await photographier(page, "devis-vide", false);
        const premiere = LIGNES[0];
        await page.getByLabel("Description 1").fill(premiere.libelle);
        await page.getByLabel("Description 1").blur();
        await page.getByLabel("Quantité 1").fill("1");
        await page.getByLabel("Quantité 1").blur();
        await page.getByLabel("Prix unitaire 1").fill(premiere.prix);
        await page.getByLabel("Prix unitaire 1").blur();
        await page.waitForTimeout(600);
        await photographier(page, "devis-redige", true);
        await photographier(page, "devis-redige-ecran", false);
      });
    } else if (serie === "planning") {
      await avecUnePage(navigateur, async (page) => {
        await seConnecter(page, COMPTE_DEMO);
        const chantierId = await serieDuPlanning(page, { planning: "planning-jour", fiche: "fiche-intervention" }, true);
        await rendreLePdf(page, `/api/chantiers/${chantierId}/feuille/pdf`, "feuille-sans-prix");
      });
      await avecUnePage(navigateur, async (page) => {
        await seConnecter(page, COMPTE_SALARIE);
        await serieDuPlanning(page, { planning: "planning-salarie", fiche: "fiche-intervention-salarie" }, false);
      });
    } else {
      await avecUnePage(navigateur, async (page) => {
        await seConnecter(page, COMPTE_DEMO);
        await ouvrir(page, "/termines");
        // Une ligne facturée est un bouton qui ouvre un volet, pas un lien :
        // c'est son `id` (« chantier-… ») qui dit le chantier, comme pour les
        // suites de cet écran.
        const ligne = page.locator('[data-atlas="ligne-terminee"]').filter({ hasText: CHANTIER_NOM }).first();
        await ligne.waitFor();
        const chantierId = (await ligne.getAttribute("id"))?.match(/^chantier-([0-9a-f-]{36})$/)?.[1];
        if (!chantierId) throw new Error(`« ${CHANTIER_NOM} » n'est pas dans Terminés, ou sa ligne ne dit pas son chantier`);
        await photographier(page, "termines-apres", false);

        await ouvrir(page, `/chantiers/${chantierId}/facture`);
        await photographier(page, "facture-emise", true);
        const lien = await page.locator('[data-atlas="voir-facture"]').first().getAttribute("href");
        const fichier = lien ? fichierDemandeALaVisionneuse(lien) : null;
        if (!fichier) throw new Error("l'écran de la facture ne mène pas à son PDF");
        await rendreLePdf(page, fichier, "facture-pdf");

        const periode = `annee=${PERIODE_TVA.annee}&t=${PERIODE_TVA.numero}`;
        await ouvrir(page, `/termines/tva?${periode}`);
        await photographier(page, "tva", true);
        await ouvrir(page, `/termines/tva/collectee?${periode}`);
        await photographier(page, "tva-collectee", true);
      });
    }
  } finally {
    await navigateur.close();
  }
  if (Object.keys(reperesParCompte).length > 0) {
    console.log(`\nRepères (pixels de l'application, largeur 390, y depuis le haut de la page) :`);
    console.log(JSON.stringify(reperesParCompte, null, 2));
  }
}

// Dit d'avance, plutôt qu'après dix captures : sans `pdftoppm`, les PDF
// resteront des PDF, et le script le signale au lieu de rendre une image vide.
if (!process.env.PATH?.split(":").some((d) => existsSync(path.join(d, "pdftoppm")))) {
  console.error("⚠ pdftoppm est absent : les PDF ne seront pas rendus en image.");
}

main().catch((e) => {
  console.error("❌", e instanceof Error ? e.message : e);
  process.exit(1);
});
