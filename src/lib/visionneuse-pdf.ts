/**
 * ─── UN PDF SE REGARDE DANS L'APPLICATION, PAS DANS UN ONGLET DU NAVIGATEUR ──
 *
 * **Sa capture du 11 septembre 2026 :** *« quand j'ouvre le pdf pour voir la
 * facture j'ai pas de touche retour »*. « Voir la facture en PDF » remettait
 * le document à Safari dans un onglet neuf : l'application n'y était plus,
 * donc ni en-tête, ni flèche — et un onglet ouvert par un lien n'a rien
 * derrière lui.
 *
 * La visionneuse (`/documents/pdf`) est un écran de l'application comme les
 * autres : elle porte l'en-tête, la flèche lit le journal de navigation
 * (`journal-de-navigation.ts`) et ramène d'où il vient. Le document, lui, est
 * peint page par page par pdf.js — et non par un `<iframe>`, qui sur iOS ne
 * montre que la première page et ne défile pas.
 *
 * Ce fichier ne tient que l'ADRESSE, dans les deux sens : comment un écran
 * demande la visionneuse, et ce que la visionneuse accepte de lui.
 */

/** L'adresse de l'écran qui peint un PDF. */
export const CHEMIN_VISIONNEUSE = "/documents/pdf";

/**
 * L'adresse de la visionneuse pour ce fichier.
 *
 * `fichier` est l'adresse « ouvrir » du document — celle qui répond `inline`,
 * jamais celle qui porte `?telecharger=1` : ce que la visionneuse peint n'a pas
 * à descendre dans le dossier du téléphone.
 */
export function adresseDeLaVisionneuse(fichier: string, entete: { surtitre: string; titre: string }): string {
  // Le surtitre porte la nature (« Facture »), le titre le numéro : en un seul
  // titre, « Devis 2026-000002 » passait à la ligne en 36 px sur son téléphone.
  const params = new URLSearchParams({ fichier, de: entete.surtitre, titre: entete.titre });
  return `${CHEMIN_VISIONNEUSE}?${params.toString()}`;
}

/**
 * Ce que la visionneuse accepte de peindre, ou `null`.
 *
 * **Uniquement une adresse de CE site, qui sert un PDF.** Le paramètre arrive
 * de l'adresse, donc de n'importe qui : une adresse absolue (`https://…`) ou
 * protocolaire (`//…`) ferait charger un document étranger dans un écran qui
 * porte le nom de l'application ; une page HTML ferait rougir pdf.js sans
 * dire pourquoi. Les routes PDF du dépôt se terminent toutes par `/pdf`
 * (`api/devis/[id]/pdf`, `api/factures/[id]/pdf`, `api/chantiers/[id]/fiche/pdf`…),
 * et c'est ce trait qu'on exige.
 */
export function fichierAccepteParLaVisionneuse(fichier: string | undefined): string | null {
  if (!fichier || !fichier.startsWith("/") || fichier.startsWith("//")) return null;
  const [chemin] = fichier.split("?");
  if (!chemin.endsWith("/pdf")) return null;
  // Aucun retour arrière dans le chemin : `/api/../x/pdf` remonterait ailleurs.
  if (chemin.split("/").includes("..")) return null;
  return fichier;
}

/**
 * L'inverse : le fichier qu'une adresse de visionneuse demande, ou `null` si
 * ce n'en est pas une. Les suites s'en servent pour aller chercher le PDF
 * derrière « Aperçu du PDF » sans recopier la forme de l'adresse.
 */
export function fichierDemandeALaVisionneuse(adresse: string): string | null {
  const [chemin, requete = ""] = adresse.split("?");
  if (chemin !== CHEMIN_VISIONNEUSE) return null;
  return fichierAccepteParLaVisionneuse(new URLSearchParams(requete).get("fichier") ?? undefined);
}
