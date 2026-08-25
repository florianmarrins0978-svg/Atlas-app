// Le condensat du mot de passe est hors de portée du rôle applicatif — M9.
//
// ─────────────────────────────────────────────────────────────────────────────
// **CETTE SUITE PARLE À LA BASE SOUS `atlas_app`, ET C'EST TOUT SON INTÉRÊT.**
//
// Les suites navigateur démarrent leur serveur sous un rôle qui TRAVERSE la RLS
// et tous les droits : jouée là, cette propriété serait invisible
// (`CLAUDE.md` §5). On ouvre donc une connexion explicite sous `atlas_app`, le
// rôle réel de l'application, et l'on essaie de lire ce qu'il ne doit plus voir.
//
// ─────────────────────────────────────────────────────────────────────────────
// **CE QUI ÉTAIT VRAI AVANT, ET QUI FAISAIT ROUGIR CETTE SUITE.**
//
// `atlas_app` détenait `SELECT` au niveau de la TABLE `users` :
//
//     SELECT id, email, password_hash FROM users;   -- ← rendait TOUT
//
// Une seule requête métier fautive suffisait donc à sortir les condensats de
// tous les utilisateurs.
//
// **Éprouvé en rendant les anciens droits**, le 25 août 2026 : sept cas
// rougissent alors. Quatre par eux-mêmes — les refus de lecture et d'écriture —
// et **trois en cascade**, ce qui vaut d'être compris plutôt que corrigé :
// l'ancien droit d'`UPDATE` laisse le quatrième cas poser POUR DE BON un faux
// condensat sur l'utilisateur d'essai. La connexion et le changement de mot de
// passe tombent ensuite, sur un compte que la suite vient elle-même de murer.
//
// C'est la démonstration la plus directe de ce que le retrait d'`UPDATE`
// protège : sans lui, il n'y a même pas besoin de LIRE un condensat pour entrer
// — il suffit d'en poser un que l'on connaît.

import assert from "node:assert/strict";
import { Pool } from "pg";
import { hash as bcrypt } from "bcryptjs";

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

/** La connexion du RÔLE APPLICATIF — celle qui sert en production. */
const appli = new Pool({
  connectionString:
    process.env.DATABASE_APP_URL ?? "postgresql://atlas_app:atlas_app_ci_pw@localhost:5432/atlas_test",
});
/** Le rôle propriétaire, pour poser le décor. */
const proprio = new Pool({
  connectionString:
    process.env.DATABASE_ADMIN_URL ?? "postgresql://atlas_owner:atlas_owner_ci_pw@localhost:5432/atlas_test",
});

/** Un refus de droits, et pas une autre erreur : le code 42501 le dit. */
async function refuseParLesDroits(requete: string, parametres: unknown[] = []): Promise<boolean> {
  try {
    await appli.query(requete, parametres);
    return false;
  } catch (e) {
    return (e as { code?: string })?.code === "42501";
  }
}

async function main() {
  console.log("=== Le condensat, hors de portée du rôle applicatif ===\n");

  const marque = Date.now();
  const email = `m9-${marque}@test.local`;
  const motDePasse = "un-mot-de-passe-qui-tient";
  const condensat = await bcrypt(motDePasse, 10);
  const { rows } = await proprio.query(
    `INSERT INTO users (email, nom, password_hash) VALUES ($1, 'M9', $2) RETURNING id`,
    [email, condensat]
  );
  const utilisateurId = rows[0].id as string;

  // ─── LES REFUS ────────────────────────────────────────────────────────────

  await essai("UN SELECT GLOBAL DES CONDENSATS EST REFUSÉ", async () => {
    assert.ok(
      await refuseParLesDroits(`SELECT id, email, password_hash FROM users`),
      "le rôle applicatif peut encore sortir tous les condensats"
    );
  });

  await essai("le condensat D'UN UTILISATEUR CONNU est refusé", async () => {
    assert.ok(
      await refuseParLesDroits(`SELECT password_hash FROM users WHERE id = $1`, [utilisateurId]),
      "le condensat d'un utilisateur visé reste lisible"
    );
  });

  await essai("le condensat ne sort pas non plus DÉTOURNÉ — sous-requête, agrégat, tri", async () => {
    /**
     * **Les chemins de biais**, ceux qu'une injection emprunte vraiment. Un droit
     * de colonne s'applique partout où la colonne est lue, y compris là où elle
     * n'apparaît pas dans le résultat : un `ORDER BY` sur elle fuirait déjà de
     * l'information par l'ordre des lignes.
     */
    const biais: [string, unknown[]][] = [
      [`SELECT (SELECT password_hash FROM users WHERE id = $1) AS h`, [utilisateurId]],
      [`SELECT string_agg(password_hash, ',') FROM users`, []],
      [`SELECT id FROM users ORDER BY password_hash`, []],
      [`SELECT id FROM users WHERE password_hash LIKE '$2%'`, []],
      [`SELECT * FROM users LIMIT 1`, []],
      [`COPY (SELECT password_hash FROM users) TO STDOUT`, []],
    ];
    const passes: string[] = [];
    for (const [requete, parametres] of biais) {
      if (!(await refuseParLesDroits(requete, parametres))) passes.push(requete);
    }
    assert.deepEqual(passes, [], `Ces requêtes ont atteint le condensat : ${passes.join(" | ")}`);
  });

  await essai("l'ÉCRITURE du condensat est refusée elle aussi", async () => {
    /**
     * **Sans ce retrait, la lecture ne servirait à rien.** Poser un condensat
     * connu sur un compte, puis entrer avec, ne demande de lire quoi que ce soit.
     */
    assert.ok(
      await refuseParLesDroits(`UPDATE users SET password_hash = $1 WHERE id = $2`, ["$2b$10$" + "x".repeat(53), utilisateurId]),
      "le rôle applicatif peut encore ÉCRIRE un condensat"
    );
    assert.ok(
      await refuseParLesDroits(
        `INSERT INTO users (email, password_hash) VALUES ($1, $2)`,
        [`intrus-${marque}@test.local`, "$2b$10$" + "x".repeat(53)]
      ),
      "le rôle applicatif peut encore CRÉER un compte avec un condensat choisi"
    );
  });

  // ─── CE QUI DOIT CONTINUER DE MARCHER ─────────────────────────────────────

  await essai("les colonnes ORDINAIRES restent lisibles — rien n'a été muré", async () => {
    const r = await appli.query(`SELECT id, email, nom, jetons_valides_depuis, charte FROM users WHERE id = $1`, [
      utilisateurId,
    ]);
    assert.equal(r.rows[0]?.email, email);
  });

  await essai("LA CONNEXION FONCTIONNE — le bon mot de passe rend l'identifiant", async () => {
    const r = await appli.query(`SELECT public.verifier_mot_de_passe($1, $2) AS id`, [email, motDePasse]);
    assert.equal(r.rows[0]?.id, utilisateurId, "le bon mot de passe n'ouvre plus");
  });

  await essai("un MAUVAIS mot de passe est refusé, normalement", async () => {
    const r = await appli.query(`SELECT public.verifier_mot_de_passe($1, $2) AS id`, [email, "pas-le-bon"]);
    assert.equal(r.rows[0]?.id, null, "un mauvais mot de passe ouvre");
  });

  await essai("une adresse INCONNUE est refusée sans rien dire de plus", async () => {
    const r = await appli.query(`SELECT public.verifier_mot_de_passe($1, $2) AS id`, [
      `jamais-vu-${marque}@test.local`,
      motDePasse,
    ]);
    assert.equal(r.rows[0]?.id, null);
  });

  await essai("LA FONCTION NE REND JAMAIS DE CONDENSAT, quoi qu'on lui demande", async () => {
    /**
     * **Le cas « appel détourné » du brief.** Les trois fonctions rendent un
     * `uuid` ou un `boolean` : leur signature interdit le condensat. On le
     * vérifie sur le catalogue plutôt que sur la parole du fichier — un
     * commentaire peut mentir, `pg_proc` non.
     */
    const r = await appli.query(
      `SELECT p.proname, pg_get_function_result(p.oid) AS retour
         FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
        WHERE n.nspname = 'public'
          AND p.proname IN ('verifier_mot_de_passe','verifier_mot_de_passe_de','changer_mot_de_passe')
        ORDER BY 1`
    );
    assert.equal(r.rows.length, 3, "les trois fonctions ne sont pas toutes là");
    for (const ligne of r.rows) {
      assert.match(
        ligne.retour,
        /^(uuid|boolean)$/,
        `${ligne.proname} rend « ${ligne.retour} » — une signature qui pourrait porter un condensat`
      );
    }
  });

  await essai("PUBLIC n'a PAS le droit d'appeler ces fonctions", async () => {
    /**
     * PostgreSQL accorde `EXECUTE` à `PUBLIC` par défaut sur toute fonction
     * neuve. Sans le `REVOKE`, n'importe quel rôle de la base — y compris ceux
     * qu'on ajouterait demain — pourrait éprouver des mots de passe.
     */
    const r = await proprio.query(
      `SELECT p.proname, has_function_privilege('public', p.oid, 'EXECUTE') AS public_peut
         FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
        WHERE n.nspname = 'public'
          AND p.proname IN ('verifier_mot_de_passe','verifier_mot_de_passe_de','changer_mot_de_passe')`
    );
    const ouverts = r.rows.filter((l) => l.public_peut).map((l) => l.proname);
    assert.deepEqual(ouverts, [], `PUBLIC peut appeler : ${ouverts.join(", ")}`);
  });

  await essai("les fonctions sont VERROUILLÉES : propriétaire, search_path, definer", async () => {
    const r = await proprio.query(
      `SELECT p.proname, pg_get_userbyid(p.proowner) AS proprietaire, p.prosecdef, p.proconfig
         FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
        WHERE n.nspname = 'public'
          AND p.proname IN ('verifier_mot_de_passe','verifier_mot_de_passe_de','changer_mot_de_passe')`
    );
    for (const l of r.rows) {
      assert.equal(l.proprietaire, "atlas_owner", `${l.proname} n'appartient pas au rôle propriétaire`);
      assert.equal(l.prosecdef, true, `${l.proname} n'est pas SECURITY DEFINER`);
      assert.ok(
        (l.proconfig ?? []).some((c: string) => c.startsWith("search_path=")),
        `${l.proname} n'épingle pas son search_path : celui de l'appelant déciderait`
      );
    }
  });

  await essai("et `atlas_app` NE PEUT PAS remplacer ce à quoi elles font confiance", async () => {
    // Sans cela, tout le reste tomberait : il suffirait de créer un `public.crypt`
    // à soi, ou une table `public.users` qui masque la vraie.
    const r = await appli.query(`SELECT has_schema_privilege('atlas_app','public','CREATE') AS peut_creer`);
    assert.equal(r.rows[0].peut_creer, false, "atlas_app peut créer dans public : il peut donc piéger les fonctions");
  });

  // ─── LE CHANGEMENT DE MOT DE PASSE ────────────────────────────────────────

  await essai("LE CHANGEMENT DE MOT DE PASSE FONCTIONNE — et l'ancien ne marche plus", async () => {
    const nouveau = "un-autre-mot-de-passe-2026";
    const nouveauCondensat = await bcrypt(nouveau, 10);
    const r = await appli.query(`SELECT public.changer_mot_de_passe($1::uuid, $2, $3) AS ok`, [
      utilisateurId,
      motDePasse,
      nouveauCondensat,
    ]);
    assert.equal(r.rows[0]?.ok, true, "le changement a été refusé alors que l'ancien était juste");

    const avecNouveau = await appli.query(`SELECT public.verifier_mot_de_passe($1, $2) AS id`, [email, nouveau]);
    assert.equal(avecNouveau.rows[0]?.id, utilisateurId, "le nouveau mot de passe n'ouvre pas");

    const avecAncien = await appli.query(`SELECT public.verifier_mot_de_passe($1, $2) AS id`, [email, motDePasse]);
    assert.equal(avecAncien.rows[0]?.id, null, "L'ANCIEN MOT DE PASSE OUVRE ENCORE");
  });

  await essai("changer SANS l'ancien mot de passe est refusé — la fonction n'est pas une porte", async () => {
    const choisi = await bcrypt("celui-de-l-intrus", 10);
    const r = await appli.query(`SELECT public.changer_mot_de_passe($1::uuid, $2, $3) AS ok`, [
      utilisateurId,
      "je-ne-le-connais-pas",
      choisi,
    ]);
    assert.equal(r.rows[0]?.ok, false, "un condensat a pu être posé sans connaître l'ancien mot de passe");
  });

  await essai("un condensat MALFORMÉ est refusé — pas de compte muré en silence", async () => {
    let leve = false;
    try {
      await appli.query(`SELECT public.changer_mot_de_passe($1::uuid, $2, $3) AS ok`, [
        utilisateurId,
        "un-autre-mot-de-passe-2026",
        "",
      ]);
    } catch {
      leve = true;
    }
    assert.ok(leve, "une chaîne vide a été acceptée comme condensat : le compte serait muré");
  });

  // ─── CE QUE M9 NE DOIT PAS AVOIR CASSÉ ────────────────────────────────────

  await essai("FACE ID N'EST PAS CASSÉ — ses clés vivent ailleurs et se lisent toujours", async () => {
    // `cles_appareil` ne porte aucune donnée biométrique et ne touche jamais
    // `password_hash` : le durcissement ne peut pas l'atteindre. On le vérifie
    // plutôt que de l'affirmer.
    const r = await appli.query(`SELECT count(*) AS n FROM cles_appareil`);
    assert.ok(Number(r.rows[0].n) >= 0, "la table des clés d'appareil n'est plus lisible");
  });

  await essai("LA COUPURE DES SESSIONS N'EST PAS CASSÉE — lecture ET écriture", async () => {
    // `jetons_valides_depuis` est ce que « me déconnecter partout » avance, et
    // ce que chaque requête relit. Les deux droits devaient survivre au retrait.
    await appli.query(`UPDATE users SET jetons_valides_depuis = now() WHERE id = $1`, [utilisateurId]);
    const r = await appli.query(`SELECT jetons_valides_depuis FROM users WHERE id = $1`, [utilisateurId]);
    assert.ok(r.rows[0]?.jetons_valides_depuis, "la coupure des sessions ne s'écrit ou ne se relit plus");
  });

  await proprio.query(`DELETE FROM users WHERE email = $1`, [email]);
  await appli.end();
  await proprio.end();

  console.log("");
  console.log(`Secret d'authentification — ${echecs} échec(s).`);
  process.exit(echecs > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
