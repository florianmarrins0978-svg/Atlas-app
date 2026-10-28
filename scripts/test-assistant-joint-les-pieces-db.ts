import assert from "node:assert/strict";
import { pool } from "../src/server/db/client";
import { nettoyerBase } from "./_test-db";
import { creerEntreprise } from "../src/server/repositories/entreprises";
import { creerChantier } from "../src/server/repositories/chantiers";
import { creerClient } from "../src/server/repositories/clients";
import { ajouterLignePrix } from "../src/server/repositories/lignes-prix";
import { getOuCreerDevisBrouillon, envoyerDevis } from "../src/server/repositories/devis";
import { terminerChantier, emettreFacture, getFacturePourChantier } from "../src/server/repositories/factures";
import { creerAchatTva, photoDuTicket } from "../src/server/repositories/achats-tva";
import { ajouterPhoto } from "../src/server/repositories/photos";
import { poserQuestion } from "../src/server/ai/services/assistant-service";
import { getOutil } from "../src/server/ai/tools/registre";
import { _reinitialiserFabriqueLLM } from "../src/server/ai/providers/llm/fabrique";
import { unAppel, type FournisseurLLM } from "../src/server/ai/providers/llm/interface";
import { fermerLimiteur } from "../src/server/rate-limit";
import { fichierAccepteParLaVisionneuse } from "../src/lib/visionneuse-pdf";

/**
 * L'ASSISTANT JOINT LE DOCUMENT QU'IL A TROUVÉ, sous la RLS.
 *
 * **Sa demande du 27 octobre 2026 :** la ligne « coupe de cheveux » trouvée
 * dans le devis de Bernard, avec le PDF du devis à toucher ; et pareil pour la
 * facture, le ticket de carburant, le ticket de restaurant, le bilan, les
 * photos. Planche B.
 *
 * Ce que cette suite défend, par le chemin du patron (une question, un modèle,
 * des outils, une réponse) et non par une porte de service (`CLAUDE.md`
 * §5 quater) :
 * - la pièce rendue ouvre LE devis où la ligne est écrite ;
 * - le modèle n'a jamais vu d'adresse, et une clé qu'il invente ne mène à rien ;
 * - un ticket se relit par l'identifiant de l'achat, jamais chez le voisin ;
 * - un ticket saisi à la main n'a rien à joindre.
 */

let echecs = 0;
async function cas(nom: string, verifier: () => Promise<void>) {
  try {
    await verifier();
    console.log(`  ✓ ${nom}`);
  } catch (e) {
    echecs++;
    console.log(`  ✗ ${nom}`);
    console.log(`    ${(e as Error).message}`);
  }
}

type Ctx = { utilisateurId: string; entrepriseId: string };

async function monterEntreprise(nom: string): Promise<Ctx> {
  const { entreprise, utilisateurId } = await creerEntreprise(
    { nom },
    { email: `pj-${Math.random().toString(36).slice(2)}@essai.local`, nom: "Patron" }
  );
  return { utilisateurId, entrepriseId: entreprise.id };
}

/**
 * Un modèle qui fait ce que fait le vrai : il appelle un outil, lit la clé de
 * la pièce dans le résultat, et la cite. Il cite aussi une clé qu'il invente.
 */
function modeleQuiCite(outil: string, parametres: Record<string, unknown>, vu: { resultat?: unknown }): FournisseurLLM {
  return {
    nom: "essai",
    async genererTexte() {
      return { succes: true, texte: "" };
    },
    async genererAvecOutils(_systeme, historique) {
      const dernier = historique[historique.length - 1];
      if (dernier?.role !== "outil") return unAppel(outil, parametres);
      vu.resultat = dernier.resultat;
      const cles = [...JSON.stringify(dernier.resultat).matchAll(/"piece":"(P\d+)"/g)].map((m) => m[1]);
      return { succes: true, type: "texte", texte: `Trouvé ${cles.map((c) => `[[${c}]]`).join(" ")}. Et [[P99]].` };
    },
  };
}

async function main() {
  await nettoyerBase();
  const A = await monterEntreprise("Paysages A");
  const B = await monterEntreprise("Paysages B");

  const bernard = await creerClient(A, { nom: "M. Bernard" });
  const chantier = await creerChantier(A, { nom: "Jardin Bernard", clientId: bernard.id });
  await ajouterLignePrix(A, chantier.id, "Coupe de cheveux", "25.00");
  const devis = await getOuCreerDevisBrouillon(A, chantier.id);
  await envoyerDevis(A, devis.id);

  await cas("LA LIGNE TROUVÉE OUVRE LE DEVIS OÙ ELLE EST ÉCRITE", async () => {
    const vu: { resultat?: unknown } = {};
    _reinitialiserFabriqueLLM(modeleQuiCite("RechercherLignesDevis", { motCle: "coupe de cheveux" }, vu));
    try {
      const r = await poserQuestion(A, null, [], "Le devis de Bernard avec la coupe de cheveux");
      assert.equal(r.succes, true, !r.succes ? r.erreur : "");
      if (!r.succes) return;
      assert.equal(r.pieces?.length, 1, "la clé inventée a donné une pièce, ou la vraie n'en a pas donné");
      const piece = r.pieces![0];
      assert.equal(piece.titre, "Coupe de cheveux");
      assert.equal(piece.format, "pdf");
      const fichier = new URLSearchParams(piece.adresse.split("?")[1]).get("fichier");
      assert.equal(fichier, `/api/devis/${devis.id}/pdf`);
      assert.ok(fichierAccepteParLaVisionneuse(fichier ?? undefined), "la visionneuse refuserait ce fichier");
      assert.doesNotMatch(r.texte, /\[\[/, "la clé s'affiche à l'écran");
      assert.doesNotMatch(JSON.stringify(vu.resultat), /\/api\/|\/documents\//, "une adresse est partie au modèle");
    } finally {
      _reinitialiserFabriqueLLM(null);
    }
  });

  await cas("UNE AUTRE ENTREPRISE NE TROUVE PAS LA LIGNE, DONC AUCUNE PIÈCE", async () => {
    const r = (await getOutil("RechercherLignesDevis")!.executer({ ctx: B, chantierId: null }, { motCle: "cheveux" })) as {
      trouve: boolean;
    };
    assert.equal(r.trouve, false);
  });

  await cas("LA FACTURE ÉMISE PORTE SA PIÈCE", async () => {
    await terminerChantier(A, chantier.id);
    const f = await getFacturePourChantier(A, chantier.id);
    await emettreFacture(A, f!.facture.id);
    const r = (await getOutil("LireFactures")!.executer({ ctx: A, chantierId: null }, { client: "Bernard" })) as {
      factures: { piece: { adresse: string; genre: string } }[];
    };
    assert.equal(r.factures[0].piece.genre, "facture");
    assert.match(decodeURIComponent(r.factures[0].piece.adresse), new RegExp(`/api/factures/${f!.facture.id}/pdf`));
  });

  const cleA = `entreprises/${A.entrepriseId}/tickets/essai.jpg`;
  const carburant = await creerAchatTva(A, {
    dateAchat: "2026-10-12",
    fournisseur: "Total Mantes",
    totalTtc: 62.4,
    tvaTicket: 10.4,
    nature: "carburant",
    vehicule: "utilitaire",
    photoCle: cleA,
    saisie: "scan",
  });
  await creerAchatTva(A, {
    dateAchat: "2026-10-13",
    fournisseur: "Le Relais",
    totalTtc: 18,
    tvaTicket: 1.64,
    nature: "repas",
    photoCle: null,
    saisie: "main",
  });

  await cas("LE TICKET DE CARBURANT SE TROUVE ET S'OUVRE PAR L'ACHAT", async () => {
    const r = (await getOutil("RechercherTickets")!.executer(
      { ctx: A, chantierId: null },
      { nature: "carburant", du: "2026-10-01", au: "2026-10-31" }
    )) as { tickets: { commercant: string; piece: { adresse: string; format: string } | null }[] };
    assert.equal(r.tickets.length, 1);
    assert.equal(r.tickets[0].commercant, "Total Mantes");
    assert.equal(r.tickets[0].piece?.adresse, `/termines/tva/ticket/${carburant.id}`);
    assert.equal(r.tickets[0].piece?.format, "photo");
  });

  await cas("UN TICKET SAISI À LA MAIN N'A RIEN À JOINDRE", async () => {
    const r = (await getOutil("RechercherTickets")!.executer(
      { ctx: A, chantierId: null },
      { nature: "repas", du: "2026-10-01", au: "2026-10-31" }
    )) as { tickets: { piece: unknown }[] };
    assert.equal(r.tickets.length, 1);
    assert.equal(r.tickets[0].piece, null);
  });

  await cas("LA PHOTO D'UN TICKET NE SE LIT PAS CHEZ LE VOISIN", async () => {
    assert.equal(await photoDuTicket(A, carburant.id), cleA);
    assert.equal(await photoDuTicket(B, carburant.id), null, "B lit le ticket de A");
  });

  await cas("UNE CLÉ HORS DES TICKETS DE L'ENTREPRISE NE S'OUVRE PAS", async () => {
    const intrus = await creerAchatTva(A, {
      dateAchat: "2026-10-14",
      fournisseur: "Intrus",
      totalTtc: 1,
      tvaTicket: 0,
      nature: "autre",
      photoCle: `entreprises/${B.entrepriseId}/tickets/vole.jpg`,
      saisie: "scan",
    });
    assert.equal(await photoDuTicket(A, intrus.id), null);
  });

  await cas("SANS PÉRIODE, LES DOUZE DERNIERS MOIS, MÊME UN 29 FÉVRIER", async () => {
    const r = (await getOutil("RechercherTickets")!.executer(
      { ctx: A, chantierId: null },
      { au: "2028-02-29" }
    )) as { periode?: { du: string } ; raison?: string };
    // Le 29 février 2027 n'existe pas : la recherche ne doit pas tomber.
    assert.ok(r.raison || r.periode, "la recherche est tombée");
  });

  await cas("LES PHOTOS DU CHANTIER SE JOIGNENT, PAS CHEZ LE VOISIN", async () => {
    await ajouterPhoto(A, chantier.id, {
      storageKey: `entreprises/${A.entrepriseId}/photos/p1.jpg`,
      mimeType: "image/jpeg",
      tailleOctets: 10,
      checksum: "x",
    });
    const r = (await getOutil("LirePhotos")!.executer({ ctx: A, chantierId: chantier.id }, {})) as {
      photos: { piece: { adresse: string } }[];
    };
    assert.equal(r.photos.length, 1);
    assert.equal(r.photos[0].piece.adresse, `/api/fichiers/entreprises/${A.entrepriseId}/photos/p1.jpg`);
    const chezB = (await getOutil("LirePhotos")!.executer({ ctx: B, chantierId: chantier.id }, {})) as { trouve: boolean };
    assert.equal(chezB.trouve, false);
  });

  await cas("SANS BILAN DÉPOSÉ, IL LE DIT", async () => {
    const r = (await getOutil("LireBilans")!.executer({ ctx: A, chantierId: null }, {})) as { trouve: boolean };
    assert.equal(r.trouve, false);
  });

  await fermerLimiteur();
  await pool.end();
  if (echecs > 0) {
    console.log(`\n${echecs} échec(s)`);
    process.exit(1);
  }
  console.log("\nL'assistant joint ce qu'il a trouvé, et rien d'autre.");
}

main().catch(async (e) => {
  console.error(e);
  await pool.end();
  process.exit(1);
});
