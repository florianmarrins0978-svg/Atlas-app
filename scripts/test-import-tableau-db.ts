import assert from "node:assert/strict";
import { eq } from "drizzle-orm";
import { pool } from "../src/server/db/client";
import { nettoyerBase } from "./_test-db";
import { creerEntreprise } from "../src/server/repositories/entreprises";
import { creerClient, clientsQuOnPeutReconnaitre, mettreAJourClient } from "../src/server/repositories/clients";
import { annulerRangement, envoiEnCours, rangerTableau } from "../src/server/repositories/pieces-importees";
import { chargerFicheClient } from "../src/server/repositories/fiche-client";
import { withEntreprise } from "../src/server/db/with-entreprise";
import { clients, envoisPieces, piecesImportees } from "../src/server/db/schema";
import { grouperParClient, lireLignes, planDeRangement, reconnaitreColonnes, type ChoixAdresse } from "../src/lib/import-tableau";

// **RANGER UN TABLEAU, EN BASE, SOUS LA RLS VRAIE** (`atlas_app`) — ses
// réponses du 28 octobre 2026 : la migration oui, les cases vides complétées.
//
// Ce que cette suite tient et qu'aucune règle pure ne verrait : le rangement
// réussit ou échoue d'un seul tenant, une fiche déjà là ne perd rien, un
// tableau importé deux fois ne double rien, « Annuler » rend exactement ce
// qu'il y avait, et une autre entreprise ne voit aucune de ces pièces.

let echecs = 0;
async function essai(nom: string, fn: () => Promise<void>) {
  try {
    await fn();
    console.log(`  ✓ ${nom}`);
  } catch (e) {
    echecs++;
    console.log(`  ✗ ${nom}\n    ${(e as Error).message}`);
  }
}

async function monter(nom: string) {
  const { entreprise, utilisateurId } = await creerEntreprise(
    { nom },
    { email: `it-${Math.random().toString(36).slice(2)}@essai.local`, nom: "Patron" }
  );
  return { utilisateurId, entrepriseId: entreprise.id };
}

const ENTETES = ["Type", "N°", "Objet", "Date", "Client", "Adresse", "CP", "Ville", "Tél.", "Total TTC"];
const GRILLE = [
  ENTETES,
  ["Devis", "D2025-0201", "Aménagement jardin", "03/04/2025", "Mme Lenoir", "14 rue Paul Bert", "44100", "Nantes", "06 12 48 30 77", "1 250,00"],
  ["Facture", "F2025-0163", "Aménagement jardin", "28/04/2025", "Mme Lenoir", "14, rue Paul-Bert", "44100", "NANTES", "06 12 48 30 77", "1 250,00"],
  ["Facture", "F2025-0122", "Taille de haie", "06/01/2025", "M. Bernard", "12 rue des Lilas", "44000", "Nantes", "06 33 18 90 41", "195,00"],
  ["Devis", "D2025-0244", "Entretien des espaces verts", "20/05/2025", "SCI Les Hêtres", "40 bd Victor Hugo", "44200", "Nantes", "02 40 11 22 33", "4 180,00"],
  ["Facture", "F2025-0277", "Création de massifs", "03/09/2025", "SCI Les Hêtres", "12 rue de la Paix", "44000", "Nantes", "02 40 11 22 33", "960,00"],
  ["Devis", "D2025-0310", "Création d'une pelouse", "08/10/2025", "Mme Le Goff", "7 impasse du Lavoir", "44400", "Rezé", "06 55 44 33 22", "780,00"],
];

/** Le plan que l'écran a montré, avec ses réponses : Bernard « le même », Les Hêtres au 40 bd. */
async function planDe(ctx: { utilisateurId: string; entrepriseId: string }) {
  const r = reconnaitreColonnes(GRILLE[0], GRILLE.slice(1));
  const { lignes } = lireLignes(GRILLE, { colonnes: r.colonnes, ordreDate: r.ordreDate === "doute" ? null : r.ordreDate });
  const connus = await clientsQuOnPeutReconnaitre(ctx);
  const { groupes } = grouperParClient(lignes, connus, {});
  const choix: Record<string, ChoixAdresse> = {};
  for (const g of groupes) {
    if (g.conflit === "fiche") choix[g.cle] = "meme";
    if (g.conflit === "deux") choix[g.cle] = g.adresses.findIndex((a) => a.lieu.startsWith("40 bd"));
  }
  const plan = planDeRangement(lignes, connus, choix, {});
  assert.ok(plan.ok, "le plan attend encore une réponse");
  return plan.clients;
}

async function main() {
  console.log("=== Ranger un tableau, en base ===\n");

  await essai("le tableau se range : fiches créées, fiche déjà là intacte, case vide complétée, chantier gardé", async () => {
    await nettoyerBase();
    const ctx = await monter("Essai tableau");
    const bernard = await creerClient(ctx, { nom: "M. Bernard", adresse: "21 quai de la Fosse, 44000 Nantes", telephone: "06 33 18 90 41" });
    const leGoff = await creerClient(ctx, { nom: "Mme Le Goff" });

    const bilan = await rangerTableau(ctx, "Devis et factures 2025.csv", await planDe(ctx));
    assert.equal(bilan.rangees, 6);
    assert.equal(bilan.clientsCrees, 2, "Mme Lenoir et SCI Les Hêtres");
    assert.equal(bilan.completees, 2, "l'adresse et le téléphone de Mme Le Goff, vides jusque-là");

    const tous = await withEntreprise(ctx.utilisateurId, ctx.entrepriseId, (tx) => tx.select().from(clients));
    assert.equal(tous.length, 4, `fiches : ${tous.map((c) => c.nom).join(", ")}`);
    const b = tous.find((c) => c.id === bernard.id)!;
    assert.equal(b.adresse, "21 quai de la Fosse, 44000 Nantes", "la fiche de M. Bernard a perdu son adresse");
    const lg = tous.find((c) => c.id === leGoff.id)!;
    assert.equal(lg.adresse, "7 impasse du Lavoir, 44400 Rezé");
    assert.equal(lg.telephone, "06 55 44 33 22");

    const ficheB = await chargerFicheClient(ctx, bernard.id);
    assert.equal(ficheB!.pieces.factures.length, 1, "la facture de M. Bernard n'est pas sur sa fiche");
    const pieces = await withEntreprise(ctx.utilisateurId, ctx.entrepriseId, (tx) => tx.select().from(piecesImportees));
    const deBernard = pieces.find((p) => p.numero === "F2025-0122")!;
    assert.equal(deBernard.adresseChantier, "12 rue des Lilas, 44000 Nantes", "l'adresse du tableau n'est pas restée sur la pièce");
    assert.equal(deBernard.fichierCle, null);
    assert.equal(deBernard.objet, "Taille de haie");
    assert.equal(deBernard.montantTtc, "195.00");
    assert.equal(deBernard.jour, "2025-01-06");
    const massifs = pieces.find((p) => p.numero === "F2025-0277")!;
    assert.equal(massifs.adresseChantier, "12 rue de la Paix, 44000 Nantes");
    assert.equal(pieces.find((p) => p.numero === "D2025-0244")!.adresseChantier, null);

    // **Sur sa fiche, la pièce s'ouvre sur ses chiffres** : pas de PDF, son
    // titre, son montant, son chantier (planche `clients-importer.html`).
    const surLaFiche = ficheB!.pieces.factures[0];
    assert.equal(surLaFiche.format, "tableau", "une ligne de tableau s'annonce comme un PDF qu'elle n'est pas");
    assert.equal(surLaFiche.objet, "Taille de haie");
    assert.equal(surLaFiche.montant, "195.00");
    assert.equal(surLaFiche.chantier, "12 rue des Lilas, 44000 Nantes");
  });

  await essai("le même tableau une seconde fois ne double rien, et ne crée aucune fiche vide", async () => {
    await nettoyerBase();
    const ctx = await monter("Essai deux fois");
    await rangerTableau(ctx, "t.csv", await planDe(ctx));
    const second = await rangerTableau(ctx, "t.csv", await planDe(ctx));
    assert.equal(second.rangees, 0);
    assert.equal(second.dejaLa, 6);
    assert.equal(second.envoiId, null);
    const n = await withEntreprise(ctx.utilisateurId, ctx.entrepriseId, (tx) => tx.select().from(clients));
    assert.equal(n.length, 4, "une seconde fiche Lenoir est née");
  });

  await essai("« Annuler » rend la base telle qu'avant : pièces, fiches créées, cases complétées", async () => {
    await nettoyerBase();
    const ctx = await monter("Essai annuler");
    const leGoff = await creerClient(ctx, { nom: "Mme Le Goff" });
    const bilan = await rangerTableau(ctx, "t.csv", await planDe(ctx));
    assert.ok(bilan.envoiId);
    const etat = await envoiEnCours(ctx);
    assert.equal(etat?.rangees, 6, "la bande de Vos clients ne voit pas le rangement (« Annuler » n'y serait pas)");

    assert.ok(await annulerRangement(ctx, bilan.envoiId));
    const [pieces, fiches, envois] = await withEntreprise(ctx.utilisateurId, ctx.entrepriseId, (tx) =>
      Promise.all([tx.select().from(piecesImportees), tx.select().from(clients), tx.select().from(envoisPieces)])
    );
    assert.equal(pieces.length, 0, "des pièces du tableau sont restées");
    // Seule reste la fiche qui était là avant : les trois créées par le tableau
    // (Mme Lenoir, M. Bernard, SCI Les Hêtres) sont parties.
    assert.deepEqual(fiches.map((c) => c.nom), ["Mme Le Goff"], "les fiches créées ne sont pas parties");
    assert.equal(envois.length, 0, "l'envoi vidé est resté : la bande annoncerait « 0 sur 6 »");
    const lg = fiches.find((c) => c.id === leGoff.id)!;
    assert.equal(lg.adresse, null, "l'adresse complétée par le tableau est restée");
    assert.equal(lg.telephone, null);
  });

  await essai("« Annuler » ne vide pas une case qu'il a changée depuis", async () => {
    await nettoyerBase();
    const ctx = await monter("Essai annuler après");
    const leGoff = await creerClient(ctx, { nom: "Mme Le Goff" });
    const bilan = await rangerTableau(ctx, "t.csv", await planDe(ctx));
    await mettreAJourClient(ctx, leGoff.id, { telephone: "07 00 00 00 01" });
    await annulerRangement(ctx, bilan.envoiId!);
    const [lg] = await withEntreprise(ctx.utilisateurId, ctx.entrepriseId, (tx) => tx.select().from(clients).where(eq(clients.id, leGoff.id)));
    assert.equal(lg.telephone, "07 00 00 00 01", "le numéro qu'il a tapé lui-même a été effacé");
    assert.equal(lg.adresse, null);
  });

  await essai("une AUTRE entreprise ne voit ni les pièces ni les fiches du tableau", async () => {
    await nettoyerBase();
    const a = await monter("Maison A");
    const b = await monter("Maison B");
    await rangerTableau(a, "t.csv", await planDe(a));
    const [pieces, fiches] = await withEntreprise(b.utilisateurId, b.entrepriseId, (tx) =>
      Promise.all([tx.select().from(piecesImportees), tx.select().from(clients)])
    );
    assert.deepEqual([pieces.length, fiches.length], [0, 0]);
    // Et le même numéro chez B se range chez B : le doublon se juge par entreprise.
    const chezB = await rangerTableau(b, "t.csv", await planDe(b));
    assert.equal(chezB.rangees, 6);
  });

  console.log(`\n${echecs === 0 ? "✅" : "❌"} Ranger un tableau — ${echecs} échec(s).`);
  await pool.end();
  process.exit(echecs === 0 ? 0 : 1);
}

main().catch(async (e) => {
  console.error(e);
  await pool.end().catch(() => undefined);
  process.exit(1);
});
