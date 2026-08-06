import assert from "node:assert/strict";
import { arrondirALaDizaine } from "../src/lib/arrondi-prix";
import { rappelDePrix, signatureLecon, trancheDiametre, type LeconObservee } from "../src/lib/lecons-prix";

// La mémoire des corrections : ce qui doit se rapprocher, et ce qui ne doit
// SURTOUT PAS se rapprocher.
//
// Le second point porte l'essentiel du risque. Chez le patron, un chêne au pied
// vaut 600 € et le même chêne en démontage avec rétention 1 400 €. Confondre les
// deux ne produit pas « une approximation » : ça produit un rappel qui se
// présente avec l'autorité de l'expérience et qui est faux de 800 €. Une leçon
// fausse coûte plus cher qu'une leçon absente.

let echecs = 0;
function cas(nom: string, verifier: () => void): void {
  try {
    verifier();
    console.log(`  ✓ ${nom}`);
  } catch (e) {
    echecs++;
    console.error(`  ✗ ${nom}\n    ${(e as Error).message}`);
  }
}

const LE_5_AOUT = new Date("2026-08-05T10:00:00Z");
const LE_6_AOUT = new Date("2026-08-06T10:00:00Z");

console.log("=== L'arrondi du patron : des prix ronds, en HT ===\n");

cas("ses propres exemples ressortent tels qu'il les écrit", () => {
  // « En HT on fait des prix ronds : 350, 400, 420, 560, etc. »
  for (const [brut, attendu] of [
    ["350", "350"],
    ["347.20", "350"],
    ["416.66", "420"],
    ["558.10", "560"],
    ["1002.53", "1000"],
    ["14978.40", "14980"],
  ] as const) {
    assert.equal(arrondirALaDizaine(brut), attendu, `${brut} devrait donner ${attendu}`);
  }
});

cas("la règle est la même quel que soit le montant", () => {
  // Pas de palier : c'est ce qu'il a confirmé. Un barème par tranche serait une
  // règle de plus à tenir, et il vieillirait sans qu'on le voie.
  assert.equal(arrondirALaDizaine("14"), "10");
  assert.equal(arrondirALaDizaine("15"), "20");
  assert.equal(arrondirALaDizaine("123456.78"), "123460");
});

cas("une saisie illisible ne devient pas « gratuit »", () => {
  // Rendre 0 ferait partir au client un devis à zéro euro, présenté comme un
  // prix décidé. On rend null : l'appelant doit alors dire qu'il ne sait pas.
  for (const brut of ["", "  ", "à voir", "N/A"]) {
    assert.equal(arrondirALaDizaine(brut), null, `« ${brut} » ne doit pas donner un prix`);
  }
});

cas("la virgule française est comprise", () => {
  assert.equal(arrondirALaDizaine("347,20"), "350");
});

console.log("\n=== Ce qui se rapproche, et ce qui ne se rapproche pas ===\n");

cas("le chêne du patron produit une signature complète", () => {
  const s = signatureLecon("Abattage d'un chêne mort — démontage avec rétention, ⌀ 70 cm");
  assert.ok(s, "aucune signature tirée du libellé de référence");
  assert.equal(s.cle, "abattage|retention|d70");
  assert.match(s.description, /abattage/);
  assert.match(s.description, /rétention/);
});

cas("DEUX TECHNIQUES DIFFÉRENTES NE SE CONFONDENT JAMAIS", () => {
  // Le contrôle qui compte : 600 € contre 1 400 € sur le même arbre.
  const auPied = signatureLecon("Abattage d'un chêne mort — abattage au pied, ⌀ 70 cm");
  const retention = signatureLecon("Abattage d'un chêne mort — démontage avec rétention, ⌀ 70 cm");
  const demontage = signatureLecon("Abattage d'un chêne mort — démontage, ⌀ 70 cm");
  assert.notEqual(auPied!.cle, retention!.cle, "au pied et rétention se confondent : 800 € d'écart");
  assert.notEqual(demontage!.cle, retention!.cle, "démontage simple et rétention se confondent : 400 € d'écart");
  assert.notEqual(auPied!.cle, demontage!.cle);
});

cas("« rétention » l'emporte sur « démontage », qu'il contient", () => {
  // Piège d'ordre : « démontage avec rétention » contient « démontage ». Une
  // liste mal ordonnée rapprocherait un chantier à 1 400 € d'un à 1 000 €.
  assert.equal(signatureLecon("Abattage — démontage avec rétention")!.cle, "abattage|retention");
});

cas("deux diamètres voisins sont le même travail", () => {
  // Exiger l'égalité exacte ferait que deux chantiers ne se rapprocheraient
  // pour ainsi dire jamais, et le rappel ne s'afficherait qu'au hasard.
  const a = signatureLecon("Abattage chêne — démontage, ⌀ 68 cm");
  const b = signatureLecon("Abattage chêne — démontage, ⌀ 70 cm");
  assert.equal(a!.cle, b!.cle, "68 et 70 cm devraient se rapprocher");
});

cas("deux diamètres éloignés ne se rapprochent pas", () => {
  const petit = signatureLecon("Abattage chêne — démontage, ⌀ 30 cm");
  const gros = signatureLecon("Abattage chêne — démontage, ⌀ 90 cm");
  assert.notEqual(petit!.cle, gros!.cle, "un tronc de 30 cm et un de 90 cm sont le même prix ?");
});

cas("la tranche est celle qu'on annonce : dix centimètres, au plus proche", () => {
  assert.equal(trancheDiametre(70), "d70");
  assert.equal(trancheDiametre(74), "d70");
  assert.equal(trancheDiametre(76), "d80");
});

cas("une frontière subsiste, et elle fait MANQUER un rappel, jamais en fabriquer un faux", () => {
  // Écrit exprès plutôt que caché : toute tranche a des frontières, et 64/66 cm
  // tombent de part et d'autre. C'est assumé — l'erreur est dans le bon sens.
  // Un rappel manquant laisse le patron chiffrer comme aujourd'hui ; un rappel
  // faux se présenterait avec l'autorité de l'expérience.
  //
  // Ce contrôle existe pour qu'on ne « corrige » pas ce comportement un jour en
  // élargissant le rapprochement : ce serait échanger un manque contre une
  // erreur.
  assert.notEqual(trancheDiametre(64), trancheDiametre(66));
  assert.equal(trancheDiametre(64), "d60");
  assert.equal(trancheDiametre(66), "d70");
});

cas("une haie n'est jamais rapprochée d'un abattage", () => {
  assert.notEqual(signatureLecon("Taille de haie de laurier")!.cle, signatureLecon("Abattage d'un chêne")!.cle);
});

cas("« taille de haie » n'est pas prise pour un élagage", () => {
  // Les deux disent « taille ». Les confondre rapprocherait un prix au mètre
  // linéaire d'un prix à l'arbre.
  assert.equal(signatureLecon("Taille de haie de laurier")!.cle, "haie");
  assert.equal(signatureLecon("Taille du tilleul")!.cle, "elagage");
});

cas("un libellé sans métier reconnaissable ne produit AUCUNE signature", () => {
  // Mieux vaut aucun rappel qu'un rappel tiré d'un rapprochement fantaisiste.
  for (const rien of ["", "   ", "Divers", "Déplacement", "Acompte"]) {
    assert.equal(signatureLecon(rien), null, `« ${rien} » ne doit rapprocher de rien`);
  }
});

console.log("\n=== Le rappel : d'où vient le chiffre ===\n");

cas("le rappel cite le dernier prix retenu, pas la moyenne", () => {
  // Un artisan qui a monté ses tarifs en juin ne veut pas la moyenne de
  // l'année : il veut son prix d'aujourd'hui.
  const lecons: LeconObservee[] = [
    { prix: "600.00", constateLe: LE_5_AOUT, libelle: "Abattage chêne — au pied" },
    { prix: "1400.00", constateLe: LE_6_AOUT, libelle: "Abattage chêne — démontage avec rétention" },
  ];
  const r = rappelDePrix(lecons);
  assert.ok(r);
  assert.equal(r.prix, "1400");
  assert.equal(r.observations, 2);
});

cas("le rappel dit d'où il vient — sinon c'est un calcul non sourcé", () => {
  const r = rappelDePrix([{ prix: "1000.00", constateLe: LE_6_AOUT, libelle: "Abattage chêne — démontage" }]);
  assert.ok(r);
  assert.match(r.phrase, /dernière fois/i, "le rappel ne dit pas qu'il vient du passé");
  assert.match(r.phrase, /Abattage chêne — démontage/, "le rappel ne dit pas de quel chantier il vient");
  assert.match(r.phrase, /1000 € HT/, "le rappel ne porte pas le montant");
});

cas("le prix rappelé sort rond", () => {
  const r = rappelDePrix([{ prix: "1002.53", constateLe: LE_6_AOUT, libelle: "Abattage" }]);
  assert.equal(r!.prix, "1000", "un rappel à 1 002,53 € trahit la machine");
});

cas("sans leçon, aucun rappel — jamais un rappel à zéro", () => {
  assert.equal(rappelDePrix([]), null);
});

cas("une leçon au montant illisible ne produit pas un rappel à zéro", () => {
  assert.equal(rappelDePrix([{ prix: "à revoir", constateLe: LE_6_AOUT, libelle: "Abattage" }]), null);
});

console.log(`\n${echecs === 0 ? "✅ Toutes les vérifications passent." : `❌ ${echecs} échec(s).`}`);
process.exit(echecs === 0 ? 0 : 1);
