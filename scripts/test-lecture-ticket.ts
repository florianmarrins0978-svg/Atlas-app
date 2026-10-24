import assert from "node:assert/strict";
import { consigneDeLecture, lireReponseTicket as lireAuJour } from "../src/server/ai/services/lire-ticket";

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

// Le jour de la lecture est FIXÉ : un contrôle qui lirait l'horloge rougirait
// tout seul dans deux ans, sur des tickets de 2026 devenus trop vieux.
const AUJOURDHUI = "2026-10-26";
const lireReponseTicket = (texte: string) => lireAuJour(texte, AUJOURDHUI);

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

// La nature n'est qu'une PROPOSITION (13 octobre 2026) : il la confirme. Une
// valeur hors de la liste est une invention du modèle, et ne coche rien.
cas("la nature lue se propose, une nature inventée ne coche rien", () => {
  const lu = lireReponseTicket(`{"fournisseur":"Total","tva":16,"nature":"carburant"}`);
  assert.equal(lu.ok && lu.ticket.nature, "carburant");
  const invente = lireReponseTicket(`{"fournisseur":"Total","tva":16,"nature":"essence"}`);
  assert.equal(invente.ok && invente.ticket.nature, null);
  const absent = lireReponseTicket(`{"fournisseur":"Total","tva":16}`);
  assert.equal(absent.ok && absent.ticket.nature, null);
});

// **Le 26 octobre 2026, un ticket du jour a été rangé en « Octobre 2023 ».**
// Le modèle ne sait pas quel jour on est : devant « 26/10/26 » ou une date
// sans année, il complète avec l'année de ses souvenirs. Deux défenses : la
// consigne lui donne le jour, et la lecture refuse une date qui ne peut pas
// être celle d'un ticket qu'on scanne pour sa TVA.
cas("la consigne donne au modèle le jour de la lecture", () => {
  const c = consigneDeLecture(AUJOURDHUI);
  assert.ok(c.includes("2026-10-26"), c);
  assert.ok(/deux chiffres/.test(c), "l'année sur deux chiffres doit être dite");
});

// **Sa correction du 23 octobre 2026 : « il y a une date sur le ticket,
// utilise celle-ci ! »** Le modèle recopie la date telle qu'imprimée ; c'est
// le code qui la lit, jamais le modèle qui la complète.
cas("la date imprimée sur le ticket l'emporte sur celle que le modèle déduit", () => {
  for (const [ecrite, attendue] of [
    ["26/10/26", "2026-10-26"],
    ["26/10/2026", "2026-10-26"],
    ["26.10.26", "2026-10-26"],
    ["26-10-2026 07:31", "2026-10-26"],
    ["LE 05/09/26 A 18H02", "2026-09-05"],
  ]) {
    const r = lireReponseTicket(`{"fournisseur":"TotalEnergies","date_ecrite":"${ecrite}","date":"2023-10-26","total_ttc":50,"taux_tva":20,"tva":8.33}`);
    assert.equal(r.ok && r.ticket.date, attendue, `« ${ecrite} »`);
  }
});

cas("une date imprimée impossible ne se corrige pas en silence", () => {
  const r = lireReponseTicket(`{"fournisseur":"X","date_ecrite":"31/02/26","date":"2026-02-28","total_ttc":50,"taux_tva":20,"tva":8.33}`);
  assert.equal(r.ok && r.ticket.date, null);
});

cas("une date trop ancienne pour sa TVA est écartée, et le dit", () => {
  const r = lireReponseTicket(`{"fournisseur":"TotalEnergies","date":"2023-10-26","total_ttc":50,"taux_tva":20,"tva":8.33}`);
  assert.equal(r.ok, true);
  if (!r.ok) return;
  assert.equal(r.ticket.date, null, "2023 lu le 26 octobre 2026 : la TVA n'est plus récupérable, c'est une lecture fautive");
  assert.ok(r.ticket.reserve && /date/.test(r.ticket.reserve), r.ticket.reserve ?? "aucune réserve");
});

cas("une date dans le futur est écartée", () => {
  const r = lireReponseTicket(`{"fournisseur":"X","date":"2026-10-27","total_ttc":50,"taux_tva":20,"tva":8.33}`);
  assert.equal(r.ok && r.ticket.date, null);
});

cas("le délai de récupération se tient jusqu'au 1er janvier d'il y a deux ans", () => {
  const limite = lireReponseTicket(`{"fournisseur":"X","date":"2024-01-01","total_ttc":50,"taux_tva":20,"tva":8.33}`);
  assert.equal(limite.ok && limite.ticket.date, "2024-01-01");
  const avant = lireReponseTicket(`{"fournisseur":"X","date":"2023-12-31","total_ttc":50,"taux_tva":20,"tva":8.33}`);
  assert.equal(avant.ok && avant.ticket.date, null);
  const duJour = lireReponseTicket(`{"fournisseur":"X","date":"2026-10-26","total_ttc":50,"taux_tva":20,"tva":8.33}`);
  assert.equal(duJour.ok && duJour.ticket.date, "2026-10-26");
});

cas("les lignes imprimées se recopient telles quelles, doublons compris", () => {
  const r = lireReponseTicket(
    `{"fournisseur":"INTERMARCHE","date":"2026-10-22","total_ttc":30.12,"taux_tva":5.5,"tva":1.57,"lignes":[{"g":"REAL THAI LAIT COCO","d":"1,66 EUR A"},{"g":"REAL THAI LAIT COCO","d":"1,66 EUR A"},{"g":"MONTANT DU","d":"30,12 EUR"}]}`
  );
  assert.ok(r.ok);
  assert.equal(r.ticket.lignes?.length, 3);
  assert.deepEqual(r.ticket.lignes?.[2], { gauche: "MONTANT DU", droite: "30,12 EUR" });
  const sans = lireReponseTicket(`{"fournisseur":"X","date":"2026-10-22","total_ttc":5,"taux_tva":20,"tva":0.83}`);
  assert.equal(sans.ok && sans.ticket.lignes, null);
});

console.log(`\n${echecs === 0 ? "✅" : "❌"} Lecture d'un ticket — ${echecs} échec(s).`);
if (echecs > 0) process.exit(1);
