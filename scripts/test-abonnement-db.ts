import assert from "node:assert/strict";
import { sql } from "drizzle-orm";
import { db, pool } from "../src/server/db/client";
import * as entreprisesRepo from "../src/server/repositories/entreprises";
import {
  abonnementDeLEntreprise,
  appliquerDepuisLeCrochet,
  compterLesFabricants,
  enregistrerLAbonnement,
  type EtatVenuDuPrestataire,
} from "../src/server/repositories/abonnements";
import { donnerUnAcces, listerAcces, changerLeRole } from "../src/server/repositories/membres-entreprise";
import { fermerLimiteur } from "../src/server/rate-limit";
import { nettoyerBase } from "./_test-db";

// ═══════════════════════════════════════════════════════════════════════════
// L'ABONNEMENT EN BASE — isolation, idempotence, et le plafond de sa règle
// ═══════════════════════════════════════════════════════════════════════════
//
// **POURQUOI UNE SUITE BASE, ET NON UNE SUITE NAVIGATEUR.** Le crochet du
// prestataire écrit SANS session : c'est, avec la réponse au devis et la
// réception d'une facture, l'une des rares écritures d'Atlas ouvertes sans
// compte. Or les suites navigateur démarrent leur serveur sous un rôle qui
// traverse la RLS — elles ne peuvent donc pas, par construction, voir un défaut
// d'isolation (`CLAUDE.md` §5). Tout ce qui suit tourne sous `atlas_app`,
// exactement comme en production.
//
// **CE QU'ELLE DÉFEND, dans l'ordre d'importance :**
//
//  1. le crochet n'atteint QUE l'abonnement dont il porte l'identifiant ;
//  2. le même événement rejoué ne prolonge pas deux fois la période payée ;
//  3. un abonnement d'une entreprise n'est jamais lisible par une autre ;
//  4. la sixième personne aux devis est refusée en « Entreprise » — et le
//     salarié, lui, ne compte jamais.

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

let compteur = 0;
async function contexte(nom: string): Promise<Ctx> {
  compteur++;
  const { entreprise, utilisateurId } = await entreprisesRepo.creerEntreprise(
    { nom },
    { email: `abo-${compteur}-${Date.now()}@t.test` }
  );
  return { utilisateurId, entrepriseId: entreprise.id };
}

/**
 * COMPTER LES LIGNES D'UNE ENTREPRISE — sous son contexte d'isolation.
 *
 * **Écrit d'abord en `pool.query` nu, et c'est la RLS qui l'a redressé.** Une
 * requête posée hors de `withEntreprise` ne rend RIEN, silencieusement
 * (`CLAUDE.md` §3) : le compte tombait à zéro, et le contrôle accusait le
 * produit d'avoir écrit deux lignes alors qu'il n'en avait écrit qu'une. Le
 * défaut était dans le contrôle ; l'isolation, elle, faisait son travail.
 *
 * On pose donc le contexte, comme le fait le code éprouvé — sinon on ne mesure
 * pas ce qu'on croit mesurer.
 */
async function compterAbonnements(entrepriseId: string): Promise<number> {
  return db.transaction(async (tx) => {
    await tx.execute(sql`SELECT set_config('app.entreprise_id', ${entrepriseId}, true)`);
    const r = await tx.execute(
      sql`SELECT count(*)::int AS n FROM abonnements WHERE entreprise_id = ${entrepriseId}`
    );
    return Number((r.rows[0] as { n: number }).n);
  });
}

const LE_9_OCTOBRE = new Date("2026-10-09T10:00:00Z");
const LE_9_NOVEMBRE = new Date("2026-11-09T10:00:00Z");

function etat(surcharge: Partial<EtatVenuDuPrestataire> & { abonnementPrestataire: string }): EtatVenuDuPrestataire {
  return {
    formule: "entreprise",
    periodicite: "mensuelle",
    statut: "actif",
    periodeFin: LE_9_OCTOBRE,
    annulationDemandee: false,
    clientPrestataire: `cus_${surcharge.abonnementPrestataire}`,
    ...surcharge,
  };
}

async function main() {
  await nettoyerBase();

  // ─────────────────────────────────────────────────────────────────────────
  console.log("\n── L'écriture depuis une session ──\n");

  await test("une entreprise neuve n'a AUCUN abonnement — et l'état de départ le dit", async () => {
    // **Un contrôle qui mesure zéro ne mesure rien** (`CLAUDE.md` §5) : sans
    // cette vérification, tous les contrôles suivants pourraient être verts
    // sur une table qui ne s'écrit jamais.
    const ctx = await contexte("Neuve");
    assert.equal(await abonnementDeLEntreprise(ctx), null);
  });

  await test("s'abonner écrit la formule, la périodicité et la date de fin", async () => {
    const ctx = await contexte("Abonnée");
    await enregistrerLAbonnement(ctx, etat({ abonnementPrestataire: "sub_A" }));

    const lu = await abonnementDeLEntreprise(ctx);
    assert.ok(lu);
    assert.equal(lu.formule, "entreprise");
    assert.equal(lu.periodicite, "mensuelle");
    assert.equal(lu.statut, "actif");
    assert.equal(lu.abonnementPrestataire, "sub_A");
    assert.equal(lu.periodeFin?.toISOString(), LE_9_OCTOBRE.toISOString());
  });

  await test("un SECOND enregistrement remplace le premier — jamais deux abonnements", async () => {
    // Deux lignes donneraient deux prélèvements et deux plafonds
    // contradictoires, et rien ne dirait lequel fait foi.
    const ctx = await contexte("Deux fois");
    await enregistrerLAbonnement(ctx, etat({ abonnementPrestataire: "sub_B" }));
    await enregistrerLAbonnement(ctx, etat({ abonnementPrestataire: "sub_B", formule: "illimite" }));

    const lu = await abonnementDeLEntreprise(ctx);
    assert.equal(lu?.formule, "illimite");

    assert.equal(await compterAbonnements(ctx.entrepriseId), 1, "l'entreprise porte plus d'un abonnement");
  });

  // ─────────────────────────────────────────────────────────────────────────
  console.log("\n── L'isolation entre entreprises ──\n");

  await test("l'abonnement d'une entreprise est INVISIBLE de l'autre", async () => {
    const a = await contexte("Isolée A");
    const b = await contexte("Isolée B");
    await enregistrerLAbonnement(a, etat({ abonnementPrestataire: "sub_ISO", formule: "illimite" }));

    assert.equal(await abonnementDeLEntreprise(b), null, "B voit l'abonnement de A");
    assert.ok(await abonnementDeLEntreprise(a), "A ne voit plus le sien : le contrôle ne prouverait rien");
  });

  // ─────────────────────────────────────────────────────────────────────────
  console.log("\n── Le crochet, qui écrit sans session ──\n");

  await test("le crochet met à jour l'abonnement qu'il désigne", async () => {
    const ctx = await contexte("Renouvelée");
    await enregistrerLAbonnement(ctx, etat({ abonnementPrestataire: "sub_C" }));

    const applique = await appliquerDepuisLeCrochet(
      "evt_1",
      "customer.subscription.updated",
      etat({ abonnementPrestataire: "sub_C", periodeFin: LE_9_NOVEMBRE })
    );
    assert.equal(applique, true);

    const lu = await abonnementDeLEntreprise(ctx);
    assert.equal(lu?.periodeFin?.toISOString(), LE_9_NOVEMBRE.toISOString());
  });

  await test("LE MÊME ÉVÉNEMENT REJOUÉ ne change plus rien", async () => {
    // Le prestataire répète tant qu'il n'a pas reçu de 200 : sans cette
    // garde, un seul paiement prolongerait trois fois la période.
    const ctx = await contexte("Rejouée");
    await enregistrerLAbonnement(ctx, etat({ abonnementPrestataire: "sub_D" }));

    const premier = await appliquerDepuisLeCrochet(
      "evt_2",
      "invoice.paid",
      etat({ abonnementPrestataire: "sub_D", periodeFin: LE_9_NOVEMBRE })
    );
    const second = await appliquerDepuisLeCrochet(
      "evt_2",
      "invoice.paid",
      etat({ abonnementPrestataire: "sub_D", periodeFin: new Date("2027-01-01T00:00:00Z") })
    );

    assert.equal(premier, true, "le premier passage n'a rien fait");
    assert.equal(second, false, "le rejeu a été traité une seconde fois");

    const lu = await abonnementDeLEntreprise(ctx);
    assert.equal(
      lu?.periodeFin?.toISOString(),
      LE_9_NOVEMBRE.toISOString(),
      "le rejeu a repoussé la période payée"
    );
  });

  await test("UN ABONNEMENT INCONNU n'en crée aucun, et ne touche à rien", async () => {
    const ctx = await contexte("Intacte");
    await enregistrerLAbonnement(ctx, etat({ abonnementPrestataire: "sub_E", formule: "artisan" }));

    const applique = await appliquerDepuisLeCrochet(
      "evt_3",
      "customer.subscription.updated",
      etat({ abonnementPrestataire: "sub_INVENTE", formule: "illimite" })
    );
    assert.equal(applique, false);

    const lu = await abonnementDeLEntreprise(ctx);
    assert.equal(lu?.formule, "artisan", "un identifiant inconnu a modifié un abonnement voisin");

    // **Rien n'a été CRÉÉ non plus.** Sans cette ligne, un crochet qui
    // insérerait une ligne pour un identifiant inconnu passerait inaperçu :
    // l'abonnement d'origine, lui, serait bien resté « artisan ».
    assert.equal(await compterAbonnements(ctx.entrepriseId), 1, "une ligne d'abonnement est apparue");
  });

  await test("le crochet n'atteint QUE l'abonnement nommé — pas celui du voisin", async () => {
    const a = await contexte("Voisine A");
    const b = await contexte("Voisine B");
    await enregistrerLAbonnement(a, etat({ abonnementPrestataire: "sub_F", formule: "artisan" }));
    await enregistrerLAbonnement(b, etat({ abonnementPrestataire: "sub_G", formule: "artisan" }));

    await appliquerDepuisLeCrochet(
      "evt_4",
      "customer.subscription.updated",
      etat({ abonnementPrestataire: "sub_F", formule: "illimite" })
    );

    assert.equal((await abonnementDeLEntreprise(a))?.formule, "illimite", "l'abonnement visé n'a pas bougé");
    assert.equal((await abonnementDeLEntreprise(b))?.formule, "artisan", "l'abonnement du voisin a été modifié");
  });

  await test("une résiliation venue du guichet se lit dans Atlas", async () => {
    const ctx = await contexte("Résiliée");
    await enregistrerLAbonnement(ctx, etat({ abonnementPrestataire: "sub_H" }));
    await appliquerDepuisLeCrochet(
      "evt_5",
      "customer.subscription.updated",
      etat({ abonnementPrestataire: "sub_H", annulationDemandee: true })
    );
    assert.equal((await abonnementDeLEntreprise(ctx))?.annulationDemandee, true);
  });

  // ─────────────────────────────────────────────────────────────────────────
  console.log("\n── Le plafond : qui compte, et qui ne compte pas ──\n");

  await test("le patron seul compte pour une personne qui fabrique", async () => {
    const ctx = await contexte("Solo");
    assert.equal(await compterLesFabricants(ctx), 1);
  });

  await test("LES SALARIÉS NE COMPTENT PAS — sa correction du 9 septembre", async () => {
    const ctx = await contexte("Huit gars");
    for (let i = 0; i < 4; i++) {
      const r = await donnerUnAcces(ctx, {
        nom: `Salarié ${i}`,
        email: `salarie-${i}-${Date.now()}@t.test`,
        motDePasse: "motdepasse-douze",
        confirmation: "motdepasse-douze",
        role: "salarie",
      });
      assert.equal(r.ok, true, `le salarié ${i} a été refusé`);
    }
    assert.equal(await compterLesFabricants(ctx), 1, "les salariés sont entrés dans le compte");
  });

  await test("SANS ABONNEMENT, rien n'est plafonné — l'application ne se ferme pas", async () => {
    // C'est la règle qui empêche ce lot de couper Atlas aux artisans qui s'en
    // servent déjà, avant que la moindre offre existe.
    const ctx = await contexte("Sans offre");
    for (let i = 0; i < 6; i++) {
      const r = await donnerUnAcces(ctx, {
        nom: `Commercial ${i}`,
        email: `libre-${i}-${Date.now()}@t.test`,
        motDePasse: "motdepasse-douze",
        confirmation: "motdepasse-douze",
        role: "commercial",
      });
      assert.equal(r.ok, true, `le commercial ${i} a été refusé sans abonnement`);
    }
    assert.equal(await compterLesFabricants(ctx), 7);
  });

  await test("EN « ENTREPRISE », LA SIXIÈME PERSONNE AUX DEVIS EST REFUSÉE", async () => {
    const ctx = await contexte("Plafonnée");
    await enregistrerLAbonnement(ctx, etat({ abonnementPrestataire: "sub_P", formule: "entreprise" }));

    // Le patron compte déjà pour un : il reste quatre places.
    for (let i = 0; i < 4; i++) {
      const r = await donnerUnAcces(ctx, {
        nom: `Commercial ${i}`,
        email: `plafond-${i}-${Date.now()}@t.test`,
        motDePasse: "motdepasse-douze",
        confirmation: "motdepasse-douze",
        role: "commercial",
      });
      assert.equal(r.ok, true, `le commercial ${i} a été refusé alors qu'il reste de la place`);
    }
    assert.equal(await compterLesFabricants(ctx), 5);

    const sixieme = await donnerUnAcces(ctx, {
      nom: "Le sixième",
      email: `sixieme-${Date.now()}@t.test`,
      motDePasse: "motdepasse-douze",
      confirmation: "motdepasse-douze",
      role: "salarie",
    });
    assert.equal(sixieme.ok, true, "un SALARIÉ de plus a été refusé : il ne devrait jamais compter");

    const septieme = await donnerUnAcces(ctx, {
      nom: "Le commercial de trop",
      email: `trop-${Date.now()}@t.test`,
      motDePasse: "motdepasse-douze",
      confirmation: "motdepasse-douze",
      role: "commercial",
    });
    assert.equal(septieme.ok, false, "la sixième personne aux devis est passée");
    if (!septieme.ok) assert.equal(septieme.refus, "plafond-atteint");
  });

  await test("AUCUN COMPTE ORPHELIN quand le plafond refuse", async () => {
    // Créer le compte puis refuser l'adhésion laisserait une adresse « déjà
    // prise » que le patron ne pourrait plus réemployer.
    const ctx = await contexte("Sans orphelin");
    await enregistrerLAbonnement(ctx, etat({ abonnementPrestataire: "sub_O", formule: "artisan" }));

    const email = `orphelin-${Date.now()}@t.test`;
    const refus = await donnerUnAcces(ctx, {
      nom: "Refusé",
      email,
      motDePasse: "motdepasse-douze",
      confirmation: "motdepasse-douze",
      role: "commercial",
    });
    assert.equal(refus.ok, false);

    const { rows } = await pool.query<{ n: string }>(`SELECT count(*)::text AS n FROM users WHERE email = $1`, [
      email,
    ]);
    assert.equal(rows[0].n, "0", "un compte a été créé alors que l'accès était refusé");
  });

  await test("PROMOUVOIR UN SALARIÉ le fait entrer dans le plafond — la porte de côté", async () => {
    // C'est par là qu'on franchirait le plafond sans s'en apercevoir :
    // personne ne s'ajoute, un rôle change.
    const ctx = await contexte("Promotion");
    await enregistrerLAbonnement(ctx, etat({ abonnementPrestataire: "sub_Q", formule: "artisan" }));

    const ajout = await donnerUnAcces(ctx, {
      nom: "Un gars",
      email: `promu-${Date.now()}@t.test`,
      motDePasse: "motdepasse-douze",
      confirmation: "motdepasse-douze",
      role: "salarie",
    });
    assert.equal(ajout.ok, true);

    const liste = await listerAcces(ctx);
    const gars = liste.find((l) => l.role === "salarie");
    assert.ok(gars, "le salarié ajouté est introuvable");

    const promotion = await changerLeRole(ctx, gars.id, "commercial");
    assert.equal(promotion.ok, false, "le salarié est devenu commercial malgré le plafond « Artisan »");
    if (!promotion.ok) assert.equal(promotion.refus, "plafond-atteint");

    // Et l'inverse reste possible : redescendre ne consomme aucune place.
    const retour = await changerLeRole(ctx, gars.id, "salarie");
    assert.equal(retour.ok, true, "on ne peut plus remettre quelqu'un salarié");
  });

  console.log(`\n${passed} test(s) réussi(s), ${failed} échoué(s).`);
  await fermerLimiteur();
  await pool.end();
  if (failed > 0) process.exit(1);
}

main().catch(async (err) => {
  console.error(err);
  await fermerLimiteur();
  await pool.end();
  process.exit(1);
});
