import assert from "node:assert/strict";
import {
  bornesDePeriode,
  jourEnMots,
  libellePeriode,
  categorieDeLaLigne,
  checkUp,
  clePeriode,
  etatDeLaPeriode,
  resumerPeriodes,
  ressembleAUnVirement,
  type LigneDuDossier,
} from "../src/lib/pour-mon-comptable";
import { CHARTES, contraste } from "../src/lib/chartes";

// POUR MON COMPTABLE, LOT 2 — les règles du dossier, avec les chiffres de la
// planche `appli/pour-mon-comptable.html`.
//
// **Les cas qui comptent le plus sont ceux où le Check up doit SE TAIRE** :
// un ticket relié à la mauvaise ligne, c'est un dossier faux que le comptable
// valide en confiance.

let passed = 0;
let failed = 0;
function test(nom: string, fn: () => void) {
  try {
    fn();
    console.log(`✅ ${nom}`);
    passed++;
  } catch (err) {
    console.error(`❌ ${nom}`);
    console.error(`   ${err instanceof Error ? err.message : err}`);
    failed++;
  }
}

// ─── Le Check up ─────────────────────────────────────────────────────────────

test("un seul ticket tombe juste : Atlas le relie seul", () => {
  const v = checkUp([{ id: "kilou", jour: "2026-10-16", montant: "1194.00" }], [{ id: "t1", dateAchat: "2026-10-15", totalTtc: "1194.00" }]);
  assert.deepEqual(v.get("kilou"), { genre: "relie", ticketId: "t1" });
});

test("le même jour que la banque, il relie aussi", () => {
  const v = checkUp([{ id: "s", jour: "2026-10-12", montant: "318.90" }], [{ id: "t", dateAchat: "2026-10-12", totalTtc: "318.9" }]);
  assert.equal(v.get("s")?.genre, "relie");
});

test("deux tickets du même montant : il demande (Intermarché, 23,80 €)", () => {
  const v = checkUp(
    [{ id: "inter", jour: "2026-10-18", montant: "23.80" }],
    [
      { id: "a", dateAchat: "2026-10-17", totalTtc: "23.80" },
      { id: "b", dateAchat: "2026-10-14", totalTtc: "23.80" },
    ]
  );
  assert.deepEqual(v.get("inter"), { genre: "choix", ticketIds: ["a", "b"] });
});

test("deux pleins identiques la même semaine : aucun n'est relié seul", () => {
  const v = checkUp(
    [
      { id: "s1", jour: "2026-10-14", montant: "62.40" },
      { id: "s2", jour: "2026-10-15", montant: "62.40" },
    ],
    [{ id: "t", dateAchat: "2026-10-13", totalTtc: "62.40" }]
  );
  assert.equal(v.get("s1")?.genre, "choix");
  assert.equal(v.get("s2")?.genre, "choix");
});

test("aucun ticket : il prévient (TotalEnergies, 62,40 €)", () => {
  assert.deepEqual(checkUp([{ id: "total", jour: "2026-10-14", montant: "62.40" }], []).get("total"), { genre: "aucun" });
});

test("un montant approchant ne suffit pas : 62,04 € ne justifie pas 62,40 €", () => {
  const v = checkUp([{ id: "s", jour: "2026-10-14", montant: "62.40" }], [{ id: "t", dateAchat: "2026-10-13", totalTtc: "62.04" }]);
  assert.equal(v.get("s")?.genre, "aucun");
});

test("un ticket daté APRÈS la banque ne la justifie pas", () => {
  const v = checkUp([{ id: "s", jour: "2026-10-14", montant: "62.40" }], [{ id: "t", dateAchat: "2026-10-15", totalTtc: "62.40" }]);
  assert.equal(v.get("s")?.genre, "aucun");
});

test("un ticket de plus de cinq jours avant la banque ne la justifie pas", () => {
  const v = checkUp([{ id: "s", jour: "2026-10-14", montant: "62.40" }], [{ id: "t", dateAchat: "2026-10-08", totalTtc: "62.40" }]);
  assert.equal(v.get("s")?.genre, "aucun");
  const juste = checkUp([{ id: "s", jour: "2026-10-14", montant: "62.40" }], [{ id: "t", dateAchat: "2026-10-09", totalTtc: "62.40" }]);
  assert.equal(juste.get("s")?.genre, "relie");
});

test("un ticket sans total lu ne se relie jamais seul", () => {
  const v = checkUp([{ id: "s", jour: "2026-10-14", montant: "62.40" }], [{ id: "t", dateAchat: "2026-10-13", totalTtc: null }]);
  assert.equal(v.get("s")?.genre, "aucun");
});

test("le passage d'un mois à l'autre se compte en jours, pas en chiffres", () => {
  const v = checkUp([{ id: "s", jour: "2026-11-02", montant: "40.00" }], [{ id: "t", dateAchat: "2026-10-30", totalTtc: "40.00" }]);
  assert.equal(v.get("s")?.genre, "relie");
});

// ─── La couleur ──────────────────────────────────────────────────────────────

test("la couleur vient du ticket, pas du libellé", () => {
  assert.equal(categorieDeLaLigne({ sens: "sortie", libelle: "CB INTERMARCHE", natureDuTicket: "carburant", justification: "ticket" }), "carburant");
});

test("une entrée est un virement reçu", () => {
  assert.equal(categorieDeLaLigne({ sens: "entree", libelle: "VIR LALA", natureDuTicket: null, justification: null }), "recu");
});

test("un virement envoyé se voit comme tel, même sans pièce", () => {
  assert.equal(categorieDeLaLigne({ sens: "sortie", libelle: "VIR SEPA PEPINIERES DURAND", natureDuTicket: null, justification: null }), "virement");
  assert.equal(categorieDeLaLigne({ sens: "sortie", libelle: "PRLV URSSAF", natureDuTicket: null, justification: null }), "virement");
});

test("une carte sans ticket reste « autre » : aucune catégorie ne se devine", () => {
  assert.equal(categorieDeLaLigne({ sens: "sortie", libelle: "CB TOTALENERGIES", natureDuTicket: null, justification: null }), "autre");
  assert.equal(categorieDeLaLigne({ sens: "sortie", libelle: "CB TOTALENERGIES", natureDuTicket: null, justification: "ticket_perdu" }), "autre");
});

test("un libellé qui contient VIR au milieu n'est pas un virement", () => {
  assert.equal(ressembleAUnVirement("CB VIRGIN MEGASTORE"), false);
  assert.equal(ressembleAUnVirement("CB LE VIRAGE"), false);
});

// ─── Les périodes ────────────────────────────────────────────────────────────

const l = (jour: string, montant: string, o: Partial<LigneDuDossier> = {}): LigneDuDossier => ({
  jour,
  montant,
  sens: "sortie",
  categorie: "carburant",
  aJustifier: false,
  ticketPerdu: false,
  ...o,
});

test("les clés de période", () => {
  assert.equal(clePeriode("2026-10-14", "mois"), "2026-10");
  assert.equal(clePeriode("2026-10-14", "trimestre"), "2026-T4");
  assert.equal(clePeriode("2026-03-31", "trimestre"), "2026-T1");
  assert.equal(clePeriode("2026-04-01", "trimestre"), "2026-T2");
  assert.equal(clePeriode("2026-10-14", "annee"), "2026");
});

test("les totaux se font en centimes, sans erreur de virgule", () => {
  const lignes = Array.from({ length: 10 }, (_, i) => l(`2026-10-${String(i + 1).padStart(2, "0")}`, "0.10"));
  const [oct] = resumerPeriodes(lignes, "mois");
  assert.equal(oct.sorties, 100);
});

test("entrées et sorties séparées, sorties par catégorie, manques et tickets perdus comptés", () => {
  const [oct] = resumerPeriodes(
    [
      l("2026-10-14", "62.40", { aJustifier: true }),
      l("2026-10-14", "81.15"),
      l("2026-10-12", "318.90", { categorie: "materiel" }),
      l("2026-10-09", "24.50", { categorie: "repas", ticketPerdu: true }),
      l("2026-10-21", "1200.00", { sens: "entree", categorie: "recu" }),
    ],
    "mois"
  );
  assert.equal(oct.sorties, 48695);
  assert.equal(oct.entrees, 120000);
  assert.equal(oct.parCategorie.carburant, 14355);
  assert.equal(oct.parCategorie.recu, undefined);
  assert.equal(oct.aJustifier, 1);
  assert.equal(oct.ticketsPerdus, 1);
});

test("les périodes vont de la plus récente à la plus ancienne", () => {
  const r = resumerPeriodes([l("2026-07-01", "1"), l("2026-10-01", "1"), l("2026-08-01", "1")], "trimestre");
  assert.deepEqual(r.map((x) => x.cle), ["2026-T4", "2026-T3"]);
});

test("les phrases d'état de la planche", () => {
  assert.equal(etatDeLaPeriode({ aJustifier: 3, ticketsPerdus: 0 }), "3 sans ticket");
  assert.equal(etatDeLaPeriode({ aJustifier: 0, ticketsPerdus: 0 }), "Tout est justifié");
  assert.equal(etatDeLaPeriode({ aJustifier: 0, ticketsPerdus: 1 }), "Tout est justifié, 1 ticket perdu");
  assert.equal(etatDeLaPeriode({ aJustifier: 0, ticketsPerdus: 2 }), "Tout est justifié, 2 tickets perdus");
});

// ─── Les bornes et les noms des périodes ─────────────────────────────────────

test("les bornes d'un mois, d'un trimestre, d'une année", () => {
  assert.deepEqual(bornesDePeriode("2026-10"), { du: "2026-10-01", au: "2026-10-31" });
  assert.deepEqual(bornesDePeriode("2026-02"), { du: "2026-02-01", au: "2026-02-28" });
  assert.deepEqual(bornesDePeriode("2028-02"), { du: "2028-02-01", au: "2028-02-29" });
  assert.deepEqual(bornesDePeriode("2026-T4"), { du: "2026-10-01", au: "2026-12-31" });
  assert.deepEqual(bornesDePeriode("2026-T1"), { du: "2026-01-01", au: "2026-03-31" });
  assert.deepEqual(bornesDePeriode("2026"), { du: "2026-01-01", au: "2026-12-31" });
});

test("une adresse tapée à la main n'ouvre pas un relevé au hasard", () => {
  for (const c of ["2026-13", "2026-00", "2026-T5", "26-10", "octobre", "", "2026-10-01"]) assert.equal(bornesDePeriode(c), null, c);
});

test("les noms des périodes et des jours", () => {
  assert.equal(libellePeriode("2026-10"), "Octobre 2026");
  assert.equal(libellePeriode("2026-T1"), "1ᵉʳ trimestre 2026");
  assert.equal(libellePeriode("2026-T4"), "4ᵉ trimestre 2026");
  assert.equal(libellePeriode("2026"), "2026");
  assert.equal(jourEnMots("2026-10-14"), "14 octobre");
  assert.equal(jourEnMots("2026-01-01"), "1ᵉʳ janvier");
});

// ─── Les couleurs, sur les huit chartes ──────────────────────────────────────

test("chaque couleur du dossier se lit sur le fond et la plage des huit chartes", () => {
  const cles = ["catCarburant", "catRepas", "catMateriel", "catHotel", "catTransport", "catAutre", "catVirement", "catRecu", "montantEntree", "montantSortie"] as const;
  assert.equal(CHARTES.length, 8);
  for (const c of CHARTES) {
    for (const cle of cles) {
      const v = c.jetons[cle];
      assert.match(v, /^#[0-9a-f]{6}$/i, `${c.nom} : ${cle} n'est pas une couleur (${v})`);
      assert.ok(contraste(v, c.jetons.cream) >= 4.5, `${c.nom} : ${cle} ne se lit pas sur le fond`);
      assert.ok(contraste(v, c.jetons.card) >= 4.5, `${c.nom} : ${cle} ne se lit pas sur la plage`);
    }
  }
});

test("les catégories restent distinctes l'une de l'autre en Nuit", () => {
  const nuit = CHARTES.find((c) => c.nom === "nuit")!;
  const cles = ["catCarburant", "catRepas", "catMateriel", "catHotel", "catTransport", "catVirement"] as const;
  assert.equal(new Set(cles.map((k) => nuit.jetons[k])).size, cles.length);
});

console.log(`\n${passed} réussi(s), ${failed} échoué(s)`);
if (failed > 0) process.exit(1);
