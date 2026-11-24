import assert from "node:assert/strict";
import { etatAffiche, moisAbrege, type ModuleCode } from "../src/lib/abonnements";
import {
  changementAVenir,
  changementDeFormule,
  lesComptesQuiPartent,
  plusUnePeriode,
  prochaineEcheance,
  ttcEnCentimes,
  joursPerdus,
} from "../src/lib/changement-de-formule";

// CHANGER DE FORMULE : ce qui est débité, et quand. La règle pure, éprouvée
// sans base ni prestataire, sur ses décisions du 23 novembre 2026 (`TODO.md`,
// « CHANGER DE FORMULE ») et sur les chiffres de sa planche
// (`appli/soignee/changer-de-formule.html`).

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

const LE_23_NOV = new Date(Date.UTC(2026, 10, 23, 17, 0, 0));
const LE_23_DEC = new Date(Date.UTC(2026, 11, 23, 12, 0, 0));
const ARTISAN_MOIS = { formule: "artisan", periodicite: "mensuelle", modules: [] as readonly ModuleCode[] } as const;
const ENTREPRISE_MOIS = { formule: "entreprise", periodicite: "mensuelle", modules: [] as readonly ModuleCode[] } as const;
const ILLIMITE_MOIS = { formule: "illimite", periodicite: "mensuelle", modules: [] as readonly ModuleCode[] } as const;
const ARTISAN_AN = { formule: "artisan", periodicite: "annuelle", modules: [] as readonly ModuleCode[] } as const;
const ENTREPRISE_AN = { formule: "entreprise", periodicite: "annuelle", modules: [] as readonly ModuleCode[] } as const;
const ILLIMITE_AN = { formule: "illimite", periodicite: "annuelle", modules: [] as readonly ModuleCode[] } as const;

console.log("=== Monter au mois : le prix entier, l'échéance remise ===\n");

cas("d'Artisan à Entreprise : 59 € HT aujourd'hui, 70,80 € TTC (sa planche)", () => {
  const c = changementDeFormule(ARTISAN_MOIS, ENTREPRISE_MOIS);
  assert.deepEqual(c, { genre: "tout-de-suite", facon: "monter-au-mois", debitHT: 59, echeanceRemise: true });
  assert.equal(ttcEnCentimes(59), 7080);
});

cas("d'Artisan à Illimité : 159 € HT, 190,80 € TTC", () => {
  const c = changementDeFormule(ARTISAN_MOIS, ILLIMITE_MOIS);
  assert.equal(c.genre === "tout-de-suite" && c.debitHT, 159);
  assert.equal(ttcEnCentimes(159), 19080);
});

cas("changé le 23 novembre, le prochain paiement est le 23 décembre, et non le 23 janvier de son exemple", () => {
  const c = changementDeFormule(ARTISAN_MOIS, ENTREPRISE_MOIS);
  const p = prochaineEcheance(c, ENTREPRISE_MOIS, LE_23_DEC, LE_23_NOV);
  assert.equal(p?.toISOString().slice(0, 10), "2026-12-23");
});

console.log("\n=== Monter à l'année : la différence ENTIÈRE, jamais au prorata ===\n");

cas("d'Artisan à Entreprise : 200 € HT (590 − 390), l'échéance ne bouge pas", () => {
  const c = changementDeFormule(ARTISAN_AN, ENTREPRISE_AN);
  assert.deepEqual(c, { genre: "tout-de-suite", facon: "monter-a-l-annee", debitHT: 200, echeanceRemise: false });
  assert.equal(prochaineEcheance(c, ENTREPRISE_AN, LE_23_DEC, LE_23_NOV), LE_23_DEC);
});

cas("d'Artisan à Illimité 1 200 €, d'Entreprise à Illimité 1 000 €", () => {
  const a = changementDeFormule(ARTISAN_AN, ILLIMITE_AN);
  const e = changementDeFormule(ENTREPRISE_AN, ILLIMITE_AN);
  assert.equal(a.genre === "tout-de-suite" && a.debitHT, 1200);
  assert.equal(e.genre === "tout-de-suite" && e.debitHT, 1000);
});

console.log("\n=== Du mois à l'année : l'année entière, l'échéance remise ===\n");

cas("Artisan au mois vers Artisan à l'année : 390 € HT, prochain paiement dans un an", () => {
  const c = changementDeFormule(ARTISAN_MOIS, ARTISAN_AN);
  assert.deepEqual(c, { genre: "tout-de-suite", facon: "passer-a-l-annee", debitHT: 390, echeanceRemise: true });
  assert.equal(prochaineEcheance(c, ARTISAN_AN, LE_23_DEC, LE_23_NOV)?.toISOString().slice(0, 10), "2027-11-23");
});

cas("Artisan au mois vers Illimité à l'année : l'année d'Illimité, 1 590 €", () => {
  const c = changementDeFormule(ARTISAN_MOIS, ILLIMITE_AN);
  assert.equal(c.genre === "tout-de-suite" && c.facon, "passer-a-l-annee");
  assert.equal(c.genre === "tout-de-suite" && c.debitHT, 1590);
});

cas("vers une formule MOINS chère à l'année : c'est une descente, elle attend l'échéance", () => {
  assert.deepEqual(changementDeFormule(ENTREPRISE_MOIS, ARTISAN_AN), { genre: "a-l-echeance" });
});

console.log("\n=== Descendre, ou de l'année au mois : rien aujourd'hui, à l'échéance ===\n");

cas("d'Entreprise à Artisan au mois", () => {
  const c = changementDeFormule(ENTREPRISE_MOIS, ARTISAN_MOIS);
  assert.deepEqual(c, { genre: "a-l-echeance" });
  assert.equal(prochaineEcheance(c, ARTISAN_MOIS, LE_23_DEC, LE_23_NOV), LE_23_DEC);
});

cas("d'Illimité à Entreprise à l'année", () => {
  assert.deepEqual(changementDeFormule(ILLIMITE_AN, ENTREPRISE_AN), { genre: "a-l-echeance" });
});

cas("de l'année au mois, même vers une formule plus chère : il a payé l'année", () => {
  assert.deepEqual(changementDeFormule(ARTISAN_AN, ILLIMITE_MOIS), { genre: "a-l-echeance" });
  assert.deepEqual(changementDeFormule(ENTREPRISE_AN, ENTREPRISE_MOIS), { genre: "a-l-echeance" });
});

cas("la même formule au même rythme : rien à faire", () => {
  assert.deepEqual(changementDeFormule(ENTREPRISE_MOIS, ENTREPRISE_MOIS), { genre: "aucun" });
});

cas("une échéance inconnue ne se devine pas", () => {
  assert.equal(prochaineEcheance(changementDeFormule(ENTREPRISE_MOIS, ARTISAN_MOIS), ARTISAN_MOIS, null, LE_23_NOV), null);
});

console.log("\n=== Les outils de paysage : ajouter monte, retirer attend l'échéance ===\n");

const OUTILS = ["paysage"] as readonly ModuleCode[];

cas("AJOUTER LES OUTILS au mois : Artisan avec les outils, 45 € entiers, l'échéance remise", () => {
  assert.deepEqual(changementDeFormule(ARTISAN_MOIS, { ...ARTISAN_MOIS, modules: OUTILS }), {
    genre: "tout-de-suite",
    facon: "monter-au-mois",
    debitHT: 45,
    echeanceRemise: true,
  });
});

cas("AJOUTER LES OUTILS à l'année : la différence, 60 €", () => {
  const c = changementDeFormule(ARTISAN_AN, { ...ARTISAN_AN, modules: OUTILS });
  assert.equal(c.genre === "tout-de-suite" && c.debitHT, 60);
});

cas("RETIRER LES OUTILS : à l'échéance, il les garde jusque-là", () => {
  assert.deepEqual(changementDeFormule({ ...ENTREPRISE_MOIS, modules: OUTILS }, ENTREPRISE_MOIS), { genre: "a-l-echeance" });
});

cas("Artisan avec les outils vers Entreprise sans eux : plus cher, donc tout de suite, 59 €", () => {
  const c = changementDeFormule({ ...ARTISAN_MOIS, modules: OUTILS }, ENTREPRISE_MOIS);
  assert.equal(c.genre === "tout-de-suite" && c.debitHT, 59);
});

cas("monter en gardant les outils : Entreprise avec les outils, 65 €", () => {
  const c = changementDeFormule({ ...ARTISAN_MOIS, modules: OUTILS }, { ...ENTREPRISE_MOIS, modules: OUTILS });
  assert.equal(c.genre === "tout-de-suite" && c.debitHT, 65);
});

cas("les outils prévus au retrait se lisent dans le changement à venir", () => {
  assert.deepEqual(
    changementAVenir({ ...ENTREPRISE_MOIS, modules: OUTILS, formulePrevue: "entreprise", periodicitePrevue: "mensuelle", modulesPrevus: [] }),
    ENTREPRISE_MOIS
  );
});

console.log("\n=== Un mois et un an se comptent comme un abonnement ===\n");

cas("le 31 janvier plus un mois tombe le 28 février, jamais le 3 mars", () => {
  assert.equal(plusUnePeriode(new Date(Date.UTC(2027, 0, 31)), "mensuelle").toISOString().slice(0, 10), "2027-02-28");
  assert.equal(plusUnePeriode(new Date(Date.UTC(2028, 0, 31)), "mensuelle").toISOString().slice(0, 10), "2028-02-29");
});

cas("le 29 février plus un an tombe le 28 février", () => {
  assert.equal(plusUnePeriode(new Date(Date.UTC(2028, 1, 29)), "annuelle").toISOString().slice(0, 10), "2029-02-28");
});

cas("le 15 décembre plus un mois passe l'année", () => {
  assert.equal(plusUnePeriode(new Date(Date.UTC(2026, 11, 15)), "mensuelle").toISOString().slice(0, 10), "2027-01-15");
});

console.log("\n=== Les comptes qui partent avec la descente ===\n");

const J = (jour: number) => new Date(Date.UTC(2026, 0, jour));
const EQUIPE = [
  { id: "patron", role: "proprietaire", depuis: J(1) },
  { id: "compta", role: "facturation", depuis: J(2) },
  { id: "commercial", role: "commercial", depuis: J(5) },
  { id: "salarie", role: "salarie", depuis: J(3) },
] as const;

cas("vers Artisan : TOUS les autres partent, salarié compris (un seul accès, sa règle du 18 novembre)", () => {
  assert.deepEqual(lesComptesQuiPartent(EQUIPE, "artisan"), ["compta", "salarie", "commercial"]);
});

cas("vers Entreprise, le salarié au planning ne compte pas : il n'occupe aucune place de facturation", () => {
  assert.deepEqual(lesComptesQuiPartent(EQUIPE, "entreprise"), []);
});

cas("vers Entreprise avec sept qui facturent : les deux derniers arrivés partent", () => {
  const sept = [
    { id: "p", role: "proprietaire" as const, depuis: J(1) },
    ...[2, 3, 4, 5, 6, 7].map((j) => ({ id: `f${j}`, role: "facturation" as const, depuis: J(j) })),
  ];
  assert.deepEqual(lesComptesQuiPartent(sept, "entreprise"), ["f6", "f7"]);
});

cas("vers Illimité : personne ne part", () => {
  assert.deepEqual(lesComptesQuiPartent(EQUIPE, "illimite"), []);
});

cas("deux patrons sur Artisan : aucun patron ne part, les autres oui", () => {
  const deux = [...EQUIPE, { id: "patron2", role: "proprietaire" as const, depuis: J(9) }];
  assert.deepEqual(lesComptesQuiPartent(deux, "artisan"), ["compta", "salarie", "commercial"]);
});

console.log("\n=== La descente prévue se lit sur l'écran, puis s'efface ===\n");

cas("rien de prévu : rien à venir", () => {
  assert.equal(changementAVenir({ ...ENTREPRISE_MOIS, formulePrevue: null, periodicitePrevue: null, modulesPrevus: null }), null);
});

cas("Artisan prévu sur Entreprise : à venir", () => {
  assert.deepEqual(
    changementAVenir({ ...ENTREPRISE_MOIS, formulePrevue: "artisan", periodicitePrevue: "mensuelle", modulesPrevus: [] }),
    ARTISAN_MOIS
  );
});

cas("l'échéance passée, la formule EST la prévue : plus rien à venir", () => {
  assert.equal(changementAVenir({ ...ARTISAN_MOIS, formulePrevue: "artisan", periodicitePrevue: "mensuelle", modulesPrevus: [] }), null);
});

cas("l'état dit « Jusqu'au 23 décembre 2026, puis Artisan à 39 € HT par mois. », dans le carré doré", () => {
  const e = etatAffiche(
    { ...ENTREPRISE_MOIS, statut: "actif", periodeFin: LE_23_DEC, annulationDemandee: false, prevu: ARTISAN_MOIS },
    LE_23_NOV
  );
  assert.equal(e.titre, "Entreprise");
  assert.equal(e.detail, "Jusqu’au 23 décembre 2026, puis Artisan à 39 € HT par mois.");
  assert.equal(e.ton, "calme");
  assert.deepEqual(e.signe, { genre: "echeance", jour: 23, mois: "déc." });
  assert.equal(moisAbrege(LE_23_DEC), "déc.");
});

cas("sans rien de prévu, l'état ne change pas", () => {
  const e = etatAffiche({ ...ENTREPRISE_MOIS, statut: "actif", periodeFin: LE_23_DEC, annulationDemandee: false }, LE_23_NOV);
  assert.equal(e.detail, "59 € HT par mois. Prochain paiement le 23 décembre 2026.");
});

cas("les jours perdus : 19 du 15 décembre au 3 janvier, rien quand l'échéance ne bouge pas (sa demande du 24 novembre)", () => {
  const le15 = new Date("2026-12-15T09:00:00Z");
  const le3 = new Date("2027-01-03T12:00:00Z");
  const versLAnnee = changementDeFormule({ formule: "artisan", periodicite: "mensuelle", modules: [] }, { formule: "artisan", periodicite: "annuelle", modules: [] });
  assert.equal(joursPerdus(versLAnnee, le3, le15), 19);
  const auMois = changementDeFormule({ formule: "artisan", periodicite: "mensuelle", modules: [] }, { formule: "entreprise", periodicite: "mensuelle", modules: [] });
  assert.equal(joursPerdus(auMois, le3, le15), 19);
  // Monter à l'année garde l'échéance : rien ne se perd.
  const aLAnnee = changementDeFormule({ formule: "artisan", periodicite: "annuelle", modules: [] }, { formule: "entreprise", periodicite: "annuelle", modules: [] });
  assert.equal(joursPerdus(aLAnnee, le3, le15), null);
  // Descendre attend l'échéance : rien ne se perd.
  const descente = changementDeFormule({ formule: "entreprise", periodicite: "mensuelle", modules: [] }, { formule: "artisan", periodicite: "mensuelle", modules: [] });
  assert.equal(joursPerdus(descente, le3, le15), null);
  // Échéance inconnue : le nombre ne se devine pas. Échéance passée : zéro, jamais négatif.
  assert.equal(joursPerdus(versLAnnee, null, le15), null);
  assert.equal(joursPerdus(versLAnnee, new Date("2026-12-10T12:00:00Z"), le15), 0);
});

if (echecs > 0) {
  console.error(`\n❌ ${echecs} cas en échec.`);
  process.exit(1);
}
console.log("\n✅ Changer de formule : chaque cas débite ce que sa règle dit, et quand elle le dit.");
