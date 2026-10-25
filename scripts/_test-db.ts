import { Client } from "pg";
import { garderNettoyage } from "../src/lib/garde-seed";
import { hash as bcrypt } from "bcryptjs";
import { poserPreuveParMotDePasse } from "../src/server/preuve-recente";

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
  "lignes_facture",
  "factures",
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
  // Ne descend d'aucune entreprise : `CASCADE` ne l'emporte pas. Sans elle ici,
  // les échecs de connexion d'une suite temporiseraient la suivante — et la
  // batterie rougirait sur un défaut qu'elle aurait fabriqué elle-même.
  "tentatives_connexion",
  // `CASCADE` l'emporterait déjà par `users`, mais on la nomme : une table qui
  // porte des PORTES d'accès ne doit pas dépendre d'un effet de bord pour être
  // vidée entre deux suites.
  "cles_appareil",
];

// Connexion courte et dédiée : les suites terminent par pool.end() sur le pool
// applicatif, un pool d'administration persistant retiendrait la boucle
// d'événements et ferait traîner chaque script jusqu'au timeout.
//
// Les DEUX adresses se vérifient avant la première ligne vidée : celle qu'on
// vide, et celle où la suite écrira ensuite. Sur son espace, l'environnement
// désigne `atlas_dev`, sa vraie base (`scripts/test-nettoyage-epargne-sa-base.ts`).
export async function nettoyerBase() {
  for (const adresse of [process.env.DATABASE_ADMIN_URL, process.env.DATABASE_URL]) {
    if (adresse === undefined) continue;
    const verdict = garderNettoyage(adresse);
    if (!verdict.ok) throw new Error(`Nettoyage refusé. ${verdict.phrase}`);
  }
  const connectionString = process.env.DATABASE_ADMIN_URL ?? process.env.DATABASE_URL;
  const client = new Client({ connectionString });
  await client.connect();
  try {
    await client.query(`TRUNCATE TABLE ${TABLES.join(", ")} RESTART IDENTITY CASCADE`);
  } finally {
    await client.end();
  }
}

/**
 * Une identité récemment prouvée, comme le patron qui vient de taper son mot de
 * passe : rend l'identifiant de session à mettre dans le contexte.
 *
 * **Pour les suites dont l'IBAN n'est que le décor** (audit du 25 octobre 2026,
 * R1) : changer les coordonnées bancaires demande désormais une preuve, quelle
 * que soit la porte. La preuve passe par le vrai chemin (mot de passe vérifié
 * DANS la base), jamais par une ligne écrite à la main qui ne prouverait rien
 * du moteur. Le condensat se pose sous le propriétaire : `atlas_app` n'y a
 * aucun droit, et c'est voulu (migration 0064).
 */
export async function prouverIdentite(utilisateurId: string): Promise<string> {
  const motDePasse = `preuve-${utilisateurId}`;
  const client = new Client({ connectionString: process.env.DATABASE_ADMIN_URL ?? process.env.DATABASE_URL });
  await client.connect();
  try {
    await client.query("UPDATE users SET password_hash = $1 WHERE id = $2", [await bcrypt(motDePasse, 4), utilisateurId]);
  } finally {
    await client.end();
  }
  const sessionId = `session-prouvee-${utilisateurId}`;
  if (!(await poserPreuveParMotDePasse(utilisateurId, sessionId, motDePasse))) {
    throw new Error("prouverIdentite : la base a refusé la preuve, le montage ne vaut rien");
  }
  return sessionId;
}

