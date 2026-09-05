import { estCheminPublic } from "@/lib/chemins-publics";

/**
 * Écrans qui ne portent pas la navigation.
 *
 * ───────────────────────────────────────────────────────────────────────────
 * **Pourquoi cette règle a quitté `layout.tsx`, le 5 septembre 2026.**
 *
 * Elle y était juste, et elle ne s'appliquait qu'une fois sur deux. La mise en
 * page RACINE n'est pas rejouée quand on navigue en appuyant sur un lien :
 * Next.js ne redemande que le segment qui change. Le devis ouvert à son adresse
 * n'avait donc pas de barre — mesuré page par page —, tandis que le MÊME devis
 * atteint depuis la fiche client gardait celle de l'écran d'avant.
 *
 * Les deux mesures étaient exactes, et elles se contredisaient : c'est ce qui a
 * fait chercher au mauvais endroit. Sur son téléphone, le 4 septembre, la barre
 * couvrait le bouton d'envoi du devis.
 *
 * La règle vit donc ici, dans une fonction pure, et la barre elle-même s'en
 * sert (`AtlasBottomNav`) : un composant client connaît le chemin courant à
 * chaque navigation, ce que la mise en page racine ne peut pas faire. La mise
 * en page continue de l'appeler au serveur pour ne pas peindre la barre du
 * tout — une barre rendue puis retirée clignoterait.
 *
 * **Une seule source, donc**, comme le veut `CLAUDE.md` §3 : deux copies de
 * cette liste ont déjà divergé une fois, le 12 août 2026, et son client voyait
 * les onglets de son outil de travail au bas de sa facture.
 * ───────────────────────────────────────────────────────────────────────────
 *
 * **Depuis le 30 août 2026, ce n'est plus « ni la navigation, ni l'assistant ».**
 * `…/devis-complet` reste sans onglets, mais garde son panneau — voir
 * `estDevisSeul` dans `layout.tsx`, qui fait l'exception. Le reste de cette
 * liste, lui, n'a droit ni à l'un ni à l'autre.
 *
 * **Les écrans PUBLICS ne sont pas listés ici : ils viennent du même endroit
 * que le contrôle d'accès** (`src/lib/chemins-publics.ts`).
 *
 * Restent ici les écrans du PATRON qui n'ont pas de navigation pour une raison
 * qui leur est propre — ils ne sont pas publics, et n'ont donc rien à faire
 * dans la liste partagée :
 *
 * - `/documents-legaux` précède l'entrée dans l'application : naviguer ailleurs
 *   n'y a pas de sens.
 * - `…/devis-complet` est le devis lui-même, seul sur sa page. Le patron l'a
 *   demandé ainsi : « une page où il n'y a que le devis ». Une barre d'onglets
 *   au bas d'une feuille de devis la fait ressembler à un écran d'application,
 *   et c'est précisément ce qu'elle ne doit pas être. **L'assistant, lui, y est
 *   revenu le 30 août** — sa propre demande, depuis cette page : un bouton de
 *   plus dans l'en-tête n'en fait pas un écran d'application, contrairement à
 *   une barre d'onglets entière.
 */
export const ECRANS_DU_PATRON_SANS_NAVIGATION = ["/documents-legaux"];

export function estEcranSansNavigation(chemin: string | null): boolean {
  if (!chemin) return false;
  if (estCheminPublic(chemin)) return true;
  if (chemin.endsWith("/devis-complet")) return true;
  return ECRANS_DU_PATRON_SANS_NAVIGATION.some((p) => chemin === p || chemin.startsWith(`${p}/`));
}
