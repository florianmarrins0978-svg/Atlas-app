import { lancerNavigateur } from "./e2e-browser";

// **LA BARRE DU BAS TIENT SUR UN ÉCRAN DE 360 PIXELS.**
//
// Ce contrôle naît du cinquième onglet, posé le 17 août 2026 sur sa décision
// (`ARCHITECTURE.md` §125). Passer de quatre à cinq colonnes fait tomber
// chacune de 89,5 à 71,6 px — et « CHANTIERS », le plus long des cinq mots,
// en demandait 78,8 dans le dessin d'alors. **Il débordait de 7,2 px.**
//
// **Pourquoi un contrôle plutôt qu'un commentaire.** La variante retenue (la
// lettre à 8,5 px, espacée de 0,14em) laisse 11,8 px de marge. Cette marge est
// une valeur de CSS : elle se perd au premier « on remet la lettre à 9,5, c'est
// plus lisible », ou au premier onglet ajouté. Et le défaut serait **invisible
// ici** — on développe sur un grand écran — pour n'apparaître que chez lui.
//
// **Ce qu'il mesure, et pourquoi ce n'est pas la largeur du lien.** Un lien de
// grille occupe TOUTE sa colonne : sa largeur ne dit rien du texte qu'il porte.
// On mesure donc la boîte du nœud de texte lui-même, par une plage — c'est la
// seule mesure qui distingue un mot qui rentre d'un mot qui déborde.
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
  const colonne = rangee ? rangee.getBoundingClientRect().width / (liens.length || 1) : 0;
  return {
    barre: true,
    colonne: colonne,
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
      .map((o) => `${o.mot} = ${o.texte.toFixed(1)} px pour ${colonne.toFixed(1)} px de colonne`);
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
    const colonne = m.colonne ?? 0;
    const MARGE_MINIMALE = 6;
    const juste = m.onglets
      .map((o) => ({ mot: o.mot, marge: colonne - o.texte }))
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

  await cas("l'onglet Outils mène à un écran qui répond", async () => {
    // Un onglet qui ouvre une page introuvable, c'est la troisième fois qu'il
    // appuie sur quelque chose qui ne répond pas (`reglages/Sommaire.tsx`).
    const reponse = await page.goto(`${BASE}/outils`, { waitUntil: "networkidle" });
    if (!reponse || reponse.status() >= 400) {
      throw new Error(`/outils répond ${reponse ? reponse.status() : "rien"}`);
    }
    const titre = await page.locator('[data-atlas="ecran-outils"] h1').first().innerText();
    if (!/Outils/i.test(titre)) throw new Error(`titre lu : « ${titre} »`);
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
