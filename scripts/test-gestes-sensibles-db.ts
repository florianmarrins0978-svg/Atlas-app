// LES QUATRE GESTES SENSIBLES — refusés sans preuve, et SANS AVOIR RIEN FAIT.
//
// ─────────────────────────────────────────────────────────────────────────────
// **CE QUE CETTE SUITE PROUVE, ET QUE `test-preuve-recente-db` NE PROUVE PAS.**
//
// L'autre suite éprouve la règle : une preuve appartient à une session, elle
// expire, elle ne fuit pas. Celle-ci éprouve **les gestes eux-mêmes**, en
// appelant les vraies actions serveur — pas une fonction pure, pas une regex sur
// un fichier.
//
// **Et elle vérifie surtout L'ORDRE.** Une garde qui lèverait APRÈS l'écriture
// ne prouverait rien : la clé serait enregistrée, l'IBAN changé, et l'exception
// arriverait trop tard. Chaque cas ci-dessous regarde donc l'état de la base
// après le refus.
//
// Éprouvée SOUS `atlas_app`, comme la production.

import assert from "node:assert/strict";
import { Pool } from "pg";
import { hash as bcrypt } from "bcryptjs";
import { pool, db } from "../src/server/db/client";
import { users, clesAppareil, entreprises } from "../src/server/db/schema";
import { eq } from "drizzle-orm";
import * as entreprisesRepo from "../src/server/repositories/entreprises";
import { poserPreuveParMotDePasse, effacerPreuves } from "../src/server/preuve-recente";
import { majIdentiteAction } from "../src/app/reglages/identite/actions";
import { retirerCleAction } from "../src/app/reglages/connexion/actions";
import { deconnecterPartoutAction } from "../src/app/reglages/connexion/actions";

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

async function main() {
  console.log("=== Les quatre gestes sensibles, et l'ordre des gardes ===\n");

  const marque = Date.now();
  const { entreprise, utilisateurId } = await entreprisesRepo.creerEntreprise(
    { nom: `Gestes ${marque}` },
    { email: `gestes-${marque}@test.local`, nom: "Patron" }
  );
  const SESSION = `session-gestes-${marque}`;

  // Une preuve ne naît plus que d'un mot de passe juste, vérifié DANS la base.
  const MOT_DE_PASSE = "le-mot-de-passe-des-gestes";
  await pool.query(`UPDATE users SET password_hash = $1 WHERE id = $2`, [
    await bcrypt(MOT_DE_PASSE, 10),
    utilisateurId,
  ]).catch(async () => {
    const proprio = new Pool({
      connectionString:
        process.env.DATABASE_ADMIN_URL ?? "postgresql://atlas_owner:atlas_owner_ci_pw@localhost:5432/atlas_test",
    });
    await proprio.query(`UPDATE users SET password_hash = $1 WHERE id = $2`, [
      await bcrypt(MOT_DE_PASSE, 10),
      utilisateurId,
    ]);
    await proprio.end();
  });
  const poserPreuve = async (id: string, session: string) => {
    const ok = await poserPreuveParMotDePasse(id, session, MOT_DE_PASSE);
    if (!ok) throw new Error("le montage n'a pas pu poser de preuve");
  };

  process.env.AUTH_TEST_UTILISATEUR_ID = utilisateurId;
  process.env.AUTH_TEST_SESSION_ID = SESSION;

  const ibanDeDepart = "FR7630001007941234567890185";
  await pool.query(`UPDATE entreprises SET iban = $1 WHERE id = $2`, [ibanDeDepart, entreprise.id]);

  /** L'identifiant interne de la clé d'essai — `retirerCleAction` attend celui-là. */
  let idCle = "";

  const ibanEnBase = async () =>
    (await pool.query(`SELECT iban FROM entreprises WHERE id = $1`, [entreprise.id])).rows[0]?.iban ?? null;

  // ─── 1. L'IBAN ────────────────────────────────────────────────────────────

  await essai("IBAN SANS PREUVE : refusé, et L'ANCIENNE VALEUR EST INTACTE", async () => {
    await effacerPreuves(utilisateurId);
    const r = await majIdentiteAction({ iban: "FR7630004000031234567890143" });
    assert.equal(r.ok, false, "l'IBAN a été changé sans preuve d'identité");
    assert.equal((r as { preuveExigee?: boolean }).preuveExigee, true, "le refus ne demande pas l'identité");
    assert.equal(
      await ibanEnBase(),
      ibanDeDepart,
      "L'IBAN A BOUGÉ MALGRÉ LE REFUS : la garde arrive après l'écriture"
    );
  });

  await essai("IBAN AVEC preuve : il change", async () => {
    await poserPreuve(utilisateurId, SESSION);
    const nouveau = "FR7630004000031234567890143";
    const r = await majIdentiteAction({ iban: nouveau });
    assert.equal(r.ok, true, `refusé alors que la preuve est là : ${JSON.stringify(r)}`);
    assert.equal(await ibanEnBase(), nouveau);
  });

  await essai("le RESTE de l'identité ne demande AUCUNE preuve", async () => {
    /**
     * **Le contrôle qui garde la garde utile.** Réclamer un mot de passe pour
     * corriger un numéro de téléphone apprend à le taper sans lire — et affaiblit
     * l'exigence le jour où elle compte (`CLAUDE.md` §4 ter).
     */
    await effacerPreuves(utilisateurId);
    const r = await majIdentiteAction({ telephone: "06 12 34 56 78" });
    assert.equal(r.ok, true, `un champ ordinaire réclame une preuve : ${JSON.stringify(r)}`);
  });

  await essai("réenvoyer le MÊME IBAN ne réclame rien non plus", async () => {
    // L'écran renvoie tous ses champs à chaque enregistrement : comparer à ce
    // qu'il envoie, et non à la base, ferait réclamer un mot de passe pour une
    // virgule dans l'adresse.
    await effacerPreuves(utilisateurId);
    const actuel = await ibanEnBase();
    const r = await majIdentiteAction({ iban: actuel, telephone: "06 12 34 56 78" });
    assert.equal(r.ok, true, `réenvoyer le même IBAN réclame une preuve : ${JSON.stringify(r)}`);
  });

  await essai("AUCUNE ÉCRITURE DE REPRÉSENTATION NE CONTOURNE LA GARDE", async () => {
    /**
     * **La nuance « seulement si ça change vraiment » crée une condition de
     * SÉCURITÉ, et elle doit être exacte dans les deux sens.**
     *
     * Le sens dangereux : un IBAN réellement différent qui passerait pour
     * identique. Il n'existe pas — `trim() || null` ne peut pas confondre deux
     * comptes distincts. Chacun des cas ci-dessous change le compte, et chacun
     * doit donc être refusé sans preuve.
     *
     * Les espacements et la casse penchent, eux, du côté SÛR : « FR76 3000 » et
     * « FR763000 » désignent le même compte, et la garde redemande quand même.
     * Redemander à tort coûte une saisie ; ne pas demander coûte un virement.
     */
    const depart = await ibanEnBase();
    const changements: [string, string][] = [
      ["un autre compte", "FR1420041010050500013M02606"],
      ["le même en minuscules", (depart ?? "").toLowerCase()],
      ["le même, espacé", (depart ?? "").replace(/(.{4})/g, "$1 ").trim()],
      ["effacé", ""],
      ["effacé par des espaces", "   "],
    ];
    const passes: string[] = [];
    for (const [quoi, valeur] of changements) {
      await effacerPreuves(utilisateurId);
      const r = await majIdentiteAction({ iban: valeur });
      if (r.ok) passes.push(quoi);
      // Et rien n'a bougé, dans tous les cas.
      if ((await ibanEnBase()) !== depart) passes.push(`${quoi} (ÉCRIT MALGRÉ TOUT)`);
    }
    assert.deepEqual(passes, [], `Ces changements bancaires n'ont demandé aucune preuve : ${passes.join(", ")}`);
  });

  await essai("POSER un IBAN là où il n'y en avait AUCUN demande une preuve", async () => {
    // Le cas le plus dangereux du lot : un compte vide qu'on remplit sans bruit.
    await poserPreuve(utilisateurId, SESSION);
    await majIdentiteAction({ iban: "" });
    assert.equal(await ibanEnBase(), null, "le montage n'a pas vidé l'IBAN");

    await effacerPreuves(utilisateurId);
    const r = await majIdentiteAction({ iban: "FR1420041010050500013M02606" });
    assert.equal(r.ok, false, "UN IBAN A ÉTÉ POSÉ SUR UN COMPTE VIDE SANS PREUVE");
    assert.equal(await ibanEnBase(), null);
  });

  await essai("changer un champ ORDINAIRE en même temps ne fait pas passer l'IBAN", async () => {
    // Le contournement le plus naturel : noyer le changement bancaire dans un
    // enregistrement qui touche aussi l'adresse.
    await effacerPreuves(utilisateurId);
    const r = await majIdentiteAction({
      iban: "FR1420041010050500013M02606",
      telephone: "06 99 99 99 99",
      adresse: "3 rue des Tilleuls",
    });
    assert.equal(r.ok, false, "l'IBAN est passé en même temps qu'un champ ordinaire");
    assert.equal(await ibanEnBase(), null, "L'IBAN A ÉTÉ ÉCRIT");
  });

  await essai("le TITULAIRE du compte compte autant que l'IBAN", async () => {
    // Détourner un virement ne demande pas forcément de changer le numéro.
    await effacerPreuves(utilisateurId);
    const r = await majIdentiteAction({ titulaireCompte: "Quelqu'un d'autre" });
    assert.equal(r.ok, false, "le titulaire du compte a changé sans preuve");
  });

  // ─── 2. Les clés d'appareil ───────────────────────────────────────────────

  console.log("");

  await essai("RETIRER UNE CLÉ SANS PREUVE : refusé, et LA CLÉ EST TOUJOURS LÀ", async () => {
    const { rows } = await pool.query(
      `INSERT INTO cles_appareil (utilisateur_id, identifiant_cle, cle_publique, compteur, nom_appareil)
       VALUES ($1, $2, $3, 0, 'iPhone') RETURNING id`,
      [utilisateurId, `cle-${marque}`, "clef-publique-essai"]
    );
    idCle = rows[0].id as string;
    await effacerPreuves(utilisateurId);

    const r = await retirerCleAction(idCle);
    assert.equal(r.ok, false, "une clé a été retirée sans preuve d'identité");
    assert.equal((r as { preuveExigee?: boolean }).preuveExigee, true, "le refus ne demande pas l'identité");

    const restantes = await db
      .select({ id: clesAppareil.identifiantCle })
      .from(clesAppareil)
      .where(eq(clesAppareil.utilisateurId, utilisateurId));
    assert.equal(restantes.length, 1, "LA CLÉ A ÉTÉ RETIRÉE MALGRÉ LE REFUS : la garde arrive trop tard");
  });

  await essai("…et une AUTRE SESSION du même patron ne la retire pas davantage", async () => {
    /**
     * Le cœur de M11, joué sur un vrai geste : la preuve du téléphone du patron
     * ne sert pas à l'ordinateur du voleur.
     */
    await poserPreuve(utilisateurId, `une-autre-session-${marque}`);
    const r = await retirerCleAction(idCle);
    assert.equal(r.ok, false, "LA PREUVE D'UNE AUTRE SESSION A SUFFI");
  });

  await essai("AVEC la preuve de CETTE session, la clé se retire", async () => {
    await poserPreuve(utilisateurId, SESSION);
    const r = await retirerCleAction(idCle);
    assert.equal(r.ok, true, `refusé alors que la preuve est là : ${JSON.stringify(r)}`);
    const restantes = await db
      .select({ id: clesAppareil.identifiantCle })
      .from(clesAppareil)
      .where(eq(clesAppareil.utilisateurId, utilisateurId));
    assert.equal(restantes.length, 0);
  });

  // ─── 3. « Me déconnecter partout » — SANS preuve ──────────────────────────

  console.log("");

  await essai("« ME DÉCONNECTER PARTOUT » MARCHE SANS PREUVE — c'est un geste d'urgence", async () => {
    /**
     * **Et il ne faut surtout pas le protéger.** C'est le geste de quelqu'un qui
     * craint d'être volé : lui réclamer son mot de passe au moment où il ferme
     * les portes gênerait la victime, pas le voleur — et il est peut-être sur un
     * chantier, sans son gestionnaire de mots de passe.
     */
    await effacerPreuves(utilisateurId);
    const r = await deconnecterPartoutAction();
    assert.equal(r.ok, true, `le geste d'urgence réclame une preuve : ${JSON.stringify(r)}`);
  });

  await essai("…et il EFFACE les preuves : elles n'attestent plus de rien", async () => {
    await poserPreuve(utilisateurId, SESSION);
    await deconnecterPartoutAction();
    await effacerPreuves(utilisateurId); // idempotent — on vérifie l'effet réel
    const { rows } = await pool.query(
      `SELECT count(*)::int AS n FROM preuves_authentification WHERE utilisateur_id = $1`,
      [utilisateurId]
    );
    assert.equal(rows[0].n, 0, "des preuves survivent à la coupure générale");
  });

  await pool.query(`DELETE FROM entreprises WHERE id = $1`, [entreprise.id]).catch(() => undefined);
  await pool.query(`DELETE FROM users WHERE id = $1`, [utilisateurId]).catch(() => undefined);
  delete process.env.AUTH_TEST_UTILISATEUR_ID;
  delete process.env.AUTH_TEST_SESSION_ID;
  await pool.end();

  console.log("");
  console.log(`Gestes sensibles — ${echecs} échec(s).`);
  process.exit(echecs > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
