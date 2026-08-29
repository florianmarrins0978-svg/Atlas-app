// Le compte de la personne : son nom, son mot de passe, sa déconnexion générale.
//
// **CE QUE CETTE SUITE TIENT, ET POURQUOI ELLE EXISTE.**
//
// `users` est la seule table de ce dépôt qui n'ait AUCUNE politique RLS — elle
// ne porte pas d'`entreprise_id`, et la même personne appartiendra demain à deux
// entreprises sans changer de nom. Tout le reste du produit est protégé par la
// base elle-même : ici, rien ne l'est. Ce qui empêche de renommer le compte du
// voisin ou de lui changer son mot de passe, c'est UNIQUEMENT le fait que
// chaque requête est bornée par `ctx.utilisateurId`.
//
// **Autrement dit : le filet de sécurité habituel est absent, et ces contrôles
// le remplacent.** Un `where` oublié dans `src/server/repositories/compte.ts`
// ne rougirait nulle part ailleurs — et changerait le mot de passe de tout le
// monde d'un coup.
//
// Éprouvée SOUS `atlas_app`, comme la production.

import assert from "node:assert/strict";
import { hash } from "bcryptjs";
import { eq } from "drizzle-orm";
import { db, pool } from "../src/server/db/client";
import { users } from "../src/server/db/schema";
import { nettoyerBase } from "./_test-db";
import { Pool } from "pg";
import { motDePasseEstCeluiDe } from "../src/server/secret-authentification";
import { creerEntreprise } from "../src/server/repositories/entreprises";
import {
  lireCompte,
  renommerCompte,
  changerMotDePasse,
  deconnecterPartout,
  coupureDesJetons,
} from "../src/server/repositories/compte";

let echecs = 0;
async function essai(nom: string, fn: () => Promise<void>) {
  try {
    await fn();
    console.log(`  ✓ ${nom}`);
  } catch (e) {
    echecs++;
    console.log(`  ✗ ${nom}`);
    console.log(`    ${(e as Error).message}`);
  }
}

const MDP = "bruyere-42-nord";

/** Le rôle qui a le droit d'écrire un condensat — pour le MONTAGE seulement. */
const proprietaire = new Pool({
  connectionString:
    process.env.DATABASE_ADMIN_URL ?? "postgresql://atlas_owner:atlas_owner_ci_pw@localhost:5432/atlas_test",
});

/** Deux entreprises, deux personnes — la seconde est le voisin qu'on ne doit pas toucher. */
async function monter() {
  await nettoyerBase();
  const a = await creerEntreprise({ nom: "Chez A" }, { email: "a@essai.local", nom: "Anne Amiot" });
  const b = await creerEntreprise({ nom: "Chez B" }, { email: "b@essai.local", nom: "Bruno Berger" });
  // `creerEntreprise` ne pose pas de mot de passe : le parcours d'inscription
  // n'existe pas encore (`TODO.md`). On le pose ici comme le fait le jeu de
  // démonstration, avec le même coût — sinon la comparaison n'éprouverait rien.
  // **Sous le rôle PROPRIÉTAIRE, depuis M9** (25 août 2026) : le rôle applicatif
  // n'a plus le droit d'écrire un condensat, et c'est exactement ce qu'on veut.
  // Un montage d'essai peut emprunter le rôle qui en a le droit ; la production,
  // elle, passe par la fonction — c'est ce que les contrôles ci-dessous vérifient.
  for (const id of [a.utilisateurId, b.utilisateurId]) {
    await proprietaire.query(`UPDATE users SET password_hash = $1 WHERE id = $2`, [
      await hash(MDP, 10),
      id,
    ]);
  }
  return {
    ctxA: { utilisateurId: a.utilisateurId, entrepriseId: a.entreprise.id },
    ctxB: { utilisateurId: b.utilisateurId, entrepriseId: b.entreprise.id },
  };
}

/**
 * **Ce qu'on observe désormais, c'est la RÈGLE, pas le stockage.**
 *
 * Cette suite lisait le condensat pour dire « il n'a pas bougé ». Depuis M9, le
 * rôle applicatif n'y a plus accès — et c'est une bonne nouvelle : la question
 * qui compte n'a jamais été « quelle chaîne est en base », mais « ce mot de
 * passe ouvre-t-il encore ? ». C'est ce que la production éprouve, et un
 * contrôle qui vise plus profond survit au prochain remaniement
 * (`CLAUDE.md` §5 bis).
 */
const ouvreAvec = (id: string, motDePasse: string) => motDePasseEstCeluiDe(id, motDePasse);

async function main() {
  console.log("=== Le compte : nom, mot de passe, déconnexion générale ===\n");

  await essai("chacun lit SON compte, jamais celui de l'autre", async () => {
    const { ctxA, ctxB } = await monter();
    assert.equal((await lireCompte(ctxA))?.email, "a@essai.local");
    assert.equal((await lireCompte(ctxB))?.email, "b@essai.local");
  });

  await essai("renommer son compte n'en renomme qu'un", async () => {
    const { ctxA, ctxB } = await monter();
    await renommerCompte(ctxA, "Anne A.");
    assert.equal((await lireCompte(ctxA))?.nom, "Anne A.");
    assert.equal((await lireCompte(ctxB))?.nom, "Bruno Berger", "le compte du voisin a bougé");
  });

  // Le nom du compte ne s'imprime sur aucun document, contrairement à celui de
  // l'entreprise : il peut être vidé, et un compte sans nom se désigne par son
  // e-mail.
  await essai("un nom vidé devient nul, il ne devient pas une chaîne vide", async () => {
    const { ctxA } = await monter();
    await renommerCompte(ctxA, "   ");
    assert.equal((await lireCompte(ctxA))?.nom, "");
    const [ligne] = await db.select({ nom: users.nom }).from(users).where(eq(users.id, ctxA.utilisateurId));
    assert.equal(ligne.nom, null, "la base porte une chaîne vide plutôt qu'un vide");
  });

  console.log("");

  await essai("le mot de passe change, et le nouveau ouvre pour de bon", async () => {
    const { ctxA } = await monter();
    const r = await changerMotDePasse(ctxA, MDP, "chene-tordu-7", "chene-tordu-7");
    assert.deepEqual(r, { ok: true });
    assert.ok(await ouvreAvec(ctxA.utilisateurId, "chene-tordu-7"), "le nouveau n'ouvre pas");
    assert.ok(!(await ouvreAvec(ctxA.utilisateurId, MDP)), "l'ancien ouvre encore");
  });

  // **LE CONTRÔLE QUI COMPTE.** Une session ouverte sur un téléphone laissé sur
  // une table suffirait sinon à changer le mot de passe — et le propriétaire du
  // compte se retrouverait dehors sans avoir rien fait.
  await essai("sans le mot de passe actuel, rien ne change", async () => {
    const { ctxA } = await monter();
    const r = await changerMotDePasse(ctxA, "pas-le-bon", "chene-tordu-7", "chene-tordu-7");
    assert.deepEqual(r, { ok: false, refus: "actuel-faux" });
    assert.ok(await ouvreAvec(ctxA.utilisateurId, MDP), "le mot de passe a bougé malgré le refus");
    assert.ok(!(await ouvreAvec(ctxA.utilisateurId, "chene-tordu-7")), "le nouveau a quand même été posé");
  });

  await essai("une confirmation différente ne change rien non plus", async () => {
    const { ctxA } = await monter();
    const r = await changerMotDePasse(ctxA, MDP, "chene-tordu-7", "chene-tordu-8");
    assert.deepEqual(r, { ok: false, refus: "confirmation-differente" });
    assert.ok(await ouvreAvec(ctxA.utilisateurId, MDP), "le mot de passe a bougé malgré le refus");
  });

  await essai("et un mot de passe trop court non plus", async () => {
    const { ctxA } = await monter();
    const r = await changerMotDePasse(ctxA, MDP, "court", "court");
    assert.deepEqual(r, { ok: false, refus: "trop-court" });
    assert.ok(await ouvreAvec(ctxA.utilisateurId, MDP), "le mot de passe a bougé malgré le refus");
  });

  // Le voisin partage le MÊME mot de passe de départ dans ce montage : si le
  // `where` sautait, son condensat changerait avec celui d'Anne sans qu'aucun
  // autre contrôle ne s'en aperçoive.
  await essai("changer son mot de passe ne touche pas celui du voisin", async () => {
    const { ctxA, ctxB } = await monter();
    await changerMotDePasse(ctxA, MDP, "chene-tordu-7", "chene-tordu-7");
    assert.ok(await ouvreAvec(ctxB.utilisateurId, MDP), "le voisin ne peut plus entrer");
    assert.ok(
      !(await ouvreAvec(ctxB.utilisateurId, "chene-tordu-7")),
      "le voisin a hérité du nouveau mot de passe d'Anne"
    );
  });

  console.log("");

  await essai("au départ, aucune coupure : tous les jetons valent", async () => {
    const { ctxA } = await monter();
    assert.equal(await coupureDesJetons(ctxA.utilisateurId), null);
  });

  await essai("« me déconnecter partout » pose une coupure", async () => {
    const { ctxA } = await monter();
    const rendue = await deconnecterPartout(ctxA);
    const lue = await coupureDesJetons(ctxA.utilisateurId);
    assert.ok(lue, "aucune coupure en base");
    assert.equal(lue.getTime(), rendue.getTime(), "la coupure rendue n'est pas celle qui est écrite");
  });

  // **LA SECONDE D'AVANCE, ET ELLE EST INDISPENSABLE.** Les jetons portent leur
  // émission en SECONDES entières (`iat`) : un jeton signé à 12:00:00,900
  // s'annonce à 12:00:00. Une coupure posée à la milliseconde près serait
  // antérieure à sa propre seconde, et le jeton du moment survivrait — le
  // patron appuierait sur « me déconnecter partout » en restant connecté sur
  // l'appareil qui vient d'appuyer.
  await essai("la coupure devance la seconde en cours, sinon elle ne coupe rien", async () => {
    const { ctxA } = await monter();
    const avant = Date.now();
    const coupure = await deconnecterPartout(ctxA);
    // Le jeton émis à l'instant même s'annonce à la seconde entière inférieure.
    const iatDuJetonCourant = Math.floor(avant / 1000) * 1000;
    assert.ok(
      coupure.getTime() > iatDuJetonCourant,
      `la coupure (${coupure.getTime()}) ne dépasse pas le jeton du moment (${iatDuJetonCourant})`
    );
    assert.equal(coupure.getTime() % 1000, 0, "la coupure n'est pas posée sur une seconde entière");
  });

  await essai("et elle ne déconnecte que lui", async () => {
    const { ctxA, ctxB } = await monter();
    await deconnecterPartout(ctxA);
    assert.equal(await coupureDesJetons(ctxB.utilisateurId), null, "le voisin a été déconnecté aussi");
  });

  console.log("");
  await pool.end();
  if (echecs) {
    console.log(`${echecs} ÉCHEC(S).`);
    process.exit(1);
  }
  console.log("Le compte — 0 échec(s).");
}

main().catch(async (e) => {
  console.error(e);
  await pool.end();
  process.exit(1);
});
