"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";

/**
 * La flèche de retour des écrans — et pourquoi elle RECULE au lieu d'avancer.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * **Sa remarque du 9 septembre 2026 :** *« Si je clique sur un client tout en
 * bas de la liste, je fais retour, il me remet en haut de la liste. Je veux
 * rester où j'étais ! »*
 *
 * **Le défaut n'était pas dans la liste des clients : il était dans la
 * flèche.** Elle était un `<Link>`, c'est-à-dire une navigation en AVANT vers
 * l'adresse de l'écran précédent. Next.js a raison de poser une page neuve en
 * haut — c'est ce qu'on attend d'un lien. Mais son geste, lui, est un RETOUR :
 * l'application faisait donc l'inverse de ce qu'il demandait, et par-dessus le
 * marché elle empilait une entrée d'historique de plus à chaque aller-retour.
 *
 * **Mesuré avant de corriger** (`CLAUDE.md` §5, `AGENTS.md`), sur la version
 * bâtie, liste de 47 clients descendue jusqu'au bout :
 *
 * | Le geste | Où l'on retombe |
 * |---|---|
 * | la flèche de l'écran | **0 px** — tout en haut |
 * | le retour du navigateur | **2 941 px** — exactement où il était |
 *
 * Le navigateur savait donc déjà le faire. Rien n'était à inventer : il fallait
 * cesser de l'en empêcher. C'est ce qui rend ce correctif conforme au §4 quater
 * — il RETIRE la navigation en trop plutôt que d'ajouter une mémoire de
 * défilement par-dessus, laquelle aurait fait une seconde vérité à côté de
 * celle du navigateur (`CLAUDE.md` §3).
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * **CE QUE LA FLÈCHE NE DÉCIDE PAS : où elle mène.** Cela reste le travail des
 * règles de provenance — `retourFicheClient`, `retourDepuisLePlanning`,
 * `retourDuDevis` (`ARCHITECTURE.md` §296). Elle reçoit une adresse déjà
 * choisie et ne fait que la parcourir dans le bon sens.
 *
 * **Et elle ne recule QUE si l'écran d'avant est bien celui-là.** Reculer à
 * l'aveugle ferait sortir de l'application celui qui a ouvert la fiche depuis
 * un signet ou l'a rechargée — un bouton qui ne fait rien, ou pire, qui rend la
 * main au site précédent. On ne recule donc que sur preuve, et l'absence de
 * preuve retombe sur l'ancien comportement, qui n'a jamais rien cassé.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * **CE QUE CE CHOIX COÛTE, ET IL FAUT LE SAVOIR : un retour sert l'écran depuis
 * la réserve de Next.js.** Mesuré le 9 septembre 2026 — une donnée changée en
 * base pendant qu'on était sur la fiche n'apparaît pas au retour.
 *
 * **Ce n'est PAS ce correctif qui l'apporte** : le même contrôle a été joué sur
 * le geste de retour du navigateur, celui qu'il emploie déjà sur son téléphone,
 * et il est stale de la même façon — c'est le comportement de la plateforme, et
 * l'application le porte depuis toujours.
 *
 * **Ce qui l'annule en pratique, et qui existe déjà :** `revalidatePath`, appelé
 * par soixante-seize actions serveur de ce dépôt. Une modification faite DANS
 * l'application vide la réserve du chemin concerné ; c'est le chemin réel du
 * patron. Le cas mesuré — écrire en base par-dessus l'application — n'arrive
 * dans aucun de ses gestes.
 *
 * **Un rafraîchissement systématique sur `popstate` a été écrit, essayé, puis
 * RETIRÉ** : il redonnait les données fraîches, mais il repartait à zéro le
 * défilement, c'est-à-dire précisément ce qu'on venait de rendre. Le faire
 * tenir demandait un `setTimeout` calé sur la restauration du navigateur — un
 * pansement au sens exact du §4 quater, qui serait revenu sur un téléphone plus
 * lent. `TODO.md` porte le point ouvert et sa mesure.
 */

/**
 * La clé posée dans l'état d'historique de chaque entrée : l'adresse d'où l'on
 * venait au moment où elle a été créée.
 *
 * **Dans l'HISTORIQUE, et non dans une variable de module.** Une variable ne
 * survivrait pas au rechargement, et surtout elle ne saurait rien dire des
 * entrées qu'on retraverse : reculer de trois écrans puis avancer de deux la
 * rendrait fausse sans que rien ne le signale.
 */
const VENANT_DE = "atlasVenantDe";

type EtatMarque = { [VENANT_DE]?: string | null };

/** L'adresse quittée par la dernière navigation de CE document. */
let precedente: string | null = null;

/** L'adresse courante, telle qu'on la compare : chemin et paramètres. */
function adresseCourante(): string {
  return window.location.pathname + window.location.search;
}

/**
 * Marque chaque entrée d'historique de l'adresse d'où elle a été ouverte.
 *
 * Monté une seule fois, dans la mise en page racine : elle n'est pas rejouée
 * d'une navigation à l'autre, si bien que ce composant reste en place et voit
 * passer tous les écrans — y compris ceux qui ne portent aucune flèche, et
 * c'est justement d'eux qu'on vient parfois (l'accueil, par exemple).
 */
export function MemoireDuChemin() {
  const chemin = usePathname();

  useEffect(() => {
    const etat: unknown = window.history.state;
    // Sans état, l'entrée n'a pas été posée par Next : on ne la marque pas, et
    // la flèche retombera sur la navigation ordinaire.
    if (etat && typeof etat === "object") {
      const marque = etat as EtatMarque;
      // Déjà marquée : c'est une entrée qu'on RETRAVERSE (recul ou avance).
      // La réécrire lui ferait dire d'où l'on vient MAINTENANT, alors qu'elle
      // doit dire d'où elle a été ouverte la première fois.
      if (!(VENANT_DE in marque)) {
        window.history.replaceState({ ...marque, [VENANT_DE]: precedente }, "");
      }
    }
    precedente = adresseCourante();
    // `usePathname` suffit : deux adresses qui ne diffèrent que par leurs
    // paramètres laissent l'entrée neuve sans marque, donc la flèche avance —
    // le repli sûr, jamais un recul hasardeux.
  }, [chemin]);

  return null;
}

/** L'écran d'avant est-il exactement celui que la flèche vise ? */
function laPageDAvantEst(href: string): boolean {
  const etat: unknown = window.history.state;
  if (!etat || typeof etat !== "object") return false;
  return (etat as EtatMarque)[VENANT_DE] === href;
}

export default function FlecheRetour({
  href,
  libelle,
  className,
  style,
  children,
}: {
  href: string;
  libelle: string;
  className?: string;
  style?: React.CSSProperties;
  children: React.ReactNode;
}) {
  const router = useRouter();

  return (
    <Link
      href={href}
      aria-label={libelle}
      className={className}
      style={style}
      onClick={(e) => {
        // Un appui avec une touche de commande ouvre ailleurs : c'est le geste
        // du navigateur, pas le nôtre. On n'y touche pas.
        if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
        if (!laPageDAvantEst(href)) return;
        // `preventDefault` avant `back()` : sans lui, le lien naviguerait AUSSI,
        // et l'on empilerait l'entrée qu'on vient de retirer.
        e.preventDefault();
        router.back();
      }}
    >
      {children}
    </Link>
  );
}
