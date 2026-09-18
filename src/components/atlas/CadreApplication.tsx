"use client";

import { usePathname } from "next/navigation";
import AtlasBottomNav from "./AtlasBottomNav";
import AssistantSidebar from "./AssistantSidebar";
import { FournisseurAssistant } from "./assistant-contexte";
import { estEcranSansNavigation } from "@/lib/ecrans-sans-navigation";
import { peutUtiliserLAssistant, type Role } from "@/lib/acces-roles";

/**
 * LE CADRE DE L'APPLICATION — et c'est LUI qui décide s'il y a une barre du bas.
 *
 * ───────────────────────────────────────────────────────────────────────────
 * **Sa capture du 17 septembre 2026 :** *« le menu du bas disparaît »*, sur son
 * accueil, juste après avoir envoyé un devis.
 *
 * **Ce qui se passait.** Le devis vit seul sur sa page, sans onglets ni cadre
 * (`estEcranSansNavigation`). La mise en page racine choisissait donc, AU
 * SERVEUR, de ne rendre ni cadre, ni barre, ni rembourrage du bas. Puis l'envoi
 * ramène à l'accueil par une navigation douce (`router.push("/")`,
 * `DevisCompletClient`) — et Next.js **ne rejoue pas la mise en page racine**
 * sur une navigation de lien : il ne redemande que le segment qui change.
 *
 * Le choix fait pour le devis survivait donc à l'accueil, et pour toute la
 * durée de l'onglet : plus de barre, plus de cadre, plus de rembourrage — tant
 * qu'il ne rechargeait pas la page. Mesuré, pas supposé : chargé à son adresse,
 * le devis puis l'accueil en douceur rendaient `false` sur la barre
 * (`test-barre-du-bas-apres-devis-e2e.ts`).
 *
 * **Le dépôt avait déjà payé la moitié de ce défaut, dans l'autre sens.** Le
 * 5 septembre 2026, la barre d'un écran précédent RESTAIT sur le devis atteint
 * par un lien, et couvrait son bouton d'envoi. On avait alors appris à la barre
 * à se retirer d'elle-même, d'après le chemin courant. Cela ne pouvait pas
 * réparer ce sens-ci : une barre qui n'a jamais été rendue n'a rien à retirer.
 *
 * **La correction est donc ici, à la racine** : le choix quitte le serveur pour
 * un composant client, qui lit le chemin COURANT (`usePathname`) et se refait à
 * chaque navigation. Et la barre n'a plus à se garder elle-même — deux endroits
 * qui décident de la même chose finissent par diverger (`CLAUDE.md` §3).
 *
 * **Sans clignotement** : `usePathname` rend déjà le bon chemin au rendu du
 * serveur. Une page de devis n'est jamais peinte avec une barre qu'on lui
 * retirerait ensuite.
 * ───────────────────────────────────────────────────────────────────────────
 *
 * Ce qui reste décidé au SERVEUR, et doit le rester : les pages publiques
 * (`layout.tsx`). Le rôle n'y est pas lisible — il n'y a pas de session —, et
 * les demander là renverrait le client de l'artisan vers une session périmée.
 */
export default function CadreApplication({
  role,
  children,
}: {
  role: Role | null;
  children: React.ReactNode;
}) {
  const chemin = usePathname();
  const sansNavigation = estEcranSansNavigation(chemin);
  // **La seule exception au sans-navigation : le devis seul garde l'assistant.**
  // Sa demande du 30 août 2026, depuis cette page même : « j'aimerais avoir
  // accès à l'assistant sur cette page ». Elle reste sans onglets ni titre —
  // ça, c'est resté un choix délibéré du 5 août — mais elle n'est pas publique
  // et le patron qui la remplit à la main a le même besoin d'assistant
  // qu'ailleurs.
  const estDevisSeul = chemin?.endsWith("/devis-complet") ?? false;

  // L'assistant reconstitue au serveur les chantiers, les clients et les prix,
  // et sait lire le devis de n'importe quel client : il est au patron seul
  // (`peutUtiliserLAssistant`, sa demande du 25 août). Le refus est dans
  // l'action (`poserQuestionAction`) ; ici, on ne lui montre pas un bouton qui
  // ne répondrait pas.
  const assistant = !!role && peutUtiliserLAssistant(role);

  if (sansNavigation) {
    // Le devis seul garde le panneau, sans le reste du décor. Aucune barre
    // d'onglets, aucun cadre `atlas-contenu` — seule la page elle-même dessine
    // son bouton, dans son en-tête (voir `DevisCompletClient.tsx`). Le panneau,
    // lui, doit couvrir tout l'écran, donc rester ici comme sur les écrans avec
    // navigation.
    return estDevisSeul ? (
      <FournisseurAssistant disponible={assistant}>
        <main>{children}</main>
        {role !== "salarie" && <AssistantSidebar />}
      </FournisseurAssistant>
    ) : (
      <main>{children}</main>
    );
  }

  return (
    // Le fournisseur entoure le contenu ET le panneau : depuis le 13 août 2026,
    // le bouton de l'assistant vit dans l'en-tête de chaque écran, donc DANS
    // `children`, tandis que le panneau reste ici pour couvrir tout le reste.
    // Les deux se parlent par ce contexte — voir `assistant-contexte.tsx`.
    //
    // Il n'entoure QUE le cadre, sans en changer la hauteur : celle-ci tient
    // compte du bandeau du banc (`minHeight` ci-dessous), et un fournisseur ne
    // rend aucun élément.
    <FournisseurAssistant disponible={assistant}>
      <div
        className="mx-auto flex max-w-md flex-col bg-paper"
        // **Plus aucun nombre écrit à la main ici — 31 août 2026.** C'était
        // `calc(100dvh - 40px)` pour un bandeau qui en mesure 48, et qui grandit
        // encore avec sa barre de progression. Le bandeau publie désormais sa
        // hauteur (`--atlas-bandeau`, remise à zéro quand il s'efface) : une
        // seule source, et elle suit ce qui est vraiment à l'écran.
        style={{ minHeight: "calc(100dvh - var(--atlas-bandeau))" }}
      >
        {/* `atlas-contenu` réserve la hauteur de la barre, indicateur d'accueil
            compris (voir globals.css) : sans navigation, cette marge laisserait
            un vide en bas de page. */}
        <main className="atlas-contenu flex-1">{children}</main>
        <AtlasBottomNav role={role} />
        {role !== "salarie" && <AssistantSidebar />}
      </div>
    </FournisseurAssistant>
  );
}
