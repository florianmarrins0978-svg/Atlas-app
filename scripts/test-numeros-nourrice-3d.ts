import { composer } from "../appli/nourrice-3d/composition.js";
import { creerPieces } from "../appli/nourrice-3d/pieces/index.js";
import { CATALOGUE } from "../src/lib/arrosage/catalogue.js";
import { composerNourrice } from "../src/lib/arrosage/nourrice-eclatee";

/**
 * LES NUMÉROS DE LA NOURRICE EN 3D SONT CEUX DE LA LÉGENDE — son choix du
 * 22 novembre 2026 (« la A noire, à l'éclaté seulement »).
 *
 * Deux listes, deux codes : la légende de l'écran numérote ses pièces par
 * `composerNourrice().ordre` (le dessin d'avant), la 3D par la première pièce
 * de chaque modèle dans l'ordre de sa composition (`vue.numeros`, que
 * `appli/nourrice-3d/reperes.js` pose sur les pièces). Et « Voir » montre sur
 * la 3D les pièces dont la clé est la référence de la ligne touchée.
 *
 * Si les deux divergent, le 4 de la 3D n'est plus le 4 de la liste, et « Voir »
 * voile tout sans rien montrer : le contrôle les confronte, voie par voie,
 * goutte-à-goutte compris.
 */
const CAT = CATALOGUE as unknown as { ficheNourrice(n: number, goutte: number): unknown };
type Compo = { pieces: { cle: string }[]; erreurs: string[] };
const compose = composer as unknown as (fiche: unknown, n: number, g: number, pieces: unknown) => Compo;

let echecs = 0, cas = 0;
const dire = (bon: boolean, quoi: string) => { console.log(`${bon ? "  ✓" : "  ✗"} ${quoi}`); if (!bon) echecs++; };

console.log("\n=== Les numéros de la nourrice en 3D ===\n");

const pieces = creerPieces(1);
for (let voies = 1; voies <= 6; voies++) {
  for (let goutte = 0; goutte <= voies; goutte++) {
    const fiche = CAT.ficheNourrice(voies, goutte), legende = composerNourrice(voies, goutte);
    if (!fiche || !legende) { dire(!fiche && !legende, `${voies} voies dont ${goutte} en goutte-à-goutte : ni 3D ni légende, ou les deux`); continue; }
    cas++;
    const compo = compose(fiche, voies, goutte, pieces);
    // Le numéro de la 3D : la première pièce de chaque modèle, dans l'ordre de la composition (vue.numeros).
    const ordre3D: string[] = [];
    compo.pieces.forEach((p) => { if (!ordre3D.includes(p.cle)) ordre3D.push(p.cle); });
    const pareil = ordre3D.join(",") === legende.ordre.join(",");
    dire(pareil && compo.erreurs.length === 0, `${voies} voies dont ${goutte} en goutte-à-goutte : ${ordre3D.length} numéros${pareil ? "" : `\n      3D     : ${ordre3D.join(", ")}\n      légende : ${legende.ordre.join(", ")}`}${compo.erreurs.length ? `\n      ${compo.erreurs.join("\n      ")}` : ""}`);
  }
}
// Un contrôle qui ne confronte rien ne prouve rien.
dire(cas >= 20, `au moins vingt nourrices confrontées (${cas})`);

console.log(echecs ? `\n✗ ${echecs} écart(s).\n` : "\n✓ La 3D numérote comme la légende.\n");
process.exit(echecs ? 1 : 0);
