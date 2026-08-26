import assert from "node:assert/strict";
import {
  ecrireNumero,
  formatDe,
  FORMATS_NUMERO,
  FORMAT_PAR_DEFAUT,
  repartChaqueAnnee,
} from "../src/lib/numero-documents";

/**
 * LE NUMÉRO DE SES DEVIS ET DE SES FACTURES.
 *
 * *Ses trois décisions du 26 août 2026, devant `appli/format-de-numero.html` :
 * six chiffres, le « F » des factures gardé, le compteur qui repart à 1 au
 * 1ᵉʳ janvier.*
 *
 * **CE QUE CETTE SUITE EMPÊCHE, et qui est daté :** le millésime était écrit en
 * dur — `2026-0001`, `F2026-0001`. En janvier 2027, ses factures auraient
 * encore dit 2026. Aucune suite ne l'attrapait, parce qu'elles tournent
 * aujourd'hui : celle-ci écrit des années à la main, et c'est tout l'objet du
 * premier contrôle.
 */

let reussis = 0;
function cas(nom: string, verifier: () => void) {
  try {
    verifier();
    reussis++;
    console.log(`  ✓ ${nom}`);
  } catch (e) {
    console.error(`  ✗ ${nom}\n    ${e instanceof Error ? e.message : String(e)}`);
    process.exitCode = 1;
  }
}

console.log("=== Le numéro des documents ===");

cas("LE MILLÉSIME SUIT L'ANNÉE — le défaut à retardement du code d'avant", () => {
  // Le contrôle qui compte. Il écrit 2027, 2030, 2099 : des années qu'aucune
  // batterie ne verra avant qu'il ne soit trop tard.
  for (const annee of [2026, 2027, 2030, 2099]) {
    const n = ecrireNumero("annee-6", "facture", { annee, mois: 3, numero: 12 });
    assert.equal(n, `F${annee}-000012`, `en ${annee}, la facture porte « ${n} »`);
  }
  assert.notEqual(
    ecrireNumero("annee-6", "facture", { annee: 2027, mois: 1, numero: 1 }),
    "F2026-000001",
    "le millésime est revenu en dur : ses factures de janvier diront 2026"
  );
});

cas("SA DÉCISION : six chiffres par défaut", () => {
  assert.equal(FORMAT_PAR_DEFAUT, "annee-6");
  assert.equal(
    ecrireNumero(null, "facture", { annee: 2026, mois: 8, numero: 13 }),
    "F2026-000013"
  );
});

cas("SA DÉCISION : le « F » ne coiffe que les factures", () => {
  // Sans lui, un devis et une facture du même rang se ressemblent — et c'est le
  // genre de confusion qui se paie devant un contrôle.
  const meme = { annee: 2026, mois: 8, numero: 12 };
  assert.equal(ecrireNumero("annee-6", "devis", meme), "2026-000012");
  assert.equal(ecrireNumero("annee-6", "facture", meme), "F2026-000012");
});

cas("les cinq formats écrivent ce que la planche annonçait", () => {
  // Ce qu'il a vu du doigt et ce que le code rend doivent coïncider : c'est sur
  // la planche qu'il a choisi.
  const attendu: Record<string, [string, string]> = {
    "annee-4": ["2026-0012", "F2026-0012"],
    "annee-6": ["2026-000012", "F2026-000012"],
    court: ["26-0012", "F26-0012"],
    mois: ["2026-08-012", "F2026-08-012"],
    suite: ["0012", "F0012"],
  };
  for (const f of FORMATS_NUMERO) {
    const v = { annee: 2026, mois: 8, numero: 12 };
    assert.deepEqual(
      [ecrireNumero(f.clef, "devis", v), ecrireNumero(f.clef, "facture", v)],
      attendu[f.clef],
      `« ${f.nom} » ne rend plus ce que la planche montrait`
    );
  }
});

cas("LE COMPTEUR NE REPART PAS QUAND L'ANNÉE N'EST PAS AU NUMÉRO", () => {
  // **La règle qui protège d'un DOUBLON, pas d'une laideur.** « Une suite sans
  // année » remise à 1 donnerait deux documents « 0001 » à un an d'écart — un
  // doublon dans une suite est exactement ce que la loi interdit.
  assert.equal(repartChaqueAnnee("suite"), false);
  for (const f of ["annee-4", "annee-6", "court", "mois"]) {
    assert.equal(repartChaqueAnnee(f), true, `« ${f} » porte l'année et doit repartir`);
  }
});

cas("un format inconnu retombe sur le défaut, il ne casse rien", () => {
  // Une clef écrite par une version d'avant, ou un format retiré du dépôt : le
  // document doit sortir, pas refuser de se numéroter.
  assert.equal(formatDe("un-format-retire").clef, FORMAT_PAR_DEFAUT);
  assert.equal(formatDe(null).clef, FORMAT_PAR_DEFAUT);
  assert.equal(
    ecrireNumero("n'existe pas", "devis", { annee: 2026, mois: 1, numero: 1 }),
    "2026-000001"
  );
});

cas("aucune clef en double, et le défaut existe vraiment", () => {
  const clefs = FORMATS_NUMERO.map((f) => f.clef);
  assert.equal(new Set(clefs).size, clefs.length, clefs.join(" "));
  assert.ok(clefs.includes(FORMAT_PAR_DEFAUT), "le format par défaut ne figure pas dans la liste");
});

cas("un numéro plus large que le format n'est jamais TRONQUÉ", () => {
  // Au 10 000ᵉ document d'une année, le numéro déborde de ses quatre chiffres.
  // Le couper donnerait « 0000 » — un doublon de plus. Il s'allonge.
  assert.equal(ecrireNumero("annee-4", "devis", { annee: 2026, mois: 1, numero: 10_000 }), "2026-10000");
  assert.equal(ecrireNumero("mois", "devis", { annee: 2026, mois: 1, numero: 1234 }), "2026-01-1234");
});

cas("le mois s'écrit sur deux chiffres, de janvier à décembre", () => {
  assert.equal(ecrireNumero("mois", "devis", { annee: 2026, mois: 1, numero: 1 }), "2026-01-001");
  assert.equal(ecrireNumero("mois", "devis", { annee: 2026, mois: 12, numero: 1 }), "2026-12-001");
});

cas("l'année courte garde son zéro — 2007 donne « 07 », jamais « 7 »", () => {
  assert.equal(ecrireNumero("court", "devis", { annee: 2007, mois: 1, numero: 1 }), "07-0001");
});

console.log(`\n${reussis} test(s) réussi(s)`);
