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
  ecrireIdentite,
  changerMotDePasse,
  deconnecterPartout,
  coupureDesJetons,
} from "../src/server/repositories/compte";
import { ajouterCle, cleParIdentifiant, listerCles } from "../src/server/repositories/cles-appareil";

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

  await essai("écrire son identité n'écrit que la sienne", async () => {
    const { ctxA, ctxB } = await monter();
    await ecrireIdentite(ctxA, { civilite: "mme", prenom: "Anne", nom: "Amiot" });
    const a = await lireCompte(ctxA);
    assert.equal(a?.civilite, "mme");
    assert.equal(a?.prenom, "Anne");
    assert.equal(a?.nom, "Amiot");
    assert.equal((await lireCompte(ctxB))?.nom, "Bruno Berger", "le compte du voisin a bougé");
    assert.equal((await lireCompte(ctxB))?.civilite, null, "le voisin a hérité d'une civilité");
  });

  // Le nom du compte ne s'imprime sur aucun document, contrairement à celui de
  // l'entreprise : il peut être vidé, et un compte sans nom se désigne par son
  // e-mail.
  await essai("un nom vidé devient nul, il ne devient pas une chaîne vide", async () => {
    const { ctxA } = await monter();
    await ecrireIdentite(ctxA, { civilite: null, prenom: "   ", nom: "   " });
    assert.equal((await lireCompte(ctxA))?.nom, "");
    assert.equal((await lireCompte(ctxA))?.prenom, "");
    const [ligne] = await db
      .select({ nom: users.nom, prenom: users.prenom, civilite: users.civilite })
      .from(users)
      .where(eq(users.id, ctxA.utilisateurId));
    assert.equal(ligne.nom, null, "la base porte une chaîne vide plutôt qu'un vide");
    assert.equal(ligne.prenom, null, "le prénom vidé porte une chaîne vide plutôt qu'un vide");
    assert.equal(ligne.civilite, null, "la civilité retirée n'est pas nulle");
  });

  // LA CONTRAINTE DE LA BASE REFUSERAIT UN TROISIÈME CODE (migration 0077), et
  // l'application ne doit jamais l'atteindre : une civilité inconnue est
  // NEUTRALISÉE avant l'écriture. Ce qui arrive ici d'ailleurs est une donnée
  // fausse, pas une panne à faire remonter au patron.
  await essai("une civilité inconnue devient nulle, elle ne fait pas tomber l'écriture", async () => {
    const { ctxA } = await monter();
    await ecrireIdentite(ctxA, { civilite: "professeur", prenom: "Anne", nom: "Amiot" });
    assert.equal((await lireCompte(ctxA))?.civilite, null);
    assert.equal((await lireCompte(ctxA))?.prenom, "Anne", "le reste de l'identité a été perdu");
  });

  // LES DROITS DE `users` SONT ACCORDÉS COLONNE PAR COLONNE (migration 0064).
  // Une colonne neuve sans `GRANT` échouerait sur un « permission denied for
  // table users » qui désigne la TABLE — donc au mauvais endroit — et l'on
  // chercherait du côté de la RLS, qui n'a rien à voir. Cet essai-ci le dirait
  // tout de suite, et il vaut pour la PROCHAINE colonne autant que pour
  // celles-ci.
  await essai("le rôle applicatif lit et écrit bien les colonnes neuves", async () => {
    const { ctxA } = await monter();
    await ecrireIdentite(ctxA, { civilite: "mr", prenom: "Aimé", nom: "Amiot" });
    const relu = await lireCompte(ctxA);
    assert.equal(relu?.civilite, "mr", "civilite illisible : le GRANT SELECT manque");
    assert.equal(relu?.prenom, "Aimé", "prenom illisible : le GRANT SELECT manque");
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

  /**
   * **LE SEUL DÉFAUT DE SÉCURITÉ CONNU ET NON RÉPARÉ DU PRODUIT, jusqu'au
   * 7 septembre 2026.**
   *
   * Le scénario, et il n'a rien de théorique : une session volée ouvre les
   * Réglages et pose une clé Face ID sur SON téléphone. Le patron s'en aperçoit,
   * appuie sur « me déconnecter partout », change son mot de passe. Les jetons
   * tombent, les preuves tombent — et le voleur rentre par la porte de devant,
   * parce que `ouvrirAvecCle` ne consulte jamais la coupure.
   *
   * **Cette suite rougit contre la version d'avant ce lot**, et c'est sa raison
   * d'être : le défaut avait été trouvé le 25 août 2026, écrit à l'écran, et
   * reporté. Aucun contrôle ne le tenait, donc rien ne rappelait qu'il était
   * ouvert.
   *
   * On éprouve `cleParIdentifiant` et non `listerCles` : c'est par là que passe
   * la CONNEXION, et une clé qui ne s'affiche plus dans une liste tout en
   * ouvrant encore la porte serait le pire des deux mondes.
   */
  await essai("« ME DÉCONNECTER PARTOUT » FERME AUSSI LES PORTES FACE ID", async () => {
    const { ctxA } = await monter();
    const pose = await ajouterCle({
      utilisateurId: ctxA.utilisateurId,
      identifiantCle: "cle-posee-depuis-une-session-volee",
      clePublique: "publique-volee",
      compteur: 0,
      nomAppareil: "iPhone du voleur",
    });
    assert.equal(pose.ok, true, "le montage n'a pas posé de clé : la suite n'éprouverait rien");

    await deconnecterPartout(ctxA);

    assert.equal(
      await cleParIdentifiant("cle-posee-depuis-une-session-volee"),
      null,
      "la clé rouvre encore Atlas après « me déconnecter partout »"
    );
    assert.equal(
      (await listerCles(ctxA.utilisateurId)).length,
      0,
      "l'écran montrerait encore des appareils qui n'ouvrent plus rien"
    );
  });

  // **Et elle ne ferme QUE les siennes.** `cles_appareil` n'est couverte par
  // aucune politique d'isolation (`drizzle/0063_cles_appareil.sql`) : rien
  // d'autre que le `WHERE` ne retient cette suppression. Un `utilisateur_id`
  // oublié effacerait la porte de tous les artisans à la fois — exactement le
  // genre de correctif de sécurité qui coûte plus cher que le défaut.
  await essai("et elle ne retire pas les clés du voisin", async () => {
    const { ctxA, ctxB } = await monter();
    await ajouterCle({
      utilisateurId: ctxB.utilisateurId,
      identifiantCle: "cle-du-voisin",
      clePublique: "publique-voisin",
      compteur: 0,
      nomAppareil: "iPhone du voisin",
    });
    await deconnecterPartout(ctxA);
    assert.ok(
      await cleParIdentifiant("cle-du-voisin"),
      "le voisin a perdu son Face ID parce que quelqu'un d'autre s'est déconnecté"
    );
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
