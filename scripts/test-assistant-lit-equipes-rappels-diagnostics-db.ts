import assert from "node:assert/strict";
import { eq } from "drizzle-orm";
import { pool } from "../src/server/db/client";
import { nettoyerBase } from "./_test-db";
import { creerEntreprise } from "../src/server/repositories/entreprises";
import { creerChantier } from "../src/server/repositories/chantiers";
import { assurerEquipeDeRang, nommerEquipe } from "../src/server/repositories/equipes";
import { noterAbsenceEquipe } from "../src/server/repositories/absences-equipe";
import { ecrireReglagesRappels } from "../src/server/repositories/rappels";
import { conclureDiagnostic, ouvrirDiagnostic } from "../src/server/repositories/diagnostics";
import { lireBasePourMoteur } from "../src/server/repositories/fiches-phyto";
import { withEntreprise } from "../src/server/db/with-entreprise";
import { chantiers } from "../src/server/db/schema";
import { getOutil } from "../src/server/ai/tools/registre";
import { jourIso } from "../src/lib/jour";

/**
 * L'ASSISTANT LIT L'ÉQUIPE, LES RAPPELS ET LES DIAGNOSTICS — de son entreprise.
 *
 * **Sa demande du 26 septembre 2026 :** *« nourris-le de tout »*. Ces trois
 * pans de l'application lui étaient invisibles.
 *
 * Ce que cette suite défend, outil par outil : ce qu'il lit est ce que le
 * dépôt de l'écran rend, une absence passée ne revient pas, un diagnostic qui
 * exige une confirmation le dit, et **une autre entreprise ne voit rien** (la
 * suite tourne sous `atlas_app`, soumis à la RLS).
 */

// Les fiches d'essai, chargées par la suite et ne décrivant aucun végétal réel
// (`donnees/phyto/LISEZ-MOI.md`) ; sans cette ligne la base des fiches les écarte.
process.env.ATLAS_FIXTURES_PHYTO = "1";

let echecs = 0;
async function cas(nom: string, verifier: () => Promise<void>) {
  try {
    await verifier();
    console.log(`  ✓ ${nom}`);
  } catch (e) {
    echecs++;
    console.log(`  ✗ ${nom}`);
    console.log(`    ${(e as Error).message}`);
  }
}

type Ctx = { utilisateurId: string; entrepriseId: string };

async function monterEntreprise(nom: string): Promise<Ctx> {
  const { entreprise, utilisateurId } = await creerEntreprise(
    { nom },
    { email: `le-${Math.random().toString(36).slice(2)}@essai.local`, nom: "Patron" }
  );
  return { utilisateurId, entrepriseId: entreprise.id };
}

function decaler(jours: number): string {
  return jourIso(new Date(Date.now() + jours * 86_400_000));
}

async function chargerFixtures() {
  const { execSync } = await import("node:child_process");
  execSync(`npx tsx scripts/importer-fiches-phyto.ts donnees/phyto/fixtures --fixtures`, {
    stdio: "pipe",
    env: {
      ...process.env,
      DATABASE_URL:
        process.env.DATABASE_ADMIN_URL ?? "postgresql://atlas_owner:atlas_owner_ci_pw@localhost:5432/atlas_test",
    },
  });
}

async function lire(nom: string, ctx: Ctx, p: Record<string, unknown> = {}) {
  const outil = getOutil(nom);
  assert.ok(outil, `${nom} n'est pas au registre : l'assistant ne peut pas l'appeler`);
  return (await outil.executer({ ctx, chantierId: null }, outil.schema.parse(p))) as Record<string, unknown>;
}

async function main() {
  await nettoyerBase();
  await chargerFixtures();
  const A = await monterEntreprise("Paysages A");
  const B = await monterEntreprise("Paysages B");

  console.log("=== LireEquipes ===");

  await assurerEquipeDeRang(A, 1);
  await assurerEquipeDeRang(A, 2);
  await nommerEquipe(A, 2, "Équipe de Karim");
  await noterAbsenceEquipe(A, { rang: 2, premierJour: decaler(3), dernierJour: decaler(4), motif: "Formation" });
  await noterAbsenceEquipe(A, { rang: 1, premierJour: decaler(-20), dernierJour: decaler(-18), motif: "Passée" });

  await cas("les équipes et l'absence à venir, avec son motif", async () => {
    const r = (await lire("LireEquipes", A)) as {
      equipes: { rang: number; nom: string | null }[];
      absencesAVenir: { equipeRang: number; motif: string | null; premierJour: string }[];
    };
    assert.deepEqual(r.equipes.map((e) => e.rang).sort(), [1, 2]);
    assert.equal(r.equipes.find((e) => e.rang === 2)?.nom, "Équipe de Karim");
    assert.deepEqual(
      r.absencesAVenir.map((a) => [a.equipeRang, a.motif, a.premierJour]),
      [[2, "Formation", decaler(3)]],
      "une absence passée revient, ou celle à venir manque"
    );
  });

  await cas("ISOLATION : B ne voit ni les équipes ni les absences de A", async () => {
    const r = (await lire("LireEquipes", B)) as { equipes: { nom: string | null }[]; absencesAVenir: unknown[] };
    assert.ok(!r.equipes.some((e) => e.nom === "Équipe de Karim"));
    assert.equal(r.absencesAVenir.length, 0);
  });

  console.log("=== LireRappels ===");

  // Le vrai rappel « chantier sans devis », allumé à 3 jours, sur un chantier
  // ouvert il y a 10 jours. La date s'écrit sous `withEntreprise` : hors de lui
  // la RLS refuse EN SILENCE, et le rappel manquerait pour une mauvaise raison.
  await ecrireReglagesRappels(A, { chantierSansDevisJours: 3 });
  const vieux = await creerChantier(A, { nom: "Haie oubliée" });
  const r = await withEntreprise(A.utilisateurId, A.entrepriseId, (tx) =>
    tx
      .update(chantiers)
      .set({ createdAt: new Date(Date.now() - 10 * 86_400_000) })
      .where(eq(chantiers.id, vieux.id))
  );
  assert.equal(r.rowCount, 1, "le montage n'a pas pu vieillir le chantier");

  await cas("le chantier sans devis depuis dix jours est rappelé", async () => {
    const lu = (await lire("LireRappels", A)) as { trouve: boolean; rappels?: { genre: string; chantier: string }[] };
    assert.equal(lu.trouve, true);
    assert.ok(
      lu.rappels!.some((x) => x.genre === "chantier-sans-devis" && x.chantier === "Haie oubliée"),
      JSON.stringify(lu.rappels)
    );
  });

  await cas("ISOLATION : B n'a aucun rappel de A", async () => {
    const lu = (await lire("LireRappels", B)) as { rappels?: { chantier: string }[] };
    assert.ok(!(lu.rappels ?? []).some((x) => x.chantier === "Haie oubliée"));
  });

  console.log("=== LireDiagnostics ===");

  const base = await lireBasePourMoteur();
  const alpha = base.fiches.find((f) => f.code === "zz-test-probleme-alpha");
  assert.ok(alpha, "les fiches d'essai ne sont pas chargées");
  await ouvrirDiagnostic(A);
  const rendu = await ouvrirDiagnostic(A);
  await conclureDiagnostic(
    A,
    rendu,
    {
      type: "rendu",
      ficheId: alpha.id,
      confiance: "probable",
      resultat: {
        ficheCode: "zz-test-probleme-alpha",
        nom: "Problème d'essai alpha",
        nomScientifique: null,
        confiance: "probable",
        explication: "Donnée d'essai.",
        gravite: "faible",
        graviteLibelle: "Faible",
        conduite: "Donnée d'essai.",
        methodeConfirmation: "Analyse en laboratoire.",
        informationsRequises: [],
        criteresDiscriminants: [],
        mentions: [],
        details: {
          categorie: "maladie",
          agentCausal: null,
          agentType: "inconnu",
          partiesAtteintes: ["feuille"],
          facteursFavorisants: [],
          criteresExclusion: [],
          prevention: null,
          gestion: null,
          traitement: null,
          sources: [],
          versionFiche: 1,
          sourcesAJourLe: null,
        },
      },
    },
    { signes: [] },
    { moteur: "essai", modele: "essai", versionBase: "essai" },
    { taxonId: null, certitude: null }
  );

  await cas("le diagnostic rendu part avec ce qu'il faut pour le CONFIRMER", async () => {
    const lu = (await lire("LireDiagnostics", A)) as {
      diagnostics: { statut: string; conclusion: { probleme: string; pourConfirmer: string | null } | null }[];
    };
    assert.equal(lu.diagnostics.length, 2);
    const conclu = lu.diagnostics.find((d) => d.statut === "rendu");
    assert.equal(conclu?.conclusion?.probleme, "Problème d'essai alpha");
    assert.equal(
      conclu?.conclusion?.pourConfirmer,
      "Analyse en laboratoire.",
      "l'assistant pourrait dire « confirmé » là où l'écran s'y refuse"
    );
    assert.equal(lu.diagnostics.find((d) => d.statut === "en_analyse")?.conclusion, null);
  });

  await cas("ISOLATION : B ne voit aucun diagnostic de A", async () => {
    const lu = await lire("LireDiagnostics", B);
    assert.equal(lu.trouve, false);
  });

  await pool.end();
  if (echecs > 0) {
    console.error(`\n❌ ${echecs} échec(s).`);
    process.exit(1);
  }
  console.log("\n✅ L'assistant lit l'équipe, les rappels et les diagnostics de son entreprise, et d'elle seule.");
}

main().catch(async (e) => {
  console.error(e);
  await pool.end();
  process.exit(1);
});
