/**
 * CE QUE LA BASE A RÉPONDU QUAND UNE MIGRATION A ÉCHOUÉ — assaini.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * **Sa panne du 13 septembre 2026.** Trois écrans par terre, quatre migrations
 * de retard. La fiche de son espace disait QUE la base était en retard ; elle
 * ne disait pas POURQUOI la migration refusait de passer. La raison existait —
 * `demarrer.sh` l'écrit dans le journal de démarrage — mais ce journal n'est
 * délibérément pas publié : le dépôt est public, et une censure faite au jugé
 * finit toujours par laisser passer l'imprévu.
 *
 * Il a demandé la raison sur la fiche, « à condition de ne jamais exposer de
 * donnée sensible, de secret, de valeur métier confidentielle ou de contenu
 * utilisateur ». D'où ce module.
 *
 * **On ne CENSURE pas le message : on le RECOMPOSE.** Censurer, c'est publier
 * un texte qu'on n'a pas écrit en espérant l'avoir assez raturé — et PostgreSQL
 * met des valeurs dans ses messages (« Key (email)=(jean@exemple.fr) already
 * exists »). Ici, rien du message d'origine ne sort : on reconnaît sa forme, et
 * l'on écrit NOTRE phrase, où ne passent que des identifiants de schéma — des
 * noms de contraintes, de colonnes, de tables, que le dépôt publie déjà.
 *
 * Une forme qu'on ne reconnaît pas ne sort pas du tout. C'est le seul réglage
 * sûr : un motif oublié coûte une ligne vague, un motif trop large coûte une
 * donnée de son client sur une page publique.
 * ═══════════════════════════════════════════════════════════════════════════
 */

/** Un identifiant SQL, tel que PostgreSQL le cite : lettres, chiffres, _ et -. */
const IDENT = '"([A-Za-z0-9_-]{1,63})"';

/**
 * Les formes reconnues, et la phrase que CHACUNE produit.
 *
 * Chaque entrée ne laisse passer que ses groupes capturés, et ces groupes ne
 * peuvent être que des identifiants de schéma (voir `IDENT`) — jamais une
 * valeur, jamais du texte libre.
 */
const FORMES = [
  {
    motif: new RegExp(`check constraint ${IDENT} of relation ${IDENT} is violated by some row`, "i"),
    phrase: (c, t) => `des lignes déjà en base refusent la contrainte « ${c} » de la table « ${t} »`,
  },
  {
    motif: new RegExp(`duplicate key value violates unique constraint ${IDENT}`, "i"),
    phrase: (c) => `des lignes déjà en base se répètent là où « ${c} » exige l'unicité`,
  },
  {
    motif: new RegExp(`column ${IDENT} does not exist`, "i"),
    phrase: (c) => `la colonne « ${c} » est attendue et n'existe pas`,
  },
  {
    motif: new RegExp(`relation ${IDENT} does not exist`, "i"),
    phrase: (t) => `la table « ${t} » est attendue et n'existe pas`,
  },
  {
    motif: new RegExp(`constraint ${IDENT} .*does not exist`, "i"),
    phrase: (c) => `la contrainte « ${c} » est attendue et n'existe pas`,
  },
  {
    motif: /permission denied for (table|schema|relation) ([A-Za-z0-9_-]{1,63})/i,
    phrase: (quoi, nom) => `droits insuffisants sur ${quoi === "schema" ? "le schéma" : "la table"} « ${nom} » — le rôle propriétaire n'a pas été employé`,
  },
  { motif: /ECONNREFUSED/, phrase: () => "la base n'a pas répondu (connexion refusée)" },
  { motif: /ENOTFOUND/, phrase: () => "la base est introuvable à cette adresse" },
  { motif: /ETIMEDOUT/, phrase: () => "la base n'a pas répondu à temps" },
  { motif: /password authentication failed/i, phrase: () => "le mot de passe de la base est refusé" },
  { motif: /aucune adresse de base/i, phrase: () => "aucune adresse de base n'est configurée" },
];

/**
 * Rend la phrase à publier, ou `null` quand il n'y a rien à dire.
 *
 * @param {string | null | undefined} journal le journal de démarrage, entier
 */
export function raisonDeLaMigration(journal) {
  if (!journal) return null;

  // La DERNIÈRE tentative, jamais la première : un espace rallumé trois fois
  // porte trois lignes, et seule la plus récente décrit l'état d'aujourd'hui.
  const lignes = journal.split("\n").filter((l) => l.startsWith("migrations : "));
  const derniere = lignes[lignes.length - 1];
  if (!derniere || !derniere.includes("échec")) return null;

  for (const { motif, phrase } of FORMES) {
    const trouve = motif.exec(derniere);
    if (trouve) return phrase(...trouve.slice(1));
  }

  // **Rien de reconnu ne sort.** Publier le message brut « pour dépanner »
  // reviendrait à parier qu'il ne contient aucune donnée de ses clients.
  return "échec d'une forme non reconnue — la raison est dans le journal de l'espace";
}
