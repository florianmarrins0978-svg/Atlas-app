/**
 * AUCUNE CLASSE `.atlas-*` N'EST BAPTISÉE DEUX FOIS PAR ERREUR.
 *
 * ───────────────────────────────────────────────────────────────────────────
 * **D'où vient ce contrôle.** Le 30 août 2026, en codant la note vocale, deux
 * noms ont été pris coup sur coup à des dessins qui existaient déjà :
 *
 * | Le nom repris | Ce qu'il servait déjà | Ce que l'écrasement produisait |
 * |---|---|---|
 * | `atlas-souffle` | les trois points de l'attente | des barreaux de 2 px invisibles |
 * | `atlas-aile` | les barreaux du lecteur de note | des ailes en absolu, larges de 1,5 cm |
 *
 * **Ni l'un ni l'autre n'aurait rougi.** Une feuille de style n'a pas de
 * portée : la règle écrite le plus bas gagne, sur TOUS les écrans. Or ces
 * dessins-là vivent sur des écrans que rien ne rapproche — celui qu'on regarde
 * en codant est juste, et c'est l'autre qui casse, ailleurs, sans témoin.
 * Les deux ont été trouvés à la relecture du diff, pas par la batterie.
 *
 * **Ce que le contrôle mesure exactement :** une règle de BASE — `.atlas-x {`
 * en début de ligne, sans descendant ni état — déclarée dans deux blocs
 * séparés. Les sélecteurs composés (`.atlas-x i`, `.atlas-x:active`,
 * `[data-etat] .atlas-x`) sont normaux et ne comptent pas.
 *
 * **Trois découpes délibérées existent** et sont nommées ci-dessous : un même
 * composant qui pose ses mesures puis, plus loin, un détail. Les laisser
 * implicites ferait rougir le contrôle pour rien, et l'on apprendrait à
 * l'ignorer — c'est ainsi qu'on perd un garde-fou sans s'en apercevoir.
 *
 * **Il sait échouer** : éprouvé en rendant à la frange son ancien nom
 * (`atlas-souffle`), il nomme la classe et les deux lignes.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const RACINE = join(dirname(fileURLToPath(import.meta.url)), "..");
const FEUILLE = join(RACINE, "src", "app", "globals.css");

/**
 * Les découpes voulues, avec ce qui les justifie.
 *
 * Y ajouter un nom se fait en connaissance de cause : c'est dire « ces deux
 * blocs habillent le MÊME dessin ». Si ce n'est pas vrai, l'un écrase l'autre.
 */
const DECOUPES_VOULUES = new Map([
  ["atlas-ligne", "la ligne du devis : ses mesures, puis son état figé"],
  ["atlas-fosse", "la fosse du glisseur, puis son comportement au doigt"],
  ["atlas-ajouter", "le carré d'ajout de photo : sa forme, puis son liseré"],
]);

const lignes = readFileSync(FEUILLE, "utf8").split("\n");
/** classe → numéros de ligne où sa règle de base est ouverte */
const vues = new Map<string, number[]>();

lignes.forEach((ligne, i) => {
  const trouve = /^\.(atlas-[a-z0-9-]+)\s*\{/.exec(ligne);
  if (!trouve) return;
  const nom = trouve[1];
  vues.set(nom, [...(vues.get(nom) ?? []), i + 1]);
});

const plaintes: string[] = [];
for (const [nom, ou] of vues) {
  if (ou.length < 2) continue;
  if (DECOUPES_VOULUES.has(nom)) {
    console.log(`  ✓ ${nom} : deux blocs, et c'est voulu — ${DECOUPES_VOULUES.get(nom)}`);
    continue;
  }
  plaintes.push(
    `.${nom} est déclarée ${ou.length} fois (lignes ${ou.join(", ")}) : ` +
      `la dernière écrase les autres, sur TOUS les écrans qui la portent`
  );
}

// **Une mesure impossible n'est pas un succès** : une feuille vide passerait.
if (vues.size < 20) {
  plaintes.push(`seulement ${vues.size} classes .atlas-* lues dans globals.css : le chemin a bougé`);
}

console.log(`=== Les classes .atlas-* de globals.css (${vues.size} lues) ===\n`);
if (plaintes.length) {
  console.error(`✗ ${plaintes.length} défaut(s) :`);
  plaintes.forEach((p) => console.error(`   · ${p}`));
  process.exit(1);
}
console.log("✓ Aucun nom repris : chaque dessin garde le sien.");
