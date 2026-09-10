import assert from "node:assert/strict";
import { sql } from "drizzle-orm";
import { pool } from "../src/server/db/client";
import { withEntreprise } from "../src/server/db/with-entreprise";
import * as entreprisesRepo from "../src/server/repositories/entreprises";
import * as clientsRepo from "../src/server/repositories/clients";
import * as chantiersRepo from "../src/server/repositories/chantiers";
import { nettoyerBase } from "./_test-db";

// ═══════════════════════════════════════════════════════════════════════════
// POSER UN CLIENT SUR UN JOUR, SANS DEVIS — sa planche du 10 septembre 2026
// ═══════════════════════════════════════════════════════════════════════════
//
// *« Si j'ai un chantier à rajouter, que je puisse le faire sans devoir passer
// par la fiche client et le devis »*, puis : *« si le client n'est pas reconnu,
// il faut qu'il ajoute aussi sa fiche client automatiquement, comme quand on
// ajoute un client par la voie normale »*.
//
// **Ce qui est éprouvé ici, ce sont les RÈGLES du geste**, pas l'écran :
// la fiche qui se crée, celle qui NE se dédouble pas, la durée que le moment
// décide, et la place réellement prise. Le geste lui-même — deux voies, la
// recherche, « Annuler » — vit dans `test-bloquer-sans-devis-e2e.ts`.
//
// **On n'entre PAS par l'action serveur** : elle demande une session, que ce
// poste n'a pas. On appelle les mêmes fonctions de dépôt, dans le même ordre —
// et le fait que l'action les appelle bien, c'est la suite navigateur qui le
// tient (`CLAUDE.md` §5 quater).

let reussis = 0;
let echecs = 0;
async function test(nom: string, verifier: () => Promise<void>) {
  try {
    await verifier();
    reussis++;
    console.log(`  ✓ ${nom}`);
  } catch (e) {
    echecs++;
    console.error(`  ✗ ${nom}\n    ${(e as Error).message}`);
  }
}

const JOUR = "2026-10-05"; // un lundi, loin devant

async function contexte(email: string) {
  const { entreprise, utilisateurId } = await entreprisesRepo.creerEntreprise(
    { nom: "Élagage Éden" },
    { email }
  );
  return { utilisateurId, entrepriseId: entreprise.id };
}

/**
 * Le geste, dans l'ordre exact de l'action serveur.
 *
 * **Écrit ici une fois, et non recopié dans chaque cas** : trois rédactions du
 * même enchaînement finiraient par diverger, et l'une d'elles éprouverait autre
 * chose que ce que l'écran fait (`CLAUDE.md` §3).
 */
async function poserUnClient(
  ctx: { utilisateurId: string; entrepriseId: string },
  jour: string,
  quand: "matin" | "apres_midi" | "journee",
  saisie: { nom: string; telephone?: string; email?: string; adresse?: string }
) {
  const { client, reutilise } = await clientsRepo.trouverOuCreerClient(ctx, saisie);
  const chantier = await chantiersRepo.creerChantier(ctx, {
    nom: client.nom,
    adresseChantier: client.adresse ?? undefined,
    clientId: client.id,
    dureeDemiJournees: quand === "journee" ? 2 : 1,
  });
  await chantiersRepo.planifierChantier(ctx, chantier.id, jour, {
    demi: quand === "apres_midi" ? "apres_midi" : "matin",
  });
  return { client, chantier, reutilise };
}

/** Où le chantier est posé, sous son entreprise (la RLS refuse le reste). */
async function ouEstPose(
  ctx: { utilisateurId: string; entrepriseId: string },
  chantierId: string
) {
  const poses = await chantiersRepo.creneauxDunChantier(ctx, chantierId);
  return poses.map((c) => `${c.jour} ${c.moment}`).sort();
}

async function main() {
  console.log("=== Poser un client sur un jour, sans devis ===\n");
  await nettoyerBase();

  await test("un client INCONNU : sa fiche se crée, avec son numéro et son adresse", async () => {
    const ctx = await contexte(`neuf-${Date.now()}@t.test`);
    const { client, reutilise } = await poserUnClient(ctx, JOUR, "matin", {
      nom: "Mme Renard",
      telephone: "06 11 22 33 44",
      adresse: "5 rue des Lilas, Mantes",
    });
    assert.equal(reutilise, false, "une fiche existante a été reprise alors qu'aucune n'existait");
    const fiche = await clientsRepo.getClient(ctx, client.id);
    assert.equal(fiche?.nom, "Mme Renard");
    assert.equal(fiche?.telephone, "06 11 22 33 44", "le numéro n'est pas dans sa fiche");
    assert.equal(fiche?.adresse, "5 rue des Lilas, Mantes", "l'adresse n'est pas dans sa fiche");
  });

  await test("un client CONNU ne se dédouble pas — sa fiche est reprise", async () => {
    const ctx = await contexte(`connu-${Date.now()}@t.test`);
    const deja = await clientsRepo.creerClient(ctx, {
      nom: "M. Rocher",
      telephone: "06 21 44 90 12",
    });
    const { client, reutilise } = await poserUnClient(ctx, JOUR, "matin", { nom: "M. Rocher" });
    assert.equal(reutilise, true, "une seconde fiche a été créée pour un client déjà connu");
    assert.equal(client.id, deja.id, "ce n'est pas la fiche qui existait");
    const tous = await clientsRepo.listerClients(ctx);
    assert.equal(
      tous.filter((c) => c.nom === "M. Rocher").length,
      1,
      "deux fiches portent le même nom : le carnet se dédouble à chaque pose"
    );
  });

  await test("« Matin » prend UNE demi-journée, et rien de plus", async () => {
    const ctx = await contexte(`matin-${Date.now()}@t.test`);
    const { chantier } = await poserUnClient(ctx, JOUR, "matin", { nom: "Mme Fauvel" });
    assert.deepEqual(await ouEstPose(ctx, chantier.id), [`${JOUR} matin`]);
  });

  await test("« Après-midi » prend l'après-midi, pas le matin", async () => {
    const ctx = await contexte(`aprem-${Date.now()}@t.test`);
    const { chantier } = await poserUnClient(ctx, JOUR, "apres_midi", { nom: "Mme Fauvel" });
    assert.deepEqual(await ouEstPose(ctx, chantier.id), [`${JOUR} apres_midi`]);
  });

  await test("« Journée » prend les DEUX moitiés du même jour", async () => {
    // **Et pas le lendemain matin.** C'est le piège du bloc : une durée de deux
    // demi-journées posée l'après-midi déborderait sur le jour suivant.
    const ctx = await contexte(`journee-${Date.now()}@t.test`);
    const { chantier } = await poserUnClient(ctx, JOUR, "journee", { nom: "Mme Fauvel" });
    assert.deepEqual(await ouEstPose(ctx, chantier.id), [
      `${JOUR} apres_midi`,
      `${JOUR} matin`,
    ]);
  });

  await test("le chantier posé n'a NI devis NI prix — c'est du temps pris", async () => {
    const ctx = await contexte(`sec-${Date.now()}@t.test`);
    const { chantier } = await poserUnClient(ctx, JOUR, "matin", { nom: "M. Bernard" });
    // **On lit SOUS SON ENTREPRISE.** Une requête posée hors de
    // `withEntreprise` ne rend rien, silencieusement — et `[].every(…)` vaut
    // vrai : le contrôle rendrait un vert sans rien mesurer (`CLAUDE.md` §5).
    const lu = await withEntreprise(ctx.utilisateurId, ctx.entrepriseId, async (tx) => {
      const r = await tx.execute(sql`
        SELECT c.devis_envoye_at, c.facture_envoyee_at,
               (SELECT count(*) FROM devis d WHERE d.chantier_id = c.id) AS devis
          FROM chantiers c WHERE c.id = ${chantier.id}`);
      return (r as unknown as { rows: Record<string, unknown>[] }).rows[0];
    });
    assert.ok(lu, "le chantier ne se relit pas : rien n'est mesuré");
    assert.equal(lu.devis_envoye_at, null, "un devis est parti alors qu'on n'en a rédigé aucun");
    assert.equal(lu.facture_envoyee_at, null, "une facture existe déjà");
    assert.equal(Number(lu.devis), 0, "un devis a été créé au passage");
  });

  await test("IL SE VOIT AU PLANNING — sans devis, c'est la date qui le montre", async () => {
    // **Le défaut que ce contrôle rend impossible.** Cette liste n'admettait que
    // les chantiers dont le devis est PARTI jusqu'au 22 août 2026 : un chantier
    // posé ainsi aurait pris la place sans apparaître nulle part — la panne
    // exacte qu'il avait signalée (« le chantier de Bernard n'est pas indiqué »).
    const ctx = await contexte(`vu-${Date.now()}@t.test`);
    const { chantier } = await poserUnClient(ctx, JOUR, "matin", { nom: "M. Bernard" });
    const liste = await chantiersRepo.listerChantiersPourPlanning(ctx);
    const lui = liste.find((c) => c.id === chantier.id);
    assert.ok(lui, "le chantier posé n'apparaît pas au planning : il prend la place en secret");
    assert.equal(lui.datePlanifiee, JOUR);
    assert.equal(lui.dureeDemiJournees, 1, "la durée choisie n'a pas suivi");
  });

  await test("ce qu'on saisit COMPLÈTE une fiche connue, sans rien écraser", async () => {
    // La règle du 17 août 2026, celle de la voie normale : ce qui manque se
    // complète, ce qui est écrit ne bouge pas.
    const ctx = await contexte(`complete-${Date.now()}@t.test`);
    const deja = await clientsRepo.creerClient(ctx, {
      nom: "M. Alicanter",
      telephone: "07 60 55 21 09",
    });
    const { reutilise } = await poserUnClient(ctx, JOUR, "matin", {
      nom: "M. Alicanter",
      adresse: "14 av. de la Gare, Bordeaux",
    });
    assert.equal(reutilise, true, "sa fiche n'a pas été reconnue");
    const fiche = await clientsRepo.getClient(ctx, deja.id);
    assert.equal(fiche?.telephone, "07 60 55 21 09", "son numéro a été écrasé par la saisie du jour");
    assert.equal(
      fiche?.adresse,
      "14 av. de la Gare, Bordeaux",
      "l'adresse qui manquait n'a pas été complétée"
    );
  });

  await test("UN AUTRE NUMÉRO fait une AUTRE fiche — deux Martins ne se mélangent pas", async () => {
    /*
     * **Ce n'est pas un défaut de ce geste, c'est la règle de la voie normale**
     * (`src/lib/rapprochement-client.ts`, 17 août 2026), et elle vaut ici aussi :
     * un nom identique avec un numéro DIFFÉRENT désigne quelqu'un d'autre. Deux
     * Bernard d'un même village finiraient sinon sur la même fiche, avec les
     * devis de l'un chez l'autre.
     *
     * Il compte parce que ce chemin-ci saisit un numéro *à la volée*, sur un
     * jour : c'est exactement là qu'on retape un chiffre de travers.
     */
    const ctx = await contexte(`autre-${Date.now()}@t.test`);
    await clientsRepo.creerClient(ctx, { nom: "M. Bernard", telephone: "06 11 11 11 11" });
    const { reutilise } = await poserUnClient(ctx, JOUR, "matin", {
      nom: "M. Bernard",
      telephone: "06 22 22 22 22",
    });
    assert.equal(reutilise, false, "deux numéros différents ont atterri sur la même fiche");
    const tous = await clientsRepo.listerClients(ctx);
    assert.equal(tous.filter((c) => c.nom === "M. Bernard").length, 2);
  });

  console.log(`\n${echecs === 0 ? "✅" : "❌"} Poser un client — ${reussis} réussi(s), ${echecs} échec(s).`);
  await pool.end();
  process.exit(echecs === 0 ? 0 : 1);
}

main().catch(async (e) => {
  console.error(e);
  process.exit(1);
});
