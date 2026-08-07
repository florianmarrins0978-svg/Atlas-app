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
  // Combien de chantiers menés de front. 1 par défaut — le comportement d'avant
  // la migration 0019, où une seule équipe était supposée sans le dire.
  nombreEquipes: integer("nombre_equipes").notNull().default(1),
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
  // Suite distincte de celle des devis : mêler les deux rendrait illisible
  // la numérotation continue qu'attend un contrôle fiscal.
  prochainNumeroFacture: integer("prochain_numero_facture").notNull().default(1),
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
    // Canal convenu avec le client pour l'envoi du devis (docs/AGENT.md §2.1).
    // Sans lui, l'envoi est impossible : mieux vaut bloquer qu'envoyer dans le vide.
    canalCommunication: text("canal_communication", { enum: ["sms", "email"] }),
    // Effacement à la demande (docs/RGPD.md §5). Un client effacé n'est pas une
    // ligne supprimée : ce que la loi impose de conserver subsiste, et le motif
    // dit quoi et pourquoi.
    effaceLe: timestamp("efface_le", { withTimezone: true }),
    conservationMotif: text("conservation_motif"),
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
    // Le moment où l'intervention commence, et sa durée réservée en
    // demi-journées. NULL sur tout chantier planifié avant la migration 0019 :
    // il est alors lu comme « journée entière à partir du matin », c'est-à-dire
    // exactement ce qu'il était. Voir src/server/disponibilites.ts.
    creneauDebut: text("creneau_debut"),
    dureeDemiJournees: integer("duree_demi_journees"),
    // Le texte dicté (« 2 jours »), distinct de la durée réservée ci-dessus :
    // faire dépendre le planning d'une chaîne de caractères serait le rendre
    // faux au premier mot mal orthographié.
    dureePrevue: text("duree_prevue"),
    // Jalons de fin de chantier (docs/AGENT.md §2.3).
    termineAt: timestamp("termine_at", { withTimezone: true }),
    factureEnvoyeeAt: timestamp("facture_envoyee_at", { withTimezone: true }),
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
    // Annulable : l'audio est purgé une fois la transcription obtenue, et la
    // note vocale lui survit (docs/RGPD.md §4). NULL = enregistrement effacé.
    storageKey: text("storage_key"),
    mimeType: text("mime_type").notNull(),
    tailleOctets: integer("taille_octets").notNull(),
    nomOriginal: text("nom_original"),
    checksum: text("checksum").notNull(),
    dureeSecondes: integer("duree_secondes"),
    transcription: text("transcription"),
    audioPurgeLe: timestamp("audio_purge_le", { withTimezone: true }),
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
    // Permet aux leçons de prix (migration 0023) de désigner une ligne SANS
    // pouvoir viser celle d'une autre société.
    unique("lignes_prix_id_entreprise_uk").on(t.id, t.entrepriseId),
    index("lignes_prix_entreprise_chantier_idx").on(t.entrepriseId, t.chantierId),
    foreignKey({
      columns: [t.chantierId, t.entrepriseId],
      foreignColumns: [chantiers.id, chantiers.entrepriseId],
      name: "lignes_prix_chantier_entreprise_fk",
    }).onDelete("cascade"),
  ]
);

// --- Devis : versionné, instantané immuable après envoi (correction v2 §5, v2.1 §5/6) ---

// La mémoire des corrections du patron (migration 0023) : ce qu'il a RETENU
// comme prix, rapproché par une signature de métier (`src/lib/lecons-prix.ts`).
// Distincte d'`historique_prix`, qui s'appuie sur le catalogue partagé et ne
// sait pas distinguer un abattage au pied d'un démontage avec rétention.
export const leconsPrix = pgTable(
  "lecons_prix",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    entrepriseId: uuid("entreprise_id")
      .notNull()
      .references(() => entreprises.id, { onDelete: "cascade" }),
    lignePrixId: uuid("ligne_prix_id").notNull(),
    /** Clé de rapprochement : `abattage|retention|d70`. */
    signature: text("signature").notNull(),
    libelle: text("libelle").notNull(),
    prix: numeric("prix", { precision: 10, scale: 2 }).notNull(),
    chantierId: uuid("chantier_id").notNull(),
    constateLe: timestamp("constate_le", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique("lecons_prix_ligne_uk").on(t.lignePrixId),
    index("lecons_prix_recherche_idx").on(t.entrepriseId, t.signature, t.constateLe),
    foreignKey({
      columns: [t.lignePrixId, t.entrepriseId],
      foreignColumns: [lignesPrix.id, lignesPrix.entrepriseId],
      name: "lecons_prix_ligne_entreprise_fk",
    }).onDelete("cascade"),
    foreignKey({
      columns: [t.chantierId, t.entrepriseId],
      foreignColumns: [chantiers.id, chantiers.entrepriseId],
      name: "lecons_prix_chantier_entreprise_fk",
    }).onDelete("cascade"),
  ]
);

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
    // Comprise par un modèle, ou recopiée mot à mot faute de fournisseur
    // exploitable. Persistée pour que la mention affichée au patron survive au
    // rechargement — sinon il relit une recopie en la croyant analysée.
    lecture: text("lecture", { enum: ["modele", "litterale"] })
      .notNull()
      .default("modele"),
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

// Ce que le patron a répondu quand l'agent l'a arrêté avant de chiffrer
// (migration 0022). Table distincte du brouillon **à dessein** : le brouillon
// se régénère à chaque relecture de la dictée, ces réponses-là ne viennent pas
// de la dictée mais de lui, et les y ranger reviendrait à le questionner deux
// fois sur le même arbre.
export const precisionsChantier = pgTable(
  "precisions_chantier",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    entrepriseId: uuid("entreprise_id")
      .notNull()
      .references(() => entreprises.id, { onDelete: "cascade" }),
    chantierId: uuid("chantier_id").notNull(),
    /** Identifiant stable de la question — `abattage.technique#1`. */
    sujet: text("sujet").notNull(),
    libellePrestation: text("libelle_prestation").notNull(),
    valeur: text("valeur").notNull(),
    /** Figé à la réponse : un devis émis ne doit pas changer de texte. */
    lisible: text("lisible").notNull(),
    responduAt: timestamp("repondu_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique("precisions_chantier_uk").on(t.chantierId, t.sujet),
    index("precisions_chantier_entreprise_chantier_idx").on(t.entrepriseId, t.chantierId),
    foreignKey({
      columns: [t.chantierId, t.entrepriseId],
      foreignColumns: [chantiers.id, chantiers.entrepriseId],
      name: "precisions_chantier_chantier_entreprise_fk",
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

// --- Envoi du devis au client et réponse (voir docs/AGENT.md §2.1 à §2.3) ---

// Une ligne par ENVOI, jamais par devis : un devis refusé puis corrigé et
// renvoyé donne un nouvel envoi, avec un nouveau jeton. L'ancien reste comme
// trace de ce qui avait été proposé — un refus est une information de
// négociation, il ne s'efface pas.
export const envoisDevis = pgTable(
  "envois_devis",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    entrepriseId: uuid("entreprise_id")
      .notNull()
      .references(() => entreprises.id, { onDelete: "cascade" }),
    chantierId: uuid("chantier_id").notNull(),
    devisId: uuid("devis_id").notNull(),

    // Seule clé d'accès à la page publique : imprévisible, jamais dérivée d'un
    // identifiant existant.
    jeton: text("jeton").notNull(),
    expireAt: timestamp("expire_at", { withTimezone: true }).notNull(),
    canal: text("canal", { enum: ["sms", "email"] }).notNull(),
    datesProposees: date("dates_proposees").array().notNull(),
    empreinteDevis: char("empreinte_devis", { length: 64 }).notNull(),
    envoyeAt: timestamp("envoye_at", { withTimezone: true }).notNull().defaultNow(),

    // « correction » : le client veut le même devis, corrigé. Ni un oui, ni un
    // non — la troisième issue qui manquait, et sans laquelle une coquille se
    // présentait au patron comme un refus (migration 0020).
    reponse: text("reponse", { enum: ["acceptee", "refusee", "correction"] }),
    responduAt: timestamp("repondu_at", { withTimezone: true }),
    dateRetenue: date("date_retenue"),
    dateContreProposee: boolean("date_contre_proposee").notNull().default(false),
    precisionClient: text("precision_client"),
    demarrageAnticipe: boolean("demarrage_anticipe").notNull().default(false),

    adresseIp: text("adresse_ip"),
    agentUtilisateur: text("agent_utilisateur"),
    vuParPatronAt: timestamp("vu_par_patron_at", { withTimezone: true }),
  },
  (t) => [
    unique("envois_devis_jeton_uk").on(t.jeton),
    index("envois_devis_entreprise_chantier_idx").on(t.entrepriseId, t.chantierId),
    foreignKey({
      columns: [t.chantierId, t.entrepriseId],
      foreignColumns: [chantiers.id, chantiers.entrepriseId],
      name: "envois_devis_chantier_entreprise_fk",
    }).onDelete("cascade"),
    foreignKey({
      columns: [t.devisId, t.entrepriseId],
      foreignColumns: [devis.id, devis.entrepriseId],
      name: "envois_devis_devis_entreprise_fk",
    }).onDelete("cascade"),
  ]
);

// File de purge des audios transcrits (voir docs/RGPD.md §4).
//
// Sans politique d'isolation, comme `fichiers_a_purger` : c'est une file de
// maintenance, sans donnée personnelle. Elle porte l'entreprise concernée pour
// que le planificateur — qui n'a le contexte d'aucune — puisse adopter celui de
// chacune avant d'écrire dans notes_vocales, sans jamais contourner
// l'isolation.
export const audiosAPurger = pgTable(
  "audios_a_purger",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    noteId: uuid("note_id")
      .notNull()
      .references(() => notesVocales.id, { onDelete: "cascade" }),
    entrepriseId: uuid("entreprise_id")
      .notNull()
      .references(() => entreprises.id, { onDelete: "cascade" }),
    storageKey: text("storage_key").notNull(),
    purgerLe: timestamp("purger_le", { withTimezone: true }).notNull(),
    misEnFileLe: timestamp("mis_en_file_le", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique("audios_a_purger_note_uk").on(t.noteId),
    index("audios_a_purger_echeance_idx").on(t.purgerLe),
  ]
);

// --- Factures et TVA collectée (docs/AGENT.md §2.3) ------------------------
//
// Bâtie en brouillon quand le patron déclare la fin du chantier, figée à
// l'émission. Le relevé de TVA n'a pas de table : il se calcule à partir des
// factures émises, ce qui le rend incapable de diverger de ce qui a été
// facturé. Cette garantie repose sur l'immuabilité d'une facture émise, posée
// par trigger dans 0018_factures.sql.

export const factures = pgTable(
  "factures",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    entrepriseId: uuid("entreprise_id").notNull(),
    chantierId: uuid("chantier_id").notNull(),
    devisId: uuid("devis_id").notNull(),

    numeroCommercial: text("numero_commercial").notNull(),
    statut: text("statut", { enum: ["brouillon", "emise"] }).notNull().default("brouillon"),

    // Instantané figé — même principe que le devis.
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
    dateEcheance: date("date_echeance"),
    conditionsPaiement: text("conditions_paiement"),
    devise: char("devise", { length: 3 }).notNull().default("EUR"),

    tauxTva: numeric("taux_tva", { precision: 5, scale: 2 }).notNull().default("20.00"),
    totalHt: numeric("total_ht", { precision: 10, scale: 2 }).notNull(),
    totalTva: numeric("total_tva", { precision: 10, scale: 2 }).notNull(),
    totalTtc: numeric("total_ttc", { precision: 10, scale: 2 }).notNull(),

    pdfStorageKey: text("pdf_storage_key"),
    pdfChecksum: text("pdf_checksum"),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    createdBy: uuid("created_by").references(() => users.id),
    emiseLe: timestamp("emise_le", { withTimezone: true }),
  },
  (t) => [
    unique("factures_chantier_uk").on(t.chantierId),
    unique("factures_id_entreprise_uk").on(t.id, t.entrepriseId),
    unique("factures_entreprise_numero_uk").on(t.entrepriseId, t.numeroCommercial),
    foreignKey({
      columns: [t.chantierId, t.entrepriseId],
      foreignColumns: [chantiers.id, chantiers.entrepriseId],
      name: "factures_chantier_entreprise_fk",
    }).onDelete("restrict"),
    foreignKey({
      columns: [t.devisId, t.entrepriseId],
      foreignColumns: [devis.id, devis.entrepriseId],
      name: "factures_devis_entreprise_fk",
    }).onDelete("restrict"),
  ]
);

export const lignesFacture = pgTable(
  "lignes_facture",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    entrepriseId: uuid("entreprise_id").notNull(),
    factureId: uuid("facture_id").notNull(),
    libelle: text("libelle").notNull(),
    quantite: numeric("quantite", { precision: 10, scale: 2 }).notNull().default("1"),
    prixUnitaire: numeric("prix_unitaire", { precision: 10, scale: 2 }).notNull(),
    montant: numeric("montant", { precision: 10, scale: 2 }).notNull(),
    ordre: integer("ordre").notNull().default(0),
  },
  (t) => [
    index("lignes_facture_facture_idx").on(t.factureId),
    foreignKey({
      columns: [t.factureId, t.entrepriseId],
      foreignColumns: [factures.id, factures.entrepriseId],
      name: "lignes_facture_facture_entreprise_fk",
    }).onDelete("cascade"),
  ]
);

/**
 * Transmission de la facture au client — le pendant d'`envoisDevis`, en plus
 * simple : une facture ne se négocie pas.
 *
 * Elle existe parce que le patron a vu « facture arrêtée » et compris « facture
 * partie », alors que rien ne la portait jusqu'à son client (6 août 2026).
 * Aucun prestataire n'envoie à sa place (`docs/A-FAIRE.md` §5) : la facture
 * part de sa messagerie, et le lien qu'il transmet est celui-ci.
 */
export const envoisFactures = pgTable(
  "envois_factures",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    entrepriseId: uuid("entreprise_id")
      .notNull()
      .references(() => entreprises.id, { onDelete: "cascade" }),
    factureId: uuid("facture_id").notNull(),

    // Seule clé d'accès au document : imprévisible, jamais dérivée d'un
    // identifiant existant.
    jeton: text("jeton").notNull(),
    expireAt: timestamp("expire_at", { withTimezone: true }).notNull(),
    canal: text("canal", { enum: ["sms", "email"] }).notNull(),
    envoyeAt: timestamp("envoye_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique("envois_factures_jeton_uk").on(t.jeton),
    foreignKey({
      columns: [t.factureId, t.entrepriseId],
      foreignColumns: [factures.id, factures.entrepriseId],
      name: "envois_factures_facture_entreprise_fk",
    }).onDelete("cascade"),
  ]
);

/**
 * Le vocabulaire du métier et les règles de chiffrage — PARTAGÉS.
 *
 * Aucune donnée de client ici : ni nom, ni adresse, ni prix. Ce sont des mots et
 * des principes, et c'est précisément ce qui les rend partageables sans risque.
 * Ils partent avec l'application chez tous les futurs clients — décision du
 * patron du 7 août 2026, consignée dans `docs/QUESTIONS.md` §10.
 *
 * Même choix que `catalogue_prestations` : pas d'`entreprise_id`, donc pas de
 * politique d'isolation. Une table sans donnée personnelle n'a rien à isoler,
 * et lui en poser une ferait croire à une protection qui ne protège rien.
 */
export const termesMetier = pgTable(
  "termes_metier",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    nature: text("nature", { enum: ["mot", "regle"] }).notNull().default("mot"),
    intitule: text("intitule").notNull(),
    definition: text("definition").notNull(),
    /** Ce qu'Atlas doit en FAIRE — la colonne qui fait le travail. */
    consigne: text("consigne"),
    ordre: integer("ordre").notNull().default(0),
    actif: boolean("actif").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("termes_metier_ordre_idx").on(t.nature, t.ordre)]
);

/**
 * Ce que le patron avait dicté, et ce qu'il a finalement écrit.
 *
 * *« Comment je fais pour le nourrir et qu'il apprenne de ces erreurs ? »* —
 * le 7 août 2026. Une règle énoncée dit QUOI faire ; un exemple réel montre
 * JUSQU'OÙ.
 *
 * Rattachées à l'entreprise et isolées comme le reste : elles sont faites de
 * ses chantiers, de ses libellés et de ses prix. Elles ne se partagent jamais.
 */
export const correctionsDictee = pgTable(
  "corrections_dictee",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    entrepriseId: uuid("entreprise_id").notNull(),
    chantierId: uuid("chantier_id").notNull(),
    dictee: text("dictee").notNull(),
    propose: jsonb("propose").notNull().default(sql`'[]'::jsonb`),
    retenu: jsonb("retenu").notNull().default(sql`'[]'::jsonb`),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique("corrections_dictee_chantier_uk").on(t.chantierId),
    index("corrections_dictee_entreprise_idx").on(t.entrepriseId, t.updatedAt),
  ]
);
