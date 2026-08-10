// Sauvegarde la base du banc SANS `pg_dump`, qui n'existe pas dans le conteneur.
//
// **Pourquoi ce script existe.** Le 10 août 2026, le patron lance la sauvegarde
// que je venais de lui écrire. Elle répond : `pg_dump: command not found`.
// J'avais supposé un outil au lieu de le vérifier — et c'est lui qui l'a
// découvert, une fois de plus, sur une machine que je ne peux pas voir.
//
// Ce script n'emploie que `pg`, qui est déjà une dépendance de l'application.
// Il écrit TOUTES les lignes de TOUTES les tables dans un seul fichier JSON.
//
// Ce qu'il sauvegarde et ce qu'il ne sauvegarde pas, dit franchement : les
// DONNÉES, pas le schéma. Le schéma vit dans `drizzle/`, versionné — on le
// rejoue avec `npm run db:migrate`. Ce qui ne se retrouve nulle part ailleurs,
// ce sont les chantiers, les clients, et ce que l'agent a appris.

import { writeFileSync } from "node:fs";
import pg from "pg";

const URL = process.env.DATABASE_SUPER_URL ?? process.env.DATABASE_ADMIN_URL ?? process.env.DATABASE_URL;
if (!URL) {
  console.error("❌ Aucune adresse de base connue (DATABASE_SUPER_URL, DATABASE_ADMIN_URL, DATABASE_URL).");
  process.exit(1);
}

// **Le rôle SUPERUTILISATEUR, et pas un autre.** `atlas_app` ne traverse pas la
// RLS : une sauvegarde faite sous lui serait vide de la moitié des lignes, et
// personne ne s'en apercevrait avant d'en avoir besoin.
const role = URL.replace(/^[a-z]+:\/\//i, "").split(":")[0];

const client = new pg.Client({ connectionString: URL });
await client.connect();

const { rows: tables } = await client.query(`
  SELECT table_name FROM information_schema.tables
  WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
  ORDER BY table_name
`);

if (tables.length === 0) {
  console.error("❌ Aucune table dans cette base. On s'arrête plutôt que d'écrire un fichier vide.");
  await client.end();
  process.exit(1);
}

const contenu = { pris_le: new Date().toISOString(), role, tables: {} };
let total = 0;
for (const { table_name: t } of tables) {
  // Les identifiants viennent d'`information_schema`, jamais d'une saisie :
  // les guillemets suffisent, et une table au nom inattendu ne casse rien.
  const { rows } = await client.query(`SELECT * FROM "${t}"`);
  contenu.tables[t] = rows;
  total += rows.length;
  if (rows.length) console.log(`  ${String(rows.length).padStart(6)} ligne(s)  ${t}`);
}
await client.end();

const horodatage = new Date().toISOString().slice(0, 16).replace(/[-:T]/g, "").replace(/(\d{8})(\d{4})/, "$1-$2");
const fichier = `sauvegarde-atlas-${horodatage}.json`;
writeFileSync(fichier, JSON.stringify(contenu, null, 1));

console.log(`
  ─────────────────────────────────────────────────────────────
   Sauvegarde faite : ${fichier}
   ${tables.length} table(s), ${total} ligne(s) au total.

   Elle est à la racine, dans la liste de gauche.
   Pour l'emporter : appui long sur le fichier → « Télécharger ».
   Tant qu'elle n'est pas sur votre appareil, elle disparaît avec
   l'espace de travail — elle vit au même endroit.

   Ce sont les DONNÉES, pas le schéma : celui-ci vit dans drizzle/,
   versionné, et se rejoue avec npm run db:migrate.
  ─────────────────────────────────────────────────────────────`);
