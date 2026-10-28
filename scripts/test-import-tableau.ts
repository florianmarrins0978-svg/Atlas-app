import assert from "node:assert/strict";
import {
  CHAMPS_DU_TABLEAU,
  cleDeLaPiece,
  entetePuisLignes,
  formatDuTableau,
  reglagesDesDecisions,
  grouperParClient,
  jourDuTableau,
  lireCsv,
  lireLignes,
  montantDuTableau,
  genreDuTableau,
  normaliserAdresse,
  ordreDesDates,
  planDeRangement,
  reconnaitreColonnes,
  type ClientConnu,
  type LigneLue,
} from "../src/lib/import-tableau";

// **IMPORTER UN TABLEAU DE DEVIS ET FACTURES** — ses demandes du 28 octobre
// 2026, planche `appli/soignee/clients-importer.html` : un export de son
// ancienne appli, une ligne par pièce ; Atlas crée les fiches et range chaque
// pièce sur la sienne. Sa règle : **« il faut zéro erreur ! Faut pas se tromper
// sur une adresse »**.
//
// Les lignes sont celles de la planche : Mme Lenoir écrit son adresse de deux
// façons (c'est la même), SCI Les Hêtres en a deux vraies, M. Bernard est déjà
// client à une autre adresse, et une facture n'a pas de nom.

let echecs = 0;
function cas(nom: string, fn: () => void) {
  try {
    fn();
    console.log(`  ✓ ${nom}`);
  } catch (e) {
    echecs++;
    console.log(`  ✗ ${nom}\n    ${(e as Error).message}`);
  }
}

const ENTETES = ["Type", "N°", "Objet", "Date", "Client", "Adresse", "CP", "Ville", "Tél.", "Total TTC"];
const TABLEAU = [
  ENTETES,
  ["Devis", "D2025-0201", "Aménagement jardin", "03/04/2025", "Mme Lenoir", "14 rue Paul Bert", "44100", "Nantes", "06 12 48 30 77", "1 250,00"],
  ["Facture", "F2025-0163", "Aménagement jardin", "28/04/2025", "Mme Lenoir", "14, rue Paul-Bert", "44100", "NANTES", "06 12 48 30 77", "1 250,00"],
  ["Devis", "D2025-0187", "Élagage", "17/02/2025", "M. Guérin", "2 chemin des Vignes", "44120", "Vertou", "06 70 21 55 12", "2 640,00"],
  ["Facture", "F2025-0201", "Élagage", "14/03/2025", "M. Guérin", "2 chemin des Vignes", "44120", "Vertou", "06 70 21 55 12", "2 640,00"],
  ["Facture", "F2025-0122", "Taille de haie", "06/01/2025", "M. Bernard", "12 rue des Lilas", "44000", "Nantes", "06 33 18 90 41", "195,00"],
  ["Devis", "D2025-0244", "Entretien des espaces verts", "20/05/2025", "SCI Les Hêtres", "40 bd Victor Hugo", "44200", "Nantes", "02 40 11 22 33", "4 180,00"],
  ["Facture", "F2025-0230", "Entretien des espaces verts", "02/06/2025", "SCI Les Hêtres", "40 boulevard Victor-Hugo", "44200", "Nantes", "02 40 11 22 33", "4 180,00"],
  ["Facture", "F2025-0277", "Création de massifs", "03/09/2025", "SCI Les Hêtres", "12 rue de la Paix", "44000", "Nantes", "02 40 11 22 33", "960,00"],
  ["Devis", "D2025-0310", "Création d'une pelouse", "08/10/2025", "Mme Le Goff", "7 impasse du Lavoir", "44400", "Rezé", "", "780,00"],
  ["Facture", "F2024-0097", "Débroussaillage", "09/10/2024", "", "9 rue de la Gare", "44230", "Saint-Sébastien-sur-Loire", "06 81 44 02 19", "310,00"],
  // Le même numéro deux fois : il ne se range qu'une fois.
  ["Facture", "F2025-0122", "Taille de haie", "06/01/2025", "M. Bernard", "12 rue des Lilas", "44000", "Nantes", "06 33 18 90 41", "195,00"],
];

const BERNARD: ClientConnu = {
  id: "c-bernard",
  nom: "M. Bernard",
  telephone: "06 33 18 90 41",
  email: null,
  adresse: "21 quai de la Fosse, 44000 Nantes",
  creeLe: "2026-01-01",
};
const LE_GOFF_SANS_ADRESSE: ClientConnu = {
  id: "c-legoff",
  nom: "Mme Le Goff",
  telephone: null,
  email: null,
  adresse: null,
  creeLe: "2026-02-01",
};

function lire(grille = TABLEAU) {
  const r = reconnaitreColonnes(grille[0], grille.slice(1));
  return lireLignes(grille, { colonnes: r.colonnes, ordreDate: r.ordreDate === "doute" ? null : r.ordreDate });
}
const nomsDe = (l: LigneLue[]) => l.map((x) => x.numero).join(",");

console.log("=== Importer un tableau de devis et factures ===\n");

// ── Lire un CSV ──────────────────────────────────────────────────────────────
cas("un CSV français : point-virgule, guillemets, retour à la ligne dans une case, BOM", () => {
  const texte = '﻿Type;Client;Objet\r\nDevis;"Mme Lenoir";"Aménagement\njardin; côté rue"\r\n\r\nFacture;M. Guérin;"Le ""grand"" chêne"\r\n';
  const g = lireCsv(new TextEncoder().encode(texte));
  assert.deepEqual(g, [
    ["Type", "Client", "Objet"],
    ["Devis", "Mme Lenoir", "Aménagement\njardin; côté rue"],
    ["Facture", "M. Guérin", 'Le "grand" chêne'],
  ]);
});
cas("un CSV à virgules se lit aussi", () => {
  const g = lireCsv(new TextEncoder().encode('Type,Client,Total TTC\nFacture,M. Guérin,"2 640,00"\n'));
  assert.deepEqual(g[1], ["Facture", "M. Guérin", "2 640,00"]);
});
cas("un CSV écrit par un vieil Excel (Windows-1252) garde ses accents", () => {
  // « Élagage » en Windows-1252 : É = 0xC9.
  const octets = new Uint8Array([0x54, 0x79, 0x70, 0x65, 0x3b, 0x4f, 0x62, 0x6a, 0x65, 0x74, 0x0a, 0x44, 0x65, 0x76, 0x69, 0x73, 0x3b, 0xc9, 0x6c, 0x61, 0x67, 0x61, 0x67, 0x65]);
  assert.deepEqual(lireCsv(octets)[1], ["Devis", "Élagage"]);
});

// ── Reconnaître les colonnes ─────────────────────────────────────────────────
cas("un tableau ordinaire : chaque colonne reconnue, aucune hésitation", () => {
  const r = reconnaitreColonnes(ENTETES, TABLEAU.slice(1));
  assert.deepEqual(r.hesite, []);
  assert.equal(r.colonnes["Client"], 4);
  assert.equal(r.colonnes["Numéro"], 1);
  assert.equal(r.colonnes["Montant TTC"], 9);
  assert.equal(r.colonnes["Téléphone"], 8);
  assert.equal(r.colonnes["Code postal"], 6);
  assert.equal(r.colonnes["Adresse du chantier"], undefined, "aucune colonne de chantier dans ce tableau");
  assert.equal(r.ordreDate, "jma");
});
cas("deux colonnes de dates sans nom qui tranche : Atlas hésite, et ne choisit pas", () => {
  const r = reconnaitreColonnes(["Type", "N°", "Date 1", "Date 2", "Client", "Lieu intervention", "Total TTC"], []);
  assert.deepEqual(r.hesite, ["Date"]);
  assert.equal(r.colonnes["Date"], undefined);
  assert.deepEqual(r.candidats["Date"], [2, 3]);
  assert.equal(r.colonnes["Adresse du chantier"], 5, "« Lieu intervention » est l'adresse du chantier");
});
cas("la date d'échéance n'est pas la date de la pièce", () => {
  const r = reconnaitreColonnes(["Date", "Date d'échéance", "Client", "Type"], []);
  assert.deepEqual(r.hesite, []);
  assert.equal(r.colonnes["Date"], 0);
});
cas("« Adresse client » est l'adresse, pas le client ; « N° client » n'est pas le numéro de la pièce", () => {
  const r = reconnaitreColonnes(["N° client", "Nom", "Adresse client", "Adresse du chantier", "N° facture", "Type"], []);
  assert.equal(r.colonnes["Client"], 1);
  assert.equal(r.colonnes["Adresse"], 2);
  assert.equal(r.colonnes["Adresse du chantier"], 3);
  assert.equal(r.colonnes["Numéro"], 4);
});
cas("un total HT n'est jamais pris pour le TTC ; un « Total » sans précision fait hésiter", () => {
  assert.equal(reconnaitreColonnes(["Client", "Type", "Total HT"], []).colonnes["Montant TTC"], undefined);
  const r = reconnaitreColonnes(["Client", "Type", "Total"], []);
  assert.ok(r.hesite.includes("Montant TTC"), "« Total » peut être HT : on demande");
});
cas("sans colonne Type, Atlas demande ce que contient le tableau", () => {
  assert.ok(reconnaitreColonnes(["Client", "N°", "Date"], []).hesite.includes("Type"));
});
cas("tous les champs de la planche existent", () => {
  assert.deepEqual([...CHAMPS_DU_TABLEAU], ["Client", "Type", "Numéro", "Objet", "Date", "Adresse", "Code postal", "Ville", "Adresse du chantier", "Téléphone", "Montant TTC"]);
});

// ── Les dates ────────────────────────────────────────────────────────────────
cas("une date française se lit jour, mois, année", () => {
  assert.equal(jourDuTableau("03/04/2025", "jma"), "2025-04-03");
  assert.equal(jourDuTableau("3/4/25", "jma"), "2025-04-03");
  assert.equal(jourDuTableau("2025-04-03", "jma"), "2025-04-03", "une date ISO se lit quel que soit l'ordre");
  assert.equal(jourDuTableau("31/02/2025", "jma"), null, "un 31 février n'existe pas");
  assert.equal(jourDuTableau("", "jma"), null);
});
cas("une date d'Excel (un nombre de jours) se lit", () => {
  assert.equal(jourDuTableau("45750", "jma"), "2025-04-03");
});
cas("l'ordre se DÉDUIT de la colonne ; s'il ne se déduit pas, Atlas hésite", () => {
  assert.equal(ordreDesDates(["03/04/2025", "28/04/2025"]), "jma", "un 28 ne peut être qu'un jour");
  assert.equal(ordreDesDates(["04/03/2025", "04/28/2025"]), "mja", "une date américaine");
  assert.equal(ordreDesDates(["03/04/2025", "05/06/2025"]), "doute", "3 avril ou 4 mars : on demande");
  assert.equal(ordreDesDates(["2025-04-03", "45750"]), "amj");
  assert.equal(ordreDesDates(["", "rien"]), null);
});

// ── Montants, genres, adresses ───────────────────────────────────────────────
cas("un montant s'écrit de toutes les façons d'un tableau", () => {
  assert.equal(montantDuTableau("1 250,00"), "1250.00");
  assert.equal(montantDuTableau("1 250,00 €"), "1250.00");
  assert.equal(montantDuTableau("1.250,00"), "1250.00");
  assert.equal(montantDuTableau("1250.5"), "1250.50");
  assert.equal(montantDuTableau("1250"), "1250.00");
  assert.equal(montantDuTableau(""), null);
  assert.equal(montantDuTableau("à voir"), null);
  assert.equal(montantDuTableau("-120,00"), null, "un montant négatif est un avoir, pas un devis ni une facture");
});
cas("devis ou facture se lit dans le mot ; un avoir n'est ni l'un ni l'autre", () => {
  assert.equal(genreDuTableau("Facture"), "facture");
  assert.equal(genreDuTableau("FACT"), "facture");
  assert.equal(genreDuTableau("Devis"), "devis");
  assert.equal(genreDuTableau("Avoir"), null);
  assert.equal(genreDuTableau(""), null);
});
cas("la même adresse écrite autrement reste la même ; une autre adresse, non", () => {
  assert.equal(normaliserAdresse("14 rue Paul Bert, 44100 Nantes"), normaliserAdresse("14, rue Paul-Bert, 44100 NANTES"));
  assert.equal(normaliserAdresse("40 bd Victor Hugo, 44200 Nantes"), normaliserAdresse("40 boulevard Victor-Hugo, 44200 Nantes"));
  assert.notEqual(normaliserAdresse("40 bd Victor Hugo, 44200 Nantes"), normaliserAdresse("12 rue de la Paix, 44000 Nantes"));
});

// ── Les lignes ───────────────────────────────────────────────────────────────
cas("les lignes lues : un double compté une fois, la ligne sans nom gardée", () => {
  const l = lire();
  assert.equal(l.lignes.length, 10, "onze lignes, dont un double");
  assert.equal(l.doubles, 1);
  assert.equal(l.devis, 4);
  assert.equal(l.factures, 6);
  const lenoir = l.lignes[0];
  assert.deepEqual(
    [lenoir.genre, lenoir.numero, lenoir.objet, lenoir.jour, lenoir.montant, lenoir.nom, lenoir.adresse, lenoir.telephone],
    ["devis", "D2025-0201", "Aménagement jardin", "2025-04-03", "1250.00", "Mme Lenoir", "14 rue Paul Bert, 44100 Nantes", "06 12 48 30 77"]
  );
});
cas("une ligne ni devis ni facture n'est pas reprise, et se compte", () => {
  const l = lire([ENTETES, ["Avoir", "A1", "", "01/01/2025", "M. X", "", "", "", "", "-50,00"], TABLEAU[1]]);
  assert.equal(l.lignes.length, 1);
  assert.equal(l.ignorees, 1);
});
cas("un code postal perdu par Excel (1000 pour 01000) retrouve son zéro", () => {
  const l = lire([ENTETES, ["Devis", "D1", "", "01/01/2025", "M. Ain", "3 rue Haute", "1000", "Bourg", "", "10,00"]]);
  assert.equal(l.lignes[0].adresse, "3 rue Haute, 01000 Bourg");
});

// ── Par client : ZÉRO ERREUR SUR UNE ADRESSE ─────────────────────────────────
cas("par client : Lenoir sans question, Les Hêtres a deux adresses, Bernard diffère de sa fiche", () => {
  const { groupes, sansNom } = grouperParClient(lire().lignes, [BERNARD], {});
  const parNom = Object.fromEntries(groupes.map((g) => [g.nom, g]));
  assert.equal(parNom["Mme Lenoir"].conflit, null, "deux écritures de la même adresse ne sont pas deux adresses");
  assert.equal(parNom["SCI Les Hêtres"].conflit, "deux");
  assert.equal(parNom["SCI Les Hêtres"].adresses.length, 2);
  assert.equal(parNom["M. Bernard"].conflit, "fiche");
  assert.equal(parNom["M. Bernard"].deja?.id, "c-bernard");
  assert.equal(sansNom.length, 1);
  // Ce qui attend une réponse passe en tête.
  assert.deepEqual(groupes.slice(0, 2).map((g) => g.conflit).sort(), ["deux", "fiche"]);
  assert.equal(nomsDe(parNom["SCI Les Hêtres"].lignes), "F2025-0277,F2025-0230,D2025-0244", "ses pièces, la plus récente d'abord");
});
cas("rien ne se range tant qu'une adresse attend sa réponse", () => {
  const p = planDeRangement(lire().lignes, [BERNARD], {}, {});
  assert.equal(p.ok, false);
  if (!p.ok) assert.equal(p.adresses, 2);
});
cas("ses réponses : la seconde adresse des Hêtres devient celle du chantier, Bernard garde la sienne", () => {
  const lignes = lire().lignes;
  const { groupes } = grouperParClient(lignes, [BERNARD], {});
  const hetres = groupes.find((g) => g.nom === "SCI Les Hêtres")!;
  const k = hetres.adresses.findIndex((a) => a.lieu.startsWith("40 bd"));
  const p = planDeRangement(lignes, [BERNARD], { [hetres.cle]: k, [groupes.find((g) => g.nom === "M. Bernard")!.cle]: "meme" }, {});
  assert.ok(p.ok);
  if (!p.ok) return;
  const h = p.clients.find((c) => c.nom === "SCI Les Hêtres")!;
  assert.equal(h.existant, null);
  assert.equal(h.adresse, "40 bd Victor Hugo, 44200 Nantes", "l'adresse telle qu'elle apparaît la première fois");
  assert.deepEqual(
    h.pieces.map((x) => [x.numero, x.chantier]),
    [["F2025-0277", "12 rue de la Paix, 44000 Nantes"], ["F2025-0230", null], ["D2025-0244", null]]
  );
  const b = p.clients.find((c) => c.existant === "c-bernard")!;
  assert.equal(b.pieces[0].chantier, "12 rue des Lilas, 44000 Nantes", "l'adresse du tableau reste sur sa pièce, comme chantier");
  assert.equal(p.sansNom, 1, "la ligne sans nom n'est pas rangée tant qu'on ne l'a pas tapé");
});
cas("« ce sont deux clients différents » : une fiche par adresse", () => {
  const lignes = lire().lignes;
  const { groupes } = grouperParClient(lignes, [], {});
  const hetres = groupes.find((g) => g.nom === "SCI Les Hêtres")!;
  const p = planDeRangement(lignes, [], { [hetres.cle]: "deux" }, {});
  assert.ok(p.ok);
  if (!p.ok) return;
  const fiches = p.clients.filter((c) => c.nom === "SCI Les Hêtres");
  assert.equal(fiches.length, 2);
  assert.deepEqual(fiches.map((f) => f.pieces.length).sort(), [1, 2]);
  assert.ok(fiches.every((f) => f.pieces.every((x) => x.chantier === null)));
});
cas("« c'est un autre client » : une nouvelle fiche à l'adresse du tableau, Bernard intact", () => {
  const lignes = lire().lignes;
  const { groupes } = grouperParClient(lignes, [BERNARD], {});
  const choix = Object.fromEntries(groupes.filter((g) => g.conflit).map((g) => [g.cle, g.conflit === "deux" ? 0 : "autre"]));
  const p = planDeRangement(lignes, [BERNARD], choix as Record<string, 0 | "autre">, {});
  assert.ok(p.ok);
  if (!p.ok) return;
  const b = p.clients.filter((c) => c.nom === "M. Bernard");
  assert.equal(b.length, 1);
  assert.equal(b[0].existant, null);
  assert.equal(b[0].adresse, "12 rue des Lilas, 44000 Nantes");
});
cas("un client déjà là, sans adresse : sa fiche reçoit celle du tableau (sa réponse du 28 octobre)", () => {
  const lignes = lire().lignes;
  const { groupes } = grouperParClient(lignes, [LE_GOFF_SANS_ADRESSE], {});
  const choix = Object.fromEntries(groupes.filter((g) => g.conflit).map((g) => [g.cle, 0]));
  const p = planDeRangement(lignes, [LE_GOFF_SANS_ADRESSE], choix, {});
  assert.ok(p.ok);
  if (!p.ok) return;
  const lg = p.clients.find((c) => c.existant === "c-legoff")!;
  assert.equal(lg.adresse, "7 impasse du Lavoir, 44400 Rezé", "l'adresse à compléter part avec la fiche ; le serveur n'écrit que dans le vide");
  assert.equal(lg.pieces[0].chantier, null);
});
cas("un nom tapé range sa pièce ; s'il est celui d'un client du tableau, elle le rejoint", () => {
  const lignes = lire().lignes;
  const { groupes, sansNom } = grouperParClient(lignes, [], {});
  const choix = Object.fromEntries(groupes.filter((g) => g.conflit).map((g) => [g.cle, 0]));
  const p = planDeRangement(lignes, [], choix, { [sansNom[0].rang]: "mme lenoir" });
  assert.ok(p.ok);
  if (!p.ok) return;
  assert.equal(p.sansNom, 0);
  const lenoir = p.clients.find((c) => c.nom === "Mme Lenoir")!;
  assert.equal(lenoir.pieces.length, 3);
  // Son adresse n'est pas celle de Mme Lenoir : elle reste sur la pièce, comme chantier.
  assert.equal(lenoir.pieces.find((x) => x.numero === "F2024-0097")!.chantier, "9 rue de la Gare, 44230 Saint-Sébastien-sur-Loire");
});
cas("la colonne du chantier, quand elle existe, tranche sans question", () => {
  const entetes = [...ENTETES, "Lieu intervention"];
  const g = [
    entetes,
    [...TABLEAU[6], ""],
    [...TABLEAU[7], ""],
    ["Facture", "F2025-0277", "Création de massifs", "03/09/2025", "SCI Les Hêtres", "40 bd Victor Hugo", "44200", "Nantes", "02 40 11 22 33", "960,00", "12 rue de la Paix, 44000 Nantes"],
  ];
  const lignes = lire(g).lignes;
  const { groupes } = grouperParClient(lignes, [], {});
  assert.equal(groupes[0].conflit, null);
  const p = planDeRangement(lignes, [], {}, {});
  assert.ok(p.ok);
  if (!p.ok) return;
  assert.equal(p.clients[0].pieces.find((x) => x.numero === "F2025-0277")!.chantier, "12 rue de la Paix, 44000 Nantes");
});
cas("la clé d'une pièce : son numéro quand elle en a un, sinon tout ce qu'elle dit", () => {
  const [a] = lire().lignes;
  assert.equal(cleDeLaPiece(a), "devis|D2025-0201");
  assert.notEqual(cleDeLaPiece({ ...a, numero: null }), cleDeLaPiece({ ...a, numero: null, montant: "1.00" }));
});

// ── Ses réponses, et ce qui manque encore ───────────────────────────────────
cas("un tableau ordinaire se range sans aucune réponse", () => {
  const r = reglagesDesDecisions(TABLEAU, {});
  assert.ok(r.ok);
  if (r.ok) assert.equal(r.reglages.ordreDate, "jma");
});
cas("deux dates : rien ne se range avant qu'il ait choisi, puis tout se lit avec SA colonne", () => {
  const g = [["Type", "Client", "Date 1", "Date 2"], ["Devis", "M. X", "03/04/2025", "28/05/2025"]];
  const avant = reglagesDesDecisions(g, {});
  assert.deepEqual(avant, { ok: false, manque: "Choisissez la colonne : date" });
  const apres = reglagesDesDecisions(g, { colonnes: { Date: 3 } });
  assert.ok(apres.ok);
  if (!apres.ok) return;
  assert.equal(lireLignes(g, apres.reglages).lignes[0].jour, "2025-05-28");
  // « Pas repris » est une réponse : les pièces se rangent sans date.
  assert.ok(reglagesDesDecisions(g, { colonnes: { Date: null } }).ok);
});
cas("une date qui se lit dans les deux sens attend qu'il le dise", () => {
  const g = [["Type", "Client", "Date"], ["Devis", "M. X", "03/04/2025"]];
  assert.deepEqual(reglagesDesDecisions(g, {}), { ok: false, manque: "Dites comment se lisent les dates" });
  const r = reglagesDesDecisions(g, { ordreDate: "mja" });
  assert.ok(r.ok);
  if (r.ok) assert.equal(lireLignes(g, r.reglages).lignes[0].jour, "2025-03-04");
});
cas("sans colonne Type, « que des factures » suffit ; sans client, rien ne passe", () => {
  const g = [["Client", "N°"], ["M. X", "F1"]];
  assert.deepEqual(reglagesDesDecisions(g, {}), { ok: false, manque: "Choisissez la colonne : type" });
  const r = reglagesDesDecisions(g, { genreFixe: "facture" });
  assert.ok(r.ok);
  if (r.ok) assert.equal(lireLignes(g, r.reglages).lignes[0].genre, "facture");
  assert.deepEqual(reglagesDesDecisions(g, { genreFixe: "facture", colonnes: { Client: null } }), { ok: false, manque: "Choisissez la colonne : client" });
});
cas("une colonne hors du tableau n'est pas une réponse", () => {
  const g = [["Type", "Client", "Date 1", "Date 2"], ["Devis", "M. X", "03/04/2025", "28/05/2025"]];
  const r = reglagesDesDecisions(g, { colonnes: { Date: 99 } });
  assert.ok(r.ok, "« 99 » laisse la date sans colonne : elle n'est simplement pas reprise");
  if (r.ok) assert.equal(r.reglages.colonnes["Date"], undefined);
});
cas("une ligne de titre au-dessus des colonnes est sautée", () => {
  const g = entetePuisLignes([["Export du 03/01/2026", "", ""], ["", "", ""], ["Type", "Client", "Total TTC"], ["Devis", "M. X", "10,00"]]);
  assert.deepEqual(g[0], ["Type", "Client", "Total TTC"]);
  assert.equal(g.length, 2);
});
cas("le format se lit au nom ; le .xls est reconnu, pour être refusé en le disant", () => {
  assert.equal(formatDuTableau("Export.CSV"), "csv");
  assert.equal(formatDuTableau("2025.xlsx"), "xlsx");
  assert.equal(formatDuTableau("vieux.xls"), "xls");
  assert.equal(formatDuTableau("facture.pdf"), null);
});

console.log(`\n${echecs === 0 ? "✅" : "❌"} Importer un tableau — ${echecs} échec(s).`);
process.exit(echecs === 0 ? 0 : 1);
