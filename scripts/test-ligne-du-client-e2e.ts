import assert from "node:assert/strict";
import { Pool } from "pg";
import { lancerNavigateur, ECRAN_DU_PATRON, DELAI_PAR_DEFAUT_MS } from "./e2e-browser";
import { ADRESSE } from "./_adresse";
import type { Page } from "playwright";

/**
 * **CE QUE DIT LA LIGNE D'UN CLIENT, MESURÉ SUR SON ÉCRAN.**
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * **Sa demande du 9 septembre 2026 :** *« Remplace par la dernière chose qui
 * s'est produit »*, après avoir constaté que « 8 chantiers » ne promettait rien
 * qu'il retrouvait sur la fiche — *« on s'attend à avoir 8 devis alors qu'il y
 * en a 0 »*.
 *
 * **CETTE SUITE EXISTE PARCE QUE DEUX DÉFAUTS SONT SORTIS D'UNE CAPTURE, ET
 * D'AUCUN TEST** (`CLAUDE.md` §5, la cinquième fois dans ce dépôt) :
 *
 *   1. **la date se coupait** — « 10 Rue de Nantes 77400 Lagny-sur-Marne ·
 *      Devis 7 sept. » déborde des 316 px de sa ligne. Écrits d'un seul tenant,
 *      ce sont les derniers mots qui tombent : ce qu'on venait d'ajouter
 *      disparaissait exactement chez les clients dont l'adresse est longue ;
 *   2. **une seconde ligne VIDE** sous le nom d'un client sans adresse ni
 *      document — dix-huit pixels de trou, qui se lisent comme un défaut
 *      d'affichage.
 *
 * Les deux sont invisibles à la lecture du code, et invisibles à un test qui ne
 * regarde que le texte : il faut **mesurer des boîtes**. D'où cette suite.
 *
 * **Elle refuse de conclure sur ce qu'elle ne peut pas mesurer** : sans un
 * client à adresse longue, « rien n'est coupé » serait vrai de toute façon, et
 * le vert ne prouverait rien.
 */

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const BASE = ADRESSE;

/** Aussi longue que la sienne : c'est elle qui débordait. */
const ADRESSE_LONGUE = "10 Rue de Nantes 77400 Lagny-sur-Marne";

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

async function vivante(page: Page): Promise<boolean> {
  return page.evaluate(() => {
    const el = document.body.firstElementChild;
    return !!el && Object.keys(el).some((k) => k.startsWith("__react"));
  });
}

/**
 * Deux clients posés pour cette suite : l'un à adresse longue AVEC un devis
 * parti, l'autre sans rien du tout.
 *
 * **Le chantier du premier n'a PAS de date** — et c'est délibéré. La base des
 * suites navigateur est commune et s'accumule : un chantier daté se retrouverait
 * au planning des suites jouées après celle-ci, et le rouge tomberait ailleurs,
 * sur du code juste (`CLAUDE.md` §5, payé le 26 août 2026). Sans date, il ne
 * paraît sur aucune journée.
 */
async function poserDeuxClients(): Promise<{ longue: string; nu: string }> {
  const { rows } = await pool.query<{ entreprise_id: string }>(
    `SELECT entreprise_id FROM clients WHERE deleted_at IS NULL LIMIT 1`
  );
  assert.ok(rows[0], "aucun client dans la base : le jeu de démonstration n'est pas posé");
  const entreprise = rows[0].entreprise_id;
  const marque = Date.now();

  const longue = `Ligne ${marque} longue`;
  const nu = `Ligne ${marque} nu`;
  const { rows: client } = await pool.query<{ id: string }>(
    `INSERT INTO clients (entreprise_id, nom, adresse) VALUES ($1, $2, $3) RETURNING id`,
    [entreprise, longue, ADRESSE_LONGUE]
  );
  const { rows: chantier } = await pool.query<{ id: string }>(
    `INSERT INTO chantiers (entreprise_id, client_id, nom) VALUES ($1, $2, $3) RETURNING id`,
    [entreprise, client[0].id, longue]
  );
  // Le devis est ENVOYÉ : c'est la seule condition sous laquelle la ligne
  // l'annonce, et c'est la même que celle de la fiche.
  await pool.query(
    `INSERT INTO devis (entreprise_id, chantier_id, numero_commercial, numero_version, statut,
       date_emission, entreprise_nom, client_nom, total_ht, total_tva, total_ttc, taux_tva,
       devise, conditions_paiement)
     VALUES ($1, $2, $3, 1, 'envoye', $4, 'Essai', $5, '500.00', '100.00', '600.00', '20.00',
       'EUR', '30 jours')`,
    [entreprise, chantier[0].id, `LIGNE-${marque}`, "2026-09-07", longue]
  );
  // **Ni adresse, ni document** : c'est celui dont la seconde ligne était vide.
  await pool.query(`INSERT INTO clients (entreprise_id, nom) VALUES ($1, $2)`, [entreprise, nu]);
  return { longue, nu };
}

/** La boîte de la situation d'un client, et celle de ses deux morceaux. */
async function mesurer(page: Page, nom: string) {
  return page.evaluate((cherche: string) => {
    const noms = [...document.querySelectorAll('[data-atlas="nom-client"]')];
    const cible = noms.find((n) => (n as HTMLElement).innerText.trim() === cherche);
    if (!cible) return null;
    const ligne = cible.closest("a");
    const situation = ligne?.querySelector('[data-atlas="situation-client"]') as HTMLElement | null;
    if (!situation) return { situation: null };
    const morceaux = [...situation.children].map((el) => ({
      texte: (el as HTMLElement).innerText,
      coupe: el.scrollWidth > el.clientWidth + 1,
      largeur: (el as HTMLElement).getBoundingClientRect().width,
    }));
    return {
      situation: {
        texte: situation.innerText.replace(/\s+/g, " ").trim(),
        largeur: situation.getBoundingClientRect().width,
        morceaux,
      },
    };
  }, nom);
}

async function principal() {
  console.log("=== Ce que dit la ligne d'un client ===\n");

  const { longue, nu } = await poserDeuxClients();

  const nav = await lancerNavigateur();
  const page = await (await nav.newContext({ ...ECRAN_DU_PATRON })).newPage();

  await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
  await page.locator('input[name="email"]').waitFor();
  await page.fill('input[name="email"]', "demo@atlas.local");
  await page.fill('input[name="password"]', "demo1234");
  await page.click('button[type="submit"]');
  await page.waitForURL(`${BASE}/`, { timeout: DELAI_PAR_DEFAUT_MS });

  await page.goto(`${BASE}/clients`, { waitUntil: "domcontentloaded" });
  await page.locator('[data-atlas="nom-client"]').first().waitFor();
  for (let reste = 40; reste > 0 && !(await vivante(page)); reste--) {
    await page.waitForTimeout(500);
  }
  // **La mise en page doit être POSÉE avant qu'on mesure.** Une feuille de style
  // non appliquée rend des largeurs de zéro, et « 0 > 0 » est faux : le contrôle
  // passerait au vert sans rien avoir mesuré (`CLAUDE.md` §5).
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(300);

  // Le client à adresse longue est en fin de liste (aucun chantier) : on
  // descend, sinon il n'est pas rendu sous le doigt.
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  await page.waitForTimeout(400);

  const vuLongue = await mesurer(page, longue);
  const vuNu = await mesurer(page, nu);

  await cas("les deux clients de la suite sont bien à l'écran", async () => {
    assert.ok(vuLongue, `« ${longue} » ne paraît pas dans la liste`);
    assert.ok(vuNu, `« ${nu} » ne paraît pas dans la liste`);
  });

  await cas("la ligne mesure quelque chose — sinon elle ne prouve rien", async () => {
    assert.ok(vuLongue?.situation, "le client à adresse longue n'a aucune ligne de situation");
    assert.ok(
      (vuLongue!.situation!.largeur ?? 0) > 100,
      `boîte de ${Math.round(vuLongue!.situation!.largeur)} px : la mise en page n'est pas posée`
    );
  });

  await cas("L'ADRESSE SE ROGNE, LA DATE JAMAIS", async () => {
    const morceaux = vuLongue!.situation!.morceaux;
    assert.equal(morceaux.length, 2, "l'adresse et la date doivent être deux morceaux séparés");
    const [adresse, quand] = morceaux;
    // L'adresse est celle qui déborde — c'est le cas qu'on éprouve.
    assert.ok(
      adresse.coupe,
      "l'adresse longue ne déborde pas : ce contrôle ne mesure alors plus rien"
    );
    assert.ok(!quand.coupe, `la date est coupée : « ${quand.texte} »`);
    assert.match(
      quand.texte,
      /(Devis|Facture|Fiche|·)/,
      `le second morceau ne porte pas ce qui s'est produit : « ${quand.texte} »`
    );
  });

  await cas("un client sans rien à dire n'a PAS de seconde ligne vide", async () => {
    assert.equal(
      vuNu!.situation,
      null,
      "un trou de dix-huit pixels sous son nom se lit comme un défaut d'affichage"
    );
  });

  await cas("le compte de chantiers a bien quitté la liste", async () => {
    // **Un retrait ne se vérifie que par l'absence.** Sans ce contrôle, « 8
    // chantiers » pourrait reparaître au premier rebasage sans que rien ne
    // rougisse (`CLAUDE.md` §5 bis, et c'est ce qu'il a fait retirer).
    const texte = await page.locator("body").innerText();
    assert.doesNotMatch(texte, /\d+\s+chantiers?\b/, "le compte de chantiers est revenu sur la liste");
  });

  await nav.close();
  await pool.end();

  console.log(`\n${echecs === 0 ? "✅ Tout est vert" : `❌ ${echecs} contrôle(s) rouge(s)`}`);
  process.exit(echecs === 0 ? 0 : 1);
}

principal().catch((e) => {
  // La panne se dit en entier : un contrôle muet envoie chercher au mauvais
  // endroit (`AGENTS.md`).
  console.error(e);
  process.exit(1);
});
