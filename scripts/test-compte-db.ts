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
import { compare, hash } from "bcryptjs";
import { eq } from "drizzle-orm";
import { db, pool } from "../src/server/db/client";
import { users } from "../src/server/db/schema";
import { nettoyerBase } from "./_test-db";
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

/** Deux entreprises, deux personnes — la seconde est le voisin qu'on ne doit pas toucher. */
async function monter() {
  await nettoyerBase();
  const a = await creerEntreprise({ nom: "Chez A" }, { email: "a@essai.local", nom: "Anne Amiot" });
  const b = await creerEntreprise({ nom: "Chez B" }, { email: "b@essai.local", nom: "Bruno Berger" });
  // `creerEntreprise` ne pose pas de mot de passe : le parcours d'inscription
  // n'existe pas encore (`TODO.md`). On le pose ici comme le fait le jeu de
  // démonstration, avec le même coût — sinon la comparaison n'éprouverait rien.
  for (const id of [a.utilisateurId, b.utilisateurId]) {
    await db.update(users).set({ passwordHash: await hash(MDP, 10) }).where(eq(users.id, id));
  }
  return {
    ctxA: { utilisateurId: a.utilisateurId, entrepriseId: a.entreprise.id },
    ctxB: { utilisateurId: b.utilisateurId, entrepriseId: b.entreprise.id },
  };
}

const condensat = async (id: string) =>
  (await db.select({ h: users.passwordHash }).from(users).where(eq(users.id, id)).limit(1))[0]?.h ?? null;

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
    const h = await condensat(ctxA.utilisateurId);
    assert.ok(h && (await compare("chene-tordu-7", h)), "le nouveau ne correspond pas");
    assert.ok(h && !(await compare(MDP, h)), "l'ancien ouvre encore");
  });

  // **LE CONTRÔLE QUI COMPTE.** Une session ouverte sur un téléphone laissé sur
  // une table suffirait sinon à changer le mot de passe — et le propriétaire du
  // compte se retrouverait dehors sans avoir rien fait.
  await essai("sans le mot de passe actuel, rien ne change", async () => {
    const { ctxA } = await monter();
    const avant = await condensat(ctxA.utilisateurId);
    const r = await changerMotDePasse(ctxA, "pas-le-bon", "chene-tordu-7", "chene-tordu-7");
    assert.deepEqual(r, { ok: false, refus: "actuel-faux" });
    assert.equal(await condensat(ctxA.utilisateurId), avant, "le condensat a bougé malgré le refus");
  });

  await essai("une confirmation différente ne change rien non plus", async () => {
    const { ctxA } = await monter();
    const avant = await condensat(ctxA.utilisateurId);
    const r = await changerMotDePasse(ctxA, MDP, "chene-tordu-7", "chene-tordu-8");
    assert.deepEqual(r, { ok: false, refus: "confirmation-differente" });
    assert.equal(await condensat(ctxA.utilisateurId), avant);
  });

  await essai("et un mot de passe trop court non plus", async () => {
    const { ctxA } = await monter();
    const avant = await condensat(ctxA.utilisateurId);
    const r = await changerMotDePasse(ctxA, MDP, "court", "court");
    assert.deepEqual(r, { ok: false, refus: "trop-court" });
    assert.equal(await condensat(ctxA.utilisateurId), avant);
  });

  // Le voisin partage le MÊME mot de passe de départ dans ce montage : si le
  // `where` sautait, son condensat changerait avec celui d'Anne sans qu'aucun
  // autre contrôle ne s'en aperçoive.
  await essai("changer son mot de passe ne touche pas celui du voisin", async () => {
    const { ctxA, ctxB } = await monter();
    const avantB = await condensat(ctxB.utilisateurId);
    await changerMotDePasse(ctxA, MDP, "chene-tordu-7", "chene-tordu-7");
    assert.equal(await condensat(ctxB.utilisateurId), avantB, "le condensat du voisin a bougé");
    const hB = await condensat(ctxB.utilisateurId);
    assert.ok(hB && (await compare(MDP, hB)), "le voisin ne peut plus entrer");
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
