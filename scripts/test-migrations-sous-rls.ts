// UNE MIGRATION QUI LIT UNE TABLE D'ENTREPRISE NE VOIT RIEN — sauf à poser le
// contexte elle-même.
//
// ═══════════════════════════════════════════════════════════════════════════
// **PAYÉ LE 21 AOÛT 2026, ET LE DÉFAUT ÉTAIT SILENCIEUX.**
//
// La migration 0058 devait recopier `chantiers.equipe_id` dans une table neuve,
// puis retirer la colonne. Écrite en un seul `INSERT … SELECT FROM chantiers`,
// elle recopiait **zéro ligne, sans la moindre erreur** — et la colonne
// disparaissait juste après. Toutes les équipes déjà affectées auraient été
// perdues sur la base du patron, en silence.
//
// La cause : `chantiers` porte `FORCE ROW LEVEL SECURITY`, donc la politique
// s'applique **même au propriétaire de la table** — et les migrations tournent
// justement sous `atlas_owner` (`CLAUDE.md` §5). Sans `app.entreprise_id`, la
// lecture ne rend rien.
//
// Trouvé en rejouant la migration sur une base à l'état d'avant, AVEC des
// données dedans. Jamais en la relisant : le SQL est parfaitement correct.
// ═══════════════════════════════════════════════════════════════════════════
//
// CE QUE CETTE SUITE TIENT :
//
//   1. **le piège lui-même**, éprouvé en base : le propriétaire sans contexte
//      ne voit rien, et le même propriétaire avec contexte voit tout. Sans ce
//      contrôle, plus rien ne rappellerait pourquoi la boucle existe ;
//   2. **toute migration qui écrit à partir d'une table d'entreprise pose son
//      contexte.** C'est le garde-fou pour la prochaine, qui sera écrite dans
//      six mois par quelqu'un qui n'aura pas payé celle-ci.

import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { Client } from "pg";
import { nettoyerBase } from "./_test-db";
import { creerEntreprise } from "../src/server/repositories/entreprises";
import { creerChantier } from "../src/server/repositories/chantiers";
import { pool } from "../src/server/db/client";

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

const DOSSIER = join(__dirname, "..", "drizzle");

/**
 * Les tables dont la lecture dépend d'`app.entreprise_id`.
 *
 * On ne les devine pas : ce sont celles que les migrations manipulent le plus,
 * et chacune porte `FORCE ROW LEVEL SECURITY`. La liste est volontairement
 * courte — un faux positif ferait rougir une migration correcte, et c'est ce
 * qui apprend à ignorer un contrôle.
 */
const TABLES_D_ENTREPRISE = ["chantiers", "clients", "devis", "factures", "prestations"];

/**
 * Les migrations DÉJÀ APPLIQUÉES qui portent le défaut, et qu'on ne peut plus
 * rejouer — chacune avec ce qu'elle a réellement coûté.
 *
 * **Elles ont été trouvées PAR ce contrôle, le 21 août 2026.** Les taire aurait
 * été le pire des deux mondes : le contrôle rougirait en permanence, on
 * apprendrait à l'ignorer, et le défaut de la prochaine migration passerait
 * avec. Les nommer, avec leur conséquence, laisse le garde-fou opérant pour
 * tout ce qui viendra.
 *
 * **Aucune ne se répare en modifiant son fichier** : `_migrations` les a
 * enregistrées, elles ne se rejoueront jamais. Ce qui reste à décider est dans
 * `TODO.md`, chiffré.
 */
const DEJA_APPLIQUEES: Record<string, string> = {
  "0039_identite_entreprise.sql":
    "`UPDATE factures SET entreprise_regime_tva` n'a touché aucune ligne existante. " +
    "Conséquence BORNÉE : le PDF se rabat sur le taux, ce que le fichier annonce déjà. " +
    "Et la réparer buterait sur `trg_facture_immuable`, qui refuse toute écriture sur une " +
    "facture émise — à trancher avec le patron plutôt qu'en passant.",
  "0040_conditions_documents.sql":
    "`UPDATE devis SET validite_jours = 30` n'a touché aucun devis existant. Conséquence " +
    "BORNÉE : la ligne « Validité » ne s'imprime pas sur les anciens devis, et ceux qui sont " +
    "partis sont figés de toute façon.",
  "0045_paiements_et_exigibilite.sql":
    "La reprise des paiements n'a inséré AUCUNE ligne pour les factures déjà émises. " +
    "Conséquence RÉELLE sur le relevé de TVA à l'encaissement : ces factures n'y comptent " +
    "pas. C'est le seul des trois qui appelle une réparation, et elle est simple — mais " +
    "elle touche à la comptabilité, donc elle se décide, elle ne se glisse pas dans un lot " +
    "d'écran.",
};

async function main() {
  console.log("=== Les migrations, sous la RLS ===\n");

  // ─── 1. LE PIÈGE, ÉPROUVÉ EN BASE ────────────────────────────────────────
  await essai("le PROPRIÉTAIRE sans contexte ne voit AUCUN chantier", async () => {
    await nettoyerBase();
    const { entreprise, utilisateurId } = await creerEntreprise(
      { nom: "Sous RLS" },
      { email: `rls-${Math.random().toString(36).slice(2)}@essai.local`, nom: "Patron" }
    );
    await creerChantier({ utilisateurId, entrepriseId: entreprise.id }, { nom: "Bien réel" });

    // **Le rôle des migrations**, exactement : `DATABASE_ADMIN_URL`.
    const proprietaire = process.env.DATABASE_ADMIN_URL;
    assert.ok(
      proprietaire,
      "DATABASE_ADMIN_URL manquante : ce contrôle ne peut pas jouer le rôle des migrations"
    );
    const client = new Client({ connectionString: proprietaire });
    await client.connect();
    try {
      const sans = await client.query("SELECT count(*)::int AS n FROM chantiers");
      assert.equal(
        sans.rows[0].n,
        0,
        "le propriétaire voit des chantiers sans contexte : FORCE ROW LEVEL SECURITY a-t-il été " +
          "retiré ? Si oui, ce contrôle ne prouve plus rien — et l'isolation non plus."
      );

      // Et avec le contexte, il les voit : sinon on aurait pu tout casser sans
      // que ce contrôle s'en aperçoive.
      await client.query("BEGIN");
      await client.query("SELECT set_config('app.entreprise_id', $1, true)", [entreprise.id]);
      const avec = await client.query("SELECT count(*)::int AS n FROM chantiers");
      await client.query("COMMIT");
      assert.equal(avec.rows[0].n, 1, "avec le contexte, le chantier devrait être visible");
    } finally {
      await client.end();
    }
  });

  // ─── 2. LE GARDE-FOU POUR LA PROCHAINE MIGRATION ─────────────────────────
  await essai("toute migration qui ÉCRIT depuis une table d'entreprise pose son contexte", async () => {
    const fautives: string[] = [];
    for (const nom of readdirSync(DOSSIER).filter((f) => f.endsWith(".sql")).sort()) {
      const sql = readFileSync(join(DOSSIER, nom), "utf-8");
      // Sans commentaires : une table citée dans une explication n'est pas une
      // lecture. Une erreur qui accuse à tort coûte plus cher que pas d'erreur.
      const code = sql
        .split("\n")
        .map((l) => (/^\s*--/.test(l) ? "" : l))
        .join("\n");

      // **On vise l'ÉCRITURE issue d'une table filtrée**, pas la simple mention
      // d'un nom de table. Sans cette précision, une définition de déclencheur
      // — `BEFORE UPDATE ON devis` — était dénoncée comme une écriture : deux
      // migrations parfaitement saines rougissaient, et une erreur qui accuse à
      // tort coûte plus cher que pas d'erreur du tout (`AGENTS.md`).
      const ecritDepuisUneTable = TABLES_D_ENTREPRISE.some(
        (t) =>
          new RegExp(`UPDATE\\s+"?${t}"?\\s+SET\\b`, "i").test(code) ||
          new RegExp(`DELETE\\s+FROM\\s+"?${t}"?\\b`, "i").test(code) ||
          (/\bINSERT\s+INTO\b/i.test(code) &&
            new RegExp(`(FROM|JOIN)\\s+"?${t}"?\\b`, "i").test(code))
      );
      const poseLeContexte = /set_config\(\s*'app\.entreprise_id'/i.test(code);

      if (ecritDepuisUneTable && !poseLeContexte && !(nom in DEJA_APPLIQUEES)) {
        fautives.push(nom);
      }
    }

    assert.deepEqual(
      fautives,
      [],
      `Ces migrations écrivent à partir d'une table d'entreprise SANS poser ` +
        `app.entreprise_id :\n    ${fautives.join("\n    ")}\n` +
        "  Sous FORCE ROW LEVEL SECURITY, elles ne verront RIEN — sans erreur, et sans que " +
        "personne ne s'en aperçoive. Boucler sur `entreprises` et poser le contexte, comme " +
        "les migrations 0036, 0037 et 0058."
    );
  });

  // **Et le contrôle doit savoir échouer** — sur le cas même qui a coûté ce
  // lot, et pas seulement sur un cas d'école.
  await essai("le motif reconnaît encore les trois écritures dangereuses", async () => {
    const dangereux = (sql: string) =>
      TABLES_D_ENTREPRISE.some(
        (t) =>
          new RegExp(`UPDATE\\s+"?${t}"?\\s+SET\\b`, "i").test(sql) ||
          new RegExp(`DELETE\\s+FROM\\s+"?${t}"?\\b`, "i").test(sql) ||
          (/\bINSERT\s+INTO\b/i.test(sql) &&
            new RegExp(`(FROM|JOIN)\\s+"?${t}"?\\b`, "i").test(sql))
      );

    // Le cas exact de la migration 0058, avant correction.
    assert.ok(
      dangereux(`INSERT INTO "autre" ("a") SELECT c."a" FROM "chantiers" c;`),
      "le motif ne voit plus la recopie qui a coûté ce lot"
    );
    assert.ok(dangereux(`UPDATE factures SET regime = 'x' WHERE regime IS NULL;`));
    assert.ok(dangereux(`DELETE FROM "devis" WHERE statut = 'brouillon';`));

    // **Et l'inverse, sans quoi le contrôle rougirait en permanence :** une
    // définition de déclencheur n'écrit rien, et une table sans RLS non plus.
    assert.ok(
      !dangereux(`CREATE TRIGGER t BEFORE UPDATE OR DELETE ON devis FOR EACH ROW ...;`),
      "une définition de déclencheur est prise pour une écriture : deux migrations saines rougiraient"
    );
    assert.ok(
      !dangereux(`UPDATE entreprises SET validite_devis_jours = 30;`),
      "`entreprises` ne porte pas de RLS : la dénoncer accuserait à tort"
    );
  });

  // Les exclusions ne doivent pas survivre à leur objet : une migration qui
  // disparaîtrait du dossier laisserait une exception périmée couvrir la
  // suivante, qui portera peut-être le même nom.
  await essai("chaque migration exclue existe encore, et porte sa raison", async () => {
    const fichiers = new Set(readdirSync(DOSSIER));
    for (const [nom, pourquoi] of Object.entries(DEJA_APPLIQUEES)) {
      assert.ok(fichiers.has(nom), `${nom} n'existe plus : son exclusion est périmée`);
      assert.ok(pourquoi.length > 40, `${nom} : l'exclusion n'explique pas ce qu'elle coûte`);
    }
  });

  console.log(`\n${echecs === 0 ? "✅" : "❌"} Migrations sous RLS — ${echecs} échec(s).`);
  await pool.end();
  process.exit(echecs === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
