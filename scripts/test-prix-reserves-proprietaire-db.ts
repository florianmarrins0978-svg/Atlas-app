// Les prix de vente : un salarié ne les lit pas, et ne les écrit pas.
//
// **CE QUE CETTE SUITE PROTÈGE.** Audit du 23 août 2026, constat E3.
// `poserPrixGrilleAction` était la SEULE action de son fichier sans garde de
// rôle, quand ses neuf voisines en portaient une, et les écrans `/reglages/prix`
// et `/reglages/prix/mesures` n'en avaient aucune. Un salarié pouvait donc lire
// et réécrire la grille tarifaire de son patron — alors que la règle écrite
// dans le dépôt dit exactement l'inverse :
//
//   « un salarié peut changer ses notifications ou son mot de passe, mais il ne
//     doit évidemment pas pouvoir modifier les tarifs » — 13 août 2026
//   « ce qu'un rôle n'a pas le droit de voir ne doit pas SORTIR DU SERVEUR »
//                                              — src/lib/rubriques-reglages.ts
//
// **Le cas d'écriture rougirait sur l'ancien code** : l'action acceptait, et la
// valeur changeait en base.
//
// **ET LA MOITIÉ QUI PROTÈGE LE PRODUIT :** l'apprentissage automatique des
// prix depuis un devis doit continuer de fonctionner pour un salarié. Poser la
// garde un cran plus bas — dans le dépôt — l'aurait cassé, et personne n'aurait
// relié la panne à un contrôle de rôle.
//
// Éprouvée SOUS `atlas_app`, comme la production.

import assert from "node:assert/strict";
import { and, eq } from "drizzle-orm";
import { db, pool } from "../src/server/db/client";
import { grillePrix, membresEntreprise, users } from "../src/server/db/schema";
import { nettoyerBase } from "./_test-db";
import { creerEntreprise } from "../src/server/repositories/entreprises";
import { withEntreprise } from "../src/server/db/with-entreprise";
import { estProprietaire, exigerProprietaire, AccesRoleRefuseError } from "../src/server/autorisation";
import { lireGrillePrix, poserPrixGrille } from "../src/server/repositories/grille-prix";
import { lireGrilles } from "../src/server/repositories/grilles-reglables";
import { cellulesDe } from "../src/lib/grille-prix";
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

const PRIX_DU_PATRON = "980.00";
const PRIX_DU_SALARIE = "1.00";

/**
 * Deux cases RÉELLES de la grille d'abattage, prises dans le dépôt lui-même.
 *
 * **Pas une clé inventée**, et c'est le premier piège de cette suite : le dépôt
 * valide chaque case contre la liste des cases possibles (« une clé inventée ne
 * crée rien »). Une clé fabriquée à la main aurait fait passer les contrôles
 * pour la mauvaise raison — rien ne se serait écrit, y compris pour le patron,
 * et l'on aurait cru le salarié bloqué alors que personne n'écrivait.
 */
let CELLULE = "";
let CELLULE_APPRISE = "";

/**
 * Ce que fait l'action `poserPrixGrilleAction`, sans l'écran.
 *
 * Recopié plutôt qu'importé : le module d'actions est marqué `"use server"` et
 * appelle `getCurrentCtx()`, qui exige une vraie requête. Ce qu'on éprouve ici
 * est la SÉQUENCE — la garde d'abord, l'écriture ensuite —, et le contrôle du
 * bas vérifie qu'elle est bien celle du fichier réel.
 */
async function actionPoserPrix(ctx: Ctx, prix: string) {
  await exigerProprietaire(ctx, "poser un prix dans vos grilles");
  await poserPrixGrille(ctx, "abattage", CELLULE, prix, "saisi");
}

async function main() {
  console.log("=== Les prix de vente : à qui ils appartiennent ===\n");

  await nettoyerBase();

  // Une entreprise, son patron, et un salarié.
  const a = await creerEntreprise({ nom: "Chez A" }, { email: "patron@essai.local", nom: "Le patron" });
  const [salarie] = await db.insert(users).values({ email: "salarie@essai.local", nom: "Le salarié" }).returning();

  const ctxPatron: Ctx = { utilisateurId: a.utilisateurId, entrepriseId: a.entreprise.id };
  await withEntreprise(ctxPatron.utilisateurId, ctxPatron.entrepriseId, async (tx) => {
    await tx.insert(membresEntreprise).values({
      entrepriseId: a.entreprise.id,
      utilisateurId: salarie.id,
      role: "membre",
    });
  });
  const ctxSalarie: Ctx = { utilisateurId: salarie.id, entrepriseId: a.entreprise.id };

  await essai("les deux comptes sont bien ce qu'on croit", async () => {
    assert.equal(await estProprietaire(ctxPatron), true);
    assert.equal(await estProprietaire(ctxSalarie), false);
  });

  await essai("deux cases réelles de la grille d'abattage sont disponibles", async () => {
    const grilles = await lireGrilles(ctxPatron);
    const cellules = cellulesDe("abattage", grilles);
    assert.ok(cellules.length >= 2, "la grille d'abattage ne porte pas deux cases");
    CELLULE = cellules[0].cle;
    CELLULE_APPRISE = cellules[1].cle;
  });

  // ─── Le patron pose un prix : c'est son écran ────────────────────────────
  await essai("le patron pose un prix, normalement", async () => {
    await actionPoserPrix(ctxPatron, PRIX_DU_PATRON);
    const cases = await lireGrillePrix(ctxPatron, await lireGrilles(ctxPatron));
    const posee = cases.find((c) => c.cellule.cle === CELLULE);
    assert.ok(posee, "le prix du patron n'a pas été enregistré");
    assert.equal(posee!.prix, PRIX_DU_PATRON);
  });

  // ─── Le salarié : refusé, et la base ne bouge pas ────────────────────────
  await essai("le salarié ne peut PAS écrire un prix", async () => {
    await assert.rejects(
      () => actionPoserPrix(ctxSalarie, PRIX_DU_SALARIE),
      (e: Error) => e instanceof AccesRoleRefuseError,
      "l'écriture par un salarié a été acceptée"
    );
  });

  // **Le contrôle qui compte vraiment : la valeur EN BASE.** Vérifier que
  // l'action a levé ne prouve rien si l'écriture a eu lieu avant — c'est la
  // règle du dépôt, prouver l'enregistrement en base et pas à l'écran.
  await essai("…et la valeur en base n'a pas bougé d'un centime", async () => {
    const [ligne] = await withEntreprise(ctxPatron.utilisateurId, ctxPatron.entrepriseId, async (tx) =>
      tx
        .select()
        .from(grillePrix)
        .where(and(eq(grillePrix.nature, "abattage"), eq(grillePrix.cellule, CELLULE)))
        .limit(1)
    );
    assert.ok(ligne, "la case a disparu");
    assert.equal(ligne.prix, PRIX_DU_PATRON, "le salarié a réussi à changer le prix");
  });

  await essai("le salarié ne peut pas EFFACER un prix non plus", async () => {
    // Un prix vide efface la case : le refus doit couvrir ce chemin aussi.
    await assert.rejects(() => actionPoserPrix(ctxSalarie, ""), (e: Error) => e instanceof AccesRoleRefuseError);
    const cases = await lireGrillePrix(ctxPatron, await lireGrilles(ctxPatron));
    assert.ok(cases.some((c) => c.cellule.cle === CELLULE), "la case a été effacée par un salarié");
  });

  // ─── La moitié qui protège le PRODUIT ────────────────────────────────────
  //
  // Si la garde avait été posée dans le dépôt plutôt que dans l'action, ce cas
  // rougirait — et le salarié ne pourrait plus établir un devis.
  await essai("l'apprentissage automatique depuis un devis marche encore pour un salarié", async () => {
    await poserPrixGrille(ctxSalarie, "abattage", CELLULE_APPRISE, "1234.00", "devis");
    const cases = await lireGrillePrix(ctxPatron, await lireGrilles(ctxPatron));
    const apprise = cases.find((c) => c.cellule.cle === CELLULE_APPRISE);
    assert.ok(apprise, "un devis établi par un salarié n'apprend plus aucun prix");
    assert.equal(apprise!.origine, "devis");
  });

  // ─── Et la garde est-elle vraiment dans le fichier réel ? ────────────────
  //
  // La séquence ci-dessus est recopiée : sans ce contrôle, on éprouverait une
  // copie pendant que l'action réelle resterait ouverte.
  await essai("l'action réelle porte bien la garde, avant l'écriture", async () => {
    const { readFileSync } = await import("node:fs");
    const source = readFileSync("src/app/reglages/prix/actions.ts", "utf8");
    const corps = source.slice(source.indexOf("export async function poserPrixGrilleAction"));
    const garde = corps.indexOf("exigerProprietaire");
    const ecriture = corps.indexOf("poserPrixGrille(");
    assert.ok(garde > 0, "poserPrixGrilleAction n'appelle pas exigerProprietaire");
    assert.ok(garde < ecriture, "la garde vient APRÈS l'écriture");
  });

  await essai("les écrans des prix refusent un salarié avant toute lecture", async () => {
    const { readFileSync } = await import("node:fs");
    for (const page of ["src/app/reglages/prix/page.tsx", "src/app/reglages/prix/mesures/page.tsx"]) {
      const source = readFileSync(page, "utf8");
      const garde = source.indexOf("estProprietaire(ctx)");
      const lecture = source.search(/await (lireGrilles|lireGrillePrix|prixParTranche)\(/);
      assert.ok(garde > 0, `${page} ne vérifie aucun rôle`);
      assert.ok(garde < lecture, `${page} lit des prix AVANT de vérifier le rôle`);
    }
  });

  console.log("");
  console.log(`Les prix de vente — ${echecs} échec(s).`);
  await pool.end();
  process.exit(echecs > 0 ? 1 : 0);
}

main().catch(async (e) => {
  console.error(e);
  await pool.end();
  process.exit(1);
});
