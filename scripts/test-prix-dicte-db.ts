import assert from "node:assert/strict";
import { pool } from "../src/server/db/client";
import * as entreprisesRepo from "../src/server/repositories/entreprises";
import * as chantiersRepo from "../src/server/repositories/chantiers";
import * as brouillonsRepo from "../src/server/repositories/brouillons-informations";
import * as tarifsRepo from "../src/server/repositories/tarifs";
import { listerLignesPrix } from "../src/server/repositories/lignes-prix";
import { confirmerBrouillon } from "../src/server/ai/services/brouillon-service";
import { extraire } from "../src/server/ai/services/extraction-service";
import { preparerPropositionPrix } from "../src/server/chiffrage/proposition-prix";
import { appliquerPropositionPrix } from "../src/server/chiffrage/appliquer-proposition";
import { brouillonVide, type PropositionExtraction } from "../src/server/ai/schemas/extraction";
import type { FournisseurLLM } from "../src/server/ai/providers/llm/interface";
import { fermerLimiteur } from "../src/server/rate-limit";
import { nettoyerBase } from "./_test-db";

// **Le prix qu'il DICTE arrive sur le devis** — son signalement du 21 octobre
// 2026 : *« j'ai dit taille d'une haie de laurier, j'estime le prix à 500 €.
// Et lorsque j'ai validé la dictée, l'outil n'a pas compris et ne m'a pas mis
// le prix. Il m'a dit qu'il fallait remplir le prix alors que je lui ai
// dicté. »*
//
// La lecture de la dictée n'avait aucune case pour un prix, et sa consigne lui
// interdisait d'en rendre un : le montant prononcé se perdait avant même
// d'arriver au chantier. Sous `atlas_app`, du brouillon jusqu'à la ligne.

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

async function entreprise(n: string) {
  const { entreprise: e, utilisateurId } = await entreprisesRepo.creerEntreprise(
    { nom: `Prix dicté ${n}` },
    { email: `prix-dicte-${n}-${Date.now()}@t.test` }
  );
  return { entrepriseId: e.id, utilisateurId };
}

/** Sa dictée, telle qu'un modèle la rend : une prestation, son prix à lui. */
function saDictee(prix: string | null): PropositionExtraction {
  return {
    ...brouillonVide(),
    prestations: [
      {
        libelle: "Taille d'une haie de laurier",
        description: null,
        quantite: null,
        unite: null,
        nature: "haie",
        espece: "laurier",
        prix,
        aConfirmer: false,
      },
    ],
  };
}

async function chantierDicte(nom: string, prix: string | null) {
  const A = await entreprise(nom);
  const c = await chantiersRepo.creerChantier(A, { nom: "Haie de laurier" });
  await brouillonsRepo.enregistrerGeneration(A, c.id, saDictee(prix), "taille d'une haie de laurier, j'estime le prix à 500 €");
  const confirme = await confirmerBrouillon(A, c.id);
  assert.ok(confirme.succes, "le brouillon se confirme");
  return { A, c };
}

async function main() {
  await nettoyerBase();

  await test("la lecture de la dictée garde le prix qu'il a prononcé", async () => {
    const modele: FournisseurLLM = {
      nom: "essai",
      genererTexte: async () => ({
        succes: true,
        texte: JSON.stringify(saDictee("500")),
      }),
    } as unknown as FournisseurLLM;
    const r = await extraire("taille d'une haie de laurier, j'estime le prix à 500 €", modele);
    assert.ok(r.succes);
    assert.equal(r.proposition.prestations[0].prix, "500");
  });

  await test("« j'estime le prix à 500 € » : la ligne du devis vaut 500 €, elle n'est plus à chiffrer", async () => {
    const { A, c } = await chantierDicte("haie", "500");
    const p = await preparerPropositionPrix(A, c.id);
    assert.equal(Number(p?.prixPropose), 500);
    assert.deepEqual(
      p?.lignes.map((l) => [l.montant, l.quantite, l.prixUnitaire]),
      [["500.00", "1", "500.00"]]
    );
    const appli = await appliquerPropositionPrix(A, c.id);
    assert.ok(appli.succes, appli.succes ? "" : appli.erreur);
    const lignes = await listerLignesPrix(A, c.id);
    assert.equal(lignes.length, 1);
    assert.equal(Number(lignes[0].montant), 500);
    assert.equal(lignes[0].aChiffrer, false);
  });

  await test("son prix dicté passe AVANT un tarif qui répond au même travail", async () => {
    const A = await entreprise("tarif");
    await tarifsRepo.creerTarif(A, { intitule: "Taille d'une haie de laurier", prix: "350" });
    const c = await chantiersRepo.creerChantier(A, { nom: "Haie de laurier" });
    await brouillonsRepo.enregistrerGeneration(A, c.id, saDictee("500"), "dictée");
    assert.ok((await confirmerBrouillon(A, c.id)).succes);
    const p = await preparerPropositionPrix(A, c.id);
    assert.equal(Number(p?.prixPropose), 500, "il a dit 500 pour CE chantier");
  });

  await test("sans prix dicté, rien ne change : la ligne reste à chiffrer, jamais à zéro", async () => {
    const { A, c } = await chantierDicte("sans", null);
    const p = await preparerPropositionPrix(A, c.id);
    assert.equal(p?.prixPropose, null);
  });

  await test("un « prix » qui n'est pas un nombre ne devient jamais un montant", async () => {
    const { A, c } = await chantierDicte("flou", "environ 500");
    const p = await preparerPropositionPrix(A, c.id);
    assert.equal(p?.prixPropose, null);
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
