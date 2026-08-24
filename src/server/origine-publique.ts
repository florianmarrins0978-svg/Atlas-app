/**
 * L'adresse complète d'Atlas, telle qu'on la met dans un lien.
 *
 * **Ces quatre lignes étaient recopiées dans QUATRE écrans** — le devis parti,
 * le devis complet, la facture, la fiche de chantier — chacun avec son propre
 * commentaire disant qu'il faisait comme le voisin. Quatre copies d'une règle,
 * c'est quatre endroits à corriger le jour où elle change, et le 24 août 2026
 * elle a changé : `ATLAS_URL_PUBLIQUE` entre dans le calcul (`CLAUDE.md` §3).
 *
 * **Bâtie côté SERVEUR, jamais depuis `window`.** Composée dans le navigateur,
 * elle diffère de ce que le serveur a rendu, et React régénère alors tout
 * l'arbre en annonçant « Hydration failed » — l'erreur que le patron a signalée
 * le 13 août sur la page de sa facture (`ARCHITECTURE.md` §68, §81).
 *
 * **`ATLAS_URL_PUBLIQUE` COMMANDE quand elle est posée**, et c'est le seul
 * moyen qu'a un déploiement derrière un mandataire muet de dire son adresse.
 * Sans elle, on part de ce que le navigateur a réellement demandé : sur l'espace
 * de travail du patron, l'hôte public arrive dans `x-forwarded-host`.
 *
 * **Ce qu'elle ne peut PAS deviner, et il faut le savoir en la lisant :** quand
 * il ouvre Atlas par la redirection de port de son éditeur, le navigateur
 * demande `localhost:3000` et aucun en-tête ne porte l'adresse publique. La
 * fonction rend alors honnêtement `http://localhost:3000` — c'est à celui qui
 * met cette adresse dans un message de refuser (`ouvrableParLeClient`).
 */
export function originePublique(entetes: {
  get(nom: string): string | null;
}): string {
  const declaree = (process.env.ATLAS_URL_PUBLIQUE ?? "").trim();
  if (declaree) return declaree.replace(/\/+$/, "");

  // `x-forwarded-host` peut porter une liste quand plusieurs mandataires se
  // succèdent : le premier est celui que le navigateur a demandé.
  const hote =
    entetes.get("x-forwarded-host")?.split(",")[0]?.trim() || entetes.get("host")?.trim() || "";
  if (!hote) return "";

  const protocole =
    entetes.get("x-forwarded-proto")?.split(",")[0]?.trim() ||
    (hote.startsWith("localhost") || hote.startsWith("127.0.0.1") ? "http" : "https");
  return `${protocole}://${hote}`;
}
