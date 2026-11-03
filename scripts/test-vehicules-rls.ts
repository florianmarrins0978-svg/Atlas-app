import assert from "node:assert/strict";
import { pool } from "../src/server/db/client";
import * as entreprisesRepo from "../src/server/repositories/entreprises";
import {
  creerVehicule,
  documentsDuVehicule,
  getVehicule,
  listerVehicules,
  marquerRappelVehiculeVu,
  mettreAJourVehicule,
  retirerVehicule,
} from "../src/server/repositories/vehicules";
import { rappelsDeLAccueil } from "../src/lib/vehicules";
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

  // **« J'ai vu » sur le rappel d'un contrôle** — sa demande du 3 novembre
  // 2026 (migration 0159). Le jour se donne ici comme l'accueil le donne
  // (`jourIso`), pour éprouver la veille, l'échéance et le lendemain.
  const amarok = await creerVehicule(A, "Volkswagen Amarok");
  await mettreAJourVehicule(A, amarok.id, { controleTechniqueAvant: "2026-11-05", pollutionAvant: "2026-11-05" });
  const controlesDeA = async (jour: string) =>
    rappelsDeLAccueil(await listerVehicules(A), jour)
      .filter((r) => r.vehiculeId === amarok.id)
      .map((r) => `${r.controle}:${r.echeance.ton}:${r.vuPossible ? "vu possible" : "sans vu"}`);

  await test("« J'ai vu » s'enregistre pour la date vue, et la carte part de l'accueil", async () => {
    assert.deepEqual(await marquerRappelVehiculeVu(A, amarok.id, "controle_technique", "2026-11-05", "2026-11-03"), { ok: true });
    assert.equal((await getVehicule(A, amarok.id))?.controleTechniqueVuPour, "2026-11-05");
    assert.deepEqual(await controlesDeA("2026-11-03"), ["pollution:proche:vu possible"]);
    assert.deepEqual(await controlesDeA("2026-11-05"), ["pollution:proche:vu possible"]);
  });

  await test("une autre entreprise ne peut pas le poser sur ce véhicule, et ne voit pas celui de A", async () => {
    const r = await marquerRappelVehiculeVu(B, amarok.id, "pollution", "2026-11-05", "2026-11-03");
    assert.equal(r.ok, false, "B a rangé le rappel d'un véhicule de A");
    assert.equal((await getVehicule(A, amarok.id))?.pollutionVuPour, null, "la ligne de A a été écrite depuis B");
    assert.deepEqual(await listerVehicules(B), []);
  });

  await test("l'échéance dépassée : la carte revient en rouge, et le serveur refuse un nouveau « J'ai vu »", async () => {
    assert.deepEqual(await controlesDeA("2026-11-06"), ["controle_technique:depasse:sans vu", "pollution:depasse:sans vu"]);
    const r = await marquerRappelVehiculeVu(A, amarok.id, "pollution", "2026-11-05", "2026-11-06");
    assert.equal(r.ok, false);
    assert.match(r.ok ? "" : r.raison, /dépassé/);
    assert.equal((await getVehicule(A, amarok.id))?.pollutionVuPour, null);
  });

  await test("une nouvelle date remet le rappel à neuf, et refuse le « J'ai vu » d'un écran resté sur l'ancienne", async () => {
    await mettreAJourVehicule(A, amarok.id, { controleTechniqueAvant: "2028-11-05" });
    assert.deepEqual(await controlesDeA("2028-10-01"), ["pollution:depasse:sans vu", "controle_technique:calme:vu possible"]);
    const r = await marquerRappelVehiculeVu(A, amarok.id, "controle_technique", "2026-11-05", "2026-11-03");
    assert.match(r.ok ? "" : r.raison, /Rechargez/);
    assert.equal((await getVehicule(A, amarok.id))?.controleTechniqueVuPour, "2026-11-05");
  });

  await test("un contrôle inventé ne s'écrit nulle part", async () => {
    const r = await marquerRappelVehiculeVu(A, amarok.id, "vidange", "2026-11-05", "2026-11-03");
    assert.equal(r.ok, false);
  });

  await test("un véhicule retiré sort de la liste, mais part dans la sauvegarde", async () => {
    assert.equal(await retirerVehicule(A, benne.id), true);
    assert.deepEqual((await listerVehicules(A)).map((v) => v.id), [amarok.id]);
    const e = await exporterEntreprise(A);
    assert.equal(e.tables.vehicules?.length, 2, "un véhicule manque à l'export");
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
