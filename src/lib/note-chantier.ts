/**
 * La borne du pense-bête d'un chantier.
 *
 * **Ici, et non dans le dépôt.** L'écran doit connaître ce chiffre pour cesser
 * d'accepter des caractères sous le doigt ; le dépôt le connaît pour tronquer,
 * et la base pour refuser (migration 0060). Trois usages, un seul nombre — et
 * ce fichier ne porte aucun code serveur, donc l'écran peut le lire sans tirer
 * la base dans le navigateur.
 *
 * **Deux mille caractères**, parce que la note descend avec la liste entière du
 * planning : un copier-coller malheureux alourdirait chaque lecture. C'est déjà
 * une page pleine, là où il en faut trois lignes.
 */
export const NOTE_MAX = 2000;
