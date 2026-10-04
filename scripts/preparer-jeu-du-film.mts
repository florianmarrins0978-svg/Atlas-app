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
import type { Page } from "playwright";
import { fermerPool, pool } from "../src/server/db/client";
import { garderSeed, phraseDeRefus } from "../src/lib/garde-seed";
import type { Ctx } from "../src/server/repositories/context";
import { mettreAJourEntreprise } from "../src/server/repositories/entreprises";
import { effacerClient } from "../src/server/repositories/donnees-client";
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

/** La fiche client, remplie comme le patron la remplit, puis « Je rédige mon devis ». */
async function creerLeChantier(page: Page): Promise<string> {
  await page.goto(`${BASE}/chantiers/nouveau`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector('[data-atlas="civilite-mme"]');
  await page.click('[data-atlas="civilite-mme"]');
  await page.getByLabel(/Nom du client/i).fill(CLIENTE.nom);
  await page.fill('input[placeholder="06 12 34 56 78"]', CLIENTE.telephone);
  const adresse = page.getByRole("combobox", { name: "Adresse du chantier" });
  await adresse.fill(CLIENTE.adresse);
  // La liste des adresses proposées s'ouvre sous le champ : on la referme sans
  // rien choisir, l'adresse tapée reste telle quelle.
  await page.keyboard.press("Escape");
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
  }
  await attendreEnBase("les lignes du devis", () => lignesEnregistrees(chantierId), lignesConformes);
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
  const contexte = await navigateur.newContext();
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
    await page.click('button:has-text("J\'accepte ce devis")');
    await page.waitForSelector("text=Votre artisan est prévenu", { timeout: 30_000 });
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

/** Fin de chantier, facture émise, réglée : ce que « Terminés » et « Ma TVA » montrent. */
async function facturerLeChantier(ctx: Ctx, chantierId: string) {
  const existante = await pool.query<{ id: string; statut: string }>(`SELECT id, statut FROM factures WHERE chantier_id = $1`, [chantierId]);
  let factureId = existante.rows[0]?.id ?? null;
  if (!factureId) {
    const brouillon = await terminerChantier(ctx, chantierId, FIN_DU_CHANTIER);
    factureId = brouillon.id;
    dire(`chantier terminé le ${FIN_DU_CHANTIER.toISOString().slice(0, 10)}, facture ${brouillon.numeroCommercial} préparée`);
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

  let film = await chantierDuFilm(ctx);
  if (film?.reponse === "acceptee" && film.date_planifiee === JOUR_DU_CHANTIER) {
    dire(`le chantier « ${CHANTIER_NOM} » est déjà accepté et posé le ${JOUR_DU_CHANTIER} : rien à recréer`);
  } else {
    const navigateur = await lancerNavigateur();
    const contexte = await navigateur.newContext();
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
        dire(`chantier « ${CHANTIER_NOM} » créé pour ${CLIENTE.nom}, ${CLIENTE.adresse}`);
      } else {
        dire(`le chantier « ${CHANTIER_NOM} » existe (devis ${film?.devis_statut ?? "absent"}) : on reprend où il en est`);
      }
      let jeton = film?.devis_statut === "envoye" ? film.jeton : null;
      if (!jeton) {
        await ecrireLesLignes(page, chantierId);
        jeton = await envoyerLeDevis(page, chantierId);
      }
      if (film?.reponse !== "acceptee") await laClienteAccepte(jeton, chantierId);
    } finally {
      await contexte.close();
      await navigateur.close();
    }
    film = await chantierDuFilm(ctx);
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
