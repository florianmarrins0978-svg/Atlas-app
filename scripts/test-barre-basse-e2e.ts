import { lancerNavigateur } from "./e2e-browser";

// **LA BARRE DU BAS TIENT SUR UN ÉCRAN DE 360 PIXELS.**
//
// Ce contrôle naît du cinquième onglet, posé le 17 août 2026 sur sa décision
// (`ARCHITECTURE.md` §125). Passer de quatre à cinq colonnes fait tomber
// chacune de 89,5 à 71,6 px — et « CHANTIERS », le plus long des cinq mots,
// en demandait 78,8 dans le dessin d'alors. **Il débordait de 7,2 px.**
//
// **Pourquoi un contrôle plutôt qu'un commentaire.** La variante retenue (la
// lettre à 8,5 px, espacée de 0,14em) laisse 6,2 px de marge sur une part de
// 66,4. C'est une valeur de CSS : elle se perd au premier « on
// remet la lettre à 9,5, c'est plus lisible », ou au premier onglet ajouté. Et
// le défaut serait **invisible ici** — on développe sur un grand écran — pour
// n'apparaître que chez lui.
//
// **Ce qu'il mesure : le TEXTE contre SA CELLULE.** Le mot se mesure par une
// plage posée sur son nœud, ce qui donne la boîte du texte rendu — capitales
// et espacement compris. La colonne, elle, est la boîte du LIEN, qui EST la
// cellule de grille.
//
// **Et cette seconde mesure a d'abord été fausse, ici même.** La première
// version divisait la largeur de la rangée par le nombre d'onglets : elle
// comptait les 28 px de marge de la rangée comme de la place disponible, et
// annonçait 72 px là où la colonne en fait 66,4. Les deux contrôles de largeur
// passaient donc avec 5,6 px de trop. **C'est le contrôle du trait d'or qui
// l'a révélé** — lui compare deux choses réelles, et il a rougi. Un contrôle
// qui se trompe de référence est pire qu'absent : il rassure.
//
// **Et il refuse de conclure sur une barre absente.** Une page sans barre
// rendrait « aucun mot ne déborde » en vert, sans avoir rien regardé — le piège
// du contrôle qui mesure zéro, payé le 15 août sur les noms coupés.

const BASE = "http://localhost:3000";

// Son écran le plus étroit. En dessous, il n'y a plus de téléphone à servir.
const LARGEUR = 360;

let echecs = 0;

async function cas(nom: string, verifier: () => Promise<void>) {
  try {
    await verifier();
    console.log(`  ✓ ${nom}`);
  } catch (e) {
    echecs++;
    console.error(`  ✗ ${nom}\n    ${(e as Error).message}`);
  }
}

/**
 * La largeur du TEXTE de chaque onglet, et celle de sa colonne.
 *
 * La plage (`Range`) posée sur le nœud de texte donne la boîte du mot rendu,
 * capitales et espacement compris — ce qu'aucune mesure de l'élément parent ne
 * donnerait, puisqu'il remplit sa colonne quoi qu'il porte.
 */
const SONDE = `(() => {
  const nav = document.querySelector('nav[aria-label="Navigation principale"]');
  if (!nav) return { barre: false, onglets: [] };
  const rangee = nav.firstElementChild;
  const liens = Array.from(nav.querySelectorAll("a"));
  if (!rangee || !liens.length) return { barre: true, colonne: 0, onglets: [] };

  // **LA PART D'UNE COLONNE, ET DEUX FAÇONS DE LA MESURER FAUX.**
  //
  // 1. La rangée divisée par cinq — ma première version. Elle comptait les
  //    28 px de marge intérieure comme de la place disponible : 72 px annoncés
  //    pour 66,4 réels, et deux contrôles qui passaient avec 5,6 px de trop.
  //    C'est le contrôle du trait d'or qui l'a révélé, en rougissant.
  // 2. La boite du LIEN — ma correction, fausse elle aussi. Une cellule 1fr
  //    s'ÉLARGIT quand son contenu déborde : le lien mesure alors exactement
  //    la largeur du mot, et « déborde » ne se voit plus jamais. Un mot de
  //    120 px aurait rendu « colonne 120, texte 120, tout va bien ».
  //
  // La mesure juste est la PART : le contenu de la rangée (marges déduites)
  // divisé par le nombre d'onglets. C'est ce que chaque colonne a le droit
  // d'occuper — et c'est aussi la largeur du trait d'or, qui est écrite ainsi.
  const st = getComputedStyle(rangee);
  const dedans =
    rangee.clientWidth - parseFloat(st.paddingLeft) - parseFloat(st.paddingRight);
  const part = dedans / liens.length;

  return {
    barre: true,
    colonne: part,
    onglets: liens.map((a) => {
      const noeud = a.childNodes[a.childNodes.length - 1];
      const plage = document.createRange();
      plage.selectNodeContents(noeud);
      return { mot: (noeud.textContent || "").trim(), texte: plage.getBoundingClientRect().width };
    }),
  };
})()`;

type Mesure = {
  barre: boolean;
  colonne?: number;
  onglets: { mot: string; texte: number }[];
};

async function main() {
  console.log("=== La barre du bas tient sur un écran de 360 px ===\n");

  const navigateur = await lancerNavigateur();
  const contexte = await navigateur.newContext({
    viewport: { width: LARGEUR, height: 780 },
    deviceScaleFactor: 2,
  });
  const page = await contexte.newPage();

  await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  await page.fill('input[name="email"]', "demo@atlas.local");
  await page.fill('input[name="password"]', "demo1234");
  await page.click('button[type="submit"]');
  await page.waitForURL(`${BASE}/`, { timeout: 30_000 });

  // **On attend les polices.** Mesurer avant qu'elles soient appliquées, c'est
  // mesurer une police de repli — et rendre un vert qui ne dit rien de ce qu'il
  // voit. Payé le 15 août sur les noms coupés (`CLAUDE.md` §5).
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(400);

  const m = (await page.evaluate(SONDE)) as Mesure;

  await cas("la barre est bien là, avec ses onglets", async () => {
    if (!m.barre) throw new Error("aucune barre de navigation sur l'accueil — rien n'a été mesuré");
    if (m.onglets.length < 4) {
      throw new Error(
        `${m.onglets.length} onglet(s) seulement : trop peu pour éprouver quoi que ce soit`
      );
    }
  });

  await cas("aucun onglet ne déborde de sa colonne", async () => {
    const colonne = m.colonne ?? 0;
    if (colonne <= 0) throw new Error("colonne de largeur nulle — mesure impossible");
    const trop = m.onglets
      .filter((o) => o.texte > colonne)
      .map((o) => `${o.mot} = ${o.texte.toFixed(1)} px pour ${colonne.toFixed(1)} px de part`);
    if (trop.length) {
      throw new Error(
        `${trop.length} onglet(s) débordent à ${LARGEUR} px :\n      ` + trop.join("\n      ")
      );
    }
  });

  await cas("et il reste de la marge — pas seulement « ça passe »", async () => {
    // **Deux pixels de marge, ce n'est pas tenir.** La variante écartée le
    // 17 août en laissait 1,3 : elle passait ici et serait tombée sur une autre
    // police de téléphone. On exige donc une marge qui encaisse cet écart.
    // **4 px, et le seuil s'explique.** La variante écartée le 17 août ne
    // tenait pas du tout — elle DÉBORDAIT de 3,9 px, une fois la part mesurée
    // correctement. La variante retenue laisse 6,2 px. Un seuil à 4 rejette
    // donc la première sans mettre la seconde à un cheveu du rouge : un
    // contrôle qui passe de justesse rougit au premier rendu un peu différent,
    // et l'on prend l'habitude de le rejouer au lieu de le croire.
    const MARGE_MINIMALE = 4;
    const colonne2 = m.colonne ?? 0;
    const juste = m.onglets
      .map((o) => ({ mot: o.mot, marge: colonne2 - o.texte }))
      .filter((o) => o.marge < MARGE_MINIMALE);
    if (juste.length) {
      throw new Error(
        `marge trop courte (moins de ${MARGE_MINIMALE} px) : ` +
          juste.map((o) => `${o.mot} à ${o.marge.toFixed(1)} px`).join(", ") +
          "\n      Une autre police de téléphone, et le mot déborde — invisible ici, visible chez lui."
      );
    }
  });

  await cas("le trait d'or fait bien la largeur d'une colonne", async () => {
    // Le trait glisse d'un onglet à l'autre ; sa largeur est écrite en dur
    // (`/ 5`). Ajouter un onglet sans la corriger le laisserait à cheval sur
    // deux colonnes — un défaut de dessin que rien d'autre ne dirait.
    const largeurTrait = await page.evaluate(() => {
      const nav = document.querySelector('nav[aria-label="Navigation principale"]');
      const trait = nav?.querySelector('span[aria-hidden="true"]');
      return trait ? trait.getBoundingClientRect().width : 0;
    });
    const colonne = m.colonne ?? 0;
    if (Math.abs(largeurTrait - colonne) > 2) {
      throw new Error(
        `trait de ${largeurTrait.toFixed(1)} px pour une colonne de ${colonne.toFixed(1)} px — ` +
          "la largeur du trait n'a pas suivi le nombre d'onglets"
      );
    }
  });

  await cas("l'onglet Paysage mène à un écran qui répond", async () => {
    // Un onglet qui ouvre une page introuvable, c'est la troisième fois qu'il
    // appuie sur quelque chose qui ne répond pas (`reglages/Sommaire.tsx`).
    const reponse = await page.goto(`${BASE}/paysage`, { waitUntil: "networkidle" });
    if (!reponse || reponse.status() >= 400) {
      throw new Error(`/paysage répond ${reponse ? reponse.status() : "rien"}`);
    }
    const titre = await page.locator('[data-atlas="ecran-paysage"] h1').first().innerText();
    if (!/Paysage/i.test(titre)) throw new Error(`titre lu : « ${titre} »`);
  });

  await cas("et l'onglet porte bien son nom dans la barre", async () => {
    // **Le libellé et l'adresse doivent aller ensemble.** Renommer l'un sans
    // l'autre donne un onglet « Paysage » qui ouvre `/outils` — ou l'inverse,
    // et l'écran répond 404 sans que personne ne l'ait voulu.
    const onglet = m.onglets.find((o) => /paysage/i.test(o.mot));
    if (!onglet) {
      throw new Error(
        "aucun onglet « Paysage » dans la barre — lu : " +
          m.onglets.map((o) => o.mot).join(", ")
      );
    }
  });

  console.log(`\n${echecs === 0 ? "✅" : "❌"} Barre du bas — ${echecs} échec(s).`);

  await contexte.close();
  await navigateur.close();
  process.exit(echecs === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
