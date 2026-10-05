// ═══════════════════════════════════════════════════════════════════════════
// LE JEU DE DÉMONSTRATION DU FILM DE PROMOTION, reconstruit à l'identique
// ═══════════════════════════════════════════════════════════════════════════
//
// Tout ce qui s'affiche dans le téléphone du film doit être une capture réelle
// de l'application servie. Les premières captures (appli/video-promo/film/) ont
// été prises sur un jeu qui n'était écrit nulle part : ce script le refait, à
// la main du patron, pour qu'on puisse reprendre les captures manquantes sans
// jamais retoucher un montant.
//
//   npx tsx scripts/preparer-jeu-du-film.mts              → jusqu'au planning
//   npx tsx scripts/preparer-jeu-du-film.mts --facturer   → puis la facture
//
// Deux étapes, et c'est obligé : un chantier terminé QUITTE le planning
// (`rangement`, src/lib/onglet-chantier.ts). Les captures du planning et de la
// fiche d'intervention se prennent donc entre les deux appels
// (`scripts/capturer-ecrans-du-film.mts`).
//
// Ce qu'il faut autour : le serveur qui tourne sur ATLAS_ADRESSE (ou
// localhost:3000), et l'environnement des suites navigateur, parce que le
// script lit la base pour vérifier ce que l'écran a enregistré :
//   DATABASE_URL=postgresql://postgres@localhost:5432/atlas_test
//   AUTH_SECRET=ci-secret-not-a-real-production-value-000000000000
//
// **Les gestes du patron se jouent dans un vrai navigateur** : la fiche client,
// les lignes du devis, « Choisir la date », l'envoi, et la réponse de la
// cliente sur sa page. Ce qu'aucun écran ne permet (nommer un chantier, remettre
// un compteur, dater une facture à la fin du chantier) passe par les dépôts
// sous `withEntreprise`, ou par une écriture directe nommée ici, avec sa raison.
// ═══════════════════════════════════════════════════════════════════════════
import { execFileSync } from "node:child_process";
import { mkdirSync, renameSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { devices, type Page } from "playwright";
import { fermerPool, pool } from "../src/server/db/client";
import { garderSeed, phraseDeRefus } from "../src/lib/garde-seed";
import type { Ctx } from "../src/server/repositories/context";
import { mettreAJourEntreprise } from "../src/server/repositories/entreprises";
import { effacerClient } from "../src/server/repositories/donnees-client";
import { ecrireReglagesRappels } from "../src/server/repositories/rappels";
import { nommerEquipe } from "../src/server/repositories/equipes";
import { basculerEquipeDuChantier } from "../src/server/repositories/chantiers";
import { donnerUnAcces, listerAcces } from "../src/server/repositories/membres-entreprise";
import { documentsAAccepter, enregistrerAcceptations } from "../src/server/repositories/documents-legaux";
import { emettreFacture, terminerChantier } from "../src/server/repositories/factures";
import { compterPaiements, noterPaiement } from "../src/server/repositories/paiements-facture";
import { lancerNavigateur } from "./e2e-browser";
import { creerPuisFiche } from "./_creer-chantier-e2e";
import { ACCUEIL_EXACT, ADRESSE } from "./_adresse";

// Ce que le film montre, mot pour mot, vit dans `_jeu-du-film.ts` : la capture
// et la préparation lisent les mêmes valeurs, et rien ici n'est inventé.
import {
  ADRESSES_DU_SEED,
  CHANTIER_NOM,
  CLIENTE,
  COMPTE_DEMO,
  COMPTE_SALARIE,
  ENTREPRISE,
  FIN_DU_CHANTIER,
  JOUR_DU_CHANTIER,
  LIGNES,
  NUMERO_DEVIS,
  PERIODE_TVA,
  REGLEMENT,
  SALARIES,
  TOTAUX,
} from "./_jeu-du-film";

const BASE = ADRESSE;

// ─── La garde, avant la moindre écriture ───────────────────────────────────
// Le script efface un client de démonstration et remet un compteur : la même
// garde que le seed, pour les mêmes raisons (`src/lib/garde-seed.ts`).
const verdict = garderSeed({
  databaseUrl: process.env.DATABASE_URL,
  nodeEnv: process.env.NODE_ENV,
  forcage: process.env.ATLAS_SEED_FORCER,
  motDePasseDemo: process.env.ATLAS_MDP_DEMO,
});
if (!verdict.ok) {
  console.error(phraseDeRefus(verdict));
  process.exit(1);
}

const facturer = process.argv.includes("--facturer");

// ─── Les captures qui ne se prennent qu'EN CHEMIN ──────────────────────────
// Le devis envoyé, la page de la cliente avant et après son accord, l'accueil
// « Devis accepté » : chacun n'existe qu'un instant du jeu, et le rejouer coûte
// tout le jeu. `--capturer` les photographie au passage, à l'échelle des
// premières captures (iPhone 13, 390 × 844 à l'échelle 3, JPEG à 92).
// `capturer-ecrans-du-film.mts` prend, lui, ce qui se prend à tout moment.
const capturer = process.argv.includes("--capturer");
// `--accueil` : reprendre la seule capture de l'accueil d'avant, sans rejouer le jeu.
const seulementLAccueil = process.argv.includes("--accueil");
// Dans recit/ : les captures du film récit, que le film nerveuse ne partage pas.
const DOSSIER_FILM = "appli/video-promo/film/recit";
const ECRAN_DU_FILM = { ...devices["iPhone 13"], viewport: { width: 390, height: 844 } };
const reperesPris: Record<string, unknown> = {};
if (capturer) mkdirSync(path.join(DOSSIER_FILM, "dictee"), { recursive: true });

async function photographier(page: Page, nom: string, entier = false) {
  if (!capturer) return;
  await page.waitForTimeout(500);
  // L'indicateur du serveur de développement se peint dans le coin : il n'est
  // pas dans l'application que le patron ouvre.
  await page.addStyleTag({ content: "nextjs-portal { display: none !important }" });
  // Une page entière peint chaque élément fixe là où l'écran l'avait au moment
  // de la prise, au milieu de l'image : la barre du bas, « Choisir la date ».
  const fixes = entier
    ? await page.evaluate(() => {
        const marques: string[] = [];
        document.querySelectorAll<HTMLElement>("body *").forEach((el, i) => {
          const position = getComputedStyle(el).position;
          if (position === "fixed" || position === "sticky") {
            el.setAttribute("data-film-fixe", String(i));
            el.style.visibility = "hidden";
            marques.push(String(i));
          }
        });
        return marques;
      })
    : [];
  await page.screenshot({ path: path.join(DOSSIER_FILM, `${nom}.jpg`), type: "jpeg", quality: 92, fullPage: entier });
  if (fixes.length > 0) {
    await page.evaluate(() => {
      document.querySelectorAll<HTMLElement>("[data-film-fixe]").forEach((el) => {
        el.style.visibility = "";
        el.removeAttribute("data-film-fixe");
      });
    });
  }
  dire(`capture ${nom}.jpg${entier ? " (page entière)" : ""}`);
}

async function reperer(page: Page, selecteur: string) {
  return page.locator(selecteur).first().evaluate((el) => {
    const b = el.getBoundingClientRect();
    return { x: Math.round(b.left * 10) / 10, y: Math.round((b.top + window.scrollY) * 10) / 10, largeur: Math.round(b.width * 10) / 10, hauteur: Math.round(b.height * 10) / 10 };
  });
}

/** Un PDF servi par l'application, rendu à 300 dpi, page 1 : ce que la cliente télécharge. */
async function rendreLePdf(page: Page, chemin: string, nom: string) {
  if (!capturer) return;
  const reponse = await page.request.get(`${BASE}${chemin}`);
  if (reponse.status() !== 200 || !(reponse.headers()["content-type"] ?? "").includes("application/pdf")) {
    throw new Error(`${chemin} ne rend pas un PDF (${reponse.status()})`);
  }
  const pdf = path.join(tmpdir(), `${nom}.pdf`);
  writeFileSync(pdf, await reponse.body());
  execFileSync("pdftoppm", ["-jpeg", "-r", "300", "-f", "1", "-l", "1", "-singlefile", "-jpegopt", "quality=92", pdf, path.join(tmpdir(), nom)]);
  renameSync(path.join(tmpdir(), `${nom}.jpg`), path.join(DOSSIER_FILM, `${nom}.jpg`));
  dire(`capture ${nom}.jpg (PDF, page 1)`);
}

function dire(message: string) {
  console.log(`→ ${message}`);
}

/**
 * Relit la base jusqu'à ce qu'elle dise ce qu'on attend, au lieu d'attendre une
 * durée : un champ rend la main dès le doigt levé et laisse l'enregistrement
 * partir derrière lui (`test-devis-complet-e2e.ts`, même remède).
 */
async function attendreEnBase<T>(quoi: string, lire: () => Promise<T>, pret: (v: T) => boolean): Promise<T> {
  let valeur = await lire();
  for (let essai = 1; essai <= 12 && !pret(valeur); essai++) {
    await new Promise((r) => setTimeout(r, essai * 400));
    valeur = await lire();
  }
  if (!pret(valeur)) throw new Error(`${quoi} : la base ne porte pas ce que l'écran devait enregistrer`);
  return valeur;
}

/** Le patron de démonstration, lu en base : le script se branche sur le jeu servi. */
async function contexteDuPatron(): Promise<Ctx> {
  const { rows } = await pool.query<{ u: string; e: string }>(
    `SELECT me.utilisateur_id AS u, me.entreprise_id AS e
       FROM membres_entreprise me
       JOIN users usr ON usr.id = me.utilisateur_id
      WHERE usr.email = 'demo@atlas.local' AND me.role = 'proprietaire'
      LIMIT 1`
  );
  if (!rows[0]) throw new Error("le compte de démonstration est absent : jouer d'abord npm run db:seed");
  return { utilisateurId: rows[0].u, entrepriseId: rows[0].e };
}

type EtatDuFilm = {
  id: string;
  devis_id: string | null;
  devis_statut: string | null;
  jeton: string | null;
  reponse: string | null;
  date_planifiee: string | null;
};

/**
 * Le chantier du film et où il en est, s'il existe déjà : ce script se rejoue,
 * et reprend là où le passage d'avant s'est arrêté plutôt que de créer un
 * second chantier (le numéro 2026-000001 n'existe qu'une fois).
 */
async function chantierDuFilm(ctx: Ctx): Promise<EtatDuFilm | null> {
  const { rows } = await pool.query<EtatDuFilm>(
    `SELECT c.id, d.id AS devis_id, d.statut AS devis_statut, e.jeton, e.reponse, c.date_planifiee::text
       FROM chantiers c
       LEFT JOIN devis d ON d.chantier_id = c.id AND d.numero_commercial = $3
       LEFT JOIN LATERAL (
         SELECT jeton, reponse FROM envois_devis WHERE chantier_id = c.id ORDER BY envoye_at DESC LIMIT 1
       ) e ON true
      WHERE c.entreprise_id = $1 AND c.nom = $2 AND c.deleted_at IS NULL
      ORDER BY c.created_at DESC LIMIT 1`,
    [ctx.entrepriseId, CHANTIER_NOM, NUMERO_DEVIS]
  );
  return rows[0] ?? null;
}

/**
 * Une écriture directe, dans le contexte d'isolation : les tables sont sous
 * FORCE RLS, et sans `app.entreprise_id` une mise à jour touche zéro ligne sans
 * un mot (`.claude/rules/migrations.md`). On compte donc ce qui a été touché.
 */
async function ecrireSousContexte(ctx: Ctx, requete: string, valeurs: unknown[], attendu: number) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("SELECT set_config('app.entreprise_id', $1, true)", [ctx.entrepriseId]);
    const r = await client.query(requete, valeurs);
    if ((r.rowCount ?? 0) !== attendu) {
      throw new Error(`écriture directe : ${r.rowCount ?? 0} ligne(s) touchée(s), ${attendu} attendue(s)\n${requete}`);
    }
    await client.query("COMMIT");
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}

async function seConnecter(page: Page) {
  await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
  await page.fill('input[name="email"]', COMPTE_DEMO.email);
  await page.fill('input[name="password"]', COMPTE_DEMO.motDePasse);
  await page.click('button[type="submit"]');
  await page.waitForURL(ACCUEIL_EXACT, { timeout: 60_000 });
}

/**
 * Libère le n° 2026-000001.
 *
 * Le seed le donne au devis de « Reprise de toiture », déjà envoyé, donc
 * immuable : on ne le renumérote pas, on efface SON client par la porte que
 * l'application ouvre pour cela (`effacerClient`, migration 0068). Un devis
 * envoyé sans facture émise n'a rien à conserver ; le chantier part avec lui.
 * Puis le compteur repart à 1 : aucun écran ne le permet, et c'est voulu.
 */
async function libererLePremierNumero(ctx: Ctx) {
  const { rows } = await pool.query<{ id: string; client_id: string | null; chantier_id: string; nom: string }>(
    `SELECT d.id, c.client_id, c.id AS chantier_id, c.nom
       FROM devis d JOIN chantiers c ON c.id = d.chantier_id
      WHERE d.entreprise_id = $1 AND d.numero_commercial = $2`,
    [ctx.entrepriseId, NUMERO_DEVIS]
  );
  for (const occupant of rows) {
    if (!occupant.client_id) {
      throw new Error(`le devis ${NUMERO_DEVIS} appartient à « ${occupant.nom} », sans client : rien ne permet de l'effacer proprement`);
    }
    const rapport = await effacerClient(ctx, occupant.client_id);
    dire(`client de « ${occupant.nom} » effacé (${rapport?.supprimes ?? 0} lignes), le n° ${NUMERO_DEVIS} est libre`);
  }
  const reste = await pool.query(`SELECT 1 FROM devis WHERE entreprise_id = $1 AND numero_commercial = $2`, [
    ctx.entrepriseId,
    NUMERO_DEVIS,
  ]);
  if ((reste.rowCount ?? 0) > 0) throw new Error(`le n° ${NUMERO_DEVIS} est toujours pris`);
  await ecrireSousContexte(
    ctx,
    `UPDATE entreprise_compteurs SET prochain_numero_devis = 1, annee_devis = 2026 WHERE entreprise_id = $1`,
    [ctx.entrepriseId],
    1
  );
}

/**
 * « Devis en attente depuis N jours » : le seed date ses chantiers de la fin
 * juillet, et le compte grossit chaque jour (62 jours sur la première capture,
 * 75 un mois plus tard). La carte de l'accueil montre le plus ancien : le film
 * montre trois jours, la valeur d'un patron à jour. Les chantiers du seed sont
 * donc ramenés sur les trois derniers jours, dans leur ordre. Aucun écran ne
 * date un chantier : écriture directe, dans le contexte d'isolation.
 */
async function rajeunirLeRappel(ctx: Ctx) {
  const { rows } = await pool.query<{ id: string }>(
    `SELECT id FROM chantiers WHERE entreprise_id = $1 AND nom <> $2 AND deleted_at IS NULL AND devis_envoye_at IS NULL ORDER BY created_at, id`,
    [ctx.entrepriseId, CHANTIER_NOM]
  );
  for (const [rang, { id }] of rows.entries()) {
    const jours = Math.max(3 - rang, 0);
    const depuis = new Date(Date.now() - jours * 86_400_000 - 60_000 * rang);
    await ecrireSousContexte(ctx, `UPDATE chantiers SET created_at = $2, updated_at = $2 WHERE id = $1`, [id, depuis], 1);
  }
  for (const [nom, adresse] of Object.entries(ADRESSES_DU_SEED)) {
    await ecrireSousContexte(
      ctx,
      `UPDATE chantiers SET adresse_chantier = $3 WHERE entreprise_id = $1 AND nom = $2`,
      [ctx.entrepriseId, nom, adresse],
      1
    );
  }
  // Le rappel « chantier sans devis » part à quatre jours par défaut. Trois est
  // un réglage que Réglages offre (de 1 à 90), pas une valeur forcée.
  await ecrireReglagesRappels(ctx, { chantierSansDevisJours: 3 });
  dire(`${rows.length} chantiers du seed sans devis ramenés sur les trois derniers jours, rappel réglé à trois jours`);
}

/**
 * La fiche client, remplie comme le patron la remplit, puis « Je rédige mon
 * devis ». Elle s'ouvre depuis l'accueil, comme chez lui : la fiche est une
 * feuille posée sur l'accueil, et c'est ce que le film montre.
 */
async function creerLeChantier(page: Page): Promise<string> {
  await page.goto(`${BASE}/`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector("text=Créer un devis");
  await photographier(page, "accueil-avant");
  await page.getByText("Créer un devis").first().click();
  await page.waitForSelector('[data-atlas="civilite-mme"]');
  await page.click('[data-atlas="civilite-mme"]');
  await page.getByLabel(/Nom du client/i).fill(CLIENTE.nom);
  await page.fill('input[placeholder="06 12 34 56 78"]', CLIENTE.telephone);
  const adresse = page.getByRole("combobox", { name: "Adresse du chantier" });
  await adresse.fill(CLIENTE.adresse);
  // La liste des adresses proposées se referme en quittant le champ. Échap
  // fermerait la feuille entière, et le brouillon partirait au classement.
  await adresse.blur();
  await page.waitForTimeout(600);
  await photographier(page, "fiche-reconnue");
  if (capturer) {
    reperesPris.ficheClient = {
      micro: await reperer(page, '[aria-label="Dicter une note vocale"]'),
      jeRedige: await reperer(page, '[data-atlas="action-ecrire"]'),
    };
    // L'enregistrement, tel qu'il s'ouvre : on jette la note aussitôt, rien
    // ne part. Le micro est celui, fictif, que le navigateur du film simule.
    await page.click('[aria-label="Dicter une note vocale"]');
    await page.waitForSelector('[data-atlas="dictee-jeter"]');
    await photographier(page, "dictee/enregistre");
    await page.click('[data-atlas="dictee-jeter"]');
    await page.waitForSelector('[data-atlas="action-ecrire"]');
    await page.waitForTimeout(400);
  }
  return creerPuisFiche(page);
}

/** Ce que l'écran du devis a enregistré : il écrit `lignes_prix`, le devis s'en resert à l'envoi. */
async function lignesEnregistrees(chantierId: string) {
  return (
    await pool.query<{ libelle: string; montant: string }>(
      `SELECT libelle, montant FROM lignes_prix WHERE chantier_id = $1 ORDER BY ordre`,
      [chantierId]
    )
  ).rows;
}

function lignesConformes(rows: { libelle: string; montant: string }[]) {
  return rows.length === LIGNES.length && rows.every((r, i) => r.libelle === LIGNES[i].libelle && r.montant === LIGNES[i].montant);
}

/** Les trois lignes, tapées une à une sur l'écran du devis. */
async function ecrireLesLignes(page: Page, chantierId: string) {
  if (lignesConformes(await lignesEnregistrees(chantierId))) {
    dire("les trois lignes du devis sont déjà écrites");
    return;
  }
  await page.goto(`${BASE}/chantiers/${chantierId}/devis-complet`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector("text=Total TTC", { timeout: 60_000 });
  await photographier(page, "devis-vide");
  for (const [i, ligne] of LIGNES.entries()) {
    const rang = i + 1;
    if ((await page.getByLabel(`Description ${rang}`).count()) === 0) {
      await page.click("text=+ Ajouter une ligne");
      await page.getByLabel(`Description ${rang}`).waitFor();
    }
    await page.getByLabel(`Description ${rang}`).fill(ligne.libelle);
    await page.getByLabel(`Description ${rang}`).blur();
    await page.getByLabel(`Quantité ${rang}`).fill("1");
    await page.getByLabel(`Quantité ${rang}`).blur();
    await page.getByLabel(`Prix unitaire ${rang}`).fill(ligne.prix);
    await page.getByLabel(`Prix unitaire ${rang}`).blur();
    await page.waitForTimeout(600);
    if (i === 0) {
      // Taper la ligne a fait défiler la page : l'écran se reprend du haut.
      await page.evaluate(() => window.scrollTo(0, 0));
      await photographier(page, "devis-redige", true);
      await photographier(page, "devis-redige-ecran");
    }
  }
  await attendreEnBase("les lignes du devis", () => lignesEnregistrees(chantierId), lignesConformes);
  await page.evaluate(() => window.scrollTo(0, 0));
  if (capturer) {
    // Ce que le devis sait faire, en pixels de la page : le film y désigne chaque lien.
    const lien = (nom: string) => reperer(page, `text=${nom}`);
    reperesPris.devis = {
      ajouterUneLigne: await lien("+ Ajouter une ligne"),
      ajouterUneTva: await lien("+ Ajouter une TVA"),
      mainDOeuvre: await lien("+ Main d’œuvre"),
      ajouterUnAcompte: await lien("+ Ajouter un acompte"),
      remise: await lien("+ Remise"),
      totalTtc: await lien("Total TTC"),
      description1: await reperer(page, '[aria-label="Description 1"]'),
      description2: await reperer(page, '[aria-label="Description 2"]'),
    };
  }
  await photographier(page, "devis-rempli", true);
  await photographier(page, "devis-rempli-ecran");
  dire(`${LIGNES.length} lignes écrites sur le devis`);
}

/** « Choisir la date », le 13 touché sur le calendrier, « Envoyer le devis ». */
async function envoyerLeDevis(page: Page, chantierId: string): Promise<string> {
  // Rouvrir l'écran du devis, c'est ce qui reporte les lignes sur le brouillon
  // (`getOuCreerDevisBrouillon`) : c'est lui, et non les lignes de prix, que
  // l'envoi fige en PDF.
  await page.goto(`${BASE}/chantiers/${chantierId}/devis-complet`, { waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: "Choisir la date" }).click();
  await page.waitForSelector('[data-atlas="invite-dates"]');
  await page.click(`[data-jour="${JOUR_DU_CHANTIER}"]`);
  await page.waitForSelector('[data-atlas="proposition-1"]');
  await photographier(page, "date-proposee");
  await page.getByRole("button", { name: "Envoyer le devis" }).click();
  // L'envoi ramène à l'accueil chez le patron ; sur une adresse locale, le lien
  // SMS ne peut pas se composer et l'écran dépose sur l'export du chantier
  // (`ouvrirLaMessagerie`, motif « adresse-locale »). Les deux disent que le
  // devis est parti.
  await page.waitForURL((url) => ACCUEIL_EXACT.test(url.toString()) || /\/export$/.test(url.pathname), { timeout: 60_000 });

  const envoi = await attendreEnBase(
    "l'envoi du devis",
    async () =>
      (
        await pool.query<{ jeton: string; dates: string[]; statut: string; numero: string; total_ht: string; total_tva: string; total_ttc: string; lignes: number }>(
          `SELECT e.jeton, e.dates_proposees::text[] AS dates, d.statut, d.numero_commercial AS numero,
                  d.total_ht, d.total_tva, d.total_ttc,
                  (SELECT count(*)::int FROM lignes_devis l WHERE l.devis_id = d.id) AS lignes
             FROM envois_devis e JOIN devis d ON d.id = e.devis_id
            WHERE e.chantier_id = $1 ORDER BY e.envoye_at DESC LIMIT 1`,
          [chantierId]
        )
      ).rows[0],
    (r) => Boolean(r) && r.statut === "envoye" && r.dates.includes(JOUR_DU_CHANTIER)
  );
  // Ce que le PDF archivé porte, au centime : le film ne retouche rien.
  if (envoi.numero !== NUMERO_DEVIS) throw new Error(`le devis parti porte le n° ${envoi.numero}, et non ${NUMERO_DEVIS}`);
  if (envoi.lignes !== LIGNES.length || envoi.total_ht !== TOTAUX.ht || envoi.total_tva !== TOTAUX.tva || envoi.total_ttc !== TOTAUX.ttc) {
    throw new Error(
      `le devis parti porte ${envoi.lignes} lignes, ${envoi.total_ht} HT, ${envoi.total_tva} de TVA, ${envoi.total_ttc} TTC`
    );
  }
  dire(`devis ${envoi.numero} envoyé par SMS (${envoi.total_ttc} € TTC), date proposée ${JOUR_DU_CHANTIER}, jeton ${envoi.jeton}`);
  return envoi.jeton;
}

/**
 * La cliente répond depuis sa page, sans session : c'est tout l'intérêt de
 * cette page (`test-devis-client-e2e.ts`). Elle retient le 13, et accepte.
 */
async function laClienteAccepte(jeton: string, chantierId: string) {
  const navigateur = await lancerNavigateur();
  const contexte = await navigateur.newContext(capturer ? ECRAN_DU_FILM : undefined);
  const page = await contexte.newPage();
  try {
    await page.goto(`${BASE}/devis/${jeton}`, { waitUntil: "domcontentloaded" });
    const laDate = page.locator(`input[name="choixDate"][value="${JOUR_DU_CHANTIER}"]`);
    await laDate.waitFor();
    await laDate.click();
    // Moins de quatorze jours avant les travaux, la page lui demande si elle
    // veut qu'on commence avant la fin de son délai de rétractation. Elle le
    // veut : c'est sa date.
    const retractation = page.locator('input[name="demarrageAnticipe"]');
    if ((await retractation.count()) > 0) await retractation.check();
    await photographier(page, "client-date");
    // Le PDF que « Télécharger mon devis » remet à la cliente.
    await rendreLePdf(page, `/devis/${jeton}/pdf`, "devis-pdf");
    await page.click('button:has-text("J\'accepte ce devis")');
    await page.waitForSelector("text=Votre artisan est prévenu", { timeout: 30_000 });
    await photographier(page, "client-accepte");
  } finally {
    await contexte.close();
    await navigateur.close();
  }
  await attendreEnBase(
    "la date retenue",
    async () =>
      (await pool.query<{ date_planifiee: string | null }>(`SELECT date_planifiee::text FROM chantiers WHERE id = $1`, [chantierId]))
        .rows[0]?.date_planifiee ?? null,
    (d) => d === JOUR_DU_CHANTIER
  );
  dire(`la cliente a accepté et retenu le ${JOUR_DU_CHANTIER} : le chantier est au planning`);
}

/** Les deux gars sur le chantier, matin et après-midi, comme depuis le planning. */
async function poserLesGars(ctx: Ctx, chantierId: string) {
  for (const [i, prenom] of SALARIES.entries()) await nommerEquipe(ctx, i + 1, prenom);
  const { rows } = await pool.query<{ rang: number; demi: string }>(
    `SELECT e.rang, ec.demi FROM equipes_du_chantier ec JOIN equipes e ON e.id = ec.equipe_id
      WHERE ec.chantier_id = $1 AND ec.jour IS NULL`,
    [chantierId]
  );
  // « Basculer » ôte ce qui est déjà posé : on ne touche que ce qui manque.
  for (const [i] of SALARIES.entries()) {
    for (const demi of ["matin", "apres_midi"] as const) {
      if (rows.some((r) => r.rang === i + 1 && r.demi === demi)) continue;
      const pose = await basculerEquipeDuChantier(ctx, chantierId, demi, i + 1);
      if (!pose) throw new Error(`impossible de poser ${SALARIES[i]} le ${demi}`);
    }
  }
  dire(`${SALARIES.join(" et ")} posés sur le chantier, matin et après-midi`);
}

/** Un compte salarié, comme Réglages → Équipe → Qui a accès le crée, conditions acceptées. */
async function donnerLAccesAuSalarie(ctx: Ctx) {
  const deja = await pool.query(`SELECT 1 FROM users WHERE email = $1`, [COMPTE_SALARIE.email]);
  if ((deja.rowCount ?? 0) === 0) {
    const r = await donnerUnAcces(ctx, {
      nom: COMPTE_SALARIE.nom,
      email: COMPTE_SALARIE.email,
      motDePasse: COMPTE_SALARIE.motDePasse,
      confirmation: COMPTE_SALARIE.motDePasse,
      role: "salarie",
    });
    if (!r.ok) throw new Error(`le compte salarié est refusé : ${r.refus}`);
  }
  // Un compte neuf est renvoyé vers l'acceptation des documents avant tout
  // écran : on l'accepte pour lui, comme `test-acces-salarie-e2e.ts`.
  const lui = (await listerAcces(ctx)).find((l) => l.email === COMPTE_SALARIE.email);
  if (!lui) throw new Error("le salarié n'apparaît pas dans les accès de l'entreprise");
  const aAccepter = await documentsAAccepter(lui.utilisateurId);
  if (aAccepter.length > 0) {
    await enregistrerAcceptations(
      lui.utilisateurId,
      aAccepter.map((d) => d.id),
      { adresseIp: "127.0.0.1", agentUtilisateur: "jeu du film, consentement fictif" }
    );
  }
  dire(`compte salarié ${COMPTE_SALARIE.email} (mot de passe : ${COMPTE_SALARIE.motDePasse})`);
}

/** La facture telle qu'elle s'ouvre, avant son envoi : c'est l'écran que le film montre. */
async function photographierLeBrouillon(chantierId: string) {
  if (!capturer) return;
  const navigateur = await lancerNavigateur();
  const contexte = await navigateur.newContext(ECRAN_DU_FILM);
  const page = await contexte.newPage();
  try {
    await seConnecter(page);
    await page.goto(`${BASE}/chantiers/${chantierId}/facture`, { waitUntil: "domcontentloaded" });
    await page.waitForSelector("text=Reprise du devis", { timeout: 30_000 });
    await photographier(page, "facture", true);
  } finally {
    await contexte.close();
    await navigateur.close();
  }
}

/** Fin de chantier, facture émise, réglée : ce que « Terminés » et « Ma TVA » montrent. */
async function facturerLeChantier(ctx: Ctx, chantierId: string) {
  const existante = await pool.query<{ id: string; statut: string }>(`SELECT id, statut FROM factures WHERE chantier_id = $1`, [chantierId]);
  let factureId = existante.rows[0]?.id ?? null;
  if (!factureId) {
    const brouillon = await terminerChantier(ctx, chantierId, FIN_DU_CHANTIER);
    factureId = brouillon.id;
    dire(`chantier terminé le ${FIN_DU_CHANTIER.toISOString().slice(0, 10)}, facture ${brouillon.numeroCommercial} préparée`);
    await photographierLeBrouillon(chantierId);
  }
  if (existante.rows[0]?.statut !== "emise") {
    const emise = await emettreFacture(ctx, factureId, FIN_DU_CHANTIER);
    if (emise.totalTva !== TOTAUX.tva || emise.totalTtc !== TOTAUX.ttc) {
      throw new Error(`la facture émise porte ${emise.totalHt} HT, ${emise.totalTva} de TVA, ${emise.totalTtc} TTC`);
    }
    dire(`facture ${emise.numeroCommercial} émise le ${emise.dateEmission}, échéance ${emise.dateEcheance}`);
  }
  // Aux encaissements, la TVA entre au relevé le jour où la cliente paie.
  if ((await compterPaiements(ctx, factureId)) === 0) {
    const r = await noterPaiement(ctx, factureId, { date: REGLEMENT.date, montant: REGLEMENT.montant, moyen: "virement" });
    if (!r.ok) throw new Error(`le règlement est refusé : ${r.raison}`);
    dire(`règlement de ${REGLEMENT.montant} € noté le ${REGLEMENT.date} (${r.etat})`);
  }
  return factureId;
}

async function main() {
  const ctx = await contexteDuPatron();

  if (facturer) {
    const film = await chantierDuFilm(ctx);
    if (!film?.devis_id) throw new Error("le chantier du film n'existe pas encore : jouer ce script sans --facturer d'abord");
    const factureId = await facturerLeChantier(ctx, film.id);
    console.log(
      `\nChantier ${film.id}\nFacture ${factureId}\n` +
        `Écrans : /chantiers/${film.id}/facture, /termines, /termines/tva?annee=${PERIODE_TVA.annee}&t=${PERIODE_TVA.numero}\n` +
        `Captures : npx tsx scripts/capturer-ecrans-du-film.mts facture`
    );
    return;
  }

  await mettreAJourEntreprise(ctx, { nom: ENTREPRISE.nom, adresse: ENTREPRISE.adresse, nombreSalaries: SALARIES.length });
  dire(`entreprise « ${ENTREPRISE.nom} », ${ENTREPRISE.adresse}, ${SALARIES.length} salariés`);

  await rajeunirLeRappel(ctx);
  if (seulementLAccueil) {
    await libererLePremierNumero(ctx);
    const navigateur = await lancerNavigateur();
    const contexte = await navigateur.newContext(ECRAN_DU_FILM);
    const page = await contexte.newPage();
    try {
      await seConnecter(page);
      await page.goto(`${BASE}/`, { waitUntil: "domcontentloaded" });
      await page.waitForSelector("text=Créer un devis");
      await photographier(page, "accueil-avant");
    } finally {
      await contexte.close();
      await navigateur.close();
    }
    return;
  }
  let film = await chantierDuFilm(ctx);
  if (film?.reponse === "acceptee" && film.date_planifiee === JOUR_DU_CHANTIER) {
    dire(`le chantier « ${CHANTIER_NOM} » est déjà accepté et posé le ${JOUR_DU_CHANTIER} : rien à recréer`);
  } else {
    // Au film, un micro fictif : la dictée s'ouvre sans rien enregistrer.
    const navigateur = await lancerNavigateur(
      capturer ? { args: ["--use-fake-device-for-media-stream", "--use-fake-ui-for-media-stream"] } : {}
    );
    const contexte = await navigateur.newContext(capturer ? ECRAN_DU_FILM : undefined);
    const page = await contexte.newPage();
    try {
      await seConnecter(page);
      let chantierId = film?.id ?? null;
      if (!chantierId) {
        await libererLePremierNumero(ctx);
        chantierId = await creerLeChantier(page);
        // Le nom d'un chantier se déduit du client (`nom-chantier.ts`), aucun
        // écran ne le tape : celui du film s'écrit ici, une fois.
        await ecrireSousContexte(ctx, `UPDATE chantiers SET nom = $1 WHERE id = $2`, [CHANTIER_NOM, chantierId], 1);
        dire(`chantier « ${CHANTIER_NOM} » créé pour ${CLIENTE.civilite} ${CLIENTE.nom}, ${CLIENTE.adresse}`);
      } else {
        dire(`le chantier « ${CHANTIER_NOM} » existe (devis ${film?.devis_statut ?? "absent"}) : on reprend où il en est`);
      }
      let jeton = film?.devis_statut === "envoye" ? film.jeton : null;
      if (!jeton) {
        await ecrireLesLignes(page, chantierId);
        jeton = await envoyerLeDevis(page, chantierId);
      }
      if (film?.reponse !== "acceptee") await laClienteAccepte(jeton, chantierId);
      if (capturer) {
        await page.goto(`${BASE}/`, { waitUntil: "domcontentloaded" });
        await page.waitForSelector("text=Devis accepté");
        await photographier(page, "accueil");
      }
    } finally {
      await contexte.close();
      await navigateur.close();
    }
    film = await chantierDuFilm(ctx);
    if (Object.keys(reperesPris).length > 0) console.log(`\nRepères pris : ${JSON.stringify(reperesPris, null, 2)}`);
    if (!film?.devis_id || film.date_planifiee !== JOUR_DU_CHANTIER) {
      throw new Error("le chantier du film n'est pas retrouvé posé au planning après sa création");
    }
  }

  await poserLesGars(ctx, film.id);
  await donnerLAccesAuSalarie(ctx);

  const { rows } = await pool.query<{ jeton: string; date_retenue: string; date_planifiee: string; devis_id: string }>(
    `SELECT e.jeton, e.date_retenue::text, c.date_planifiee::text, e.devis_id
       FROM envois_devis e JOIN chantiers c ON c.id = e.chantier_id
      WHERE e.chantier_id = $1 ORDER BY e.envoye_at DESC LIMIT 1`,
    [film.id]
  );
  const etat = rows[0];
  console.log(
    `\nChantier ${film.id}\nDevis ${etat?.devis_id} (${NUMERO_DEVIS}), page cliente /devis/${etat?.jeton}\n` +
      `Retenu le ${etat?.date_retenue}, planifié le ${etat?.date_planifiee}\n` +
      `Captures du planning : npx tsx scripts/capturer-ecrans-du-film.mts\n` +
      `Puis la facture : npx tsx scripts/preparer-jeu-du-film.mts --facturer`
  );
}

main()
  .then(() => fermerPool())
  .then(() => process.exit(0))
  .catch(async (e) => {
    console.error("❌", e instanceof Error ? e.message : e);
    await fermerPool();
    process.exit(1);
  });
