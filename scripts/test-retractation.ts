import assert from "node:assert/strict";
import { dansDelaiRetractation } from "../src/lib/jour";
import { paragraphesFormulaire } from "../src/lib/retractation";

// ═══════════════════════════════════════════════════════════════════════════
// LES 14 JOURS DE RÉTRACTATION DU CLIENT — 3 octobre 2026
// ═══════════════════════════════════════════════════════════════════════════
//
// Le délai court à compter du LENDEMAIN de l'accord (Code de la
// consommation, L221-18 et L221-19) : accepté le 3 octobre, il s'achève le
// 17 au soir. Des travaux qui commencent le 17 tombent donc DANS le délai, et
// le client doit l'avoir demandé expressément (L221-25, son choix 3A).
//
// Vu rouge sur l'ancienne règle, qui laissait passer le 17 sans la case.

let ok = 0;
function cas(nom: string, fn: () => void) {
  fn();
  ok++;
  console.log(`  ✓ ${nom}`);
}

console.log("— dansDelaiRetractation : le jour où les travaux commencent —");

cas("le lendemain de l'accord est dans le délai", () => {
  assert.equal(dansDelaiRetractation("2026-10-04", "2026-10-03"), true);
});

cas("le 14e jour après l'accord est ENCORE dans le délai", () => {
  assert.equal(dansDelaiRetractation("2026-10-17", "2026-10-03"), true);
});

cas("le 15e jour, le délai est fini", () => {
  assert.equal(dansDelaiRetractation("2026-10-18", "2026-10-03"), false);
});

cas("à cheval sur un changement d'heure, le compte ne bouge pas", () => {
  assert.equal(dansDelaiRetractation("2026-11-08", "2026-10-25"), true);
  assert.equal(dansDelaiRetractation("2026-11-09", "2026-10-25"), false);
});

console.log("— le formulaire type (annexe de R221-1) —");

cas("il porte l'adresse de l'artisan, le devis, et chaque case à remplir", () => {
  const p = paragraphesFormulaire({
    nom: "Atelier Démo EI",
    adresse: "10 rue des Artisans, Nantes",
    email: "contact@atelier-demo.fr",
    numeroDevis: "2026-000002",
    dateDevis: "03/10/2026",
  }).join("\n");
  assert.match(p, /À l'attention de Atelier Démo EI, 10 rue des Artisans, Nantes, contact@atelier-demo\.fr/);
  assert.match(p, /Devis n° 2026-000002 du 03\/10\/2026/);
  for (const c of ["Commandé le", "Nom du (des) consommateur(s)", "Adresse du (des) consommateur(s)", "Signature", "Date :", "Rayez la mention inutile"]) {
    assert.ok(p.includes(c), `il manque « ${c} »`);
  }
});

cas("une coordonnée absente ne laisse pas de virgule orpheline", () => {
  const p = paragraphesFormulaire({ nom: "Atelier Démo", adresse: null, email: "", numeroDevis: "1", dateDevis: "x" });
  assert.ok(p.some((l) => l === "À l'attention de Atelier Démo :"));
});

console.log(`\n✅ ${ok} vérifications passent.`);
