import assert from "node:assert/strict";
import { pool } from "../src/server/db/client";
import * as entreprisesRepo from "../src/server/repositories/entreprises";
import * as chantiersRepo from "../src/server/repositories/chantiers";
import * as clientsRepo from "../src/server/repositories/clients";
import * as devisRepo from "../src/server/repositories/devis";
import * as prixRepo from "../src/server/repositories/lignes-prix";
import { travauxAffiches, refusDuTravail, TRAVAUX_MAX } from "../src/lib/taches-du-devis";
import { casesDuJour } from "../src/lib/retour-intervention";

// ═══════════════════════════════════════════════════════════════════════════
// LES TRAVAUX D'UN CLIENT POSÉ SANS DEVIS — sa réponse du 7 octobre 2026
// ═══════════════════════════════════════════════════════════════════════════
//
// *« On peut ajouter un client au planning alors qu'on n'a pas envoyé le devis.
// À ce moment-là, il faut que l'on puisse ajouter les travaux à faire. »* Puis,
// devant `appli/travaux-sans-devis.html` : *« oui, et 1 »* — quand le devis
// part, ses lignes REMPLACENT les travaux écrits à la main.
//
// **Une suite base, sous `atlas_app`**, parce que ce qui compte s'écrit en base
// et se lit sous la RLS : la fiche du planning, le retour du jour et la page
// des retours lisent tous `tachesDuChantier`. Une suite navigateur tournerait
// sous un rôle qui traverse la RLS (`CLAUDE.md` §5).

let passed = 0;
let failed = 0;
async function test(nom: string, fn: () => Promise<void> | void) {
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
    { nom: "Jardins du Vexin" },
    { email: `travaux-main-${suffixe}-${Date.now()}@t.test` }
  );
  return { utilisateurId, entrepriseId: entreprise.id };
}

/** Un client posé sans devis, comme « Ajouter, un client » au planning le crée. */
async function sansDevis(ctx: Ctx) {
  const client = await clientsRepo.creerClient(ctx, { nom: "Mme Lefèvre" });
  return chantiersRepo.creerChantier(ctx, { nom: "Chez Mme Lefèvre", clientId: client.id });
}

async function main() {
  // ─── La règle, sans base ──────────────────────────────────────────────────
  await test("un devis ENVOYÉ fait la liste, même devant des travaux écrits à la main", () => {
    assert.deepEqual(
      travauxAffiches({ envoye: ["Taille de haie"], brouillon: null, aLaMain: ["Tonte"] }),
      { taches: ["Taille de haie"], aLaMain: false }
    );
  });
  await test("un brouillon ne remplace pas les travaux écrits à la main", () => {
    assert.deepEqual(
      travauxAffiches({ envoye: null, brouillon: ["Taille de haie"], aLaMain: ["Tonte"] }),
      { taches: ["Tonte"], aLaMain: true }
    );
  });
  await test("un brouillon seul garde ses lignes, comme avant", () => {
    assert.deepEqual(
      travauxAffiches({ envoye: null, brouillon: ["Taille de haie"], aLaMain: [] }),
      { taches: ["Taille de haie"], aLaMain: false }
    );
  });
  await test("rien du tout : une liste vide qu'on remplit à la main", () => {
    assert.deepEqual(travauxAffiches({ envoye: null, brouillon: null, aLaMain: [] }), {
      taches: [],
      aLaMain: true,
    });
    assert.deepEqual(travauxAffiches({ envoye: null, brouillon: [], aLaMain: [] }), {
      taches: [],
      aLaMain: true,
    });
  });
  await test("un travail vide ou de trop se refuse, dans ses mots", () => {
    assert.ok(refusDuTravail("   ", 0));
    assert.ok(refusDuTravail("x".repeat(201), 0));
    assert.ok(refusDuTravail("Tonte", TRAVAUX_MAX));
    assert.equal(refusDuTravail("Tonte", 3), null);
  });
  await test("les cases du jour suivent la liste du jour, cochées comme hier", () => {
    const hier = [
      { libelle: "Tonte", faite: true },
      { libelle: "Enlevé ce matin", faite: true },
    ];
    assert.deepEqual(casesDuJour(["Tonte", "Ajouté ce matin"], hier), [
      { libelle: "Tonte", faite: true },
      { libelle: "Ajouté ce matin", faite: false },
    ]);
    assert.deepEqual(casesDuJour(["Tonte", "Tonte"], [{ libelle: "Tonte", faite: true }]), [
      { libelle: "Tonte", faite: true },
      { libelle: "Tonte", faite: false },
    ]);
  });

  // ─── En base, sous la RLS ─────────────────────────────────────────────────
  const ctx = await contexte("a");

  await test("sans devis, la fiche s'écrit à la main : ajouter, enlever", async () => {
    const chantier = await sansDevis(ctx);
    assert.deepEqual(await devisRepo.tachesDuChantier(ctx, chantier.id), {
      taches: [],
      aLaMain: true,
      avecDevis: false,
    });
    const a = await devisRepo.ajouterTravailALaMain(ctx, chantier.id, "  Taille de haie de thuya ");
    assert.deepEqual(a, { ok: true, taches: ["Taille de haie de thuya"] });
    await devisRepo.ajouterTravailALaMain(ctx, chantier.id, "Ramassage des feuilles");
    assert.deepEqual((await devisRepo.tachesDuChantier(ctx, chantier.id)).taches, [
      "Taille de haie de thuya",
      "Ramassage des feuilles",
    ]);
    const e = await devisRepo.enleverTravailALaMain(ctx, chantier.id, 0, "Taille de haie de thuya");
    assert.deepEqual(e, { ok: true, taches: ["Ramassage des feuilles"] });
  });

  await test("enlever par un rang qui ne porte plus ce libellé se refuse", async () => {
    const chantier = await sansDevis(ctx);
    await devisRepo.ajouterTravailALaMain(ctx, chantier.id, "Tonte");
    await devisRepo.ajouterTravailALaMain(ctx, chantier.id, "Désherbage");
    const r = await devisRepo.enleverTravailALaMain(ctx, chantier.id, 0, "Désherbage");
    assert.equal(r.ok, false);
    assert.deepEqual((await devisRepo.tachesDuChantier(ctx, chantier.id)).taches, ["Tonte", "Désherbage"]);
  });

  await test("un travail vide ne s'écrit pas", async () => {
    const chantier = await sansDevis(ctx);
    const r = await devisRepo.ajouterTravailALaMain(ctx, chantier.id, "   ");
    assert.equal(r.ok, false);
    assert.deepEqual((await devisRepo.tachesDuChantier(ctx, chantier.id)).taches, []);
  });

  await test("un brouillon commencé ensuite ne remplace pas les travaux écrits", async () => {
    const chantier = await sansDevis(ctx);
    await devisRepo.ajouterTravailALaMain(ctx, chantier.id, "Tonte");
    await prixRepo.ajouterLignePrix(ctx, chantier.id, "Élagage de deux tilleuls", "400.00");
    await devisRepo.getOuCreerDevisBrouillon(ctx, chantier.id);
    const f = await devisRepo.tachesDuChantier(ctx, chantier.id);
    assert.deepEqual(f.taches, ["Tonte"]);
    assert.equal(f.aLaMain, true);
  });

  await test("le devis PART : ses lignes remplacent, et la liste ne s'écrit plus à la main", async () => {
    const chantier = await sansDevis(ctx);
    await devisRepo.ajouterTravailALaMain(ctx, chantier.id, "Tonte");
    await prixRepo.ajouterLignePrix(ctx, chantier.id, "Élagage de deux tilleuls", "400.00");
    const brouillon = await devisRepo.getOuCreerDevisBrouillon(ctx, chantier.id);
    await devisRepo.envoyerDevis(ctx, brouillon.id);
    const f = await devisRepo.tachesDuChantier(ctx, chantier.id);
    assert.deepEqual(f.taches, ["Élagage de deux tilleuls"]);
    assert.equal(f.aLaMain, false);
    const r = await devisRepo.ajouterTravailALaMain(ctx, chantier.id, "Ramassage");
    assert.equal(r.ok, false);
  });

  await test("une AUTRE entreprise n'écrit rien sur ce chantier", async () => {
    const chantier = await sansDevis(ctx);
    const autre = await contexte("b");
    const r = await devisRepo.ajouterTravailALaMain(autre, chantier.id, "Intrus");
    assert.equal(r.ok, false);
    assert.deepEqual((await devisRepo.tachesDuChantier(ctx, chantier.id)).taches, []);
  });
}

main()
  .catch((e) => {
    console.error(e);
    failed++;
  })
  .finally(async () => {
    await pool.end();
    console.log(
      `\n${failed === 0 ? "✅" : "❌"} Travaux écrits à la main — ${passed} réussi(s), ${failed} échec(s).`
    );
    process.exit(failed === 0 ? 0 : 1);
  });
