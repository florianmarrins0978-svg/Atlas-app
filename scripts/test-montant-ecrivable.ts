// UN MONTANT VENU DU MODÈLE NE S'ÉCRIT PAS LES YEUX FERMÉS.
//
// ═══════════════════════════════════════════════════════════════════════════
// **CE QUE CETTE SUITE DÉFEND** — lot de clôture, 29 août 2026.
//
// Sur le chemin de l'assistant, une ligne de prix sans `tarifId` prenait son
// montant directement dans ce que le modèle avait rendu. La base refusait le
// négatif, et rien d'autre : ni `NaN`, ni `"1e9"`, ni sept décimales, ni
// 99 999 999,99 €.
//
// **Elle éprouve les deux moitiés, et il faut les deux** : ce qui doit être
// refusé, ET ce qui doit passer. Une borne qui refuse tout passerait au vert en
// rendant l'assistant inutilisable — et un chantier de terrassement à
// 45 000 € est un montant parfaitement réel.
//
// Ni base, ni réseau, ni navigateur : une fonction pure.

import assert from "node:assert/strict";
import { montantEcrivable, MONTANT_MAXIMAL } from "../src/lib/montant-ecrivable";

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

const refuse = (brut: unknown, quoi: string) => {
  const r = montantEcrivable(brut);
  assert.equal(r.ok, false, `${quoi} : ACCEPTÉ alors qu'il devait être refusé`);
  // Le refus doit dire quelque chose : « impossible » tout court renverrait
  // chercher au mauvais endroit.
  if (!r.ok) assert.ok(r.raison.length > 10, `${quoi} : le refus n'explique rien`);
};

const accepte = (brut: unknown, attendu: string) => {
  const r = montantEcrivable(brut);
  assert.equal(r.ok, true, `${JSON.stringify(brut)} : refusé alors qu'il est légitime`);
  if (r.ok) assert.equal(r.montant, attendu, `${JSON.stringify(brut)} rendu « ${r.montant} »`);
};

console.log("=== Un montant écrivable ===\n");

// ─── CE QUI DOIT PASSER — la moitié qui empêche de tout fermer ─────────────
essai("les montants ordinaires passent, dans les écritures du patron", () => {
  accepte("45", "45.00");
  accepte("45.5", "45.50");
  accepte("1234,50", "1234.50");
  // L'espace des milliers et l'euro collé : c'est ainsi qu'un artisan écrit.
  accepte("1 234,50 €", "1234.50");
  accepte(0, "0.00");
  accepte(38.5, "38.50");
});

essai("UN GROS CHANTIER PASSE — aucun plafond métier n'est inventé", () => {
  // Terrassement, création complète, contrat annuel : ces montants existent.
  // Refuser « au-dessus de 10 000 » refuserait du travail réel.
  accepte("45000", "45000.00");
  accepte("120000,00", "120000.00");
});

essai("la limite exacte de la colonne passe encore", () => {
  accepte(MONTANT_MAXIMAL, "99999999.99");
});

// ─── CE QUI DOIT ÊTRE REFUSÉ ───────────────────────────────────────────────
essai("NaN est refusé — et c'est le cas qui échapperait à une simple comparaison", () => {
  // `NaN > MAX` est FAUX, `NaN < 0` aussi : sans `Number.isFinite`, il
  // traverserait les deux bornes et arriverait en base.
  refuse(Number.NaN, "NaN");
});

essai("l'infini est refusé, dans les deux sens", () => {
  refuse(Number.POSITIVE_INFINITY, "Infinity");
  refuse(Number.NEGATIVE_INFINITY, "-Infinity");
});

essai("le négatif est refusé, et le refus le DIT", () => {
  refuse(-1, "-1");
  refuse("-250,00", "« -250,00 »");
});

essai("au-delà de ce que la colonne porte, refusé", () => {
  refuse(MONTANT_MAXIMAL + 0.01, "un centime de trop");
  refuse("999999999999", "douze chiffres");
});

essai("plus de deux décimales : refusé plutôt que tronqué en silence", () => {
  // La colonne `numeric(10,2)` arrondirait sans rien dire. Un prix qui change
  // entre ce qui est proposé et ce qui est écrit est exactement ce que ce lot
  // corrige ailleurs.
  refuse("12.345", "trois décimales");
  refuse(12.345, "trois décimales, en nombre");
});

essai("les écritures ambiguës que Number() accepterait sont refusées", () => {
  // `Number("0x1F")` vaut 31, `Number("1e9")` vaut un milliard, et
  // `Number("Infinity")` vaut l'infini. Aucune n'est un montant qu'un humain a
  // tapé — et toutes seraient passées avec une simple conversion.
  refuse("0x1F", "hexadécimal");
  refuse("1e9", "notation scientifique");
  refuse("Infinity", "le mot Infinity");
  refuse("12,34,56", "deux virgules");
  refuse("douze euros", "du texte");
  refuse("", "la chaîne vide");
  refuse("   ", "des espaces seuls");
});

essai("ce qui n'est ni nombre ni chaîne est refusé", () => {
  // Le modèle rend du JSON : un objet ou un tableau peut arriver là.
  refuse(null, "null");
  refuse(undefined, "undefined");
  refuse({ montant: 45 }, "un objet");
  refuse([45], "un tableau");
  refuse(true, "un booléen");
});

console.log("");
console.log(`${echecs === 0 ? "✅" : "❌"} Montant écrivable — ${echecs} échec(s).`);
process.exit(echecs > 0 ? 1 : 0);
