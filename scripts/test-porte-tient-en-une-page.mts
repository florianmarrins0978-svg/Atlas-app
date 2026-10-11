// Regarder la planche des trois portes, et surtout : MESURER si l'une d'elles
// déborde de ses 664 px. Une porte qui déborde se découvre sur son téléphone,
// et c'est trop tard (`CLAUDE.md` §5, « regarder l'écran »).
import { chromium } from "playwright";
import { pathToFileURL } from "node:url";
import path from "node:path";

/**
 * **Par défaut le fichier du dépôt ; `ADRESSE_PLANCHE` vise la page PUBLIÉE.**
 *
 * Les deux ne prouvent pas la même chose. Le fichier dit que la planche est
 * juste ; l'adresse publique dit qu'elle est arrivée — et c'est la seule des
 * deux qu'il ouvre, lui. Une planche juste et non déployée lui rend un 404,
 * ce qui a déjà coûté deux allers-retours le 4 septembre 2026
 * (`CLAUDE.md` §3 bis).
 */
const fichier = path.resolve("appli/la-porte-d-atlas.html");
const ou = process.env.ADRESSE_PLANCHE ?? pathToFileURL(fichier).href;
const sortie = process.argv[2] ?? ".";

const etats = ["", "sans-faceid", "mdp-faux", "panne", "sans-apple"];

const navigateur = await chromium.launch();
const page = await navigateur.newPage({ viewport: { width: 1360, height: 1400 } });
await page.goto(ou);
await page.waitForLoadState("networkidle");

let debordements = 0;
for (const etat of etats) {
  await page.evaluate((e) => { document.body.className = e; }, etat);
  await page.waitForTimeout(180);

  for (const id of ["porteA", "porteB", "porteC"]) {
    const mesure = await page.evaluate((identifiant) => {
      const porte = document.getElementById(identifiant)!;
      const cadre = porte.parentElement!;
      // **Refuser de conclure sur une boîte de zéro pixel** — la mesure de zéro
      // ne mesure rien (`CLAUDE.md` §5, payé le 15 août 2026).
      /**
       * **ET LE BOUTON « ENTRER », SÉPARÉMENT — sans quoi ce contrôle mentirait.**
       *
       * Les trois portes sont des colonnes flexibles. Un enfant de colonne
       * flexible se COMPRIME avant de déborder : la mesure de hauteur reste
       * donc à 664 pendant que le bouton s'écrase, ou sort par le bas quand un
       * frère refuse de rétrécir. On mesure donc ce qui compte pour de vrai —
       * est-ce que le doigt peut encore atteindre « Entrer » ?
       */
      const entrer = porte.querySelector(".entrer")!.getBoundingClientRect();
      const cadreBoite = cadre.getBoundingClientRect();
      return {
        hauteurContenu: porte.scrollHeight,
        hauteurCadre: cadre.clientHeight,
        largeurContenu: porte.scrollWidth,
        largeurCadre: cadre.clientWidth,
        entrerDepasse: Math.round(entrer.bottom - cadreBoite.bottom),
        entrerHaut: Math.round(entrer.height),
      };
    }, id);
    if (mesure.hauteurCadre === 0 || mesure.largeurCadre === 0) {
      console.log(`  ? ${id} (${etat || "ordinaire"}) — cadre de zéro pixel, mesure impossible`);
      debordements++;
      continue;
    }
    const trop = mesure.hauteurContenu - mesure.hauteurCadre;
    const tropLarge = mesure.largeurContenu - mesure.largeurCadre;
    // Quarante-quatre pixels : la cible minimale que ce dépôt tient partout.
    // En dessous, le bouton existe encore mais on ne le vise plus.
    const ecrase = mesure.entrerHaut < 44;
    const mauvais = trop > 1 || tropLarge > 1 || mesure.entrerDepasse > 1 || ecrase;
    if (mauvais) debordements++;
    console.log(
      `  ${mauvais ? "✗" : "✓"} ${id} (${etat || "ordinaire"}) — ` +
        `${mesure.hauteurContenu}/${mesure.hauteurCadre} px de haut` +
        (trop > 1 ? ` → ${trop} px de trop` : "") +
        (tropLarge > 1 ? ` · ${tropLarge} px trop large` : "") +
        (mesure.entrerDepasse > 1 ? ` · « Entrer » sort de ${mesure.entrerDepasse} px` : "") +
        (ecrase ? ` · « Entrer » écrasé à ${mesure.entrerHaut} px` : "")
    );
  }
  await page.screenshot({ path: path.join(sortie, `porte-${etat || "ordinaire"}.png`), fullPage: true });
}

await navigateur.close();
console.log(`\n${debordements} débordement(s).`);
process.exit(debordements > 0 ? 1 : 0);
