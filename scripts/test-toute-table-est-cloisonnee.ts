// AUCUNE TABLE NE DOIT NAÎTRE MOINS PROTÉGÉE QUE LES AUTRES.
//
// ═══════════════════════════════════════════════════════════════════════════
// **LE DÉFAUT QUE CETTE SUITE EMPÊCHE, ET POURQUOI IL EST SILENCIEUX.**
//
// Le rôle propriétaire a posé, dans `0001_securite_integrite.sql`, des
// privilèges par défaut :
//
//     ALTER DEFAULT PRIVILEGES … GRANT SELECT, INSERT, UPDATE, DELETE
//                                ON TABLES TO atlas_app;
//
// C'est commode et c'est voulu : sans eux, chaque migration devrait penser à
// accorder ses droits, et l'oubli produirait une panne bruyante. Mais cela veut
// dire qu'**une table créée demain est immédiatement lisible et modifiable par
// le rôle applicatif** — celui que tous les artisans partagent.
//
// Or `ROW LEVEL SECURITY`, elle, est **éteinte par défaut**. Les deux réglages
// vont donc en sens contraire : les droits arrivent tout seuls, le cloisonnement
// non. Une migration qui crée `remises_client (id, entreprise_id, …)` et oublie
// ses trois lignes de RLS produit une table où **chaque artisan lit et modifie
// les lignes de tous les autres** — sans erreur, sans avertissement, et sans
// qu'aucune suite existante ne s'en aperçoive.
//
// C'est exactement la forme de défaut que ce dépôt redoute le plus : la batterie
// reste verte, les écrans marchent, et la fuite ne se voit qu'au moment où deux
// entreprises réelles cohabitent — c'est-à-dire chez le patron, en production.
//
// ═══════════════════════════════════════════════════════════════════════════
// **CE QU'ELLE NE FAIT PAS, ET C'EST DÉLIBÉRÉ.**
//
// Elle ne réclame pas la RLS sur *toutes* les tables. Une bonne moitié du schéma
// est **globale par nature** — le catalogue des fiches phytosanitaires, les
// taxons, les documents légaux, les termes métier : ces lignes n'appartiennent à
// personne, et les cloisonner les rendrait invisibles à tout le monde.
//
// Le critère retenu est donc **factuel, pas décrété** : une table qui porte une
// colonne `entreprise_id` désigne elle-même le cloisonnement qu'elle attend.
// Aucune liste à tenir à la main, aucune table neuve à penser à inscrire — c'est
// le schéma qui répond, et c'est ce qui fait tenir le contrôle dans six mois.
//
// ═══════════════════════════════════════════════════════════════════════════
// **CE QU'ELLE A TROUVÉ EN NAISSANT** (29 août 2026, audit final) :
//
//   · rien à corriger dans l'état du schéma — les 42 tables d'entreprise sont
//     toutes en `FORCE ROW LEVEL SECURITY`, et les deux files de purge qui font
//     exception le font pour une raison écrite (`CLAUDE.md` §4) ;
//   · mais **aucun contrôle ne regardait cela**. Les suites existantes vérifient
//     la FORME des politiques (`test-isolation-contexte-vide-db.ts`) et le
//     comportement des migrations sous la RLS (`test-migrations-sous-rls.ts`) —
//     aucune ne vérifiait leur PRÉSENCE. Le lot suivant en aurait été quitte
//     pour un oubli invisible.

import assert from "node:assert/strict";
import { Client } from "pg";

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

/**
 * Les tables qui portent `entreprise_id` SANS être cloisonnées, et pourquoi.
 *
 * **Chaque entrée est une dette assumée, pas un interrupteur.** Une exception
 * sans raison écrite redevient un oubli à la première relecture — c'est
 * l'idiome que ce dépôt applique déjà à `test-objets-stockes.ts` et à
 * `test-migrations-sous-rls.ts`.
 *
 * Ces deux-là sont des **files de travail de maintenance**, et `CLAUDE.md` §4
 * les prescrit nommément : la purge tourne sans contexte d'entreprise, et c'est
 * précisément pour ne PAS avoir à contourner la RLS qu'elle passe par une file
 * portant l'entreprise concernée. Les cloisonner rendrait la file illisible au
 * travail de fond, et l'on retomberait sur le contournement qu'elles évitent.
 *
 * Ce qu'elles ne contiennent pas, et qui borne le risque : aucune donnée
 * d'artisan. Une clé de stockage et une date, rien d'autre.
 */
const FILES_DE_PURGE_SANS_RLS: Record<string, string> = {
  audios_a_purger:
    "file de purge des audios : lue par le travail de fond, qui n'a pas de contexte d'entreprise. " +
    "C'est le motif que CLAUDE.md §4 impose pour ne pas contourner la RLS. Ne porte qu'une clé " +
    "de stockage et une date — aucune donnée d'artisan.",
  photos_diagnostic_a_purger:
    "même motif que audios_a_purger, pour les photos de diagnostic végétal. Ne porte qu'une clé " +
    "de stockage et une date.",
};

type Etat = {
  table: string;
  rls: boolean;
  force: boolean;
  politiques: number;
  porte_entreprise_id: boolean;
  ecriture_app: boolean;
};

async function main() {
  console.log("=== Toute table d'entreprise est-elle cloisonnée ? ===\n");

  // **Le rôle propriétaire, pas l'applicatif.** `pg_class` et `pg_policy` sont
  // lisibles par tous, mais `information_schema.table_privileges` ne montre à
  // `atlas_app` que ses propres droits : la question « atlas_app peut-il écrire
  // ici ? » se pose depuis un rôle qui voit la réponse.
  const url = process.env.DATABASE_ADMIN_URL ?? process.env.DATABASE_URL;
  if (!url) {
    console.error(
      "❌ Ni DATABASE_ADMIN_URL ni DATABASE_URL : ce contrôle n'a pas de base à interroger.\n" +
        "   Il refuse de conclure plutôt que de rendre un vert sur rien."
    );
    process.exit(2);
  }

  const client = new Client({ connectionString: url });
  await client.connect();

  const { rows: tables } = await client.query<Etat>(`
    SELECT c.relname                                                          AS table,
           c.relrowsecurity                                                   AS rls,
           c.relforcerowsecurity                                              AS force,
           (SELECT count(*) FROM pg_policy p WHERE p.polrelid = c.oid)::int   AS politiques,
           EXISTS (SELECT 1 FROM pg_attribute a
                    WHERE a.attrelid = c.oid AND a.attname = 'entreprise_id'
                      AND a.attnum > 0 AND NOT a.attisdropped)                AS porte_entreprise_id,
           EXISTS (SELECT 1 FROM information_schema.table_privileges tp
                    WHERE tp.table_schema = 'public' AND tp.table_name = c.relname
                      AND tp.grantee = 'atlas_app'
                      AND tp.privilege_type IN ('INSERT','UPDATE','DELETE'))  AS ecriture_app
      FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
     WHERE n.nspname = 'public' AND c.relkind = 'r'
     ORDER BY c.relname
  `);

  // ─── LE GARDE-FOU DE `CLAUDE.md` §5 : refuser de conclure sur rien ─────────
  //
  // Une base non migrée, un mauvais schéma, une requête qui casse un jour : dans
  // tous ces cas `tables` vaudrait [] et TOUTES les assertions ci-dessous
  // passeraient. Un contrôle qui ne mesure rien ne dit pas « rouge », il ne dit
  // plus rien — et c'est le pire des états.
  await essai("le schéma est bien lu — sinon ce contrôle ne mesure RIEN", async () => {
    assert.ok(
      tables.length >= 50,
      `seulement ${tables.length} table(s) lue(s) : la base n'est pas migrée, ou ce n'est pas ` +
        "celle d'Atlas. Rien n'a été vérifié."
    );
    assert.ok(
      tables.some((t) => t.porte_entreprise_id),
      "aucune table ne porte entreprise_id : la détection est cassée, et tout passerait."
    );
  });

  // ─── 1. LE CONTRÔLE PRINCIPAL ─────────────────────────────────────────────
  await essai("toute table portant entreprise_id est en ROW LEVEL SECURITY", async () => {
    const nues = tables
      .filter((t) => t.porte_entreprise_id && !t.rls)
      .filter((t) => !(t.table in FILES_DE_PURGE_SANS_RLS))
      .map((t) => t.table);

    assert.deepEqual(
      nues,
      [],
      `Ces tables portent entreprise_id et n'ont AUCUN cloisonnement :\n      ${nues.join("\n      ")}\n` +
        "    Les privilèges par défaut donnent déjà à atlas_app le droit d'y écrire : chaque\n" +
        "    artisan lit et modifie donc les lignes de tous les autres, sans la moindre erreur.\n" +
        "    Ajouter dans la migration :\n" +
        "      ALTER TABLE <t> ENABLE ROW LEVEL SECURITY;\n" +
        "      ALTER TABLE <t> FORCE ROW LEVEL SECURITY;\n" +
        "      CREATE POLICY <t>_isolation ON <t> USING (\n" +
        "        entreprise_id = NULLIF(current_setting('app.entreprise_id', true), '')::uuid);\n" +
        "    Le NULLIF n'est pas un ornement — voir test-isolation-contexte-vide-db.ts."
    );
  });

  // ─── 2. `FORCE`, sans quoi le propriétaire passe outre ────────────────────
  //
  // Les migrations tournent sous `atlas_owner`, qui est le propriétaire des
  // tables. Sans `FORCE`, la RLS ne s'applique pas à lui : une migration
  // pourrait lire et recopier les lignes de toutes les entreprises en croyant
  // travailler sous cloisonnement.
  await essai("toute table cloisonnée porte aussi FORCE ROW LEVEL SECURITY", async () => {
    const molles = tables.filter((t) => t.rls && !t.force).map((t) => t.table);
    assert.deepEqual(
      molles,
      [],
      `Ces tables ont la RLS sans FORCE :\n      ${molles.join("\n      ")}\n` +
        "    Le propriétaire — donc toute migration — passe outre sans le savoir."
    );
  });

  // ─── 3. Une RLS sans politique est une panne, pas une protection ──────────
  //
  // PostgreSQL refuse alors TOUT, y compris à qui a le droit. L'écran se vide,
  // et l'erreur n'accuse rien : on cherche dans le produit un défaut qui est
  // dans la migration.
  await essai("aucune table cloisonnée n'est restée sans politique", async () => {
    const muettes = tables.filter((t) => t.rls && t.politiques === 0).map((t) => t.table);
    assert.deepEqual(
      muettes,
      [],
      `Ces tables ont la RLS activée et AUCUNE politique :\n      ${muettes.join("\n      ")}\n` +
        "    Tout y est refusé, silencieusement. L'écran se vide sans dire pourquoi."
    );
  });

  // ─── 4. Les exceptions ne doivent pas survivre à leur objet ───────────────
  await essai("chaque file de purge exemptée existe encore, et porte sa raison", async () => {
    const connues = new Set(tables.map((t) => t.table));
    for (const [nom, pourquoi] of Object.entries(FILES_DE_PURGE_SANS_RLS)) {
      assert.ok(
        connues.has(nom),
        `${nom} n'existe plus : son exemption est périmée et couvrirait une table homonyme future`
      );
      assert.ok(
        pourquoi.length > 60,
        `${nom} : l'exemption n'explique pas ce qu'elle coûte — elle redevient un oubli`
      );
      // **L'exemption doit rester JUSTIFIÉE, pas seulement écrite.** Si une file
      // de purge se met un jour à porter des données d'artisan, la raison
      // ci-dessus devient fausse et l'exemption doit être rouverte — mais rien
      // ne le signalerait.
      //
      // **On borne par la FORME, pas par une liste de noms.** Une première
      // version énumérait les colonnes attendues : elle a rougi à sa première
      // exécution sur `note_id`, `purger_le` et `mis_en_file_le`, qui sont
      // parfaitement légitimes — la liste avait été devinée, pas relevée. Or un
      // contrôle qui accuse à tort coûte plus cher que pas de contrôle du tout
      // (`AGENTS.md`), et l'on aurait fini par élargir la liste sans la lire.
      //
      // Le type, lui, ne se devine pas : un uuid et une date sont
      // structurellement incapables de porter le nom d'un client, une adresse ou
      // un montant. Seule `storage_key` a le droit d'être du texte.
      const { rows: colonnes } = await client.query<{ n: string; t: string }>(
        `SELECT a.attname AS n, format_type(a.atttypid, a.atttypmod) AS t
           FROM pg_attribute a
          WHERE a.attrelid = $1::regclass AND a.attnum > 0 AND NOT a.attisdropped`,
        [nom]
      );
      const porteuses = colonnes
        .filter((c) => c.n !== "storage_key")
        .filter((c) => !/^(uuid|timestamp)/.test(c.t))
        .map((c) => `${c.n} (${c.t})`);
      assert.deepEqual(
        porteuses,
        [],
        `${nom} porte des colonnes qui peuvent contenir de la donnée d'artisan :\n` +
          `      ${porteuses.join("\n      ")}\n` +
          "    Son exemption de RLS repose sur le fait qu'elle n'en contient AUCUNE — des\n" +
          "    identifiants, une clé de stockage, des dates. Ce n'est plus vrai : soit ces\n" +
          "    colonnes n'ont rien à y faire, soit la table doit être cloisonnée."
      );
    }
  });

  // ─── 5. LA RAISON D'ÊTRE DE TOUT CECI, ÉPROUVÉE ──────────────────────────
  //
  // Ce contrôle ne vaut que si les privilèges par défaut sont bien ce qu'on
  // croit. S'ils disparaissaient un jour, une table neuve serait inaccessible
  // plutôt que grande ouverte : le danger changerait de nature, et le
  // commentaire en tête de ce fichier deviendrait faux.
  await essai("les privilèges par défaut donnent bien l'écriture à atlas_app", async () => {
    const { rows } = await client.query<{ droits: string }>(
      `SELECT array_to_string(defaclacl, ' ') AS droits FROM pg_default_acl
        WHERE defaclobjtype = 'r'`
    );
    assert.ok(rows.length > 0, "aucun privilège par défaut sur les tables : le tableau a changé");
    assert.ok(
      rows.some((r) => /atlas_app=[arwd]*w[arwd]*\//.test(r.droits)),
      "atlas_app ne reçoit plus l'écriture par défaut sur les tables neuves.\n" +
        "    Ce n'est pas forcément un défaut — mais l'en-tête de ce fichier décrit alors\n" +
        "    un danger qui n'existe plus, et une documentation périmée est pire qu'absente."
    );
  });

  // ─── 6. Le cas le plus dangereux, nommé pour lui-même ─────────────────────
  await essai("aucune table n'est à la fois inscriptible par atlas_app et non cloisonnée", async () => {
    const beantes = tables
      .filter((t) => t.porte_entreprise_id && t.ecriture_app && !t.rls)
      .filter((t) => !(t.table in FILES_DE_PURGE_SANS_RLS))
      .map((t) => t.table);
    assert.deepEqual(
      beantes,
      [],
      `Cumul le plus grave — porte entreprise_id, atlas_app peut y ÉCRIRE, aucune RLS :\n` +
        `      ${beantes.join("\n      ")}\n` +
        "    Un artisan peut modifier et supprimer les lignes d'un autre."
    );
  });

  const cloisonnees = tables.filter((t) => t.rls).length;
  const dEntreprise = tables.filter((t) => t.porte_entreprise_id).length;
  console.log("");
  console.log(
    `  ${tables.length} tables lues · ${dEntreprise} portent entreprise_id · ${cloisonnees} cloisonnées · ` +
      `${Object.keys(FILES_DE_PURGE_SANS_RLS).length} exemption(s) motivée(s).`
  );

  await client.end();
  console.log(`\n${echecs === 0 ? "✅" : "❌"} Cloisonnement des tables — ${echecs} échec(s).`);
  process.exit(echecs === 0 ? 0 : 1);
}

main().catch(async (e) => {
  console.error("❌ Contrôle interrompu :", e instanceof Error ? e.message : e);
  process.exit(2);
});
