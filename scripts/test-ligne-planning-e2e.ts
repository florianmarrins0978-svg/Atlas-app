import assert from "node:assert";
import { mkdirSync } from "node:fs";
import type { Page, BrowserContext } from "playwright";
import { lancerNavigateur } from "./e2e-browser";
import { pool } from "../src/server/db/client";
import { creerPuisFiche } from "./_creer-chantier-e2e";

/**
 * La ligne du planning, MESURÉE sur l'écran du patron — 390 px.
 *
 * *Sa demande du 15 août 2026, sur `docs/maquettes/59-la-ligne-qui-dit-tout.html` :
 * « il doit y avoir le nombre de jour, le matin, l'après-midi et la journée
 * comme infos possible », puis « je veux journée et toute la ligne ».*
 *
 * **POURQUOI UNE SUITE NAVIGATEUR EN PLUS DE LA SUITE BASE.**
 * `test-libelle-occupation.ts` éprouve la PHRASE : elle est juste, elle dit le
 * bon mot, elle n'écrit jamais un moment sans sa durée. Elle serait verte même
 * si cette phrase était grise, coupée à mi-chemin, ou repliée sur deux lignes —
 * elle ne regarde pas l'écran.
 *
 * Or c'est précisément là que ce lot peut échouer : la ligne portait deux
 * choses, elle en porte maintenant TROIS, et la colonne fait 204 px. Le dépôt a
 * déjà payé ce piège — « Chez M. Bernard » devenu « Chez M. … » le 12 août,
 * trouvé sur une capture et par rien d'autre.
 *
 * **CE QUI EST MESURÉ, ET POURQUOI CHAQUE MESURE EXISTE :**
 *
 *   1. la phrase porte la date, le moment et la durée — ce qu'il a demandé ;
 *   2. elle est **en or**, la couleur calculée et non le nom d'une classe :
 *      *« je veux journée et toute la ligne »* ;
 *   3. elle tient sur **une seule ligne** et **n'est pas coupée** — la mesure
 *      que seule une page rendue peut donner ;
 *   4. le **nom du chantier** n'est pas coupé non plus. C'est lui qui paie
 *      quand la phrase s'allonge, et c'est la seule chose qui dit de quel
 *      chantier il s'agit ;
 *   5. l'équipe n'est écrite **qu'une fois** : la pastille la porte depuis le
 *      14 août, et la phrase la portait encore — « Équipe A » s'écrivait deux
 *      fois côte à côte.
 *
 * Les trois cas posés en base couvrent les trois écritures : la journée pleine,
 * la demi-journée de l'après-midi, et le chantier de trois jours.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * **CETTE SUITE A DORMI, ET C'EST LA CAPTURE QUI L'A RÉVEILLÉE.** Écrite avec
 * `domcontentloaded`, elle mesurait des boîtes de ZÉRO pixel — la feuille de
 * style n'était pas appliquée, le `<span>` restait en ligne, et
 * `scrollWidth - clientWidth` valait 0 − 0. Elle annonçait « rien n'est coupé »
 * en vert, sur un écran où trois noms l'étaient bel et bien.
 *
 * Rien ne l'aurait montré : la suite était verte, la batterie entière l'était.
 * C'est **la capture, regardée**, qui a montré les « … » — exactement ce que
 * `CLAUDE.md` §5 promet, et pour la quatrième fois de ce dépôt.
 *
 * Deux réparations, et la seconde vaut pour toutes les suites à venir :
 * `networkidle` avant de mesurer, et **le refus de se prononcer sur une boîte
 * de zéro pixel**. Un contrôle qui mesure zéro ne mesure rien, et il est pire
 * qu'absent : il rassure.
 * ─────────────────────────────────────────────────────────────────────────
 */

const BASE = "http://localhost:3000";
// La largeur réelle de son téléphone. Mesurer à 1280 px ne prouverait rien :
// tout tient, et le défaut qu'on cherche n'apparaît qu'à l'étroit.
const LARGEUR_TELEPHONE = 390;

let passed = 0;
let failed = 0;
async function test(nom: string, fn: () => Promise<void>) {
  try {
    await fn();
    console.log(`✅ ${nom}`);
    passed++;
  } catch (err) {
    console.error(`❌ ${nom}`);
    console.error(`   ${err instanceof Error ? err.message : err}`);
    failed++;
  }
}

async function seConnecter(context: BrowserContext): Promise<Page> {
  const page = await context.newPage();
  await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  await page.fill('input[name="email"]', "demo@atlas.local");
  await page.fill('input[name="password"]', "demo1234");
  await page.click('button[type="submit"]');
  await page.waitForURL(`${BASE}/`, { timeout: 15000 });
  return page;
}

/** L'or d'Atlas, tel que `design-tokens.ts` le pose : #B98B47. */
const OR = "rgb(185, 139, 71)";

async function main() {
  const browser = await lancerNavigateur();
  const context = await browser.newContext({
    viewport: { width: LARGEUR_TELEPHONE, height: 844 },
  });
  const page = await seConnecter(context);

  /**
   * Un chantier posé, dans l'état voulu.
   *
   * **Le nom est long, mais VRAI** — « Bernard-Delacroix » est ce que le patron
   * écrit vraiment. Un « M. X » de trois lettres ferait passer n'importe quelle
   * phrase et le contrôle dormirait ; à l'inverse, y coller l'horodatage qui
   * rend les autres suites rejouables donnait « Mr. Bernard-Delacroix
   * J1786838107808 » — un nom qu'aucun client ne porte, et le contrôle accusait
   * alors le produit d'une coupure que seul le montage avait fabriquée.
   *
   * **L'unicité ne passe pas par le nom** : les lignes se trouvent par l'`id` du
   * chantier, jamais par son intitulé.
   */
  async function poser(
    creneau: "matin" | "apres_midi",
    dureeDemiJournees: number
  ): Promise<{ id: string; nom: string }> {
    await page.goto(`${BASE}/chantiers/nouveau`, { waitUntil: "networkidle" });
    await page.fill('input[placeholder="Bernard"]', "Bernard-Delacroix");
    await page.fill('input[placeholder="06 12 34 56 78"]', "05 56 00 00 12");
    await creerPuisFiche(page);
    await page.waitForURL(/\/chantiers\/[0-9a-f-]{36}/, { timeout: 10000 });
    const id = page.url().split("/").pop()!;

    // Un LUNDI, pour que « 3 jours » ne saute pas le week-end : le saut est
    // éprouvé côté règle (`test-libelle-occupation.ts`), et l'introduire ici
    // rendrait la mesure dépendante du jour où la suite tourne.
    const r = await pool.query(
      `UPDATE chantiers
          SET devis_envoye_at = now(),
              date_planifiee = date_trunc('week', CURRENT_DATE + interval '14 days')::date,
              creneau_debut = $2, duree_demi_journees = $3, equipe_id = NULL
        WHERE id = $1`,
      [id, creneau, dureeDemiJournees]
    );
    if (r.rowCount !== 1) {
      throw new Error(
        "Le montage n'a pas pu poser la date : le rôle de test ne traverse probablement " +
          "plus RLS (voir CLAUDE.md §5)."
      );
    }
    const nom = (await pool.query(`SELECT nom FROM chantiers WHERE id = $1`, [id])).rows[0]
      .nom as string;
    return { id, nom };
  }

  const journee = await poser("matin", 2);
  const demi = await poser("apres_midi", 1);
  const longue = await poser("matin", 6);

  // **`networkidle`, et ce n'est pas un excès de prudence — c'est une
  // réparation.** Écrit `domcontentloaded`, cette suite mesurait des boîtes de
  // ZÉRO pixel : la feuille de style n'était pas encore appliquée, le `<span>`
  // restait en ligne, et `scrollWidth - clientWidth` valait 0 − 0. Le contrôle
  // annonçait « rien n'est coupé » sur un écran où trois noms l'étaient — vu
  // sur la CAPTURE, jamais autrement. Un contrôle qui mesure zéro ne mesure
  // rien, et il est pire qu'absent : il rassure.
  const allerAuPlanning = async () => {
    await page.goto(`${BASE}/planning`, { waitUntil: "networkidle" });
    await page.waitForSelector('h1:has-text("Planning")', { timeout: 30_000 });
  };

  /**
   * Ce que la ligne de CE chantier montre réellement.
   *
   * On mesure des boîtes, pas des classes. Et le débordement se lit sur l'écart
   * entre le texte et sa boîte : le DOM porte toujours la phrase entière, c'est
   * la boîte qui la rogne — un `innerText` ne le dirait jamais.
   */
  async function ligneDe(id: string) {
    const lien = page.locator(`a[href="/chantiers/${id}"]`);
    await lien.scrollIntoViewIfNeeded();
    const mesure = await lien.evaluate((a) => {
      const spans = a.querySelectorAll("span");
      const nom = spans[0] as HTMLElement;
      const quand = spans[1] as HTMLElement;
      return {
        nom: nom.textContent ?? "",
        debordNom: nom.scrollWidth - nom.clientWidth,
        largeurNom: nom.clientWidth,
        texte: (quand.textContent ?? "").trim(),
        debordTexte: quand.scrollWidth - quand.clientWidth,
        largeurTexte: quand.clientWidth,
        hauteur: Math.round(quand.getBoundingClientRect().height),
        couleur: getComputedStyle(quand).color,
      };
    });

    // **Le garde-fou qui manquait.** Une boîte de zéro pixel n'est pas une
    // ligne qui tient : c'est une page pas encore mise en page, et tout écart
    // mesuré dessus vaut zéro par construction. La suite refuse donc de se
    // prononcer plutôt que de rendre un vert qui ne prouve rien.
    if (mesure.largeurNom === 0 || mesure.largeurTexte === 0) {
      throw new Error(
        `La ligne « ${mesure.nom.trim()} » mesure 0 px de large : la page n'est pas mise en ` +
          "page au moment de la mesure, et aucun débordement ne peut être vu. " +
          "Ce n'est pas le produit qui est en cause, c'est ce contrôle."
      );
    }
    return mesure;
  }

  await test("La ligne dit la date, le moment et la durée — ses trois infos", async () => {
    await allerAuPlanning();
    const pleine = await ligneDe(journee.id);
    const apresMidi = await ligneDe(demi.id);
    const troisJours = await ligneDe(longue.id);

    // La journée pleine : « journée » porte la durée à elle seule, et « matin »
    // n'a rien à y faire — c'est le défaut du 13 août.
    assert.match(pleine.texte, /journée/, `journée pleine : « ${pleine.texte} »`);
    assert.ok(!/\bmatin\b/.test(pleine.texte), `« matin » ne doit pas s'y écrire : « ${pleine.texte} »`);

    assert.match(apresMidi.texte, /après-midi · ½ journée/, `demi-journée : « ${apresMidi.texte} »`);
    assert.match(troisJours.texte, /matin · 3 jours/, `trois jours : « ${troisJours.texte} »`);

    // La date, sur les trois — elle est revenue le 15 août.
    for (const l of [pleine, apresMidi, troisJours]) {
      assert.match(l.texte, /\d{1,2} \p{L}+/u, `la date manque sur la ligne : « ${l.texte} »`);
    }

    // Et « jour » ne remplace jamais « journée » : sa correction, deux fois.
    for (const l of [pleine, apresMidi, troisJours]) {
      assert.ok(
        !/\bjour\b/.test(l.texte),
        `« jour » au lieu de « journée » — sa correction du 4 puis du 15 août : « ${l.texte} »`
      );
    }
  });

  await test("Toute la phrase est en or, et non grise", async () => {
    await allerAuPlanning();
    for (const c of [journee, demi, longue]) {
      const l = await ligneDe(c.id);
      assert.equal(
        l.couleur,
        OR,
        `« ${l.texte} » est en ${l.couleur} — il a demandé toute la ligne en or`
      );
    }
  });

  await test("À 390 px, rien n'est coupé et rien ne se replie", async () => {
    await allerAuPlanning();
    for (const c of [journee, demi, longue]) {
      const l = await ligneDe(c.id);
      assert.equal(
        l.debordTexte,
        0,
        `« ${l.texte} » déborde de ${l.debordTexte} px sur les ${l.largeurTexte} px ` +
          "de la colonne : la phrase est coupée sur son téléphone"
      );
      assert.equal(
        l.debordNom,
        0,
        `« ${l.nom.trim()} » déborde de ${l.debordNom} px sur les ${l.largeurNom} px ` +
          "de la colonne : c'est le nom du chantier qui paie la phrase"
      );
      assert.ok(
        l.hauteur <= 20,
        `« ${l.texte} » fait ${l.hauteur} px de haut : elle se replie sur deux lignes`
      );
    }
  });

  await test("À plusieurs équipes, le nom de l'équipe n'est écrit QU'UNE fois", async () => {
    await pool.query(
      `UPDATE entreprises SET nombre_equipes = 2
        WHERE id = (SELECT entreprise_id FROM chantiers WHERE id = $1)`,
      [journee.id]
    );
    await pool.query(
      `UPDATE chantiers SET equipe_id = (
         SELECT id FROM equipes
          WHERE entreprise_id = (SELECT entreprise_id FROM chantiers WHERE id = $1)
            AND rang = 1 LIMIT 1)
        WHERE id = $1`,
      [journee.id]
    );
    await allerAuPlanning();

    const l = await ligneDe(journee.id);
    // La pastille porte l'équipe depuis le 14 août. Si la phrase la porte
    // aussi, « Équipe A » s'écrit deux fois côte à côte — un doublon qu'aucune
    // suite ne voyait, parce que chacune ne regardait que sa moitié.
    assert.ok(
      !/quipe/.test(l.texte),
      `l'équipe est écrite dans la phrase ET sur la pastille : « ${l.texte} »`
    );
    // Et elle doit bien être quelque part : la retirer des deux endroits
    // laisserait la ligne muette sur qui s'en occupe.
    //
    // **Compté DANS LA RANGÉE, pas par le nom du chantier.** Les trois cas de
    // cette suite portent le même client — le nom ne les distingue pas, et
    // c'est voulu : y coller un horodatage fabriquait des noms qu'aucun client
    // ne porte. Chercher « l'équipe — Mr. Bernard-Delacroix » en trouvait donc
    // trois, et le contrôle accusait la pastille d'avoir disparu. Seul l'`id`
    // du chantier désigne une ligne sans ambiguïté.
    const rangee = page.locator(`div:has(> a[href="/chantiers/${journee.id}"])`).last();
    const pastilles = await rangee.getByRole("button", { name: /l'équipe — / }).count();
    assert.equal(pastilles, 1, `la ligne porte ${pastilles} pastille(s) d'équipe, une attendue`);
  });

  // **Et une capture, parce que trois défauts réels de ce dépôt ont été trouvés
  // en REGARDANT** — une barre de navigation sur la page du client, l'ordre des
  // totaux d'une facture, une pile de notifications qui poussait tout hors de
  // l'écran. Aucun n'aurait rougi ici. Elle est prise à chaque passage, à la
  // largeur de son téléphone, et coûte une seconde.
  await allerAuPlanning();
  const liste = page.locator('a[href^="/chantiers/"]').first();
  await liste.scrollIntoViewIfNeeded();
  mkdirSync("artifacts/screenshots", { recursive: true });
  await page.screenshot({ path: "artifacts/screenshots/ligne-planning-390.png" });

  console.log(
    `\n${failed === 0 ? "✅" : "❌"} La ligne du planning — ${passed} réussi(s), ${failed} échec(s).`
  );
  await browser.close();
  await pool.end();
  process.exit(failed === 0 ? 0 : 1);
}

main().catch(async (e) => {
  console.error(e);
  await pool.end();
  process.exit(1);
});
