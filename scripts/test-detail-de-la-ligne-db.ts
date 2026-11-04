import assert from "node:assert/strict";
import { pool } from "../src/server/db/client";
import * as entreprisesRepo from "../src/server/repositories/entreprises";
import * as chantiersRepo from "../src/server/repositories/chantiers";
import * as brouillonsRepo from "../src/server/repositories/brouillons-informations";
import * as tarifsRepo from "../src/server/repositories/tarifs";
import { listerLignesPrix } from "../src/server/repositories/lignes-prix";
import { listerPrestations } from "../src/server/repositories/prestations";
import { confirmerBrouillon } from "../src/server/ai/services/brouillon-service";
import { extraire } from "../src/server/ai/services/extraction-service";
import { appliquerPropositionPrix } from "../src/server/chiffrage/appliquer-proposition";
import { brouillonVide, type PropositionExtraction } from "../src/server/ai/schemas/extraction";
import type { FournisseurLLM } from "../src/server/ai/providers/llm/interface";
import { fermerLimiteur } from "../src/server/rate-limit";
import { nettoyerBase } from "./_test-db";

// **CE QU'IL DICTE DE LA FAÇON DE FAIRE ARRIVE SOUS LA LIGNE DU DEVIS** — sa
// question du 3 novembre 2026, devant son devis du frêne : *« j'ai parlé de
// rétention, de suppression de bois mort, d'allègement, de rétention de
// grosses charpentières allant vers le voisin. Pourquoi tout ça n'a pas été
// écrit dans la ligne élagage d'un frêne ? »* Planche
// `appli/soignee/devis-detail-ligne.html`, ses choix du 4 novembre.
//
// La lecture de la dictée n'avait aucune case pour la façon de faire, et sa
// « description » mourait à l'insertion. Sous `atlas_app`, du brouillon
// jusqu'à la ligne.

let passed = 0;
let failed = 0;
async function test(nom: string, fn: () => Promise<void>) {
  try {
    await fn();
    console.log(`✅ ${nom}`);
    passed++;
  } catch (err) {
    console.error(`❌ ${nom}`);
    console.error(`   ${err instanceof Error ? err.message : err}`);
    failed++;
  }
}

const DETAIL = "Suppression du bois mort, allègement, rétention des grosses charpentières qui partent vers le voisin.";

async function entreprise(n: string) {
  const { entreprise: e, utilisateurId } = await entreprisesRepo.creerEntreprise(
    { nom: `Détail ${n}` },
    { email: `detail-${n}-${Date.now()}@t.test` }
  );
  return { entrepriseId: e.id, utilisateurId };
}

function saDictee(detail: string | null): PropositionExtraction {
  return {
    ...brouillonVide(),
    prestations: [
      { libelle: "Élagage d'un frêne", description: null, quantite: null, unite: null, nature: null, espece: "frêne", prix: null, detail, aConfirmer: false },
    ],
  };
}

async function chantierDicte(nom: string, detail: string | null) {
  const A = await entreprise(nom);
  await tarifsRepo.creerTarif(A, { intitule: "Élagage d'un frêne", prix: "1000" });
  const c = await chantiersRepo.creerChantier(A, { nom: "Frêne" });
  await brouillonsRepo.enregistrerGeneration(A, c.id, saDictee(detail), "élagage du frêne, euh, rétention, on enlève le bois mort");
  assert.ok((await confirmerBrouillon(A, c.id)).succes, "le brouillon se confirme");
  return { A, c };
}

async function main() {
  await nettoyerBase();

  await test("la lecture de la dictée garde la façon de faire, en une phrase", async () => {
    const modele = {
      nom: "essai",
      genererTexte: async () => ({ succes: true, texte: JSON.stringify(saDictee(DETAIL)) }),
    } as unknown as FournisseurLLM;
    const r = await extraire("élagage du frêne, rétention, bois mort", modele);
    assert.ok(r.succes);
    assert.equal(r.proposition.prestations[0].detail, DETAIL);
  });

  await test("le détail dicté se garde sur la prestation", async () => {
    const { A, c } = await chantierDicte("garde", DETAIL);
    const [p] = await listerPrestations(A, c.id);
    assert.equal(p.detail, DETAIL);
  });

  await test("la ligne du devis porte le nom du tarif, puis le détail dessous", async () => {
    const { A, c } = await chantierDicte("ligne", DETAIL);
    const appli = await appliquerPropositionPrix(A, c.id);
    assert.ok(appli.succes, appli.succes ? "" : appli.erreur);
    const lignes = await listerLignesPrix(A, c.id);
    assert.equal(lignes.length, 1);
    assert.equal(lignes[0].libelle, `Élagage d'un frêne\n${DETAIL}`);
    assert.equal(Number(lignes[0].montant), 1000, "le prix du tarif ne bouge pas");
  });

  await test("rejouer la dictée ne double ni la ligne ni le détail", async () => {
    const { A, c } = await chantierDicte("rejoue", DETAIL);
    assert.ok((await appliquerPropositionPrix(A, c.id)).succes);
    const second = await appliquerPropositionPrix(A, c.id);
    assert.ok(!second.succes && second.dejaAuDetail, "le second appui a écrit une seconde ligne");
    assert.equal((await listerLignesPrix(A, c.id)).length, 1);
  });

  await test("sans détail dicté, la ligne garde son seul nom", async () => {
    const { A, c } = await chantierDicte("sans", null);
    assert.ok((await appliquerPropositionPrix(A, c.id)).succes);
    const [l] = await listerLignesPrix(A, c.id);
    assert.equal(l.libelle, "Élagage d'un frêne");
  });

  console.log(`\n${passed} réussi(s), ${failed} échoué(s)`);
  await fermerLimiteur();
  await pool.end();
  if (failed > 0) process.exit(1);
}

main().catch(async (e) => {
  console.error(e);
  await pool.end();
  process.exit(1);
});
