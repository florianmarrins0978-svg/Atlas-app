"use client";

import Link from "next/link";
import { useSyncExternalStore } from "react";
import { usePathname, useRouter } from "next/navigation";
import { colors } from "@/lib/design-tokens";
import { pagePrecedente } from "@/lib/journal-de-navigation";
import {
  journalDeCetOnglet,
  oublierCetEcran,
  onPeutReculerVers,
  sAbonnerAuJournal,
} from "./journal-navigateur";

/**
 * LA flèche de retour d'Atlas — une seule, pour tous les écrans.
 *
 * **Elle ramène à la page d'où l'on vient**, lue dans le journal de l'onglet, et
 * c'est sa demande du 9 septembre 2026 : *« le bouton retour doit marcher comme
 * un vrai bouton marche arrière, il doit toujours renvoyer à la page d'où l'on
 * vient juste avant »*. Le pourquoi, et les cinq signalements qu'il a fallu pour
 * y arriver, sont dans `src/lib/journal-de-navigation.ts`.
 *
 * **`repli` reste, et ce n'est pas une précaution de style.** Sur la première
 * page d'un onglet, il n'y a aucune page d'avant : un signet, une notification
 * ouverte à froid, l'application relancée depuis l'écran d'accueil du
 * téléphone. La flèche prend alors la sortie que l'écran déclare — c'est-à-dire
 * exactement ce qu'elle faisait avant ce lot. Une flèche muette serait un piège
 * sur un téléphone.
 *
 * **Et son libellé change avec sa destination.** Quand le journal décide, elle
 * annonce « Retour » : elle connaît l'adresse, pas le nom de l'écran, et le
 * dépôt a déjà payé une flèche qui annonçait « Retour au devis » en menant au
 * planning (`retour-du-devis.ts`, 7 septembre 2026). Nommer la destination
 * demanderait une table écran par écran — c'est-à-dire la liste tenue à la main
 * que ce lot supprime. « Retour » est ce que dit le bouton du navigateur, et il
 * ne ment jamais.
 */
export default function FlecheRetour({
  repli,
  allure = "plein",
  diametre = 40,
  fleche = 16,
  marque,
}: {
  /** Où mène la flèche quand on ne sait pas d'où l'on vient. */
  repli: { href: string; libelle: string };
  /** `plein` : posée sur un aplat. `cerne` : cernée d'un cheveu (allure ample). */
  allure?: "plein" | "cerne";
  /** Le diamètre du rond, en pixels — 40 partout, 36 sur la feuille du devis. */
  diametre?: number;
  /** La taille du chevron, en pixels. */
  fleche?: number;
  /** Le repère que les suites navigateur cherchent, là où il en existait un. */
  marque?: string;
}) {
  const chemin = usePathname();
  const router = useRouter();
  // **`useSyncExternalStore` et non un état posé dans un effet.** Le journal est
  // un rangement du navigateur, extérieur à React : c'est le seul crochet qui
  // sache le lire sans provoquer un second rendu en cascade, et React s'y
  // charge lui-même de rejouer la flèche quand la version du serveur — qui ne
  // peut rien savoir du navigateur — diffère de celle de la page vivante.
  //
  // La flèche rendue par le serveur porte donc la sortie déclarée, puis se
  // corrige : elle est utilisable dès la première image, sans attendre.
  //
  // **ELLE S'ABONNE AU JOURNAL, PAS AU `popstate`.** C'était le mauvais signal :
  // le journal ne change pas avec l'événement mais APRÈS lui, quand
  // `atterrirIci` a fait le ménage. La flèche relisait donc un journal périmé,
  // et gardait l'adresse de l'écran qu'on venait de quitter — après un retour
  // du navigateur, elle repartait EN AVANT. Sa panne du 10 septembre 2026 avait
  // cette moitié-là en plus de l'autre.
  const precedente = useSyncExternalStore(
    sAbonnerAuJournal,
    () => pagePrecedente(journalDeCetOnglet(), chemin),
    () => null
  );

  const cerne = allure === "cerne";
  return (
    <Link
      href={precedente ?? repli.href}
      aria-label={precedente ? "Retour" : repli.libelle}
      // **RECULER SE DÉCLARE ICI, ET C'EST TOUT LE MÉCANISME.** Le journal ne
      // peut pas deviner qu'on recule : rouvrir un écran déjà vu laisse
      // exactement la même trace (`journal-de-navigation.ts`). Celui qui sait,
      // c'est celui qui appuie — cet écran sort donc du journal au moment de
      // l'appui, avec tout ce qui le suivait.
      //
      // Sans cette ligne, deux appuis se renvoient l'un à l'autre sans jamais
      // sortir : c'est la boucle du 7 septembre 2026 (`retour-du-devis.ts`),
      // qu'un journal seul aurait refabriquée.
      onClick={(e) => {
        oublierCetEcran(chemin);
        // ── ET ON Y VA EN RECULANT, QUAND C'EST VRAIMENT L'ÉCRAN D'AVANT ──
        //
        // **Sa remarque du 9 septembre 2026 :** *« si je clique sur un client
        // tout en bas de la liste, je fais retour, il me remet en haut de la
        // liste — je veux rester où j'étais ! »*
        //
        // Un lien pose une page NEUVE, donc en haut : mesuré, la flèche
        // déposait à 0 px là où le retour du navigateur rendait 2 941 px. Le
        // navigateur sait déjà rendre sa place ; il suffit de ne plus l'en
        // empêcher.
        //
        // **La destination ne change pas d'un pouce** : c'est toujours celle
        // que le journal a choisie. Seul le CHEMIN pour y aller change, et
        // uniquement si l'entrée d'historique d'avant est littéralement
        // celle-là (`onPeutReculerVers`). Sans preuve — signet, rechargement,
        // écran retiré du journal après un enregistrement — le lien fait son
        // travail comme avant.
        //
        // **Un appui avec une touche de commande n'est pas notre geste** : il
        // ouvre ailleurs, et on n'y touche pas.
        if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
        if (!precedente || !onPeutReculerVers(precedente)) return;
        // `preventDefault` AVANT `back()` : sans lui le lien naviguerait aussi,
        // et l'on empilerait l'entrée qu'on vient de retirer.
        e.preventDefault();
        router.back();
      }}
      data-atlas={marque}
      className="flex items-center justify-center rounded-full"
      style={{
        height: diametre,
        width: diametre,
        ...(cerne ? { border: `1px solid ${colors.line}` } : { backgroundColor: colors.rustTint }),
      }}
    >
      <svg
        width={fleche}
        height={fleche}
        viewBox="0 0 24 24"
        fill="none"
        stroke={cerne ? colors.inkSoft : colors.rust}
        strokeWidth={cerne ? "1.8" : "2.4"}
      >
        <path d="M15 5l-7 7 7 7" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </Link>
  );
}
