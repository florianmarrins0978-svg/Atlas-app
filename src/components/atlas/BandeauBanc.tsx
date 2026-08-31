"use client";

import { useEffect, useRef, useState } from "react";
import type { EtatConstructionBanc } from "@/server/etat-banc";
import { colors, voile } from "@/lib/design-tokens";

/**
 * « Version rapide en construction » — la phrase qui manquait au patron.
 *
 * *Son signalement du 14 août 2026 : « La connexion est au ralenti sur l'appli.
 * Les nouvelles pages ne chargent mal ou pas du tout. » Puis : « Surtout la
 * page équipe. »* Retenu sur maquette (`docs/maquettes/46`, proposition A).
 *
 * **Ce qu'il voyait, et pourquoi il ne pouvait pas comprendre.** Le banc sert
 * en mode développement pendant qu'il bâtit la version rapide : chaque écran se
 * compile au moment où on l'ouvre, et le relais de GitHub abandonne au bout
 * d'une minute. Un écran déjà ouvert répond ; un écran ouvert pour la première
 * fois peut ne jamais arriver. Rien, à l'écran, ne distinguait cet état d'une
 * panne. Le pourquoi complet vit dans `src/server/etat-banc.ts`.
 *
 * **Trois choses que ce bandeau ne doit pas faire**, et qui sont déjà payées :
 *
 *   1. **ne rien recouvrir.** Il est DANS le flux, pas par-dessus : une pile de
 *      notifications a déjà poussé le contenu hors de l'écran, et « ou rédiger
 *      le devis à la main » est passé sous la bulle de l'assistant le 11 août
 *      (`scripts/test-rien-de-recouvert-e2e.ts`) ;
 *   2. **ne jamais paraître ailleurs que sur son banc.** L'écran ne décide de
 *      rien : le serveur rend `null` hors banc, et le bandeau ne s'affiche pas ;
 *   3. **s'effacer tout seul.** Un bandeau qu'il faut fermer à la main est un
 *      bandeau qui reste, et qu'on apprend à ne plus lire.
 *
 * **Pourquoi il interroge le serveur au lieu d'être rendu une fois.** La
 * disposition n'est pas refaite à chaque navigation : un bandeau rendu au
 * serveur garderait son premier compte jusqu'au rechargement, et annoncerait
 * « 3 sur 19 » une fois les dix-neuf prêts. Cinq secondes entre deux appels, sur
 * une adresse qui répond en quelques millisecondes — et **il cesse de demander
 * dès qu'il n'y a plus rien à dire**.
 */

const INTERVALLE_MS = 5000;

export default function BandeauBanc() {
  const [etat, setEtat] = useState<EtatConstructionBanc | null>(null);
  const [fini, setFini] = useState(false);
  const cadre = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (fini) return;
    let vivant = true;

    async function demander() {
      try {
        const r = await fetch("/api/health/banc/etat", { cache: "no-store" });
        if (!vivant) return;
        const lu = (await r.json()) as EtatConstructionBanc | null;
        if (!vivant) return;
        if (lu === null) {
          // Plus rien à dire : on s'efface, et on arrête de demander.
          setEtat(null);
          setFini(true);
          return;
        }
        setEtat(lu);
      } catch {
        // Le serveur bascule justement vers la version rapide : il ne répond
        // pas pendant quelques secondes. Ce n'est pas un motif d'alarme — on
        // garde ce qu'on affichait et on redemandera.
      }
    }

    void demander();
    const minuteur = setInterval(demander, INTERVALLE_MS);
    return () => {
      vivant = false;
      clearInterval(minuteur);
    };
  }, [fini]);

  /**
   * **IL PUBLIE SA PROPRE HAUTEUR, ET C'EST UNE RÉPARATION.**
   *
   * *Sa capture du 31 août 2026 : « la page connexion n'est pas fixe, elle peut
   * bouger encore ».* Sur son banc, « Me déconnecter partout » finissait à
   * moitié sous la barre du bas, et l'écran défilait de 42 px.
   *
   * La cause n'était pas l'écran de connexion : `layout.tsx` retranchait
   * **40 px** en dur pour ce bandeau, qui en mesure **48** — et jusqu'à
   * davantage, puisqu'il gagne une barre de progression dès qu'un total existe
   * et que sa phrase passe à deux lignes sur un écran étroit. Un nombre écrit
   * à la main pour un élément qui change de taille est faux la moitié du temps.
   *
   * **Il ne se mesure pas une fois** : il apparaît, grandit, puis DISPARAÎT
   * quand la construction s'achève. Une valeur posée au premier rendu
   * survivrait à sa disparition et volerait 48 px à tous les écrans pour
   * toujours — c'est la « valeur provisoire qui survit » d'`ARCHITECTURE.md`.
   * D'où l'observateur, et la remise à zéro au démontage.
   */
  useEffect(() => {
    const racine = document.documentElement;
    const remettre = () => racine.style.setProperty("--atlas-bandeau", "0px");
    const noeud = cadre.current;
    if (!noeud) {
      remettre();
      return;
    }
    const publier = () =>
      racine.style.setProperty("--atlas-bandeau", `${Math.round(noeud.getBoundingClientRect().height)}px`);
    publier();
    const oeil = new ResizeObserver(publier);
    oeil.observe(noeud);
    return () => {
      oeil.disconnect();
      remettre();
    };
  }, [etat]);

  if (etat === null) return null;

  // Le total vaut zéro tant que le préchauffage n'a pas écrit sa première
  // ligne. On ne fabrique alors aucun chiffre — dire « 0 sur 0 » serait
  // inventer un total (`CLAUDE.md` §4).
  const avecCompte = etat.total > 0;
  const part = avecCompte ? Math.round((etat.faits / etat.total) * 100) : null;

  return (
    <div
      // `data-atlas` sert au contrôle de recouvrement à nommer le coupable
      // quand quelque chose passe dessous.
      ref={cadre}
      data-atlas="bandeau-banc"
      role="status"
      aria-live="polite"
      className="px-6 py-2.5"
      style={{
        backgroundColor: voile(colors.or, 0.13),
        borderBottom: `1px solid ${voile(colors.or, 0.3)}`,
      }}
    >
      <p className="text-[12.5px] leading-[1.4]" style={{ color: colors.or }}>
        Version rapide en construction
        {avecCompte ? (
          <>
            {" — "}
            <b style={{ color: colors.ink, fontWeight: 500 }}>
              {etat.faits} écran{etat.faits > 1 ? "s" : ""} sur {etat.total}
            </b>{" "}
            déjà prêts.
          </>
        ) : (
          <> — un écran jamais ouvert peut tarder.</>
        )}
      </p>
      {part !== null && (
        <div
          className="mt-[7px] h-[3px] overflow-hidden rounded-full"
          style={{ backgroundColor: voile(colors.or, 0.25) }}
        >
          <div
            className="h-full"
            style={{ width: `${part}%`, backgroundColor: colors.or, transition: "width .4s" }}
          />
        </div>
      )}
    </div>
  );
}
