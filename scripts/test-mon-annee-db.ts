/* =======================================================================
   Mon année, dans la base : l'objectif et l'interrupteur d'une entreprise,
   jamais ceux d'une autre ; les factures émises de l'année et de l'an
   dernier, en HT, et rien d'autre.

   Sa planche du 8 novembre 2026. Les règles pures se jouent dans
   `test-mon-annee.ts` ; ici, ce que seule la base dit, sous `atlas_app`,
   la RLS posée par `withEntreprise`.
   ======================================================================= */
import assert from "node:assert/strict";
import { pool } from "../src/server/db/client";
import { nettoyerBase } from "./_test-db";
import * as entreprisesRepo from "../src/server/repositories/entreprises";
import * as chantiersRepo from "../src/server/repositories/chantiers";
import * as clientsRepo from "../src/server/repositories/clients";
import { ajouterLigneDeFacture, creerFactureSansDevis, emettreFacture, majLigneDeFacture } from "../src/server/repositories/factures";
import { donneesMonAnnee, ecrireObjectif, ecrireSurTermines, porteMonAnnee } from "../src/server/repositories/mon-annee";
import type { Ctx } from "../src/server/repositories/context";

let echecs = 0;
async function essai(nom: string, fn: () => Promise<void> | void) {
  try {
    await fn();
    console.log(`  ✓ ${nom}`);
  } catch (e) {
    echecs++;
    console.log(`  ✗ ${nom}\n    ${(e as Error).message}`);
  }
}

const MAINTENANT = new Date("2026-11-08T10:00:00Z");
const L_AN_DERNIER = new Date("2025-11-08T10:00:00Z");

async function uneEntreprise(nom: string): Promise<Ctx> {
  const { entreprise, utilisateurId } = await entreprisesRepo.creerEntreprise(
    { nom },
    { email: `mon-annee-${Math.random().toString(36).slice(2)}@essai.local`, nom: "Patron" }
  );
  return { utilisateurId, entrepriseId: entreprise.id };
}

let rang = 0;
async function uneFacture(ctx: Ctx, montant: string, quand: Date): Promise<string> {
  rang++;
  const client = await clientsRepo.creerClient(ctx, { nom: `Faucher ${rang}`, civilite: "mr", telephone: `06123456${String(rang).padStart(2, "0")}` });
  const chantier = await chantiersRepo.creerChantier(ctx, { nom: "Taille de haie", adresseChantier: "3 rue des Lilas, 44000 Nantes", clientId: client.id });
  const facture = await creerFactureSansDevis(ctx, chantier.id, quand);
  const ligne = await ajouterLigneDeFacture(ctx, facture.id);
  assert.ok(ligne.ok, ligne.ok ? "" : ligne.raison);
  await majLigneDeFacture(ctx, facture.id, ligne.ligne.id, { libelle: "Taille", quantite: "1", prixUnitaire: montant });
  return facture.id;
}

async function main() {
  await nettoyerBase();
  const eden = await uneEntreprise("Eden Nature");
  const voisine = await uneEntreprise("Jardins Voisins");

  await essai("de base : pas d'objectif, et rien sur Terminés", async () => {
    const d = await donneesMonAnnee(eden, MAINTENANT);
    assert.equal(d.objectif, null);
    assert.equal(d.surTermines, false);
    assert.equal(await porteMonAnnee(eden, MAINTENANT), null);
  });

  await essai("l'objectif se pose, puis se change, pour l'année en cours", async () => {
    await ecrireObjectif(eden, 2026, 30_000_000, null);
    await ecrireObjectif(eden, 2026, 30_000_000, 5_000_000);
    const d = await donneesMonAnnee(eden, MAINTENANT);
    assert.deepEqual(d.objectif, { chiffreAffaires: 30_000_000, benefice: 5_000_000 });
  });

  await essai("la voisine ne voit ni l'objectif ni l'interrupteur d'Eden", async () => {
    await ecrireSurTermines(eden, true);
    const d = await donneesMonAnnee(voisine, MAINTENANT);
    assert.equal(d.objectif, null);
    assert.equal(d.surTermines, false);
    assert.equal(await porteMonAnnee(voisine, MAINTENANT), null);
  });

  await essai("allumé, Terminés reçoit l'objectif ; éteint, plus rien", async () => {
    const porte = await porteMonAnnee(eden, MAINTENANT);
    assert.ok(porte, "la porte manque alors qu'elle est allumée");
    assert.equal(porte.objectif?.chiffreAffaires, 30_000_000);
    await ecrireSurTermines(eden, false);
    assert.equal(await porteMonAnnee(eden, MAINTENANT), null);
  });

  await essai("le chiffre : les factures ÉMISES de l'année et de l'an dernier, en HT, de cette entreprise", async () => {
    await emettreFacture(eden, await uneFacture(eden, "1840", MAINTENANT), MAINTENANT);
    await emettreFacture(eden, await uneFacture(eden, "960", L_AN_DERNIER), L_AN_DERNIER);
    await uneFacture(eden, "5000", MAINTENANT); // un brouillon : parti chez personne
    await emettreFacture(voisine, await uneFacture(voisine, "7000", MAINTENANT), MAINTENANT);
    const d = await donneesMonAnnee(eden, MAINTENANT);
    const parAnnee = (a: string) => d.pieces.filter((p) => p.jour.startsWith(a)).reduce((t, p) => t + p.centimes, 0);
    assert.equal(parAnnee("2026"), 184_000);
    assert.equal(parAnnee("2025"), 96_000);
  });

  await essai("la base refuse un objectif nul, même si l'écran l'avait laissé passer", async () => {
    await assert.rejects(() => ecrireObjectif(eden, 2026, 0, null));
  });

  await essai("sans banque reliée, aucune ligne de banque ne se lit", async () => {
    const d = await donneesMonAnnee(eden, MAINTENANT);
    assert.equal(d.banqueReliee, false);
    assert.deepEqual(d.mouvements, []);
  });

  console.log(echecs ? `\n❌ ${echecs} échec(s).` : "\n✅ Mon année ne lit que les chiffres de son entreprise.");
  await pool.end();
  if (echecs) process.exit(1);
}

main().catch(async (e) => {
  console.error(e);
  await pool.end();
  process.exit(1);
});
