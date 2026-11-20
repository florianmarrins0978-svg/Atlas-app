import assert from "node:assert/strict";
import { pool } from "../src/server/db/client";
import * as entreprisesRepo from "../src/server/repositories/entreprises";
import * as chantiersRepo from "../src/server/repositories/chantiers";
import * as clientsRepo from "../src/server/repositories/clients";
import { ajouterLignePrix, modifierLignePrix } from "../src/server/repositories/lignes-prix";
import { getLignesDevis, getOuCreerDevisBrouillon } from "../src/server/repositories/devis";
import { exporterClient } from "../src/server/repositories/donnees-client";
import { fermerLimiteur } from "../src/server/rate-limit";
import { nettoyerBase } from "./_test-db";

// **Le prix d'achat qui a chiffré une ligne, pour lui seul** (migration 0188,
// sa planche du 20 novembre 2026, `appli/le-prix-d-une-piece.html`). Sous
// `atlas_app` : la mention se pose avec le prix, tombe quand il retape le
// prix, reste quand il retouche la description, et ne part jamais chez le
// client, ni sur son devis, ni dans l'export de ses données.

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

const MENTION = "Matériaux Garnier, 8,90 € HT le sac";

async function main() {
  await nettoyerBase();
  const { entreprise, utilisateurId } = await entreprisesRepo.creerEntreprise(
    { nom: "Pièces" },
    { email: `achat-retenu-${Date.now()}@t.test` }
  );
  const A = { entrepriseId: entreprise.id, utilisateurId };
  const client = await clientsRepo.creerClient(A, { nom: "Mme Costa", telephone: "0600000000" });
  const chantier = await chantiersRepo.creerChantier(A, { nom: "Terrasse", clientId: client.id });
  const ligne = await ajouterLignePrix(A, chantier.id, "Sac de terreau", "0.00", { quantite: "10" });

  await test("un prix d'achat choisi pose le prix et la mention ensemble", async () => {
    const l = await modifierLignePrix(A, ligne.id, { prixUnitaire: "11.57", unite: "sac" }, { achatRetenu: MENTION });
    assert.equal(l?.prixUnitaire, "11.57");
    assert.equal(l?.montant, "115.70");
    assert.equal(l?.achatRetenu, MENTION);
    assert.equal(l?.aChiffrer, false);
  });

  await test("une description retouchée renvoie le même prix : la mention reste", async () => {
    const l = await modifierLignePrix(A, ligne.id, { libelle: "Sac de terreau horticole", quantite: "10", prixUnitaire: "11.570" });
    assert.equal(l?.achatRetenu, MENTION);
  });

  await test("le devis du client ne porte pas la mention", async () => {
    const devis = await getOuCreerDevisBrouillon(A, chantier.id);
    const lignes = await getLignesDevis(A, devis.id);
    assert.ok(lignes.length > 0, "le devis n'a aucune ligne : rien n'a été vérifié");
    assert.ok(!JSON.stringify(lignes).includes("Garnier"), JSON.stringify(lignes));
  });

  await test("l'export des données de son client ne porte pas la mention", async () => {
    const exporte = await exporterClient(A, client.id);
    assert.ok(exporte, "l'export est vide : rien n'a été vérifié");
    assert.ok(JSON.stringify(exporte).includes("Sac de terreau"), "la ligne n'est pas dans l'export : rien n'a été vérifié");
    assert.ok(!JSON.stringify(exporte).includes("Garnier"), "le fournisseur est parti dans l'export");
  });

  await test("un prix retapé à la main fait tomber la mention", async () => {
    const l = await modifierLignePrix(A, ligne.id, { prixUnitaire: "13" });
    assert.equal(l?.prixUnitaire, "13.00");
    assert.equal(l?.achatRetenu, null);
  });

  await test("un montant posé sur l'écran Prix la fait tomber aussi", async () => {
    await modifierLignePrix(A, ligne.id, { prixUnitaire: "11.57" }, { achatRetenu: MENTION });
    const l = await modifierLignePrix(A, ligne.id, { montant: "120" });
    assert.equal(l?.achatRetenu, null);
  });

  console.log(`\n${passed} réussi(s), ${failed} échoué(s)`);
  await fermerLimiteur();
  await pool.end();
  if (failed > 0) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
