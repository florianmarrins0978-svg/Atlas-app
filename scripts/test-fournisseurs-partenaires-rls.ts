import assert from "node:assert/strict";
import { pool } from "../src/server/db/client";
import * as entreprisesRepo from "../src/server/repositories/entreprises";
import {
  ajouterDevisRecu,
  ajouterPrixAchat,
  creerSociete,
  enregistrerDemande,
  getDevisRecu,
  getSociete,
  lireMarges,
  listerSocietes,
  prixAchatCandidats,
  reglerMarge,
  reglerMargeSociete,
  retirerPrixAchat,
} from "../src/server/repositories/fournisseurs-partenaires";
import { exporterEntreprise } from "../src/server/repositories/export-entreprise";
import { fermerLimiteur } from "../src/server/rate-limit";
import { nettoyerBase } from "./_test-db";

// **Ses fournisseurs et ses partenaires, éprouvés SOUS LE RÔLE APPLICATIF**
// (migration 0132). Ce qu'il paie chez Aqua Plus et la marge qu'il y met sont
// ses secrets de métier : une autre entreprise qui les lirait connaîtrait ses
// prix. Les suites navigateur traversent la RLS (`CLAUDE.md` §5) : seule une
// suite base, sous `atlas_app`, voit ce risque.

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

type Ctx = { utilisateurId: string; entrepriseId: string };

async function contexte(suffixe: string): Promise<Ctx> {
  const { entreprise, utilisateurId } = await entreprisesRepo.creerEntreprise(
    { nom: `Paysage ${suffixe}` },
    { email: `achats-${suffixe}-${Date.now()}@t.test` }
  );
  return { utilisateurId, entrepriseId: entreprise.id };
}

async function main() {
  await nettoyerBase();
  const A = await contexte("A");
  const B = await contexte("B");

  const aqua = await creerSociete(A, "fournisseur", "Aqua Plus");
  const devis = await ajouterDevisRecu(A, aqua.id, {
    nom: "Haie Durand",
    fichierCle: `entreprises/${A.entrepriseId}/devis-recus/d.pdf`,
    fichierNom: "devis.pdf",
    nature: "pdf",
  });
  const prix = await ajouterPrixAchat(A, aqua.id, {
    nom: "Sac de ciment",
    unite: "sac",
    prixHt: "8.00",
    source: "Tapé le 19/10/2026",
    devisRecuId: devis.id,
  });
  await enregistrerDemande(A, aqua.id, {
    titre: "Plan d'arrosage Durand",
    origine: "arrosage",
    lignes: [{ designation: "Turbine 3504", reference: "RA3504", quantite: "9" }],
  });
  await reglerMarge(A, "materiel", "1.30");

  await test("le patron relit sa société, son prix, son devis et sa demande", async () => {
    const [s] = await listerSocietes(A, "fournisseur");
    assert.equal(s.nom, "Aqua Plus");
    assert.equal(s.prix[0].prixHt, "8.00");
    assert.equal(s.devis[0].nom, "Haie Durand");
    assert.equal(s.demandes[0].lignes[0].reference, "RA3504");
    assert.deepEqual(await listerSocietes(A, "partenaire"), []);
  });

  await test("ses marges se relisent, et la seconde n'efface pas la première", async () => {
    await reglerMarge(A, "mainOeuvre", "1.20");
    assert.deepEqual(await lireMarges(A), { materiel: "1.30", mainOeuvre: "1.20" });
  });

  await test("une autre entreprise ne voit ni ses sociétés, ni ses prix, ni ses devis, ni ses marges", async () => {
    assert.deepEqual(await listerSocietes(B, "fournisseur"), []);
    assert.equal(await getSociete(B, aqua.id), undefined);
    assert.equal(await getDevisRecu(B, devis.id), undefined);
    assert.deepEqual(await prixAchatCandidats(B), []);
    assert.deepEqual(await lireMarges(B), { materiel: null, mainOeuvre: null });
  });

  await test("une autre entreprise ne peut ni changer sa marge, ni retirer son prix", async () => {
    assert.equal(await reglerMargeSociete(B, aqua.id, "2.00"), undefined);
    assert.equal(await retirerPrixAchat(B, prix.id), false);
    assert.equal((await getSociete(A, aqua.id))?.marge, null, "la marge a été touchée depuis l'autre entreprise");
  });

  await test("une autre entreprise ne peut pas ranger un prix sous SA société", async () => {
    await assert.rejects(
      ajouterPrixAchat(B, aqua.id, { nom: "Volé", unite: "pièce", prixHt: "1.00", source: "x" }),
      "la clé étrangère seule laisserait passer la société d'une autre entreprise"
    );
  });

  await test("la base refuse une marge au-dessus de × 3, même si l'écran l'oubliait", async () => {
    await assert.rejects(reglerMargeSociete(A, aqua.id, "20.00"));
    await assert.rejects(reglerMarge(A, "materiel", "4.00"));
    assert.equal((await reglerMargeSociete(A, aqua.id, "1.50"))?.marge, "1.50");
  });

  await test("ses prix sortent pour le devis dicté, avec la marge propre de la société", async () => {
    const [c] = await prixAchatCandidats(A);
    assert.equal(c.nom, "Sac de ciment");
    assert.equal(c.societeNom, "Aqua Plus");
    assert.equal(c.rubrique, "fournisseur");
    assert.equal(c.margePropre, "1.50");
    assert.match(c.releveLe, /^\d{2}\/\d{2}\/\d{4}$/);
  });

  await test("un prix retiré ne sert plus au devis", async () => {
    assert.equal(await retirerPrixAchat(A, prix.id), true);
    assert.deepEqual(await prixAchatCandidats(A), []);
  });

  await test("tout part dans la sauvegarde, et le devis reçu sous « Devis reçus »", async () => {
    const e = await exporterEntreprise(A);
    assert.equal(e.tables.societes_achat?.length, 1);
    assert.equal(e.tables.devis_recus?.length, 1);
    assert.equal(e.tables.prix_achat?.length, 1, "un prix retiré reste dans la sauvegarde");
    assert.equal(e.tables.demandes_envoyees?.length, 1);
    assert.equal(e.tables.marges_achat?.length, 1);
    assert.ok(e.fichiers.some((f) => f.storageKey.endsWith("/devis-recus/d.pdf") && f.chemin.startsWith("fichiers/Devis reçus/")));
    const eB = await exporterEntreprise(B);
    assert.equal(eB.tables.societes_achat?.length, 0, "la société de A est dans l'export de B");
  });

  console.log(`\n${passed} test(s) réussi(s), ${failed} échoué(s).`);
  await fermerLimiteur();
  await pool.end();
  if (failed > 0) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
