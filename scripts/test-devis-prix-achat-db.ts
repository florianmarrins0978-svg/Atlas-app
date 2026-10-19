import assert from "node:assert/strict";
import { pool } from "../src/server/db/client";
import * as entreprisesRepo from "../src/server/repositories/entreprises";
import * as chantiersRepo from "../src/server/repositories/chantiers";
import * as prestationsRepo from "../src/server/repositories/prestations";
import * as tarifsRepo from "../src/server/repositories/tarifs";
import { ajouterMateriel } from "../src/server/repositories/materiel";
import { ajouterPrixAchat, creerSociete, reglerMarge } from "../src/server/repositories/fournisseurs-partenaires";
import { preparerPropositionPrix } from "../src/server/chiffrage/proposition-prix";
import { fermerLimiteur } from "../src/server/rate-limit";
import { nettoyerBase } from "./_test-db";

// **Le devis dicté prend ses prix dans « Fournisseurs et partenaires »**, dans
// SON ordre (« le A », 19 octobre 2026) : son prix de vente, puis achat ×
// marge, puis à chiffrer. Sous `atlas_app`, avec ses chiffres : le sac de
// ciment acheté 8 €, sa marge × 1,30, vendu 12 € quand il a un tarif.

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
    { nom: `Achats ${n}` },
    { email: `devis-achat-${n}-${Date.now()}@t.test` }
  );
  return { entrepriseId: e.id, utilisateurId };
}

async function main() {
  await nettoyerBase();

  await test("sans aucun prix d'achat, le devis reste celui d'hier", async () => {
    const A = await entreprise("hier");
    const c = await chantiersRepo.creerChantier(A, { nom: "Chantier" });
    await ajouterMateriel(A, c.id, "3 sacs de ciment");
    const p = await preparerPropositionPrix(A, c.id);
    assert.equal(p?.origine, "aucun");
    assert.equal(p?.prixPropose, null);
    assert.deepEqual(p?.lignes, []);
  });

  const A = await entreprise("A");
  const pointP = await creerSociete(A, "fournisseur", "Point P");
  await ajouterPrixAchat(A, pointP.id, { nom: "Sac de ciment", unite: "sac", prixHt: "8.00", source: "Tapé le 12/10/2026", releveLe: "2026-10-12" });

  await test("3 sacs de ciment dictés, sans marge : la ligne sort à chiffrer, jamais à zéro", async () => {
    const c = await chantiersRepo.creerChantier(A, { nom: "Sans marge" });
    await ajouterMateriel(A, c.id, "3 sacs de ciment");
    const p = await preparerPropositionPrix(A, c.id);
    assert.equal(p?.prixPropose, null);
  });

  await reglerMarge(A, "materiel", "1.30");

  await test("3 sacs de ciment : 8 € × 3 × 1,30 = 31,20 €, et la source le dit", async () => {
    const c = await chantiersRepo.creerChantier(A, { nom: "Avec marge" });
    await ajouterMateriel(A, c.id, "3 sacs de ciment");
    const p = await preparerPropositionPrix(A, c.id);
    assert.equal(p?.origine, "achat");
    assert.equal(p?.prixPropose, "31.20");
    const l = p!.lignes.find((x) => x.libelle === "3 sacs de ciment");
    assert.equal(l?.montant, "31.20");
    assert.equal(l?.prixUnitaire, "10.40");
    assert.equal(l?.quantite, "3");
    assert.ok(
      p!.explication.calcul.some((x) => x.detail.includes("Acheté 24,00 € chez Point P le 12/10/2026, × 1,30, votre marge sur le matériel.")),
      "la source du prix n'est pas écrite"
    );
  });

  await test("son prix de vente passe TOUJOURS avant : 3 × 12 € = 36 €", async () => {
    await tarifsRepo.creerTarif(A, { intitule: "Sac de ciment", prix: "12.00", unite: "sac" });
    const c = await chantiersRepo.creerChantier(A, { nom: "Avec tarif" });
    await ajouterMateriel(A, c.id, "3 sacs de ciment");
    const p = await preparerPropositionPrix(A, c.id);
    const l = p!.lignes.find((x) => x.libelle === "3 sacs de ciment");
    assert.equal(l?.montant, "36.00");
  });

  await test("un travail à chiffrer prend le prix de main d'œuvre d'un partenaire × sa marge", async () => {
    const pilou = await creerSociete(A, "partenaire", "Pilou");
    await ajouterPrixAchat(A, pilou.id, { nom: "Pose de clôture", unite: "m", prixHt: "10.00", source: "Tapé" });
    await reglerMarge(A, "mainOeuvre", "1.20");
    const c = await chantiersRepo.creerChantier(A, { nom: "Clôture" });
    await prestationsRepo.ajouterPrestation(A, c.id, "Pose de clôture");
    const p = await preparerPropositionPrix(A, c.id);
    const l = p!.lignes.find((x) => /clôture/i.test(x.libelle));
    assert.equal(l?.montant, "12.00");
  });

  await test("les prix d'achat d'une autre entreprise ne chiffrent jamais ses devis", async () => {
    const B = await entreprise("B");
    await reglerMarge(B, "materiel", "1.30");
    const c = await chantiersRepo.creerChantier(B, { nom: "Chez B" });
    await ajouterMateriel(B, c.id, "3 sacs de ciment");
    const p = await preparerPropositionPrix(B, c.id);
    assert.equal(p?.prixPropose, null);
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
