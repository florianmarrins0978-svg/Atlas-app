// OÙ VIVENT LES FICHIERS D'ATLAS — la liste, à un seul endroit.
//
// ─────────────────────────────────────────────────────────────────────────────
// **POURQUOI CE FICHIER EXISTE.**
//
// Atlas range ses octets dans un stockage objet (S3), et la base ne garde que
// la CLÉ qui y mène. Onze colonnes, réparties sur dix tables, portent une de ces
// clés. Personne ne peut deviner cette liste : ni PostgreSQL, ni l'hébergeur, ni
// un outil de sauvegarde. C'est la seule chose, dans tout le sujet
// « sauvegarde », que le produit doit savoir à la place de sa machine.
//
// **Ce que ça sert, concrètement.** Une base restaurée et un stockage restauré
// ne sont pas la même chose : l'un peut avancer sans l'autre. Une facture dont
// le PDF a disparu, une photo dont la ligne a disparu — les deux se voient en
// comparant cette liste au contenu du stockage, et par aucun autre moyen.
//
// ─────────────────────────────────────────────────────────────────────────────
// **CE QUI EST DÉLIBÉRÉMENT EN DEHORS.**
//
// `src/server/repositories/export-entreprise.ts` tient sa propre liste, plus
// courte, et ce n'est PAS un doublon : elle répond à une autre question —
// « qu'est-ce qui appartient à CETTE entreprise et part dans son archive ? ».
// Celle-ci répond à « qu'est-ce qu'Atlas a posé dans le stockage, tout compris,
// y compris ce qui n'appartient à personne en particulier ? ».
//
// Les deux divergent, et la divergence est **connue et mesurée** (27 août 2026) :
// l'export d'une entreprise n'emporte ni son logo, ni les photos de ses tickets
// de caisse, alors que les lignes `achats_tva`, elles, partent. C'est un défaut
// de l'export, relevé pendant le lot Sauvegarde et laissé tel quel — le corriger
// touche au RGPD et à la portabilité, pas à la sauvegarde. Il est écrit dans
// `TODO.md`. **Ne pas le « réparer » en alignant les deux listes ici** : elles
// ne répondent pas à la même question, et les fondre ferait perdre celle-ci.

/** Une colonne qui porte la clé d'un objet rangé dans le stockage. */
export type ColonneObjet = {
  /** La table, telle qu'elle s'appelle en base. */
  table: string;
  /** La colonne, telle qu'elle s'appelle en base. */
  colonne: string;
  /**
   * Ce que l'objet EST, en français, pour que le rapport se lise.
   * Sert aussi de libellé quand un fichier manque à l'appel.
   */
  quoi: string;
  /**
   * **Une absence est-elle NORMALE ?**
   *
   * C'est le champ qui empêche le contrôle de crier au loup. L'audio d'une
   * note vocale disparaît sept jours après sa transcription — c'est la purge,
   * c'est voulu, et faire rougir un contrôle dessus reviendrait à interdire la
   * purge. Une facture sans son PDF, elle, n'est jamais normale.
   */
  absenceNormale: boolean;
  /** Pourquoi l'absence est normale — vide quand elle ne l'est pas. */
  raisonAbsence?: string;
};

/**
 * Les onze colonnes, dans l'ordre où on les lit dans `schema.ts`.
 *
 * **Cette liste se vérifie contre le schéma**, elle ne se maintient pas à la
 * main : `scripts/test-objets-stockes.ts` relit `schema.ts` et refuse toute
 * colonne portant une clé qui ne figurerait pas ici. Une colonne neuve ajoutée
 * un jour de hâte fait donc rougir la batterie, plutôt que de disparaître
 * silencieusement des contrôles de sauvegarde.
 */
export const COLONNES_OBJET: readonly ColonneObjet[] = [
  {
    table: "entreprises",
    colonne: "logo_storage_key",
    quoi: "le logo de l'entreprise",
    absenceNormale: true,
    raisonAbsence: "une entreprise n'est pas obligée d'avoir un logo",
  },
  {
    table: "notes_vocales",
    colonne: "storage_key",
    quoi: "l'audio d'une note vocale",
    absenceNormale: true,
    raisonAbsence:
      // **Tant que le planificateur n'est pas branché, cette absence ne peut PAS
      // venir de la purge** — elle ne tourne pas (voir docs/DEPLOIEMENT-PURGE.md).
      // Le dire, parce que ce contrôle de cohérence s'appuyait sur une raison qui
      // n'existait pas encore, et tolérait donc une absence pour un motif faux.
      "purgé sept jours après transcription réussie (RETENTION.audioApresTranscriptionJours) — " +
      "tant que le planificateur de purge n'est pas branché, une absence vient d'autre chose",
  },
  {
    table: "photos",
    colonne: "storage_key",
    quoi: "une photo de chantier",
    absenceNormale: false,
  },
  {
    table: "fichiers_a_purger",
    colonne: "storage_key",
    quoi: "un objet en attente de purge",
    absenceNormale: true,
    raisonAbsence: "la file peut nommer un objet déjà retiré par une purge précédente",
  },
  {
    table: "devis",
    colonne: "pdf_storage_key",
    quoi: "le PDF d'un devis envoyé",
    absenceNormale: true,
    raisonAbsence: "un devis en brouillon n'a pas encore de PDF",
  },
  {
    table: "audios_a_purger",
    colonne: "storage_key",
    quoi: "un audio en attente de purge",
    absenceNormale: true,
    raisonAbsence: "même raison que la file des fichiers",
  },
  {
    table: "factures",
    colonne: "pdf_storage_key",
    quoi: "le PDF d'une facture",
    absenceNormale: true,
    raisonAbsence: "une facture en brouillon n'a pas encore de PDF",
  },
  {
    table: "achats_tva",
    colonne: "photo_cle",
    quoi: "la photo d'un ticket de caisse",
    absenceNormale: true,
    raisonAbsence: "un achat peut être saisi à la main, sans photo",
  },
  {
    table: "images_phyto",
    colonne: "storage_key",
    quoi: "une image de fiche phytosanitaire",
    absenceNormale: true,
    raisonAbsence: "la clé est dérivée à l'import et change à chaque réécriture",
  },
  {
    table: "photos_diagnostic",
    colonne: "storage_key",
    quoi: "une photo de diagnostic végétal",
    absenceNormale: true,
    raisonAbsence: "purgée après le délai de rétention du diagnostic",
  },
  {
    table: "photos_diagnostic_a_purger",
    colonne: "storage_key",
    quoi: "une photo de diagnostic en attente de purge",
    absenceNormale: true,
    raisonAbsence: "même raison que les autres files",
  },
] as const;

/**
 * Les colonnes dont l'absence d'objet est une VRAIE anomalie.
 *
 * C'est sur celles-là qu'un contrôle de cohérence a le droit de rougir. Sur les
 * autres, il compte et il dit — il n'accuse pas.
 */
export function colonnesOuUneAbsenceEstGrave(): ColonneObjet[] {
  return COLONNES_OBJET.filter((c) => !c.absenceNormale);
}

/**
 * La requête qui relève toutes les clés d'une colonne.
 *
 * Écrite ici plutôt que dans le script qui l'exécute : le nom de table et de
 * colonne vient de cette liste et de nulle part ailleurs, ce qui interdit
 * l'injection par construction — aucune de ces chaînes ne vient d'un
 * utilisateur.
 */
export function requeteDesCles(c: ColonneObjet): string {
  return `SELECT ${c.colonne} AS cle FROM ${c.table} WHERE ${c.colonne} IS NOT NULL AND ${c.colonne} <> ''`;
}
