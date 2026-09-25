"use client";

import { useEffect } from "react";
import { bordLaisseAuNavigateur, faitReculer, lectureDuDoigt } from "@/lib/geste-retour";

/**
 * GLISSER VERS LA DROITE, DE N'IMPORTE OÙ, POUR REVENIR — sa « B » du
 * 25 septembre 2026 (`appli/glisser-pour-revenir.html`).
 *
 * ───────────────────────────────────────────────────────────────────────────
 * **LE GESTE APPUIE SUR LA FLÈCHE, IL NE DÉCIDE RIEN.** Chaque écran qui a une
 * flèche de retour la marque `data-geste-retour` ; au bout du geste, on
 * l'appuie. La destination reste donc la sienne, au pixel près : le journal de
 * l'onglet et son repli (`FlecheRetour`), l'enregistrement avant de sortir
 * (la fiche client), la feuille qu'on referme (le nouveau chantier). Un geste
 * qui calculerait son propre retour referait la boucle du 7 septembre 2026
 * (`retour-du-devis.ts`) par un autre chemin.
 *
 * Et d'où la règle qu'il a posée : **pas de flèche, pas de geste.** Les cinq
 * onglets du bas n'en ont pas, et ne reculent pas.
 *
 * **CE QUI GLISSE DÉJÀ DE CÔTÉ GARDE SON GESTE.** Il a retenu « de partout » en
 * sachant qu'il faudrait le refuser là. On ne tient pas de liste d'écrans, qui
 * oublierait le prochain : on lit ce que la page déclare elle-même.
 *
 *   - le champ où l'on tape, une zone de signature (`canvas`), un curseur ;
 *   - un bloc qui prend le doigt à son compte (`touch-action` posé) : le mois
 *     du planning, la signature de la fiche de sécurité ;
 *   - un bloc qui défile de côté et peut encore revenir vers la droite : une
 *     ligne dont « Retirer » est découvert (`LigneRetirable`), la frise des
 *     périodes de TVA déroulée ;
 *   - tout ce qui flotte au-dessus de la page (`position: fixed`), et tout ce
 *     qui n'est pas dans la page : feuilles, photo en grand, panneau de
 *     l'assistant.
 *
 * **LA PAGE SUIT LE DOIGT, ELLE NE PART PAS.** Lâchée, elle revient à sa place
 * pendant que la flèche fait son travail. La garder poussée jusqu'à l'arrivée
 * de l'écran suivant demanderait de savoir QUAND il arrive, et la flèche ne
 * change pas toujours d'adresse (la feuille du nouveau chantier se referme sur
 * place) : une page restée de travers serait pire qu'un retour sans glissade.
 * Contrairement à la planche, on ne voit pas la page d'avant dessous : elle
 * n'est plus dessinée.
 * ───────────────────────────────────────────────────────────────────────────
 */
export default function GesteRetour() {
  useEffect(() => {
    let suivi: {
      page: HTMLElement;
      fleche: HTMLElement;
      x: number;
      y: number;
      etat: "attendre" | "suivre";
      dx: number;
      dernierX: number;
      dernierT: number;
      elan: number;
    } | null = null;

    const sansMouvement = window.matchMedia("(prefers-reduced-motion: reduce)");
    const dansUnOnglet = () => window.matchMedia("(display-mode: browser)").matches;

    function poser(page: HTMLElement, dx: number, anime: boolean) {
      if (sansMouvement.matches) return;
      page.style.transition = anime ? "transform 200ms cubic-bezier(.2,.8,.2,1)" : "none";
      page.style.transform = dx ? `translate3d(${dx}px,0,0)` : "";
    }

    function relacher(page: HTMLElement) {
      poser(page, 0, true);
      page.addEventListener("transitionend", () => (page.style.transition = ""), { once: true });
    }

    function debut(e: TouchEvent) {
      suivi = null;
      if (e.touches.length !== 1) return;
      const doigt = e.touches[0];
      if (bordLaisseAuNavigateur(doigt.clientX, dansUnOnglet())) return;
      const fleche = flecheDeLaPage();
      const page = fleche?.closest("main");
      if (!fleche || !page || !(e.target instanceof Element)) return;
      if (!page.contains(e.target) || prendSonPropreGeste(e.target, page)) return;
      suivi = {
        page,
        fleche,
        x: doigt.clientX,
        y: doigt.clientY,
        etat: "attendre",
        dx: 0,
        dernierX: doigt.clientX,
        dernierT: e.timeStamp,
        elan: 0,
      };
    }

    function mouvement(e: TouchEvent) {
      if (!suivi) return;
      const doigt = e.touches[0];
      if (!doigt) return;
      const dx = doigt.clientX - suivi.x;
      if (suivi.etat === "attendre") {
        const lu = lectureDuDoigt(dx, doigt.clientY - suivi.y);
        if (lu === "laisser") {
          suivi = null;
          return;
        }
        if (lu === "attendre") return;
        suivi.etat = "suivre";
      }
      // **Reconnu, le geste est à nous seuls.** Sans cela le navigateur le
      // traite AUSSI : Chrome recule de son côté sur un glissement de côté, et
      // l'on reculait de deux pages (mesuré le 25 septembre 2026, la flèche
      // menait à /reglages et l'on arrivait à l'accueil). Et la page ne défile
      // plus sous le doigt pendant qu'elle le suit.
      if (e.cancelable) e.preventDefault();
      suivi.dx = Math.max(0, dx);
      const duree = Math.max(1, e.timeStamp - suivi.dernierT);
      suivi.elan = (doigt.clientX - suivi.dernierX) / duree;
      suivi.dernierX = doigt.clientX;
      suivi.dernierT = e.timeStamp;
      poser(suivi.page, suivi.dx, false);
    }

    function fin() {
      if (!suivi) return;
      const { page, fleche, etat, dx, elan } = suivi;
      suivi = null;
      if (etat !== "suivre") return;
      relacher(page);
      if (faitReculer(dx, elan, page.clientWidth)) fleche.click();
    }

    function annule() {
      if (suivi?.etat === "suivre") relacher(suivi.page);
      suivi = null;
    }

    document.addEventListener("touchstart", debut, { passive: true });
    document.addEventListener("touchmove", mouvement, { passive: false });
    document.addEventListener("touchend", fin);
    document.addEventListener("touchcancel", annule);
    return () => {
      document.removeEventListener("touchstart", debut);
      document.removeEventListener("touchmove", mouvement);
      document.removeEventListener("touchend", fin);
      document.removeEventListener("touchcancel", annule);
    };
  }, []);

  return null;
}

/** La flèche de l'écran affiché : la première marquée qui se voit. */
function flecheDeLaPage(): HTMLElement | null {
  for (const el of document.querySelectorAll<HTMLElement>("main [data-geste-retour]")) {
    if (el.getClientRects().length > 0) return el;
  }
  return null;
}

/** Ce que le doigt touche garde-t-il le glissement de côté pour lui ? */
function prendSonPropreGeste(cible: Element, page: Element): boolean {
  for (let el: Element | null = cible; el && el !== page; el = el.parentElement) {
    if (el.matches("canvas, input[type=range]")) return true;
    // **Un champ ne garde le doigt que s'il est EN COURS DE FRAPPE** : le doigt
    // y déplace alors le curseur. Au repos, glisser dessus ne l'édite pas, et
    // l'écran des prix n'est fait que de champs : les refuser tous rendait le
    // geste mort là où il sert le plus (mesuré le 25 septembre 2026).
    if (el === document.activeElement && el.matches("input, textarea, select, [contenteditable]")) return true;
    const style = getComputedStyle(el);
    if (style.position === "fixed") return true;
    if (style.touchAction !== "auto" && style.touchAction !== "manipulation") return true;
    // **Seulement s'il peut encore revenir vers la droite.** Une ligne à
    // retirer, fermée, ne défile que vers la gauche : glisser vers la droite
    // dessus ne lui prend rien, et la refuser rendrait le geste mort sur un
    // écran qui n'est fait que de ces lignes.
    const defileDeCote = style.overflowX === "auto" || style.overflowX === "scroll";
    if (defileDeCote && el.scrollLeft > 0) return true;
  }
  return false;
}
