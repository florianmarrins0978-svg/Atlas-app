import { composer, pile, piecesDesRoles, PROGRAMMATEURS, DEPARTS } from "../appli/robinet-3d/composition.js";
import { creerPieces } from "../appli/robinet-3d/pieces/index.js";
import { centreDuBout, GAZ } from "../appli/nourrice-3d/formes.js";
import { departEn3D, roleEn3D, type Depart } from "../src/lib/arrosage/robinet";

/**
 * LA PILE DU ROBINET EN 3D SE MONTE COMME ELLE SE VISSE — sa planche
 * (`appli/arrosage-robinet-3d.html`), ses neuf combinaisons, et l'écran du plan
 * au robinet qui la montre depuis son « Parfait, code ça » du 23 novembre 2026.
 *
 * Quatre choses, que rien d'autre ne tient :
 *
 * 1. **Chaque bout de vissage est là où la géométrie le met.** La composition
 *    pose une pièce par le bout qu'elle DÉCLARE ; un bout déclaré à côté de sa
 *    pièce ferait flotter un filetage à côté de sa bouche. Le centre se relit
 *    dans les sommets (`centreDuBout`), il ne se croit pas sur parole. Huit
 *    pièces ont été relevées sur ses photos par huit agents différents : c'est
 *    ici qu'elles se retrouvent.
 * 2. **Chaque pile se compose sans erreur** : les neuf de la planche, et toutes
 *    celles que l'écran du plan peut demander (au nez de robinet ou avec la
 *    nourrice, double sortie ou non, chaque départ).
 * 3. **L'écran montre le départ que la liste compte** (`departEn3D`).
 * 4. **Aucun programmateur ne bouche la sortie du client** : sous la sortie où
 *    il se visse, son boîtier ne doit pas atteindre la colonne de l'autre
 *    sortie (`composition.js`, `PROGRAMMATEURS`). C'est ce qui a envoyé le Rain
 *    Bird sur la sortie droite.
 * 5. **Une pièce supprimée de la liste se grise dans la 3D, et elle seule**
 *    (sa réponse du 24 novembre 2026 : « grise-la ») : chaque ligne de la pile
 *    (`roleEn3D`) désigne une pièce qui est bien dans la pile de l'écran
 *    (`piecesDesRoles`), jamais une autre, et rien quand l'étage n'y est pas.
 *
 * Et le contrôle sait échouer : un bout décalé d'un millimètre, une pile qui
 * ne se visse pas, un boîtier élargi doivent le faire rougir.
 */
type Bout = { z: number; x?: number; genre: string; gaz: string; prise: number };
type Piece = { couches: { geometrie: { boundingBox: { min: { x: number }; max: { x: number } } } }[]; haut: Bout | null; bas: Bout; autres?: Bout[] };
type Element = string | { cle: string; sortie: string };
type Choix = { programmateur: string | null; double: boolean; depart: string };
const PIECES = (creerPieces as unknown as () => Record<string, Piece>)();
const composerPile = composer as unknown as (els: Element[], pieces: Record<string, Piece>) => { pieces: { cle: string }[]; erreurs: string[] };
const pileDe = pile as unknown as (o: Choix) => Element[];
const centre = centreDuBout as unknown as (couches: unknown, axe: string, place: number, rayon: number, c?: number[]) => number[] | null;
const FILET = GAZ as unknown as Record<string, { d: number }>;

let echecs = 0;
const dire = (bon: boolean, quoi: string) => { console.log(`${bon ? "  ✓" : "  ✗"} ${quoi}`); if (!bon) echecs++; };

function rayon(b: Bout) { return b.gaz === "pe25" ? 12.5 : b.gaz === "pe16" ? 8 : FILET[b.gaz].d / 2 + (b.genre === "femelle" ? 2 : 0); }
/** L'écart, en millimètres, entre le bout déclaré et le centre que ses sommets dessinent ; Infinity s'il n'y a pas de cercle à lire. */
function ecartDuBout(p: Piece, b: Bout): number {
  const x = b.x ?? 0, c = centre(p.couches, "z", b.z, rayon(b), [x, 0, 0]);
  return c ? Math.hypot(c[0] - x, c[1]) : Infinity;
}
function boutsDe(p: Piece): [string, Bout][] {
  return [["haut", p.haut], ["bas", p.bas], ...(p.autres ?? []).map((b, i): [string, Bout | null] => [`sortie ${i + 2}`, b])].filter((x): x is [string, Bout] => !!x[1]);
}
const ecartMax = (cle: string) => Math.max(...boutsDe(PIECES[cle]).map(([, b]) => ecartDuBout(PIECES[cle], b)));
const boiteX = (p: Piece) => p.couches.reduce((m, c) => ({ min: Math.min(m.min, c.geometrie.boundingBox.min.x), max: Math.max(m.max, c.geometrie.boundingBox.max.x) }), { min: Infinity, max: -Infinity });

console.log("\n=== La pile du robinet en 3D ===\n");

console.log("1. Chaque bout de vissage est là où la géométrie le met");
for (const cle of Object.keys(PIECES)) {
  const e = ecartMax(cle);
  dire(e <= 0.05, `${cle} : ${boutsDe(PIECES[cle]).length} bout(s), le plus éloigné à ${Number.isFinite(e) ? e.toFixed(3) + " mm" : "aucun cercle lu"}`);
}
{
  // Il sait échouer : le bas de la double sortie déclaré à côté de sa sortie. `centreDuBout` range les
  // sommets en cercles autour du centre déclaré : il lit juste un petit écart, et sous-estime un grand
  // (un millimètre s'y lit 0,26 mm, essayé). Ce qui compte, et qui est éprouvé : l'un et l'autre
  // passent le seuil de 0,05 mm.
  const d = PIECES["double-sortie-BRO3493"], vrai = d.bas;
  for (const dx of [0.2, 1]) {
    d.bas = { ...vrai, x: (vrai.x ?? 0) + dx };
    const e = ecartMax("double-sortie-BRO3493");
    d.bas = vrai;
    dire(e > 0.05, `il sait échouer : une sortie déclarée ${String(dx).replace(".", ",")} mm à côté se lit à ${e.toFixed(3)} mm, au-delà de 0,05 mm`);
  }
}

console.log("\n2. Chaque pile se compose sans erreur");
for (const prog of Object.keys(PROGRAMMATEURS)) for (const dep of Object.keys(DEPARTS)) {
  const c = composerPile(pileDe({ programmateur: prog, double: true, depart: dep }), PIECES);
  dire(c.erreurs.length === 0, `la planche, ${prog} et ${dep} : ${c.pieces.length} pièces${c.erreurs.length ? ", " + c.erreurs.join(" ; ") : ""}`);
}
const DEPARTS_DU_PLAN: Depart[] = [16, "16s", 25, 32];
const RACCORD: Record<string, string> = { r16: "raccord-plasson16", s16: "embout-MID6362", pe25: "raccord-femelle25" };
for (const nez of [true, false]) for (const double of [true, false]) for (const d of DEPARTS_DU_PLAN) {
  const els = pileDe({ programmateur: nez ? "solem" : null, double, depart: departEn3D(d) }), c = composerPile(els, PIECES);
  const cles = c.pieces.map((p) => p.cle);
  const juste = c.erreurs.length === 0 && cles.includes("double-sortie-BRO3493") === double && cles.includes("programmateur-SP1151") === nez && cles.includes(RACCORD[departEn3D(d)]);
  dire(juste, `l'écran, ${nez ? "au nez de robinet" : "avec la nourrice"}, ${double ? "double sortie" : "sans double sortie"}, départ ${d} : ${cles.join(" > ")}${c.erreurs.length ? ", " + c.erreurs.join(" ; ") : ""}`);
}
{
  // Il sait échouer : un départ Ø16 vissé sous le robinet sans son raccord ne se visse pas.
  const c = composerPile(["robinet-laiton", "tube16"], PIECES);
  dire(c.erreurs.length > 0, `il sait échouer : le tube Ø16 directement sous le robinet est refusé (${c.erreurs[0] ?? "rien"})`);
}

console.log("\n3. L'écran montre le départ que la liste compte");
dire(departEn3D(16) === "r16" && departEn3D("16s") === "s16" && departEn3D(25) === "pe25" && departEn3D(32) === "pe25", "Ø16 rigide, Ø16 souple, et le Ø25 comme le Ø32 (sa règle du 22 novembre 2026)");

console.log("\n4. Aucun programmateur ne bouche la sortie du client");
{
  const ds = PIECES["double-sortie-BRO3493"], ecart = Math.abs((ds.autres?.[0]?.x ?? 0) - (ds.bas.x ?? 0)), filet = FILET["3/4"].d / 2;
  const libre = (prog: string, boite: { min: number; max: number }) => {
    const p = PROGRAMMATEURS[prog as keyof typeof PROGRAMMATEURS] as { sortie: string };
    // Sur la sortie gauche, l'autre est à droite (+X) ; sur la droite, elle est à gauche.
    return p.sortie === "gauche" ? ecart - filet - boite.max : ecart - filet + boite.min;
  };
  for (const prog of Object.keys(PROGRAMMATEURS)) {
    const p = PROGRAMMATEURS[prog as keyof typeof PROGRAMMATEURS] as { cle: string; sortie: string }, marge = libre(prog, boiteX(PIECES[p.cle]));
    dire(marge > 5, `${prog}, sur la sortie ${p.sortie} : ${marge.toFixed(1)} mm entre son boîtier et le filet de l'autre sortie`);
  }
  // Il sait échouer : le Rain Bird remis sur la sortie gauche boucherait celle du client.
  const rb = PIECES[(PROGRAMMATEURS as unknown as Record<string, { cle: string }>).rainbird.cle], bx = boiteX(rb);
  const marge = ecart - filet - bx.max;
  dire(marge < 0, `il sait échouer : le Rain Bird sur la sortie gauche passerait de ${(-marge).toFixed(1)} mm sous la sortie du client`);
}

console.log("\n5. Une pièce supprimée de la liste se grise dans la 3D, et elle seule");
{
  const desRoles = piecesDesRoles as unknown as (o: Choix, roles: string[]) => string[];
  const LIGNES = ["am:double", "am:prog", "am:raccord", "am:pe"];
  const cleDe = (e: Element) => (typeof e === "string" ? e : e.cle);
  let piles = 0, faux = 0;
  for (const programmateur of [null, ...Object.keys(PROGRAMMATEURS as object)]) {
    for (const double of [true, false]) {
      for (const depart of Object.keys(DEPARTS as object)) {
        const o: Choix = { programmateur, double, depart };
        const dans = pileDe(o).map(cleDe);
        piles++;
        const vues: string[] = [];
        for (const ligne of LIGNES) {
          const role = roleEn3D(ligne);
          const cles = role ? desRoles(o, [role]) : [];
          const present = ligne === "am:double" ? double : ligne === "am:prog" ? programmateur !== null : true;
          // Présent : une pièce, de la pile, qu'aucune autre ligne ne désigne. Absent : rien à griser.
          const bon = present ? cles.length === 1 && dans.includes(cles[0]) && !vues.includes(cles[0]) : cles.length === 0;
          if (!bon) { faux++; console.log(`      ${programmateur ?? "sans"} ${double ? "double" : "simple"} ${depart} ${ligne} : ${cles.join(", ") || "rien"}`); }
          vues.push(...cles);
        }
        // Toute la pile sauf le robinet se grise par une ligne : aucun étage n'échappe à la liste.
        if (dans.filter((c) => c !== "robinet-laiton").some((c) => !vues.includes(c))) { faux++; console.log(`      ${programmateur ?? "sans"} ${depart} : un étage sans ligne`); }
      }
    }
  }
  dire(faux === 0 && piles >= 24, `${piles} piles, chaque ligne supprimée grise sa pièce et elle seule`);
  dire(roleEn3D("am:te") === null && roleEn3D("aj:1") === null, "le té du compteur et une pièce ajoutée ne sont pas des étages de la pile");
  // Il sait échouer : une ligne qui désignerait la mauvaise pièce griserait le raccord à la place du tuyau.
  const o: Choix = { programmateur: "solem", double: true, depart: "pe25" };
  dire(desRoles(o, ["tuyau"])[0] !== desRoles(o, ["raccord"])[0], "il sait échouer : le raccord et le tuyau ne se confondent pas");
}

console.log(echecs ? `\n${echecs} échec(s)\n` : "\nTout est vert.\n");
process.exit(echecs ? 1 : 0);
