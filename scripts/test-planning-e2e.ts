// LE PLANNING REFAIT — la planche 84, jouée sur le vrai écran.
//
// **Ce que cette suite éprouve, et d'où vient chaque point.** Le patron a
// essayé `appli/planning-simple.html` deux soirées durant, corrigée neuf fois,
// puis tranché le 21 août 2026 : *« maintenant tu peux coder cette version de
// la maquette ! Ne modifie rien ! Ne change rien ! Code trait pour trait cette
// maquette. Prends le temps qu'il faut, je veux aucune erreur, aucun
// défaut ! »*
//
// Chaque contrôle porte la phrase qui l'a fait naître. Ils visent la STRUCTURE
// et les identifiants, jamais un libellé décoratif : un contrôle accroché à un
// mot rougirait le jour où il fait retirer ce mot — et c'est arrivé
// (`CLAUDE.md` §5 bis).
//
// **Ce que la suite de la maquette ne peut pas éprouver, et qui se joue ici :**
// que les gestes ATTEIGNENT LA BASE. La planche modifie un tableau en mémoire ;
// l'écran, lui, écrit — et c'est le seul endroit où l'on peut vérifier qu'une
// équipe cochée le matin n'a pas été écrite sur l'après-midi.

import { lancerNavigateur } from "./e2e-browser";
import assert from "node:assert";
import { Pool } from "pg";
import { creerPuisFiche } from "./_creer-chantier-e2e";

const BASE = "http://localhost:3000";
// DATABASE_URL, jamais une base codée en dur : la suite doit viser la même base
// que le serveur qu'elle pilote (atlas_dev en local, atlas_test en CI).
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

let reussis = 0;
let echecs = 0;
async function essai(nom: string, fn: () => Promise<void>) {
  try {
    await fn();
    reussis++;
    console.log(`  ✓ ${nom}`);
  } catch (e) {
    echecs++;
    console.error(`  ✗ ${nom}\n    ${(e as Error).message}`);
  }
}

/** Un lundi loin devant, hors du mois courant : le planning refuse le passé. */
function lundiDansDeuxMois(): string {
  const d = new Date();
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() + 2);
  while (d.getUTCDay() !== 1) d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

async function main() {
  console.log("=== Le planning refait, joué à l'écran ===\n");

  const navigateur = await lancerNavigateur();
  const contexte = await navigateur.newContext({ deviceScaleFactor: 2 });
  const page = await contexte.newPage();

  await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
  await page.fill('input[name="email"]', "demo@atlas.local");
  await page.fill('input[name="password"]', "demo1234");
  await page.click('button[type="submit"]');
  await page.waitForURL(`${BASE}/`, { timeout: 30_000 });

  // ─── Le montage : un chantier à poser, et DEUX équipes ──────────────────
  //
  // Deux, parce que c'est le cas qu'il a validé : à une seule, il n'y a
  // personne à désigner et la pastille disparaît (règle du 10 août 2026).
  //
  // La fiche client n'a plus qu'un bouton depuis le 21 août — *« garde un seul
  // bouton, garde je rédige mon devis »* : le chemin vers un chantier neuf passe
  // par `creerPuisFiche`, partagé par les soixante-treize suites qui en ont
  // besoin (`scripts/_creer-chantier-e2e.ts`).
  const client = `M. Planche ${Date.now()}`;
  await page.goto(`${BASE}/chantiers/nouveau`, { waitUntil: "networkidle" });
  await page.fill('input[placeholder="Bernard"]', client);
  await page.fill('input[placeholder="06 12 34 56 78"]', "05 56 00 00 12");
  await creerPuisFiche(page);
  await page.waitForURL(/\/chantiers\/[0-9a-f-]{36}/, { timeout: 15_000 });
  const chantierId = page.url().split("/").pop()!;

  const r = await pool.query(
    `UPDATE chantiers SET devis_envoye_at = now(), adresse_chantier = '4 rue des Ormes, Nantes'
      WHERE id = $1`,
    [chantierId]
  );
  if (r.rowCount !== 1) {
    throw new Error(
      "Le montage n'a pas pu marquer le devis envoyé : le rôle de test ne traverse " +
        "probablement plus RLS (voir CLAUDE.md §5)."
    );
  }
  await pool.query(
    `UPDATE entreprises SET nombre_equipes = 2
      WHERE id = (SELECT entreprise_id FROM chantiers WHERE id = $1)`,
    [chantierId]
  );
  // **Deux équipes NOMMÉES, comme sur la planche et comme chez lui.**
  //
  // Sans nom, l'écran écrit son étiquette de repli — « Équipe A » —, qui mesure
  // 91 px là où « Équipe ? » en fait 75 : seize de plus que tout ce que la
  // planche 84 dessine, et la ligne déborde alors de quatre pixels. Ce cas-là
  // existe (une entreprise qui n'a pas nommé ses équipes) et il est noté dans
  // `TODO.md` pour lui être montré — il ne se répare pas ici, parce que le
  // corriger, c'est retoucher un dessin qu'il a validé (`CLAUDE.md` §3 bis).
  //
  // Ce que ce décor doit reproduire, c'est SON écran : ses équipes portent
  // « Paul » et « Julien » depuis le 21 août, et c'est ce que la planche montre.
  await pool.query(
    `INSERT INTO equipes (entreprise_id, rang, nom)
     SELECT c.entreprise_id, x.rang, x.nom
       FROM chantiers c, (VALUES (1, 'Paul'), (2, 'Julien')) AS x(rang, nom)
      WHERE c.id = $1
     ON CONFLICT (entreprise_id, rang) DO UPDATE SET nom = EXCLUDED.nom`,
    [chantierId]
  );

  // **Le devis du chantier, et ses deux lignes.** Le planning ne liste que des
  // chantiers dont le devis est parti : sans lui, le décor décrirait un état
  // que le produit ne peut pas atteindre, et la feuille n'aurait rien à
  // imprimer. Les lignes sont posées en base plutôt que saisies à l'écran — le
  // parcours complet du devis est éprouvé ailleurs, et le rejouer ici
  // ajouterait deux minutes pour ne rien apprendre sur le planning.
  //
  // **On PREND le devis existant, on n'en crée pas un second.** Depuis le
  // 21 août, `creerPuisFiche` passe par l'écran du devis — la création en pose
  // donc déjà un, en version 1. Le décor qui en insérait un de plus butait sur
  // `devis_chantier_version_uk`, et l'erreur accusait la contrainte plutôt que
  // le décor. Un décor doit partir de ce que le produit vient de faire, pas de
  // ce qu'il faisait l'avant-veille.
  const dejaLa = await pool.query(
    `SELECT id FROM devis WHERE chantier_id = $1 ORDER BY numero_version DESC LIMIT 1`,
    [chantierId]
  );
  const devisId = (dejaLa.rowCount
    ? dejaLa
    : await pool.query(
        `INSERT INTO devis (entreprise_id, chantier_id, numero_commercial, numero_version,
                            statut, entreprise_nom, date_emission, total_ht, total_tva, total_ttc)
         SELECT c.entreprise_id, c.id, 'D-PLANCHE-' || substr(c.id::text, 1, 8), 1,
                'brouillon', 'Atelier Démo', CURRENT_DATE, 1000, 200, 1200
           FROM chantiers c WHERE c.id = $1
         RETURNING id`,
        [chantierId]
      )
  ).rows[0].id as string;

  // **Les lignes AVANT l'envoi** : `empecher_modification_lignes_devis_envoye`
  // refuse toute ligne sur un devis parti — c'est l'invariant du dépôt
  // (migration 0001), et le décor s'y plie comme le produit s'y plie.
  await pool.query(`UPDATE devis SET statut = 'brouillon' WHERE id = $1`, [devisId]);
  await pool.query(`DELETE FROM lignes_devis WHERE devis_id = $1`, [devisId]);
  await pool.query(
    `INSERT INTO lignes_devis (entreprise_id, devis_id, libelle, quantite, prix_unitaire, montant, ordre)
     SELECT d.entreprise_id, d.id, x.libelle, x.qte, x.pu, x.montant, x.ordre
       FROM devis d,
            (VALUES ('Taille de haie de laurier', 18, 40, 720, 0),
                    ('Évacuation des déchets verts', 1, 280, 280, 1))
              AS x(libelle, qte, pu, montant, ordre)
      WHERE d.id = $1`,
    [devisId]
  );
  await pool.query(`UPDATE devis SET statut = 'envoye' WHERE id = $1`, [devisId]);

  const nom = (await pool.query(`SELECT nom FROM chantiers WHERE id = $1`, [chantierId])).rows[0]
    .nom as string;

  /** Ce que la base porte pour ce chantier — la seule vérité qui compte. */
  const enBase = async () => {
    const { rows } = await pool.query(
      `SELECT c.date_planifiee::text AS jour, c.creneau_debut, c.duree_demi_journees,
              coalesce(json_agg(json_build_object('demi', ec.demi, 'rang', e.rang))
                       FILTER (WHERE ec.id IS NOT NULL), '[]') AS equipes
         FROM chantiers c
         LEFT JOIN equipes_du_chantier ec ON ec.chantier_id = c.id
         LEFT JOIN equipes e ON e.id = ec.equipe_id
        WHERE c.id = $1
        GROUP BY c.id`,
      [chantierId]
    );
    return rows[0] as {
      jour: string | null;
      creneau_debut: string | null;
      duree_demi_journees: number | null;
      equipes: { demi: string; rang: number }[];
    };
  };

  /**
   * Attendre que la BASE dise ce qu'on attend — jamais un délai fixe.
   *
   * **Une attente au chronomètre ment dans les deux sens** : trop courte sous
   * charge, elle fait rougir un geste qui a marché ; trop longue, elle allonge
   * la batterie pour rien. Ici l'on interroge ce qui compte, et l'on s'arrête
   * dès que c'est vrai.
   */
  const attendre = async (quoi: string, vrai: () => Promise<boolean>) => {
    for (let i = 0; i < 40; i++) {
      if (await vrai()) return;
      await page.waitForTimeout(250);
    }
    throw new Error(`dix secondes plus tard, toujours pas : ${quoi}`);
  };

  const rangsDe = async (demi: string) =>
    (await enBase()).equipes
      .filter((e) => e.demi === demi)
      .map((e) => e.rang)
      .sort((a, b) => a - b);

  const JOUR = lundiDansDeuxMois();
  const allerAuPlanning = async () => {
    await page.goto(`${BASE}/planning`, { waitUntil: "domcontentloaded" });
    await page.waitForSelector('[data-atlas="grille-mois"]', { timeout: 30_000 });
  };

  /**
   * Amener le calendrier sur le mois du jour visé, puis toucher ce jour.
   *
   * **Idempotent, et ce n'est pas un confort.** Toucher un jour DÉJÀ ouvert le
   * REFERME — c'est le geste de l'écran, et c'est juste. Un contrôle qui
   * appellerait deux fois de suite fermerait donc la fiche qu'il s'apprête à
   * mesurer, et accuserait le produit d'un défaut qu'il vient de fabriquer.
   */
  const toucherLeJour = async (jour: string) => {
    const dejaOuverte = page.locator(`[data-atlas="carte-jour"][data-jour="${jour}"]`);
    if (await dejaOuverte.count()) return;
    for (let i = 0; i < 24; i++) {
      if (await page.locator(`[data-atlas="grille-mois"] [data-jour="${jour}"]`).count()) break;
      await page.click('button[aria-label="Mois suivant"]');
      await page.waitForTimeout(150);
    }
    const laCase = page.locator(`[data-atlas="grille-mois"] [data-jour="${jour}"]`);
    assert.ok(await laCase.count(), `le calendrier n'atteint pas le ${jour}`);
    await laCase.click();
    await page.waitForSelector(`[data-atlas="carte-jour"][data-jour="${jour}"]`, {
      timeout: 15_000,
    });
  };

  // ─── LE MOIS ────────────────────────────────────────────────────────────

  await allerAuPlanning();

  // *« Les jours des autres mois disparaissent »* — ils ne portaient rien, et
  // six cases de chiffres gris se lisent quand même.
  await essai("les jours des autres mois ne s'écrivent plus du tout", async () => {
    const creux = page.locator('[data-atlas="grille-mois"] [data-atlas="creux"]');
    const combien = await creux.count();
    assert.ok(combien > 0, "aucune case creuse : la grille ne déborde-t-elle plus du mois ?");
    for (let i = 0; i < combien; i++) {
      assert.equal(
        (await creux.nth(i).innerText()).trim(),
        "",
        "une case hors du mois porte encore un chiffre"
      );
    }
  });

  // **Sa question du 21 août : « comment tu vas faire s'il y a dix équipes ? »**
  // La barre se remplit à la proportion, et chaque case en porte DEUX.
  await essai("chaque jour du mois porte ses deux barres, matin et après-midi", async () => {
    const cases = page.locator('[data-atlas="grille-mois"] [data-jour]');
    const combien = await cases.count();
    assert.ok(combien >= 28, `le mois ne montre que ${combien} jours`);
    const mesures = await page.$$eval('[data-atlas="grille-mois"] [data-demi]', (n) =>
      n.map((e) => ({ demi: e.getAttribute("data-demi"), h: e.getBoundingClientRect().height }))
    );
    assert.equal(mesures.length, combien * 2, "il ne sort pas deux barres par jour");
    // **Un contrôle qui mesure ZÉRO ne mesure rien** (`CLAUDE.md` §5) : deux
    // barres écrasées à zéro pixel satisferaient tout ce qui précède.
    assert.ok(
      mesures.every((m) => m.h >= 4),
      "une barre est écrasée à moins de quatre pixels : elle ne montre rien"
    );
  });

  await essai("la légende dit les quatre états, et la position", async () => {
    const dit = (await page.locator('[data-atlas="legende"]').innerText()).toLowerCase();
    for (const mot of ["rien", "incomplet", "complet", "au-delà", "matin", "après-midi"]) {
      assert.ok(dit.includes(mot), `« ${mot} » manque à la légende : « ${dit} »`);
    }
  });

  // **Sa correction du 21 août au soir :** *« le rectangle du matin, mets-le
  // blanc comme celui de l'après-midi »*. Rempli, il se lisait comme un
  // cinquième état, juste après « au-delà ».
  await essai("les deux rectangles de position restent vides", async () => {
    assert.equal(
      await page.locator('[data-atlas="legende-position"] [data-atlas="seg"]').count(),
      0,
      "un rectangle de position porte une couleur : il se lit comme un état"
    );
  });

  // ─── POSER, DEPUIS « SANS DATE » ────────────────────────────────────────

  await essai("tant qu'aucun jour n'est touché, « Sans date » le dit", async () => {
    const dit = await page.locator('[data-atlas="ou-poser"]').innerText();
    assert.match(dit, /Touchez d’abord un jour/, `lu : « ${dit} »`);
  });

  await essai("le chantier attend son jour dans « Sans date »", async () => {
    await page.locator(`[data-atlas="sans-date"]:has-text("${nom}")`).first().waitFor({
      state: "visible",
      timeout: 15_000,
    });
  });

  await essai("toucher un jour ouvre sa fiche, et dit les deux demi-journées libres", async () => {
    await toucherLeJour(JOUR);
    const carte = page.locator(`[data-atlas="carte-jour"][data-jour="${JOUR}"]`);
    const libres = carte.locator('[data-sans-chantier="1"]');
    assert.equal(await libres.count(), 2, "une journée vide doit annoncer ses deux moitiés");
    const dit = (await carte.innerText()).toLowerCase();
    assert.ok(dit.includes("libre"), `la fiche ne dit pas « libre » : « ${dit} »`);
  });

  await essai("poser sur la journée écrit la date ET la durée en base", async () => {
    await page
      .locator(`[data-atlas="sans-date"]:has-text("${nom}")`)
      .first()
      .locator('[data-poser="journee"]')
      .click();
    await attendre("la date est écrite", async () => (await enBase()).jour === JOUR);
    const c = await enBase();
    assert.equal(c.jour, JOUR, "la date n'est pas celle du jour touché");
    assert.equal(c.creneau_debut, "matin", "une journée part le matin");
    assert.equal(c.duree_demi_journees, 2, "une journée fait deux demi-journées");
  });

  // ─── LA FICHE DU JOUR — sa correction du 21 août au soir ────────────────
  //
  // *« Mr. Leroy au-dessus du carré vert clair matin ; supprime le Mr. Leroy
  // pour l'aprem, c'est le même chantier, pas besoin de répéter ; pareil pour
  // "1 chantier" ; et supprime le trait entre le matin et l'après-midi, là on a
  // l'impression que c'est deux chantiers différents. »*

  await essai("un chantier à la journée n'écrit son nom qu'UNE fois", async () => {
    await allerAuPlanning();
    await toucherLeJour(JOUR);
    const carte = page.locator(`[data-atlas="carte-jour"][data-jour="${JOUR}"]`);
    const noms = await carte.locator('[data-atlas="nom-du-jour"]').allInnerTexts();
    assert.deepEqual(noms, [nom], `le nom est écrit ${noms.length} fois : ${JSON.stringify(noms)}`);
  });

  // **Le compte gris a été RETIRÉ à sa demande du 22 août** — *« supprime-moi
  // la notion "un chantier" en gris, on n'a pas besoin de cette
  // information-là »*. Le contrôle ne réclame donc plus le libellé : il vérifie
  // que ce que ce libellé disait se lit encore, aux pastilles des
  // demi-journées. Écrire une assertion sur un mot qu'il a fait enlever rendrait
  // son écran impossible à changer (`CLAUDE.md` §5 bis).
  await essai("le compte gris a disparu, et la charge se lit encore aux pastilles", async () => {
    const carte = page.locator(`[data-atlas="carte-jour"][data-jour="${JOUR}"]`);
    assert.equal(
      await carte.locator('[data-atlas="compte-jour"]').count(),
      0,
      "le compte « 1 chantier » est revenu alors qu'il l'a fait retirer"
    );
    const pastilles = await carte.locator('[data-atlas="demi"] [data-atlas="pastille"]').count();
    assert.ok(pastilles >= 2, `la charge ne se lit plus nulle part : ${pastilles} pastille(s)`);
  });

  await essai("le nom passe AU-DESSUS de la ligne du matin", async () => {
    const m = await page.evaluate((jour) => {
      const carte = document.querySelector(`[data-atlas="carte-jour"][data-jour="${jour}"]`)!;
      const nom = carte.querySelector('[data-atlas="nom-du-jour"]')!.getBoundingClientRect();
      const lignes = [...carte.querySelectorAll('[data-atlas="demi"]')].map((e) =>
        e.getBoundingClientRect()
      );
      return {
        basDuNom: Math.round(nom.bottom),
        hautDuMatin: Math.round(lignes[0].top),
        hauteurs: lignes.map((l) => Math.round(l.height)),
      };
    }, JOUR);
    assert.ok(
      m.basDuNom <= m.hautDuMatin,
      `le nom finit à ${m.basDuNom} px, la ligne du matin commence à ${m.hautDuMatin}`
    );
    // Un contrôle qui mesure zéro ne mesure rien.
    assert.equal(m.hauteurs.length, 2, "les deux demi-journées ne sont pas là");
    assert.ok(
      m.hauteurs.every((h) => h >= 20),
      `une ligne est écrasée : ${JSON.stringify(m.hauteurs)}`
    );
  });

  // **Mesuré sur la bordure calculée, pas sur l'absence d'une classe** : une
  // règle CSS oubliée ailleurs repeindrait le trait sans qu'aucun nom ne change.
  await essai("aucun trait ne sépare le matin de l'après-midi", async () => {
    const filets = await page.$$eval(
      '[data-atlas="carte-jour"] [data-atlas="demi"]',
      (n) => n.map((e) => parseFloat(getComputedStyle(e).borderTopWidth))
    );
    assert.ok(filets.length >= 2, "moins de deux demi-journées à mesurer");
    assert.ok(
      filets.every((f) => f === 0),
      `un trait sépare les demi-journées : ${JSON.stringify(filets)}`
    );
  });

  // ─── LES ÉQUIPES — ses deux demandes du 21 août ─────────────────────────

  await essai("cocher une équipe le matin ne touche pas l'après-midi", async () => {
    const carte = page.locator(`[data-atlas="carte-jour"][data-jour="${JOUR}"]`);
    await carte.locator('[data-bloc="matin"] [data-atlas="equipe"]').click();
    await carte.locator('[data-bloc="matin"] [data-choix="1"]').click();
    await attendre("l'équipe 1 est cochée le matin", async () =>
      (await rangsDe("matin")).includes(1)
    );
    assert.deepEqual(await rangsDe("matin"), [1], "le matin n'a pas pris l'équipe 1");
    assert.deepEqual(await rangsDe("apres_midi"), [], "l'après-midi a bougé tout seul");
  });

  await essai("plusieurs équipes tiennent sur la même demi-journée", async () => {
    const carte = page.locator(`[data-atlas="carte-jour"][data-jour="${JOUR}"]`);
    await carte.locator('[data-bloc="matin"] [data-choix="2"]').click();
    await attendre("l'équipe 2 s'ajoute", async () => (await rangsDe("matin")).length === 2);
    assert.deepEqual(await rangsDe("matin"), [1, 2], "la seconde équipe n'a pas été ajoutée");
  });

  await essai("le même appui décoche", async () => {
    const carte = page.locator(`[data-atlas="carte-jour"][data-jour="${JOUR}"]`);
    await carte.locator('[data-bloc="matin"] [data-choix="2"]').click();
    await attendre("l'équipe 2 se retire", async () => (await rangsDe("matin")).length === 1);
    assert.deepEqual(await rangsDe("matin"), [1], "l'équipe 2 est restée");
  });

  await essai("« Terminé » referme la liste et rend la pastille", async () => {
    const carte = page.locator(`[data-atlas="carte-jour"][data-jour="${JOUR}"]`);
    await carte.locator('[data-bloc="matin"] [data-fini="1"]').click();
    await page.waitForTimeout(400);
    const pastille = carte.locator('[data-bloc="matin"] [data-atlas="equipe"]');
    await pastille.waitFor({ state: "visible", timeout: 10_000 });
    assert.equal(await pastille.getAttribute("data-vide"), "0", "la pastille se dit encore vide");
  });

  await essai("l'après-midi porte sa propre liste, et n'a pris personne", async () => {
    const carte = page.locator(`[data-atlas="carte-jour"][data-jour="${JOUR}"]`);
    const pastille = carte.locator('[data-bloc="apres_midi"] [data-atlas="equipe"]');
    assert.equal(await pastille.getAttribute("data-vide"), "1");
    assert.equal((await pastille.innerText()).trim(), "Équipe ?");
  });

  // ─── DÉPLACER ───────────────────────────────────────────────────────────

  // **Sa ligne tient sur UN trait, et cela se mesure.**
  //
  // Trouvé le 21 août 2026 en REGARDANT une capture : sur un chantier dont
  // l'équipe n'est pas choisie, « Équipe ? » est plus large qu'un prénom, et
  // « Retirer » basculait à la ligne suivante. La planche 84 ne se replie pas :
  // elle resserre les petits boutons d'une ligne de demi-journée
  // (`.demi .petit{padding:7px 9px}`), et la transcription avait perdu la règle.
  //
  // **On mesure des HAUTEURS D'ORIGINE, pas des largeurs.** Deux boutons sur la
  // même ligne partagent le même `top` ; un bouton replié tombe plus bas. C'est
  // insensible à la police, au zoom et à la longueur des mots — là où comparer
  // des largeurs demanderait de refaire le calcul de l'écran, et divergerait
  // (`CLAUDE.md` §3).
  await essai("la ligne d'une demi-journée ne se replie jamais", async () => {
    const lignes = await page.evaluate((jour) => {
      const carte = document.querySelector(`[data-atlas="carte-jour"][data-jour="${jour}"]`);
      if (!carte) return null;
      return [...carte.querySelectorAll('[data-atlas="demi"]')].map((d) => {
        const hauts = [...d.children]
          .map((e) => e.getBoundingClientRect())
          .filter((b) => b.width > 0 && b.height > 0)
          .map((b) => Math.round(b.top));
        const larg = [...d.children]
          .map((e) => e.getBoundingClientRect())
          .filter((b) => b.width > 0)
          .map((b) => Math.round(b.width));
        return {
          dit: (d.textContent ?? "").replace(/\s+/g, " ").trim(),
          hauts,
          larg,
          dispo: Math.round(d.getBoundingClientRect().width),
        };
      });
    }, JOUR);

    assert.ok(lignes && lignes.length > 0, "la fiche du jour ne porte aucune demi-journée");
    for (const l of lignes) {
      // Une boîte de zéro pixel ne se mesure pas : refuser plutôt que de rendre
      // un vert sur rien (`CLAUDE.md` §5).
      assert.ok(l.hauts.length >= 2, `« ${l.dit} » : rien de visible à mesurer`);
      const ecart = Math.max(...l.hauts) - Math.min(...l.hauts);
      assert.ok(
        ecart <= 12,
        `la ligne « ${l.dit} » se replie : ${ecart} px de décalage. ` +
          `Largeurs ${JSON.stringify(l.larg)} dans ${l.dispo} px.`
      );
    }
  });

  await essai("« Déplacer » propose les trois moments, et écrit le choix", async () => {
    const carte = page.locator(`[data-atlas="carte-jour"][data-jour="${JOUR}"]`);
    await carte.locator('[data-bloc="matin"] [data-atlas="deplacer"]').click();
    const moments = await carte.locator("[data-vers]").allInnerTexts();
    assert.deepEqual(moments, ["Matin", "Après-midi", "Journée"], `lu : ${JSON.stringify(moments)}`);
    await carte.locator('[data-vers="apres"]').click();
    await attendre("le chantier passe l'après-midi", async () =>
      (await enBase()).creneau_debut === "apres_midi"
    );
    const c = await enBase();
    assert.equal(c.creneau_debut, "apres_midi");
    assert.equal(c.duree_demi_journees, 1);
  });

  await essai("déplacé sur l'après-midi, le matin redevient libre", async () => {
    await allerAuPlanning();
    await toucherLeJour(JOUR);
    const carte = page.locator(`[data-atlas="carte-jour"][data-jour="${JOUR}"]`);
    const libres = carte.locator('[data-sans-chantier="1"]');
    assert.equal(await libres.count(), 1, "une seule demi-journée devrait être libre");
    assert.equal(await libres.first().getAttribute("data-bloc"), "matin");
  });

  // **Le nom passe devant ce qui reste libre** — *« fais pareil pour les
  // autres, le nom toujours en premier ! »*
  await essai("le nom du client passe AVANT la demi-journée libre", async () => {
    const ordre = await page.evaluate((jour) => {
      const carte = document.querySelector(`[data-atlas="carte-jour"][data-jour="${jour}"]`)!;
      const nom = carte.querySelector('[data-atlas="nom-du-jour"]')!.getBoundingClientRect().top;
      const libre = carte.querySelector('[data-sans-chantier="1"]')!.getBoundingClientRect().top;
      return { nom: Math.round(nom), libre: Math.round(libre) };
    }, JOUR);
    assert.ok(
      ordre.nom < ordre.libre,
      `« libre » (${ordre.libre} px) ouvre la fiche avant le nom (${ordre.nom} px)`
    );
  });

  // ─── LA FEUILLE DE CHANTIER — le devis sans les prix ────────────────────

  await essai("le nom du client ouvre la feuille de chantier", async () => {
    await page.locator('[data-atlas="nom-du-jour"]').first().click();
    await page.waitForSelector('[data-atlas="feuille"]', { timeout: 15_000 });
  });

  // *« Reprends l'adresse cliquable qui ouvre Maps ou Waze — pas besoin d'en
  // mettre trois —, la possibilité d'appeler le client et de copier
  // l'adresse. »* On éprouve les ADRESSES des liens, pas leurs libellés : un
  // bouton nommé « Waze » qui pointe ailleurs se lit juste et ne mène nulle part.
  await essai("la feuille porte Maps, Waze, et l'appel — pas Google", async () => {
    const feuille = page.locator('[data-atlas="feuille"]');
    const liens = await feuille.locator("a").evaluateAll((n) =>
      n.map((e) => (e as HTMLAnchorElement).getAttribute("href") ?? "")
    );
    assert.ok(
      liens.some((h) => h.startsWith("https://maps.apple.com/")),
      `Maps manque : ${JSON.stringify(liens)}`
    );
    assert.ok(
      liens.some((h) => h.startsWith("https://waze.com/")),
      `Waze manque : ${JSON.stringify(liens)}`
    );
    assert.ok(
      !liens.some((h) => h.includes("google.com/maps")),
      "Google Maps est revenu : il en voulait deux, pas trois"
    );
    assert.ok(
      liens.some((h) => h.startsWith("tel:")),
      `l'appel manque : ${JSON.stringify(liens)}`
    );
  });

  await essai("l'adresse ne s'affiche plus, mais elle sert toujours", async () => {
    const dit = await page.locator('[data-atlas="feuille"]').innerText();
    assert.ok(
      !dit.includes("rue des Ormes"),
      `l'adresse est réapparue dans la feuille : « ${dit} »`
    );
  });

  // **Le contrôle qui compte** : ce PDF est ce que le salarié emporte, et il ne
  // doit porter AUCUN prix. On le télécharge pour de bon.
  await essai("la feuille porte les lignes du devis, sans un prix", async () => {
    // **Attendre que la lecture soit FINIE, jamais un délai.** Les lignes
    // arrivent par une action serveur — la plupart des journées ne s'ouvrent sur
    // aucune feuille, et les charger avec la page ferait payer à chaque
    // ouverture du planning ce qui ne sert qu'à un appui. Lire l'encart pendant
    // qu'il dit encore « Lecture du devis… », c'est mesurer un écran qui n'a pas
    // fini de se peindre, et accuser le produit d'un défaut qu'on vient de
    // fabriquer.
    await attendre("la feuille a fini de lire le devis", async () =>
      !(await page.locator('[data-atlas="feuille"]').innerText()).includes("Lecture du devis")
    );
    const dit = await page.locator('[data-atlas="feuille"]').innerText();
    assert.ok(dit.trim().length > 0, "la feuille est vide : il n'y a rien à mesurer");
    assert.ok(
      dit.includes("Taille de haie de laurier"),
      `la feuille ne porte pas les lignes du devis : « ${dit} »`
    );
    // **Aucun montant nulle part** — c'est toute la raison d'être de cette
    // feuille : *« le salarié ne doit pas avoir accès au prix »*.
    assert.ok(
      !/\d[\d\s]*[,.]\d{2}\s*€|€/.test(dit),
      `un prix s'est glissé dans la feuille : « ${dit} »`
    );
  });

  await essai("le PDF de la feuille répond, et ne porte aucun prix", async () => {
    const lien = page.locator('[data-atlas="pdf-sans-prix"]');
    const href = await lien.getAttribute("href");
    assert.equal(href, `/api/chantiers/${chantierId}/feuille/pdf`);
    const reponse = await page.request.get(`${BASE}${href}`);
    assert.equal(reponse.status(), 200, `le PDF répond ${reponse.status()}`);
    const octets = Buffer.from(await reponse.body());
    assert.ok(octets.length > 500, `le PDF ne fait que ${octets.length} octets`);
    assert.equal(octets.subarray(0, 4).toString("latin1"), "%PDF", "ce n'est pas un PDF");
    // Le texte d'un PDF n'est pas lisible en clair : ce qu'on vérifie ici, c'est
    // que le document EXISTE et se sert. Que ses colonnes de prix soient bien
    // absentes est éprouvé au niveau du dessin, sans navigateur
    // (`test-fiche-chantier-pdf.ts` fait de même pour la fiche).
  });

  // ─── RETIRER : le chantier revient à « Sans date » ──────────────────────

  await essai("« Retirer » rend le chantier à « Sans date », sans l'effacer", async () => {
    await allerAuPlanning();
    await toucherLeJour(JOUR);
    await page.locator('[data-atlas="carte-jour"] [data-atlas="retirer"]').first().click();
    await attendre("le chantier quitte le jour", async () => (await enBase()).jour === null);
    const c = await enBase();
    assert.equal(c.jour, null, "la date est restée");
    await allerAuPlanning();
    await page.locator(`[data-atlas="sans-date"]:has-text("${nom}")`).first().waitFor({
      state: "visible",
      timeout: 15_000,
    });
  });

  // ─── AJOUTER DEPUIS LA FICHE : d'abord QUI, ensuite QUAND ───────────────

  await essai("« Ajouter un chantier » demande d'abord QUI", async () => {
    await toucherLeJour(JOUR);
    await page.locator('[data-atlas="carte-jour"] [data-atlas="ajouter"]').click();
    await page.waitForSelector(`[data-qui="${chantierId}"]`, { timeout: 10_000 });
  });

  await essai("puis QUAND — et le geste atteint la base", async () => {
    await page.locator(`[data-qui="${chantierId}"]`).click();
    const moments = await page.locator("[data-quand]").allInnerTexts();
    assert.deepEqual(moments, ["Matin", "Après-midi", "Journée"], `lu : ${JSON.stringify(moments)}`);
    await page.locator('[data-quand="matin"]').click();
    await attendre("le chantier est reposé", async () => (await enBase()).jour === JOUR);
    const c = await enBase();
    assert.equal(c.jour, JOUR);
    assert.equal(c.creneau_debut, "matin");
    assert.equal(c.duree_demi_journees, 1);
  });

  // ─── LA SEMAINE — elle ne gouverne QUE les planifiés ────────────────────

  await essai("toucher un jour du mois amène la liste sur SA semaine", async () => {
    await allerAuPlanning();
    await toucherLeJour(JOUR);
    const titre = await page.locator('[data-atlas="semaine-titre"]').innerText();
    const jour = new Date(`${JOUR}T12:00:00Z`).getUTCDate();
    assert.ok(
      titre.startsWith(`${jour} `) || titre.startsWith(`${jour} –`),
      `la semaine du ${JOUR} devrait s'ouvrir sur le ${jour} — lu : « ${titre} »`
    );
  });

  // **La ligne dit la DURÉE, plus le moment** — sa demande du 22 août 2026,
  // éprouvée sur la planche 86 puis retenue : *« ce n'est pas clair quand il y
  // a marqué le matin et l'après-midi »*. La demi-journée se lit toujours, mais
  // sur la ligne MATIN du volet, une fois déplié.
  await essai("le chantier posé figure dans les planifiés, avec sa DURÉE", async () => {
    const ligne = page.locator(`[data-atlas="ligne-planifiee"]:has-text("${nom}")`).first();
    await ligne.waitFor({ state: "visible", timeout: 15_000 });
    const duree = (
      await ligne.locator('[data-atlas="duree-planifiee"]').innerText()
    ).toLowerCase();
    assert.ok(
      /demi-journée|journée|jours/.test(duree),
      `la ligne ne dit pas la durée du chantier : « ${duree} »`
    );
    assert.ok(
      !/^matin$|^après-midi$/.test(duree),
      `le moment est revenu à la place de la durée : « ${duree} »`
    );
  });

  // **SA CORRECTION DU 22 AOÛT 2026, sur la planche 86 :** *« sur le premier
  // chantier, l'après-midi de libre passe sous la feuille de chantier ; or il
  // doit rester en dessous du matin même s'il est libre, ça ne change rien »*.
  //
  // La demi-journée vide appartient à la JOURNÉE, pas au chantier : elle se
  // rangeait donc après lui, c'est-à-dire après sa feuille, à trois écrans du
  // matin qu'elle complète.
  //
  // **Aucun contrôle pur ne peut voir ce défaut** : `blocsDeLaJournee` mettait
  // déjà le libre au bon rang, et c'est la feuille — rendue en dehors de ces
  // blocs — qui s'intercalait. Il faut donc mesurer à l'écran.
  await essai("une demi-journée libre reste sous le matin, AU-DESSUS de la feuille", async () => {
    await pool.query(
      `UPDATE chantiers SET creneau_debut = 'matin', duree_demi_journees = 1 WHERE id = $1`,
      [chantierId]
    );
    await allerAuPlanning();
    await toucherLeJour(JOUR);
    const ligne = page.locator(`[data-atlas="ligne-planifiee"]:has-text("${nom}")`).first();
    await ligne.waitFor({ state: "visible", timeout: 15_000 });
    await ligne.locator('[data-atlas="nom-planifie"]').click();
    await ligne.locator('[data-atlas="feuille"]').waitFor({ state: "visible", timeout: 15_000 });

    // **Aucune fonction déclarée DANS l'évaluation.** `tsx` la compile avec
    // esbuild, qui nomme chaque fonction interne par un helper `__name` absent
    // du navigateur : l'évaluation lève alors « __name is not defined », et le
    // contrôle accuse le produit d'un défaut que l'outillage vient de créer.
    const m = await ligne.evaluate((n) => {
      const matin = n.querySelector('[data-bloc="matin"]');
      const aprem = n.querySelector('[data-bloc="apres_midi"]');
      const feuille = n.querySelector('[data-atlas="feuille"]');
      return {
        matin: matin ? Math.round(matin.getBoundingClientRect().top) : null,
        aprem: aprem ? Math.round(aprem.getBoundingClientRect().top) : null,
        feuille: feuille ? Math.round(feuille.getBoundingClientRect().top) : null,
        hauteurAprem: aprem ? Math.round(aprem.getBoundingClientRect().height) : 0,
      };
    });

    // **Un contrôle qui mesure zéro ne mesure rien** (`CLAUDE.md` §5) : sans
    // ces trois éléments, les comparaisons ci-dessous seraient vraies sur du
    // vide.
    assert.ok(m.matin !== null, "la ligne du matin est absente");
    assert.ok(m.aprem !== null, "la demi-journée libre est absente : elle a été cachée");
    assert.ok(m.feuille !== null, "la feuille de chantier ne s'est pas ouverte");
    assert.ok(m.hauteurAprem >= 12, `la demi-journée libre est écrasée : ${m.hauteurAprem} px`);

    assert.ok(
      m.matin! < m.aprem!,
      `l'après-midi (${m.aprem}) passe avant le matin (${m.matin})`
    );
    assert.ok(
      m.aprem! < m.feuille!,
      `la demi-journée libre (${m.aprem}) est retombée SOUS la feuille (${m.feuille})`
    );

    await pool.query(
      `UPDATE chantiers SET creneau_debut = 'matin', duree_demi_journees = 2 WHERE id = $1`,
      [chantierId]
    );
    // La page est rendue là où ce contrôle l'a prise : les suivants s'appuient
    // sur la semaine ouverte plus haut.
    await allerAuPlanning();
    await toucherLeJour(JOUR);
  });

  await essai("la flèche de la semaine ne change PAS le mois", async () => {
    const moisAvant = await page.locator('[data-atlas="mois-titre"]').innerText();
    await page.click('button[aria-label="Semaine suivante"]');
    await page.waitForTimeout(400);
    assert.equal(
      await page.locator('[data-atlas="mois-titre"]').innerText(),
      moisAvant,
      "la flèche de la semaine a fait bouger le calendrier : deux navigations qui se marchent dessus"
    );
    await page.click('button[aria-label="Semaine précédente"]');
    await page.waitForTimeout(400);
  });

  // **Sa demande du 21 août :** *« quand je clique sur Monsieur Martins dans la
  // liste, il faut que ça m'affiche le même bandeau déroulant que lorsque je
  // clique sur un chiffre du planning du mois [...] il faut que les deux
  // s'affichent »* — la journée ET la feuille.
  await essai("un nom des planifiés ouvre SA journée et SA feuille", async () => {
    await page
      .locator(`[data-atlas="ligne-planifiee"]:has-text("${nom}")`)
      .first()
      .locator('[data-atlas="nom-planifie"]')
      .click();
    await page.waitForSelector('[data-atlas="feuille"]', { timeout: 15_000 });
    const cartes = page.locator(`[data-atlas="carte-jour"][data-jour="${JOUR}"]`);
    assert.ok((await cartes.count()) >= 1, "la journée ne s'est pas ouverte sous la ligne");
  });

  // ─── LE RETOUR « AUJOURD'HUI » ──────────────────────────────────────────

  await essai("le retour n'existe QUE si l'on s'est éloigné", async () => {
    await allerAuPlanning();
    assert.equal(
      await page.locator('[data-atlas="retour-aujourdhui"]').count(),
      0,
      "le retour s'affiche alors qu'on est sur le mois courant"
    );
    await page.click('button[aria-label="Mois suivant"]');
    await page.waitForTimeout(300);
    await page.locator('[data-atlas="retour-aujourdhui"]').waitFor({
      state: "visible",
      timeout: 10_000,
    });
    const moisLoin = await page.locator('[data-atlas="mois-titre"]').innerText();
    await page.locator('[data-atlas="retour-aujourdhui"]').click();
    await page.waitForTimeout(300);
    assert.notEqual(
      await page.locator('[data-atlas="mois-titre"]').innerText(),
      moisLoin,
      "le retour n'a pas ramené sur le mois d'aujourd'hui"
    );
  });

  // ─── LE WEEK-END ────────────────────────────────────────────────────────

  // **Un chantier POSÉ un samedi ne disparaît pas du planning.**
  //
  // Trouvé le 22 août 2026, et par accident : la batterie a traversé minuit un
  // vendredi soir, si bien que « planifié pour AUJOURD'HUI » de
  // `test-planning-vers-facture` a posé sa date sur un SAMEDI — et n'a plus
  // trouvé le chantier dans aucun onglet.
  //
  // La cause : la liste des planifiés lisait la CHARGE d'une demi-journée, qui
  // vaut zéro le week-end (la planche n'y dessine rien), au lieu de lire ce qui
  // y est POSÉ. Le chantier restait rangé au planning par `onglet-chantier` et
  // n'y était visible nulle part — deux vérités sur le même chantier, et le
  // cul-de-sac du 8 août recommencé.
  //
  // Le produit ne pose pas de samedi lui-même ; une date venue d'ailleurs, si.
  // C'est pourquoi ce décor l'écrit en base : c'est un état que le chantier peut
  // atteindre, et l'écran doit savoir le montrer.
  // **SA DEMANDE DU 23 AOÛT 2026 :** *« entre "Copier l'adresse" et "Ouvrir le
  // PDF", j'aimerais avoir un petit encadré où l'utilisateur peut marquer
  // quelque chose — penser à prendre le broyeur »*.
  //
  // **Ce que ce contrôle garde, c'est le RECHARGEMENT.** Écrire dans un champ
  // marche toujours ; c'est l'enregistrement qui casse en silence, et il ne se
  // voit qu'en revenant. Une note perdue sans un mot, c'est le broyeur oublié
  // alors qu'il croit l'avoir noté.
  await essai("la note de la feuille s'écrit et survit au rechargement", async () => {
    await allerAuPlanning();
    await toucherLeJour(JOUR);
    const carte = page.locator(`[data-atlas="carte-jour"][data-jour="${JOUR}"]`);
    await carte.locator('[data-atlas="nom-du-jour"]').first().click();
    const champ = page.locator('[data-atlas="note-chantier"]').first();
    await champ.waitFor({ state: "visible", timeout: 15_000 });

    // **16 px au moins** : en dessous, iOS grossit la page à la mise au point et
    // l'écran saute sous le doigt. Mesuré, jamais supposé.
    const taille = await champ.evaluate((e) => parseFloat(getComputedStyle(e).fontSize));
    assert.ok(taille >= 16, `le champ fait ${taille} px : iOS zoomera dessus`);

    const note = `Broyeur — ${Date.now()}`;
    await champ.fill(note);
    // Enregistré en SORTANT du cadre, jamais par un bouton.
    await page.locator('[data-atlas="feuille"]').first().click({ position: { x: 8, y: 8 } });
    await page
      .locator('[data-atlas="note-etat"]')
      .first()
      .filter({ hasText: /Enregistr/ })
      .waitFor({ timeout: 15_000 });

    await allerAuPlanning();
    await toucherLeJour(JOUR);
    await carte.locator('[data-atlas="nom-du-jour"]').first().click();
    const relu = page.locator('[data-atlas="note-chantier"]').first();
    await relu.waitFor({ state: "visible", timeout: 15_000 });
    assert.equal(
      await relu.inputValue(),
      note,
      "la note n'a pas survécu au rechargement : elle est perdue sans un mot"
    );

    // **Le vide EFFACE.** Sans quoi le cadre resterait « rempli de rien », et
    // l'on ne saurait plus distinguer une note effacée d'une note oubliée.
    await relu.fill("");
    await page.locator('[data-atlas="feuille"]').first().click({ position: { x: 8, y: 8 } });
    await page
      .locator('[data-atlas="note-etat"]')
      .first()
      .filter({ hasText: /Enregistr/ })
      .waitFor({ timeout: 15_000 });
  });

  await essai("un chantier posé un SAMEDI reste visible dans les planifiés", async () => {
    // JOUR est un LUNDI (`lundiDansDeuxMois`) : cinq jours plus loin, samedi.
    const samedi = (() => {
      const d = new Date(`${JOUR}T12:00:00Z`);
      d.setUTCDate(d.getUTCDate() + 5);
      return d.toISOString().slice(0, 10);
    })();

    const r = await pool.query(`UPDATE chantiers SET date_planifiee = $2 WHERE id = $1`, [
      chantierId,
      samedi,
    ]);
    assert.equal(r.rowCount, 1, "le décor n'a pas pu poser la date du samedi");

    await allerAuPlanning();
    await toucherLeJour(samedi);
    // Visé par le NOM plutôt que par un lien : le chevron de la ligne pivote
    // désormais au lieu de mener au chantier (planche 86), et un contrôle qui
    // s'accroche à un `href` se casse au premier remaniement d'apparence.
    const ligne = page.locator(`[data-atlas="ligne-planifiee"]:has-text("${nom}")`);
    await ligne.first().waitFor({ state: "visible", timeout: 15_000 });
    assert.ok(
      (await ligne.count()) >= 1,
      "un chantier posé un samedi n'apparaît plus dans les planifiés : il est perdu"
    );

    // **Et la fiche du jour l'OUVRE, au lieu de le refuser.** Sa règle du
    // 23 août 2026 : *« le samedi et le dimanche, l'utilisateur doit pouvoir le
    // proposer ; s'il a des salariés qui font des extras, il doit pouvoir
    // sélectionner ces deux jours »*. Elle répondait « Jamais proposé. » et
    // s'arrêtait là — un cul-de-sac sur un jour où il travaille.
    const carte = page.locator(`[data-atlas="carte-jour"][data-jour="${samedi}"]`);
    const dit = await carte.innerText();
    assert.ok(!/Jamais proposé/.test(dit), `le samedi est encore refusé : « ${dit} »`);
    assert.ok(
      dit.includes(nom),
      `la fiche du samedi ne montre pas le chantier qui y est posé : « ${dit} »`
    );

    await pool.query(`UPDATE chantiers SET date_planifiee = $2 WHERE id = $1`, [chantierId, JOUR]);
  });

  // **Ce contrôle a été RETOURNÉ le 23 août 2026.** Il exigeait qu'un samedi
  // n'offre AUCUN geste — c'est-à-dire exactement ce qu'il fait retirer. Le
  // remettre rendrait son écran impossible à changer (`CLAUDE.md` §5 bis).
  await essai("un samedi offre les mêmes gestes qu'un mardi", async () => {
    const samedi = new Date(`${JOUR}T12:00:00Z`);
    samedi.setUTCDate(samedi.getUTCDate() + 5);
    await toucherLeJour(samedi.toISOString().slice(0, 10));
    const carte = page.locator('[data-atlas="carte-jour"]').first();
    const dit = await carte.innerText();
    assert.ok(!/Jamais proposé/.test(dit), `le samedi est encore un cul-de-sac : « ${dit} »`);
    assert.equal(
      await carte.locator('[data-atlas="ajouter"]').count(),
      1,
      "un samedi ne propose pas d'ajouter un chantier : il ne sert à rien de le toucher"
    );
    // **Un contrôle qui mesure zéro ne mesure rien** : sans les deux
    // demi-journées, l'absence de « Jamais proposé » ne prouverait qu'un écran
    // vide.
    assert.equal(
      await carte.locator('[data-atlas="demi"]').count(),
      2,
      "le samedi n'affiche pas ses deux demi-journées"
    );
  });

  await contexte.close();
  await navigateur.close();

  // **Rien à ranger, et c'est la règle du dépôt qui le décide.**
  //
  // Ce décor pose un devis ENVOYÉ — sans quoi le planning ne listerait pas le
  // chantier, et la feuille n'aurait rien à imprimer. Or un devis envoyé est
  // immuable ET indestructible : `trg_devis_immuable` refuse aussi bien de le
  // repasser en brouillon que de l'effacer, et `empecher_modification_lignes_devis_envoye`
  // refuse ses lignes (migration 0001). Ce n'est pas un obstacle à contourner,
  // c'est l'invariant qui garantit qu'un document parti chez le client ne se
  // réécrit jamais après coup.
  //
  // Deux rangements successifs ont buté dessus, chacun sur un déclencheur
  // différent. La bonne réponse n'était ni de désactiver les déclencheurs ni de
  // remonter la base : c'est de faire comme les autres suites de ce dépôt —
  // `test-planning-vers-facture-e2e` en laisse sept, `test-suivi-devis-e2e`
  // cinq — et de ne rien ranger. Le seed vide l'entreprise de démonstration au
  // début de chaque batterie ; c'est LUI le ménage, et il ne se bat contre
  // aucune règle métier.
  await pool.end();

  console.log(`\n${echecs === 0 ? "✅" : "❌"} Le planning refait — ${reussis} réussis, ${echecs} échec(s).`);
  process.exit(echecs === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
