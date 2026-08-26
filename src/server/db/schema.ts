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
  bigint,
  type AnyPgColumn,
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
  // « Me déconnecter partout » (migration 0042) : tout jeton émis AVANT cet
  // instant est refusé par `getCurrentCtx`. Atlas ne garde aucune session en
  // base — il n'y a donc rien à supprimer pour fermer une session, mais on peut
  // refuser ce qui a été signé avant. `null` : jamais demandé.
  jetonsValidesDepuis: timestamp("jetons_valides_depuis", { withTimezone: true }),
  // La charte de couleurs choisie dans « Apparence » (migration 0047).
  //
  // **Sur la PERSONNE, pas sur l'entreprise** : c'est son goût, et la rubrique
  // vit dans l'ensemble « Moi » du sommaire. `null` = origine, celle du départ —
  // ce qui distingue « jamais choisi » de « a choisi origine ».
  charte: text("charte"),
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
  /** « SASU », « EI », « EURL »… Figure sur les documents (migration 0039). */
  formeJuridique: text("forme_juridique"),
  /**
   * Le régime de TVA, **déclaré et jamais déduit** (migration 0039).
   *
   * `facture-pdf.ts` devinait jusqu'ici la franchise en regardant si le taux
   * appliqué valait zéro — donc il tirait une situation fiscale d'un chiffre
   * saisi chantier par chantier. Les deux sens étaient faux : une franchise
   * perdait sa mention obligatoire dès qu'un 20 % traînait, un assujetti voyait
   * s'imprimer « TVA non applicable » sur une pièce comptable.
   *
   * Le défaut est « assujettie » : c'est celui qui ne change rien au
   * comportement observé jusqu'ici, et une franchise se déclare d'un geste.
   */
  regimeTva: text("regime_tva", { enum: ["assujettie", "franchise"] })
    .notNull()
    .default("assujettie"),
  /** Numéro de TVA intracommunautaire — attendu sur la facture d'un assujetti. */
  numeroTva: text("numero_tva"),
  /** Un IBAN à un nom différent de l'entreprise inquiète au lieu de rassurer. */
  titulaireCompte: text("titulaire_compte"),
  /**
   * Les conditions qui s'impriment sur un devis (migration 0040).
   *
   * **Une valeur nulle veut dire « éteint »**, sauf la validité dont le défaut
   * est celui d'avant — 30 jours, la constante de `devis-pdf.ts`. Deux champs
   * pour une seule idée (un nombre et un « actif ») finiraient par se
   * contredire (`src/lib/conditions-documents.ts`).
   */
  validiteDevisJours: integer("validite_devis_jours").default(30),
  acomptePourcent: numeric("acompte_pourcent", { precision: 5, scale: 2 }),
  delaiPaiementJours: integer("delai_paiement_jours"),
  moyensPaiement: text("moyens_paiement"),
  rappelerPenalitesDevis: boolean("rappeler_penalites_devis").notNull().default(false),
  textePiedDocuments: text("texte_pied_documents"),

  /**
   * Le message qui part au client avec le devis, la facture ou le rapport
   * (migration 0062, sa demande du 23 août 2026).
   *
   * **`null` veut dire « celui d'Atlas »**, jamais « vide » : recopier le texte
   * par défaut ici à la création figerait chaque entreprise sur la version du
   * jour, et une correction ultérieure ne l'atteindrait plus.
   *
   * Le lien y est OBLIGATOIRE — c'est sa règle, et `refusDuMessage` la tient
   * pour l'écran comme pour le serveur.
   */
  messageClient: text("message_client"),

  /**
   * L'allure de son devis et de sa facture (migration 0063, 23 août 2026).
   *
   * **`null` veut dire « comme aujourd'hui »** — sa règle : *« les réglages
   * actuels doivent être par défaut »*. Les valeurs vivent dans
   * `src/lib/allure-documents.ts`, jamais recopiées ici.
   *
   * **La feuille de chantier et le compte rendu ne sont PAS concernés** : sa
   * décision du même jour. L'une est interne, l'autre est une page web.
   */
  docTypographie: text("doc_typographie"),
  docFond: text("doc_fond"),
  docAccent: text("doc_accent"),
  /** Le logo vit dans le stockage, comme une photo — la base garde sa clef. */
  logoStorageKey: text("logo_storage_key"),
  logoMime: text("logo_mime"),

  /**
   * Les deux rappels de la rubrique « Notifications » (migration 0043).
   *
   * `null` = éteint. Ce sont des CONFORTS, et c'est pour cela qu'ils se
   * coupent : ne plus être rappelé qu'un devis dort ne fait rien perdre — le
   * devis est toujours sur la fiche du chantier. La réponse d'un client et le
   * lien expiré, eux, n'ont pas d'interrupteur (`src/lib/rappels.ts`).
   */
  rappelChantierSansDevisJours: integer("rappel_chantier_sans_devis_jours"),
  rappelDevisSansReponseJours: integer("rappel_devis_sans_reponse_jours"),
  rappelChantierNonFactureJours: integer("rappel_chantier_non_facture_jours"),
  /**
   * Le quatrième rappel et son rythme (migration 0051).
   *
   * `rappelFactureImpayeeJours` se compte à partir de l'ÉCHÉANCE quand elle
   * existe — le délai de paiement réglé — et de l'envoi sinon : c'est le
   * « A plus B » qu'il a tranché le 16 août 2026. Le rythme, lui, n'est jamais
   * nul : on éteint le rappel par le délai, pas par le rythme.
   */
  rappelFactureImpayeeJours: integer("rappel_facture_impayee_jours"),
  rappelFactureRythmeJours: integer("rappel_facture_rythme_jours").notNull().default(7),
  // Combien de chantiers menés de front. 1 par défaut — le comportement d'avant
  // la migration 0019, où une seule équipe était supposée sans le dire.
  nombreEquipes: integer("nombre_equipes").notNull().default(1),
  // Comment le relevé de TVA découpe l'année. **Le mois est le défaut LÉGAL**
  // (déclaration CA3 mensuelle ; le trimestre est une option sous condition de
  // TVA due), pas une préférence d'écran — voir `drizzle/0035_periodicite_tva.sql`.
  //
  // C'est une DÉCLARATION du patron, jamais une déduction : le seuil qui ouvre
  // le trimestre porte sur la TVA due, et Atlas ne connaît que la collectée.
  periodiciteTva: text("periodicite_tva", { enum: ["mensuelle", "trimestrielle"] })
    .notNull()
    .default("mensuelle"),
  /**
   * **Quand la TVA devient exigible** (migration 0045).
   *
   * Sa demande du 14 août 2026 : *« est-ce qu'il y a une possibilité pour que la
   * facture rentre au relevé seulement une fois que le client m'a payé ? »*
   *
   * `encaissements` est le DÉFAUT LÉGAL d'une prestation de services (CGI
   * art. 269-2-c) ; les `debits` sont une **option** qui se demande à
   * l'administration. Atlas appliquait les débits sans le dire — donc invitait
   * à déclarer trop tôt. Voir `docs/QUESTIONS.md` §20.
   */
  tvaExigibilite: text("tva_exigibilite", { enum: ["encaissements", "debits"] })
    .notNull()
    .default("encaissements"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
});

/**
 * Les équipes, et leurs noms — quand il y en a à écrire.
 *
 * **`nom` est nullable, et c'est le cœur de la règle** (`ARCHITECTURE.md` §51) :
 * un nom absent est un état normal, pas une donnée manquante. Le repli
 * « Équipe A » est un AFFICHAGE, décidé par `libelleEquipe` dans
 * `src/lib/equipes.ts` — jamais une valeur écrite ici.
 *
 * **`entreprises.nombre_equipes` fait autorité sur le nombre.** Cette table ne
 * porte que des noms : une ligne peut donc survivre au-delà du compteur, et
 * c'est voulu — redescendre puis remonter ne doit pas effacer un nom saisi à
 * la main.
 */
/**
 * Le modèle de fiche d'entretien — UN SEUL par entreprise.
 *
 * Sa décision du 16 août 2026 : « il n'y aura qu'une seule fiche ». Rien n'est
 * rangé par client ; à chaque passage, la fiche part de ce modèle et s'ajuste.
 * Le passage lui-même — ce qui a été coché, le temps, le rapport envoyé — a sa
 * propre table (`passagesEntretien`, juste en dessous) : un modèle évolue, un
 * rapport parti chez un client ne doit JAMAIS changer.
 */
export const prestationsEntretien = pgTable(
  "prestations_entretien",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    entrepriseId: uuid("entreprise_id")
      .notNull()
      .references(() => entreprises.id, { onDelete: "cascade" }),
    /** « Pelouse », « Tailles »… le mot du patron, renommable. */
    famille: text("famille").notNull(),
    libelle: text("libelle").notNull(),
    /** Croissant, avec des trous : ils permettent d'insérer sans tout réécrire. */
    ordre: integer("ordre").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("prestations_entretien_ordre_idx").on(t.entrepriseId, t.ordre)]
);

/**
 * Un PASSAGE d'entretien — ce qui a été coché, un jour, chez quelqu'un.
 *
 * `clientId` est NULL tant qu'il ne l'a pas nommé : la fiche s'ouvre sans
 * client (arrangement C du 17 août 2026), elle ne s'ENVOIE pas sans lui.
 *
 * `envoyeLe`, `empreinte` et `jeton` vont ensemble — une contrainte l'impose :
 * les deux premières font la preuve de passage qui remplace les signatures, le
 * troisième est l'adresse où le client la lit. Tant qu'elles sont nulles, c'est
 * un brouillon, et un brouillon n'a pas d'adresse publique.
 */
export const passagesEntretien = pgTable(
  "passages_entretien",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    entrepriseId: uuid("entreprise_id")
      .notNull()
      .references(() => entreprises.id, { onDelete: "cascade" }),
    clientId: uuid("client_id").references(() => clients.id, { onDelete: "set null" }),
    jour: date("jour").notNull(),
    /** Le temps passé, à la molette. NULL tant qu'il ne l'a pas posé. */
    minutes: integer("minutes"),
    /**
     * Le temps paraît-il sur le compte rendu du CLIENT ? — sa demande du
     * 22 août 2026, planche 92.
     *
     * **Faux n'efface rien** : la durée reste ici, c'est la lecture publique
     * qui la tait. Masquer en remettant `minutes` à NULL aurait confondu « je
     * n'ai pas chronométré » et « je ne veux pas le lui dire », et lui aurait
     * fait perdre son chiffre (migration `0060`).
     */
    tempsVisible: boolean("temps_visible").notNull().default(true),
    observations: text("observations"),
    /** Recopié à l'envoi : un rapport parti ne se renomme plus (migration 0055). */
    clientNomFige: text("client_nom"),
    envoyeLe: timestamp("envoye_le", { withTimezone: true }),
    empreinte: char("empreinte", { length: 64 }),
    /** L'adresse publique du rapport. NULL tant qu'il n'est pas parti. */
    jeton: text("jeton"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("passages_entretien_client_idx").on(t.entrepriseId, t.clientId, t.jour),
    unique("passages_entretien_jeton_uk").on(t.jeton),
  ]
);

/**
 * Les lignes d'un passage — une COPIE du modèle, jamais une référence.
 *
 * C'est ce qui garantit qu'un rapport déjà envoyé ne change plus jamais quand
 * le modèle bouge (l'invariant du 16 août). Le récit est dans la migration
 * `0055`.
 */
export const lignesPassage = pgTable(
  "lignes_passage",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    entrepriseId: uuid("entreprise_id")
      .notNull()
      .references(() => entreprises.id, { onDelete: "cascade" }),
    passageId: uuid("passage_id")
      .notNull()
      .references(() => passagesEntretien.id, { onDelete: "cascade" }),
    famille: text("famille").notNull(),
    libelle: text("libelle").notNull(),
    ordre: integer("ordre").notNull(),
    faite: boolean("faite").notNull().default(false),
  },
  (t) => [unique("lignes_passage_libelle_uk").on(t.passageId, t.libelle)]
);

export const equipes = pgTable(
  "equipes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    entrepriseId: uuid("entreprise_id")
      .notNull()
      .references(() => entreprises.id, { onDelete: "cascade" }),
    /** 1 à 20. Porte la lettre de repli (1 → A) et l'ordre d'affichage. */
    rang: integer("rang").notNull(),
    nom: text("nom"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [unique("equipes_entreprise_rang_uk").on(t.entrepriseId, t.rang)]
);

/**
 * Les équipes affectées à un chantier, DEMI-JOURNÉE PAR DEMI-JOURNÉE.
 *
 * **Ses deux demandes du 21 août 2026**, éprouvées sur la planche 84
 * (`appli/planning-simple.html`) avant d'être codées :
 *
 *   · *« je dois pouvoir mettre TOUTES les équipes si je le souhaite, sur la
 *     même demi-journée — tout le monde le matin, puis tout le monde
 *     l'aprem »* ;
 *   · *« Paul le matin, Julien et Paul l'après-midi : il faut que tout soit
 *     INDÉPENDANT »*.
 *
 * Une colonne sur `chantiers` ne pouvait répondre ni à l'une ni à l'autre. Elle
 * a donc été retirée plutôt que doublée : deux endroits pour la même réponse
 * finissent par ne plus dire la même chose.
 *
 * Une ligne absente n'est pas « personne y va » au sens d'un choix : c'est
 * « reste à décider ». C'est ce que le planning peint en hachuré.
 */
export const equipesDuChantier = pgTable(
  "equipes_du_chantier",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    entrepriseId: uuid("entreprise_id")
      .notNull()
      .references(() => entreprises.id, { onDelete: "cascade" }),
    chantierId: uuid("chantier_id").notNull(),
    /** `matin` ou `apres_midi` — le même vocabulaire que `creneauDebut`. */
    demi: text("demi").notNull(),
    equipeId: uuid("equipe_id")
      .notNull()
      .references(() => equipes.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique("equipes_du_chantier_uk").on(t.chantierId, t.demi, t.equipeId),
    index("equipes_du_chantier_idx").on(t.entrepriseId, t.chantierId),
    foreignKey({
      columns: [t.chantierId, t.entrepriseId],
      foreignColumns: [chantiers.id, chantiers.entrepriseId],
      name: "equipes_du_chantier_chantier_entreprise_fk",
    }).onDelete("cascade"),
  ]
);

/**
 * Les jours où une équipe n'est pas là.
 *
 * *Le patron, le 14 août 2026 : « une équipe qui doit partir en déplacement
 * pour cinq jours ».* Retenu sur maquette (`docs/maquettes/55`, proposition A).
 *
 * **Bornes incluses des deux côtés** — « du 8 au 12 » comprend le 8 et le 12.
 * Une absence d'un seul jour porte deux fois la même date : cas ordinaire.
 *
 * **Ce n'est pas un registre de congés** : ni solde, ni validation, ni
 * salarié. Une équipe est une file du planning, pas une personne
 * (`ARCHITECTURE.md` §88). Le motif ne sert qu'à ce que le patron se
 * souvienne ; aucun calcul ne le lit.
 */
export const absencesEquipe = pgTable("absences_equipe", {
  id: uuid("id").primaryKey().defaultRandom(),
  entrepriseId: uuid("entreprise_id")
    .notNull()
    .references(() => entreprises.id, { onDelete: "cascade" }),
  equipeId: uuid("equipe_id")
    .notNull()
    .references(() => equipes.id, { onDelete: "cascade" }),
  /** Premier jour d'absence, inclus. Format « AAAA-MM-JJ ». */
  premierJour: date("premier_jour").notNull(),
  /** Dernier jour d'absence, inclus. */
  dernierJour: date("dernier_jour").notNull(),
  motif: text("motif"),
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
    /**
     * **Trois rôles depuis la migration 0065**, et `membre` n'existe plus :
     * il a été repris en `salarie`, le plus fermé des trois. La contrainte qui
     * les tient vit en BASE, pas seulement ici — cette énumération-ci ne produit
     * aucun garde-fou côté PostgreSQL.
     *
     * Ce que chaque rôle atteint est décidé une seule fois, dans
     * `src/lib/acces-roles.ts` : ni cet écran-ci ni cette table ne le savent.
     */
    role: text("role", { enum: ["proprietaire", "commercial", "salarie"] }).notNull().default("salarie"),
    /**
     * Ce que la personne voit du planning — un réglage PAR PERSONNE, jamais par
     * rôle (sa décision du 13 août 2026). Le défaut est « tout » : restreindre
     * est un geste.
     */
    porteePlanning: text("portee_planning", { enum: ["tout", "ses_equipes"] }).notNull().default("tout"),
    /**
     * La file du planning que cette personne tient. **NULL est l'état normal**
     * pour un patron, un commercial, et un salarié qui voit tout : dans Atlas
     * une équipe est une file du planning, pas un groupe de personnes.
     */
    equipeId: uuid("equipe_id").references(() => equipes.id, { onDelete: "set null" }),
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
    // **NULL est un état normal, pas une donnée manquante** — une société n'est
    // ni « Mr » ni « Mme », et un client saisi à la volée n'a pas toujours eu
    // droit à un appui de plus. Ce que NULL vaut à l'écran est décidé dans
    // `src/lib/civilite.ts`, jamais ici (migration 0038).
    civilite: text("civilite", { enum: ["mr", "mme"] }),
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

    // **Où se trouve ce chantier, quand on a su le situer.**
    //
    // NULL est un état NORMAL et le restera : l'adresse est un champ libre — un
    // lieu-dit, « derrière l'église », un chantier créé avant la migration 0047.
    // Ce qui s'appuie dessus doit savoir le DIRE plutôt que se taire.
    //
    // `adresseSituee` garde l'adresse exacte qui a produit ces coordonnées : si
    // elle diffère de `adresseChantier`, le patron a corrigé l'adresse depuis, et
    // des coordonnées posées sur l'ancienne seraient pires que pas de
    // coordonnées du tout.
    latitude: numeric("latitude", { precision: 9, scale: 6 }),
    longitude: numeric("longitude", { precision: 9, scale: 6 }),
    adresseSituee: text("adresse_situee"),

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
    /**
     * Le jour du dernier « Plus tard » sur le rappel d'impayé (migration 0051).
     *
     * **Ici et pas sur `factures`, et ce n'est pas un rangement** :
     * `trg_facture_immuable` refuse toute écriture sur une facture émise, date
     * d'affichage comprise. La relation étant de un à un, le chantier la porte
     * sans qu'on perde rien — et l'invariant comptable reste entier.
     */
    rappelFactureRepousseLe: date("rappel_facture_repousse_le"),
    tailleEquipe: text("taille_equipe"),
    /**
     * Le pense-bête de CE chantier — « penser à prendre le broyeur ».
     *
     * Sa demande du 23 août 2026. **Jamais imprimée** : ni sur le devis, ni sur
     * le PDF sans les prix. C'est sa décision, et sa raison tient en une
     * phrase — *« les salariés auront accès au planning ; justement, c'est pour
     * cela que je voulais le devis sans les prix »*. Le PDF est le devis
     * expurgé ; la note vit sur la feuille de chantier, que ses gars ouvrent
     * depuis le planning.
     *
     * Bornée en base à 2 000 caractères (migration 0060) : elle descend avec
     * la liste entière du planning, et un copier-coller malheureux alourdirait
     * chaque lecture.
     */
    note: text("note"),
    // **Qui tient ce chantier vit dans `equipesDuChantier`, plus ici.** La
    // colonne `equipe_id` portait UNE équipe, pour le chantier entier ; il en
    // veut plusieurs, et différentes le matin et l'après-midi (migration 0058).
    // La garder à côté aurait fait deux vérités sur la même question — celle du
    // planning et celle de la feuille de route, qui auraient divergé au premier
    // retrait (`CLAUDE.md` §3).

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
    // Recopiée comme le nom : un document dit comment on s'adressait à son
    // destinataire LE JOUR OÙ il a été établi. Corriger une fiche client ne
    // doit pas réécrire un devis déjà parti (migration 0038).
    clientCivilite: text("client_civilite", { enum: ["mr", "mme"] }),
    clientAdresse: text("client_adresse"),
    clientTelephone: text("client_telephone"),
    clientEmail: text("client_email"),

    adresseChantier: text("adresse_chantier"),

    dateEmission: date("date_emission").notNull(),
    dateValidite: date("date_validite"),
    /**
     * La durée de validité RECOPIÉE au jour de la création (migration 0040).
     *
     * Lire le réglage au moment de composer le PDF ferait changer la durée
     * d'engagement d'un devis déjà envoyé, simplement parce que l'artisan a
     * corrigé ses réglages entre-temps — pendant que le client a une autre
     * feuille sous les yeux (`ARCHITECTURE.md` §102).
     */
    validiteJours: integer("validite_jours"),
    /**
     * Les cinq autres conditions, RECOPIÉES elles aussi (migration 0064).
     *
     * Elles ne parvenaient nulle part avant le 25 août 2026 : six réglages se
     * saisissaient, un seul atteignait le document. C'est lui qui l'a vu —
     * *« les autres qui sont en ON doivent-ils être visibles sur le devis ? car
     * je ne vois rien »*.
     *
     * Figées pour la même raison que la validité juste au-dessus : corriger un
     * réglage ne doit pas réécrire les conditions d'un devis déjà parti. `null`
     * veut dire « rien ne s'imprime », donc les devis d'avant la 0064 sortent
     * identiques à eux-mêmes.
     */
    acomptePourcent: numeric("acompte_pourcent", { precision: 5, scale: 2 }),
    delaiPaiementJours: integer("delai_paiement_jours"),
    moyensPaiement: text("moyens_paiement"),
    rappelerPenalites: boolean("rappeler_penalites").notNull().default(false),
    textePied: text("texte_pied"),
    conditionsPaiement: text("conditions_paiement"),
    devise: char("devise", { length: 3 }).notNull().default("EUR"),

    // TVA — correction v2.1 §4
    tauxTva: numeric("taux_tva", { precision: 5, scale: 2 }).notNull().default("20.00"),
    /**
     * **`totalHt` est le montant APRÈS réduction** (migration 0048).
     *
     * Tout ce qui le lit — relevé de TVA, export comptable, exigibilité, suivi
     * des paiements — y cherche ce qui est DÛ. Y laisser le prix plein aurait
     * fait déclarer de la TVA sur de l'argent que le client ne paie pas.
     * Le prix plein vaut `totalHt + reductionMontant`.
     */
    totalHt: numeric("total_ht", { precision: 10, scale: 2 }).notNull(),
    totalTva: numeric("total_tva", { precision: 10, scale: 2 }).notNull(),
    totalTtc: numeric("total_ttc", { precision: 10, scale: 2 }).notNull(),

    /**
     * Le prix accordé au client — son geste commercial (`reduction-devis.ts`).
     *
     * `null` : aucune réduction, et le document n'écrit rien. Les deux colonnes
     * vont ensemble ou pas du tout, la base y veille.
     */
    reductionPourcent: numeric("reduction_pourcent", { precision: 5, scale: 2 }),
    reductionMontant: numeric("reduction_montant", { precision: 10, scale: 2 }),

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

// --- Ses mots à lui, par-dessus le vocabulaire commun (migration 0052) ---
//
// **Sa demande du 17 août 2026** : *« On peut rien modifier rajouter »*, sur
// l'écran du catalogue. Le catalogue étant partagé, ses mots ne peuvent pas y
// entrer — ils vivent ici, isolés par RLS, et se superposent au commun à la
// lecture ET à la recherche. Le récit complet est en tête de la migration et
// dans `src/lib/mots-catalogue.ts`.
//
// Quatre formes dans une seule table : un mot sur une prestation d'Atlas, un
// mot sur un matériel d'Atlas, son entrée à lui (aucun renvoi), un mot sur son
// entrée à lui (`parentId`).
export const motsCatalogue = pgTable(
  "mots_catalogue",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    entrepriseId: uuid("entreprise_id")
      .notNull()
      .references(() => entreprises.id, { onDelete: "cascade" }),
    famille: text("famille", { enum: ["prestation", "materiel"] }).notNull(),
    /** Le mot ajouté — ou le nom de son entrée à lui quand rien n'est ancré. */
    mot: text("mot").notNull(),
    prestationId: uuid("prestation_id").references(() => cataloguePrestations.id, { onDelete: "cascade" }),
    materielId: uuid("materiel_id").references(() => catalogueMateriels.id, { onDelete: "cascade" }),
    parentId: uuid("parent_id").references((): AnyPgColumn => motsCatalogue.id, { onDelete: "cascade" }),
    /**
     * Un mot qu'Atlas a proposé et qu'il a refusé (migration 0053).
     *
     * Il reste en base pour ne PLUS être proposé : une proposition qui revient
     * après un « non » n'est plus une proposition. Il ne s'affiche pas et ne se
     * cherche pas ; l'écrire à la main le relève.
     */
    refuse: boolean("refuse").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("mots_catalogue_entreprise_idx").on(t.entrepriseId, t.famille)]
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
    /**
     * Le chantier concerné — **`null` quand le geste n'en concerne aucun**
     * (migration 0066) : créer un chantier, régler un tarif, corriger un
     * client depuis n'importe quel écran.
     *
     * Ce n'est pas un relâchement du cloisonnement : c'est `entrepriseId` que
     * la RLS regarde, et il reste obligatoire.
     */
    chantierId: uuid("chantier_id"),
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
    /**
     * Celles qu'il a proposées alors que la journée était DÉJÀ PLEINE.
     *
     * Sa règle du 23 août 2026 — *« si l'utilisateur juge qu'il peut rajouter un
     * chantier, il doit pouvoir le faire quand même »* — ne tient avec celle du
     * 22 — *« un jour déjà pris proposé, ça ne doit jamais se reproduire »* —
     * que si l'on sait, à la réponse du client, laquelle des deux s'applique.
     *
     * Un jour forcé : sa décision, le client peut le prendre. Un jour libre qui
     * s'est rempli depuis : il n'a rien décidé, et le client choisit ailleurs.
     *
     * **Calculée au serveur** à la création de l'envoi, jamais reçue de l'écran :
     * une valeur venue du navigateur ferait de cette colonne un moyen de forcer
     * n'importe quelle date.
     */
    datesForcees: date("dates_forcees").array().notNull().default([]),
    /**
     * Le client peut-il proposer une autre date que celles offertes ?
     *
     * Décidé par le patron **avant l'envoi** (17 août 2026), puis FIGÉ ici :
     * l'écran du client doit dire demain ce qu'il disait aujourd'hui. Vrai par
     * défaut — c'est le comportement qu'ont connu les envois déjà partis.
     */
    autreDateAutorisee: boolean("autre_date_autorisee").notNull().default(true),


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
    /**
     * Le régime de TVA **au jour de l'émission** (migration 0039).
     *
     * Figé ici, et non lu en direct : une facture émise sous franchise garde sa
     * mention « art. 293 B » même si l'artisan devient assujetti l'année
     * suivante. La lire dans `entreprises` réécrirait le passé sur une pièce
     * comptable.
     *
     * Nul pour les factures antérieures à la migration : le PDF se rabat alors
     * sur le taux appliqué, exactement comme avant.
     */
    entrepriseRegimeTva: text("entreprise_regime_tva", { enum: ["assujettie", "franchise"] }),
    entrepriseEmail: text("entreprise_email"),
    entrepriseTelephone: text("entreprise_telephone"),
    entrepriseIban: text("entreprise_iban"),

    clientNom: text("client_nom"),
    // Recopiée comme le nom : un document dit comment on s'adressait à son
    // destinataire LE JOUR OÙ il a été établi. Corriger une fiche client ne
    // doit pas réécrire un devis déjà parti (migration 0038).
    clientCivilite: text("client_civilite", { enum: ["mr", "mme"] }),
    clientAdresse: text("client_adresse"),
    clientTelephone: text("client_telephone"),
    clientEmail: text("client_email"),

    adresseChantier: text("adresse_chantier"),

    dateEmission: date("date_emission").notNull(),
    dateEcheance: date("date_echeance"),
    conditionsPaiement: text("conditions_paiement"),
    devise: char("devise", { length: 3 }).notNull().default("EUR"),

    tauxTva: numeric("taux_tva", { precision: 5, scale: 2 }).notNull().default("20.00"),
    /** APRÈS réduction, comme sur le devis — voir `devis.totalHt`. */
    totalHt: numeric("total_ht", { precision: 10, scale: 2 }).notNull(),
    totalTva: numeric("total_tva", { precision: 10, scale: 2 }).notNull(),
    totalTtc: numeric("total_ttc", { precision: 10, scale: 2 }).notNull(),

    /**
     * Recopié du devis à la création de la facture (migration 0048).
     *
     * Une remise accordée sur le devis puis absente de la facture ferait payer
     * au client le prix qu'on venait de lui retirer.
     */
    reductionPourcent: numeric("reduction_pourcent", { precision: 5, scale: 2 }),
    reductionMontant: numeric("reduction_montant", { precision: 10, scale: 2 }),

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

/**
 * Les règlements reçus sur une facture (migration 0045).
 *
 * **Sa demande du 14 août 2026 :** *« lorsque la facture part, au lieu qu'elle
 * rentre directement dans le relevé, elle arrive dans un endroit en attente ;
 * lorsque j'ai reçu le paiement, je clique sur valider et boum, elle va dans le
 * relevé. »*
 *
 * **Plusieurs lignes par facture, et c'est le point :** un acompte se note comme
 * un solde, et seule la part encaissée entre au relevé — au prorata du TTC
 * (`src/lib/exigibilite-tva.ts`). La part de TVA n'est PAS stockée ici : la
 * figer la ferait diverger de la facture le jour où un avoir la corrige.
 *
 * **`origine` distingue trois choses qui n'ont pas la même valeur** : ce qu'il a
 * saisi (`saisi`), ce que la migration a supposé pour ne pas déplacer un relevé
 * déjà déclaré (`reprise`, et l'écran le dit), et ce qu'une banque proposera un
 * jour (`banque`, `docs/A-FAIRE.md` §13).
 */
export const paiementsFacture = pgTable(
  "paiements_facture",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    entrepriseId: uuid("entreprise_id").notNull(),
    factureId: uuid("facture_id").notNull(),
    /** Date civile : c'est elle qui décide du mois ou du trimestre déclaré. */
    datePaiement: date("date_paiement").notNull(),
    montant: numeric("montant", { precision: 12, scale: 2 }).notNull(),
    moyen: text("moyen", { enum: ["virement", "cheque", "especes", "carte", "autre"] }),
    note: text("note"),
    origine: text("origine", { enum: ["saisi", "reprise", "banque"] }).notNull().default("saisi"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("paiements_facture_facture_idx").on(t.entrepriseId, t.factureId),
    index("paiements_facture_date_idx").on(t.entrepriseId, t.datePaiement),
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

/**
 * Les grilles de prix du patron — une par nature de travail.
 *
 * *« Pour la fente, ils devraient demander la hauteur de l'arbre et son
 * diamètre, et on crée une liste de prix en fonction de la hauteur et du
 * diamètre, comme ça il n'invente rien. »* — le 8 août 2026. Le même jour, il
 * a étendu le principe à l'abattage (technique × diamètre) et à la haie (un
 * prix au mètre linéaire).
 *
 * Née vide : aucun prix n'est semé par le dépôt. Une case vide est une question
 * posée ; une case pré-remplie au jugé serait un prix inventé sur le devis d'un
 * client. Les bornes des tranches vivent dans `src/lib/grille-prix.ts`,
 * pures et éprouvables sans base.
 *
 * Isolée par entreprise, contrairement à `termes_metier` : ce sont ses prix de
 * vente, pas du vocabulaire (`docs/QUESTIONS.md` §10).
 */
export const grillePrix = pgTable(
  "grille_prix",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    entrepriseId: uuid("entreprise_id").notNull(),
    /**
     * La nature du travail chiffré (migration 0027).
     *
     * Chaque nature a ses propres axes — fendage : hauteur × diamètre ;
     * abattage : technique × diamètre ; haie : une seule case au mètre.
     */
    // `dessouchage` et `grumes` ajoutés le 8 août 2026 (migration 0028), sur sa
    // réponse : « le dessouchage oui, et les grumes aussi ».
    //
    // **Liste ouverte depuis le 14 août 2026** (migration 0041) : le patron
    // ajoute ses propres travaux, et une liste fermée les aurait refusés au
    // moment où il pose son premier prix — l'erreur aurait accusé le prix. Ce
    // qui protège la table n'a pas bougé : une clé de case inconnue n'écrit
    // nulle part (`poserPrixGrille`).
    nature: text("nature").notNull().default("fendage"),
    /** La case, `h10|d40` ou `au_pied|d70` — fabriquée par `src/lib/grille-prix.ts`. */
    cellule: text("cellule").notNull(),
    prix: numeric("prix", { precision: 10, scale: 2 }).notNull(),
    /** `saisi` : posé dans les réglages. `devis` : observé sur un devis réel. */
    origine: text("origine", { enum: ["saisi", "devis"] }).notNull().default("saisi"),
    constateLe: timestamp("constate_le", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [unique("grille_prix_cellule_uk").on(t.entrepriseId, t.nature, t.cellule)]
);

/**
 * Les tranches d'un axe, quand l'artisan a réglé les siennes (migration 0041).
 *
 * **Sa demande du 14 août 2026 :** *« je dois pouvoir ajouter ou retirer des
 * cases. »* Les huit diamètres, six hauteurs et trois façons d'abattre venaient
 * de ses devis du 8 août — mais figées dans le code depuis.
 *
 * **Cette table est VIDE tant qu'il n'a rien touché**, et c'est délibéré : les
 * valeurs de départ vivent dans `src/lib/grille-prix.ts`, où elles restent
 * discutables sans lire une requête. Les lignes n'apparaissent qu'au premier
 * geste sur un axe — on recopie alors les tranches de départ, puis on applique
 * son geste (`materialiserAxe`).
 *
 * **`retireeLe` plutôt qu'une suppression :** un retrait doit pouvoir se
 * défaire, les prix de `grille_prix` doivent survivre au retrait de leur
 * tranche, et la clé ne doit jamais pouvoir être réemployée pour une autre
 * tranche — sans quoi un prix hériterait d'une case qui n'était pas la sienne.
 */
export const tranchesGrille = pgTable(
  "tranches_grille",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    entrepriseId: uuid("entreprise_id").notNull(),
    axe: text("axe", { enum: ["diametre", "hauteur", "technique"] }).notNull(),
    /** La clé écrite dans `grille_prix.cellule`. Elle ne change jamais. */
    cle: text("cle").notNull(),
    /** Borne basse EXCLUE. Une façon d'abattre porte 0 : c'est son libellé qui dit tout. */
    de: numeric("de", { precision: 10, scale: 2 }).notNull().default("0"),
    /** Borne haute INCLUSE. `null` pour la dernière tranche, ouverte. */
    a: numeric("a", { precision: 10, scale: 2 }),
    libelle: text("libelle").notNull(),
    rang: integer("rang").notNull().default(0),
    retireeLe: timestamp("retiree_le", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique("tranches_grille_cle_uk").on(t.entrepriseId, t.axe, t.cle),
    index("tranches_grille_axe_idx").on(t.entrepriseId, t.axe, t.rang),
  ]
);

/**
 * Les natures de travail d'une entreprise (migration 0041).
 *
 * Même mécanique que `tranches_grille` : vide tant qu'il n'a rien touché, les
 * cinq d'origine recopiées au premier geste, et un retrait réversible.
 *
 * **Une nature ajoutée par lui n'est pas reconnue par le chiffrage**, et c'est
 * la limite du geste : `proposition-prix.ts` sait retrouver un abattage ou une
 * fente dans une dictée, pas « le broyage des branches ». Sa grille se remplit
 * et se relit ; Atlas ne la proposera pas de lui-même. L'écran le dit —
 * le lui laisser découvrir sur un devis serait pire.
 */
export const naturesGrille = pgTable(
  "natures_grille",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    entrepriseId: uuid("entreprise_id").notNull(),
    cle: text("cle").notNull(),
    titre: text("titre").notNull(),
    aide: text("aide").notNull().default(""),
    axeLibelle: text("axe_libelle").notNull().default(""),
    forme: text("forme", {
      enum: ["une-case", "un-axe", "technique-diametre", "hauteur-diametre"],
    }).notNull(),
    libelleUnique: text("libelle_unique"),
    rang: integer("rang").notNull().default(0),
    retireeLe: timestamp("retiree_le", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique("natures_grille_cle_uk").on(t.entrepriseId, t.cle),
    index("natures_grille_rang_idx").on(t.entrepriseId, t.rang),
  ]
);

/**
 * L'agenda extérieur d'un artisan, s'il choisit d'en relier un (migration 0032).
 *
 * **Sa décision du 9 août 2026 :** *« que l'utilisateur puisse, s'il le
 * souhaite ou non, connecter son planning à son agenda Google. »* Le
 * raccordement appartient donc à chaque entreprise, jamais à l'installation —
 * une variable d'environnement vaudrait pour tout le monde à la fois, et il n'y
 * aurait plus de « ou non ».
 *
 * **Aucun événement n'est stocké ici.** Ni intitulé, ni participant, ni heure :
 * Atlas interroge l'agenda quand il en a besoin et n'en garde rien. Ce qui
 * n'est pas stocké ne peut pas fuir, et un agenda personnel porte la vie privée
 * d'une famille.
 *
 * Les deux jetons sont **chiffrés avant écriture**
 * (`src/server/agenda/secret-au-repos.ts`) : la RLS protège d'un autre artisan,
 * pas d'une sauvegarde recopiée.
 */
export const agendasExternes = pgTable(
  "agendas_externes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    entrepriseId: uuid("entreprise_id").notNull(),
    fournisseur: text("fournisseur", { enum: ["google", "apple"] }).notNull(),
    /**
     * Les identifiants de l'application chez Google, saisis par l'artisan
     * lui-même (migration 0033, sur sa demande du 9 août 2026).
     *
     * `clientId` en clair — il figure dans l'adresse de consentement que son
     * navigateur affiche. `clientSecret` chiffré : il ne suffit pas à ouvrir un
     * compte, mais il permet d'usurper l'application auprès de Google.
     */
    clientId: text("client_id"),
    clientSecret: text("client_secret"),
    redirection: text("redirection"),
    /** L'adresse du compte relié, pour que l'artisan sache LEQUEL il a branché. */
    compte: text("compte"),
    jetonAcces: text("jeton_acces"),
    jetonRafraichissement: text("jeton_rafraichissement"),
    expireAt: timestamp("expire_at", { withTimezone: true }),
    actif: boolean("actif").notNull().default(true),
    /**
     * Un raccordement qui a cessé de fonctionner doit se VOIR. Sinon l'artisan
     * croit son agenda pris en compte alors qu'Atlas est revenu, en silence, au
     * comportement qui produisait des doublons.
     */
    derniereLectureAt: timestamp("derniere_lecture_at", { withTimezone: true }),
    derniereErreur: text("derniere_erreur"),
    /**
     * Le mot de passe spécifique à l'app, chez Apple — **chiffré** (0035).
     *
     * Apple n'a pas d'équivalent au consentement de Google pour l'agenda : le
     * seul chemin est CalDAV avec ce mot de passe. **Il ouvre tout l'iCloud**,
     * mail et fichiers compris, parce qu'Apple ne sait pas le restreindre à un
     * service — d'où l'avertissement posé AVANT le champ à l'écran.
     */
    motDePasse: text("mot_de_passe"),
    /**
     * Les agendas qu'Atlas LIT, par leur adresse CalDAV.
     *
     * Plusieurs : un compte iCloud en porte souvent trois ou quatre, et être
     * pris le mardi matin ne dépend pas de celui où le rendez-vous est noté.
     * Le tableau vide vaut « tous ceux qu'on a trouvés ».
     */
    agendasLus: jsonb("agendas_lus").$type<string[]>().notNull().default([]),
    /** L'agenda où Atlas ÉCRIT ses chantiers, et son nom pour l'écran. */
    calendrierEcriture: text("calendrier_ecriture"),
    calendrierEcritureNom: text("calendrier_ecriture_nom"),
    /**
     * **Éteinte par défaut, et ce n'est pas une prudence de façade.** Écrire
     * dans l'agenda personnel de quelqu'un est une décision qui lui appartient.
     */
    ecritureActive: boolean("ecriture_active").notNull().default(false),
    /** Une écriture qui a cessé de fonctionner doit se VOIR, comme la lecture. */
    derniereEcritureAt: timestamp("derniere_ecriture_at", { withTimezone: true }),
    derniereErreurEcriture: text("derniere_erreur_ecriture"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [unique("agendas_externes_entreprise_fournisseur_uk").on(t.entrepriseId, t.fournisseur)]
);

/**
 * Les achats du patron, et la TVA qu'il peut déduire.
 *
 * **Elle ne porte pas ses achats : elle porte la TVA de ses achats, telle
 * qu'il l'a CONFIRMÉE.** Aucune règle de déductibilité n'est encodée — elles
 * dépendent de la dépense et du véhicule, et Atlas n'a pas de source pour en
 * juger. Il additionne ce qu'il confirme, son comptable fait le tri
 * (`drizzle/0036_achats_tva.sql`).
 *
 * `tvaDeductible` est le seul montant obligatoire : un ticket de station
 * n'affiche pas toujours son total ni son taux, et refuser l'achat serait
 * perdre la TVA.
 */
export const achatsTva = pgTable("achats_tva", {
  id: uuid("id").primaryKey().defaultRandom(),
  entrepriseId: uuid("entreprise_id")
    .notNull()
    .references(() => entreprises.id, { onDelete: "cascade" }),
  /** La date de l'ACHAT, jamais celle de la saisie : c'est elle qui range la
   *  ligne dans une période. Un ticket de juillet scanné en septembre reste
   *  un achat de juillet. */
  dateAchat: date("date_achat").notNull(),
  fournisseur: text("fournisseur").notNull(),
  totalTtc: numeric("total_ttc", { precision: 12, scale: 2 }),
  tauxTva: numeric("taux_tva", { precision: 5, scale: 2 }),
  tvaDeductible: numeric("tva_deductible", { precision: 12, scale: 2 }).notNull(),
  /** Le ticket photographié, dans le stockage. `null` pour une saisie à la main. */
  photoCle: text("photo_cle"),
  /** Par où il est entré. Sert le jour où une lecture automatique se révèle
   *  fautive : il faut pouvoir retrouver ce qui vient de la machine sans
   *  toucher à ce que le patron a écrit lui-même. */
  saisie: text("saisie", { enum: ["scan", "main"] }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
  createdBy: uuid("created_by").references(() => users.id),
});

// ═══════════════════════════════════════════════════════════════════════════
// Diagnostic végétal (migration 0056) — deux mondes qui ne se mélangent jamais
// ═══════════════════════════════════════════════════════════════════════════
//
// **A. La base phytosanitaire : commune, en lecture seule, SANS RLS.** Un fait
// phytosanitaire n'appartient à aucune entreprise. Même modèle que
// `cataloguePrestations` et `documentsLegaux` : aucun `entrepriseId`, et
// `GRANT SELECT` seul côté base — l'import tourne sous le rôle propriétaire.
// Une faille applicative ne peut donc pas écrire une maladie inventée dans la
// base commune de tout le monde : il n'y a pas de droit d'écriture à voler.
//
// **B. Les diagnostics : ses données, isolées par RLS**, comme tout le reste.
//
// Le raisonnement complet — et les trois colonnes qui portent la sécurité du
// module — est en tête de `drizzle/0056_diagnostic_vegetal.sql`.

export const sourcesPhyto = pgTable("sources_phyto", {
  id: uuid("id").primaryKey().defaultRandom(),
  code: text("code").notNull().unique(),
  organisme: text("organisme").notNull(),
  titre: text("titre").notNull(),
  url: text("url"),
  nature: text("nature", { enum: ["officielle", "scientifique", "technique", "reglementaire"] }).notNull(),
  publieeLe: date("publiee_le"),
  /** Quand on a LU la source — distinct de sa date de publication. Une page
   *  d'organisme qui bouge sans changer d'adresse ne se détecte qu'avec les deux. */
  consulteeLe: date("consultee_le").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const taxons = pgTable(
  "taxons",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    code: text("code").notNull().unique(),
    nomScientifique: text("nom_scientifique"),
    nomCommun: text("nom_commun").notNull(),
    synonymes: text("synonymes").array().notNull().default(sql`'{}'::text[]`),
    /** Beaucoup de fiches disent « les chênes » sans préciser l'espèce ; forcer
     *  une espèce là où la source n'en donne pas serait inventer. */
    rang: text("rang", { enum: ["genre", "espece", "famille", "groupe"] }).notNull().default("espece"),
    /** Sert au rapprochement quand l'essence exacte n'est pas reconnaissable. */
    port: text("port", { enum: ["feuillu", "conifere", "arbuste", "palmier", "autre"] }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("taxons_nom_commun_idx").on(t.nomCommun)]
);

export const fichesPhyto = pgTable("fiches_phyto", {
  id: uuid("id").primaryKey().defaultRandom(),
  code: text("code").notNull().unique(),
  nomCommun: text("nom_commun").notNull(),
  /** Nul assumé : un stress abiotique n'a pas de nom scientifique. */
  nomScientifique: text("nom_scientifique"),
  categorie: text("categorie", {
    enum: [
      "maladie",
      "champignon_lignivore",
      "champignon_autre",
      "ravageur",
      "carence",
      "stress_abiotique",
      "degat_mecanique",
    ],
  }).notNull(),
  agentCausal: text("agent_causal"),
  agentType: text("agent_type", {
    enum: ["champignon", "bacterie", "virus", "insecte", "acarien", "nematode", "abiotique", "inconnu"],
  })
    .notNull()
    .default("inconnu"),
  /** Vocabulaire fermé, partagé MOT POUR MOT avec l'observation rendue par le
   *  modèle (`src/lib/diagnostic-vegetal.ts`). C'est ce partage qui rend le
   *  rapprochement déterministe possible : deux vocabulaires auraient demandé
   *  une traduction, donc une interprétation. */
  partiesAtteintes: text("parties_atteintes").array().notNull().default(sql`'{}'::text[]`),
  periodeDebutMois: integer("periode_debut_mois"),
  periodeFinMois: integer("periode_fin_mois"),
  /** La phrase du résultat, recopiée telle quelle. Jamais reformulée. */
  explicationCourte: text("explication_courte").notNull(),
  gravite: text("gravite", { enum: ["faible", "vigilance", "importante"] }).notNull(),
  /** Dès que ce n'est pas « aucun », le résultat porte la phrase qui dit qu'une
   *  photo ne juge pas la solidité d'un arbre — phrase qui vient du CODE et non
   *  de la fiche, pour qu'elle ne puisse pas manquer si une fiche est mal remplie. */
  impactMecanique: text("impact_mecanique", { enum: ["aucun", "possible", "avere", "inconnu"] })
    .notNull()
    .default("inconnu"),
  impactMecaniqueNote: text("impact_mecanique_note"),
  risqueHumainAnimal: text("risque_humain_animal", {
    enum: ["aucun", "irritant", "toxique", "allergisant", "inconnu"],
  })
    .notNull()
    .default("inconnu"),
  risqueHumainAnimalNote: text("risque_humain_animal_note"),
  statutReglementaire: text("statut_reglementaire", {
    enum: ["aucun", "quarantaine", "lutte_obligatoire", "liste_alerte"],
  })
    .notNull()
    .default("aucun"),
  referenceReglementaire: text("reference_reglementaire"),
  /** Une fiche « impossible » ne sera JAMAIS rendue comme conclusion, quel que
   *  soit son score : c'est ce qui empêche d'affirmer depuis une photo ce
   *  qu'une photo ne montre pas. */
  diagnosticPhoto: text("diagnostic_photo", { enum: ["possible", "indicatif", "impossible"] }).notNull(),
  photosUtiles: text("photos_utiles").array().notNull().default(sql`'{}'::text[]`),
  conduiteRecommandee: text("conduite_recommandee").notNull(),
  prevention: text("prevention"),
  gestion: text("gestion"),
  /** Ne s'affiche que dans les détails, avec sa source : recommander un produit
   *  phytosanitaire engage, et l'IA n'en improvise aucun. */
  traitement: text("traitement"),
  /** Ce qui permet de RECONNAÎTRE ce problème plutôt qu'un autre. Recopié de la
   *  source, jamais reformulé — c'est ce qui rend la comparaison champ par
   *  champ possible après l'import (migration 0057). */
  criteresDiscriminants: text("criteres_discriminants").array().notNull().default(sql`'{}'::text[]`),
  /** Ce qui l'ÉCARTE. Un critère négatif ferme au lieu d'ouvrir, et vaut donc
   *  souvent mieux qu'un positif. */
  criteresExclusion: text("criteres_exclusion").array().notNull().default(sql`'{}'::text[]`),
  /** Ne sert PAS au score — ce serait interpréter — mais s'affiche. */
  facteursFavorisants: text("facteurs_favorisants").array().notNull().default(sql`'{}'::text[]`),
  /** Ce qu'il faudrait EN PLUS de la photo. Affiché quand Atlas refuse : un
   *  refus qui dit ce qui manque vaut dix fois un refus qui se tait. */
  informationsRequises: text("informations_requises").array().notNull().default(sql`'{}'::text[]`),
  /** « La détection en laboratoire est nécessaire. » Quand c'est rempli,
   *  l'écran le dit et le mot « confirmé » n'apparaît nulle part. */
  methodeConfirmation: text("methode_confirmation"),
  /** Le plafond de confiance que la SOURCE autorise. Le moteur ne le dépasse
   *  jamais, quel que soit son score. */
  certitudeMax: text("certitude_max", { enum: ["elevee", "probable", "incertaine"] })
    .notNull()
    .default("elevee"),
  /** La source déclare-t-elle elle-même que sa liste d'hôtes n'est pas close ?
   *  Si oui, un hôte hors liste redevient un doute au lieu d'une exclusion. */
  hotesNonExhaustifs: boolean("hotes_non_exhaustifs").notNull().default(false),
  /** **Seule « validee » est servie.** Une fiche en cours de saisie n'atteint
   *  jamais un chantier. Et « validee » est REFUSÉ PAR CONTRAINTE tant que
   *  `controleIntegriteOk` est faux (migration 0057). */
  niveauValidation: text("niveau_validation", { enum: ["brouillon", "en_revue", "validee"] })
    .notNull()
    .default("brouillon"),
  /** Posé par la comparaison champ par champ entre le fichier source et ce qui
   *  a réellement été écrit, dans la transaction d'import. */
  controleIntegriteOk: boolean("controle_integrite_ok").notNull().default(false),
  controleIntegriteLe: timestamp("controle_integrite_le", { withTimezone: true }),
  /** Une fixture de test porte obligatoirement un code préfixé `zz-test-`, et
   *  réciproquement — contrainte CHECK dans la migration, dans les DEUX sens.
   *  Le chemin de lecture applicatif écarte les fixtures par défaut. */
  origine: text("origine", { enum: ["reelle", "fixture_test"] }).notNull().default("reelle"),
  version: integer("version").notNull().default(1),
  sourcesAJourLe: date("sources_a_jour_le"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

/**
 * Une ligne par symptôme, et non un bloc de texte.
 *
 * C'est sur ces lignes que le rapprochement filtre et score. Noyées dans une
 * prose, elles auraient demandé qu'un modèle les relise à chaque diagnostic —
 * donc qu'il interprète, donc qu'il puisse se tromper au pire endroit.
 *
 * La distinction symptôme/signe compte pour le score : un symptôme est ce que
 * le végétal SUBIT, un signe est l'agent LUI-MÊME rendu visible. Un signe vaut
 * bien plus, parce qu'un symptôme se partage entre dix causes.
 */
export const symptomesPhyto = pgTable(
  "symptomes_phyto",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ficheId: uuid("fiche_id")
      .notNull()
      .references(() => fichesPhyto.id, { onDelete: "cascade" }),
    nature: text("nature", { enum: ["symptome", "signe"] }).notNull(),
    partie: text("partie").notNull(),
    motif: text("motif").notNull(),
    couleurs: text("couleurs").array().notNull().default(sql`'{}'::text[]`),
    localisations: text("localisations").array().notNull().default(sql`'{}'::text[]`),
    /** Un RANG, pas une probabilité — et le code ne le présente jamais comme
     *  un pourcentage. */
    poids: text("poids", { enum: ["cardinal", "frequent", "possible"] }).notNull().default("frequent"),
    libelle: text("libelle"),
    ordre: integer("ordre").notNull().default(0),
  },
  (t) => [index("symptomes_phyto_fiche_idx").on(t.ficheId)]
);

export const hotesPhyto = pgTable(
  "hotes_phyto",
  {
    ficheId: uuid("fiche_id")
      .notNull()
      .references(() => fichesPhyto.id, { onDelete: "cascade" }),
    taxonId: uuid("taxon_id")
      .notNull()
      .references(() => taxons.id, { onDelete: "restrict" }),
    /** `strict` est une EXCLUSION, pas un malus : la fiche ne peut pas concerner
     *  un autre hôte. C'est ce qui évite de proposer une maladie du platane sur
     *  un chêne. */
    specificite: text("specificite", { enum: ["strict", "frequent", "occasionnel"] })
      .notNull()
      .default("frequent"),
    /** L'ordre du FICHIER source, conservé tel quel.
     *
     *  Ajouté le 20 août 2026 : la relecture se faisait par ordre alphabétique
     *  de code, c'est-à-dire dans un ordre qui n'est celui d'aucun document, et
     *  le contrôle d'intégrité l'a vu du premier coup (`ARCHITECTURE.md` §138).
     *  L'ordre d'une liste d'hôtes est une information — la plaquette du DSF
     *  nomme d'abord les essences les plus touchées. */
    ordre: integer("ordre").notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.ficheId, t.taxonId] })]
);

/**
 * La table qui commande la demande de photo complémentaire.
 *
 * Quand deux hypothèses arrivent au coude à coude, l'écran n'invente pas de
 * consigne : il lit `photoQuiTranche` sur la ligne qui relie les deux fiches et
 * l'affiche mot pour mot. Sans ligne, pas de relance — on refuse de conclure
 * plutôt que d'improviser.
 */
export const confusionsPhyto = pgTable(
  "confusions_phyto",
  {
    ficheId: uuid("fiche_id")
      .notNull()
      .references(() => fichesPhyto.id, { onDelete: "cascade" }),
    ficheConfondueId: uuid("fiche_confondue_id")
      .notNull()
      .references(() => fichesPhyto.id, { onDelete: "cascade" }),
    critereDifferenciant: text("critere_differenciant").notNull(),
    /** Nulle = aucune photo ne tranche, et alors on ne relance pas. */
    photoQuiTranche: text("photo_qui_tranche"),
    partieQuiTranche: text("partie_qui_tranche"),
    /** L'ordre du FICHIER source, conservé tel quel.
     *
     *  Ajouté le 20 août 2026 : la relecture se faisait par ordre alphabétique
     *  de code, c'est-à-dire dans un ordre qui n'est celui d'aucun document, et
     *  le contrôle d'intégrité l'a vu du premier coup (`ARCHITECTURE.md` §138).
     *  L'ordre d'une liste d'hôtes est une information — la plaquette du DSF
     *  nomme d'abord les essences les plus touchées. */
    ordre: integer("ordre").notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.ficheId, t.ficheConfondueId] })]
);

export const fichesSources = pgTable(
  "fiches_sources",
  {
    ficheId: uuid("fiche_id")
      .notNull()
      .references(() => fichesPhyto.id, { onDelete: "cascade" }),
    sourceId: uuid("source_id")
      .notNull()
      .references(() => sourcesPhyto.id, { onDelete: "restrict" }),
    /** **La colonne qui fait tout l'intérêt de cette table.** Une fiche reliée
     *  « en gros » à trois organismes ne dit pas QUI affirme quoi : le jour où
     *  la conduite recommandée est contestée, il faut pouvoir désigner la source
     *  de CETTE ligne-là, pas la bibliographie entière. */
    champs: text("champs").array().notNull().default(sql`'{}'::text[]`),
    /** L'ordre du FICHIER source, conservé tel quel.
     *
     *  Ajouté le 20 août 2026 : la relecture se faisait par ordre alphabétique
     *  de code, c'est-à-dire dans un ordre qui n'est celui d'aucun document, et
     *  le contrôle d'intégrité l'a vu du premier coup (`ARCHITECTURE.md` §138).
     *  L'ordre d'une liste d'hôtes est une information — la plaquette du DSF
     *  nomme d'abord les essences les plus touchées. */
    ordre: integer("ordre").notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.ficheId, t.sourceId] })]
);

export const imagesPhyto = pgTable(
  "images_phyto",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ficheId: uuid("fiche_id")
      .notNull()
      .references(() => fichesPhyto.id, { onDelete: "cascade" }),
    storageKey: text("storage_key"),
    /** Le chemin de la photo DANS LE DÉPÔT, tel que la fiche le déclare.
     *  `storageKey` en est dérivée à l'import et change à chaque réécriture ;
     *  celui-ci ne bouge pas — c'est lui qui dit ce qu'une clé représente.
     *  Ajouté le 20 août 2026 : le contrôle d'intégrité a montré que la base
     *  perdait cette information sans que rien ne le signale. */
    fichier: text("fichier"),
    url: text("url"),
    /** NOT NULL, et c'est le garde-fou : une photo d'organisme reprise sans
     *  droit sur l'écran d'un artisan est un risque qui ne se voit qu'une fois
     *  la mise en demeure reçue. */
    licence: text("licence").notNull(),
    credit: text("credit").notNull(),
    partie: text("partie"),
    legende: text("legende"),
    ordre: integer("ordre").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("images_phyto_fiche_idx").on(t.ficheId, t.ordre)]
);

// --- B. Ses diagnostics, isolés par RLS ------------------------------------

/**
 * Une demande de diagnostic.
 *
 * **`chantierId` est NULLABLE, et c'est une décision produit.** Sa règle du
 * 20 août 2026 : « le diagnostic doit fonctionner de manière totalement
 * autonome ; aucun chantier ne doit être nécessaire. » Même objection que pour
 * le plan d'arrosage (`ARCHITECTURE.md` §125) : un outil qui exige un chantier
 * ne sert pas en visite de devis. Le rattachement vient après, s'il le veut.
 *
 * **`resultat` est FIGÉ.** Ce qu'il a lu ce jour-là ne change pas parce qu'une
 * fiche a été corrigée depuis — sans quoi un diagnostic contesté six mois plus
 * tard deviendrait impossible à relire, au moment précis où on en a besoin.
 *
 * **`moteur`, `modele`, `versionBase` :** trois colonnes qui ne servent jamais
 * à l'écran et qui sauvent une enquête.
 */
export const diagnostics = pgTable(
  "diagnostics",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    entrepriseId: uuid("entreprise_id")
      .notNull()
      .references(() => entreprises.id, { onDelete: "cascade" }),
    chantierId: uuid("chantier_id"),
    statut: text("statut", {
      enum: ["en_analyse", "complement_demande", "rendu", "inconclusif", "echoue"],
    })
      .notNull()
      .default("en_analyse"),
    ficheId: uuid("fiche_id").references(() => fichesPhyto.id, { onDelete: "restrict" }),
    /** TROIS MOTS, jamais un pourcentage. Aucun modèle employé ici ne fournit
     *  de probabilité calibrée ; en afficher une serait mentir. */
    confiance: text("confiance", { enum: ["elevee", "probable", "incertaine"] }),
    taxonId: uuid("taxon_id").references(() => taxons.id, { onDelete: "set null" }),
    essenceConfiance: text("essence_confiance"),
    /** L'observation structurée rendue par le modèle. Aucune prose affichée
     *  n'en sort : elle sert au rapprochement et au diagnostic d'un diagnostic
     *  raté. */
    observation: jsonb("observation"),
    resultat: jsonb("resultat"),
    complementConsigne: text("complement_consigne"),
    complementPartie: text("complement_partie"),
    /** **Une seule relance, jamais deux** — l'invariant est aussi en base
     *  (CHECK 0..1), pour qu'il ne dépende pas du seul code. */
    complementsDemandes: integer("complements_demandes").notNull().default(0),
    moteur: text("moteur"),
    modele: text("modele"),
    versionBase: text("version_base"),
    /** Vient d'une liste fermée du code — jamais d'un modèle. */
    motifRefus: text("motif_refus"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    renduAt: timestamp("rendu_at", { withTimezone: true }),
  },
  (t) => [
    index("diagnostics_entreprise_idx").on(t.entrepriseId, t.createdAt),
    foreignKey({
      columns: [t.chantierId, t.entrepriseId],
      foreignColumns: [chantiers.id, chantiers.entrepriseId],
      name: "diagnostics_chantier_entreprise_fk",
    }),
  ]
);

/**
 * Les photos d'un diagnostic.
 *
 * **`storageKey` est ANNULABLE**, comme sur `notesVocales` : la photo se purge
 * et le diagnostic lui survit — il garde son résultat, sa date et sa fiche,
 * sans garder l'image d'un jardin.
 *
 * **`exifRetire` n'est pas décoratif** : une photo de jardin porte une maison,
 * parfois un visage, et les coordonnées GPS de chez le client. La colonne
 * PROUVE le nettoyage ligne par ligne, ce qui rend le contrôle possible après
 * coup plutôt que sur parole.
 */
export const photosDiagnostic = pgTable(
  "photos_diagnostic",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    entrepriseId: uuid("entreprise_id")
      .notNull()
      .references(() => entreprises.id, { onDelete: "cascade" }),
    diagnosticId: uuid("diagnostic_id")
      .notNull()
      .references(() => diagnostics.id, { onDelete: "cascade" }),
    storageKey: text("storage_key"),
    mimeType: text("mime_type").notNull(),
    tailleOctets: integer("taille_octets").notNull(),
    checksum: text("checksum").notNull(),
    role: text("role", { enum: ["initiale", "complement"] }).notNull().default("initiale"),
    partieDemandee: text("partie_demandee"),
    exifRetire: boolean("exif_retire").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    purgeeLe: timestamp("purgee_le", { withTimezone: true }),
  },
  (t) => [index("photos_diagnostic_diagnostic_idx").on(t.entrepriseId, t.diagnosticId)]
);

/**
 * Ce que le moteur a envisagé, avec son score et ce qui a compté.
 *
 * **Jamais affiché.** Sa règle : « le système doit pouvoir produire plusieurs
 * hypothèses en interne, mais ne pas surcharger l'utilisateur. » Elles existent
 * pour une seule raison : le jour où un diagnostic se trompe, savoir POURQUOI.
 * Sans elles il ne resterait que le résultat — c'est-à-dire ce qui est faux,
 * sans rien pour remonter au critère fautif.
 */
export const hypothesesDiagnostic = pgTable(
  "hypotheses_diagnostic",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    entrepriseId: uuid("entreprise_id")
      .notNull()
      .references(() => entreprises.id, { onDelete: "cascade" }),
    diagnosticId: uuid("diagnostic_id")
      .notNull()
      .references(() => diagnostics.id, { onDelete: "cascade" }),
    ficheId: uuid("fiche_id")
      .notNull()
      .references(() => fichesPhyto.id, { onDelete: "cascade" }),
    rang: integer("rang").notNull(),
    /** Entre 0 et 1000 pour rester entier. **Ce n'est PAS une probabilité**, et
     *  il ne sort jamais à l'écran — d'où l'échelle inhabituelle, qui décourage
     *  de l'afficher comme un pourcentage. */
    score: integer("score").notNull(),
    motifs: jsonb("motifs").notNull().default(sql`'[]'::jsonb`),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique("hypotheses_diagnostic_uk").on(t.diagnosticId, t.ficheId),
    index("hypotheses_diagnostic_idx").on(t.entrepriseId, t.diagnosticId, t.rang),
  ]
);

/**
 * La file de purge des photos de diagnostic.
 *
 * Copie conforme d'`audiosAPurger`, pour la raison qui l'avait fait naître :
 * une opération de maintenance sans contexte d'entreprise passe par une file
 * qui PORTE l'entreprise, jamais par un contournement de la RLS
 * (`CLAUDE.md` §4).
 *
 * `purgerLe` est calculé à l'écriture depuis une politique CONFIGURABLE
 * (`src/lib/retention-diagnostic.ts`) : aucune durée arbitraire gravée dans le
 * code.
 */
export const photosDiagnosticAPurger = pgTable(
  "photos_diagnostic_a_purger",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    photoId: uuid("photo_id")
      .notNull()
      .references(() => photosDiagnostic.id, { onDelete: "cascade" }),
    entrepriseId: uuid("entreprise_id")
      .notNull()
      .references(() => entreprises.id, { onDelete: "cascade" }),
    storageKey: text("storage_key").notNull(),
    purgerLe: timestamp("purger_le", { withTimezone: true }).notNull(),
    misEnFileLe: timestamp("mis_en_file_le", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique("photos_diagnostic_a_purger_uk").on(t.photoId),
    index("photos_diagnostic_a_purger_echeance_idx").on(t.purgerLe),
  ]
);

// --- Échecs de connexion (migration 0062, audit C1 du 23 août 2026) ---------
//
// **La seule protection contre le bourrage qui survive à une panne de Redis.**
// Le raisonnement complet — pourquoi une empreinte plutôt que l'adresse,
// pourquoi aucune politique d'isolation ici, pourquoi le blocage est plafonné —
// vit en tête de `drizzle/0062_tentatives_connexion.sql`. La règle des paliers,
// elle, est une fonction pure : `src/lib/tentatives-connexion.ts`.
export const tentativesConnexion = pgTable("tentatives_connexion", {
  /** SHA-256 hexadécimal de l'adresse normalisée — jamais l'adresse elle-même. */
  empreinte: text("empreinte").primaryKey(),
  /** Échecs CONSÉCUTIFS : une connexion réussie efface la ligne. */
  echecs: integer("echecs").notNull().default(0),
  dernierEchecAt: timestamp("dernier_echec_at", { withTimezone: true }).notNull().defaultNow(),
  bloqueJusqua: timestamp("bloque_jusqua", { withTimezone: true }),
});

// --- Clés d'appareil : « Ouvrir avec Face ID » (migration 0063) -------------
//
// **Aucune donnée biométrique ici.** Le visage ne quitte jamais le téléphone :
// ce qui arrive en base est une clé PUBLIQUE — de quoi vérifier une signature,
// jamais d'en produire une. Volée, elle n'ouvre rien.
//
// Le raisonnement complet — pourquoi aucune politique d'isolation, pourquoi le
// compteur ne peut pas servir de garde-fou seul — vit en tête de
// `drizzle/0063_cles_appareil.sql`. Les règles, elles, sont pures :
// `src/lib/cle-appareil.ts`.
export const clesAppareil = pgTable(
  "cles_appareil",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    utilisateurId: uuid("utilisateur_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    /** L'identifiant que l'authentificateur donne à sa clé, en base64url. */
    identifiantCle: text("identifiant_cle").notNull().unique(),
    /** La clé PUBLIQUE, en base64url. */
    clePublique: text("cle_publique").notNull(),
    /**
     * Le nombre de signatures annoncé par l'appareil. **Zéro est ordinaire** —
     * les clés de plateforme d'Apple n'en tiennent aucun (voir `estRejeu`).
     *
     * `mode: "number"` : la valeur reste très en deçà de ce qu'un nombre
     * JavaScript représente exactement, et un `bigint` ici obligerait chaque
     * comparaison de la règle pure à changer de type pour rien.
     */
    compteur: bigint("compteur", { mode: "number" }).notNull().default(0),
    /** « iPhone », « Mac » — deviné, renommable, et qui ne décide de RIEN. */
    nomAppareil: text("nom_appareil").notNull(),
    creeLe: timestamp("cree_le", { withTimezone: true }).notNull().defaultNow(),
    dernierUsageLe: timestamp("dernier_usage_le", { withTimezone: true }),
  },
  (t) => [index("cles_appareil_utilisateur_idx").on(t.utilisateurId)]
);
