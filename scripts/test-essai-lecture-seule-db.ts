import assert from "node:assert/strict";
import { nettoyerBase } from "./_test-db";
import { creerSonCompte } from "../src/server/repositories/creation-compte";
import { creerEntreprise } from "../src/server/repositories/entreprises";
import { creerChantier, listerChantiers } from "../src/server/repositories/chantiers";
import { abonnementDeLEntreprise, enregistrerLAbonnement } from "../src/server/repositories/abonnements";
import { EssaiTermineError, withEntreprise } from "../src/server/db/with-entreprise";
import { ActionRefuseeError, exigerFonction } from "../src/server/garde-action";
import { JOURS_ESSAI, FORMULE_DE_LESSAI, enLectureSeule } from "../src/lib/abonnements";
import { abonnements } from "../src/server/db/schema";
import { db, fermerPool } from "../src/server/db/client";
import { eq, sql } from "drizzle-orm";
import type { Ctx } from "../src/server/repositories/context";

/**
 * L'ESSAI DE QUINZE JOURS, CONTRE LA BASE — ses trois décisions du 10 septembre
 * 2026, éprouvées là où elles mordent :
 *
 *   1. « essai gratuit 15 jours » : la porte l'ouvre, sans carte ;
 *   2. au 16ᵉ jour, LECTURE SEULE — et c'est Postgres qui refuse, dans
 *      `withEntreprise`, quel que soit le chemin ; une seule porte reste :
 *      s'abonner ;
 *   3. « bloqué pour l'abonnement artisan » : la garde des actions tient ce
 *      que l'écran montre.
 *
 * **Ce que cette suite éprouve et que la suite pure ne peut pas :** que la
 * transaction est bien passée en lecture seule (une écriture réelle échoue,
 * une lecture réelle passe), que l'erreur qui sort est LA NÔTRE — pas un
 * code Postgres nu —, et que la porte de sortie fonctionne depuis la lecture
 * seule elle-même.
 *
 * Sous `atlas_app`, comme l'application : les écritures passent la RLS.
 */

let echecs = 0;
async function essai(nom: string, fn: () => Promise<void>) {
  try {
    await fn();
    console.log(`  ✓ ${nom}`);
  } catch (e) {
    echecs++;
    console.log(`  ✗ ${nom}`);
    console.log(`    ${(e as Error).stack ?? (e as Error).message}`);
  }
}

const SAISIE = {
  civilite: "mme" as const,
  prenom: "Anne",
  nom: "Amiot",
  email: "anne.essai@exemple.fr",
  motDePasse: "un mot de passe assez long",
  entreprise: "Amiot Paysage",
  forme: "Micro-entreprise",
  tva: "franchise" as const,
};

/** Recule la fin de l'essai : `jours` jours dans le passé. Sous le contexte de l'entreprise, comme tout. */
async function vieillirLEssai(ctx: Ctx, jours: number) {
  await db.transaction(async (tx) => {
    await tx.execute(sql`SELECT set_config('app.entreprise_id', ${ctx.entrepriseId}, true)`);
    await tx
      .update(abonnements)
      .set({ periodeFin: new Date(Date.now() - jours * 86_400_000) })
      .where(eq(abonnements.entrepriseId, ctx.entrepriseId));
  });
}

async function main() {
  await nettoyerBase();

  console.log("\n=== 1. La porte ouvre l'essai — sans carte ===\n");

  let ctx!: Ctx;
  await essai("un compte créé par la porte porte un essai de quinze jours, formule « on essaie tout »", async () => {
    const r = await creerSonCompte(SAISIE);
    assert.ok(r.ok, "la création a été refusée");
    ctx = { utilisateurId: r.utilisateurId, entrepriseId: r.entrepriseId };
    const a = await abonnementDeLEntreprise(ctx);
    assert.ok(a, "aucune ligne d'abonnement");
    assert.equal(a.statut, "essai");
    assert.equal(a.formule, FORMULE_DE_LESSAI);
    assert.equal(a.abonnementPrestataire, null, "un essai n'a pas d'abonnement Stripe");
    assert.ok(a.periodeFin, "l'essai n'a pas de fin");
    const jours = (a.periodeFin.getTime() - Date.now()) / 86_400_000;
    assert.ok(jours > JOURS_ESSAI - 0.01 && jours <= JOURS_ESSAI, `la fin tombe dans ${jours.toFixed(2)} jours`);
    assert.equal(enLectureSeule(a, new Date()), false);
  });

  await essai("pendant l'essai, il écrit : un chantier se crée", async () => {
    const c = await creerChantier(ctx, { nom: "Taille de haies — essai" });
    assert.ok(c?.id, "le chantier n'a pas été créé");
  });

  let ctxAncien!: Ctx;
  await essai("une entreprise SANS ligne d'abonnement — son Atlas à lui — n'a pas d'essai", async () => {
    const e = await creerEntreprise({ nom: "Eden Nature" }, { email: "patron@eden.fr", nom: "Patron" });
    ctxAncien = { utilisateurId: e.utilisateurId, entrepriseId: e.entreprise.id };
    assert.equal(await abonnementDeLEntreprise(ctxAncien), null);
  });

  console.log("\n=== 2. Le 16ᵉ jour : tout se lit, rien ne s'écrit ===\n");

  await essai("l'essai vieilli d'un jour : la lecture passe encore", async () => {
    await vieillirLEssai(ctx, 1);
    const liste = await listerChantiers(ctx);
    assert.equal(liste.length, 1, "il ne relit plus son chantier");
  });

  await essai("…et l'écriture est refusée, avec NOTRE erreur — pas un code Postgres nu", async () => {
    await assert.rejects(
      () => creerChantier(ctx, { nom: "Un chantier de trop" }),
      (e: unknown) => {
        assert.ok(e instanceof EssaiTermineError, `erreur reçue : ${(e as Error).name} — ${(e as Error).message}`);
        return true;
      }
    );
    assert.equal((await listerChantiers(ctx)).length, 1, "le chantier a été créé malgré la lecture seule");
  });

  await essai("le refus vaut pour TOUT chemin d'écriture, pas seulement les dépôts connus", async () => {
    // Une écriture brute posée dans la transaction : c'est le cas d'un dépôt
    // écrit demain, que personne n'aura pensé à garder.
    await assert.rejects(
      () =>
        withEntreprise(ctx.utilisateurId, ctx.entrepriseId, async (tx) => {
          await tx.execute(sql`UPDATE entreprises SET nom = 'Renommée' WHERE id = ${ctx.entrepriseId}`);
        }),
      (e: unknown) => e instanceof EssaiTermineError
    );
  });

  await essai("l'entreprise sans abonnement, elle, écrit toujours — rien ne s'est fermé pour elle", async () => {
    const c = await creerChantier(ctxAncien, { nom: "Tonte — Eden" });
    assert.ok(c?.id);
  });

  console.log("\n=== 3. La seule porte : s'abonner ===\n");

  await essai("l'abonnement s'enregistre DEPUIS la lecture seule — sans quoi il paierait sans pouvoir rentrer", async () => {
    await enregistrerLAbonnement(ctx, {
      formule: "artisan",
      periodicite: "mensuelle",
      statut: "actif",
      periodeFin: new Date(Date.now() + 30 * 86_400_000),
      annulationDemandee: false,
      clientPrestataire: "cus_essai",
      abonnementPrestataire: "sub_essai",
    });
    const a = await abonnementDeLEntreprise(ctx);
    assert.equal(a?.statut, "actif");
  });

  await essai("abonné, il écrit de nouveau", async () => {
    const c = await creerChantier(ctx, { nom: "Premier chantier payé" });
    assert.ok(c?.id);
    assert.equal((await listerChantiers(ctx)).length, 2);
  });

  console.log("\n=== 4. « Artisan » : la garde tient ce que l'écran montre ===\n");

  await essai("à « Artisan », noter une absence ou ouvrir un retour est refusé par la garde", async () => {
    for (const f of ["absences", "retours"] as const) {
      await assert.rejects(
        () => exigerFonction(ctx, f, `essai ${f}`),
        (e: unknown) => e instanceof ActionRefuseeError
      );
    }
  });

  await essai("à « Entreprise », les deux passent", async () => {
    await enregistrerLAbonnement(ctx, {
      formule: "entreprise",
      periodicite: "mensuelle",
      statut: "actif",
      periodeFin: new Date(Date.now() + 30 * 86_400_000),
      annulationDemandee: false,
      clientPrestataire: "cus_essai",
      abonnementPrestataire: "sub_essai",
    });
    await exigerFonction(ctx, "absences", "essai");
    await exigerFonction(ctx, "retours", "essai");
  });

  await essai("sans abonnement, les deux passent aussi — une fermeture est la conséquence d'une formule choisie", async () => {
    await exigerFonction(ctxAncien, "absences", "essai");
    await exigerFonction(ctxAncien, "retours", "essai");
  });

  console.log(`\n${echecs === 0 ? "✅" : "❌"} ${echecs} échec(s)\n`);
  await fermerPool();
  process.exit(echecs === 0 ? 0 : 1);
}

main().catch(async (e) => {
  console.error(e);
  await fermerPool();
  process.exit(1);
});
