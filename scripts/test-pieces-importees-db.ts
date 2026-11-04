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
  rangerTableau,
} from "../src/server/repositories/pieces-importees";
import { clientsQuOnPeutReconnaitre } from "../src/server/repositories/clients";
import { envoiAReprendre, lignesDesPdf } from "../src/lib/import-pieces";
import { ANNULER_PENDANT_MS, MARGE_RESEAU_ANNULER_MS } from "../src/lib/delai-annuler";
import { CIVILITES } from "../src/lib/civilite";

/** La fiche que le rangement crée pour lui : le nom lu s'écrit à la façon de l'appli (migration 0037). */
const MARTINS_RANGE = `${CIVILITES.mr} Martins`;
import { grouperParClient, planDeRangement, type ChoixAdresse } from "../src/lib/import-tableau";
import { chercherLesObjets, traiterPiecesEnAttente } from "../src/server/import/traiter-pieces";
import { enregistrerObjet } from "../src/server/storage";
import { _reinitialiserFabriqueLLM } from "../src/server/ai/providers/llm/fabrique";
import type { FournisseurLLM } from "../src/server/ai/providers/llm/interface";
import { withEntreprise } from "../src/server/db/with-entreprise";
import { clients, envoisPieces, fichiersAPurger, piecesImportees } from "../src/server/db/schema";
import { apercuSuppressionClient, effacerClient } from "../src/server/repositories/donnees-client";
import { eq, inArray, sql } from "drizzle-orm";

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
const DEVIS_LENOIR = [...EN_TETE, "DEVIS n° D2025-0201", "03/04/2025", "Pour Mme Lenoir", "14 rue Paul Bert 44100 Nantes", "Objet : Elagage", "Désignation Qté PU HT", "Total TTC 1 250,00"];
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

/**
 * Le temps passé depuis le rangement, sans l'attendre : le rangement recule
 * dans le temps. C'est l'heure du SERVEUR qui décide, comme pour lui.
 */
async function vieillir(ctx: Ctx, envoiId: string, ms: number) {
  await withEntreprise(ctx.utilisateurId, ctx.entrepriseId, (tx) =>
    tx
      .update(envoisPieces)
      .set({ rangeLe: sql`${envoisPieces.rangeLe} - (${ms}::int * interval '1 millisecond')` })
      .where(eq(envoisPieces.id, envoiId))
  );
}

/**
 * Son import du 3 novembre 2026, en petit : deux pièces nommées se rangent,
 * la troisième n'a pas de nom lisible et reste (ses 48 sur 51, les trois
 * devis de Mme Sanchez).
 */
async function rangementPartiel(nom: string) {
  await nettoyerBase();
  _reinitialiserFabriqueLLM(iaDeSuite("Je ne sais pas."));
  const ctx = await monter(nom);
  const envoi = await creerEnvoi(ctx, "lot.zip", 3);
  await deposer(ctx, envoi.id, await pdfAvecTexte(FACTURE_MARTINS));
  await deposer(ctx, envoi.id, await pdfAvecTexte(DEVIS_LENOIR));
  const { piece: tilleuls } = await deposer(ctx, envoi.id, await pdfAvecTexte(SANS_NOM));
  await traiterPiecesEnAttente(ctx);
  const r = await ranger(ctx, envoi.id);
  assert.equal(r.rangees, 2, "le rangement partiel n'a pas rangé les deux pièces nommées");
  return { ctx, envoi, tilleuls: tilleuls! };
}

/** Le nombre de pièces que chaque fiche montre. */
async function piecesParFiche(ctx: Ctx): Promise<Record<string, number>> {
  const parFiche: Record<string, number> = {};
  for (const c of await tousLesClients(ctx)) {
    const fiche = await chargerFicheClient(ctx, c.id);
    parFiche[c.nom] = (fiche?.pieces.devis.length ?? 0) + (fiche?.pieces.factures.length ?? 0);
  }
  return parFiche;
}

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
    // Sa remarque du 3 novembre 2026 : « objet et titre, c'est la même chose ».
    assert.equal(ficheLenoir?.pieces.devis[0].objet, "Elagage", "l'objet du PDF n'est pas le titre de sa ligne");
    assert.ok(tous.find((c) => c.nom === "SARL Les Tilleuls"), "le nom tapé n'a pas créé sa fiche");
  });

  await essai("un PDF importé avant que l'objet se lise le trouve à l'ouverture de la fiche, une seule fois", async () => {
    await nettoyerBase();
    _reinitialiserFabriqueLLM(iaDeSuite("{}"));
    const ctx = await monter("Essai objet d'avant");
    const envoi = await creerEnvoi(ctx, "lot.zip", 1);
    await deposer(ctx, envoi.id, await pdfAvecTexte(DEVIS_LENOIR));
    await traiterPiecesEnAttente(ctx);
    await ranger(ctx, envoi.id);
    // Comme une pièce rangée avant la migration 0156 : ni objet, ni recherche.
    await withEntreprise(ctx.utilisateurId, ctx.entrepriseId, async (tx) =>
      tx.update(piecesImportees).set({ objet: null, objetChercheLe: null })
    );
    const lenoir = (await tousLesClients(ctx)).find((c) => c.nom === "Mme Lenoir")!;
    assert.equal((await chargerFicheClient(ctx, lenoir.id))?.pieces.devis[0].objet ?? null, null, "le décor n'a pas effacé l'objet");
    await chercherLesObjets(ctx, lenoir.id);
    assert.equal((await chargerFicheClient(ctx, lenoir.id))?.pieces.devis[0].objet, "Elagage", "l'objet n'a pas été relu");
    // Une seconde ouverture ne relit rien : la recherche est notée.
    await withEntreprise(ctx.utilisateurId, ctx.entrepriseId, async (tx) => tx.update(piecesImportees).set({ objet: null }));
    await chercherLesObjets(ctx, lenoir.id);
    assert.equal((await chargerFicheClient(ctx, lenoir.id))?.pieces.devis[0].objet ?? null, null, "le PDF a été relu une seconde fois");
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
    assert.deepEqual(await annulerRangement(ctx, envoi.id), { ok: true });
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
    assert.deepEqual(await annulerRangement(b, envoi.id), { ok: false, pourquoi: "introuvable" }, "B annule un envoi de A");
  });

  // ── « Annuler » six secondes, puis ce qui reste : sa capture du 3 novembre 2026 ──
  //
  // Son import avait rangé 48 pièces sur 51 : trois devis sans nom lisible.
  // Le bandeau « 48 documents rangés, Annuler » ne partait jamais (le serveur
  // ne lâchait l'envoi qu'une fois TOUT rangé), et les trois devis n'avaient
  // plus d'autre porte que lui : l'import ne reprenait qu'un envoi jamais rangé.

  await essai("rangé : « Annuler » six secondes durant, le temps compté par le serveur", async () => {
    const { ctx } = await rangementPartiel("Essai fenêtre");
    const etat = await envoiEnCours(ctx);
    assert.equal(etat?.rangees, 2);
    assert.ok(
      typeof etat.annulableMs === "number" && etat.annulableMs > 0 && etat.annulableMs <= ANNULER_PENDANT_MS,
      `le temps qui reste à « Annuler » : ${etat.annulableMs}`
    );
    assert.equal(envoiAReprendre(etat), null, "l'import reprend l'envoi pendant que « Annuler » est encore proposé");
  });

  await essai("tout rangé, les six secondes passées : plus de bande", async () => {
    await nettoyerBase();
    _reinitialiserFabriqueLLM(iaDeSuite("{}"));
    const ctx = await monter("Essai tout rangé");
    const envoi = await creerEnvoi(ctx, "lot.zip", 1);
    await deposer(ctx, envoi.id, await pdfAvecTexte(FACTURE_MARTINS));
    await traiterPiecesEnAttente(ctx);
    await ranger(ctx, envoi.id);
    await vieillir(ctx, envoi.id, ANNULER_PENDANT_MS + 1000);
    assert.equal(await envoiEnCours(ctx), null, "la bande « documents rangés » reste après ses six secondes");
  });

  await essai("un rangement partiel, ses six secondes passées : l'état dit ce qui RESTE, et l'import le reprend", async () => {
    const { ctx, envoi, tilleuls } = await rangementPartiel("Essai restes");
    await vieillir(ctx, envoi.id, ANNULER_PENDANT_MS + 1000);
    const etat = await envoiEnCours(ctx);
    assert.ok(etat, "l'envoi a disparu : la pièce sans nom n'a plus de porte");
    assert.equal(etat.annulableMs, null, "« Annuler » est encore proposé après six secondes");
    assert.deepEqual(
      { attendues: etat.attendues, recues: etat.recues, lues: etat.lues, aVerifier: etat.aVerifier, pretes: etat.pretes },
      { attendues: 1, recues: 1, lues: 1, aVerifier: 1, pretes: 0 },
      "les comptes de la bande ne disent pas ce qui reste"
    );
    assert.equal(envoiAReprendre(etat), etat.id, "l'écran d'import ne reprend pas ce qui reste");
    assert.deepEqual((await piecesLuesDeLEnvoi(ctx, etat.id)).map((p) => p.id), [tilleuls.id]);
  });

  await essai("un second rangement, puis « Annuler » : seul le second est défait", async () => {
    const { ctx, envoi, tilleuls } = await rangementPartiel("Essai second rangement");
    await vieillir(ctx, envoi.id, ANNULER_PENDANT_MS + 1000);
    const reste = await envoiEnCours(ctx);
    const r = await ranger(ctx, reste!.id, { tapes: { [tilleuls.id]: "SARL Les Tilleuls" } });
    assert.equal(r.rangees, 1, "la pièce restée ne se range pas une fois son nom tapé");

    const etat = await envoiEnCours(ctx);
    assert.equal(etat?.rangees, 1, "« N documents rangés » compte aussi le premier rangement");
    assert.ok(etat.annulableMs !== null, "le second rangement ne propose pas « Annuler »");
    assert.deepEqual(await piecesParFiche(ctx), { [MARTINS_RANGE]: 1, "Mme Lenoir": 1, "SARL Les Tilleuls": 1 });

    assert.deepEqual(await annulerRangement(ctx, etat.id), { ok: true });
    assert.deepEqual(
      await piecesParFiche(ctx),
      { [MARTINS_RANGE]: 1, "Mme Lenoir": 1 },
      "« Annuler » a défait le premier rangement avec le second, ou gardé la fiche du second"
    );
    const apres = await envoiEnCours(ctx);
    assert.equal(apres?.annulableMs, null);
    assert.equal(apres.recues, 1, "la bande ne dit pas la pièce revenue à ranger");
    assert.deepEqual((await piecesLuesDeLEnvoi(ctx, apres.id)).map((p) => p.id), [tilleuls.id], "la pièce du second rangement n'est pas revenue à ranger");
  });

  await essai("« Annuler » se refuse passé sa fenêtre, et le dit ; la marge du réseau prend l'appui parti à temps", async () => {
    const aTemps = await rangementPartiel("Essai marge");
    await vieillir(aTemps.ctx, aTemps.envoi.id, ANNULER_PENDANT_MS + MARGE_RESEAU_ANNULER_MS / 2);
    assert.deepEqual(await annulerRangement(aTemps.ctx, aTemps.envoi.id), { ok: true }, "l'appui parti dans les six secondes est refusé");

    const tard = await rangementPartiel("Essai trop tard");
    await vieillir(tard.ctx, tard.envoi.id, ANNULER_PENDANT_MS + MARGE_RESEAU_ANNULER_MS + 1000);
    assert.deepEqual(await annulerRangement(tard.ctx, tard.envoi.id), { ok: false, pourquoi: "plus-annulable" });
    assert.deepEqual(await piecesParFiche(tard.ctx), { [MARTINS_RANGE]: 1, "Mme Lenoir": 1 }, "un « Annuler » refusé a quand même défait le rangement");
  });

  await essai("un envoi neuf emporte ce qui reste du précédent, et « Annuler » derrière lui se refuse", async () => {
    // Dans les six secondes, un second onglet ouvre un autre envoi : reprendre
    // l'envoi rangé lui ferait porter deux rangements, et le laisser derrière
    // rendrait sa pièce restée introuvable.
    const { ctx, envoi, tilleuls } = await rangementPartiel("Essai envoi suivant");
    const neuf = await creerEnvoi(ctx, "autre.zip", 4);
    assert.notEqual(neuf.id, envoi.id, "un envoi déjà rangé a été repris");
    assert.deepEqual((await piecesLuesDeLEnvoi(ctx, neuf.id)).map((p) => p.id), [tilleuls.id], "ce qui restait n'a pas suivi l'envoi neuf");
    const etat = await envoiEnCours(ctx);
    assert.equal(etat?.id, neuf.id);
    assert.equal(etat.attendues, 5, "l'envoi neuf n'attend pas ce qui restait plus ce qu'il annonce");
    assert.deepEqual(
      await annulerRangement(ctx, envoi.id),
      { ok: false, pourquoi: "plus-annulable" },
      "« Annuler » derrière un envoi plus récent rendrait des pièces sans écran"
    );
    assert.deepEqual(await piecesParFiche(ctx), { [MARTINS_RANGE]: 1, "Mme Lenoir": 1 });
  });

  await essai("un client du rangement supprimé : ce qui reste ne passe pas pour un envoi coupé", async () => {
    // Trouvé par la suite navigateur : la fiche supprimée emporte ses pièces
    // rangées, et « 3 attendues, 1 reçue » se lisait « Envoi interrompu ».
    const { ctx, envoi, tilleuls } = await rangementPartiel("Essai client supprimé");
    await vieillir(ctx, envoi.id, ANNULER_PENDANT_MS + 1000);
    for (const c of await tousLesClients(ctx)) await effacerClient(ctx, c.id);
    const etat = await envoiEnCours(ctx);
    assert.deepEqual({ attendues: etat?.attendues, recues: etat?.recues }, { attendues: 1, recues: 1 }, "ce qui reste passe pour un envoi coupé");
    assert.equal(envoiAReprendre(etat), etat!.id, "l'import ne reprend plus ce qui reste");
    assert.deepEqual((await piecesLuesDeLEnvoi(ctx, etat!.id)).map((p) => p.id), [tilleuls.id]);
  });

  await essai("un tableau qui a emporté ce qui reste s'annule, et ce qui reste se reprend", async () => {
    const { ctx, envoi, tilleuls } = await rangementPartiel("Essai tableau annulé");
    await vieillir(ctx, envoi.id, ANNULER_PENDANT_MS + 1000);
    const bilan = await rangerTableau(ctx, "t.csv", [
      {
        existant: null,
        nom: "M. Tableau",
        adresse: null,
        telephone: null,
        // Deux lignes pour un seul reste : l'attente du tableau ne doit pas lui être prêtée.
        pieces: [
          { rang: 0, genre: "facture", numero: "T-0002", objet: null, jour: "2025-01-10", montant: "90.00", nom: "M. Tableau", chantier: null, cle: "t-0002" },
          { rang: 1, genre: "devis", numero: "T-0003", objet: null, jour: "2025-01-11", montant: "120.00", nom: "M. Tableau", chantier: null, cle: "t-0003" },
        ],
      },
    ]);
    assert.deepEqual(await annulerRangement(ctx, bilan.envoiId!), { ok: true });
    const etat = await envoiEnCours(ctx);
    assert.deepEqual(
      { id: etat?.id, attendues: etat?.attendues, recues: etat?.recues },
      { id: bilan.envoiId, attendues: 1, recues: 1 },
      "ce qui restait passe pour un envoi coupé une fois le tableau annulé"
    );
    assert.equal(envoiAReprendre(etat), bilan.envoiId);
    assert.deepEqual((await piecesLuesDeLEnvoi(ctx, bilan.envoiId!)).map((p) => p.id), [tilleuls.id]);
    assert.deepEqual(await piecesParFiche(ctx), { [MARTINS_RANGE]: 1, "Mme Lenoir": 1 }, "le tableau annulé a laissé sa fiche, ou défait le rangement des PDF");
  });

  await essai("un tableau rangé emporte lui aussi ce qui reste", async () => {
    const { ctx, envoi, tilleuls } = await rangementPartiel("Essai tableau après");
    await vieillir(ctx, envoi.id, ANNULER_PENDANT_MS + 1000);
    const bilan = await rangerTableau(ctx, "t.csv", [
      {
        existant: null,
        nom: "M. Tableau",
        adresse: null,
        telephone: null,
        pieces: [{ rang: 0, genre: "facture", numero: "T-0001", objet: null, jour: "2025-01-10", montant: "90.00", nom: "M. Tableau", chantier: null, cle: "t-0001" }],
      },
    ]);
    assert.ok(bilan.envoiId);
    await vieillir(ctx, bilan.envoiId, ANNULER_PENDANT_MS + 1000);
    const etat = await envoiEnCours(ctx);
    assert.equal(etat?.id, bilan.envoiId);
    assert.equal(envoiAReprendre(etat), bilan.envoiId, "la pièce restée n'a plus de porte une fois le tableau rangé");
    assert.deepEqual((await piecesLuesDeLEnvoi(ctx, bilan.envoiId)).map((p) => p.id), [tilleuls.id]);
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
