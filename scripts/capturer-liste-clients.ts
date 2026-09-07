import path from "node:path";
import { mkdirSync } from "node:fs";
import { Client } from "pg";
import { lancerNavigateur, DELAI_PAR_DEFAUT_MS } from "./e2e-browser";
import type { Page } from "playwright";
import { creerClient } from "../src/server/repositories/clients";
import { creerChantier } from "../src/server/repositories/chantiers";
import { ajouterLignePrix } from "../src/server/repositories/lignes-prix";
import { getOuCreerDevisBrouillon, envoyerDevis } from "../src/server/repositories/devis";
import { terminerChantier, emettreFacture, getFacturePourChantier } from "../src/server/repositories/factures";
import { noterPaiement } from "../src/server/repositories/paiements-facture";
import { jourIso } from "../src/lib/jour";
import { pool } from "../src/server/db/client";

// **REGARDER LA LISTE DES CLIENTS, POUR DE VRAI.**
//
// `CLAUDE.md` §5 : *« Et surtout : regarder l'écran. »* Six défauts de ce dépôt
// ont été trouvés sur une image et par aucun test — dont deux de cet écran-ci,
// le 3 septembre 2026 (le champ de saisie qui remontait de 24 px, et la phrase
// d'échec écrite dans le gris qu'on venait de condamner).
//
// **Pourquoi un script à part, et pas une suite.** Une suite affirme ; elle ne
// montre pas. Et le jeu de démonstration ne suffit pas à voir cet écran : quatre
// clients, aucune adresse, aucune facture impayée — donc pas de lieu sous les
// noms, pas de montant à droite, une seule bande. On ne verrait rien de ce qui a
// été codé.
//
// **Ce qu'il pose en base, et pourquoi c'est légitime ici :** une entreprise
// d'essai, dans SA base d'essai, avec des homonymes et des dates étalées sur
// plusieurs mois. `datePlanifiee` est écrite en SQL — aucune fonction du produit
// ne la pose à la création, et c'est un banc, pas un parcours.
//
//   1. lancer le serveur :  npm run build && npx next start
//   2. npx tsx scripts/capturer-liste-clients.ts <dossier>

const BASE = process.env.BASE_URL ?? "http://127.0.0.1:3000";
const SORTIE = process.argv[2] ?? "/tmp/captures-clients";

/** Les vingt et un noms de sa liste, avec quatre Martins — comme la sienne. */
const SES_CLIENTS: { nom: string; adresse?: string; mois: number | null; du?: string }[] = [
  { nom: "Mme Chauvin", adresse: "Bouguenais", mois: 0 },
  { nom: "M. Martins", adresse: "10 rue d'Enfer, Nantes", mois: 0, du: "740.00" },
  { nom: "Mme Moreau", adresse: "Saint-Herblain", mois: 1 },
  { nom: "M. Bernard", adresse: "Rezé", mois: 1 },
  { nom: "Martins Frères", adresse: "Zone de la Lande, Vertou", mois: 1, du: "1260.00" },
  { nom: "Mme Costa", adresse: "Sainte-Luce-sur-Loire", mois: 1 },
  { nom: "M. Faucher", adresse: "Carquefou", mois: 2, du: "480.00" },
  { nom: "Mme Aubry", adresse: "Orvault", mois: 2 },
  { nom: "M. Martins", adresse: "4 allée des Chênes, Vertou", mois: 2 },
  { nom: "Mme Félicie", adresse: "Vertou", mois: 2 },
  { nom: "Mme Martins", adresse: "18 rue des Tilleuls, Rezé", mois: 4 },
  { nom: "M. Pichon", adresse: "Couëron", mois: 5 },
  { nom: "Copropriété Les Cèdres", adresse: "12 bd des Poilus, Nantes", mois: 6, du: "2150.00" },
  { nom: "M. Delaunay", mois: null },
];

/** Le jour, reculé de N mois — pour étaler la liste sur plusieurs bandes. */
function jourReculeDe(mois: number): string {
  const [a, m, j] = jourIso(new Date()).split("-").map(Number);
  const total = (a * 12 + (m - 1)) - mois;
  const annee = Math.floor(total / 12);
  const moisFinal = (total % 12) + 1;
  // Le 28 : aucun mois n'en manque, et l'on évite le 31 d'un mois de trente
  // jours — un jour inexistant se rangerait au mois suivant.
  return `${annee}-${String(moisFinal).padStart(2, "0")}-${Math.min(j, 28) === j ? String(j).padStart(2, "0") : "28"}`;
}

/**
 * **On enrichit le compte de DÉMONSTRATION, on n'en crée pas un autre.**
 *
 * `creerEntreprise` ne pose aucun mot de passe : un compte neuf ne pourrait pas
 * se connecter au formulaire, donc pas ouvrir l'écran. Le jeu de démonstration,
 * lui, a des identifiants connus — et ses quatre clients sans adresse restent
 * dans la liste, ce qui est une bonne chose : c'est le cas mêlé qu'il aura
 * lui-même le jour où il en saisira quelques-unes.
 */
async function poser() {
  // **Un rôle qui TRAVERSE la RLS, et il en faut un.** Retrouver le compte de
  // démonstration est un problème de poule et d'œuf : `membres_entreprise` est
  // filtrée par `app.entreprise_id`, et c'est justement l'entreprise qu'on
  // cherche. Sous `atlas_owner` la requête rend zéro ligne — sans erreur —, et
  // le banc accuserait alors une base non amorcée qui l'est parfaitement.
  const admin = new Client({
    connectionString:
      process.env.DATABASE_SUPER_URL ?? process.env.DATABASE_ADMIN_URL ?? process.env.DATABASE_URL,
  });
  await admin.connect();

  const { rows } = await admin.query<{ utilisateur_id: string; entreprise_id: string }>(
    `select m.utilisateur_id, m.entreprise_id
       from membres_entreprise m
       join users u on u.id = m.utilisateur_id
      where u.email = 'demo@atlas.local'
      limit 1`
  );
  if (rows.length === 0) {
    throw new Error(
      "Le compte de démonstration est absent : la base n'est pas amorcée. `npm run db:seed` d'abord."
    );
  }
  const ctx = { utilisateurId: rows[0].utilisateur_id, entrepriseId: rows[0].entreprise_id };

  // **Le contexte d'isolation, même pour le propriétaire.** Les tables portent
  // `FORCE ROW LEVEL SECURITY` : sans lui, l'`UPDATE` ci-dessous ne toucherait
  // AUCUNE ligne — et sans erreur. Un banc qui ne pose rien en silence est pire
  // qu'un banc qui échoue (`CLAUDE.md` §5).
  await admin.query("select set_config('app.entreprise_id', $1, false)", [ctx.entrepriseId]);

  try {
    for (const c of SES_CLIENTS) {
      const client = await creerClient(ctx, { nom: c.nom, adresse: c.adresse });
      if (c.mois === null) continue;

      const chantier = await creerChantier(ctx, { nom: `Entretien — ${c.nom}`, clientId: client.id });
      // Un banc pose la date en SQL : aucune fonction du produit ne la met à la
      // création, et ce n'est pas ce qu'on cherche à éprouver ici.
      await admin.query("update chantiers set date_planifiee = $1 where id = $2", [
        jourReculeDe(c.mois),
        chantier.id,
      ]);

      if (!c.du) continue;
      await ajouterLignePrix(ctx, chantier.id, "Élagage", "2000.00");
      const devis = await getOuCreerDevisBrouillon(ctx, chantier.id);
      await envoyerDevis(ctx, devis.id);
      await terminerChantier(ctx, chantier.id);
      const f = await getFacturePourChantier(ctx, chantier.id);
      await emettreFacture(ctx, f!.facture.id);
      // Un règlement partiel : ce qui reste dû est justement ce qu'on veut voir.
      const reste = Number(f!.facture.totalTtc) - Number(c.du);
      if (reste > 0) {
        await noterPaiement(ctx, f!.facture.id, {
          date: jourIso(new Date()),
          montant: reste.toFixed(2),
        });
      }
    }
  } finally {
    await admin.end();
  }

  return { email: "demo@atlas.local", motDePasse: "demo1234" };
}

/**
 * Tape dans le champ, et n'en repart qu'une fois l'écran ayant RÉAGI.
 *
 * **Trouvé en regardant la capture, et c'est tout l'objet de ce script.** La
 * première version posait le texte puis attendait 400 ms : l'image montrait
 * « martins » dans le champ, dix-huit clients en dessous, aucune croix
 * d'effacement et aucune marque — la page n'était pas encore vivante, et la
 * frappe s'était perdue. Une capture prise trop tôt ACCUSE l'écran d'un défaut
 * qu'il n'a pas (`AGENTS.md`).
 *
 * La croix n'existe que lorsque l'état a bougé : c'est le signe qu'on attend.
 */
async function taperEtAttendre(page: Page, texte: string) {
  const champ = page.locator('[data-atlas="chercher-client"]');
  const limite = Date.now() + 60_000;
  while (Date.now() < limite) {
    await champ.fill(texte);
    await page.waitForTimeout(250);
    if ((await champ.inputValue()) === texte) {
      const vivant =
        texte.length === 0 || (await page.locator('[data-atlas="effacer-recherche"]').count()) === 1;
      if (vivant) {
        await page.waitForTimeout(250);
        return;
      }
    }
    await page.waitForTimeout(250);
  }
  throw new Error(`la frappe « ${texte} » n'a jamais été prise : l'écran n'est pas devenu vivant`);
}

async function seConnecter(page: Page, email: string, motDePasse: string) {
  await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
  await page.locator('input[name="email"]').waitFor();
  await page.fill('input[name="email"]', email);
  await page.fill('input[name="password"]', motDePasse);
  await page.click('button[type="submit"]');
  await page.waitForURL(`${BASE}/`, { timeout: DELAI_PAR_DEFAUT_MS });
}

async function principal() {
  mkdirSync(SORTIE, { recursive: true });
  const { email, motDePasse } = await poser();
  console.log(`Jeu posé. Compte : ${email}`);

  const nav = await lancerNavigateur();
  // L'écran du patron, pas un bureau : 390 × 844, c'est son iPhone.
  const page = await (await nav.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 })).newPage();

  await seConnecter(page, email, motDePasse);
  await page.goto(`${BASE}/clients`, { waitUntil: "domcontentloaded" });
  await page.locator('[data-atlas="chercher-client"]').waitFor({ timeout: 60_000 });
  await page.locator('[data-atlas="nom-client"]').first().waitFor({ timeout: 60_000 });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(600);

  const prendre = async (nom: string, pleine = false) => {
    await page.screenshot({ path: path.join(SORTIE, `${nom}.png`), fullPage: pleine });
    console.log(`  → ${nom}.png`);
  };

  await prendre("1-repos");
  await prendre("1-repos-entier", true);

  await taperEtAttendre(page, "martins");
  await prendre("2-trouve");

  await taperEtAttendre(page, "dupont");
  await prendre("3-rien");

  await taperEtAttendre(page, "");
  await page.evaluate(() => window.scrollTo(0, 700));
  await page.waitForTimeout(400);
  await prendre("4-defile");

  // ── Les mesures, pour ce que l'œil ne compte pas ─────────────────────────
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(300);
  // **Le corps est écrit en CHAÎNE, pas en fonction fléchée.** `tsx` compile ce
  // fichier avec esbuild, qui nomme les fonctions imbriquées au moyen d'un
  // auxiliaire `__name` ; envoyé tel quel dans la page, ce code y cherche un
  // auxiliaire qui n'existe pas et meurt sur « __name is not defined ».
  const mesures = await page.evaluate(`(function () {
    var lignes = Array.prototype.slice.call(document.querySelectorAll('a[href^="/clients/"]'));
    var noms = Array.prototype.slice.call(document.querySelectorAll('[data-atlas="nom-client"]'));
    var dits = Array.prototype.slice.call(document.querySelectorAll('[data-atlas="situation-client"]'));
    var textes = noms.concat(dits);
    var coupes = [], zero = 0, hauteurs = [];
    for (var i = 0; i < textes.length; i++) {
      var e = textes[i];
      if (e.getBoundingClientRect().width === 0) { zero++; continue; }
      if (e.scrollWidth > e.clientWidth + 1) coupes.push(e.textContent.trim());
    }
    for (var k = 0; k < lignes.length; k++) hauteurs.push(Math.round(lignes[k].getBoundingClientRect().height));
    var bandes = [];
    var ps = document.querySelectorAll('section > p');
    for (var b = 0; b < ps.length; b++) bandes.push(ps[b].textContent.trim());
    return {
      lignes: lignes.length,
      hauteurMin: hauteurs.length ? Math.min.apply(null, hauteurs) : 0,
      coupes: coupes,
      zeroPixel: zero,
      debordeHorizontal: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
      bandes: bandes,
      compte: (document.querySelector('[data-atlas="compte-clients"]') || {}).textContent
    };
  })()`);
  console.log(JSON.stringify(mesures, null, 1));

  await nav.close();
  await pool.end();
}

principal().catch(async (e) => {
  console.error(e);
  await pool.end().catch(() => undefined);
  process.exit(1);
});
