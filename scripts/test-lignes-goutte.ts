import { calculerEtDessiner } from "../src/lib/arrosage/le-plan";
import { ECARTS_GOUTTE, lignesPourEcart } from "../src/lib/arrosage/calcul.js";
import type { ParametresPlan } from "../src/lib/arrosage/consignes";

/**
 * LES LIGNES DE GOUTTE-À-GOUTTE — ses règles des 21 et 22 octobre 2026
 * (`.claude/rules/arrosage.md`) :
 *
 *   « mets l'espacement aussi tous les 50 cm d'office en partant de 0,50 et pas
 *     de 0, donc pour 2 m ça fait 4 lignes » ; « massif, tu peux faire tous les
 *     60 cm d'office » ; et l'écart se tape, ou le nombre se choisit.
 *
 * La règle vit dans le calcul (`lignesPourEcart`) et l'écran la reprend : une
 * seule façon de compter les lignes, pour le dessin comme pour la liste.
 */
let echecs = 0;
const dire = (bon: boolean, quoi: string) => { console.log(`${bon ? "  ✓" : "  ✗"} ${quoi}`); if (!bon) echecs++; };

console.log("\n=== Les lignes de goutte-à-goutte ===\n");

dire(ECARTS_GOUTTE.haie === 0.5 && ECARTS_GOUTTE.massif === 0.6, "l'écart d'office : 50 cm pour une haie, 60 cm pour un massif");
dire(lignesPourEcart(2, 0.5) === 4, `2 m à 50 cm : 4 lignes, la première à 50 cm du bord (${lignesPourEcart(2, 0.5)})`);
dire(lignesPourEcart(3, 0.6) === 5, `3 m à 60 cm : 5 lignes (${lignesPourEcart(3, 0.6)})`);
dire(lignesPourEcart(2, 0.45) === 4, `2 m à 45 cm tapés : 4 lignes, la dernière à 20 cm du bord (${lignesPourEcart(2, 0.45)})`);
dire(lignesPourEcart(2.4, 0.6) === 4, "2,40 m à 60 cm : 4 lignes, le millionième de la virgule flottante ne retire rien");
dire(lignesPourEcart(0.3, 0.5) === 1, "une bande plus étroite que l'écart reçoit quand même une ligne");

const PARAMS = (zones: ParametresPlan["zones"]): ParametresPlan => ({
  seau: 10, temps: 18, pression: 3, compteur: "oui", regardVersZone: 0, amenee: 0,
  zones, nourrice: { x: 0, y: 0 }, couronne: 50,
});
const tube = (zones: ParametresPlan["zones"]) => calculerEtDessiner(PARAMS(zones), null).plan.dessinDuCalcul.map((z) => z.metresDeTube ?? 0);

const [m36] = tube([{ id: 1, type: "massif", nom: "Massif", x: 0, y: 0, L: 3, l: 6, sortieGoutte: "boucle" }]);
dire(m36 === 30, `massif 3 × 6, d'office : 5 lignes sur 6 m, 30 m de tube (${m36})`);
const [m63] = tube([{ id: 1, type: "massif", nom: "Massif", x: 0, y: 0, L: 6, l: 3, sortieGoutte: "boucle" }]);
dire(m63 === 30, `massif 6 × 3 : le même, les lignes se comptent sur le petit côté (${m63})`);
const [mChoisi] = tube([{ id: 1, type: "massif", nom: "Massif", x: 0, y: 0, L: 6, l: 3, lignes: 3, sortieGoutte: "boucle" }]);
dire(mChoisi === 18, `massif 6 × 3 à 3 lignes choisies : 18 m de tube (${mChoisi})`);
const [mEcart] = tube([{ id: 1, type: "massif", nom: "Massif", x: 0, y: 0, L: 6, l: 3, ecartLignes: 0.4, sortieGoutte: "boucle" }]);
dire(mEcart === 42, `massif 6 × 3 à 40 cm tapés : 7 lignes, 42 m de tube (${mEcart})`);
const [haie] = tube([{ id: 1, type: "haie", nom: "GAG", x: 0, y: 0, ml: 12, lignes: 4, sortieGoutte: "boucle" }]);
dire(haie === 48, `haie de 12 m à 4 lignes : 48 m de tube (${haie})`);
const [haieSeule] = tube([{ id: 1, type: "haie", nom: "GAG", x: 0, y: 0, ml: 12, sortieGoutte: "boucle" }]);
dire(haieSeule === 12, `haie sans nombre (lue sur une photo, sans largeur) : une ligne (${haieSeule})`);
// Sa planche du 22 octobre 2026 : le sens, et l'écart du bord à part de l'écart entre deux.
const [mLong] = tube([{ id: 1, type: "massif", nom: "Massif", x: 0, y: 0, L: 6, l: 2.5, sortieGoutte: "boucle" }]);
const [mLarge] = tube([{ id: 1, type: "massif", nom: "Massif", x: 0, y: 0, L: 6, l: 2.5, sensLignes: "largeur", sortieGoutte: "boucle" }]);
dire(mLong === 24 && mLarge === 25, `massif 6 × 2,50 : 4 lignes de 6 m (24 m), ou dans la largeur 10 lignes de 2,50 m (25 m) (${mLong}, ${mLarge})`);
const [mBord] = tube([{ id: 1, type: "massif", nom: "Massif", x: 0, y: 0, L: 6, l: 3, ecartBord: 0.2, ecartLignes: 0.4, sortieGoutte: "boucle" }]);
dire(mBord === 48, `massif 6 × 3, 20 cm du bord et 40 cm entre deux : 8 lignes, 48 m de tube (${mBord})`);
// Le potager n'a pas changé de règle : il n'en a pas parlé.
const [potager] = tube([{ id: 1, type: "potager", nom: "Potager", x: 0, y: 0, L: 5, l: 2.1, sortieGoutte: "boucle" }]);
dire(potager === 20, `potager 5 × 2,10 à 70 cm, bords compris, inchangé : 4 lignes, 20 m (${potager})`);

console.log(echecs === 0 ? "\n✅ 0 échec." : `\n❌ ${echecs} échec(s).`);
if (echecs > 0) process.exit(1);
