import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { PDFDocument, StandardFonts } from "pdf-lib";
import { pool } from "../src/server/db/client";
import { nettoyerBase } from "./_test-db";
import { creerEntreprise } from "../src/server/repositories/entreprises";
import { creerClient } from "../src/server/repositories/clients";
import { chargerFicheClient } from "../src/server/repositories/fiche-client";
import {
  annulerRangement,
  creerEnvoi,
  deposerPiece,
  empreintesConnues,
  envoiEnCours,
  nommerPiece,
  piecesAVerifier,
  prendrePiecesALire,
  rangerEnvoi,
} from "../src/server/repositories/pieces-importees";
import { traiterPiecesEnAttente } from "../src/server/import/traiter-pieces";
import { enregistrerObjet } from "../src/server/storage";
import { _reinitialiserFabriqueLLM } from "../src/server/ai/providers/llm/fabrique";
import type { FournisseurLLM } from "../src/server/ai/providers/llm/interface";
import { withEntreprise } from "../src/server/db/with-entreprise";
import { clients, fichiersAPurger, piecesImportees } from "../src/server/db/schema";
import { apercuSuppressionClient, effacerClient } from "../src/server/repositories/donnees-client";
import { eq, inArray } from "drizzle-orm";

// IMPORTER DEVIS ET FACTURES, en base et sous `atlas_app` — 22 octobre 2026.
//
// **Sous la RLS vraie** : ces pièces portent les clients et les montants d'un
// artisan. Une suite navigateur, qui traverse la RLS, ne verrait pas qu'une
// entreprise lit les pièces d'une autre (`CLAUDE.md` §5).
//
// Les PDF du montage sont de VRAIS PDF, écrits avec du texte : c'est la
// lecture sans IA qui est éprouvée ici, de bout en bout. L'IA est remplacée par
// un fournisseur de suite qui COMPTE ses appels : une pièce dont le texte dit
// tout ne doit en faire aucun.

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
    { email: `pi-${Math.random().toString(36).slice(2)}@essai.local`, nom: "Patron" }
  );
  return { utilisateurId, entrepriseId: entreprise.id };
}
type Ctx = Awaited<ReturnType<typeof monter>>;

async function pdfAvecTexte(lignes: string[]): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const police = await doc.embedFont(StandardFonts.Helvetica);
  const page = doc.addPage([595, 842]);
  lignes.forEach((l, i) => page.drawText(l, { x: 50, y: 780 - i * 20, size: 12, font: police }));
  return doc.save();
}

async function deposer(ctx: Ctx, envoiId: string, octets: Uint8Array) {
  const empreinte = createHash("sha256").update(octets).digest("hex");
  const objet = await enregistrerObjet(`entreprises/${ctx.entrepriseId}/pieces-importees`, Buffer.from(octets), ".pdf", "application/pdf");
  return { empreinte, piece: await deposerPiece(ctx, { envoiId, empreinte, fichierCle: objet.storageKey, fichierNom: "piece.pdf" }) };
}

let appelsIA = 0;
const iaDeSuite = (reponse: string): FournisseurLLM => ({
  nom: "suite",
  async genererTexte() {
    appelsIA++;
    return { succes: true, texte: reponse };
  },
});

const FACTURE_MARTINS = ["Jardins Eden", "FACTURE n° F2025-0148", "Date 12/03/2025", "Client : M. Martins", "Total TTC 480,00"];
const DEVIS_LENOIR = ["Jardins Eden", "DEVIS n° D2025-0201", "03/04/2025", "Pour Mme Lenoir", "Total TTC 1 250,00"];
const SANS_NOM = ["Jardins Eden", "FACTURE n° F2024-0097", "09/10/2024", "SARL Les Tilleuls", "Total TTC 310,00"];

async function main() {
  console.log("=== Importer devis et factures, en base ===\n");

  await essai("une pièce dont le texte dit tout se lit SANS appel à l'IA", async () => {
    await nettoyerBase();
    appelsIA = 0;
    _reinitialiserFabriqueLLM(iaDeSuite("{}"));
    const ctx = await monter("Essai import");
    const envoi = await creerEnvoi(ctx, "lot.zip", 2);
    await deposer(ctx, envoi.id, await pdfAvecTexte(FACTURE_MARTINS));
    await deposer(ctx, envoi.id, await pdfAvecTexte(DEVIS_LENOIR));
    const lues = await traiterPiecesEnAttente(ctx);
    assert.equal(lues, 2, "les deux pièces n'ont pas été lues");
    assert.equal(appelsIA, 0, `${appelsIA} appel(s) à l'IA pour des pièces que le texte suffisait à lire`);
    const etat = await envoiEnCours(ctx);
    assert.ok(etat);
    assert.deepEqual([etat.recues, etat.lues, etat.pretes, etat.aVerifier], [2, 2, 2, 0]);
  });

  await essai("un client sans civilité passe par l'IA, et à défaut, à vérifier sans rien deviner", async () => {
    await nettoyerBase();
    appelsIA = 0;
    // L'IA répond n'importe quoi : la pièce ne doit PAS recevoir un nom inventé.
    _reinitialiserFabriqueLLM(iaDeSuite("Je ne sais pas."));
    const ctx = await monter("Essai à vérifier");
    const envoi = await creerEnvoi(ctx, "lot.zip", 1);
    await deposer(ctx, envoi.id, await pdfAvecTexte(SANS_NOM));
    await traiterPiecesEnAttente(ctx);
    assert.equal(appelsIA, 1, "l'IA n'a pas été appelée alors que le nom manquait");
    const aVoir = await piecesAVerifier(ctx, envoi.id);
    assert.equal(aVoir.length, 1);
    assert.equal(aVoir[0].nomLu, null, "un nom a été inventé");
    assert.equal(aVoir[0].genre, "facture");
    assert.equal(aVoir[0].numero, "F2024-0097");
    assert.equal(aVoir[0].montantTtc, "310.00");
  });

  await essai("ce que l'IA lit complète le texte, sans l'écraser", async () => {
    await nettoyerBase();
    _reinitialiserFabriqueLLM(iaDeSuite('{"genre":"facture","numero":"AUTRE","date":null,"montant_ttc":null,"client":"SARL Les Tilleuls"}'));
    const ctx = await monter("Essai IA");
    const envoi = await creerEnvoi(ctx, "lot.zip", 1);
    await deposer(ctx, envoi.id, await pdfAvecTexte(SANS_NOM));
    await traiterPiecesEnAttente(ctx);
    const etat = await envoiEnCours(ctx);
    assert.equal(etat?.pretes, 1, "la pièce nommée par l'IA n'est pas prête");
  });

  await essai("le même fichier deux fois ne fait qu'une pièce", async () => {
    await nettoyerBase();
    _reinitialiserFabriqueLLM(iaDeSuite("{}"));
    const ctx = await monter("Essai doublon");
    const envoi = await creerEnvoi(ctx, "lot.zip", 2);
    const octets = await pdfAvecTexte(FACTURE_MARTINS);
    const premier = await deposer(ctx, envoi.id, octets);
    const second = await deposer(ctx, envoi.id, octets);
    assert.ok(premier.piece, "la première n'a pas été gardée");
    assert.equal(second.piece, null, "le doublon a été gardé");
    assert.deepEqual(await empreintesConnues(ctx, [premier.empreinte, "0".repeat(64)]), [premier.empreinte]);
  });

  await essai("ranger retrouve le client connu, crée l'inconnu, et la fiche montre les pièces", async () => {
    await nettoyerBase();
    _reinitialiserFabriqueLLM(iaDeSuite("Je ne sais pas."));
    const ctx = await monter("Essai rangement");
    const martins = await creerClient(ctx, { nom: "M. Martins" });
    const envoi = await creerEnvoi(ctx, "lot.zip", 3);
    await deposer(ctx, envoi.id, await pdfAvecTexte(FACTURE_MARTINS));
    await deposer(ctx, envoi.id, await pdfAvecTexte(DEVIS_LENOIR));
    await deposer(ctx, envoi.id, await pdfAvecTexte(SANS_NOM));
    await traiterPiecesEnAttente(ctx);

    const [aVoir] = await piecesAVerifier(ctx, envoi.id);
    assert.ok(await nommerPiece(ctx, aVoir.id, "Mme Roux", null), "le nom tapé n'a pas été pris");
    const r = await rangerEnvoi(ctx, envoi.id);
    assert.deepEqual([r.rangees, r.clientsCrees], [3, 2], "rangement inattendu");

    const ficheMartins = await chargerFicheClient(ctx, martins.id);
    assert.deepEqual(ficheMartins?.pieces.factures.map((p) => p.titre), ["n° F2025-0148"]);
    assert.match(ficheMartins!.pieces.factures[0].href, /^\/api\/pieces-importees\/facture\//);

    const tous = await withEntreprise(ctx.utilisateurId, ctx.entrepriseId, async (tx) => tx.select().from(clients));
    const lenoir = tous.find((c) => c.nom === "Mme Lenoir");
    assert.ok(lenoir, "Mme Lenoir n'a pas été créée");
    const ficheLenoir = await chargerFicheClient(ctx, lenoir.id);
    assert.deepEqual(ficheLenoir?.pieces.devis.map((p) => p.titre), ["n° D2025-0201"], "le devis n'est pas sur la fiche d'un client sans chantier");
  });

  await essai("annuler remet les pièces et retire les seules fiches que le rangement a créées", async () => {
    await nettoyerBase();
    _reinitialiserFabriqueLLM(iaDeSuite("{}"));
    const ctx = await monter("Essai annulation");
    await creerClient(ctx, { nom: "M. Martins" });
    const envoi = await creerEnvoi(ctx, "lot.zip", 2);
    await deposer(ctx, envoi.id, await pdfAvecTexte(FACTURE_MARTINS));
    await deposer(ctx, envoi.id, await pdfAvecTexte(DEVIS_LENOIR));
    await traiterPiecesEnAttente(ctx);
    await rangerEnvoi(ctx, envoi.id);
    assert.ok(await annulerRangement(ctx, envoi.id));
    const noms = (await withEntreprise(ctx.utilisateurId, ctx.entrepriseId, async (tx) => tx.select().from(clients))).map((c) => c.nom).sort();
    assert.deepEqual(noms, ["M. Martins"], "l'annulation a laissé une fiche créée, ou retiré une fiche connue");
    const etat = await envoiEnCours(ctx);
    assert.equal(etat?.pretes, 2, "les pièces ne sont pas redevenues prêtes");
  });

  await essai("supprimer un client emporte ses pièces importées, après la même prévention", async () => {
    // Sa décision du 22 octobre 2026 : *« quand on supprime un client, il faut
    // que ces pièces importées se suppriment aussi, avec le même message »*.
    // Avant, le lien tombait à NULL et la pièce restait, nom compris.
    await nettoyerBase();
    _reinitialiserFabriqueLLM(iaDeSuite("{}"));
    const ctx = await monter("Essai suppression");
    const envoi = await creerEnvoi(ctx, "lot.zip", 1);
    await deposer(ctx, envoi.id, await pdfAvecTexte(DEVIS_LENOIR));
    await traiterPiecesEnAttente(ctx);
    await rangerEnvoi(ctx, envoi.id);
    const lenoir = (await withEntreprise(ctx.utilisateurId, ctx.entrepriseId, async (tx) => tx.select().from(clients))).find((c) => c.nom === "Mme Lenoir");
    assert.ok(lenoir, "Mme Lenoir n'a pas été créée");

    const apercu = await apercuSuppressionClient(ctx, lenoir.id);
    assert.equal(apercu?.documents, 1, "la prévention ne compte pas la pièce importée : la suppression passerait sans « J'ai sauvegardé ces documents ailleurs »");

    const [avant] = await withEntreprise(ctx.utilisateurId, ctx.entrepriseId, async (tx) =>
      tx.select({ cle: piecesImportees.fichierCle }).from(piecesImportees).where(eq(piecesImportees.clientId, lenoir.id))
    );
    const rapport = await effacerClient(ctx, lenoir.id);
    assert.equal(rapport?.disparu, true, "le client n'a pas disparu");
    const restantes = await withEntreprise(ctx.utilisateurId, ctx.entrepriseId, async (tx) => tx.select().from(piecesImportees));
    assert.deepEqual(restantes, [], "la pièce importée a survécu à son client");
    const enFile = await withEntreprise(ctx.utilisateurId, ctx.entrepriseId, async (tx) =>
      tx.select().from(fichiersAPurger).where(inArray(fichiersAPurger.storageKey, [avant.cle]))
    );
    assert.equal(enFile.length, 1, "le fichier de la pièce n'est pas mis en file de purge");
  });

  await essai("une AUTRE entreprise ne voit ni ne lit les pièces", async () => {
    await nettoyerBase();
    _reinitialiserFabriqueLLM(iaDeSuite("{}"));
    const a = await monter("Entreprise A");
    const b = await monter("Entreprise B");
    const envoi = await creerEnvoi(a, "lot.zip", 1);
    const { empreinte } = await deposer(a, envoi.id, await pdfAvecTexte(FACTURE_MARTINS));
    assert.equal(await envoiEnCours(b), null, "B voit l'envoi de A");
    assert.deepEqual(await prendrePiecesALire(b, 10), [], "B a pris une pièce de A à lire");
    assert.deepEqual(await empreintesConnues(b, [empreinte]), [], "B connaît une empreinte de A");
    assert.deepEqual(await piecesAVerifier(b, envoi.id), []);
  });

  _reinitialiserFabriqueLLM(null);
  await pool.end();
  if (echecs > 0) {
    console.log(`\n✗ ${echecs} échec(s)`);
    process.exit(1);
  }
  console.log("\n✅ Les pièces importées se lisent, se rangent, s'annulent, et restent chez leur entreprise.");
}

main().catch(async (e) => {
  console.error(e);
  await pool.end();
  process.exit(1);
});
