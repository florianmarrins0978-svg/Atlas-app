import assert from "node:assert/strict";
import { devices } from "playwright";
import type { Page } from "playwright";
import { lancerNavigateur } from "./e2e-browser";
import { pool } from "../src/server/db/client";

/**
 * Où se lit la TVA, et ce qui fait monter la déductible.
 *
 * *Le patron, le 23 août 2026 :* **« je trouve que l'outil Ma TVA à déclarer,
 * il est caché, on ne le voit pas trop »**, puis, sur l'écran du relevé :
 * **« on ne comprend pas trop que scanner ou écrire à la main, c'est pour la
 * TVA déductible »**.
 *
 * Deux planches, deux choix, dits mot pour mot : **« Pour ma TVA la B »**
 * (`docs/maquettes/86-ou-mettre-ma-tva.html`) et **« pour les achats la C »**
 * (`docs/maquettes/85-achats-tva-deductible.html`).
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * **CE QUE CETTE SUITE TIENT, ET QU'AUCUNE AUTRE NE VOIT.**
 *
 * Les deux choix sont des choix de PLACE. Rien ne casse si la place se perd :
 * la carte redevient un lien en pied de liste, les deux boutons redescendent
 * sous les achats — et tout reste vert, parce que tout marche encore. Ce sont
 * précisément les défauts qu'aucun autre contrôle ne peut voir.
 *
 * D'où trois mesures, et non trois présences :
 *
 * 1. **La carte est AU-DESSUS de la liste** — la B se distingue de l'ancien
 *    pied de page par sa place, pas par son existence.
 * 2. **Elle porte le montant** — c'est ce qui sépare la B de la A, qui n'était
 *    qu'un lien. « Le montant se lit sans ouvrir, et donne la raison d'ouvrir. »
 * 3. **Les gestes sont collés à l'encadré des chiffres** — la C ne dit le lien
 *    par aucun mot : elle le dit par la couture. Un écart qui se rouvre, et le
 *    choix est défait sans qu'une phrase ait bougé.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * **AJOUTÉ LE 26 AOÛT 2026 — « on ne comprend pas qu'on peut cliquer ».**
 *
 * *« Le "Ma TVA à déclarer", on ne comprend pas trop qu'on peut cliquer dessus,
 * corrige ça, mais garde ce style et cette forme, j'aime bien. »* Puis, devant
 * `appli/termines-sans-traits.html` : **« le 3 »** — le contour doré.
 *
 * **Le défaut n'était pas celui du 23 août, et c'est ce qui a failli le faire
 * manquer.** « Elle est cachée » a été réglé en la montant en tête ; « on ne
 * sait pas qu'on peut appuyer » est autre chose, et rien ne le voyait : la
 * carte marchait, elle menait au relevé, les trois contrôles ci-dessus étaient
 * verts. Un défaut d'AFFORDANCE ne casse rien — il se lit sur un écran, ou
 * jamais.
 *
 * **Les deux mesures ajoutées, et ce qu'elles refusent de croire :**
 *
 * 4. **le contour existe, et il est DORÉ** — un contour gris ferait deux objets
 *    d'une carte qui n'en est qu'un, et un contour transparent ne se voit pas
 *    plus que pas de contour du tout ;
 * 5. **la forme n'a pas bougé** — « garde ce style et cette forme ». Le rayon
 *    reste celui d'une carte, pas d'une capsule.
 *
 * **Et la même demande portait sur les traits** : *« tous les traits supprimés
 * entre chaque ligne »*. Les deux cas du bas les comptent — puis mesurent ce
 * que le trait faisait, parce qu'un retrait sec aurait collé les rangées.
 */

const BASE = "http://localhost:3000";

let reussis = 0;
let echecs = 0;
async function cas(nom: string, verifier: () => Promise<void>) {
  try {
    await verifier();
    console.log(`  ✓ ${nom}`);
    reussis++;
  } catch (e) {
    echecs++;
    console.error(`  ✗ ${nom}\n    ${(e as Error).message}`);
  }
}

/** Le haut d'un élément, mesuré dans la page entière et non dans le cadre. */
async function hautDe(page: Page, selecteur: string, quoi: string): Promise<number> {
  const cible = page.locator(selecteur).first();
  assert.ok(
    await cible.count(),
    `${quoi} est introuvable (${selecteur}) — c'est lui qui manque, pas sa place.`
  );
  const boite = await cible.boundingBox();
  assert.ok(boite, `${quoi} n'a aucune boîte : il est dans la page mais invisible.`);
  return boite.y;
}

async function main() {
  console.log("=== Où se lit la TVA, et ce qui fait monter la déductible ===\n");

  const navigateur = await lancerNavigateur();
  const contexte = await navigateur.newContext({ ...devices["iPhone 13"] });
  const page = await contexte.newPage();

  await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
  await page.fill('input[name="email"]', "demo@atlas.local");
  await page.fill('input[name="password"]', "demo1234");
  await page.click('button[type="submit"]');
  await page.waitForURL(`${BASE}/`, { timeout: 30_000 });

  // ── Sa proposition B : une carte, en tête, portant le chiffre ──────────────

  await page.goto(`${BASE}/termines`, { waitUntil: "networkidle" });
  await page.waitForSelector("text=Terminés", { timeout: 30_000 });

  await cas("la carte de TVA est au-dessus de la liste des chantiers", async () => {
    // **Mesurer la carte contre la LISTE, jamais contre sa propre mention.** Le
    // premier jet comparait la carte au « Reste à payer » qui la suit : la carte
    // remise en pied d'écran, la mention descendait avec elle et le contrôle
    // restait vert — vert sur le défaut même dont il portait le nom.
    const carte = await hautDe(page, '[data-atlas="carte-tva"]', "La carte « Ma TVA à déclarer »");
    const liste = await hautDe(page, '[data-atlas="contenu-termines"]', "Le contenu de l'écran Terminés");
    assert.ok(
      carte < liste,
      `La carte n'est plus en tête : elle passe APRÈS le contenu de l'écran ` +
        `(carte y=${Math.round(carte)}, contenu y=${Math.round(liste)}). C'est la place d'avant, ` +
        `celle dont il disait « je trouve que l'outil Ma TVA à déclarer, il est caché ».`
    );
  });

  await cas("elle porte le montant, et pas seulement le mot « TVA »", async () => {
    const texte = (await page.locator('[data-atlas="carte-tva"]').first().innerText()).replace(/\s+/g, " ");
    assert.match(
      texte,
      /\d+([ .,]\d+)*\s*€/,
      `La carte ne porte aucun montant : elle dit « ${texte} ». C'est la proposition A ` +
        `(un simple lien), pas la B qu'il a retenue — « le montant se lit sans ouvrir ».`
    );
  });

  await cas("ELLE SE VOIT CLIQUABLE — son contour doré, sa proposition 3", async () => {
    // **Ce cas mesure ce dont il DOUTAIT**, et rien d'autre : « on ne comprend
    // pas trop qu'on peut cliquer dessus ». Les trois cas au-dessus resteraient
    // verts sur une carte parfaitement muette.
    const bord = await page.locator('[data-atlas="carte-tva"]').first().evaluate((el) => {
      const s = getComputedStyle(el);
      return { ombre: s.boxShadow, rayon: s.borderRadius, hauteur: el.getBoundingClientRect().height };
    });

    // **Une carte de zéro pixel ne mesure rien** (`CLAUDE.md` §5) : sans cette
    // borne, une carte non rendue rendrait un vert qui ne prouve rien.
    assert.ok(bord.hauteur > 20, `La carte fait ${Math.round(bord.hauteur)} px : rien n'est mesurable ici.`);

    assert.ok(
      bord.ombre && bord.ombre !== "none",
      "La carte n'a plus aucun contour : elle redevient un aplat sur un fond de la même " +
        "couleur (#faf9f5 sur #f5f3ee), donc un bandeau d'information — exactement ce dont " +
        "il disait « on ne comprend pas trop qu'on peut cliquer dessus »."
    );

    // **Doré, et pas gris.** Le vérifier sur les canaux plutôt que sur la
    // chaîne : `color-mix` est résolu par le navigateur, et la forme du rgba
    // rendu n'est pas garantie d'une version à l'autre.
    const canaux = bord.ombre.match(/\d+(\.\d+)?/g)?.map(Number) ?? [];
    const [r, v, b2] = canaux;
    assert.ok(
      canaux.length >= 3 && r > v && v > b2,
      `Le contour est « ${bord.ombre} » : ce n'est pas l'or. Un bord gris ferait deux ` +
        `objets — un cadre, et un contenu sans rapport — d'une carte qui n'en est qu'un.`
    );
    // Et il doit se VOIR : un or transparent ne vaut pas mieux que rien.
    const alpha = canaux.length >= 4 ? canaux[3] : 1;
    assert.ok(alpha >= 0.3, `Le contour est à ${alpha} d'opacité : il ne se voit pas.`);
  });

  await cas("SA FORME N'A PAS BOUGÉ — « garde ce style et cette forme »", async () => {
    // La capsule lui avait été proposée aussi ; il a choisi le contour
    // précisément pour que la carte reste une carte. Un rayon qui s'arrondirait
    // en capsule serait la proposition 2, pas la 3.
    const rayon = await page
      .locator('[data-atlas="carte-tva"]')
      .first()
      .evaluate((el) => parseFloat(getComputedStyle(el).borderTopLeftRadius));
    assert.ok(
      rayon > 0 && rayon <= 10,
      `Le rayon de la carte est passé à ${rayon} px. Au-delà c'est une capsule : ` +
        `il a écarté cette proposition-là en choisissant la 3.`
    );
  });

  await cas("elle mène au relevé", async () => {
    await page.locator('[data-atlas="carte-tva"]').first().click();
    await page.waitForURL(`${BASE}/termines/tva`, { timeout: 30_000 });
  });

  // ── Les traits entre les lignes, 26 août 2026 ─────────────────────────────

  /**
   * POSE SES PROPRES RANGÉES, plutôt que d'espérer en trouver.
   *
   * **Payé le 26 août 2026.** Le jeu de démonstration ne porte aucun chantier
   * dont la date soit passée : l'écran remplaçait alors la liste entière par
   * une phrase, et la suite expirait au bout de trente secondes en désignant
   * une rangée absente — un contrôle qui accuse l'écran d'un défaut qui est
   * dans la base (`AGENTS.md`).
   *
   * **Sous la batterie, elle passait par chance** : d'autres suites laissent
   * derrière elles des chantiers terminés. Un contrôle qui ne mesure que
   * lorsqu'une voisine a tourné avant lui n'en est pas un — il ne dira rien le
   * jour où l'ordre change.
   *
   * Deux chantiers datés d'hier suffisent : c'est la date passée, et elle
   * seule, qui range un chantier dans les terminés.
   */
  const posees = await pool.query<{ id: string }>(
    `INSERT INTO chantiers (entreprise_id, nom, date_planifiee)
     SELECT e.id, x.nom, (now() - interval '3 days')::date
       FROM entreprises e
       CROSS JOIN (VALUES ('Contrôle des traits — un'), ('Contrôle des traits — deux')) AS x(nom)
      WHERE e.id = (SELECT m.entreprise_id FROM membres_entreprise m
                       JOIN users u ON u.id = m.utilisateur_id
                      WHERE u.email = 'demo@atlas.local' LIMIT 1)
     RETURNING id`
  );
  assert.equal(
    posees.rowCount,
    2,
    "Impossible de poser les deux chantiers d'essai : rien de ce qui suit ne mesurerait quoi que ce soit."
  );

  await page.goto(`${BASE}/termines`, { waitUntil: "networkidle" });

  /**
   * Amène les rangées à l'écran, ou dit POURQUOI il n'y en a pas.
   *
   * **Deux fausses pistes ont été payées ici, et elles valent d'être écrites.**
   * Sans chantier terminé, l'écran remplace la liste entière par une phrase :
   * ni onglets, ni rangées. Un `waitForSelector` sur la rangée expirait alors
   * au bout de trente secondes en désignant la rangée — c'est-à-dire en
   * envoyant chercher dans l'écran un défaut qui est dans la BASE (`AGENTS.md` :
   * une erreur qui accuse à tort coûte plus cher que pas d'erreur du tout).
   *
   * **Et l'onglet se vise par son repère, jamais par son libellé** : « À
   * facturer » est un mot qu'il peut faire changer demain (`CLAUDE.md` §5 bis).
   */
  async function amenerLesRangees(): Promise<string | null> {
    if (!(await page.locator('[data-atlas="liste-termines"]').count())) {
      return "aucun chantier terminé dans le jeu de démonstration : l'écran n'affiche ni onglets ni rangées";
    }
    // « Tout » ne montre que le mois courant, qui peut être vide selon le jour
    // où la suite tourne. « À facturer » ignore le mois — et c'est l'onglet de
    // sa capture.
    await page.click('[data-atlas="onglet-attente"]');
    await page.waitForTimeout(300);
    const combien = await page.locator('[data-atlas="ligne-terminee"]').count();
    return combien >= 2 ? null : `${combien} rangée(s) à facturer : rien n'est mesurable`;
  }

  /** Ce qui manque à la base, une fois pour les trois cas qui suivent. */
  const sansRangees = await amenerLesRangees();

  await cas("AUCUN TRAIT NE SÉPARE PLUS LES LIGNES — sa demande du 26 août", async () => {
    // **Zéro rangée ne prouve rien** (`CLAUDE.md` §5) : un écran vide n'a pas de
    // trait non plus, et rendrait un vert sur le défaut même qu'on cherche. On
    // refuse donc de conclure, et l'on nomme le vrai coupable.
    assert.equal(sansRangees, null, `Mesure impossible — ${sansRangees}.`);

    const traits: string[] = await page.evaluate(() =>
      [...document.querySelectorAll('[data-atlas="ligne-terminee"], [data-atlas="compte-du-mois"]')]
        .flatMap((el) => {
          const s = getComputedStyle(el);
          return (["top", "bottom"] as const)
            .filter((c) => parseFloat(s.getPropertyValue(`border-${c}-width`)) > 0)
            .map((c) => `${el.getAttribute("data-atlas")} · border-${c}`);
        })
    );
    assert.deepEqual(
      traits,
      [],
      `Des traits sont revenus : ${traits.join(", ")}. Sa demande du 26 août était ` +
        `« tous les traits supprimés entre chaque ligne ».`
    );
  });

  await cas("ET LES RANGÉES RESTENT SÉPARÉES — le trait faisait la moitié du travail", async () => {
    // **Le contrôle qui compte les traits ne suffit PAS**, et c'est tout
    // l'intérêt de celui-ci. Les retirer à marge égale collerait le second étage
    // d'une ligne (« Pas encore facturé · 360,00 € prévus ») au nom de la
    // suivante : deux rangées se liraient comme une seule, et le compteur de
    // traits serait vert.
    //
    // On mesure donc l'ESPACE RÉELLEMENT VU entre deux rangées voisines — du bas
    // du texte de l'une au haut du texte de l'autre —, jamais une valeur de
    // rembourrage écrite dans le code.
    // **Pas de fonction nommée à l'intérieur d'`evaluate`.** `tsx` conserve les
    // noms en injectant un `__name` qui n'existe pas dans la page : le contrôle
    // rougissait sur un « __name is not defined » qui n'a rien à voir avec
    // l'écran. Tout se fait donc en boucles.
    const ecarts: number[] = await page.evaluate(() => {
      const lignes = [...document.querySelectorAll('[data-atlas="ligne-terminee"]')];
      const bornes: { haut: number; bas: number }[] = [];
      for (const l of lignes) {
        let haut = Infinity;
        let bas = -Infinity;
        for (const t of l.querySelectorAll("span, b")) {
          const r = t.getBoundingClientRect();
          if (r.height === 0) continue;
          if (r.top < haut) haut = r.top;
          if (r.bottom > bas) bas = r.bottom;
        }
        bornes.push({ haut, bas });
      }
      const out: number[] = [];
      for (let i = 1; i < bornes.length; i++) out.push(bornes[i].haut - bornes[i - 1].bas);
      return out;
    });
    assert.equal(sansRangees, null, `Mesure impossible — ${sansRangees}.`);
    assert.ok(ecarts.length >= 1, "Une seule rangée : il n'y a aucun écart à mesurer.");
    const pire = Math.min(...ecarts);
    assert.ok(
      Number.isFinite(pire) && pire > 0,
      `Écart illisible (${JSON.stringify(ecarts)}) : rien n'est mesurable ici.`
    );
    assert.ok(
      pire >= 34,
      `Il ne reste que ${Math.round(pire)} px entre deux rangées. Sans trait, cet espace ` +
        `est la SEULE chose qui les sépare : en dessous, le nom d'un chantier paraît ` +
        `appartenir à l'état du précédent.`
    );
  });

  await cas("LA DÉMARCATION SOUS LA PHRASE DE COMPTE TIENT SANS SON TRAIT", async () => {
    // Le trait retiré ici portait sa demande du 23 août : *« laisser un peu
    // d'espace entre cette phrase-là et le premier client, histoire qu'on fasse
    // bien la démarcation »*. Il avait demandé de l'espace ; c'est l'espace qui
    // le remplace, et rien d'autre ne le tiendrait.
    const ecart = await page.evaluate(() => {
      const compte = document.querySelector('[data-atlas="compte-du-mois"]');
      const premiere = document.querySelector('[data-atlas="ligne-terminee"]');
      if (!compte || !premiere) return null;
      const hautTexte = Math.min(
        ...[...premiere.querySelectorAll("span, b")].map((t) => t.getBoundingClientRect().top)
      );
      return hautTexte - compte.getBoundingClientRect().bottom;
    });
    assert.equal(sansRangees, null, `Mesure impossible — ${sansRangees}.`);
    assert.ok(ecart !== null, "La phrase de compte ou la première ligne est introuvable.");
    assert.ok(
      ecart! >= 24,
      `Il ne reste que ${Math.round(ecart!)} px sous la phrase de compte. Sa demande du ` +
        `23 août — « qu'on fasse bien la démarcation » — ne tient plus que sur cet espace, ` +
        `depuis que le trait est parti le 26.`
    );
  });

  // ── Sa proposition C : les gestes collés à l'encadré des chiffres ──────────

  await page.goto(`${BASE}/termines/tva`, { waitUntil: "networkidle" });
  await page.waitForSelector("text=Déductible", { timeout: 30_000 });

  await cas("les deux gestes précèdent la liste des achats", async () => {
    const gestes = await hautDe(page, '[data-atlas="gestes-deductible"]', "Le bloc des deux gestes");
    const achats = await hautDe(page, "text=Vos achats", "Le titre « Vos achats »");
    assert.ok(
      gestes < achats,
      `Les gestes sont redescendus SOUS les achats (gestes y=${Math.round(gestes)}, ` +
        `« Vos achats » y=${Math.round(achats)}). C'est la place d'avant, celle dont il ` +
        `disait « on ne comprend pas trop que c'est pour la TVA déductible ».`
    );
  });

  await cas("ils sont cousus à l'encadré des chiffres, sans écart", async () => {
    // **Mesurer les DEUX ENCADRÉS, jamais leur texte.** Le premier jet mesurait
    // depuis le bas des mots « Reste à payer » et annonçait 25 px d'écart alors
    // que les deux pièces se touchaient : il comptait le rembourrage de la
    // carte comme une brèche. Un contrôle qui accuse à tort coûte plus cher que
    // pas de contrôle du tout (`AGENTS.md`).
    const encadre = await page.locator('[data-atlas="encadre-tva"]').first().boundingBox();
    assert.ok(encadre, "L'encadré des chiffres (« Reste à payer ») n'a aucune boîte.");
    const gestes = await page
      .locator('[data-atlas="gestes-deductible"]')
      .first()
      .evaluate((el) => {
        const r = el.parentElement!.getBoundingClientRect();
        return { haut: r.top + window.scrollY, gauche: r.left, largeur: r.width };
      });

    const ecart = gestes.haut - (encadre.y + encadre.height);
    assert.ok(
      ecart <= 1,
      `Un écart de ${Math.round(ecart)} px s'est rouvert entre l'encadré des chiffres ` +
        `et les gestes. La proposition C ne dit le lien par AUCUN mot : elle le dit par ` +
        `la couture. Cet écart la défait sans qu'une phrase ait bougé.`
    );
    // Et la couture ne tient que si les deux pièces ont la même largeur : deux
    // marges différentes feraient un décrochement, visible et jamais rouge.
    assert.ok(
      Math.abs(gestes.gauche - encadre.x) <= 1 && Math.abs(gestes.largeur - encadre.width) <= 1,
      `Les deux pièces ne sont plus alignées : l'encadré fait ${Math.round(encadre.width)} px ` +
        `à x=${Math.round(encadre.x)}, le bloc des gestes ${Math.round(gestes.largeur)} px ` +
        `à x=${Math.round(gestes.gauche)}. Le décrochement se voit, et rien d'autre ne le dirait.`
    );
  });

  await cas("le titre du bloc nomme ce à quoi les gestes servent", async () => {
    const titre = page.getByText("Pour faire monter la déductible", { exact: false });
    assert.ok(
      await titre.count(),
      `Le titre « Pour faire monter la déductible » a disparu. Il est la seule ` +
        `chose qui relie les deux boutons à la tuile au-dessus.`
    );
  });

  // **On remet le décor.** Deux chantiers d'essai laissés en place feraient
  // dire « 5 à facturer » à la suite d'à côté, qui en attend trois
  // (`CLAUDE.md` §5 bis : un cas qui réécrit le décor de ses voisins déplace le
  // défaut au lieu de l'attraper).
  await pool.query(`DELETE FROM chantiers WHERE nom LIKE 'Contrôle des traits — %'`);

  await navigateur.close();
  await pool.end();

  console.log(`\n${reussis} réussis, ${echecs} échecs`);
  if (echecs > 0) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
