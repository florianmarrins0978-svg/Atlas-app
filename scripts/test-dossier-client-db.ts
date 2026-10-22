import assert from "node:assert/strict";
import { pool } from "../src/server/db/client";
import { nettoyerBase } from "./_test-db";
import { creerEntreprise } from "../src/server/repositories/entreprises";
import { creerChantier } from "../src/server/repositories/chantiers";
import { creerClient } from "../src/server/repositories/clients";
import { ajouterLignePrix } from "../src/server/repositories/lignes-prix";
import { getOuCreerDevisBrouillon, envoyerDevis } from "../src/server/repositories/devis";
import { terminerChantier, emettreFacture, getFacturePourChantier } from "../src/server/repositories/factures";
import { chargerFicheClient } from "../src/server/repositories/fiche-client";
import { sourcesDuDossier } from "../src/server/repositories/dossier-client";
import { ajouterPrestation as ajouterPrestationEntretien } from "../src/server/repositories/prestations-entretien";
import {
  ouvrirPassage,
  lirePassage,
  cocherLigne,
  nommerClient,
  figerPassage,
  lireRapportParJeton,
} from "../src/server/repositories/passages-entretien";
import { lireObjet } from "../src/server/storage";
import { piecesOuvertes, type PieceDuDossier } from "../src/lib/dossier-du-client";

// « Tout télécharger » d'un client, EN BASE et sous `atlas_app` — 22 octobre
// 2026.
//
// **Pourquoi une suite base, en plus de la suite navigateur.** Les suites
// navigateur tournent sous un rôle qui traverse la RLS (`CLAUDE.md` §5) : elles
// ne verraient pas un dossier qui livrerait les pièces d'une autre entreprise.
// Ici, la RLS est vraie.
//
// Le montage passe par le vrai parcours (envoyer, émettre, figer) : c'est lui
// qui archive les PDF et pose le jeton, et c'est cela que le dossier remet.

let echecs = 0;
async function essai(nom: string, fn: () => Promise<void>) {
  try {
    await fn();
    console.log(`  ✓ ${nom}`);
  } catch (e) {
    echecs++;
    console.log(`  ✗ ${nom}`);
    console.log(`    ${(e as Error).message}`);
  }
}

async function monterEntreprise(nom: string) {
  const { entreprise, utilisateurId } = await creerEntreprise(
    { nom },
    { email: `dc-${Math.random().toString(36).slice(2)}@essai.local`, nom: "Patron" }
  );
  return { utilisateurId, entrepriseId: entreprise.id };
}

type Ctx = { utilisateurId: string; entrepriseId: string };

async function dossierMonte(ctx: Ctx) {
  const client = await creerClient(ctx, { nom: "M. Bernard" });

  const c = await creerChantier(ctx, { nom: "Taille", clientId: client.id });
  await ajouterLignePrix(ctx, c.id, "Taille de haie", "300.00");
  const d = await getOuCreerDevisBrouillon(ctx, c.id);
  await envoyerDevis(ctx, d.id);
  await terminerChantier(ctx, c.id);
  const f = await getFacturePourChantier(ctx, c.id);
  await emettreFacture(ctx, f!.facture.id);

  await ajouterPrestationEntretien(ctx, { famille: "Pelouse", libelle: "Tonte" });
  const ouvert = await ouvrirPassage(ctx, "2026-07-04");
  assert.ok(ouvert.ok, "la fiche d'entretien n'a pas pu s'ouvrir");
  const passage = await lirePassage(ctx, ouvert.id);
  await cocherLigne(ctx, ouvert.id, passage!.lignes[0].id, true);
  await nommerClient(ctx, ouvert.id, client.id);
  const fige = await figerPassage(ctx, ouvert.id);
  assert.ok(fige.ok, "la fiche d'entretien n'est pas partie");

  const fiche = await chargerFicheClient(ctx, client.id);
  assert.ok(fiche, "la fiche du client est introuvable");
  const { devis, factures, fiches, avoirs } = fiche.pieces;
  const pieces: PieceDuDossier[] = piecesOuvertes("proprietaire", [
    ...devis.map((piece) => ({ registre: "devis" as const, piece })),
    ...factures.map((piece) => ({ registre: "factures" as const, piece })),
    ...fiches.map((piece) => ({ registre: "fiches" as const, piece })),
    ...avoirs.map((piece) => ({ registre: "avoirs" as const, piece })),
  ]);
  // Le montage doit savoir se plaindre : sans pièces, tout le reste passerait
  // au vert sur un dossier vide (`CLAUDE.md` §5, « un contrôle qui mesure zéro »).
  assert.deepEqual(
    pieces.map((p) => p.registre),
    ["devis", "factures", "fiches"],
    "le montage n'a pas produit un devis, une facture et une fiche"
  );
  return { pieces, brouillonId: d.id };
}

async function main() {
  console.log("=== Tout télécharger d'un client, en base ===\n");

  await essai("chaque pièce a sa source : le PDF archivé, ou le jeton du rapport", async () => {
    await nettoyerBase();
    const ctx = await monterEntreprise("Essai dossier");
    const { pieces } = await dossierMonte(ctx);
    const sources = await sourcesDuDossier(ctx, pieces);

    for (const p of pieces) {
      const source = sources.get(p.piece.id);
      assert.ok(source, `aucune source pour la pièce ${p.registre} ${p.piece.titre}`);
      if ("cle" in source) {
        const octets = await lireObjet(source.cle);
        assert.equal(Buffer.from(octets).subarray(0, 5).toString("latin1"), "%PDF-", `${p.registre} : ce n'est pas un PDF`);
      } else {
        const rapport = await lireRapportParJeton(source.jeton);
        assert.ok(rapport, "le jeton de la fiche ne rouvre pas son rapport");
        assert.equal(rapport.faites.length, 1, "le rapport ne porte pas la seule ligne cochée");
      }
    }
  });

  await essai("une AUTRE entreprise ne tire rien des mêmes identifiants", async () => {
    await nettoyerBase();
    const a = await monterEntreprise("Entreprise A");
    const b = await monterEntreprise("Entreprise B");
    const { pieces } = await dossierMonte(a);
    const sources = await sourcesDuDossier(b, pieces);
    assert.equal(sources.size, 0, `l'entreprise B lit ${sources.size} pièce(s) de l'entreprise A`);
  });

  await essai("un devis qui n'est pas parti n'a pas de source", async () => {
    await nettoyerBase();
    const ctx = await monterEntreprise("Essai brouillon");
    const client = await creerClient(ctx, { nom: "Mme Lenoir" });
    const c = await creerChantier(ctx, { nom: "Élagage", clientId: client.id });
    await ajouterLignePrix(ctx, c.id, "Élagage", "450.00");
    const d = await getOuCreerDevisBrouillon(ctx, c.id);
    const sources = await sourcesDuDossier(ctx, [
      { registre: "devis", piece: { id: d.id, titre: "n° 2026-0001", jour: null, precision: null, href: `/api/devis/${d.id}/pdf` } },
    ]);
    assert.equal(sources.size, 0, "un brouillon partirait dans le dossier du client");
  });

  await pool.end();
  if (echecs > 0) {
    console.log(`\n✗ ${echecs} échec(s)`);
    process.exit(1);
  }
  console.log("\n✅ Le dossier ne remet que des pièces parties, et de la bonne entreprise.");
}

main().catch(async (e) => {
  console.error(e);
  await pool.end();
  process.exit(1);
});
