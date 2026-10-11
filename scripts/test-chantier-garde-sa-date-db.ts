import assert from "node:assert/strict";
import * as entreprisesRepo from "../src/server/repositories/entreprises";
import * as chantiersRepo from "../src/server/repositories/chantiers";
import * as clientsRepo from "../src/server/repositories/clients";
import * as devisRepo from "../src/server/repositories/devis";
import * as prixRepo from "../src/server/repositories/lignes-prix";
import { DeplanificationImpossibleError } from "../src/server/repositories/chantiers";
import {
  creerFactureSansDevis,
  emettreFacture,
  listerChantiersTermines,
  terminerChantier,
} from "../src/server/repositories/factures";
import { preparer } from "../src/lib/termines-par-mois";
import { jourIso } from "../src/lib/jour";
import { pool } from "../src/server/db/client";
import { nettoyerBase } from "./_test-db";

// ═══════════════════════════════════════════════════════════════════════════
// UN CHANTIER NE PERD JAMAIS SA DATE — sa question du 21 septembre 2026
// ═══════════════════════════════════════════════════════════════════════════
//
// *« Pourquoi Julien n'a pas de date ? »*, devant deux rangées « À FACTURER »
// sans deuxième ligne, puis sa décision : *« il faut même mettre la date du
// jour à laquelle on a créé la facture »*.
//
// **DEUX DÉFAUTS, ET ILS SE CUMULAIENT :**
//
//   1. « retirer du planning » remettait `date_planifiee` à NULL **sans
//      regarder si une facture était déjà préparée** : le chantier restait
//      dans « Terminés » par son `termine_at`, et perdait sa date pour
//      toujours ;
//   2. un chantier facturé sans être jamais passé par le planning n'avait
//      aucune date du tout — `cleMois` valait `""`, donc **aucun mois ne le
//      portait**. L'œil le montrait tant qu'il attendait sa facture, et il
//      disparaissait de l'écran le jour où elle partait, tout en comptant
//      dans « N facturés ».
//
// **POURQUOI UNE SUITE BASE.** Le premier défaut est un invariant d'ÉCRITURE,
// et le second se joue sur ce que le dépôt REMONTE — `factureDateEmission` doit
// descendre jusqu'à la règle pure. Les deux se mesurent sous `atlas_app`, comme
// chez lui ; une suite navigateur tourne sous un rôle qui traverse la RLS
// (`CLAUDE.md` §5).
//
// **ET ON ENTRE PAR LA PORTE DU PATRON** (`CLAUDE.md` §5 quater) : la fiche
// client qui crée le chantier, puis le geste qui pose la facture — jamais une
// ligne écrite à la main dans `chantiers`.

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

async function contexte(): Promise<Ctx> {
  const { entreprise, utilisateurId } = await entreprisesRepo.creerEntreprise(
    { nom: "Paysages du bocage" },
    { email: `garde-sa-date-${Date.now()}@t.test` }
  );
  return { utilisateurId, entrepriseId: entreprise.id };
}

/** Le chemin de la fiche : un client, un chantier — et aucune date. */
async function surLaFiche(ctx: Ctx, nom: string) {
  const client = await clientsRepo.creerClient(ctx, { nom });
  return chantiersRepo.creerChantier(ctx, {
    nom: `Chez ${nom}`,
    adresseChantier: "3 chemin du Pré, Saint-Marc",
    clientId: client.id,
  });
}

/** Un chantier ordinaire, devis parti — c'est ce que la fin de chantier exige. */
async function avecDevisEnvoye(ctx: Ctx, nom: string) {
  const chantier = await surLaFiche(ctx, nom);
  await prixRepo.ajouterLignePrix(ctx, chantier.id, "Taille de haie", "600.00");
  const brouillon = await devisRepo.getOuCreerDevisBrouillon(ctx, chantier.id);
  await devisRepo.envoyerDevis(ctx, brouillon.id);
  return chantier;
}

/** La rangée de « Terminés », telle que l'écran la reçoit. */
async function rangeeDe(ctx: Ctx, chantierId: string) {
  const lignes = preparer(await listerChantiersTermines(ctx));
  const rangee = lignes.find((l) => l.id === chantierId);
  assert.ok(rangee, "le chantier n'est pas dans « Terminés » : il n'y a rien à mesurer");
  return rangee;
}

async function main() {
  await nettoyerBase();
  const ctx = await contexte();
  const aujourdHui = jourIso(new Date());

  // ── 1. LE GESTE QUI EFFAÇAIT LA DATE ─────────────────────────────────────

  await test("retirer du planning est REFUSÉ dès que la facture est préparée", async () => {
    const chantier = await avecDevisEnvoye(ctx, "Mme Chauvet");
    await chantiersRepo.planifierChantier(ctx, chantier.id, aujourdHui);
    await terminerChantier(ctx, chantier.id);

    await assert.rejects(
      () => chantiersRepo.deplanifierChantier(ctx, chantier.id),
      (err: unknown) =>
        err instanceof DeplanificationImpossibleError && err.motif === "facture_preparee",
      "le geste est passé : le chantier vient de perdre sa date"
    );

    // **Et la date est TOUJOURS là.** Un refus qui laisse la moitié du travail
    // fait vaut le geste lui-même.
    const apres = await chantiersRepo.getChantier(ctx, chantier.id);
    assert.equal(apres?.datePlanifiee, aujourdHui);
  });

  await test("et il reste refusé une fois la facture ÉMISE", async () => {
    const chantier = await avecDevisEnvoye(ctx, "M. Pineau");
    await chantiersRepo.planifierChantier(ctx, chantier.id, aujourdHui);
    const facture = await terminerChantier(ctx, chantier.id);
    await emettreFacture(ctx, facture.id);

    await assert.rejects(
      () => chantiersRepo.deplanifierChantier(ctx, chantier.id),
      (err: unknown) => err instanceof DeplanificationImpossibleError
    );
  });

  await test("sans facture, il retire toujours — le garde-fou ne ferme pas la porte", async () => {
    // **Un garde-fou qui parle à tort s'apprend à être ignoré** (`CLAUDE.md`
    // §1 bis) : ce cas-ci est le geste ordinaire, et il doit passer.
    const chantier = await avecDevisEnvoye(ctx, "Mme Roy");
    await chantiersRepo.planifierChantier(ctx, chantier.id, aujourdHui);
    const apres = await chantiersRepo.deplanifierChantier(ctx, chantier.id);
    assert.equal(apres?.datePlanifiee, null);
  });

  // ── 2. CE QUE « TERMINÉS » ÉCRIT SUR LA RANGÉE ───────────────────────────

  await test("facturé sans planning, le chantier prend le jour de sa facture", async () => {
    const chantier = await surLaFiche(ctx, "M. Julien");
    await creerFactureSansDevis(ctx, chantier.id);

    const rangee = await rangeeDe(ctx, chantier.id);
    assert.equal(rangee.datePlanifiee, null, "le planning n'a rien posé, et ne doit rien poser");
    assert.equal(rangee.dateDuChantier, aujourdHui);
    assert.equal(rangee.cleMois, aujourdHui.slice(0, 7), "aucun mois ne porte ce chantier");
  });

  await test("le mois le retrouve une fois la facture PARTIE", async () => {
    // C'était le pire des deux cas : la rangée quittait la liste tout en
    // continuant de compter dans « N facturés ».
    const chantier = await surLaFiche(ctx, "Mme Terrien");
    const facture = await creerFactureSansDevis(ctx, chantier.id);
    await emettreFacture(ctx, facture.id);

    const rangee = await rangeeDe(ctx, chantier.id);
    assert.equal(rangee.aFacturer, false);
    assert.equal(rangee.cleMois, aujourdHui.slice(0, 7));
  });

  await test("le planning garde le dernier mot quand il a posé un jour", async () => {
    // La date de RÉALISATION, c'est celle du planning : la facture peut partir
    // un mois plus tard, et le chantier reste dans le mois où il a été fait.
    const chantier = await avecDevisEnvoye(ctx, "M. Gauthier");
    await chantiersRepo.planifierChantier(ctx, chantier.id, aujourdHui);
    await terminerChantier(ctx, chantier.id);

    const rangee = await rangeeDe(ctx, chantier.id);
    assert.equal(rangee.dateDuChantier, aujourdHui);
    assert.equal(rangee.datePlanifiee, aujourdHui);
  });

  console.log(`\n${failed === 0 ? "✅" : "❌"} Le chantier garde sa date — ${passed} vert(s), ${failed} rouge(s).`);
  await pool.end();
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
