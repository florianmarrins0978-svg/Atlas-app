import assert from "node:assert";
import { pool } from "../src/server/db/client";
import * as entreprisesRepo from "../src/server/repositories/entreprises";
import * as chantiersRepo from "../src/server/repositories/chantiers";
import * as lignesPrixRepo from "../src/server/repositories/lignes-prix";
import * as devisRepo from "../src/server/repositories/devis";

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

async function main() {
  await pool.query(`
    TRUNCATE TABLE
      lignes_devis, devis, lignes_prix, photos, notes_vocales, fichiers_a_purger,
      materiel, prestations, chantiers, clients, tarifs,
      entreprise_compteurs, membres_entreprise, entreprises, users
    RESTART IDENTITY CASCADE
  `);

  const { entreprise: entA, utilisateurId: userA } = await entreprisesRepo.creerEntreprise(
    { nom: "Entreprise Devis A" },
    { email: "devis-a@test.local", nom: "A" }
  );
  const A = { entrepriseId: entA.id, utilisateurId: userA };
  const { entreprise: entB, utilisateurId: userB } = await entreprisesRepo.creerEntreprise(
    { nom: "Entreprise Devis B" },
    { email: "devis-b@test.local", nom: "B" }
  );
  const B = { entrepriseId: entB.id, utilisateurId: userB };

  const chantier = await chantiersRepo.creerChantier(A, { nom: "Chantier devis" });
  await lignesPrixRepo.ajouterLignePrix(A, chantier.id, "Main d'œuvre", "1120.00");
  await lignesPrixRepo.ajouterLignePrix(A, chantier.id, "Dépose carrelage", "144.00");
  await lignesPrixRepo.ajouterLignePrix(A, chantier.id, "Forfait déplacement", "35.10");

  let devisId: string;
  let numeroCommercial: string;

  await test("Création du brouillon : totaux HT/TVA/TTC exacts (Decimal)", async () => {
    const d = await devisRepo.getOuCreerDevisBrouillon(A, chantier.id);
    devisId = d.id;
    numeroCommercial = d.numeroCommercial;
    assert.equal(d.statut, "brouillon");
    assert.equal(d.totalHt, "1299.10");
    assert.equal(d.totalTva, "259.82"); // 1299.10 * 20% = 259.82 exactement
    assert.equal(d.totalTtc, "1558.92");
  });

  await test("Instantané des lignes : libellé/quantité/prix unitaire/montant copiés", async () => {
    const lignes = await devisRepo.getLignesDevis(A, devisId);
    assert.equal(lignes.length, 3);
    const mo = lignes.find((l) => l.libelle === "Main d'œuvre")!;
    assert.equal(mo.quantite, "1.00");
    assert.equal(mo.prixUnitaire, "1120.00");
    assert.equal(mo.montant, "1120.00");
  });

  await test("Rechargement du brouillon : réutilise le même numéro, ne duplique pas", async () => {
    const d2 = await devisRepo.getOuCreerDevisBrouillon(A, chantier.id);
    assert.equal(d2.id, devisId);
    assert.equal(d2.numeroCommercial, numeroCommercial);
    assert.equal(d2.numeroVersion, 1);
  });

  await test("Régénération du brouillon : modifier les lignes de prix met à jour le devis existant", async () => {
    await lignesPrixRepo.ajouterLignePrix(A, chantier.id, "Ligne ajoutée", "100.00");
    const d = await devisRepo.getOuCreerDevisBrouillon(A, chantier.id);
    assert.equal(d.id, devisId, "Doit rester la même version tant que non envoyée");
    assert.equal(d.totalHt, "1399.10");
    const lignes = await devisRepo.getLignesDevis(A, devisId);
    assert.equal(lignes.length, 4);
  });

  await test("Génération du PDF d'aperçu (brouillon) : octets non vides, en-tête PDF valide", async () => {
    const pdf = await devisRepo.genererPdfPourApercu(A, devisId);
    assert.ok(pdf.length > 100);
    const enTete = Buffer.from(pdf.slice(0, 5)).toString("ascii");
    assert.equal(enTete, "%PDF-");
  });

  await test("Envoi : statut passe à envoye, PDF stocké, chantier.devisEnvoyeAt renseigné", async () => {
    const d = await devisRepo.envoyerDevis(A, devisId);
    assert.equal(d.statut, "envoye");
    assert.ok(d.pdfStorageKey);
    const chantierMaj = await chantiersRepo.getChantier(A, chantier.id);
    assert.ok(chantierMaj?.devisEnvoyeAt);
  });

  await test("chargerDevisPourEcran : retourne le devis envoyé tel quel, sans créer de nouvelle version", async () => {
    const chargeAvant = await devisRepo.chargerDevisPourEcran(A, chantier.id);
    assert.equal(chargeAvant?.id, devisId);
    assert.equal(chargeAvant?.statut, "envoye");
    const chargeApres = await devisRepo.chargerDevisPourEcran(A, chantier.id);
    assert.equal(chargeApres?.id, devisId, "Un second appel ne doit pas créer de nouvelle version");
  });

  await test("Après envoi : getOuCreerDevisBrouillon ouvre une NOUVELLE version (v2), même numéro commercial", async () => {
    const d = await devisRepo.getOuCreerDevisBrouillon(A, chantier.id);
    assert.notEqual(d.id, devisId);
    assert.equal(d.numeroVersion, 2);
    assert.equal(d.numeroCommercial, numeroCommercial);
    assert.equal(d.statut, "brouillon");
  });

  await test("Le devis envoyé (v1) reste inchangé après création de la v2", async () => {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query(`SELECT set_config('app.entreprise_id', $1, true)`, [A.entrepriseId]);
      const { rows } = await client.query(`SELECT statut, total_ht FROM devis WHERE id = $1`, [devisId]);
      assert.equal(rows[0].statut, "envoye");
      assert.equal(rows[0].total_ht, "1399.10");
      await client.query("COMMIT");
    } finally {
      client.release();
    }
  });

  await test("Immuabilité : envoyerDevis refuse un devis déjà envoyé", async () => {
    await assert.rejects(() => devisRepo.envoyerDevis(A, devisId));
  });

  await test("Numérotation atomique : deux créations concurrentes ne produisent jamais le même numéro", async () => {
    const c1 = await chantiersRepo.creerChantier(A, { nom: "Concurrent 1" });
    const c2 = await chantiersRepo.creerChantier(A, { nom: "Concurrent 2" });
    const [d1, d2] = await Promise.all([
      devisRepo.getOuCreerDevisBrouillon(A, c1.id),
      devisRepo.getOuCreerDevisBrouillon(A, c2.id),
    ]);
    assert.notEqual(d1.numeroCommercial, d2.numeroCommercial);
  });

  await test("Isolation : B ne peut pas lire le devis ni les lignes du chantier de A", async () => {
    const d = await devisRepo.getDevisPourChantier(B, chantier.id);
    assert.equal(d, null);
    const lignes = await devisRepo.getLignesDevis(B, devisId);
    assert.equal(lignes.length, 0);
  });

  console.log(`\n${passed} test(s) réussi(s), ${failed} échoué(s).`);
  await pool.end();
  if (failed > 0) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
