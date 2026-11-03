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
  piecesLuesDeLEnvoi,
  prendrePiecesALire,
  rangerEnvoiSelonLePlan,
} from "../src/server/repositories/pieces-importees";
import { clientsQuOnPeutReconnaitre } from "../src/server/repositories/clients";
import { lignesDesPdf } from "../src/lib/import-pieces";
import { CIVILITES } from "../src/lib/civilite";
import { grouperParClient, planDeRangement, type ChoixAdresse } from "../src/lib/import-tableau";
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

// Des PDF comme un logiciel les imprime : l'artisan en tête, puis le client,
// son adresse et son téléphone (sa demande du 31 octobre 2026 : les PDF se
// rangent par client comme un tableau, adresse comprise).
const EN_TETE = ["Jardins Eden", "3 rue du Moulin 44100 Nantes", "02 40 00 00 00"];
const FACTURE_MARTINS = [...EN_TETE, "FACTURE n° F2025-0148", "Date 12/03/2025", "Client : M. Martins", "8 rue du Port 44120 Vertou", "07 11 22 33 44", "Total TTC 480,00"];
const DEVIS_LENOIR = [...EN_TETE, "DEVIS n° D2025-0201", "03/04/2025", "Pour Mme Lenoir", "14 rue Paul Bert 44100 Nantes", "Total TTC 1 250,00"];
const FACTURE_LENOIR_AILLEURS = [...EN_TETE, "FACTURE n° F2025-0163", "28/04/2025", "Pour Mme Lenoir", "2 chemin des Vignes 44120 Vertou", "Total TTC 1 250,00"];
const SANS_ADRESSE = [...EN_TETE, "FACTURE n° F2025-0170", "02/05/2025", "Client : M. Guérin", "Total TTC 90,00"];
const SANS_NOM = [...EN_TETE, "FACTURE n° F2024-0097", "09/10/2024", "SARL Les Tilleuls", "Total TTC 310,00"];

/**
 * Le geste de l'écran, tel que l'action le refait : les pièces relues en base,
 * la règle des tableaux, puis le rangement. Les noms tapés arrivent par
 * l'identifiant de la pièce.
 */
async function ranger(
  ctx: Ctx,
  envoiId: string,
  reponses: { choix?: Record<string, ChoixAdresse>; tapes?: Record<string, string>; genres?: Record<string, "devis" | "facture"> } = {}
) {
  const pieces = await piecesLuesDeLEnvoi(ctx, envoiId);
  const { lignes, idDuRang } = lignesDesPdf(pieces, reponses.genres ?? {});
  const tapes: Record<number, string> = {};
  for (const [rang, id] of idDuRang) if (reponses.tapes?.[id]) tapes[rang] = reponses.tapes[id];
  const plan = planDeRangement(lignes, await clientsQuOnPeutReconnaitre(ctx), reponses.choix ?? {}, tapes);
  if (!plan.ok) return { plan, rangees: 0 };
  return { plan, ...(await rangerEnvoiSelonLePlan(ctx, envoiId, plan.clients, idDuRang)) };
}

const tousLesClients = (ctx: Ctx) => withEntreprise(ctx.utilisateurId, ctx.entrepriseId, async (tx) => tx.select().from(clients));

async function main() {
  console.log("=== Importer devis et factures, en base ===\n");

  await essai("une pièce dont le texte dit tout, adresse comprise, se lit SANS appel à l'IA", async () => {
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
    const pieces = await piecesLuesDeLEnvoi(ctx, envoi.id);
    // Le nom rangé prend l'écriture de l'appli (« Mr. », migration 0037).
    const martins = pieces.find((p) => p.nomLu === `${CIVILITES.mr} Martins`);
    assert.equal(martins?.adresseLue, "8 rue du Port, 44120 Vertou", "l'adresse du client n'est pas gardée");
    assert.equal(martins?.telephoneLu, "07 11 22 33 44", "le téléphone du client n'est pas gardé");
  });

  await essai("sans adresse dans le texte, l'IA lit le TEXTE, et ce qu'elle rend complète la pièce", async () => {
    await nettoyerBase();
    appelsIA = 0;
    _reinitialiserFabriqueLLM(iaDeSuite('{"genre":null,"numero":null,"date":null,"montant_ttc":null,"client":null,"adresse":"5 impasse des Roses, 44300 Nantes","telephone":null,"chantier":null}'));
    const ctx = await monter("Essai sans adresse");
    const envoi = await creerEnvoi(ctx, "lot.zip", 1);
    await deposer(ctx, envoi.id, await pdfAvecTexte(SANS_ADRESSE));
    await traiterPiecesEnAttente(ctx);
    assert.equal(appelsIA, 1, "l'IA n'a pas été appelée alors que l'adresse manquait");
    const [p] = await piecesLuesDeLEnvoi(ctx, envoi.id);
    assert.equal(p.nomLu, `${CIVILITES.mr} Guérin`, "le nom lu dans le texte a été perdu");
    assert.equal(p.adresseLue, "5 impasse des Roses, 44300 Nantes");
  });

  await essai("un client sans civilité passe par l'IA, et à défaut, attend son nom sans rien deviner", async () => {
    await nettoyerBase();
    appelsIA = 0;
    // L'IA répond n'importe quoi : la pièce ne doit PAS recevoir un nom inventé.
    _reinitialiserFabriqueLLM(iaDeSuite("Je ne sais pas."));
    const ctx = await monter("Essai à vérifier");
    const envoi = await creerEnvoi(ctx, "lot.zip", 1);
    await deposer(ctx, envoi.id, await pdfAvecTexte(SANS_NOM));
    await traiterPiecesEnAttente(ctx);
    assert.equal(appelsIA, 1, "l'IA n'a pas été appelée alors que le nom manquait");
    const [p] = await piecesLuesDeLEnvoi(ctx, envoi.id);
    assert.equal(p.nomLu, null, "un nom a été inventé");
    assert.equal(p.genre, "facture");
    assert.equal(p.numero, "F2024-0097");
    assert.equal(p.montantTtc, "310.00");
    const { plan } = await ranger(ctx, envoi.id);
    assert.ok(plan.ok && plan.sansNom === 1 && plan.clients.length === 0, "une pièce sans nom a été rangée");
  });

  await essai("le nom de son entreprise, lu en base, écarte son en-tête imprimé après le client", async () => {
    // Sa demande du 3 novembre 2026 : les entreprises se lisent aussi, et le
    // piège est la sienne. Ici son en-tête vient APRÈS le cadre du client :
    // seul son nom, que `traiterPiecesEnAttente` lit dans Atlas, l'écarte.
    await nettoyerBase();
    _reinitialiserFabriqueLLM(iaDeSuite("Je ne sais pas."));
    const ctx = await monter("Jardins du Moulin");
    const envoi = await creerEnvoi(ctx, "lot.zip", 1);
    await deposer(
      ctx,
      envoi.id,
      await pdfAvecTexte(["DEVIS n° D2025-0300", "03/04/2025", "Pour Mme Lenoir", "14 rue Paul Bert 44100 Nantes", "EURL Jardins du Moulin", "3 rue du Moulin 44100 Nantes", "Total TTC 1 250,00"])
    );
    await traiterPiecesEnAttente(ctx);
    const [p] = await piecesLuesDeLEnvoi(ctx, envoi.id);
    assert.equal(p.nomLu, `${CIVILITES.mme} Lenoir`, "son propre en-tête a fait douter du client, ou a été pris pour lui");
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

  await essai("ranger retrouve le client connu, crée l'inconnu avec son adresse et son téléphone, et la fiche montre les pièces", async () => {
    await nettoyerBase();
    _reinitialiserFabriqueLLM(iaDeSuite("Je ne sais pas."));
    const ctx = await monter("Essai rangement");
    const martins = await creerClient(ctx, { nom: "M. Martins" });
    const envoi = await creerEnvoi(ctx, "lot.zip", 3);
    await deposer(ctx, envoi.id, await pdfAvecTexte(FACTURE_MARTINS));
    await deposer(ctx, envoi.id, await pdfAvecTexte(DEVIS_LENOIR));
    const { piece: tilleuls } = await deposer(ctx, envoi.id, await pdfAvecTexte(SANS_NOM));
    await traiterPiecesEnAttente(ctx);

    const r = await ranger(ctx, envoi.id, { tapes: { [tilleuls!.id]: "SARL Les Tilleuls" } });
    assert.deepEqual([r.rangees, "clientsCrees" in r ? r.clientsCrees : -1], [3, 2], "rangement inattendu");

    const ficheMartins = await chargerFicheClient(ctx, martins.id);
    assert.deepEqual(ficheMartins?.pieces.factures.map((p) => p.titre), ["n° F2025-0148"]);
    assert.match(ficheMartins!.pieces.factures[0].href, /^\/api\/pieces-importees\/facture\//);
    // Son montant lu se voit sur la ligne, comme celui d'une facture d'Atlas
    // (sa demande du 28 octobre 2026 : « le titre du devis visible, le montant »).
    assert.equal(ficheMartins!.pieces.factures[0].montant, "480.00", "le montant lu n'arrive pas sur la fiche");

    const tous = await tousLesClients(ctx);
    // Une fiche déjà là voit ses cases VIDES complétées, comme par un tableau.
    const martinsApres = tous.find((c) => c.id === martins.id);
    assert.equal(martinsApres?.adresse, "8 rue du Port, 44120 Vertou", "la case vide de sa fiche n'a pas été complétée");
    const lenoir = tous.find((c) => c.nom === "Mme Lenoir");
    assert.ok(lenoir, "Mme Lenoir n'a pas été créée");
    assert.equal(lenoir.adresse, "14 rue Paul Bert, 44100 Nantes", "la fiche neuve n'a pas l'adresse lue sur le PDF");
    const ficheLenoir = await chargerFicheClient(ctx, lenoir.id);
    assert.deepEqual(ficheLenoir?.pieces.devis.map((p) => p.titre), ["n° D2025-0201"], "le devis n'est pas sur la fiche d'un client sans chantier");
    assert.ok(tous.find((c) => c.nom === "SARL Les Tilleuls"), "le nom tapé n'a pas créé sa fiche");
  });

  await essai("deux adresses pour un même nom : rien ne se range avant sa réponse, puis l'autre va sur la pièce", async () => {
    await nettoyerBase();
    _reinitialiserFabriqueLLM(iaDeSuite("{}"));
    const ctx = await monter("Essai deux adresses");
    const envoi = await creerEnvoi(ctx, "lot.zip", 2);
    await deposer(ctx, envoi.id, await pdfAvecTexte(DEVIS_LENOIR));
    await deposer(ctx, envoi.id, await pdfAvecTexte(FACTURE_LENOIR_AILLEURS));
    await traiterPiecesEnAttente(ctx);
    const avant = await ranger(ctx, envoi.id);
    assert.deepEqual(avant.plan, { ok: false, adresses: 1 }, "deux adresses ont été tranchées sans lui");
    assert.equal((await tousLesClients(ctx)).length, 0, "une fiche est née avant sa réponse");

    // La clé du client et le rang de l'adresse viennent de la règle elle-même,
    // comme l'écran les montre.
    const { groupes } = grouperParClient(lignesDesPdf(await piecesLuesDeLEnvoi(ctx, envoi.id), {}).lignes, [], {});
    const sienne = groupes[0].adresses.findIndex((x) => x.lieu === "14 rue Paul Bert, 44100 Nantes");
    const apres = await ranger(ctx, envoi.id, { choix: { [groupes[0].cle]: sienne } });
    assert.equal(apres.rangees, 2, "sa réponse n'a pas rangé les deux pièces");
    const [lenoir] = await tousLesClients(ctx);
    assert.equal(lenoir.adresse, "14 rue Paul Bert, 44100 Nantes");
    const ailleurs = await withEntreprise(ctx.utilisateurId, ctx.entrepriseId, async (tx) =>
      tx.select({ c: piecesImportees.adresseChantier }).from(piecesImportees).where(eq(piecesImportees.numero, "F2025-0163"))
    );
    assert.equal(ailleurs[0].c, "2 chemin des Vignes, 44120 Vertou", "l'autre adresse n'est pas restée sur la pièce");
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
    await ranger(ctx, envoi.id);
    assert.ok(await annulerRangement(ctx, envoi.id));
    const tous = await tousLesClients(ctx);
    assert.deepEqual(tous.map((c) => c.nom).sort(), ["M. Martins"], "l'annulation a laissé une fiche créée, ou retiré une fiche connue");
    assert.equal(tous[0].adresse, null, "la case complétée par le rangement ne s'est pas vidée");
    assert.equal((await piecesLuesDeLEnvoi(ctx, envoi.id)).length, 2, "les pièces ne sont pas redevenues à ranger");
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
    await ranger(ctx, envoi.id);
    const lenoir = (await tousLesClients(ctx)).find((c) => c.nom === "Mme Lenoir");
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
      tx.select().from(fichiersAPurger).where(inArray(fichiersAPurger.storageKey, [avant.cle ?? ""]))
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
    await traiterPiecesEnAttente(a);
    assert.equal(await envoiEnCours(b), null, "B voit l'envoi de A");
    assert.deepEqual(await prendrePiecesALire(b, 10), [], "B a pris une pièce de A à lire");
    assert.deepEqual(await empreintesConnues(b, [empreinte]), [], "B connaît une empreinte de A");
    assert.deepEqual(await piecesLuesDeLEnvoi(b, envoi.id), [], "B lit les pièces de A");
    // B qui range l'envoi de A ne touche à rien : la RLS cache les pièces.
    const r = await ranger(b, envoi.id);
    assert.equal(r.rangees, 0);
    assert.equal((await piecesLuesDeLEnvoi(a, envoi.id)).length, 1, "le rangement de B a touché les pièces de A");
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
