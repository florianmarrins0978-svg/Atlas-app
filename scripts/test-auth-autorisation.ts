import assert from "node:assert";
import { hashSync } from "bcryptjs";
import { pool, db } from "../src/server/db/client";
import * as entreprisesRepo from "../src/server/repositories/entreprises";
import { users } from "../src/server/db/schema";
import { getCurrentCtx, AucuneEntrepriseError } from "../src/server/session-ctx";
import { getRole, estProprietaire, exigerProprietaire, AccesRoleRefuseError } from "../src/server/autorisation";
import { creerTarifAction, supprimerTarifAction } from "../src/app/reglages/actions";
import { fermerLimiteur } from "../src/server/rate-limit";

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

// membres_entreprise applique FORCE ROW LEVEL SECURITY : toute manipulation
// directe en SQL brut (comme dans ces tests) doit fixer app.entreprise_id
// pour la transaction, exactement comme le font déjà les repositories via
// withEntreprise().
async function ajouterMembre(entrepriseId: string, utilisateurId: string, role: "proprietaire" | "salarie") {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(`SELECT set_config('app.entreprise_id', $1, true)`, [entrepriseId]);
    await client.query(`INSERT INTO membres_entreprise (entreprise_id, utilisateur_id, role) VALUES ($1, $2, $3)`, [
      entrepriseId,
      utilisateurId,
      role,
    ]);
    await client.query("COMMIT");
  } finally {
    client.release();
  }
}

async function retirerMembre(entrepriseId: string, utilisateurId: string) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(`SELECT set_config('app.entreprise_id', $1, true)`, [entrepriseId]);
    await client.query(`DELETE FROM membres_entreprise WHERE entreprise_id = $1 AND utilisateur_id = $2`, [
      entrepriseId,
      utilisateurId,
    ]);
    await client.query("COMMIT");
  } finally {
    client.release();
  }
}

async function main() {
  const original = process.env.AUTH_TEST_UTILISATEUR_ID;
  delete process.env.AUTH_TEST_UTILISATEUR_ID;

  // --- Authentification ---

  await test("Accès non authentifié : getCurrentCtx() ne renvoie jamais un contexte silencieusement (aucune session, aucune dérogation)", async () => {
    // Note : hors d'une requête HTTP réelle (script Node), auth() d'Auth.js
    // lève sa propre erreur plutôt que de renvoyer null — ce test vérifie
    // uniquement l'absence de tout repli silencieux vers un contexte valide,
    // pas la classe exacte de l'erreur levée dans ce contexte de script.
    let resolu = false;
    try {
      await getCurrentCtx();
      resolu = true;
    } catch {
      resolu = false;
    }
    assert.equal(resolu, false, "Aucun contexte ne doit jamais être résolu sans session ni dérogation de test");
  });

  await test("Session valide : getCurrentCtx() résout un utilisateurId et un entrepriseId réels, jamais le premier de la base", async () => {
    const { entreprise: entA } = await entreprisesRepo.creerEntreprise(
      { nom: "Entreprise Auth A" },
      { email: `auth-a-${Date.now()}@test.local`, nom: "A" }
    );
    const { entreprise: entB, utilisateurId: userB } = await entreprisesRepo.creerEntreprise(
      { nom: "Entreprise Auth B" },
      { email: `auth-b-${Date.now()}@test.local`, nom: "B" }
    );
    // B a été créée APRÈS A : si getCurrentCtx() retombait sur "la première
    // entreprise de la base" (ancien comportement du stub), résoudre pour
    // l'utilisateur B renverrait à tort l'entreprise A.
    process.env.AUTH_TEST_UTILISATEUR_ID = userB;
    const ctx = await getCurrentCtx();
    assert.equal(ctx.utilisateurId, userB);
    assert.equal(ctx.entrepriseId, entB.id);
    assert.notEqual(ctx.entrepriseId, entA.id);
  });

  await test("Utilisateur sans aucune adhésion d'entreprise : rejet explicite, jamais un repli silencieux", async () => {
    const [utilisateurOrphelin] = await db
      .insert(users)
      .values({ email: `orphelin-${Date.now()}@test.local`, nom: "Orphelin" })
      .returning({ id: users.id });
    process.env.AUTH_TEST_UTILISATEUR_ID = utilisateurOrphelin.id;
    let leve = false;
    try {
      await getCurrentCtx();
    } catch (err) {
      leve = err instanceof AucuneEntrepriseError;
    }
    assert.ok(leve, "Doit lever AucuneEntrepriseError, jamais retomber sur une autre entreprise");
  });

  await test("Adhésion supprimée après authentification initiale : accès refusé dès la résolution suivante", async () => {
    const { entreprise, utilisateurId } = await entreprisesRepo.creerEntreprise(
      { nom: "Entreprise Adhesion Retiree" },
      { email: `retiree-${Date.now()}@test.local`, nom: "R" }
    );
    process.env.AUTH_TEST_UTILISATEUR_ID = utilisateurId;
    const ctxAvant = await getCurrentCtx();
    assert.equal(ctxAvant.entrepriseId, entreprise.id);

    await retirerMembre(entreprise.id, utilisateurId);

    let leve = false;
    try {
      await getCurrentCtx();
    } catch (err) {
      leve = err instanceof AucuneEntrepriseError;
    }
    assert.ok(leve, "Une adhésion retirée doit immédiatement bloquer tout accès ultérieur");
  });

  // --- Autorisation ---

  await test("Un membre (non propriétaire) ne peut pas exécuter une action réservée au propriétaire", async () => {
    const { entreprise, utilisateurId: proprietaireId } = await entreprisesRepo.creerEntreprise(
      { nom: "Entreprise Autorisation Membre" },
      { email: `proprietaire-${Date.now()}@test.local`, nom: "P" }
    );
    const [membreUser] = await db
      .insert(users)
      .values({ email: `membre-${Date.now()}@test.local`, nom: "Membre" })
      // **`returning({ id })` et NON `returning()` nu — c'est M9.** Depuis la
      // migration 0064, `atlas_app` n'a plus le SELECT sur toutes les colonnes
      // de `users` : un `RETURNING *` demande la lecture de `password_hash` et
      // se fait refuser. Trois suites l'ont appris en rougissant.
      //
      // **Et le rôle est « salarie », pas « membre »** : la migration 0065 l'a
      // renommé. Les deux moitiés viennent de deux lots différents, et la fusion
      // du 26 août 2026 devait garder les deux — l'une seule aurait cassé.
      .returning({ id: users.id });
    await ajouterMembre(entreprise.id, membreUser.id, "salarie");

    const ctxMembre = { entrepriseId: entreprise.id, utilisateurId: membreUser.id };
    const ctxProprietaire = { entrepriseId: entreprise.id, utilisateurId: proprietaireId };

    assert.equal(await estProprietaire(ctxMembre), false);
    assert.equal(await estProprietaire(ctxProprietaire), true);

    let leve = false;
    try {
      await exigerProprietaire(ctxMembre, "test");
    } catch (err) {
      leve = err instanceof AccesRoleRefuseError;
    }
    assert.ok(leve, "Un membre doit être rejeté par exigerProprietaire");

    // Ne doit jamais lever pour le propriétaire.
    await exigerProprietaire(ctxProprietaire, "test");
  });

  await test("Bout en bout : creerTarifAction rejette un membre, accepte le propriétaire", async () => {
    const { entreprise, utilisateurId: proprietaireId } = await entreprisesRepo.creerEntreprise(
      { nom: "Entreprise Tarif Autorisation" },
      { email: `tarif-prop-${Date.now()}@test.local`, nom: "P" }
    );
    const [membreUser] = await db
      .insert(users)
      .values({ email: `tarif-membre-${Date.now()}@test.local`, nom: "Membre" })
      // **`returning({ id })` et NON `returning()` nu — c'est M9.** Depuis la
      // migration 0064, `atlas_app` n'a plus le SELECT sur toutes les colonnes
      // de `users` : un `RETURNING *` demande la lecture de `password_hash` et
      // se fait refuser. Trois suites l'ont appris en rougissant.
      //
      // **Et le rôle est « salarie », pas « membre »** : la migration 0065 l'a
      // renommé. Les deux moitiés viennent de deux lots différents, et la fusion
      // du 26 août 2026 devait garder les deux — l'une seule aurait cassé.
      .returning({ id: users.id });
    await ajouterMembre(entreprise.id, membreUser.id, "salarie");

    process.env.AUTH_TEST_UTILISATEUR_ID = membreUser.id;
    let refuseMembre = false;
    try {
      await creerTarifAction("Tarif refusé", "10.00");
    } catch (err) {
      refuseMembre = err instanceof AccesRoleRefuseError;
    }
    assert.ok(refuseMembre, "Un membre ne doit jamais pouvoir créer un tarif");

    process.env.AUTH_TEST_UTILISATEUR_ID = proprietaireId;
    const tarif = await creerTarifAction("Tarif accepté", "10.00");
    assert.ok(tarif);
    await supprimerTarifAction(tarif.id);
  });

  await test("Rôles scopés par entreprise : un même utilisateur peut être propriétaire d'une société et membre d'une autre", async () => {
    const { entreprise: entX, utilisateurId } = await entreprisesRepo.creerEntreprise(
      { nom: "Entreprise Multi X" },
      { email: `multi-${Date.now()}@test.local`, nom: "M" }
    );
    const { entreprise: entY } = await entreprisesRepo.creerEntreprise(
      { nom: "Entreprise Multi Y" },
      { email: `multi-y-${Date.now()}@test.local`, nom: "MY" }
    );
    // Le même utilisateur devient membre simple d'une SECONDE entreprise.
    await ajouterMembre(entY.id, utilisateurId, "salarie");

    const roleDansX = await getRole({ entrepriseId: entX.id, utilisateurId });
    const roleDansY = await getRole({ entrepriseId: entY.id, utilisateurId });
    assert.equal(roleDansX, "proprietaire");
    assert.equal(roleDansY, "salarie");
  });

  await test("Mot de passe : un hash bcrypt valide est bien vérifiable (base du provider Credentials)", async () => {
    const motDePasse = "un-mot-de-passe-de-test-123";
    const hash = hashSync(motDePasse, 10);
    const { compare } = await import("bcryptjs");
    assert.equal(await compare(motDePasse, hash), true);
    assert.equal(await compare("mauvais-mot-de-passe", hash), false);
  });

  // Nettoyage : ne jamais laisser fuiter la dérogation de test vers d'autres suites.
  if (original === undefined) delete process.env.AUTH_TEST_UTILISATEUR_ID;
  else process.env.AUTH_TEST_UTILISATEUR_ID = original;

  console.log(`\n${passed} test(s) réussi(s), ${failed} échoué(s).`);
  // Le limiteur de débit ouvre une connexion Redis dès qu'une action protégée
  // est traversée. Sans cette fermeture, le processus ne rend jamais la main —
  // tests tous verts, batterie arrêtée pour toujours (8 août 2026).
  await pool.end();
  await fermerLimiteur();
  if (failed > 0) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
