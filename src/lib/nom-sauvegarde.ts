/**
 * Le nom sous lequel la sauvegarde arrive sur le téléphone du patron.
 *
 * **Une seule fonction, pour l'écran ET pour le serveur.** Le serveur l'annonce
 * dans `Content-Disposition`, et le lien le redit dans son attribut `download`.
 * Deux implémentations finiraient par diverger, et un fichier qui ne porte pas
 * le nom annoncé est pire qu'un fichier sans nom (`CLAUDE.md` §3).
 *
 * **Pourquoi le lien doit le redire.** Le 7 août 2026, le patron a touché
 * « Télécharger mes données » depuis un iPhone : Safari lui a proposé un fichier
 * nommé **`reglages`**, sans extension — le nom de la PAGE. L'archive était
 * pourtant complète et l'en-tête du serveur correct. Un attribut `download` vide
 * laisse Safari se rabattre sur le document courant ; le fichier arrive alors
 * dans Fichiers sans extension, donc impossible à ouvrir. Une sauvegarde qui ne
 * s'ouvre pas ne sauvegarde rien.
 */
export function nomFichierSauvegarde(nomEntreprise: string, quand: Date): string {
  const jour = quand.toISOString().slice(0, 10);
  return `atlas-${partieDeNom(nomEntreprise)}-${jour}.zip`;
}

/**
 * Nom de fichier lisible, et sûr partout — un accent ou une apostrophe dans le
 * nom de la société suffirait à faire arriver l'archive sous un nom illisible.
 */
function partieDeNom(texte: string): string {
  return (
    texte
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^A-Za-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .toLowerCase()
      .slice(0, 40) || "entreprise"
  );
}
