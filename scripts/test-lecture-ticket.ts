import assert from "node:assert/strict";
import { lireReponseTicket } from "../src/server/ai/services/lire-ticket";

// Ce que le modèle répond, et ce qu'on en tire.
//
// **C'est ici que vivent les vrais pièges, et non dans l'appel réseau.** Un
// modèle qui lit un ticket répond juste neuf fois sur dix ; la dixième, il
// entoure son objet d'une phrase, rend « 96,00 € » là où on attend un nombre,
// ou invente un montant pour ne pas laisser un champ vide. Chacun de ces
// travers a sa défense ci-dessous.
//
// **L'appel au fournisseur, lui, n'est PAS éprouvé ici** : cet environnement
// n'a aucune clé. Il devra l'être sur le banc du patron, avec un vrai ticket.

let echecs = 0;
function cas(nom: string, f: () => void) {
  try { f(); console.log(`  ✓ ${nom}`); }
  catch (e) { echecs++; console.error(`  ✗ ${nom}\n    ${(e as Error).message}`); }
}

console.log("=== Lire la réponse d'un ticket ===\n");

const BON = `{"fournisseur":"Station Total Pessac","date":"2026-08-12","total_ttc":96,"taux_tva":20,"tva":16}`;

cas("un objet propre se lit entièrement", () => {
  const r = lireReponseTicket(BON);
  assert.equal(r.ok, true);
  if (!r.ok) return;
  assert.equal(r.ticket.fournisseur, "Station Total Pessac");
  assert.equal(r.ticket.date, "2026-08-12");
  assert.equal(r.ticket.totalTtc, 96);
  assert.equal(r.ticket.tvaDeductible, 16);
  assert.equal(r.ticket.reserve, null, "un ticket entièrement lu n'a rien à signaler");
});

// **Travers n° 1 : il entoure son objet.** Balises de code, « Voici le
// résultat », un mot d'excuse. Exiger un JSON nu jetterait une lecture juste.
cas("un objet entouré de prose ou de balises se lit quand même", () => {
  for (const enrobage of [
    "Voici le résultat :\n" + BON,
    "```json\n" + BON + "\n```",
    BON + "\n\nJ'espère que cela convient.",
  ]) {
    const r = lireReponseTicket(enrobage);
    assert.equal(r.ok, true, `refusé : ${enrobage.slice(0, 30)}…`);
    if (r.ok) assert.equal(r.ticket.tvaDeductible, 16);
  }
});

// **Travers n° 2 : des chaînes là où on attend des nombres.**
cas("« 96,00 € » vaut 96", () => {
  const r = lireReponseTicket(`{"fournisseur":"X","date":"2026-08-12","total_ttc":"96,00 €","taux_tva":"20 %","tva":"16,00 €"}`);
  assert.equal(r.ok, true);
  if (!r.ok) return;
  assert.equal(r.ticket.totalTtc, 96);
  assert.equal(r.ticket.tauxTva, 20);
  assert.equal(r.ticket.tvaDeductible, 16);
});

cas("ce qui n'est pas du JSON est refusé, pas deviné", () => {
  for (const texte of ["Je ne peux pas lire ce ticket.", "", "```", "{ ceci n'est pas du json }"]) {
    assert.equal(lireReponseTicket(texte).ok, false, `accepté à tort : ${texte}`);
  }
});

// **Travers n° 3 : il invente pour faire plaisir.** Chaque champ absurde
// retombe à null plutôt que d'entrer dans le relevé.
cas("un montant négatif est écarté", () => {
  const r = lireReponseTicket(`{"fournisseur":"X","date":"2026-08-12","total_ttc":-96,"taux_tva":20,"tva":-16}`);
  assert.equal(r.ok, true);
  if (!r.ok) return;
  assert.equal(r.ticket.totalTtc, null);
  assert.equal(r.ticket.tvaDeductible, null);
});

cas("un taux impossible est écarté", () => {
  for (const taux of [0, -20, 250]) {
    const r = lireReponseTicket(`{"fournisseur":"X","date":"2026-08-12","total_ttc":96,"taux_tva":${taux},"tva":16}`);
    assert.equal(r.ok, true);
    if (r.ok) assert.equal(r.ticket.tauxTva, null, `taux ${taux} accepté à tort`);
  }
});

cas("une date qui n'en est pas une est écartée", () => {
  for (const d of ['"12/08/2026"', '"hier"', '"3000-01-01"', '"1980-01-01"', "null"]) {
    const r = lireReponseTicket(`{"fournisseur":"X","date":${d},"total_ttc":96,"taux_tva":20,"tva":16}`);
    assert.equal(r.ok, true);
    if (r.ok) assert.equal(r.ticket.date, null, `date ${d} acceptée à tort`);
  }
});

// **Une TVA plus grande que le total est une lecture fautive, pas un cas
// rare** — et la laisser passer ferait grossir le relevé d'un montant
// imaginaire, sans que rien ne le dise.
cas("une TVA supérieure au total est refusée, et le dit", () => {
  const r = lireReponseTicket(`{"fournisseur":"X","date":"2026-08-12","total_ttc":96,"taux_tva":20,"tva":960}`);
  assert.equal(r.ok, true);
  if (!r.ok) return;
  assert.notEqual(r.ticket.tvaDeductible, 960);
  assert.ok(r.ticket.reserve && /dépassait le total/.test(r.ticket.reserve), r.ticket.reserve ?? "aucune réserve");
});

// Le ticket ne l'affichait pas : on la calcule, ET ON LE DIT. Le patron doit
// savoir que ce chiffre vient d'un calcul, pas de son papier.
cas("une TVA absente est calculée depuis le total et le taux, et signalée", () => {
  const r = lireReponseTicket(`{"fournisseur":"X","date":"2026-08-12","total_ttc":120,"taux_tva":20,"tva":null}`);
  assert.equal(r.ok, true);
  if (!r.ok) return;
  assert.equal(r.ticket.tvaDeductible, 20, "120 € à 20 % contiennent 20 € de TVA, pas 24");
  assert.ok(r.ticket.reserve && /calculée/.test(r.ticket.reserve), r.ticket.reserve ?? "aucune réserve");
});

cas("sans total ni taux, la TVA reste introuvable et l'écran le sait", () => {
  const r = lireReponseTicket(`{"fournisseur":"X","date":"2026-08-12","total_ttc":null,"taux_tva":null,"tva":null}`);
  assert.equal(r.ok, true);
  if (!r.ok) return;
  assert.equal(r.ticket.tvaDeductible, null);
  assert.ok(r.ticket.reserve && /pas pu être lu/.test(r.ticket.reserve));
});

cas("chaque champ manquant est nommé dans la réserve, pas résumé", () => {
  const r = lireReponseTicket(`{"fournisseur":null,"date":null,"total_ttc":null,"taux_tva":null,"tva":null}`);
  assert.equal(r.ok, true);
  if (!r.ok) return;
  const reserve = r.ticket.reserve ?? "";
  assert.ok(/TVA/.test(reserve) && /fournisseur/.test(reserve) && /date/.test(reserve), reserve);
});

console.log(`\n${echecs === 0 ? "✅" : "❌"} Lecture d'un ticket — ${echecs} échec(s).`);
if (echecs > 0) process.exit(1);
