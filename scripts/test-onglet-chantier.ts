import assert from "node:assert/strict";
import { ongletDuChantier } from "../src/lib/onglet-chantier";

// **Un chantier n'apparaît que dans un seul onglet.**
//
// Le patron, le 6 août 2026, capture à l'appui : « une fois le chantier mis au
// planning il ne doit plus figurer dans la catégorie chantier mais seulement au
// planning, et une fois facturé ou leur date de planning passée il doit figurer
// seulement dans terminé ».
//
// Ce qu'il voyait : « Chez Martins », marqué FACTURÉ, dans la liste des
// chantiers — et le même, planifié le 12 août, dans le planning. Une liste qui
// empile tout ce qui a existé ne dit plus ce qui reste à faire.
//
// La règle est ici, et nulle part ailleurs : trois écrans l'appliquent, et
// recopiée trois fois elle rangerait à nouveau le même chantier à deux endroits.

const AUJ = "2026-08-06";

let echecs = 0;
function cas(nom: string, verifier: () => void) {
  try {
    verifier();
    console.log(`  ✓ ${nom}`);
  } catch (e) {
    echecs++;
    console.error(`  ✗ ${nom}\n    ${(e as Error).message}`);
  }
}

console.log("=== Où se range un chantier ===");

cas("un brouillon reste dans les chantiers", () => {
  assert.equal(ongletDuChantier({ statut: "brouillon" }, AUJ), "chantiers");
});

cas("un devis parti, une réponse attendue, un refus : toujours dans les chantiers", () => {
  for (const statut of ["devis_envoye", "en_attente_client", "a_relancer", "devis_retourne", "devis_caduc"] as const) {
    assert.equal(ongletDuChantier({ statut }, AUJ), "chantiers", statut);
  }
});

cas("planifié pour plus tard : au planning, et PLUS dans les chantiers", () => {
  assert.equal(ongletDuChantier({ statut: "planifie", datePlanifiee: "2026-08-12" }, AUJ), "planning");
});

cas("planifié pour aujourd'hui : encore au planning — la journée n'est pas finie", () => {
  assert.equal(ongletDuChantier({ statut: "planifie", datePlanifiee: AUJ }, AUJ), "planning");
});

cas("la date est passée : dans les terminés, même sans « Fin de chantier »", () => {
  assert.equal(ongletDuChantier({ statut: "planifie", datePlanifiee: "2026-08-05" }, AUJ), "termines");
});

cas("facturé : dans les terminés, où qu'en soit la date", () => {
  assert.equal(ongletDuChantier({ statut: "facture", datePlanifiee: "2026-09-30" }, AUJ), "termines");
  assert.equal(ongletDuChantier({ statut: "facture" }, AUJ), "termines");
});

cas("déclaré terminé : dans les terminés", () => {
  assert.equal(ongletDuChantier({ statut: "termine", datePlanifiee: "2026-09-30" }, AUJ), "termines");
});

console.log("\n=== Aucun chantier dans deux onglets à la fois ===");

cas("chaque état ne rend qu'un seul onglet — c'est le défaut d'origine", () => {
  const etats = [
    { statut: "brouillon" as const },
    { statut: "en_attente_client" as const },
    { statut: "planifie" as const, datePlanifiee: "2026-08-12" },
    { statut: "planifie" as const, datePlanifiee: "2026-08-01" },
    { statut: "facture" as const, datePlanifiee: "2026-08-12" },
  ];
  for (const e of etats) {
    const onglet = ongletDuChantier(e, AUJ);
    assert.ok(
      ["chantiers", "planning", "termines"].includes(onglet),
      `état ${JSON.stringify(e)} → onglet inattendu « ${onglet} »`
    );
  }
});

console.log(`\n${echecs === 0 ? "✅" : "❌"} Rangement des chantiers — ${echecs} échec(s).`);
if (echecs > 0) process.exit(1);
