// « Terminés » — les règles du mois qu'on feuillette, sans base de données.
//
// Trois choses que l'œil ne rattrape pas : dans quel mois tombe un chantier, ce
// que ce mois totalise, et ce qui reste à facturer TOUS MOIS CONFONDUS.
//
// **Refait le 22 août 2026 avec l'écran** (planche 89, proposition B). Les cas
// d'avant qui portaient encore quelque chose ont été gardés — un montant
// inconnu qui n'est pas zéro, une facture à 0,00 € qui se lit, « émise » comme
// seul état qui vaut facturé. Ceux qui décrivaient l'encart replié sont partis
// avec lui : une suite qui réclame ce que le patron a fait retirer rend son
// écran impossible à changer (`CLAUDE.md` §5 bis).

import assert from "node:assert/strict";
import {
  preparer,
  resumeDuMois,
  moisLePlusRecent,
  bornesDuFeuilletage,
  decalerMois,
  nomDuMois,
  aFacturerPartout,
  factureesPartout,
  somme,
  formatEuros,
  libelleCompte,
  libelleFacturee,
  numeroCourt,
  estFacture,
  type LigneTerminee,
} from "../src/lib/termines-par-mois";

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

const ligne = (p: Partial<LigneTerminee> & { id: string }): LigneTerminee => ({
  nom: `Chantier ${p.id}`,
  clientNom: null,
  datePlanifiee: null,
  factureNumero: null,
  factureDateEmission: null,
  factureStatut: null,
  totalTtc: null,
  devisTotalTtc: null,
  ...p,
});

console.log("=== Le mois, et ce qu'il porte ===");

essai("un chantier du 20 août est un chantier d'AOÛT, facturé ou non", () => {
  // Le sortir dans un bloc à part casserait le fil du temps : l'écran ne
  // raconterait plus le mois mais deux listes empilées.
  const mois = resumeDuMois(
    preparer([
      ligne({ id: "a", datePlanifiee: "2026-08-20", devisTotalTtc: "1240.00" }),
      ligne({ id: "b", datePlanifiee: "2026-08-02", factureStatut: "emise", totalTtc: "1320.00" }),
    ]),
    "2026-08"
  );
  assert.equal(mois.lignes.length, 2);
  assert.equal(mois.aFacturer.length, 1);
  assert.equal(mois.facturees.length, 1);
});

essai("dans le mois, le plus récent en tête", () => {
  const lignes = preparer([
    ligne({ id: "vieux", datePlanifiee: "2026-08-02", factureStatut: "emise", totalTtc: "10.00" }),
    ligne({ id: "neuf", datePlanifiee: "2026-08-20", factureStatut: "emise", totalTtc: "20.00" }),
  ]);
  assert.deepEqual(lignes.map((l) => l.id), ["neuf", "vieux"]);
});

essai("deux chantiers du MÊME jour gardent leur ordre d'arrivée", () => {
  // Un comparateur qui répond « plus petit » à dates égales se contredit, et le
  // tri rend un ordre qu'aucune donnée n'explique : les deux factures du
  // 19 août du patron sortaient à l'envers de son écran. Trouvé sur la planche
  // 86, corrigé ici et dans la maquette.
  const lignes = preparer([
    ligne({ id: "premier", datePlanifiee: "2026-08-19", factureStatut: "emise", totalTtc: "240.00" }),
    ligne({ id: "second", datePlanifiee: "2026-08-19", factureStatut: "emise", totalTtc: "48.00" }),
  ]);
  assert.deepEqual(lignes.map((l) => l.id), ["premier", "second"]);
});

essai("le total du mois ne compte QUE ce qui est facturé", () => {
  // Mélanger le prévu et le facturé annoncerait un chiffre qui n'existe nulle
  // part : ni ce qui est rentré, ni ce qui attend. C'est exactement ce que la
  // maquette a fait une première fois — 5 868,00 €.
  const mois = resumeDuMois(
    preparer([
      ligne({ id: "a", datePlanifiee: "2026-08-02", factureStatut: "emise", totalTtc: "1320.00" }),
      ligne({ id: "b", datePlanifiee: "2026-08-20", devisTotalTtc: "1240.00" }),
    ]),
    "2026-08"
  );
  assert.equal(mois.totalFacture, 1320);
  assert.equal(mois.totalPrevu, 1240);
});

essai("le montant affiché vient de la facture, sinon du devis", () => {
  const mois = resumeDuMois(
    preparer([
      ligne({ id: "a", datePlanifiee: "2026-08-02", factureStatut: "emise", totalTtc: "1320.00", devisTotalTtc: "9999.00" }),
      ligne({ id: "b", datePlanifiee: "2026-08-20", devisTotalTtc: "1240.00" }),
    ]),
    "2026-08"
  );
  assert.equal(mois.facturees[0].montant, 1320, "la facture doit primer sur le devis");
  assert.equal(mois.aFacturer[0].montant, 1240);
});

essai("une facture à 0,00 € se lit — elle ne se cache pas", () => {
  // Le patron en a une dans ses données réelles (F2026-0001). Sa réponse du
  // 10 août 2026 : on l'affiche telle quelle, sans commentaire.
  const mois = resumeDuMois(
    preparer([
      ligne({ id: "z", datePlanifiee: "2026-08-05", factureStatut: "emise", totalTtc: "0.00", factureNumero: "F2026-0001" }),
    ]),
    "2026-08"
  );
  assert.equal(mois.facturees.length, 1, "la facture nulle a disparu de l'écran");
  assert.equal(mois.facturees[0].montant, 0);
});

essai("un montant inconnu n'est pas zéro", () => {
  // Sinon on ne distinguerait plus une vraie facture à 0 € d'un devis muet.
  const mois = resumeDuMois(preparer([ligne({ id: "x", datePlanifiee: "2026-08-11" })]), "2026-08");
  assert.equal(mois.aFacturer[0].montant, null);
  assert.equal(mois.totalPrevu, 0, "un montant inconnu ne doit rien ajouter au total");
});

essai("un chantier sans date passe devant, il ne se perd pas au fond", () => {
  const lignes = preparer([
    ligne({ id: "a", datePlanifiee: "2026-08-02", factureStatut: "emise", totalTtc: "10.00" }),
    ligne({ id: "sans", datePlanifiee: null, factureStatut: "emise", totalTtc: "20.00" }),
  ]);
  assert.equal(lignes[0].id, "sans");
  assert.equal(lignes[0].cleMois, "", "un chantier sans date n'appartient à aucun mois");
});

console.log("\n=== Revenir dans le passé — sa demande du 22 août 2026 ===");

essai("l'écran s'ouvre sur le mois le plus récent qui porte quelque chose", () => {
  const lignes = preparer([
    ligne({ id: "j", datePlanifiee: "2026-07-28", factureStatut: "emise", totalTtc: "1860.00" }),
    ligne({ id: "a", datePlanifiee: "2026-08-02", factureStatut: "emise", totalTtc: "1320.00" }),
  ]);
  assert.equal(moisLePlusRecent(lignes), "2026-08");
});

essai("sans rien à montrer, aucun mois — l'écran ne feuillette pas un calendrier vide", () => {
  assert.equal(moisLePlusRecent([]), null);
  assert.equal(moisLePlusRecent(preparer([ligne({ id: "sans" })])), null);
});

essai("on recule sur le CALENDRIER, pas sur les mois qui portent quelque chose", () => {
  // Sauter d'août à mai parce que juin et juillet sont vides laisserait croire
  // que juin n'existe pas. L'écran doit pouvoir répondre « rien en juin ».
  assert.equal(decalerMois("2026-08", 1), "2026-07");
  assert.equal(decalerMois("2026-08", 3), "2026-05");
  assert.equal(decalerMois("2026-01", 1), "2025-12", "le passage d'année doit tenir");
  assert.equal(decalerMois("2025-12", -1), "2026-01", "et dans l'autre sens aussi");
  assert.equal(decalerMois("2026-08", 18), "2025-02");
});

essai("un mois sans rien rend une liste vide, pas une erreur", () => {
  const mois = resumeDuMois(
    preparer([ligne({ id: "a", datePlanifiee: "2026-08-02", factureStatut: "emise", totalTtc: "10.00" })]),
    "2026-07"
  );
  assert.equal(mois.lignes.length, 0);
  assert.equal(mois.totalFacture, 0);
});

essai("CE QUI ATTEND NE SUIT PAS LE MOIS — c'est tout l'objet de sa demande", () => {
  // « Il faut pouvoir revenir dans le passé si jamais on a du retard sur la
  // facturation. » Un chantier de juillet jamais facturé doit rester sous ses
  // yeux quand l'écran montre août — sinon il faudrait déjà savoir qu'il existe
  // pour aller le chercher.
  const lignes = preparer([
    ligne({ id: "aout", datePlanifiee: "2026-08-21", devisTotalTtc: "620.00" }),
    ligne({ id: "retard", datePlanifiee: "2026-07-14", devisTotalTtc: "890.00" }),
    ligne({ id: "faite", datePlanifiee: "2026-08-20", factureStatut: "emise", totalTtc: "1764.00" }),
  ]);
  const partout = aFacturerPartout(lignes);
  assert.deepEqual(partout.map((l) => l.id), ["aout", "retard"]);
  assert.equal(somme(partout), 1510);
  // Et le mois d'août, lui, n'en porte qu'un.
  assert.equal(resumeDuMois(lignes, "2026-08").aFacturer.length, 1);
  assert.equal(factureesPartout(lignes).length, 1);
});

essai("UN CHANTIER CLÔTURÉ EN AVANCE NE VIDE PAS L'ÉCRAN", () => {
  // Payé le 22 août 2026, deux suites rouges d'un coup. Clôturer un chantier
  // avant sa date le range dans « Terminés » en lui laissant sa date À VENIR.
  // L'écran s'ouvrait alors sur le mois prochain — vide — et tout le travail du
  // mois en cours avait disparu, sans rien qui dise pourquoi.
  const lignes = preparer([
    ligne({ id: "ce-mois", datePlanifiee: "2026-08-16", devisTotalTtc: "300.00" }),
    ligne({ id: "en-avance", datePlanifiee: "2026-09-30", factureStatut: "emise", totalTtc: "500.00" }),
  ]);
  const { entree, borne } = bornesDuFeuilletage(lignes, "2026-08");
  assert.equal(entree, "2026-08", "l'écran doit s'ouvrir sur le mois courant, pas sur le futur");
  assert.equal(borne, "2026-09", "mais la flèche doit permettre d'aller voir le chantier en avance");
  assert.equal(resumeDuMois(lignes, entree).lignes.length, 1);
});

essai("sans rien ce mois-ci, on s'ouvre sur le dernier mois qui porte quelque chose", () => {
  // Après deux mois sans chantier, ouvrir sur un mois vide serait exact et
  // inutile : on montre le dernier travail plutôt qu'une page blanche.
  const lignes = preparer([
    ligne({ id: "juin", datePlanifiee: "2026-06-12", factureStatut: "emise", totalTtc: "500.00" }),
  ]);
  assert.deepEqual(bornesDuFeuilletage(lignes, "2026-08"), { entree: "2026-06", borne: "2026-08" });
});

essai("sans rien du tout, on s'ouvre sur le mois courant", () => {
  assert.deepEqual(bornesDuFeuilletage([], "2026-08"), { entree: "2026-08", borne: "2026-08" });
});

essai("« Août 2026 » s'écrit en toutes lettres, capitale en tête", () => {
  assert.equal(nomDuMois("2026-08"), "Août 2026");
  assert.equal(nomDuMois("2025-12"), "Décembre 2025");
});

console.log("\n=== Ce que l'écran ÉCRIT, au lieu de le coder ===");

essai("le compte des factures est ce qu'il vient chercher", () => {
  const mois = resumeDuMois(
    preparer([
      ligne({ id: "a", datePlanifiee: "2026-08-20", factureStatut: "emise", totalTtc: "1764.00" }),
      ligne({ id: "b", datePlanifiee: "2026-08-19", factureStatut: "emise", totalTtc: "240.00" }),
      ligne({ id: "c", datePlanifiee: "2026-08-21", devisTotalTtc: "620.00" }),
    ]),
    "2026-08"
  );
  // L'espace des milliers d'`Intl` est insécable et fine : on compose la
  // phrase attendue avec le MÊME formateur, sinon le contrôle rougit sur un
  // caractère invisible et accuse la règle à la place de lui-même.
  assert.equal(libelleCompte(mois), `2 factures envoyées · et ${formatEuros(620)} qui attendent leur facture.`);
});

essai("au singulier, la phrase reste juste", () => {
  const mois = resumeDuMois(
    preparer([ligne({ id: "a", datePlanifiee: "2026-08-20", factureStatut: "emise", totalTtc: "10.00" })]),
    "2026-08"
  );
  assert.equal(libelleCompte(mois), "1 facture envoyée.");
});

essai("sans facture mais avec de l'attente, le compte le dit quand même", () => {
  const mois = resumeDuMois(
    preparer([ligne({ id: "a", datePlanifiee: "2026-08-20", devisTotalTtc: "700.00" })]),
    "2026-08"
  );
  assert.equal(libelleCompte(mois), `Aucune facture envoyée · et ${formatEuros(700)} qui attendent leur facture.`);
});

essai("un montant inconnu ne s'annonce pas « 0,00 € qui attendent »", () => {
  // Dire zéro là où l'on ne sait pas, c'est annoncer qu'il n'y a rien à
  // encaisser là où il y a peut-être tout.
  const mois = resumeDuMois(
    preparer([
      ligne({ id: "a", datePlanifiee: "2026-08-20", factureStatut: "emise", totalTtc: "10.00" }),
      ligne({ id: "muet", datePlanifiee: "2026-08-18" }),
    ]),
    "2026-08"
  );
  assert.equal(libelleCompte(mois), "1 facture envoyée.");
});

essai("« F2026-0005 » se dit « Facture n° 5 », jamais « n° -5 »", () => {
  // Le tiret entrait dans le nombre sur la planche 89, et l'écran écrivait
  // « Facture n° -5 ». Aucun contrôle ne l'a vu : c'est la capture, regardée.
  assert.equal(numeroCourt("F2026-0005"), "Facture n° 5");
  assert.equal(numeroCourt("F2026-0012"), "Facture n° 12");
  assert.equal(numeroCourt("2026/0007"), "Facture n° 7");
  assert.equal(numeroCourt("SANS-CHIFFRE"), "Facture SANS-CHIFFRE", "un numéro qu'on ne sait pas lire se recopie");
});

essai("« Facturé le 20 août » vient de la DATE D'ÉMISSION, pas du chantier", () => {
  // Le chantier a pu être fait le 20 et facturé le 30 : lire `datePlanifiee`
  // affirmerait une date d'émission qu'on n'a pas.
  const [l] = preparer([
    ligne({
      id: "a",
      datePlanifiee: "2026-08-20",
      factureStatut: "emise",
      totalTtc: "10.00",
      factureNumero: "F2026-0005",
      factureDateEmission: "2026-08-30",
    }),
  ]);
  assert.equal(libelleFacturee(l), "Facturé le 30 août · Facture n° 5");
});

essai("sans date d'émission, on ne l'invente pas", () => {
  const [l] = preparer([
    ligne({ id: "a", datePlanifiee: "2026-08-20", factureStatut: "emise", totalTtc: "10.00", factureNumero: "F2026-0005" }),
  ]);
  assert.equal(libelleFacturee(l), "Facture n° 5");
});

essai("le total tous mois confondus est celui de la phrase d'en-tête", () => {
  const lignes = preparer([
    ligne({ id: "a", datePlanifiee: "2026-08-02", factureStatut: "emise", totalTtc: "1320.00" }),
    ligne({ id: "j", datePlanifiee: "2026-07-28", factureStatut: "emise", totalTtc: "1860.00" }),
    ligne({ id: "x", datePlanifiee: "2026-08-20", devisTotalTtc: "640.00" }),
  ]);
  assert.equal(somme(factureesPartout(lignes)), 3180);
  assert.equal(somme(aFacturerPartout(lignes)), 640);
});

essai("« émise » est le seul état qui vaut facturé", () => {
  // Une facture préparée mais non envoyée n'est pas partie : le chantier
  // attend toujours. Créer n'est pas envoyer.
  assert.equal(estFacture({ factureStatut: "emise" }), true);
  assert.equal(estFacture({ factureStatut: "brouillon" }), false);
  assert.equal(estFacture({ factureStatut: null }), false);
});

console.log(`\n${echecs === 0 ? "✅" : "❌"} « Terminés » — ${echecs} échec(s).`);
process.exit(echecs === 0 ? 0 : 1);
