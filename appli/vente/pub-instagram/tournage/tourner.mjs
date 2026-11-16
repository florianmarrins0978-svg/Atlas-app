// LE TOURNAGE : le chantier Lemaire joué par les vrais boutons de l'appli, et
// filmé. Rien n'est dessiné : chaque image est une photo de l'écran tel que
// l'appli le peint.
//
//   bash appli/vente/pub-instagram/tournage/poser-la-scene.sh
//   node appli/vente/pub-instagram/tournage/tourner.mjs
//
// Les étapes se suivent et chacune laisse la base dans l'état que la suivante
// attend. `--depuis <étape>` reprend en route, sur une base déjà avancée.
//
// SANS CLÉ D'IA ICI, la dictée ne rend pas les lignes du devis. Le geste de la
// note vocale est donc filmé pour de vrai (micro simulé par le navigateur, le
// vrai chrono de l'appli), puis le devis est écrit à la main par les vrais
// boutons, comme pour le site de vente le 6 novembre 2026.
/* global document, window */
import { execFileSync } from "node:child_process";
import { ouvrir, seConnecter, attendrePose, BASE, SORTIE } from "./_atlas.mjs";
import { Prise, marquerLeDefilant } from "./_prise.mjs";

const HAUTEUR = 600;
const BASE_ADMIN = process.env.TOURNAGE_BASE ?? "postgresql://postgres@localhost:5432/atlas_test";
const ETAPES = ["decor", "ouverture", "micro", "devis", "envoi", "client", "planning", "facture", "termines"];
const depuis = process.argv.includes("--depuis") ? process.argv[process.argv.indexOf("--depuis") + 1] : ETAPES[0];
const seule = process.argv.includes("--seule");
if (!ETAPES.includes(depuis)) throw new Error(`étape inconnue : ${depuis} (${ETAPES.join(", ")})`);
const aJouer = (e) => (seule ? e === depuis : ETAPES.indexOf(e) >= ETAPES.indexOf(depuis));

const sql = (requete) => execFileSync("psql", [BASE_ADMIN, "-tAqc", requete], { encoding: "utf8" }).trim();

const LEMAIRE = { civilite: "mr", nom: "Lemaire", telephone: "0639981234", adresse: "12 allée des Charmilles, Valmorin" };
const LIGNES_LEMAIRE = [
  ["Arrachage de la haie de thuyas et évacuation", "12", "ml", "18"],
  ["Décompactage et amendement du sol", "15", "m²", "8,5"],
  ["Fourniture et plantation de vivaces", "30", "u", "9,5"],
  ["Paillage en écorce de pin", "15", "m²", "6"],
];

/** Figer l'horloge de la page : à partir d'ici, seul le tournage l'avance. */
async function figer(page) {
  const maintenant = await page.evaluate(() => Date.now());
  await page.clock.pauseAt(maintenant + 20);
}
async function relacher(page) {
  await page.evaluate(() => {
    for (const a of document.getAnimations()) {
      if (a.__prise && a.playState === "paused") a.play();
      delete a.__prise;
    }
  });
  await page.clock.resume();
}

/** Ouvrir la fiche client depuis l'accueil et la remplir. */
async function remplirLaFiche(page, client) {
  await page.locator(`[data-atlas="civilite-${client.civilite}"]`).click();
  await page.getByLabel("Nom du client").fill(client.nom);
  await page.getByLabel("Téléphone", { exact: true }).fill(client.telephone);
  await page.getByLabel("Adresse du chantier").fill(client.adresse);
  await page.locator('[data-atlas="canal-sms"]').click();
  await page.waitForTimeout(400);
}

/** Écrire un devis à la main, par les vrais champs. */
async function ecrireLeDevis(page, titre, lignes) {
  await page.waitForURL(/devis-complet/, { timeout: 20000 });
  await attendrePose(page, 1200);
  await page.locator('[data-atlas="titre-devis"]').fill(titre);
  for (let i = 0; i < lignes.length; i++) {
    const [designation, quantite, unite, prix] = lignes[i];
    if (!(await page.getByLabel(`Description ${i + 1}`).count())) {
      await page.getByRole("button", { name: /Ajouter une ligne/ }).click();
      await page.waitForTimeout(400);
    }
    await page.getByLabel(`Description ${i + 1}`).fill(designation);
    await page.getByLabel(`Quantité ${i + 1}`).fill(quantite);
    await page.getByLabel(`Unité ${i + 1}`).fill(unite);
    await page.getByLabel(`Prix unitaire ${i + 1}`).fill(prix);
    await page.waitForTimeout(250);
  }
  // Le devis s'enregistre tout seul, à la sortie de chaque champ : sans quitter
  // le dernier, son prix n'était pas gardé (un total à 754,20 € au lieu de
  // 862,20 €, vu sur la première prise).
  await page.locator('[data-atlas="titre-devis"]').focus();
  await page.waitForTimeout(2500);
}

/** « Créer un devis », jusqu'à ce que la fiche client soit là. */
async function ouvrirLaFiche(page) {
  const fiche = page.locator('[data-atlas="civilite-mr"]');
  for (let essai = 0; essai < 3; essai++) {
    await page.locator('[data-atlas="nouveau-chantier"]').click();
    if (await fiche.waitFor({ state: "visible", timeout: 5000 }).then(() => true, () => false)) {
      await page.waitForTimeout(900);
      return;
    }
  }
  throw new Error("la fiche client ne s'ouvre pas");
}

async function creerALaMain(page, client, titre, lignes) {
  await page.goto(`${BASE}/`, { waitUntil: "domcontentloaded" });
  await attendrePose(page, 1200);
  await ouvrirLaFiche(page);
  await remplirLaFiche(page, client);
  await page.locator('[data-atlas="action-ecrire"]').click();
  await ecrireLeDevis(page, titre, lignes);
}

async function envoyerLeDevis(page, jours) {
  await page.getByRole("button", { name: "Choisir la date" }).click();
  await page.waitForTimeout(1500);
  await choisirLesJours(page, jours);
  await page.getByRole("button", { name: "Envoyer le devis" }).click();
  // L'envoi ouvre aussi l'application de messages du téléphone (un lien sms:),
  // que ce navigateur refuse : on attend l'adresse, pas la fin d'un chargement.
  await page.waitForFunction(() => window.location.pathname === "/", null, { timeout: 20000 });
  await attendrePose(page, 800);
}

/**
 * Ne garder, dans la feuille d'envoi, que les jours voulus. L'appli en retient
 * un d'office (le premier jour libre) : un jour retenu porte data-etat="retenu".
 */
async function choisirLesJours(page, jours) {
  const voulus = jours.map((j) => `2026-11-${String(j).padStart(2, "0")}`);
  const retenus = await page.evaluate(() =>
    [...document.querySelectorAll('button[data-jour][data-etat="retenu"]')].map((b) => b.dataset.jour)
  );
  for (const j of retenus) {
    if (voulus.includes(j)) continue;
    await page.locator(`button[data-jour="${j}"]`).click();
    await page.waitForTimeout(300);
  }
  for (const j of voulus) {
    const bouton = page.locator(`button[data-jour="${j}"]`);
    if ((await bouton.getAttribute("data-etat")) === "retenu") continue;
    await bouton.click();
    await page.waitForTimeout(300);
  }
}

// ───────────────────────────────────────────────────────────────────────────

const patron = await ouvrir({ hauteur: HAUTEUR, session: false });
await seConnecter(patron.page, patron.contexte);
await patron.page.close();

/**
 * Une page neuve par étape. Celles qu'on filme portent l'horloge de
 * Playwright ; les autres non : posée sur une page qui vient d'envoyer un
 * devis (le lien sms: que ce navigateur refuse), elle ne laissait plus la fiche
 * client s'ouvrir.
 */
async function nouvellePage(contexte, { horloge = false } = {}) {
  const page = await contexte.newPage();
  page.setDefaultTimeout(20000);
  if (horloge) await page.clock.install();
  return page;
}

let page = null;
try {
  // ── Le décor : deux devis partis qui attendent leur réponse ──────────────
  if (aJouer("decor")) {
    page = await nouvellePage(patron.contexte);
    await creerALaMain(page, { civilite: "mme", nom: "Delmas", telephone: "0623456789", adresse: "8 rue des Glycines, Valmorin" }, "Taille des haies", [
      ["Taille de la haie de charmille", "40", "ml", "6,5"],
      ["Évacuation des déchets verts", "1", "u", "60"],
    ]);
    await envoyerLeDevis(page, [25]);
    await page.close();
    page = await nouvellePage(patron.contexte);
    await creerALaMain(page, { civilite: "mr", nom: "Perrin", telephone: "0634567891", adresse: "21 route du Lac, Valmorin" }, "Élagage du tilleul", [
      ["Élagage du tilleul, taille douce", "1", "u", "380"],
    ]);
    await envoyerLeDevis(page, [30]);
    await page.close();
    console.log("décor posé");
  }

  // ── 1. L'accueil, « Créer un devis », la fiche client qui monte ──────────
  if (aJouer("ouverture")) {
    page = await nouvellePage(patron.contexte, { horloge: true });
    await page.goto(`${BASE}/`, { waitUntil: "domcontentloaded" });
    await attendrePose(page, 1200);
    await figer(page);
    const prise = new Prise(page, "ouverture", SORTIE);
    await prise.depart(1.0);
    prise.repere("appui");
    await prise.appuyer(page.locator('[data-atlas="nouveau-chantier"]'));
    await prise.filmer(2.2);
    prise.repere("fiche");
    prise.tenir(0.6);
    prise.monter();
    await relacher(page);
    await page.close();
  }

  // ── 2. La note vocale : le micro, le vrai chrono, l'envoi ────────────────
  if (aJouer("micro")) {
    page = await nouvellePage(patron.contexte, { horloge: true });
    await page.goto(`${BASE}/`, { waitUntil: "domcontentloaded" });
    await attendrePose(page, 1200);
    await ouvrirLaFiche(page);
    await remplirLaFiche(page, LEMAIRE);
    const micro = page.getByRole("button", { name: "Dicter une note vocale" });
    const defilant = await marquerLeDefilant(micro, "fiche");
    await figer(page);
    const prise = new Prise(page, "micro", SORTIE);
    await prise.depart(0.7);
    if (defilant.trouve) {
      // Le micro monte dans le haut de l'écran, comme sous un pouce.
      const boite = await micro.boundingBox();
      const vers = Math.min(defilant.contenu - defilant.hauteur, defilant.haut + boite.y + boite.height / 2 - 250);
      prise.repere("defile");
      await prise.defiler('[data-prise="fiche"]', vers, 0.7);
    }
    prise.tenir(0.4);
    prise.repere("micro");
    await prise.appuyer(micro);
    await prise.filmer(5.4);
    prise.repere("envoyer");
    await prise.appuyer(page.locator('[data-atlas="dictee-envoyer"]'));
    await prise.filmer(0.5);
    prise.monter();
    await relacher(page);
    // Hors caméra : l'appli finit de ranger la note. Sans clé d'IA, sa dictée
    // d'essai ne rend pas notre devis : ce chantier-là sort de la scène, et le
    // devis de Lemaire s'écrit à la main à l'étape suivante.
    await page.getByText("Votre dictée").waitFor({ timeout: 30000 }).catch(() => {});
    await page.waitForTimeout(1500);
    await page.close();
    sql("UPDATE chantiers SET deleted_at = now() WHERE deleted_at IS NULL AND nom LIKE '%Lemaire%'; UPDATE clients SET deleted_at = now() WHERE deleted_at IS NULL AND nom = 'Lemaire';");
  }

  // ── 3. Le devis : la ligne dictée, puis le total ──────────────────────────
  let chantier = sql("SELECT id FROM chantiers WHERE deleted_at IS NULL AND nom LIKE '%Lemaire%' ORDER BY created_at DESC LIMIT 1");
  if (aJouer("devis")) {
    page = await nouvellePage(patron.contexte);
    await creerALaMain(page, LEMAIRE, "Création d'un massif", LIGNES_LEMAIRE);
    chantier = new URL(page.url()).pathname.split("/")[2];
    await page.close();

    page = await nouvellePage(patron.contexte, { horloge: true });
    await page.goto(`${BASE}/chantiers/${chantier}/devis-complet`, { waitUntil: "domcontentloaded" });
    await attendrePose(page, 1500);
    // Ce qu'on filme doit être ce qu'on a écrit : on relit le total à l'écran.
    if (!(await page.locator("body").innerText()).includes("862,20")) throw new Error("le devis relu ne fait pas 862,20 € TTC");
    const hautDe = async (cible) => (await cible.boundingBox()).y + (await page.evaluate(() => document.scrollingElement.scrollTop));
    const ligne1 = await hautDe(page.getByLabel("Description 1"));
    const totaux = await hautDe(page.getByText("Total HT", { exact: true }));
    await page.evaluate((y) => document.scrollingElement.scrollTo({ top: y, behavior: "instant" }), ligne1 - 150);
    await page.waitForTimeout(300);
    await figer(page);
    const prise = new Prise(page, "devis", SORTIE);
    await prise.depart(1.0);
    prise.repere("ligne");
    await prise.defiler(null, ligne1 - 46, 0.5);
    prise.tenir(1.6);
    prise.repere("defile");
    await prise.defiler(null, totaux - 120, 1.5);
    prise.repere("total");
    prise.tenir(1.8);
    prise.monter();

    // ── 4. L'envoi : la date proposée, « Envoyer le devis » ────────────────
    const envoi = new Prise(page, "envoi", SORTIE);
    await envoi.depart(0.5);
    envoi.repere("choisir");
    await envoi.appuyer(page.getByRole("button", { name: "Choisir la date" }));
    await envoi.attendre(() => page.locator('button[data-jour="2026-11-16"]').isVisible());
    await envoi.filmer(1.0);
    const jour = page.locator('button[data-jour="2026-11-16"]');
    const feuille = await marquerLeDefilant(jour, "feuille");
    if (feuille.trouve) {
      const boite = await jour.boundingBox();
      const vers = Math.max(0, Math.min(feuille.contenu - feuille.hauteur, feuille.haut + boite.y - 230));
      await envoi.defiler('[data-prise="feuille"]', vers, 0.6);
    }
    envoi.tenir(0.5);
    envoi.repere("jour");
    await envoi.appuyer(jour);
    await envoi.filmer(0.6);
    envoi.tenir(0.7);
    envoi.repere("envoyer");
    await envoi.appuyer(page.getByRole("button", { name: "Envoyer le devis" }));
    await envoi.filmer(0.4);
    await envoi.attendre(() => page.evaluate(() => window.location.pathname === "/"));
    await envoi.attendre(() => page.getByText("Devis envoyé, sans réponse").first().isVisible());
    await envoi.filmer(0.8);
    envoi.repere("parti");
    envoi.tenir(1.2);
    envoi.monter();
    await relacher(page);
    await page.close();
  }

  // ── 5. Chez le client : sa date, sa case, son accord ─────────────────────
  if (aJouer("client")) {
    const jeton = sql(`SELECT jeton FROM envois_devis WHERE chantier_id = '${chantier}' ORDER BY envoye_at DESC LIMIT 1`);
    const client = await ouvrir({ hauteur: HAUTEUR, session: false });
    const p = client.page;
    p.setDefaultTimeout(20000);
    await p.clock.install();
    await p.goto(`${BASE}/devis/${jeton}`, { waitUntil: "domcontentloaded" });
    await attendrePose(p, 1500);
    await figer(p);
    const prise = new Prise(p, "client", SORTIE);
    await prise.depart(1.6);
    prise.repere("date");
    await prise.appuyer(p.getByLabel("le lundi 16 novembre"));
    await prise.filmer(0.6);
    prise.tenir(0.5);
    const caseAnticipee = p.locator('input[name="demarrageAnticipe"]');
    const boite = await caseAnticipee.boundingBox();
    prise.repere("defile");
    await prise.defiler(null, Math.max(0, boite.y - 215), 0.6);
    prise.tenir(0.3);
    prise.repere("case");
    await prise.appuyer(caseAnticipee);
    await prise.filmer(0.5);
    prise.tenir(0.5);
    prise.repere("accord");
    await prise.appuyer(p.getByRole("button", { name: /J'accepte ce devis/ }));
    await prise.filmer(0.3);
    await prise.attendre(() => p.getByText("C'est noté").isVisible());
    await prise.filmer(1.0);
    prise.repere("note");
    prise.tenir(1.6);
    prise.monter();
    await relacher(p);
    await client.navigateur.close();
  }

  // ── 6. Chez l'artisan : « Devis accepté », puis le planning ───────────────
  if (aJouer("planning")) {
    page = await nouvellePage(patron.contexte, { horloge: true });
    await page.goto(`${BASE}/`, { waitUntil: "domcontentloaded" });
    await attendrePose(page, 1500);
    await figer(page);
    const prise = new Prise(page, "planning", SORTIE);
    await prise.depart(0.5);
    const carte = await page.getByText("Devis accepté").first().boundingBox();
    await prise.defiler(null, Math.max(0, carte.y - 130), 0.6);
    prise.repere("carte");
    prise.tenir(1.6);
    prise.repere("onglet");
    await prise.appuyer(page.getByRole("link", { name: "PLANNING" }));
    await prise.filmer(0.3);
    await prise.attendre(() => page.evaluate(() => window.location.pathname === "/planning"));
    await prise.attendre(() => page.locator('button[aria-label^="16 novembre"]').first().isVisible());
    await prise.filmer(0.8);
    const jour = await page.locator('button[aria-label^="16 novembre"]').first().boundingBox();
    const haut = await page.evaluate(() => document.scrollingElement.scrollTop);
    await prise.defiler(null, haut + jour.y - 215, 0.6);
    prise.repere("mois");
    prise.tenir(1.6);
    const ligne = await page.getByText("Lundi 16 novembre").first().boundingBox();
    const haut2 = await page.evaluate(() => document.scrollingElement.scrollTop);
    prise.repere("defile");
    await prise.defiler(null, haut2 + ligne.y - 90, 0.9);
    prise.repere("jour");
    prise.tenir(1.6);
    prise.monter();
    await relacher(page);
    await page.close();
  }

  // ── 7. La facture : elle reprend le devis ────────────────────────────────
  if (aJouer("facture")) {
    page = await nouvellePage(patron.contexte, { horloge: true });
    await page.goto(`${BASE}/chantiers/${chantier}/facture`, { waitUntil: "domcontentloaded" });
    await attendrePose(page, 1500);
    await figer(page);
    const prise = new Prise(page, "facture", SORTIE);
    await prise.depart(1.0);
    prise.repere("creer");
    await prise.appuyer(page.getByRole("button", { name: "Créer la facture" }));
    await prise.filmer(0.3);
    await prise.attendre(() => page.getByText("Reprise du devis", { exact: false }).first().isVisible());
    await prise.filmer(0.8);
    prise.repere("facture");
    prise.tenir(1.2);
    const hautDe = async (cible) => (await cible.boundingBox()).y + (await page.evaluate(() => document.scrollingElement.scrollTop));
    const reprise = await hautDe(page.getByText("Reprise du devis", { exact: false }).first());
    prise.repere("defile-lignes");
    await prise.defiler(null, reprise - 60, 0.8);
    prise.repere("lignes");
    prise.tenir(1.6);
    const total = await hautDe(page.getByText("Total TTC", { exact: false }).first());
    prise.repere("defile-total");
    await prise.defiler(null, total - 150, 1.0);
    prise.repere("total");
    prise.tenir(1.6);
    const acquittee = page.locator('[data-atlas="facture-acquittee"]');
    await prise.defiler(null, (await hautDe(acquittee)) - 230, 0.7);
    prise.tenir(0.4);
    prise.repere("acquittee");
    await prise.appuyer(acquittee);
    await prise.filmer(0.4);
    await prise.attendre(() => page.getByText("Acquittée le", { exact: false }).first().isVisible());
    await prise.filmer(0.6);
    prise.tenir(0.6);
    const envoyer = page.locator('[data-atlas="envoyer-la-facture"]');
    await prise.defiler(null, (await hautDe(envoyer)) - 250, 0.7);
    prise.tenir(0.4);
    prise.repere("envoyer");
    await prise.appuyer(envoyer);
    await prise.filmer(0.3);
    await prise.attendre(() => page.getByText("Envoyée le", { exact: false }).first().isVisible());
    await prise.filmer(0.8);
    prise.repere("envoyee");
    prise.tenir(1.0);
    prise.monter();
    await relacher(page);
    await page.close();
  }

  // ── 8. Terminés : la TVA du mois, et le dossier du comptable ─────────────
  if (aJouer("termines")) {
    // Une photo très fine plutôt qu'un film : rien ne bouge sur cet écran, et
    // le montage fait un gros plan sur ses deux cartes. À trois pixels par
    // point, il serait flou.
    const net = await ouvrir({ hauteur: HAUTEUR, dpr: 5 });
    await net.page.goto(`${BASE}/termines`, { waitUntil: "domcontentloaded" });
    await attendrePose(net.page, 1500);
    const texte = await net.page.locator("body").innerText();
    if (!texte.includes("143,70") || !texte.includes("Tout est justifié")) {
      throw new Error("Terminés ne montre pas la TVA de 143,70 € et « Tout est justifié »");
    }
    await net.page.screenshot({ path: `${SORTIE}/termines.png` });
    await net.navigateur.close();
    console.log("📷 termines.png");
  }
} catch (e) {
  console.error("ERREUR", e.message.split("\n").slice(0, 10).join("\n"));
  if (page && !page.isClosed()) await page.screenshot({ path: `${SORTIE}/erreur.png` }).catch(() => {});
  process.exitCode = 1;
}
if (patron.pannes.length) console.log("le serveur a signalé :", [...new Set(patron.pannes)].join(", "));
await patron.navigateur.close();
