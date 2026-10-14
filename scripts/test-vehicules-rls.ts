import assert from "node:assert/strict";
import { pool } from "../src/server/db/client";
import * as entreprisesRepo from "../src/server/repositories/entreprises";
import {
  creerVehicule,
  documentsDuVehicule,
  getVehicule,
  listerVehicules,
  mettreAJourVehicule,
  retirerVehicule,
} from "../src/server/repositories/vehicules";
import { exporterEntreprise } from "../src/server/repositories/export-entreprise";
import { fermerLimiteur } from "../src/server/rate-limit";
import { nettoyerBase } from "./_test-db";

// **Les véhicules d'une entreprise, éprouvés SOUS LE RÔLE APPLICATIF** — sa
// planche du 14 octobre 2026 (migration 0131).
//
// Un véhicule porte un numéro de contrat d'assurance et la copie d'une carte
// grise : un salarié d'une autre entreprise qui les verrait, c'est une fuite de
// papiers d'identité de véhicule. Les suites navigateur traversent la RLS
// (`CLAUDE.md` §5) : seule une suite base, sous `atlas_app`, voit ce risque.

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
    { email: `vehicules-${suffixe}-${Date.now()}@t.test` }
  );
  return { utilisateurId, entrepriseId: entreprise.id };
}

async function main() {
  await nettoyerBase();
  const A = await contexte("A");
  const B = await contexte("B");

  const benne = await creerVehicule(A, "Camion benne");
  await mettreAJourVehicule(A, benne.id, {
    plaque: "GH-412-PK",
    numeroContrat: "40 118 552 07",
    controleTechniqueAvant: "2026-11-30",
    sources: { plaque: "carte_grise", controleTechniqueAvant: "controle_technique" },
    carteGriseCle: `entreprises/${A.entrepriseId}/vehicules/carte.pdf`,
    carteGriseLe: new Date("2026-10-14T10:00:00Z"),
  });

  await test("le patron relit son véhicule, ses dates et la source de chaque case", async () => {
    const v = await getVehicule(A, benne.id);
    assert.equal(v?.plaque, "GH-412-PK");
    assert.equal(v?.controleTechniqueAvant, "2026-11-30");
    assert.deepEqual(v?.sources, { plaque: "carte_grise", controleTechniqueAvant: "controle_technique" });
    assert.deepEqual(
      documentsDuVehicule(v!).map((d) => d.nature),
      ["carte_grise"]
    );
  });

  await test("une autre entreprise ne le voit ni dans sa liste, ni par son identifiant", async () => {
    assert.deepEqual(await listerVehicules(B), []);
    assert.equal(await getVehicule(B, benne.id), undefined);
  });

  await test("une autre entreprise ne peut ni le modifier, ni le retirer", async () => {
    assert.equal(await mettreAJourVehicule(B, benne.id, { numeroContrat: "volé" }), undefined);
    assert.equal(await retirerVehicule(B, benne.id), false);
    const v = await getVehicule(A, benne.id);
    assert.equal(v?.numeroContrat, "40 118 552 07", "la ligne a été touchée depuis l'autre entreprise");
  });

  await test("un véhicule retiré sort de la liste, mais part dans la sauvegarde", async () => {
    assert.equal(await retirerVehicule(A, benne.id), true);
    assert.deepEqual(await listerVehicules(A), []);
    const e = await exporterEntreprise(A);
    assert.equal(e.tables.vehicules?.length, 1, "le véhicule manque à l'export");
    assert.ok(
      e.fichiers.some((f) => f.storageKey.endsWith("/vehicules/carte.pdf") && f.chemin.startsWith("fichiers/Véhicules/")),
      "la carte grise n'est pas rangée sous « Véhicules » dans l'archive"
    );
    const eB = await exporterEntreprise(B);
    assert.equal(eB.tables.vehicules?.length, 0, "le véhicule de A est dans l'export de B");
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
