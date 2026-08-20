"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { CLE_TRANSMISSION } from "./annonce-transmission";

/**
 * Partir vers la messagerie, et revenir chez soi.
 *
 * Le patron, le 7 août 2026 : *« lorsque j'envoie le SMS et que je reviens sur
 * la page, il faut que la page se remette sur la première page automatiquement,
 * avec un petit message. »* Il revenait jusqu'ici sur l'écran qu'il avait
 * quitté, identique — rien ne disait que quelque chose s'était passé.
 *
 * Vit dans `src/lib/` parce que **deux écrans en ont besoin** : le devis et la
 * facture. Deux copies auraient fini par diverger, et c'est celle qu'on relit
 * le moins qui serait restée cassée (`CLAUDE.md` §3).
 */

/** La marque du départ — distincte de l'annonce, qui, elle, se lit à l'accueil. */
const CLE_DEPART = "atlas.transmission.depart";

/**
 * Retient qu'on part vers la messagerie, le temps d'en revenir.
 *
 * `sessionStorage` et non un paramètre d'adresse : le patron quitte
 * l'application par le multitâche du téléphone, pas par un lien. Aucune adresse
 * ne transporterait l'information — et une adresse qui la porterait
 * réafficherait le bandeau à chaque retour sur l'accueil.
 */
export function marquerDepartMessagerie(quoi: "devis" | "facture", client: string): void {
  try {
    sessionStorage.setItem(CLE_TRANSMISSION, JSON.stringify({ quoi, client }));
    sessionStorage.setItem(CLE_DEPART, "1");
  } catch {
    // Navigation privée, stockage refusé : on ouvre quand même la messagerie.
    // Le bandeau est un confort ; l'envoi est le travail.
  }
}

/*
 * ─── CE QUI A ÉTÉ ESSAYÉ, ET POURQUOI IL N'EN RESTE RIEN ─────────────────────
 *
 * Le 18 août 2026, l'appui sur « Envoyer le devis » s'est mis à ouvrir la
 * messagerie tout de suite (`ExportClient.ouvrirLaMessagerie`). L'ouverture y
 * suit la réponse du serveur, et un navigateur peut la refuser sans un mot :
 * marquer le départ à l'appui, comme on le fait sur le bouton d'à côté, ferait
 * accueillir le patron par « Devis transmis à M. Martins » alors que rien ne
 * serait parti.
 *
 * Une garde a donc été écrite pour n'armer le bandeau que si l'on partait pour
 * de bon. Elle a été **retirée après mesure**, et la mesure vaut d'être gardée :
 *
 *     navigation ordinaire dans l'application (`page.goto`)
 *       → pagehide            : oui
 *       → visibilitychange    : hidden
 *
 * C'est-à-dire **exactement la même signature** qu'un passage vers Messages.
 * Aucun des deux événements ne distingue « l'application n'est plus au premier
 * plan » de « cette page s'en va » — et sans cette distinction, toute marque
 * posée d'avance finit par annoncer un envoi qui n'a pas eu lieu.
 *
 * **On ne marque donc plus rien à l'appui.** Le bandeau reste armé par le
 * bouton de l'écran « Devis prêt », où le geste EST le départ. Ce qu'on perd :
 * au retour de Messages après une ouverture directe, le patron revient sur
 * l'écran du devis — qui lui dit déjà « Devis prêt pour … » — au lieu d'être
 * ramené à l'accueil. C'est peu, et c'est vrai.
 *
 * Ne pas rouvrir avec un délai (« si la page revient en moins de deux
 * secondes, c'était une navigation ») : ce serait deviner, et une annonce
 * devinée juste neuf fois sur dix reste une annonce fausse une fois sur dix.
 * ─────────────────────────────────────────────────────────────────────────────
 */

/**
 * Ramène à l'accueil au retour de la messagerie — une seule fois.
 *
 * **Par `visibilitychange`, et pas autrement.** iOS ne recharge pas la page
 * quand on revient de Messages : il la réveille. Aucun événement de navigation
 * ne se produit, et un `focus` seul se déclencherait aussi en changeant
 * simplement d'onglet, sans jamais être parti.
 *
 * Le garde-fou n'est pas décoratif : sans la marque de départ, tout retour sur
 * l'écran renverrait le patron à l'accueil, y compris quand il vient
 * simplement relire son devis.
 */
export function useRetourDeMessagerie(): void {
  const router = useRouter();
  useEffect(() => {
    function auRetour() {
      if (document.visibilityState !== "visible") return;
      let parti = false;
      try {
        parti = sessionStorage.getItem(CLE_DEPART) === "1";
        if (parti) sessionStorage.removeItem(CLE_DEPART);
      } catch {
        return;
      }
      if (parti) router.push("/");
    }
    document.addEventListener("visibilitychange", auRetour);
    return () => document.removeEventListener("visibilitychange", auRetour);
  }, [router]);
}
