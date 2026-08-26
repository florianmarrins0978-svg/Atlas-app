import assert from "node:assert/strict";
import { quantiteLue, structureDeLaPrestation, structureDepuisPrecisions } from "../src/lib/prestation-structuree";
import { membresDuLibelle } from "../src/lib/lignes-vendables";

// **Du JSON du modèle vers les colonnes — sans rien inventer en chemin.**
//
// Le modèle lit bien la dictée : sur celle du 26 août 2026 il rendait
// `quantite: "800"` et `unite: "ml"`. Ce qui manquait, c'était un endroit où
// les poser. Ce module fait la traduction ; ces contrôles tiennent qu'elle ne
// fabrique aucune valeur au passage.

let reussites = 0;
let echecs = 0;
function cas(nom: string, verifier: () => void): void {
  try {
    verifier();
    console.log(`  ✓ ${nom}`);
    reussites++;
  } catch (e) {
    echecs++;
    console.error(`  ✗ ${nom}\n    ${(e as Error).message}`);
  }
}

const ligne = (p: Partial<{ libelle: string; quantite: string | null; unite: string | null; aConfirmer: boolean }>) => ({
  libelle: p.libelle ?? "Haie (tout genre)",
  description: null,
  quantite: p.quantite ?? null,
  unite: p.unite ?? null,
  aConfirmer: p.aConfirmer ?? false,
});

console.log("\n=== Lire un nombre écrit par un modèle ===\n");

cas("un entier", () => assert.equal(quantiteLue("800"), "800.00"));
cas("une virgule — un artisan écrit 12,5", () => assert.equal(quantiteLue("12,5"), "12.50"));
cas("un point — un clavier de téléphone le propose d'abord", () => assert.equal(quantiteLue("12.5"), "12.50"));
cas("des espaces", () => assert.equal(quantiteLue(" 1 200 "), "1200.00"));

cas("ce qui ne se lit pas ne se devine pas", () => {
  // Une quantité fausse se multiplie par un prix, et le produit part chez un
  // client. Mieux vaut rien.
  for (const brut of ["environ", "à mesurer", "beaucoup", "", "  "]) {
    assert.equal(quantiteLue(brut), null, `« ${brut} » a produit une quantité`);
  }
});

cas("zéro et négatif ne sont pas des quantités", () => {
  assert.equal(quantiteLue("0"), null);
  assert.equal(quantiteLue("-5"), null);
});

console.log("\n=== La quantité et l'unité entrent ENSEMBLE ou pas du tout ===\n");

cas("les deux présentes : les deux passent", () => {
  const s = structureDeLaPrestation(ligne({ quantite: "800", unite: "ml" }));
  assert.equal(s.quantite, "800.00");
  assert.equal(s.unite, "ml");
});

cas("une quantité sans unité ne passe pas", () => {
  // « 800 » tout seul se lirait 800 mètres, 800 m² ou 800 heures selon qui
  // regarde. C'est l'ambiguïté qui a produit le devis du 26 août.
  const s = structureDeLaPrestation(ligne({ quantite: "800", unite: null }));
  assert.equal(s.quantite, null);
  assert.equal(s.unite, null);
});

cas("une unité sans quantité ne passe pas non plus", () => {
  const s = structureDeLaPrestation(ligne({ quantite: null, unite: "ml" }));
  assert.equal(s.quantite, null);
  assert.equal(s.unite, null);
});

cas("son unité n'est PAS normalisée à notre convenance", () => {
  // Réécrire « m2 » en « m² », ou « mètres linéaires » en « ml », changerait
  // ses données à son insu — et l'unité décide de la multiplication par une
  // quantité (`src/lib/unites-tarif.ts`).
  for (const u of ["m2", "mètres linéaires", "stère", "arbre"]) {
    assert.equal(structureDeLaPrestation(ligne({ quantite: "3", unite: u })).unite, u);
  }
});

cas("le doute du modèle est recopié tel quel", () => {
  assert.equal(structureDeLaPrestation(ligne({ aConfirmer: true })).aConfirmer, true);
  assert.equal(structureDeLaPrestation(ligne({ aConfirmer: false })).aConfirmer, false);
});

console.log("\n=== Ce que ses réponses à l'arrêt disent de la prestation ===\n");

cas("la technique devient la méthode", () => {
  const s = structureDepuisPrecisions([{ sujet: "abattage.technique#2", valeur: "demontage_retention" }]);
  assert.equal(s.methode, "demontage_retention");
});

cas("le diamètre et la hauteur deviennent des mesures", () => {
  const s = structureDepuisPrecisions([
    { sujet: "abattage.diametre#0", valeur: "45" },
    { sujet: "fendage.hauteur#1", valeur: "12" },
    { sujet: "haie.longueur#2", valeur: "20" },
  ]);
  assert.deepEqual(s.caracteristiques, { diametreCm: 45, hauteurM: 12, longueurMl: 20 });
});

cas("le diamètre est celui de l'ARBRE, quelle que soit la question posée", () => {
  // Il est demandé tantôt pour l'abattage, tantôt pour la fente. C'est le même
  // tronc : la mesure porte le nom de ce qu'elle mesure, pas de la question.
  const a = structureDepuisPrecisions([{ sujet: "abattage.diametre#0", valeur: "45" }]);
  const f = structureDepuisPrecisions([{ sujet: "fendage.diametre#0", valeur: "45" }]);
  assert.deepEqual(a.caracteristiques, f.caracteristiques);
});

cas("rien de mesuré donne NULL, jamais un objet vide", () => {
  // Un objet vide dirait « on a regardé, il n'y a rien à mesurer ». NULL dit
  // « on ne sait pas », et c'est ce qui est vrai.
  assert.equal(structureDepuisPrecisions([]).caracteristiques, null);
  assert.equal(structureDepuisPrecisions([{ sujet: "abattage.technique#0", valeur: "au_pied" }]).caracteristiques, null);
});

cas("une mesure illisible est ignorée, pas convertie en zéro", () => {
  const s = structureDepuisPrecisions([
    { sujet: "abattage.diametre#0", valeur: "à voir sur place" },
    { sujet: "fendage.hauteur#0", valeur: "0" },
  ]);
  assert.equal(s.caracteristiques, null);
});

console.log("\n=== Les travaux réunis dans une ligne se relisent d'un seul endroit ===\n");

cas("le séparateur est le retour à la ligne — sa demande du 8 août", () => {
  assert.deepEqual(membresDuLibelle("Abattage d'un chêne\nBroyage des branches"), [
    "Abattage d'un chêne",
    "Broyage des branches",
  ]);
});

cas("une ligne d'un seul travail rend un seul membre", () => {
  assert.deepEqual(membresDuLibelle("Taille de haie (20 ml)"), ["Taille de haie (20 ml)"]);
});

cas("le vide ne rend rien", () => assert.deepEqual(membresDuLibelle("  \n \n"), []));

console.log(`\n${reussites} réussite(s), ${echecs} échec(s).`);
if (echecs > 0) process.exitCode = 1;
