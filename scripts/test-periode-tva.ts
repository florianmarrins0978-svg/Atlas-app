import assert from "node:assert/strict";
import {
  dansLaPeriode,
  periodeContenant,
  libelleCourt,
  libellePeriode,
  lirePeriode,
  moisDuNumero,
  nombreDePeriodes,
  periodeCourante,
  periodePrecedente,
  periodeSuivante,
  periodeTva,
  PERIODICITE_TVA_PAR_DEFAUT,
} from "../src/server/periode-tva";

// Le découpage de l'année pour le relevé de TVA, au mois ou au trimestre.
//
// **Ce que cette suite garde, et qu'on ne voit pas à l'œil.** Une période mal
// bornée ne se remarque pas : l'écran affiche un total, il a l'air juste, et il
// manque une facture. Le 31 d'un mois de 31 jours, le 29 février d'une année
// bissextile et le passage d'une année à l'autre sont les trois endroits où ça
// se casse — et aucun ne se voit sur une capture.

let echecs = 0;
function cas(nom: string, f: () => void) {
  try {
    f();
    console.log(`  ✓ ${nom}`);
  } catch (e) {
    echecs++;
    console.error(`  ✗ ${nom}\n    ${(e as Error).message}`);
  }
}

console.log("=== Les périodes de TVA, au mois et au trimestre ===\n");

// **Le mois est le défaut LÉGAL, pas une préférence.** La déclaration CA3 est
// mensuelle par défaut ; le trimestre est une option sous condition. Poser le
// trimestre par défaut, c'est ce que faisait l'écran avant le 12 août 2026,
// sans qu'aucune ligne du dépôt n'explique pourquoi.
cas("la périodicité par défaut est le mois", () => {
  assert.equal(PERIODICITE_TVA_PAR_DEFAUT, "mensuelle");
});

cas("une année compte douze mois ou quatre trimestres", () => {
  assert.equal(nombreDePeriodes("mensuelle"), 12);
  assert.equal(nombreDePeriodes("trimestrielle"), 4);
});

cas("un mois est borné au premier et au dernier jour", () => {
  assert.deepEqual(
    { d: periodeTva("mensuelle", 2026, 8).debut, f: periodeTva("mensuelle", 2026, 8).fin },
    { d: "2026-08-01", f: "2026-08-31" }
  );
});

cas("un trimestre couvre ses trois mois entiers", () => {
  const t = periodeTva("trimestrielle", 2026, 3);
  assert.equal(t.debut, "2026-07-01");
  assert.equal(t.fin, "2026-09-30");
});

// Février est le seul mois dont la longueur change, et une facture du 29 tombe
// hors de la période si la borne est calculée à la main.
cas("février d'une année bissextile va jusqu'au 29", () => {
  assert.equal(periodeTva("mensuelle", 2028, 2).fin, "2028-02-29");
  assert.equal(periodeTva("mensuelle", 2026, 2).fin, "2026-02-28");
});

cas("les mois de 30 et 31 jours sont bornés justes", () => {
  assert.equal(periodeTva("mensuelle", 2026, 4).fin, "2026-04-30");
  assert.equal(periodeTva("mensuelle", 2026, 12).fin, "2026-12-31");
});

// **Aucun trou, aucun recouvrement.** Une facture émise n'importe quel jour de
// l'année doit tomber dans exactement une période — sinon elle est comptée deux
// fois, ou pas du tout, et le total est faux sans que rien ne le dise.
cas("INVARIANT — les périodes d'une année se suivent sans trou ni recouvrement", () => {
  for (const p of ["mensuelle", "trimestrielle"] as const) {
    let attendu = `2026-01-01`;
    for (let n = 1; n <= nombreDePeriodes(p); n++) {
      const periode = periodeTva(p, 2026, n);
      assert.equal(periode.debut, attendu, `${p} n° ${n} ne commence pas où la précédente s'arrête`);
      const lendemain = new Date(`${periode.fin}T12:00:00Z`);
      lendemain.setUTCDate(lendemain.getUTCDate() + 1);
      attendu = lendemain.toISOString().slice(0, 10);
    }
    assert.equal(attendu, "2027-01-01", `${p} : l'année ne se referme pas au 31 décembre`);
  }
});

cas("la période courante suit la périodicité", () => {
  const le12aout = new Date("2026-08-12T10:00:00Z");
  assert.equal(periodeCourante("mensuelle", le12aout).numero, 8);
  assert.equal(periodeCourante("trimestrielle", le12aout).numero, 3);
});

cas("janvier recule sur décembre de l'année d'avant", () => {
  const p = periodePrecedente(periodeTva("mensuelle", 2026, 1));
  assert.equal(p.annee, 2025);
  assert.equal(p.numero, 12);
});

cas("décembre avance sur janvier de l'année d'après", () => {
  const p = periodeSuivante(periodeTva("mensuelle", 2026, 12));
  assert.equal(p.annee, 2027);
  assert.equal(p.numero, 1);
});

cas("le 4e trimestre avance sur le 1er de l'année d'après", () => {
  const p = periodeSuivante(periodeTva("trimestrielle", 2026, 4));
  assert.equal(p.annee, 2027);
  assert.equal(p.numero, 1);
});

cas("avancer puis reculer ramène au même endroit", () => {
  for (const p of ["mensuelle", "trimestrielle"] as const) {
    for (let n = 1; n <= nombreDePeriodes(p); n++) {
      const depart = periodeTva(p, 2026, n);
      const retour = periodePrecedente(periodeSuivante(depart));
      assert.deepEqual(retour, depart, `${p} n° ${n} ne revient pas sur ses pas`);
    }
  }
});

cas("les libellés se lisent en français, sans jargon", () => {
  assert.equal(libellePeriode(periodeTva("mensuelle", 2026, 8)), "Août 2026");
  assert.equal(libellePeriode(periodeTva("mensuelle", 2026, 1)), "Janvier 2026");
  assert.equal(libellePeriode(periodeTva("trimestrielle", 2026, 1)), "1er trimestre 2026");
  assert.equal(libellePeriode(periodeTva("trimestrielle", 2026, 3)), "3e trimestre 2026");
});

cas("le libellé court sert le calendrier, sans l'année", () => {
  assert.equal(libelleCourt("mensuelle", 9), "Septembre");
  assert.equal(libelleCourt("trimestrielle", 2), "2e trimestre");
});

// Un mois n'a pas besoin qu'on lui explique de quels mois il est fait ; un
// trimestre, si — « 3e trimestre » ne dit pas à qui cherche une facture d'août
// que c'est là qu'il faut regarder.
cas("un trimestre annonce ses mois, un mois ne s'explique pas lui-même", () => {
  assert.equal(moisDuNumero("trimestrielle", 3), "juil. – sept.");
  assert.equal(moisDuNumero("trimestrielle", 1), "janv. – mars");
  assert.equal(moisDuNumero("mensuelle", 8), null);
});

// **Un paramètre bricolé dans la barre d'adresse ne doit pas produire un écran
// vide et inexplicable**, ni une période de l'an 40 000.
cas("une adresse illisible est refusée, jamais devinée", () => {
  assert.equal(lirePeriode("mensuelle", undefined, undefined), null);
  assert.equal(lirePeriode("mensuelle", "2026", "0"), null);
  assert.equal(lirePeriode("mensuelle", "2026", "13"), null);
  assert.equal(lirePeriode("mensuelle", "2026", "abc"), null);
  assert.equal(lirePeriode("mensuelle", "1999", "3"), null);
  assert.equal(lirePeriode("mensuelle", "40000", "3"), null);
  assert.equal(lirePeriode("mensuelle", "2026", "3.5"), null);
});

// Le numéro 12 est valide au mois et absurde au trimestre : la lecture doit
// donc dépendre de la périodicité, sans quoi un réglage changé laisserait
// passer une adresse qui ne veut plus rien dire.
cas("le douzième existe au mois, pas au trimestre", () => {
  assert.ok(lirePeriode("mensuelle", "2026", "12"));
  assert.equal(lirePeriode("trimestrielle", "2026", "12"), null);
});

cas("une adresse lisible rend la bonne période", () => {
  const p = lirePeriode("trimestrielle", "2025", "4");
  assert.ok(p);
  assert.equal(p.annee, 2025);
  assert.equal(p.numero, 4);
  assert.equal(p.debut, "2025-10-01");
  assert.equal(p.fin, "2025-12-31");
});

// ─── Où tombe un achat ──────────────────────────────────────────────────────
//
// **Le défaut du 13 août 2026, et il n'était pas dans la base.** Le patron
// scanne un ticket du 24 juillet depuis l'écran d'août. L'achat est enregistré
// au bon endroit — dans juillet — et disparaît de sa vue : le total d'août ne
// bouge pas. Rien ne lui disait que c'était rangé ailleurs.

cas("un jour de juillet tombe en juillet, pas dans le mois où on le saisit", () => {
  const p = periodeContenant("mensuelle", "2026-07-24");
  assert.ok(p);
  assert.equal(p.numero, 7);
  assert.equal(libellePeriode(p), "Juillet 2026");
});

cas("le même jour tombe au 3e trimestre quand on compte par trimestre", () => {
  const p = periodeContenant("trimestrielle", "2026-07-24");
  assert.ok(p);
  assert.equal(p.numero, 3);
});

cas("les bornes du mois y sont, des deux côtés", () => {
  assert.equal(periodeContenant("mensuelle", "2026-07-01")!.numero, 7);
  assert.equal(periodeContenant("mensuelle", "2026-07-31")!.numero, 7);
  assert.equal(periodeContenant("mensuelle", "2026-08-01")!.numero, 8);
});

cas("un jour illisible ne tombe nulle part — jamais dans la période courante", () => {
  assert.equal(periodeContenant("mensuelle", "24/07/2026"), null);
  assert.equal(periodeContenant("mensuelle", ""), null);
  assert.equal(periodeContenant("mensuelle", "2026-13-01"), null);
});

cas("appartenir à une période, bornes incluses", () => {
  const aout = periodeTva("mensuelle", 2026, 8);
  assert.equal(dansLaPeriode(aout, "2026-08-01"), true);
  assert.equal(dansLaPeriode(aout, "2026-08-31"), true);
  assert.equal(dansLaPeriode(aout, "2026-07-31"), false, "le ticket du patron était ICI");
  assert.equal(dansLaPeriode(aout, "2026-09-01"), false);
});

console.log(`\n${echecs === 0 ? "✅" : "❌"} Périodes de TVA — ${echecs} échec(s).`);
if (echecs > 0) process.exit(1);
