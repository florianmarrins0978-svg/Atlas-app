import assert from "node:assert/strict";
import { pool } from "../src/server/db/client";
import * as entreprisesRepo from "../src/server/repositories/entreprises";
import { ajouterMouvements, type MouvementEnBase } from "../src/server/repositories/banque";
import { getOutil } from "../src/server/ai/tools/registre";
import { fermerLimiteur } from "../src/server/rate-limit";
import { nettoyerBase } from "./_test-db";

// **L'ASSISTANT LIT LE RELEVÉ — sa question du 8 novembre 2026** : *« c'est
// normal que quand je lui demande mes entrées et mes sorties de l'année, il me
// les trouve pas ? »* Aucun outil ne lisait la banque. On l'éprouve par la
// porte qu'il emprunte (`getOutil("LireReleve")`, le nom que le modèle appelle),
// sous `atlas_app`, donc sous la RLS : une autre entreprise ne compte pas.

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
    { nom: `Atelier Relevé ${suffixe}` },
    { email: `releve-${suffixe}-${Date.now()}@t.test` }
  );
  return { utilisateurId, entrepriseId: entreprise.id };
}
const ligne = (cle: string, date: string, montant: string, sens: "entree" | "sortie"): MouvementEnBase => ({
  cle,
  date,
  montant,
  sens,
  contrepartie: cle,
  libelle: `${sens === "entree" ? "VIR" : "CB"} ${cle}`,
});

type Reponse = {
  trouve: boolean;
  raison?: string;
  du?: string;
  partielle?: string | null;
  entrees?: string;
  sorties?: string;
  reste?: string;
  parMois?: { mois: string; entrees: string; sorties: string }[];
};
const lire = (ctx: Ctx, p: { du?: string; au?: string }) =>
  getOutil("LireReleve")!.executer({ ctx, chantierId: null }, p) as Promise<Reponse>;
// Les montants s'écrivent avec l'espace fine de l'appli : on compare sans elle.
const sansEspace = (s?: string) => (s ?? "").replace(/\s/g, "");

async function main() {
  await nettoyerBase();
  const ctx = await contexte("a");
  const voisin = await contexte("b");

  await test("sans banque lue, il le dit au lieu d'annoncer zéro", async () => {
    const r = await lire(ctx, { au: "2026-11-08" });
    assert.equal(r.trouve, false);
    assert.match(r.raison ?? "", /Aucune ligne de banque/);
  });

  // La banque n'a donné que depuis le 12 août (90 jours d'historique).
  await ajouterMouvements(ctx, [
    ligne("CARBU", "2026-08-12", "62.40", "sortie"),
    ligne("CLIENT1", "2026-09-03", "1200.00", "entree"),
    ligne("KILOU", "2026-10-16", "1194.00", "sortie"),
    ligne("CLIENT2", "2026-10-21", "500.00", "entree"),
    ligne("REPAS", "2026-11-02", "23.80", "sortie"),
  ]);
  await ajouterMouvements(voisin, [ligne("AUTRE", "2026-10-01", "99999.00", "entree")]);

  await test("l'année se lit depuis le premier jour donné, et la réponse le dit", async () => {
    const r = await lire(ctx, { au: "2026-11-08" });
    assert.equal(r.trouve, true);
    assert.equal(r.du, "2026-08-12", "l'année est comptée avant le premier jour que la banque a donné");
    assert.match(r.partielle ?? "", /12 août 2026/, "rien ne dit que l'année n'est pas complète");
    assert.equal(sansEspace(r.entrees), sansEspace("+1 700,00 €"));
    assert.equal(sansEspace(r.sorties), sansEspace("−1 280,20 €"));
    assert.equal(sansEspace(r.reste), sansEspace("+419,80 €"));
  });

  await test("le détail mois par mois suit le même relevé", async () => {
    const r = await lire(ctx, { au: "2026-11-08" });
    assert.deepEqual(
      r.parMois?.map((m) => m.mois),
      ["Août 2026", "Septembre 2026", "Octobre 2026", "Novembre 2026"]
    );
    const octobre = r.parMois?.find((m) => m.mois === "Octobre 2026");
    assert.equal(sansEspace(octobre?.entrees), sansEspace("+500,00 €"));
    assert.equal(sansEspace(octobre?.sorties), sansEspace("−1 194,00 €"));
  });

  await test("un mois demandé se lit seul, et n'est pas « partiel »", async () => {
    const r = await lire(ctx, { du: "2026-10-01", au: "2026-10-31" });
    assert.equal(r.partielle, null);
    assert.equal(sansEspace(r.entrees), sansEspace("+500,00 €"));
    assert.equal(r.parMois?.length, 1);
  });

  await test("une période avant le premier jour donné se refuse, et dit pourquoi", async () => {
    const r = await lire(ctx, { du: "2026-01-01", au: "2026-03-31" });
    assert.equal(r.trouve, false);
    assert.match(r.raison ?? "", /12 août 2026/);
  });

  await test("les lignes d'une autre entreprise ne comptent jamais", async () => {
    const r = await lire(ctx, { du: "2026-10-01", au: "2026-10-31" });
    assert.ok(!sansEspace(r.entrees).includes("99999"), "le relevé d'une autre entreprise s'est glissé dans le total");
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
