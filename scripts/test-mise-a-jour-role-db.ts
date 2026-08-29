// La mise à jour du banc : réservée au PROPRIÉTAIRE — constat M12 du lot 3.
//
// ─────────────────────────────────────────────────────────────────────────────
// **CE QUE CETTE SUITE PROUVE, ET COMMENT ELLE LE PROUVE SANS DANGER.**
//
// `mettreAJourApplicationAction` lance un vrai `git pull` et de vraies
// migrations. Une suite qui la laisserait aller au bout tirerait du code
// pendant la batterie — c'est exactement ce qu'il ne faut pas.
//
// **Elle ne va donc jamais jusqu'à l'exécution**, et c'est l'ordre des gardes
// qui le garantit : le rôle est vérifié AVANT le banc, et le banc AVANT le
// script. Chaque cas ci-dessous s'arrête à l'une des deux premières.
//
// ─────────────────────────────────────────────────────────────────────────────
// **CE QUI ÉTAIT VRAI AVANT, ET QUI FAISAIT ROUGIR CETTE SUITE.**
//
// ```ts
// export async function mettreAJourApplicationAction() {
//   await getCurrentCtx();                              // ← une session, rien de plus
//   if (process.env.ATLAS_BANC_ESSAI !== "1") { … }     // ← et le profil ignoré
// ```
//
// Deux défauts, et les deux se voient ici :
//
// 1. **N'IMPORTE QUEL COMPTE CONNECTÉ** — un simple membre — pouvait tirer du
//    code et jouer des migrations sur le banc du patron ;
// 2. **`ATLAS_PROFIL=banc` était ignoré**, alors que `.devcontainer/demarrer.sh`
//    ne pose que celui-là. Le bouton refusait donc sur un banc parfaitement
//    reconnu partout ailleurs — `src/profil-banc.ts` est la seule fonction qui
//    en décide, et cette action ne l'employait pas.
//
// Ni base d'entreprise ni navigateur : des rôles, et de la lecture de source.

import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { estBancDEssai } from "../src/profil-banc";
import path from "node:path";
import { pool, db } from "../src/server/db/client";
import { users } from "../src/server/db/schema";
import * as entreprisesRepo from "../src/server/repositories/entreprises";

let echecs = 0;
async function essai(nom: string, fn: () => Promise<void> | void) {
  try {
    await fn();
    console.log(`  ✓ ${nom}`);
  } catch (e) {
    echecs++;
    console.log(`  ✗ ${nom}`);
    console.log(`    ${(e as Error).message}`);
  }
}

/**
 * `membres_entreprise` applique FORCE ROW LEVEL SECURITY : une écriture en SQL
 * brut doit poser `app.entreprise_id` pour sa transaction, exactement comme le
 * font les dépôts via `withEntreprise()`. Même gabarit que
 * `test-auth-autorisation.ts` — le recopier serait une seconde façon de faire.
 */
async function ajouterMembre(entrepriseId: string, utilisateurId: string) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(`SELECT set_config('app.entreprise_id', $1, true)`, [entrepriseId]);
    await client.query(
      // **« salarie » et non « membre » — la migration 0065 de main a renommé le
      // rôle, et posé une contrainte CHECK qui refuse l'ancien mot.** La règle
      // éprouvée ici n'a pas bougé d'un pouce : quelqu'un qui n'est pas le
      // patron est refusé. Seul le nom du rôle a changé, et le contrôle suit.
      `INSERT INTO membres_entreprise (entreprise_id, utilisateur_id, role) VALUES ($1, $2, 'salarie')`,
      [entrepriseId, utilisateurId]
    );
    await client.query("COMMIT");
  } finally {
    client.release();
  }
}

async function main() {
  console.log("=== La mise à jour du banc : qui a le droit ===\n");

  const { AccesRoleRefuseError } = await import("../src/server/autorisation");
  const { mettreAJourApplicationAction, derniereIssueMiseAJour } = await import(
    "../src/app/reglages/actions"
  );

  const marque = Date.now();
  const { entreprise, utilisateurId: proprietaireId } = await entreprisesRepo.creerEntreprise(
    { nom: `Entreprise Mise A Jour ${marque}` },
    { email: `maj-prop-${marque}@test.local`, nom: "P" }
  );
  const [membre] = await db
    .insert(users)
    .values({ email: `maj-membre-${marque}@test.local`, nom: "Membre" })
    .returning({ id: users.id });
  await ajouterMembre(entreprise.id, membre.id);

  const bancAvant = process.env.ATLAS_BANC_ESSAI;
  const profilAvant = process.env.ATLAS_PROFIL;
  const utilisateurAvant = process.env.AUTH_TEST_UTILISATEUR_ID;

  // ─── LE CŒUR : un membre est refusé, et refusé POUR SON RÔLE ──────────────

  await essai("UN MEMBRE EST REFUSÉ — et c'est bien le RÔLE qui le refuse", async () => {
    /**
     * **Le piège de ce contrôle, et pourquoi il est écrit ainsi.**
     *
     * Le banc est délibérément laissé ÉTEINT. L'ancien code refusait alors lui
     * aussi — mais pour le mauvais motif : « la mise à jour n'existe que sur le
     * banc d'essai ». Un contrôle qui se contenterait de constater un refus
     * serait donc vert sur le code défectueux, et ne prouverait rien.
     *
     * Ce qu'on exige ici est le refus de RÔLE, qui n'existait pas. Et comme il
     * précède la garde du banc, aucun script ne peut partir.
     */
    delete process.env.ATLAS_BANC_ESSAI;
    delete process.env.ATLAS_PROFIL;
    process.env.AUTH_TEST_UTILISATEUR_ID = membre.id;

    let leve: unknown = null;
    try {
      const r = await mettreAJourApplicationAction();
      assert.fail(
        `Un membre n'a pas été rejeté par son rôle. L'action a rendu : ${JSON.stringify(r)}`
      );
    } catch (e) {
      leve = e;
    }
    assert.ok(
      leve instanceof AccesRoleRefuseError,
      `Le refus n'est pas un refus de rôle : ${leve instanceof Error ? leve.message : String(leve)}`
    );
  });

  await essai("LE PROPRIÉTAIRE passe le rôle — et bute alors sur le banc éteint", async () => {
    // La garde du banc n'a pas été affaiblie en ajoutant celle du rôle : hors
    // banc, même le propriétaire est refusé, et le script ne part pas.
    delete process.env.ATLAS_BANC_ESSAI;
    delete process.env.ATLAS_PROFIL;
    process.env.AUTH_TEST_UTILISATEUR_ID = proprietaireId;

    const r = await mettreAJourApplicationAction();
    assert.equal(r.succes, false, "hors banc, l'action ne doit jamais réussir");
    assert.match(
      (r as { erreur: string }).erreur,
      /banc d'essai/i,
      "le refus hors banc ne nomme plus le banc"
    );
  });

  // ─── CE QUE LA MISE À JOUR RACONTE EST AUSSI RÉSERVÉ — constat F1 ─────────

  await essai("L'ISSUE DE LA DERNIÈRE MISE À JOUR est refusée à un membre", async () => {
    /**
     * **Cacher le bouton ne protégeait pas ce qu'il y a dessous.** C'est la
     * leçon de M12, appliquée une seconde fois : `derniereIssueMiseAJour` est
     * exportée d'un module `"use server"`, donc c'est un point d'entrée réseau
     * à part entière — et elle rendait à qui la demandait le contenu de
     * `/tmp/atlas-mise-a-jour.txt`, qui porte sur un échec un chemin du disque
     * et ce que `git` a écrit sur sa sortie d'erreur.
     *
     * L'écran ne l'appelle que derrière `role === "proprietaire"` : la garde ne
     * retire donc rien à personne — c'est le contrôle d'après qui le montre.
     */
    delete process.env.ATLAS_BANC_ESSAI;
    delete process.env.ATLAS_PROFIL;
    process.env.AUTH_TEST_UTILISATEUR_ID = membre.id;

    let leve: unknown = null;
    try {
      const issue = await derniereIssueMiseAJour();
      assert.fail(`Un membre a pu lire l'issue de la mise à jour : ${JSON.stringify(issue)}`);
    } catch (e) {
      leve = e;
    }
    assert.ok(
      leve instanceof AccesRoleRefuseError,
      `Le refus n'est pas un refus de rôle : ${leve instanceof Error ? leve.message : String(leve)}`
    );
  });

  await essai("LE PROPRIÉTAIRE, lui, la lit toujours — la garde ne casse pas l'écran", async () => {
    // La moitié qui protège du remède. Une garde qui refuserait aussi le
    // propriétaire ferait tomber l'écran Réglages en erreur, là où il ne
    // portait qu'une ligne d'information.
    process.env.AUTH_TEST_UTILISATEUR_ID = proprietaireId;
    const issue = await derniereIssueMiseAJour();
    assert.ok(
      issue === null || typeof issue === "string",
      `le propriétaire devrait obtenir une issue ou null — reçu ${JSON.stringify(issue)}`
    );
  });

  // ─── L'AUTRE MOITIÉ : les deux façons de reconnaître un banc ──────────────

  await essai("LES DEUX MARQUES DU BANC sont reconnues — plus une seule", () => {
    /**
     * **Lu dans la source, et c'est délibéré.** L'éprouver par l'exécution
     * demanderait de laisser l'action aller jusqu'au `git pull` : le seul moyen
     * sûr de prouver qu'elle emploie la bonne fonction est de le lire.
     *
     * `src/profil-banc.ts` est la seule qui décide de ce qu'est un banc
     * (`ATLAS_PROFIL=banc` OU `ATLAS_BANC_ESSAI=1`). L'action lisait la seconde
     * variable en direct : sur un banc démarré par `.devcontainer/demarrer.sh`,
     * qui ne pose que la première, le bouton refusait sans raison.
     */
    const source = readFileSync(
      path.join(process.cwd(), "src/app/reglages/actions.ts"),
      "utf8"
    );
    const corps = source.slice(source.indexOf("export async function mettreAJourApplicationAction"));
    const fin = corps.indexOf("\n}\n");
    const action = fin > 0 ? corps.slice(0, fin) : corps;

    assert.ok(
      action.includes("estBancDEssai("),
      "l'action ne passe pas par `estBancDEssai` — la reconnaissance du banc y est recopiée"
    );
    assert.ok(
      !/process\.env\.ATLAS_BANC_ESSAI/.test(action),
      "l'action lit encore `ATLAS_BANC_ESSAI` en direct : `ATLAS_PROFIL=banc` serait ignoré"
    );
  });

  await essai("un banc déclaré par ATLAS_PROFIL seul est bien un banc", () => {
    // La fonction centrale, éprouvée pour elle-même : c'est elle que l'action
    // emploie désormais, d'après le contrôle précédent.
    assert.equal(estBancDEssai({ ATLAS_PROFIL: "banc" }), true);
    assert.equal(estBancDEssai({ ATLAS_BANC_ESSAI: "1" }), true);
    assert.equal(estBancDEssai({}), false);
  });

  await essai("PLUS AUCUN ÉCRAN ne lit la marque du banc en direct", () => {
    /**
     * **Le contrôle qui empêche la divergence de revenir.** M12 n'était pas un
     * oubli isolé : trois endroits lisaient `ATLAS_BANC_ESSAI` à la main —
     * l'action de mise à jour, la phrase sur la branche suivie, et le calcul de
     * la version servie. Tous ignoraient `ATLAS_PROFIL=banc`, la seule marque
     * que `.devcontainer/demarrer.sh` pose réellement.
     *
     * Deux fichiers ont le droit de la lire, et eux seuls :
     *
     * | `src/profil-banc.ts` | c'est lui qui décide |
     * | `src/server/env.ts` | il refuse une configuration contradictoire, et doit donc voir les deux variables séparément |
     *
     * `src/server/etat-banc.ts` la nomme aussi, mais pour la **passer** à
     * `estBancDEssai` — ce n'est pas une seconde décision.
     */
    const racine = path.join(process.cwd(), "src");
    const coupables: string[] = [];
    const parcourir = (dossier: string) => {
      for (const entree of readdirSync(dossier, { withFileTypes: true })) {
        const chemin = path.join(dossier, entree.name);
        if (entree.isDirectory()) {
          parcourir(chemin);
          continue;
        }
        if (!/\.tsx?$/.test(entree.name)) continue;
        const relatif = path.relative(process.cwd(), chemin);
        if (relatif === "src/profil-banc.ts" || relatif === "src/server/env.ts") continue;
        const texte = readFileSync(chemin, "utf8");
        // Les commentaires racontent l'histoire de ce constat : on ne lit que
        // le code, sinon la documentation de la correction la ferait rougir.
        const code = texte
          .split("\n")
          .filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l))
          .join("\n");
        if (/process\.env\.ATLAS_BANC_ESSAI/.test(code)) coupables.push(relatif);
      }
    };
    parcourir(racine);
    assert.deepEqual(
      coupables,
      [],
      `Ces fichiers décident seuls de ce qu'est un banc, et ignorent donc ATLAS_PROFIL : ${coupables.join(", ")}`
    );
  });

  if (bancAvant === undefined) delete process.env.ATLAS_BANC_ESSAI;
  else process.env.ATLAS_BANC_ESSAI = bancAvant;
  if (profilAvant === undefined) delete process.env.ATLAS_PROFIL;
  else process.env.ATLAS_PROFIL = profilAvant;
  if (utilisateurAvant === undefined) delete process.env.AUTH_TEST_UTILISATEUR_ID;
  else process.env.AUTH_TEST_UTILISATEUR_ID = utilisateurAvant;

  console.log("");
  console.log(`Mise à jour du banc — ${echecs} échec(s).`);
  process.exit(echecs > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
