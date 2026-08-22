import assert from "node:assert";
import { pool } from "../src/server/db/client";
import * as entreprisesRepo from "../src/server/repositories/entreprises";
import * as achatsRepo from "../src/server/repositories/achats-tva";
import { nettoyerBase } from "./_test-db";

// Les achats et leur TVA, en base — et l'isolation qui les sépare.
//
// **Pourquoi cette suite compte plus que la moyenne.** Les tickets d'un artisan
// disent où il fait le plein, ce qu'il achète et quand il travaille. Une fuite
// ici n'est pas une gêne d'affichage : c'est son carnet de route chez le
// voisin.

let passed = 0;
let failed = 0;
async function test(nom: string, fn: () => Promise<void>) {
  try { await fn(); console.log(`✅ ${nom}`); passed++; }
  catch (err) { console.error(`❌ ${nom}`); console.error(`   ${err instanceof Error ? err.message : err}`); failed++; }
}

async function main() {
  await nettoyerBase();

  const { entreprise: entA, utilisateurId: userA } = await entreprisesRepo.creerEntreprise(
    { nom: "Entreprise Achats A" }, { email: "achats-a@test.local", nom: "A" }
  );
  const A = { entrepriseId: entA.id, utilisateurId: userA };
  const { entreprise: entB, utilisateurId: userB } = await entreprisesRepo.creerEntreprise(
    { nom: "Entreprise Achats B" }, { email: "achats-b@test.local", nom: "B" }
  );
  const B = { entrepriseId: entB.id, utilisateurId: userB };

  await test("Un achat scanné s'enregistre avec ce qui a été confirmé", async () => {
    const a = await achatsRepo.creerAchatTva(A, {
      dateAchat: "2026-08-12",
      fournisseur: "Station Total — Pessac",
      totalTtc: 96,
      tauxTva: 20,
      tvaDeductible: 16,
      photoCle: "tickets/abc.jpg",
      saisie: "scan",
    });
    assert.ok(a);
    assert.equal(a.tvaDeductible, "16.00");
    assert.equal(a.saisie, "scan");
    assert.equal(a.photoCle, "tickets/abc.jpg");
  });

  // **Le fournisseur et la TVA suffisent.** Un ticket qui n'affiche qu'une
  // ligne « TVA 3,20 € » doit pouvoir entrer : exiger le total reviendrait à
  // refuser l'achat, donc à lui faire perdre la TVA.
  await test("Un achat écrit à la main tient sans total ni taux", async () => {
    const a = await achatsRepo.creerAchatTva(A, {
      dateAchat: "2026-08-08",
      fournisseur: "Espace Émeraude",
      tvaDeductible: 13,
      saisie: "main",
    });
    assert.ok(a);
    assert.equal(a.totalTtc, null);
    assert.equal(a.tauxTva, null);
    assert.equal(a.photoCle, null);
  });

  await test("Le total déductible d'une période est compté par la base", async () => {
    const total = await achatsRepo.totalTvaDeductible(A, "2026-08-01", "2026-08-31");
    assert.equal(total, 29);
  });

  // **Bornes INCLUSES des deux côtés.** Un intervalle ouvert à droite perdrait
  // le dernier jour de chaque mois — douze jours par an, et personne ne s'en
  // apercevrait avant de comparer avec le comptable.
  await test("Un achat du dernier jour du mois appartient à ce mois", async () => {
    await achatsRepo.creerAchatTva(A, {
      dateAchat: "2026-08-31", fournisseur: "Dernier jour", tvaDeductible: 5, saisie: "main",
    });
    await achatsRepo.creerAchatTva(A, {
      dateAchat: "2026-09-01", fournisseur: "Mois suivant", tvaDeductible: 100, saisie: "main",
    });
    assert.equal(await achatsRepo.totalTvaDeductible(A, "2026-08-01", "2026-08-31"), 34);
    assert.equal(await achatsRepo.totalTvaDeductible(A, "2026-09-01", "2026-09-30"), 100);
  });

  await test("Une période sans achat rend zéro, jamais rien", async () => {
    const total = await achatsRepo.totalTvaDeductible(A, "2025-01-01", "2025-01-31");
    assert.equal(total, 0, "un total nul doit être 0 — l'écran soustrairait sinon du vide");
  });

  await test("La liste rend les achats de la période, du plus récent au plus ancien", async () => {
    const liste = await achatsRepo.listerAchatsTva(A, "2026-08-01", "2026-08-31");
    assert.equal(liste.length, 3);
    assert.equal(liste[0].dateAchat, "2026-08-31");
    assert.equal(liste[liste.length - 1].dateAchat, "2026-08-08");
  });

  await test("Un achat retiré quitte la liste ET le total", async () => {
    const liste = await achatsRepo.listerAchatsTva(A, "2026-08-01", "2026-08-31");
    const retire = await achatsRepo.supprimerAchatTva(A, liste[0].id);
    assert.ok(retire);
    assert.equal((await achatsRepo.listerAchatsTva(A, "2026-08-01", "2026-08-31")).length, 2);
    assert.equal(await achatsRepo.totalTvaDeductible(A, "2026-08-01", "2026-08-31"), 29);
  });

  await test("Isolation : B ne voit aucun achat de A", async () => {
    assert.equal((await achatsRepo.listerAchatsTva(B, "2026-08-01", "2026-08-31")).length, 0);
    assert.equal(await achatsRepo.totalTvaDeductible(B, "2026-08-01", "2026-08-31"), 0);
  });

  await test("Isolation : B ne peut pas retirer un achat de A", async () => {
    const liste = await achatsRepo.listerAchatsTva(A, "2026-08-01", "2026-08-31");
    const resultat = await achatsRepo.supprimerAchatTva(B, liste[0].id);
    assert.equal(resultat, undefined, "la RLS doit filtrer en silence, sans exception");
    assert.equal((await achatsRepo.listerAchatsTva(A, "2026-08-01", "2026-08-31")).length, 2);
  });

  // La base refuse ce que la règle interdit : une TVA déductible négative n'est
  // pas un achat, c'est un avoir — et un avoir se saisit ailleurs.
  await test("Une TVA déductible négative est refusée par la base", async () => {
    let leve = false;
    try {
      await achatsRepo.creerAchatTva(A, {
        dateAchat: "2026-08-12", fournisseur: "Négatif", tvaDeductible: -5, saisie: "main",
      });
    } catch { leve = true; }
    assert.ok(leve, "la contrainte doit refuser un montant négatif");
  });

  console.log(`\n${passed} test(s) réussi(s), ${failed} échoué(s).`);
  await pool.end();
  if (failed > 0) process.exit(1);
}

main().catch((err) => { console.error(err); process.exit(1); });
