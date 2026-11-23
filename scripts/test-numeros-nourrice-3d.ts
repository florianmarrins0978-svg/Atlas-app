import { composer } from "../appli/nourrice-3d/composition.js";
import { aCote } from "../appli/nourrice-3d/deux-nourrices.js";
import { creerPieces } from "../appli/nourrice-3d/pieces/index.js";
import { CATALOGUE } from "../src/lib/arrosage/catalogue.js";
import { composerLesNourrices, composerNourrice, ordreDesNourrices } from "../src/lib/arrosage/nourrice-eclatee";

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
 *
 * **Et au-delà de six voies, sur les deux nourrices** (sa planche du
 * 23 novembre 2026, « à côté ») : la 3D les pose côte à côte (`aCote`) et
 * numérote sur les deux, la légende prend l'union des deux ordres
 * (`ordreDesNourrices`). Les deux doivent encore tomber d'accord, et la
 * seconde ne doit pas chevaucher la première.
 */
const CAT = CATALOGUE as unknown as { ficheNourrice(n: number, goutte: number): unknown };
type Compo = { pieces: { cle: string; monte: number[]; eclate: number[] }[]; erreurs: string[] };
const compose = composer as unknown as (fiche: unknown, n: number, g: number, pieces: unknown) => Compo;
const cote = aCote as unknown as (c1: Compo, c2: Compo, dessous?: boolean) => Compo;

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

console.log("\n=== Deux nourrices, côte à côte ===\n");
let deux = 0;
for (let voies = 7; voies <= 12; voies++) {
  for (let goutte = 0; goutte <= voies; goutte++) {
    const parts = composerLesNourrices(voies, goutte);
    if (!parts) continue;
    deux++;
    const [a, b] = parts.map((p) => compose(CAT.ficheNourrice(p.voies, p.goutte), p.voies, p.goutte, pieces));
    const compo = cote(a, b);
    const ordre3D: string[] = [];
    compo.pieces.forEach((p) => { if (!ordre3D.includes(p.cle)) ordre3D.push(p.cle); });
    const legende = ordreDesNourrices(parts);
    const pareil = ordre3D.join(",") === legende.join(",");
    // La seconde à droite de la première, montée comme éclatée : sinon les pièces se mêlent.
    const n = a.pieces.length, x = (cle: "monte" | "eclate", de: number, a2: number) => compo.pieces.slice(de, a2).map((p) => p[cle][0]);
    const separees = (["monte", "eclate"] as const).every((c) => Math.max(...x(c, 0, n)) < Math.min(...x(c, n, compo.pieces.length)));
    dire(pareil && separees && compo.erreurs.length === 0 && compo.pieces.length === a.pieces.length + b.pieces.length,
      `${voies} voies dont ${goutte} en goutte-à-goutte (${parts.map((p) => p.voies).join(" et ")}) : ${ordre3D.length} numéros${pareil ? "" : `\n      3D     : ${ordre3D.join(", ")}\n      légende : ${legende.join(", ")}`}${separees ? "" : "\n      la seconde chevauche la première"}${compo.erreurs.length ? `\n      ${compo.erreurs.join("\n      ")}` : ""}`);
  }
}
dire(deux >= 20, `au moins vingt paires confrontées (${deux})`);

console.log(echecs ? `\n✗ ${echecs} écart(s).\n` : "\n✓ La 3D numérote comme la légende.\n");
process.exit(echecs ? 1 : 0);
