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
 *   1. la phrase porte le moment et la durée. **La date, elle, a quitté la
 *      ligne le 21 août 2026** pour le titre du jour : la liste des planifiés
 *      est groupée par jour NOMMÉ depuis la planche 84, et l'écrire sur chaque
 *      ligne la répétait autant de fois qu'il y a de chantiers ce jour-là ;
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
 * **Ce que la planche 84 a changé ici, le 21 août 2026 :** la ligne n'est plus
 * un lien vers la fiche — le nom ouvre la journée et la feuille, sur place —, la
 * date est passée au-dessus, et « ½ journée » ne s'écrit plus (*« il y a marqué
 * matin, et à chaque fois demi-journée »*). Les mesures, elles, n'ont pas
 * bougé : c'est le nom du client qui paie quand la phrase s'allonge, et c'est
 * cela qu'on refuse.
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
              creneau_debut = $2, duree_demi_journees = $3
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
   * Amener la liste des planifiés sur la semaine où les trois cas sont posés.
   *
   * **La semaine ne gouverne QUE les planifiés depuis la planche 84** : le
   * calendrier reste au mois, et la liste du bas a ses propres flèches. Les
   * trois chantiers sont posés au lundi dans deux semaines ; on avance jusqu'à
   * les trouver plutôt que de supposer qu'on y est.
   */
  async function amenerSurLaSemaineDesCas() {
    const cible = (
      await pool.query(`SELECT date_planifiee::text AS jour FROM chantiers WHERE id = $1`, [
        journee.id,
      ])
    ).rows[0].jour as string;
    const numero = new Date(`${cible}T12:00:00Z`).getUTCDate();
    for (let i = 0; i < 8; i++) {
      const titre = await page.locator('[data-atlas="semaine-titre"]').innerText();
      if (titre.startsWith(`${numero} `)) return;
      await page.click('button[aria-label="Semaine suivante"]');
      await page.waitForTimeout(250);
    }
    throw new Error(`la liste n'atteint pas la semaine du ${cible}`);
  }

  /**
   * Ce que la ligne de CE chantier montre réellement.
   *
   * On mesure des boîtes, pas des classes. Et le débordement se lit sur l'écart
   * entre le texte et sa boîte : le DOM porte toujours la phrase entière, c'est
   * la boîte qui la rogne — un `innerText` ne le dirait jamais.
   *
   * **La ligne se désigne par le nom du chantier, dans SA rangée.** Depuis la
   * planche 84, une ligne des planifiés n'est plus un lien vers la fiche : le
   * nom ouvre la journée et la feuille, sur place. On passe donc par la base
   * pour savoir quel nom porte cet identifiant.
   */
  async function ligneDe(id: string) {
    // **La rangée se désigne par le CHEVRON, jamais par le nom.** Les trois cas
    // de cette suite portent le même client — c'est voulu : y coller un
    // horodatage fabriquait des noms qu'aucun client ne porte, et le contrôle
    // accusait alors le produit d'une coupure que seul le montage avait faite.
    // Viser le nom en trouvait donc trois, et l'on mesurait toujours le premier :
    // « après-midi » se lisait « journée », et le contrôle rougissait sur un
    // écran juste. Seul l'`id` du chantier désigne une ligne sans ambiguïté, et
    // c'est le chevron qui le porte.
    const rangee = page
      .locator(`[data-atlas="ligne-planifiee"][data-chantier="${id}"]`)
      .first();
    await rangee.scrollIntoViewIfNeeded();

    const mesure = await rangee.evaluate((r) => {
      const bouton = r.querySelector('[data-atlas="nom-planifie"]') as HTMLElement;
      const quand = bouton.querySelector('[data-atlas="duree-planifiee"]') as HTMLElement;
      return {
        // Le nom seul : le bouton porte aussi le moment, en petit et en or.
        nom: (bouton.childNodes[0]?.textContent ?? "").trim(),
        // **Le débordement se lit sur le BOUTON, jamais sur le `<span>` du
        // moment.** Ce span est EN LIGNE — la planche le veut collé au nom — et
        // un élément en ligne n'a ni `clientWidth` ni `scrollWidth` : les deux
        // valent zéro, et `0 − 0 = 0` annoncerait « rien n'est coupé » sur une
        // ligne coupée. C'est exactement le défaut du 15 août 2026, et c'est le
        // garde-fou plus bas qui l'a rattrapé ici même.
        debord: bouton.scrollWidth - bouton.clientWidth,
        largeurNom: bouton.clientWidth,
        texte: (quand.textContent ?? "").trim(),
        // `getBoundingClientRect` fonctionne, LUI, sur un élément en ligne.
        largeurTexte: quand.getBoundingClientRect().width,
        hauteur: Math.round(bouton.getBoundingClientRect().height),
        couleur: getComputedStyle(quand).color,
      };
    });

    // **Le garde-fou qui manquait.** Une boîte de zéro pixel n'est pas une
    // ligne qui tient : c'est une page pas encore mise en page, et tout écart
    // mesuré dessus vaut zéro par construction. La suite refuse donc de se
    // prononcer plutôt que de rendre un vert qui ne prouve rien.
    if (mesure.largeurNom === 0 || mesure.largeurTexte < 1) {
      throw new Error(
        `La ligne « ${mesure.nom} » mesure 0 px de large : la page n'est pas mise en ` +
          "page au moment de la mesure, et aucun débordement ne peut être vu. " +
          "Ce n'est pas le produit qui est en cause, c'est ce contrôle."
      );
    }
    return mesure;
  }

  await test("La ligne dit la DURÉE, et le JOUR est écrit au-dessus", async () => {
    await allerAuPlanning();
    await amenerSurLaSemaineDesCas();

    const pleine = await ligneDe(journee.id);
    const apresMidi = await ligneDe(demi.id);
    const troisJours = await ligneDe(longue.id);

    // **LA LIGNE DIT LE TEMPS QUE PREND LE CHANTIER, PLUS L'HEURE OÙ IL
    // COMMENCE.** Sa demande du 22 août 2026, éprouvée sur la planche 86 puis
    // retenue le jour même : *« ce n'est pas clair quand il y a marqué le matin
    // et l'après-midi »*. La demi-journée se lit toujours — sur la ligne MATIN
    // du volet, une fois la ligne dépliée —, mais plus ici.
    //
    // Le contrôle a donc changé d'objet, et le libellé n'a PAS été remis : une
    // assertion sur un mot qu'il fait enlever rend son écran impossible à
    // changer (`CLAUDE.md` §5 bis).
    assert.equal(pleine.texte, "une journée", `journée pleine : « ${pleine.texte} »`);
    assert.ok(
      !/\bmatin\b|\baprès-midi\b/.test(pleine.texte),
      `le moment est revenu à la place de la durée : « ${pleine.texte} »`
    );

    assert.equal(apresMidi.texte, "une demi-journée", `demi-journée : « ${apresMidi.texte} »`);
    assert.equal(troisJours.texte, "3 jours", `trois jours : « ${troisJours.texte} »`);

    // **LA DATE A QUITTÉ LA LIGNE POUR LE TITRE DU JOUR**, et ce n'est pas une
    // perte : la liste des planifiés est GROUPÉE par jour nommé depuis la
    // planche 84 — *« mettre en haut les jours de la semaine [...] avec les
    // clients dessous »*. Elle est écrite une fois pour tous les chantiers du
    // jour, au lieu d'une fois par ligne. On vérifie qu'elle est bien là.
    const titre = await page
      .locator('[data-atlas="jour-planifie"]')
      .first()
      .locator("p")
      .first()
      .innerText();
    assert.match(
      titre,
      /\p{L}+ \d{1,2} \p{L}+/u,
      `le jour n'est pas nommé au-dessus des chantiers : « ${titre} »`
    );

    // Et « jour » ne remplace jamais « journée » : sa correction, deux fois.
    assert.ok(
      !/\bjour\b/.test(pleine.texte),
      `« jour » au lieu de « journée » — sa correction du 4 puis du 15 août : « ${pleine.texte} »`
    );
  });

  await test("Toute la phrase est en or, et non grise", async () => {
    await allerAuPlanning();
    await amenerSurLaSemaineDesCas();
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
    await amenerSurLaSemaineDesCas();
    for (const c of [journee, demi, longue]) {
      const l = await ligneDe(c.id);
      assert.equal(
        l.debord,
        0,
        `« ${l.nom} ${l.texte} » déborde de ${l.debord} px sur les ${l.largeurNom} px ` +
          "de la colonne : c'est le nom du chantier qui paie la phrase"
      );
      // Le nom est en serif de 19 px : une seule ligne en fait vingt-quatre.
      // Repliée, elle en ferait le double.
      assert.ok(
        l.hauteur <= 30,
        `« ${l.nom} ${l.texte} » fait ${l.hauteur} px de haut : elle se replie sur deux lignes`
      );
    }
  });

  /**
   * **CE QU'IL TOUCHE NE DOIT PAS LUI ÉCHAPPER.**
   *
   * *Son défaut du 22 août 2026, capture à l'appui :* « lorsque le client se
   * trouve sur la partie haute de l'écran […] et que je clique dessus pour
   * pouvoir afficher sa fiche chantier, le client remonte et la fiche chantier
   * aussi. […] tout remonte d'un bloc et je suis perdu, je ne sais plus où est
   * mon client. Il disparaît sous mes yeux. »
   *
   * **Aucun défilement n'est en cause, et c'est ce qui rend le défaut
   * sournois.** Personne n'appelle `scrollTo`. Ouvrir une fiche en REFERME une
   * autre — sa règle du 22 août, « le même nom referme ce qu'il a ouvert » —,
   * et quand la fiche refermée se trouvait PLUS HAUT dans la page, tout ce qui
   * suit remonte de sa hauteur. Safari n'ancre pas le défilement
   * (`overflow-anchor` n'y existe pas) : il faut le rattraper nous-mêmes.
   *
   * **Cette suite rejoue la SÉQUENCE, pas le geste.** Ouvrir une fiche, faire
   * défiler jusqu'à ce qu'un AUTRE client soit haut sur l'écran, puis le
   * toucher. Un contrôle qui se contenterait de toucher une ligne sur une page
   * fraîche ne fermerait rien au-dessus d'elle, ne bougerait rien, et serait
   * vert sur le défaut même qu'il prétend attraper.
   */
  await test("Le client touché ne remonte pas : la fiche s'ouvre VERS LE BAS", async () => {
    await allerAuPlanning();
    await amenerSurLaSemaineDesCas();

    const rangeeDe = (id: string) =>
      page.locator(`[data-atlas="ligne-planifiee"][data-chantier="${id}"]`).first();
    const hautDe = async (id: string) =>
      await rangeeDe(id).evaluate((r) => r.getBoundingClientRect().top);

    // 1. Une première fiche est ouverte PLUS HAUT dans la page — c'est elle qui
    //    se refermera, et sa hauteur qui manquera d'un coup.
    await rangeeDe(journee.id).locator('[data-atlas="nom-planifie"]').click();
    await page.waitForTimeout(400);

    const hauteurCarte = await rangeeDe(journee.id).evaluate(
      (r) => r.getBoundingClientRect().height
    );
    if (hauteurCarte < 120) {
      throw new Error(
        `La première fiche ne s'est pas ouverte (${Math.round(hauteurCarte)} px) : sans elle ` +
          "rien ne se referme au-dessus, rien ne remonte, et ce contrôle ne mesure rien."
      );
    }

    // 2. On amène le SECOND client vers le haut de l'écran, là où il se plaint
    //    de le perdre. 100 px : sous l'en-tête, comme sur sa capture.
    const HAUT_VOULU = 100;
    await page.evaluate(
      ([id, vise]) => {
        const r = document.querySelector(
          `[data-atlas="ligne-planifiee"][data-chantier="${id}"]`
        ) as HTMLElement;
        window.scrollBy({ top: r.getBoundingClientRect().top - (vise as number), behavior: "instant" as ScrollBehavior });
      },
      [longue.id, HAUT_VOULU] as [string, number]
    );
    await page.waitForTimeout(200);

    const avant = await hautDe(longue.id);
    // **Un contrôle qui ne peut pas se placer refuse de conclure.** Si la page
    // n'est pas assez haute pour amener ce client sous l'en-tête, le geste
    // qu'il décrit n'est pas rejoué — et un vert dirait le contraire.
    if (avant > 260) {
      throw new Error(
        `Le second client est à ${Math.round(avant)} px du haut : la page n'est pas assez ` +
          "longue pour rejouer son geste. Ce n'est pas le produit qui est en cause, c'est " +
          "ce montage."
      );
    }

    // 3. Son geste : il touche le nom.
    await rangeeDe(longue.id).locator('[data-atlas="nom-planifie"]').click();
    await page.waitForTimeout(400);

    const apres = await hautDe(longue.id);
    const saut = avant - apres;

    // **La ligne touchée reste sous le doigt.** Deux pixels de tolérance : le
    // rendu arrondit, il ne déplace pas.
    assert.ok(
      Math.abs(saut) <= 2,
      `le client touché a bougé de ${Math.round(saut)} px (${Math.round(avant)} → ` +
        `${Math.round(apres)}) : « il disparaît sous mes yeux »`
    );
    // Et il est toujours à l'écran, ce qui est la plainte elle-même.
    assert.ok(
      apres >= 0,
      `le client touché est passé au-dessus du bord de l'écran (${Math.round(apres)} px)`
    );

    // La fiche, elle, s'est bien ouverte — SOUS lui.
    const hauteurApres = await rangeeDe(longue.id).evaluate(
      (r) => r.getBoundingClientRect().height
    );
    assert.ok(
      hauteurApres > 120,
      `la fiche du client touché ne s'est pas ouverte (${Math.round(hauteurApres)} px)`
    );

    mkdirSync("artifacts/screenshots", { recursive: true });
    await page.screenshot({ path: "artifacts/screenshots/planning-ouverture-vers-le-bas.png" });
  });

  await test("À plusieurs équipes, le nom de l'équipe n'est écrit QU'UNE fois", async () => {
    await pool.query(
      `UPDATE entreprises SET nombre_equipes = 2
        WHERE id = (SELECT entreprise_id FROM chantiers WHERE id = $1)`,
      [journee.id]
    );
    // **L'équipe se coche dans `equipes_du_chantier` depuis la migration 0058**,
    // demi-journée par demi-journée. On la pose sur les deux moitiés : c'est ce
    // que voulait dire l'ancienne colonne `equipe_id`.
    await pool.query(
      `INSERT INTO equipes_du_chantier (entreprise_id, chantier_id, demi, equipe_id)
       SELECT c.entreprise_id, c.id, d.demi, e.id
         FROM chantiers c
         CROSS JOIN (VALUES ('matin'), ('apres_midi')) AS d(demi)
         JOIN equipes e ON e.entreprise_id = c.entreprise_id AND e.rang = 1
        WHERE c.id = $1
       ON CONFLICT DO NOTHING`,
      [journee.id]
    );
    await allerAuPlanning();
    await amenerSurLaSemaineDesCas();

    const l = await ligneDe(journee.id);
    // La pastille porte l'équipe. Si la phrase la porte aussi, le nom s'écrit
    // deux fois côte à côte — un doublon qu'aucune suite ne voyait, parce que
    // chacune ne regardait que sa moitié.
    assert.ok(
      !/quipe/.test(l.texte),
      `l'équipe est écrite dans la phrase ET sur la pastille : « ${l.texte} »`
    );
    // Et elle doit bien être quelque part : la retirer des deux endroits
    // laisserait la ligne muette sur qui s'en occupe.
    const rangee = page
      .locator(`[data-atlas="ligne-planifiee"][data-chantier="${journee.id}"]`)
      .first();
    const pastilles = await rangee.locator('[data-atlas="equipe"]').count();
    assert.equal(pastilles, 1, `la ligne porte ${pastilles} pastille(s) d'équipe, une attendue`);
  });

  // **Et une capture, parce que trois défauts réels de ce dépôt ont été trouvés
  // en REGARDANT** — une barre de navigation sur la page du client, l'ordre des
  // totaux d'une facture, une pile de notifications qui poussait tout hors de
  // l'écran. Aucun n'aurait rougi ici. Elle est prise à chaque passage, à la
  // largeur de son téléphone, et coûte une seconde.
  await allerAuPlanning();
  await amenerSurLaSemaineDesCas();
  await page.locator('[data-atlas="ligne-planifiee"]').first().scrollIntoViewIfNeeded();
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
