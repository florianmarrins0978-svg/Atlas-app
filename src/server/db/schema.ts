// Schéma de données Atlas — conforme à docs/ARCHITECTURE_DONNEES.md (v2)
// et docs/ARCHITECTURE_DONNEES_v2.1_corrections.md (v2.1, référence définitive).
//
// Outillage : Drizzle ORM (remplace Prisma — décision technique documentée dans
// docs/ARCHITECTURE_IMPLEMENTATION.md : le schema-engine de Prisma nécessite un
// téléchargement depuis binaries.prisma.sh, bloqué dans cet environnement).
// Le modèle de données lui-même est strictement identique à ce qui a été validé —
// RLS, contraintes composites, triggers et CHECK sont des mécanismes PostgreSQL,
// indépendants de l'ORM utilisé pour les déclarer.

import {
  pgTable,
  uuid,
  text,
  timestamp,
  date,
  integer,
  numeric,
  unique,
  index,
  foreignKey,
  primaryKey,
  char,
  boolean,
  jsonb,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

// --- Auth.js (tables techniques, schéma prêt — authentification non branchée dans ce lot) ---

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull().unique(),
  nom: text("nom"),
  emailVerified: timestamp("email_verified", { withTimezone: true }),
  image: text("image"),
  // Authentification par identifiants (Auth.js Credentials) — hash bcrypt
  // uniquement, jamais le mot de passe en clair. Nullable : un utilisateur
  // créé via un futur provider OAuth n'en a pas besoin.
  passwordHash: text("password_hash"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const accounts = pgTable(
  "accounts",
  {
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    type: text("type").notNull(),
    provider: text("provider").notNull(),
    providerAccountId: text("provider_account_id").notNull(),
    refreshToken: text("refresh_token"),
    accessToken: text("access_token"),
    expiresAt: integer("expires_at"),
    tokenType: text("token_type"),
    scope: text("scope"),
    idToken: text("id_token"),
    sessionState: text("session_state"),
  },
  (t) => [primaryKey({ columns: [t.provider, t.providerAccountId] })]
);

export const verificationTokens = pgTable(
  "verification_tokens",
  {
    identifier: text("identifier").notNull(),
    token: text("token").notNull(),
    expires: timestamp("expires", { withTimezone: true }).notNull(),
  },
  (t) => [primaryKey({ columns: [t.identifier, t.token] })]
);

// --- Entreprises et adhésions ---

export const entreprises = pgTable("entreprises", {
  id: uuid("id").primaryKey().defaultRandom(),
  nom: text("nom").notNull(),
  siret: text("siret"),
  adresse: text("adresse"),
  telephone: text("telephone"),
  email: text("email"),
  iban: text("iban"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
});

// Correction v2.1 §3 : "prochain_numero_devis" représente le PROCHAIN numéro
// disponible (pas le dernier attribué). Initialisé à 1 à la création de
// l'entreprise, consommé par UPDATE ... RETURNING (voir withEntreprise / repository devis).
export const entrepriseCompteurs = pgTable("entreprise_compteurs", {
  entrepriseId: uuid("entreprise_id")
    .primaryKey()
    .references(() => entreprises.id, { onDelete: "cascade" }),
  prochainNumeroDevis: integer("prochain_numero_devis").notNull().default(1),
});

// Correction v2.1 §1 : remplace le lien direct utilisateur → entreprise.
export const membresEntreprise = pgTable(
  "membres_entreprise",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    entrepriseId: uuid("entreprise_id")
      .notNull()
      .references(() => entreprises.id, { onDelete: "cascade" }),
    utilisateurId: uuid("utilisateur_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: text("role", { enum: ["proprietaire", "membre"] }).notNull().default("membre"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [unique("membres_entreprise_uk").on(t.entrepriseId, t.utilisateurId)]
);

// --- Clients ---

export const clients = pgTable(
  "clients",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    entrepriseId: uuid("entreprise_id")
      .notNull()
      .references(() => entreprises.id, { onDelete: "cascade" }),
    nom: text("nom").notNull(),
    telephone: text("telephone"),
    adresse: text("adresse"),
    email: text("email"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    createdBy: uuid("created_by").references(() => users.id),
  },
  (t) => [
    unique("clients_id_entreprise_uk").on(t.id, t.entrepriseId), // support des FK composites enfants
    index("clients_entreprise_deleted_idx").on(t.entrepriseId, t.deletedAt),
    index("clients_entreprise_nom_idx").on(t.entrepriseId, t.nom),
  ]
);

// --- Chantiers ---

export const chantiers = pgTable(
  "chantiers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    entrepriseId: uuid("entreprise_id")
      .notNull()
      .references(() => entreprises.id, { onDelete: "cascade" }),
    clientId: uuid("client_id"), // nullable — correction v2 §2 ; FK composite ci-dessous
    nom: text("nom").notNull(),
    adresseChantier: text("adresse_chantier"),

    // Jalons métier datés — correction v2 §3. NULL = étape non atteinte.
    informationsVerifieesAt: timestamp("informations_verifiees_at", { withTimezone: true }),
    prixValideAt: timestamp("prix_valide_at", { withTimezone: true }),
    devisGenereAt: timestamp("devis_genere_at", { withTimezone: true }),
    devisEnvoyeAt: timestamp("devis_envoye_at", { withTimezone: true }),
    datePlanifiee: date("date_planifiee"), // non-null = "planifié"
    dureePrevue: text("duree_prevue"),
    tailleEquipe: text("taille_equipe"),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    createdBy: uuid("created_by").references(() => users.id),
    updatedBy: uuid("updated_by").references(() => users.id),
  },
  (t) => [
    unique("chantiers_id_entreprise_uk").on(t.id, t.entrepriseId),
    index("chantiers_entreprise_deleted_idx").on(t.entrepriseId, t.deletedAt),
    index("chantiers_entreprise_client_idx").on(t.entrepriseId, t.clientId),
    index("chantiers_entreprise_date_planifiee_idx").on(t.entrepriseId, t.datePlanifiee),
    // FK composite : un chantier ne peut référencer un client que de la même entreprise.
    foreignKey({
      columns: [t.clientId, t.entrepriseId],
      foreignColumns: [clients.id, clients.entrepriseId],
      name: "chantiers_client_entreprise_fk",
    }).onDelete("set null"),
  ]
);

// --- Prestations / matériel (listes éditables de l'écran Informations) ---

export const prestations = pgTable(
  "prestations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    entrepriseId: uuid("entreprise_id").notNull(),
    chantierId: uuid("chantier_id").notNull(),
    libelle: text("libelle").notNull().default(""),
    ordre: integer("ordre").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("prestations_entreprise_chantier_idx").on(t.entrepriseId, t.chantierId),
    foreignKey({
      columns: [t.chantierId, t.entrepriseId],
      foreignColumns: [chantiers.id, chantiers.entrepriseId],
      name: "prestations_chantier_entreprise_fk",
    }).onDelete("cascade"),
  ]
);

export const materiel = pgTable(
  "materiel",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    entrepriseId: uuid("entreprise_id").notNull(),
    chantierId: uuid("chantier_id").notNull(),
    libelle: text("libelle").notNull().default(""),
    ordre: integer("ordre").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("materiel_entreprise_chantier_idx").on(t.entrepriseId, t.chantierId),
    foreignKey({
      columns: [t.chantierId, t.entrepriseId],
      foreignColumns: [chantiers.id, chantiers.entrepriseId],
      name: "materiel_chantier_entreprise_fk",
    }).onDelete("cascade"),
  ]
);

// --- Fichiers : notes vocales et photos ---
// Correction v2.1 §10 : storage_key / mime_type / taille_octets / nom_original / checksum,
// jamais d'URL stockée — les URLs signées sont générées à la demande, côté serveur.

export const notesVocales = pgTable(
  "notes_vocales",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    entrepriseId: uuid("entreprise_id").notNull(),
    chantierId: uuid("chantier_id").notNull(),
    storageKey: text("storage_key").notNull(),
    mimeType: text("mime_type").notNull(),
    tailleOctets: integer("taille_octets").notNull(),
    nomOriginal: text("nom_original"),
    checksum: text("checksum").notNull(),
    dureeSecondes: integer("duree_secondes"),
    transcription: text("transcription"),
    transcriptionStatut: text("transcription_statut", {
      enum: ["non_demandee", "en_cours", "reussie", "echouee"],
    })
      .notNull()
      .default("non_demandee"),
    transcriptionErreur: text("transcription_erreur"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique("notes_vocales_chantier_uk").on(t.chantierId),
    index("notes_vocales_entreprise_idx").on(t.entrepriseId),
    foreignKey({
      columns: [t.chantierId, t.entrepriseId],
      foreignColumns: [chantiers.id, chantiers.entrepriseId],
      name: "notes_vocales_chantier_entreprise_fk",
    }).onDelete("cascade"),
  ]
);

export const photos = pgTable(
  "photos",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    entrepriseId: uuid("entreprise_id").notNull(),
    chantierId: uuid("chantier_id").notNull(),
    storageKey: text("storage_key").notNull(),
    mimeType: text("mime_type").notNull(),
    tailleOctets: integer("taille_octets").notNull(),
    nomOriginal: text("nom_original"),
    checksum: text("checksum").notNull(),
    ordre: integer("ordre").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    createdBy: uuid("created_by").references(() => users.id),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (t) => [
    index("photos_entreprise_chantier_idx").on(t.entrepriseId, t.chantierId),
    foreignKey({
      columns: [t.chantierId, t.entrepriseId],
      foreignColumns: [chantiers.id, chantiers.entrepriseId],
      name: "photos_chantier_entreprise_fk",
    }).onDelete("cascade"),
  ]
);

// Correction v2.1 §7 : purge différée et idempotente — jamais de suppression
// immédiate d'un fichier remplacé (note vocale) tant que la transaction du
// nouvel upload n'est pas validée.
export const fichiersAPurger = pgTable("fichiers_a_purger", {
  id: uuid("id").primaryKey().defaultRandom(),
  storageKey: text("storage_key").notNull(),
  misEnFileLe: timestamp("mis_en_file_le", { withTimezone: true }).notNull().defaultNow(),
});

// --- Tarifs et lignes de prix ---

export const tarifs = pgTable(
  "tarifs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    entrepriseId: uuid("entreprise_id")
      .notNull()
      .references(() => entreprises.id, { onDelete: "cascade" }),
    intitule: text("intitule").notNull(),
    prix: numeric("prix", { precision: 10, scale: 2 }).notNull(), // correction v2 §4 : Decimal, jamais Float
    unite: text("unite"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (t) => [index("tarifs_entreprise_deleted_idx").on(t.entrepriseId, t.deletedAt)]
);

export const lignesPrix = pgTable(
  "lignes_prix",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    entrepriseId: uuid("entreprise_id").notNull(),
    chantierId: uuid("chantier_id").notNull(),
    libelle: text("libelle").notNull().default(""),
    quantite: numeric("quantite", { precision: 10, scale: 2 }).notNull().default("1"),
    prixUnitaire: numeric("prix_unitaire", { precision: 10, scale: 2 }).notNull().default("0"),
    unite: text("unite"),
    montant: numeric("montant", { precision: 10, scale: 2 }).notNull().default("0"),
    ordre: integer("ordre").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("lignes_prix_entreprise_chantier_idx").on(t.entrepriseId, t.chantierId),
    foreignKey({
      columns: [t.chantierId, t.entrepriseId],
      foreignColumns: [chantiers.id, chantiers.entrepriseId],
      name: "lignes_prix_chantier_entreprise_fk",
    }).onDelete("cascade"),
  ]
);

// --- Devis : versionné, instantané immuable après envoi (correction v2 §5, v2.1 §5/6) ---

export const devis = pgTable(
  "devis",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    entrepriseId: uuid("entreprise_id").notNull(),
    chantierId: uuid("chantier_id").notNull(),

    numeroCommercial: text("numero_commercial").notNull(), // stable à travers les versions
    numeroVersion: integer("numero_version").notNull(),

    statut: text("statut", { enum: ["brouillon", "envoye"] }).notNull().default("brouillon"),

    // Instantané figé (correction v2.1 §5) — copié au moment de la génération.
    entrepriseNom: text("entreprise_nom").notNull(),
    entrepriseAdresse: text("entreprise_adresse"),
    entrepriseSiret: text("entreprise_siret"),
    entrepriseEmail: text("entreprise_email"),
    entrepriseTelephone: text("entreprise_telephone"),
    entrepriseIban: text("entreprise_iban"),

    clientNom: text("client_nom"),
    clientAdresse: text("client_adresse"),
    clientTelephone: text("client_telephone"),
    clientEmail: text("client_email"),

    adresseChantier: text("adresse_chantier"),

    dateEmission: date("date_emission").notNull(),
    dateValidite: date("date_validite"),
    conditionsPaiement: text("conditions_paiement"),
    devise: char("devise", { length: 3 }).notNull().default("EUR"),

    // TVA — correction v2.1 §4
    tauxTva: numeric("taux_tva", { precision: 5, scale: 2 }).notNull().default("20.00"),
    totalHt: numeric("total_ht", { precision: 10, scale: 2 }).notNull(),
    totalTva: numeric("total_tva", { precision: 10, scale: 2 }).notNull(),
    totalTtc: numeric("total_ttc", { precision: 10, scale: 2 }).notNull(),

    pdfStorageKey: text("pdf_storage_key"),
    pdfChecksum: text("pdf_checksum"),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    createdBy: uuid("created_by").references(() => users.id),
    envoyeLe: timestamp("envoye_le", { withTimezone: true }),
  },
  (t) => [
    unique("devis_id_entreprise_uk").on(t.id, t.entrepriseId), // pour la FK composite de lignes_devis
    unique("devis_chantier_version_uk").on(t.chantierId, t.numeroVersion),
    unique("devis_entreprise_numero_version_uk").on(t.entrepriseId, t.numeroCommercial, t.numeroVersion),
    index("devis_entreprise_statut_idx").on(t.entrepriseId, t.statut),
    foreignKey({
      columns: [t.chantierId, t.entrepriseId],
      foreignColumns: [chantiers.id, chantiers.entrepriseId],
      name: "devis_chantier_entreprise_fk",
    }).onDelete("restrict"), // un chantier ne se supprime pas silencieusement sous un devis envoyé
  ]
);

export const lignesDevis = pgTable(
  "lignes_devis",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    entrepriseId: uuid("entreprise_id").notNull(),
    devisId: uuid("devis_id").notNull(),
    libelle: text("libelle").notNull(),
    quantite: numeric("quantite", { precision: 10, scale: 2 }).notNull().default("1"),
    prixUnitaire: numeric("prix_unitaire", { precision: 10, scale: 2 }).notNull(),
    montant: numeric("montant", { precision: 10, scale: 2 }).notNull(),
    ordre: integer("ordre").notNull().default(0),
  },
  (t) => [
    index("lignes_devis_devis_idx").on(t.devisId),
    foreignKey({
      columns: [t.devisId, t.entrepriseId],
      foreignColumns: [devis.id, devis.entrepriseId],
      name: "lignes_devis_devis_entreprise_fk",
    }).onDelete("cascade"),
  ]
);

// --- Catalogue intelligent (lot IA-05) ---------------------------------
// Base de connaissance métier PARTAGÉE entre toutes les sociétés (aucune
// colonne entreprise_id, aucune RLS ici : ce sont des données de référence,
// pas des données propres à une société). Seul l'historique de prix
// ci-dessous reste scopé par entreprise.

export const cataloguePrestations = pgTable(
  "catalogue_prestations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    nomCanonique: text("nom_canonique").notNull(),
    variantes: text("variantes").array().notNull().default(sql`'{}'::text[]`),
    synonymes: text("synonymes").array().notNull().default(sql`'{}'::text[]`),
    description: text("description"),
    categorie: text("categorie"),
    unite: text("unite"),
    actif: boolean("actif").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [unique("catalogue_prestations_nom_unique").on(t.nomCanonique)]
);

export const catalogueMateriels = pgTable(
  "catalogue_materiels",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    nomCanonique: text("nom_canonique").notNull(),
    variantes: text("variantes").array().notNull().default(sql`'{}'::text[]`),
    categorie: text("categorie"),
    unite: text("unite"),
    actif: boolean("actif").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [unique("catalogue_materiels_nom_unique").on(t.nomCanonique)]
);

// Historique de prix — scopé par entreprise (RLS), jamais mélangé entre
// sociétés, jamais écrasé (une nouvelle ligne à chaque prix constaté).
export const historiquePrix = pgTable(
  "historique_prix",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    entrepriseId: uuid("entreprise_id")
      .notNull()
      .references(() => entreprises.id, { onDelete: "cascade" }),
    prestationId: uuid("prestation_id").references(() => cataloguePrestations.id, { onDelete: "set null" }),
    prix: numeric("prix", { precision: 10, scale: 2 }).notNull(),
    origine: text("origine", { enum: ["devis", "manuel", "import"] })
      .notNull()
      .default("manuel"),
    devisIdOrigine: uuid("devis_id_origine"),
    constateLe: timestamp("constate_le", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("historique_prix_entreprise_prestation_idx").on(t.entrepriseId, t.prestationId)]
);

// --- Paramètres de chiffrage (lot IA-06) --------------------------------
// Un seul jeu de paramètres par entreprise (comme entreprise_compteurs) —
// jamais mélangés entre sociétés. Valeurs par défaut raisonnables tant que le
// patron ne les a pas ajustées.
export const parametresChiffrage = pgTable("parametres_chiffrage", {
  entrepriseId: uuid("entreprise_id")
    .primaryKey()
    .references(() => entreprises.id, { onDelete: "cascade" }),
  coutJournalierOuvrier: numeric("cout_journalier_ouvrier", { precision: 10, scale: 2 }).notNull().default("200.00"),
  coutJournalierChefEquipe: numeric("cout_journalier_chef_equipe", { precision: 10, scale: 2 })
    .notNull()
    .default("280.00"),
  coutDeplacement: numeric("cout_deplacement", { precision: 10, scale: 2 }).notNull().default("35.00"),
  margeCiblePourcent: numeric("marge_cible_pourcent", { precision: 5, scale: 2 }).notNull().default("20.00"),
  tauxTvaDefaut: numeric("taux_tva_defaut", { precision: 5, scale: 2 }).notNull().default("20.00"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// --- Base documentaire (lot IA-07) --------------------------------------
// Couche indépendante des providers LLM : ingestion + indexation de fragments
// texte, réutilisable par de futurs outils/assistants (IA-08 et au-delà).
// Toujours scopée par entreprise (RLS) — un document ne doit jamais être
// retrouvable par une autre société.

export const documents = pgTable(
  "documents",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    entrepriseId: uuid("entreprise_id")
      .notNull()
      .references(() => entreprises.id, { onDelete: "cascade" }),
    chantierId: uuid("chantier_id"),
    typeDocument: text("type_document", {
      enum: ["devis", "transcription", "photo", "note", "autre"],
    }).notNull(),
    titre: text("titre").notNull(),
    sourceReferenceId: uuid("source_reference_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("documents_entreprise_chantier_idx").on(t.entrepriseId, t.chantierId)]
);

export const fragmentsDocuments = pgTable(
  "fragments_documents",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    entrepriseId: uuid("entreprise_id")
      .notNull()
      .references(() => entreprises.id, { onDelete: "cascade" }),
    documentId: uuid("document_id")
      .notNull()
      .references(() => documents.id, { onDelete: "cascade" }),
    position: integer("position").notNull().default(0),
    contenu: text("contenu").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("fragments_documents_entreprise_document_idx").on(t.entrepriseId, t.documentId)]
);

// --- Propositions IA (remédiation) ---------------------------------------
// Identité serveur stable pour chaque proposition générée par l'assistant.
// Le client ne renvoie jamais de montant/libellé à la confirmation : il ne
// renvoie que des identifiants de propositions déjà stockées côté serveur.
// Le passage 'proposee' -> 'appliquee' est la seule transition permise et sert
// de verrou d'idempotence (claim atomique via UPDATE ... WHERE statut =
// 'proposee' ... RETURNING).
// Brouillon d'informations structurées issu de la dictée — jamais une donnée
// métier. Reste séparé des prestations/materiel validés tant que le patron ne
// l'a pas confirmé, et de la transcription d'origine, qui vit dans
// notes_vocales et demeure consultable telle quelle.
export const brouillonsInformations = pgTable(
  "brouillons_informations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    entrepriseId: uuid("entreprise_id")
      .notNull()
      .references(() => entreprises.id, { onDelete: "cascade" }),
    chantierId: uuid("chantier_id").notNull(),
    contenu: jsonb("contenu").notNull(),
    statut: text("statut", { enum: ["brouillon", "confirme"] })
      .notNull()
      .default("brouillon"),
    modifieParHumain: boolean("modifie_par_humain").notNull().default(false),
    sourceTranscription: text("source_transcription"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    confirmeAt: timestamp("confirme_at", { withTimezone: true }),
  },
  (t) => [
    unique("brouillons_informations_chantier_uk").on(t.chantierId),
    index("brouillons_informations_entreprise_idx").on(t.entrepriseId),
    foreignKey({
      columns: [t.chantierId, t.entrepriseId],
      foreignColumns: [chantiers.id, chantiers.entrepriseId],
      name: "brouillons_informations_chantier_entreprise_fk",
    }).onDelete("cascade"),
  ]
);

export const propositionsIa = pgTable(
  "propositions_ia",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    entrepriseId: uuid("entreprise_id")
      .notNull()
      .references(() => entreprises.id, { onDelete: "cascade" }),
    chantierId: uuid("chantier_id").notNull(),
    type: text("type").notNull(),
    description: text("description").notNull(),
    donnees: jsonb("donnees").notNull(),
    statut: text("statut", { enum: ["proposee", "appliquee", "expiree"] })
      .notNull()
      .default("proposee"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    appliqueeAt: timestamp("appliquee_at", { withTimezone: true }),
  },
  (t) => [index("propositions_ia_entreprise_chantier_idx").on(t.entrepriseId, t.chantierId)]
);

// --- Documents légaux et preuve de leur acceptation (voir docs/RGPD.md §8) ---

// Une version publiée est immuable : corriger un texte, c'est publier une
// nouvelle version. Les acceptations déjà recueillies continuent ainsi de
// désigner exactement ce qui a été accepté.
export const documentsLegaux = pgTable(
  "documents_legaux",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    type: text("type", { enum: ["cgu", "sous_traitance", "confidentialite"] }).notNull(),
    version: text("version").notNull(),
    titre: text("titre").notNull(),
    contenu: text("contenu").notNull(),
    // SHA-256 hexadécimal du contenu, calculée à la publication.
    empreinte: char("empreinte", { length: 64 }).notNull(),
    acceptationRequise: boolean("acceptation_requise").notNull().default(true),
    publieAt: timestamp("publie_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique("documents_legaux_type_version_uk").on(t.type, t.version),
    index("documents_legaux_type_publie_idx").on(t.type, t.publieAt),
  ]
);

// La preuve, au sens de docs/RGPD.md §8 condition 3. Sans elle, une case cochée
// est invérifiable le jour exact où elle compte.
export const acceptationsDocuments = pgTable(
  "acceptations_documents",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    utilisateurId: uuid("utilisateur_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    documentId: uuid("document_id")
      .notNull()
      .references(() => documentsLegaux.id, { onDelete: "restrict" }),
    accepteAt: timestamp("accepte_at", { withTimezone: true }).notNull().defaultNow(),
    adresseIp: text("adresse_ip"),
    agentUtilisateur: text("agent_utilisateur"),
  },
  (t) => [
    unique("acceptations_documents_uk").on(t.utilisateurId, t.documentId),
    index("acceptations_documents_utilisateur_idx").on(t.utilisateurId),
  ]
);
