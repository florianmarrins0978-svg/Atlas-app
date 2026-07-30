import { Client } from "pg";

// Nettoyage de la base pour les suites de tests.
//
// Le TRUNCATE est une opération de banc d'essai, pas une opération applicative.
// Le rôle atlas_app n'a délibérément que SELECT/INSERT/UPDATE/DELETE
// (drizzle/0001_securite_integrite.sql : « jamais de DDL, jamais BYPASSRLS ») :
// lui accorder TRUNCATE affaiblirait la posture de production que la CI vérifie.
// Le nettoyage passe donc par le rôle propriétaire (DATABASE_ADMIN_URL), tandis
// que les tests eux-mêmes restent connectés en atlas_app et pleinement soumis à
// RLS — c'est précisément ce que les suites cherchent à démontrer.
//
// TRUNCATE n'est pas filtré par row level security : le contexte
// app.entreprise_id n'a donc pas à être fixé ici.

// Union des tables historiquement nettoyées par les suites, complétée des
// tables globales (catalogue_*) que CASCADE ne couvre pas faute de rattachement
// à entreprises. RESTART IDENTITY CASCADE fait le reste (accounts,
// verification_tokens, historique_prix…).
const TABLES = [
  "fragments_documents",
  "documents",
  "propositions_ia",
  "brouillons_informations",
  "lignes_devis",
  "devis",
  "lignes_prix",
  "historique_prix",
  "photos",
  "notes_vocales",
  "fichiers_a_purger",
  "materiel",
  "prestations",
  "chantiers",
  "clients",
  "tarifs",
  "parametres_chiffrage",
  "catalogue_prestations",
  "catalogue_materiels",
  "entreprise_compteurs",
  "membres_entreprise",
  "entreprises",
  "users",
];

// Connexion courte et dédiée : les suites terminent par pool.end() sur le pool
// applicatif, un pool d'administration persistant retiendrait la boucle
// d'événements et ferait traîner chaque script jusqu'au timeout.
export async function nettoyerBase() {
  const connectionString = process.env.DATABASE_ADMIN_URL ?? process.env.DATABASE_URL;
  const client = new Client({ connectionString });
  await client.connect();
  try {
    await client.query(`TRUNCATE TABLE ${TABLES.join(", ")} RESTART IDENTITY CASCADE`);
  } finally {
    await client.end();
  }
}
