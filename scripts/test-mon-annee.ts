/* =======================================================================
   Mon année : la saison, le trait, l'an dernier au même jour, le bénéfice.

   Sa planche du 8 novembre 2026 (`appli/soignee/mon-annee.html`). Les
   règles pures (`src/lib/mon-annee.ts`) s'éprouvent ici, sans base, en
   centimes, aux bornes où un arrondi ou un mois mal coupé mentirait.
   ======================================================================= */
import assert from "node:assert/strict";
import {
  aUnAnDernier,
  beneficeEstime,
  etatDeLAnnee,
  etatDeLObjectif,
  faceAnDernier,
  htDeLaPieceImportee,
  joursOuvres,
  lireEurosSaisis,
  manqueEncore,
  memeJourAnDernier,
  objectifValide,
  partDeLAnneeFaite,
  resteMoisParMois,
  resteSurMilleEuros,
  saisonDe,
  sensDeLEcart,
  tonDeLAnnee,
  totalParMois,
  type Piece,
} from "../src/lib/mon-annee";

let echecs = 0;
function essai(nom: string, fn: () => void) {
  try {
    fn();
    console.log(`  ✓ ${nom}`);
  } catch (e) {
    echecs++;
    console.log(`  ✗ ${nom}\n    ${(e as Error).message}`);
  }
}

const euros = (n: number) => n * 100;

console.log("Le calendrier");

essai("le 29 février se compare au 28 février de l'an d'avant, pas au 1er mars", () => {
  assert.equal(memeJourAnDernier("2028-02-29"), "2027-02-28");
  assert.equal(memeJourAnDernier("2026-11-08"), "2025-11-08");
});

essai("novembre 2026 compte 20 jours ouvrés : le 11 novembre est retiré", () => {
  assert.equal(joursOuvres("2026-11-01", "2026-11-30"), 20);
});

essai("2026 compte 252 jours ouvrés : neuf fériés tombent en semaine", () => {
  assert.equal(joursOuvres("2026-01-01", "2026-12-31"), 252);
});

essai("en Alsace-Moselle, le 26 décembre 2025 (un vendredi) n'est pas ouvré", () => {
  assert.equal(joursOuvres("2025-12-26", "2025-12-26"), 1);
  assert.equal(joursOuvres("2025-12-26", "2025-12-26", true), 0);
});

console.log("Face à l'an dernier");

// Le 8 novembre 2026, et la même date en 2025.
const pieces: Piece[] = [
  { jour: "2025-11-03", centimes: euros(4340) },
  { jour: "2025-11-08", centimes: euros(960) },
  { jour: "2025-11-20", centimes: euros(15000) }, // après le 8 : hors du « du 1er au 8 »
  { jour: "2026-11-02", centimes: euros(3260) },
  { jour: "2026-11-08", centimes: euros(1840) },
  { jour: "2026-10-15", centimes: euros(22300) },
  { jour: "2025-10-15", centimes: euros(25400) },
  { jour: "2026-10-20", centimes: -euros(300) }, // un avoir retire du chiffre
];

essai("le jour même : 1 840 € face aux 960 € du 8 novembre 2025", () => {
  const f = faceAnDernier(pieces, "2026-11-08");
  assert.deepEqual(f.leJour, { cetteAnnee: euros(1840), anDernier: euros(960) });
  assert.equal(sensDeLEcart(f.leJour), "plus");
});

essai("du 1er au 8 : la facture du 20 novembre 2025 n'entre pas dans la comparaison", () => {
  const f = faceAnDernier(pieces, "2026-11-08");
  assert.deepEqual(f.duPremier, { cetteAnnee: euros(5100), anDernier: euros(5300) });
  assert.equal(sensDeLEcart(f.duPremier!), "moins");
});

essai("le 1er du mois, le jour même suffit", () => {
  assert.equal(faceAnDernier(pieces, "2026-11-01").duPremier, null);
});

essai("tous les mois : le plus récent en haut, le mois en cours au même jour, un avoir déduit", () => {
  const f = faceAnDernier(pieces, "2026-11-08");
  assert.equal(f.mois.length, 11);
  assert.deepEqual(f.mois[0], { mois: 10, jusquAu: 8, cetteAnnee: euros(5100), anDernier: euros(5300) });
  assert.deepEqual(f.mois[1], { mois: 9, jusquAu: null, cetteAnnee: euros(22000), anDernier: euros(25400) });
});

essai("le dernier jour du mois, le mois se compare en entier", () => {
  const f = faceAnDernier(pieces, "2026-11-30");
  assert.equal(f.mois[0].jusquAu, null);
  assert.equal(f.mois[0].anDernier, euros(20300));
});

essai("« pareil » seulement au centime près : 80 € de plus n'est pas pareil", () => {
  assert.equal(sensDeLEcart({ cetteAnnee: 8000, anDernier: 0 }), "plus");
  assert.equal(sensDeLEcart({ cetteAnnee: 0, anDernier: 0 }), "pareil");
});

essai("une facture importée compte par son HT ; assujetti sans HT lu, elle ne compte pas", () => {
  assert.equal(htDeLaPieceImportee("900.00", "1080.00", "assujettie"), "900.00");
  assert.equal(htDeLaPieceImportee(null, "1080.00", "assujettie"), null);
  assert.equal(htDeLaPieceImportee(null, "500.00", "franchise"), "500.00");
});

console.log("La saison et le trait");

const mois2025 = [10200, 12700, 22800, 28000, 30500, 27900, 22900, 15200, 25400, 25400, 20300, 12700].map(euros);

essai("sans rien de facturé l'an dernier, pas de saison : rien ne se devine", () => {
  assert.equal(saisonDe(Array.from({ length: 12 }, () => 0)), null);
  assert.equal(saisonDe([-1, ...Array.from({ length: 11 }, () => 100)]), null);
});

essai("au 30 juin, la saison 2025 avait fait 52 % de l'année", () => {
  const saison = saisonDe(mois2025)!;
  assert.equal(Math.round(partDeLAnneeFaite("2026-06-30", saison) * 1000), 520);
});

essai("à la moitié le 30 juin, il est en RETARD sur sa saison : 150 000 € pour 156 000 € attendus", () => {
  const e = etatDeLObjectif(euros(300000), euros(150000), "2026-06-30", saisonDe(mois2025));
  assert.equal(e.passe, false);
  assert.equal(e.reste, euros(150000));
  assert.ok(e.ecart! < 0 && e.ecart! > -euros(7000), `écart ${e.ecart}`);
});

essai("sans saison, ni trait ni écart", () => {
  const e = etatDeLObjectif(euros(300000), euros(150000), "2026-06-30", null);
  assert.equal(e.trait, null);
  assert.equal(e.ecart, null);
});

essai("le ton : ambre en retard, vert en avance, passé, ou sans saison", () => {
  assert.equal(tonDeLAnnee(etatDeLObjectif(euros(300000), euros(150000), "2026-06-30", saisonDe(mois2025))), "ambre");
  assert.equal(tonDeLAnnee(etatDeLObjectif(euros(300000), euros(170000), "2026-06-30", saisonDe(mois2025))), "vert");
  assert.equal(tonDeLAnnee(etatDeLObjectif(euros(300000), euros(150000), "2026-06-30", null)), "vert");
});

essai("objectif passé : plus rien à facturer", () => {
  const e = etatDeLObjectif(euros(300000), euros(312400), "2026-12-18", saisonDe(mois2025));
  assert.equal(e.passe, true);
  assert.equal(e.reste, 0);
  assert.deepEqual(resteMoisParMois(e.reste, "2026-12-18", saisonDe(mois2025)), []);
});

essai("l'écran et Terminés lisent la même année : facturé depuis janvier, saison de l'an dernier", () => {
  const e = etatDeLAnnee(euros(300000), pieces, "2026-11-08");
  assert.equal(e.fait, euros(5100) + euros(22000));
  assert.ok(e.trait !== null, "les pièces de 2025 donnent une saison");
  assert.equal(aUnAnDernier(pieces, 2026), true);
  assert.equal(aUnAnDernier(pieces, 2025), false);
  assert.equal(etatDeLAnnee(euros(300000), pieces.filter((p) => p.jour >= "2026"), "2026-11-08").trait, null);
});

console.log("Ce qu'il reste à facturer");

essai("le reste se répartit au centime près, et suit la saison", () => {
  const reste = euros(85400);
  const r = resteMoisParMois(reste, "2026-11-08", saisonDe(mois2025));
  assert.deepEqual(
    r.map((x) => x.mois),
    [10, 11]
  );
  assert.equal(r[0].enCours, true);
  assert.equal(r[0].joursOuvres, 15);
  assert.equal(
    r.reduce((t, x) => t + x.centimes, 0),
    reste
  );
  // Novembre pèse plus que décembre dans la saison 2025, même aux trois quarts.
  assert.ok(r[0].centimes > r[1].centimes);
});

essai("sans saison, le reste suit les jours ouvrés", () => {
  const r = resteMoisParMois(euros(37000), "2026-11-08", null);
  assert.equal(r[0].joursOuvres, 15);
  assert.equal(r[1].joursOuvres, 22);
  assert.equal(r[0].centimes, euros(15000));
  assert.equal(r[1].centimes, euros(22000));
});

essai("le 31 décembre au soir, plus aucun jour : rien à répartir", () => {
  assert.deepEqual(resteMoisParMois(euros(1000), "2026-12-31", null), []);
});

essai("ce qu'il manque : le reste moins ce qui est à facturer et signé, jamais négatif", () => {
  assert.equal(manqueEncore(euros(85400), euros(7800), euros(18600)), euros(59000));
  assert.equal(manqueEncore(euros(10000), euros(7800), euros(18600)), 0);
});

console.log("Le bénéfice estimé");

essai("encaissé moins dépenses : ni prêt, ni perso, ni virement entre comptes", () => {
  const b = beneficeEstime(
    [
      { jour: "2026-03-12", centimes: euros(201900), sens: "entree", motif: null, justification: "facture" },
      { jour: "2026-04-01", centimes: euros(5000), sens: "entree", motif: "pret", justification: "motif" },
      { jour: "2026-04-02", centimes: euros(2000), sens: "entree", motif: "entre_comptes", justification: "motif" },
      { jour: "2026-05-01", centimes: euros(71400), sens: "sortie", motif: null, justification: "ticket" },
      { jour: "2026-05-02", centimes: euros(62300), sens: "sortie", motif: "salaire", justification: "motif" },
      { jour: "2026-05-03", centimes: euros(8800), sens: "sortie", motif: "loyer", justification: "motif" },
      { jour: "2026-05-04", centimes: euros(30100), sens: "sortie", motif: "impots", justification: "motif" },
      { jour: "2026-05-05", centimes: euros(900), sens: "sortie", motif: "perso", justification: "motif" },
      { jour: "2026-05-06", centimes: euros(1200), sens: "sortie", motif: "pret", justification: "motif" },
      { jour: "2025-12-31", centimes: euros(99999), sens: "sortie", motif: null, justification: null }, // l'an dernier
    ],
    2026
  )!;
  assert.equal(b.depuis, "2026-03-12");
  assert.equal(b.encaisse, euros(201900));
  assert.equal(b.fournisseurs, euros(71400));
  assert.equal(b.benefice, euros(29300));
  assert.equal(resteSurMilleEuros(b.benefice, b.encaisse), 145);
});

essai("une sortie sans pièce compte : elle est partie", () => {
  const b = beneficeEstime(
    [
      { jour: "2026-01-05", centimes: euros(1000), sens: "entree", motif: null, justification: null },
      { jour: "2026-01-06", centimes: euros(300), sens: "sortie", motif: null, justification: null },
    ],
    2026
  )!;
  assert.equal(b.aJustifier, euros(300));
  assert.equal(b.benefice, euros(700));
});

essai("sans une ligne de banque dans l'année, pas de bénéfice", () => {
  assert.equal(beneficeEstime([], 2026), null);
  assert.equal(resteSurMilleEuros(0, 0), null);
});

console.log("L'objectif saisi");

essai("« 300 000 », « 300000 » et « 300 000,50 € » se lisent", () => {
  assert.equal(lireEurosSaisis("300 000"), euros(300000));
  assert.equal(lireEurosSaisis("300000"), euros(300000));
  assert.equal(lireEurosSaisis("300 000,50 €"), euros(300000) + 50);
  assert.equal(lireEurosSaisis(""), null);
  assert.ok(Number.isNaN(lireEurosSaisis("trois cents")));
});

essai("un objectif sans chiffre d'affaires, ou nul, se refuse", () => {
  assert.equal(objectifValide("", "").ok, false);
  assert.equal(objectifValide("0", "").ok, false);
  assert.equal(objectifValide("abc", "").ok, false);
});

essai("le bénéfice est facultatif, et ne dépasse pas le chiffre d'affaires", () => {
  assert.deepEqual(objectifValide("300 000", ""), { ok: true, chiffreAffaires: euros(300000), benefice: null });
  assert.deepEqual(objectifValide("300 000", "50 000"), { ok: true, chiffreAffaires: euros(300000), benefice: euros(50000) });
  assert.equal(objectifValide("300 000", "400 000").ok, false);
});

essai("les douze mois d'une année ignorent les autres années", () => {
  const m = totalParMois(pieces, 2025);
  assert.equal(m[10], euros(20300));
  assert.equal(m[9], euros(25400));
  assert.equal(
    m.reduce((t, x) => t + x, 0),
    euros(45700)
  );
});

if (echecs > 0) {
  console.log(`\n${echecs} échec(s).`);
  process.exit(1);
}
console.log("\nMon année : tout est juste.");
