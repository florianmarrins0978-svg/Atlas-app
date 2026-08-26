// DONNER, CHANGER ET RETIRER UN ACCÈS — éprouvé en base, sous `atlas_app`.
//
// **Ce que cette suite protège.** Sa demande du 25 août 2026 : *« il faut qu'il
// leur crée un compte salarié […] chaque utilisateur possède son propre compte
// et sa propre session »*, et *« les restrictions d'accès doivent être
// appliquées côté serveur, et pas uniquement en masquant des boutons »*.
//
// Elle éprouve les quatre gestes et les quatre garde-fous que rien d'autre ne
// tient :
//
//   1. un compte créé ici OUVRE VRAIMENT une session — sans quoi le patron
//      aurait donné un accès qui n'ouvre rien, et c'est son salarié qui le
//      découvrirait au pied du chantier ;
//   2. le dernier patron ne peut ni se rétrograder ni se retirer, sinon
//      l'entreprise n'a plus personne pour donner un accès et l'on n'en sort
//      qu'en touchant la base à la main ;
//   3. une portée resserrée SANS équipe rattachée est refusée, et non traitée
//      comme « tout » — le patron croirait avoir restreint ;
//   4. **l'isolation tient** : le patron de B ne voit ni ne touche les accès
//      de A. C'est la promesse de tout ce dépôt, et elle vaut aussi ici.
//
// Éprouvée SOUS `atlas_app`, comme la production : un rôle qui traverse la RLS
// ferait passer le point 4 pour la mauvaise raison.

import assert from "node:assert/strict";
import { compare } from "bcryptjs";
import { eq } from "drizzle-orm";
import { db, pool } from "../src/server/db/client";
import { users } from "../src/server/db/schema";
import { nettoyerBase } from "./_test-db";
import { creerEntreprise } from "../src/server/repositories/entreprises";
import {
  changerLaPortee,
  changerLeRole,
  donnerUnAcces,
  listerAcces,
  retirerUnAcces,
} from "../src/server/repositories/membres-entreprise";
import { accesDeLaPersonne, getRole } from "../src/server/autorisation";
import type { Ctx } from "../src/server/repositories/context";

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

const MOT_DE_PASSE = "trois-mots-courts";

async function main() {
  console.log("=== Donner, changer et retirer un accès ===\n");

  await nettoyerBase();

  const a = await creerEntreprise({ nom: "Chez A" }, { email: "patron-a@essai.local", nom: "Patron A" });
  const b = await creerEntreprise({ nom: "Chez B" }, { email: "patron-b@essai.local", nom: "Patron B" });
  const ctxA: Ctx = { utilisateurId: a.utilisateurId, entrepriseId: a.entreprise.id };
  const ctxB: Ctx = { utilisateurId: b.utilisateurId, entrepriseId: b.entreprise.id };

  await essai("le fondateur est patron, et il est seul", async () => {
    const liste = await listerAcces(ctxA);
    assert.equal(liste.length, 1);
    assert.equal(liste[0].role, "proprietaire");
    assert.equal(liste[0].email, "patron-a@essai.local");
  });

  await essai("donner un accès crée un compte, attaché à CETTE entreprise", async () => {
    const r = await donnerUnAcces(ctxA, {
      nom: "Malik Benali",
      email: "  Malik@Essai.Local ",
      motDePasse: MOT_DE_PASSE,
      confirmation: MOT_DE_PASSE,
      role: "salarie",
    });
    assert.deepEqual(r, { ok: true });

    const liste = await listerAcces(ctxA);
    assert.equal(liste.length, 2);
    const malik = liste.find((l) => l.nom === "Malik Benali");
    // **L'adresse est normalisée** — minuscules, sans espaces — exactement comme
    // à la connexion. Sans cela le compte existerait et n'ouvrirait jamais.
    assert.equal(malik?.email, "malik@essai.local");
    assert.equal(malik?.role, "salarie");
    // Le défaut est « tout » : restreindre est un geste, pas un état de départ.
    assert.equal(malik?.porteePlanning, "tout");
  });

  await essai("ce compte OUVRE vraiment — le mot de passe est celui qui a été donné", async () => {
    // Sans ce contrôle, on aurait pu créer un compte que personne ne peut
    // ouvrir, et c'est le salarié qui l'aurait découvert au pied du chantier.
    const [ligne] = await db
      .select({ hash: users.passwordHash })
      .from(users)
      .where(eq(users.email, "malik@essai.local"))
      .limit(1);
    assert.ok(ligne?.hash, "le compte n'a aucun mot de passe");
    assert.equal(await compare(MOT_DE_PASSE, ligne.hash), true);
    assert.equal(await compare("autre-chose-de-long", ligne.hash), false);
  });

  await essai("son rôle se lit depuis SA session, pas depuis celle du patron", async () => {
    const liste = await listerAcces(ctxA);
    const malik = liste.find((l) => l.email === "malik@essai.local")!;
    const ctxMalik: Ctx = { utilisateurId: malik.utilisateurId, entrepriseId: a.entreprise.id };
    assert.equal(await getRole(ctxMalik), "salarie");
    assert.equal((await accesDeLaPersonne(ctxMalik))?.porteePlanning, "tout");
  });

  await essai("la même adresse ne se donne pas deux fois", async () => {
    const r = await donnerUnAcces(ctxA, {
      nom: "Un autre Malik",
      email: "malik@essai.local",
      motDePasse: MOT_DE_PASSE,
      confirmation: MOT_DE_PASSE,
      role: "commercial",
    });
    assert.deepEqual(r, { ok: false, refus: "email-deja-pris" });
  });

  await essai("un mot de passe trop court est refusé, comme partout ailleurs", async () => {
    const r = await donnerUnAcces(ctxA, {
      nom: "Camille",
      email: "camille@essai.local",
      motDePasse: "court",
      confirmation: "court",
      role: "commercial",
    });
    assert.deepEqual(r, { ok: false, refus: "mot-de-passe-trop-court" });
    // **Et rien ne doit rester en base d'un refus** : un compte à moitié créé
    // rendrait l'adresse indisponible sans que personne sache pourquoi.
    const [fantome] = await db.select({ id: users.id }).from(users).where(eq(users.email, "camille@essai.local"));
    assert.equal(fantome, undefined);
  });

  /**
   * **LA SECONDE SAISIE EST VÉRIFIÉE AU SERVEUR, pas seulement à l'écran.**
   *
   * Sa demande du 26 août 2026 : *« il faut confirmer son mdp donc l'écrire
   * deux fois »*. Un contrôle qui ne vivrait que dans le formulaire ne
   * protégerait de rien — et surtout pas de ce qu'il protège vraiment : le
   * patron tape un mot de passe qu'il devra DICTER à son salarié. Une faute de
   * frappe non rattrapée le laisse dehors, et personne ne sait pourquoi.
   */
  await essai("une confirmation qui diffère est refusée, et rien n'est créé", async () => {
    const r = await donnerUnAcces(ctxA, {
      nom: "Camille",
      email: "camille-confirmation@essai.local",
      motDePasse: MOT_DE_PASSE,
      confirmation: `${MOT_DE_PASSE}x`,
      role: "commercial",
    });
    assert.deepEqual(r, { ok: false, refus: "mot-de-passe-confirmation" });
    const [fantome] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, "camille-confirmation@essai.local"));
    assert.equal(fantome, undefined, "un compte est resté en base malgré le refus");
  });

  await essai("une adresse qui n'en est pas une est refusée", async () => {
    const r = await donnerUnAcces(ctxA, {
      nom: "Camille",
      email: "camille",
      motDePasse: MOT_DE_PASSE,
      confirmation: MOT_DE_PASSE,
      role: "commercial",
    });
    assert.deepEqual(r, { ok: false, refus: "email-invalide" });
  });

  await essai("le patron resserre ce qu'un salarié voit du planning", async () => {
    const malik = (await listerAcces(ctxA)).find((l) => l.email === "malik@essai.local")!;

    // Sans équipe rattachée, le resserrement est REFUSÉ — pas accepté puis
    // ignoré. Un planning vide se voit et se répare ; un planning entier sous
    // une restriction croyable ne se voit pas.
    assert.deepEqual(await changerLaPortee(ctxA, malik.id, "ses_equipes", null), {
      ok: false,
      refus: "equipe-manquante",
    });

    const equipe = await premiereEquipe(ctxA);
    assert.deepEqual(await changerLaPortee(ctxA, malik.id, "ses_equipes", equipe), { ok: true });

    const apres = (await listerAcces(ctxA)).find((l) => l.email === "malik@essai.local")!;
    assert.equal(apres.porteePlanning, "ses_equipes");
    assert.equal(apres.equipeId, equipe);
  });

  await essai("promu commercial, il retrouve le planning entier", async () => {
    const malik = (await listerAcces(ctxA)).find((l) => l.email === "malik@essai.local")!;
    assert.deepEqual(await changerLeRole(ctxA, malik.id, "commercial"), { ok: true });

    const apres = (await listerAcces(ctxA)).find((l) => l.email === "malik@essai.local")!;
    assert.equal(apres.role, "commercial");
    // Une restriction de salarié laissée sur un commercial lui cacherait des
    // chantiers sans que rien ne l'explique.
    assert.equal(apres.porteePlanning, "tout");
    assert.equal(apres.equipeId, null);
  });

  await essai("un rôle qui n'existe pas est refusé", async () => {
    const malik = (await listerAcces(ctxA)).find((l) => l.email === "malik@essai.local")!;
    assert.deepEqual(await changerLeRole(ctxA, malik.id, "administrateur"), { ok: false, refus: "role-inconnu" });
  });

  await essai("le dernier patron ne peut ni se rétrograder ni se retirer", async () => {
    const patron = (await listerAcces(ctxA)).find((l) => l.role === "proprietaire")!;
    assert.deepEqual(await changerLeRole(ctxA, patron.id, "salarie"), { ok: false, refus: "dernier-patron" });
    assert.deepEqual(await retirerUnAcces(ctxA, patron.id), { ok: false, refus: "soi-meme" });
    assert.equal(await getRole(ctxA), "proprietaire");
  });

  await essai("deux patrons : l'un peut alors retirer l'autre", async () => {
    assert.deepEqual(
      await donnerUnAcces(ctxA, {
        nom: "Second patron",
        email: "second@essai.local",
        motDePasse: MOT_DE_PASSE,
        confirmation: MOT_DE_PASSE,
        role: "proprietaire",
      }),
      { ok: true }
    );
    const second = (await listerAcces(ctxA)).find((l) => l.email === "second@essai.local")!;
    assert.deepEqual(await retirerUnAcces(ctxA, second.id), { ok: true });
    assert.equal((await listerAcces(ctxA)).some((l) => l.email === "second@essai.local"), false);
  });

  await essai("retirer un accès n'efface PAS le compte", async () => {
    // Ses chantiers, devis et clients le référencent : l'effacer les casserait.
    // Et un accès retiré par erreur se redonne ; un compte effacé ne revient pas.
    const [compte] = await db.select({ id: users.id }).from(users).where(eq(users.email, "second@essai.local"));
    assert.ok(compte, "le compte a été supprimé avec son accès");
  });

  await essai("le patron de B ne voit rien des accès de A", async () => {
    const chezB = await listerAcces(ctxB);
    assert.equal(chezB.length, 1);
    assert.equal(chezB[0].email, "patron-b@essai.local");
  });

  await essai("le patron de B ne peut pas toucher un accès de A", async () => {
    const malik = (await listerAcces(ctxA)).find((l) => l.email === "malik@essai.local")!;
    // L'adhésion existe — mais pas pour B : la RLS ne la lui rend pas, donc il
    // ne la trouve pas, donc il ne la change pas. Le refus est le même que pour
    // une adhésion inexistante, et c'est voulu : distinguer les deux dirait à un
    // curieux qu'il a visé juste.
    assert.deepEqual(await changerLeRole(ctxB, malik.id, "proprietaire"), { ok: false, refus: "role-inconnu" });
    assert.deepEqual(await retirerUnAcces(ctxB, malik.id), { ok: false, refus: "role-inconnu" });

    // Et rien n'a bougé chez A.
    const apres = (await listerAcces(ctxA)).find((l) => l.email === "malik@essai.local")!;
    assert.equal(apres.role, "commercial");
  });

  console.log("");
  console.log(`Donner, changer et retirer un accès — ${echecs} échec(s).`);
  await pool.end();
  process.exit(echecs > 0 ? 1 : 0);
}

/** La première file du planning de cette entreprise, créée au besoin. */
async function premiereEquipe(ctx: Ctx): Promise<string> {
  const { nommerEquipe } = await import("../src/server/repositories/equipes");
  const equipe = await nommerEquipe(ctx, 1, "Malik");
  return equipe.id;
}

main().catch(async (e) => {
  console.error(e);
  await pool.end();
  process.exit(1);
});
