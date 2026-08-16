// Les trois rappels : leurs règles, sans base ni navigateur.
//
// **Ce que cette suite protège.** L'écran de « Notifications » et l'action
// serveur emploient la même fonction pour borner et pour lire — deux
// implémentations divergeraient, et l'écart se verrait dans le pire sens : un
// nombre montré à l'écran, un autre appliqué au rappel (`CLAUDE.md` §3).
//
// **Le contrôle qui compte vraiment**, c'est la distinction entre « jamais
// réglé » et « éteint ». Les confondre rallumerait un rappel que le patron a
// délibérément coupé, et il le découvrirait par une alerte qu'il croyait morte.

import assert from "node:assert/strict";
import {
  RAPPELS_PAR_DEFAUT,
  BORNES_RAPPELS,
  lireRappels,
  normaliserRappels,
  seuilAncienneté,
  depuisCombien,
  joursEcoules,
} from "../src/lib/rappels";

let echecs = 0;
function essai(nom: string, fn: () => void) {
  try {
    fn();
    console.log(`  ✓ ${nom}`);
  } catch (e) {
    echecs++;
    console.log(`  ✗ ${nom}`);
    console.log(`    ${(e as Error).message}`);
  }
}

console.log("=== Les trois rappels : ce qui s'allume, et ce qui reste éteint ===\n");

essai("jamais réglé : les trois rappels sont allumés, aux délais du métier", () => {
  assert.deepEqual(lireRappels(undefined), RAPPELS_PAR_DEFAUT);
  assert.deepEqual(lireRappels({}), RAPPELS_PAR_DEFAUT);
});

// **LE CONTRÔLE CENTRAL.** `undefined` (colonne absente de la lecture) et `null`
// (réglé puis éteint) ne veulent pas dire la même chose. Les confondre
// rallumerait un rappel coupé exprès.
essai("éteint : une valeur nulle reste nulle, elle ne retombe pas sur le défaut", () => {
  const lu = lireRappels({ devisSansReponseJours: null, chantierNonFactureJours: null });
  assert.equal(lu.devisSansReponseJours, null);
  assert.equal(lu.chantierNonFactureJours, null);
});

essai("un rappel peut être allumé et l'autre éteint", () => {
  const lu = lireRappels({ devisSansReponseJours: 14, chantierNonFactureJours: null });
  assert.equal(lu.devisSansReponseJours, 14);
  assert.equal(lu.chantierNonFactureJours, null);
});

essai("une valeur hors bornes est RAMENÉE dans les bornes, pas refusée", () => {
  // Refuser laisserait le champ vide, donc le rappel éteint — l'inverse de ce
  // qu'il voulait en tapant un nombre.
  assert.equal(lireRappels({ devisSansReponseJours: 9999 }).devisSansReponseJours, BORNES_RAPPELS.devisSansReponseJours.max);
  assert.equal(lireRappels({ devisSansReponseJours: 0 }).devisSansReponseJours, BORNES_RAPPELS.devisSansReponseJours.min);
  assert.equal(lireRappels({ chantierNonFactureJours: -4 }).chantierNonFactureJours, BORNES_RAPPELS.chantierNonFactureJours.min);
});

essai("une saisie illisible éteint le rappel plutôt que d'inventer un délai", () => {
  assert.equal(lireRappels({ devisSansReponseJours: Number.NaN }).devisSansReponseJours, null);
});

essai("les jours sont entiers : un rappel « au bout de 3,5 jours » n'existe pas", () => {
  assert.equal(lireRappels({ devisSansReponseJours: 3.4 }).devisSansReponseJours, 3);
  assert.equal(lireRappels({ devisSansReponseJours: 3.6 }).devisSansReponseJours, 4);
});

// L'écriture emploie la MÊME fonction que la lecture : sans quoi l'écran
// montrerait un nombre et la base en garderait un autre.
essai("ce qui part en base est ce que l'écran a montré", () => {
  assert.deepEqual(normaliserRappels({ devisSansReponseJours: 9999, chantierNonFactureJours: 5 }), {
    // Non précisé = éteint, pas « inchangé » : l'écran envoie toujours les trois.
    chantierSansDevisJours: null,
    devisSansReponseJours: BORNES_RAPPELS.devisSansReponseJours.max,
    chantierNonFactureJours: 5,
  });
});

essai("écrire sans rien préciser éteint les trois, il ne les rallume pas", () => {
  // `normaliserRappels({})` est ce que rend un écran dont les trois
  // interrupteurs sont coupés : il ne doit pas retomber sur le défaut.
  assert.deepEqual(normaliserRappels({}), {
    chantierSansDevisJours: null,
    devisSansReponseJours: null,
    chantierNonFactureJours: null,
  });
});

console.log("");

essai("le seuil recule bien du nombre de jours demandé", () => {
  const maintenant = new Date("2026-08-14T12:00:00Z");
  assert.equal(seuilAncienneté(maintenant, 7).toISOString(), "2026-08-07T12:00:00.000Z");
  assert.equal(seuilAncienneté(maintenant, 1).toISOString(), "2026-08-13T12:00:00.000Z");
});

essai("l'ancienneté se dit en français, jamais en date brute", () => {
  const maintenant = new Date("2026-08-14T12:00:00Z");
  assert.equal(depuisCombien(maintenant, new Date("2026-08-14T09:00:00Z")), "aujourd'hui");
  assert.equal(depuisCombien(maintenant, new Date("2026-08-13T09:00:00Z")), "depuis hier");
  assert.equal(depuisCombien(maintenant, new Date("2026-08-06T12:00:00Z")), "depuis 8 jours");
});

// Un devis parti dans le futur n'existe pas, mais une horloge de travers, si.
// « depuis -2 jours » se lirait comme un défaut de l'application.
essai("une date à venir ne produit pas un nombre négatif", () => {
  const maintenant = new Date("2026-08-14T12:00:00Z");
  assert.equal(depuisCombien(maintenant, new Date("2026-08-16T12:00:00Z")), "aujourd'hui");
});

console.log("");
// ── Le troisième rappel : le devis jamais parti ─────────────────────────────
//
// **Quatre jours, et c'est SON chiffre**, donné le 16 août 2026 (« la B et 4 »)
// au milieu des « deux, trois, quatre, cinq, six » qu'il avait énumérés. Le
// figer ici plutôt que de le relire dans le code : une valeur par défaut qui
// change en silence, c'est un rappel qui se déclenche un autre jour sans que
// personne ne l'ait demandé.
essai("le devis jamais parti se rappelle au bout de 4 jours par défaut", () => {
  assert.equal(RAPPELS_PAR_DEFAUT.chantierSansDevisJours, 4);
  assert.equal(lireRappels(undefined).chantierSansDevisJours, 4);
});

essai("réglé puis éteint, il reste éteint — jamais réglé, il prend le défaut", () => {
  // La distinction qui compte : `null` est un choix, `undefined` une absence.
  assert.equal(lireRappels({ chantierSansDevisJours: null }).chantierSansDevisJours, null);
  assert.equal(lireRappels({}).chantierSansDevisJours, 4);
});

essai("un doigt qui glisse est ramené dans les bornes, jamais refusé", () => {
  assert.equal(lireRappels({ chantierSansDevisJours: 0 }).chantierSansDevisJours, BORNES_RAPPELS.chantierSansDevisJours.min);
  assert.equal(lireRappels({ chantierSansDevisJours: 900 }).chantierSansDevisJours, BORNES_RAPPELS.chantierSansDevisJours.max);
});

// **Le nombre montré et le nombre appliqué viennent du même calcul.** Sinon
// l'étiquette dirait « 14 jours » pendant que la phrase dit « depuis 13 jours »
// — deux vérités sur la même carte, et le patron chercherait laquelle est juste.
essai("l'étiquette et la phrase comptent les mêmes jours", () => {
  const maintenant = new Date("2026-08-16T12:00:00Z");
  const ouvertLe = new Date("2026-08-02T09:00:00Z");
  assert.equal(joursEcoules(maintenant, ouvertLe), 14);
  assert.equal(depuisCombien(maintenant, ouvertLe), "depuis 14 jours");
});

essai("un chantier ouvert à l'instant ne compte aucun jour", () => {
  const t = new Date("2026-08-16T12:00:00Z");
  assert.equal(joursEcoules(t, t), 0);
  assert.equal(depuisCombien(t, t), "aujourd'hui");
});

if (echecs) {
  console.log(`${echecs} ÉCHEC(S).`);
  process.exit(1);
}
console.log("Les rappels — 0 échec(s).");
