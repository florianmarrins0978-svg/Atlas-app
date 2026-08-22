"use client";

import { useEffect, useState } from "react";
import { colors, smallCaps } from "@/lib/design-tokens";
import PrimaryButton from "@/components/atlas/PrimaryButton";
import { peutRechargerSeul, repriseApresErreur, type Reprise } from "@/lib/reprise-erreur";

// Le corps commun des neuf écrans d'erreur : la carte, la cause en développement,
// la référence, et le bouton qui **sort vraiment de la panne**.
//
// Il existe pour deux raisons, et la seconde est la plus importante :
//
// 1. **Dix copies du même corps** vivaient dans dix `error.tsx`. Le jour où l'un
//    d'eux a appris à se relever d'un morceau manquant, les neuf autres ne
//    l'auraient pas su — c'est exactement la duplication que `CLAUDE.md` §3
//    interdit.
// 2. **La cause n'était affichée que sur l'écran racine.** Les neuf autres la
//    taisaient, alors que le patron diagnostique depuis un téléphone, sans
//    terminal sous les yeux : c'est là, et là seulement, qu'il peut lire ce que
//    le serveur a écrit. Le raisonnement était déjà posé dans `src/app/error.tsx`
//    — il ne s'appliquait qu'à un dixième de l'application.
//
// En production, la cause reste tue : un message d'erreur serveur peut
// divulguer la structure de la base.

const EN_DEVELOPPEMENT = process.env.NODE_ENV !== "production";

/** Où l'on note qu'on vient de recharger. Voir `peutRechargerSeul`. */
const CLE_RECHARGEMENT = "atlas:rechargement-morceau";

/**
 * `sessionStorage` et non `localStorage` : la mémoire meurt avec l'onglet. Un
 * onglet neuf a droit à son rechargement automatique, ce qui est bien ce qu'on
 * veut — et rien ne traîne sur le téléphone du patron.
 *
 * Enveloppé : Safari en navigation privée **lève** à la simple lecture. Sans ce
 * filet, l'écran d'erreur planterait à son tour, et il n'y a plus d'écran
 * d'erreur derrière un écran d'erreur.
 */
function dernierRechargement(): number | null {
  try {
    const brut = window.sessionStorage.getItem(CLE_RECHARGEMENT);
    if (!brut) return null;
    const n = Number(brut);
    return Number.isFinite(n) ? n : null;
  } catch {
    // Sans mémoire, on ne peut plus garantir « une fois par fenêtre ». On refuse
    // donc le rechargement automatique : mieux vaut un bouton à toucher qu'une
    // page qui tourne en rond sans jamais rien afficher.
    return Number.POSITIVE_INFINITY;
  }
}

function noterRechargement() {
  try {
    window.sessionStorage.setItem(CLE_RECHARGEMENT, String(Date.now()));
  } catch {
    // Voir ci-dessus : l'absence de mémoire se traduit par un refus, pas par
    // une panne.
  }
}

export default function CorpsErreur({
  erreur,
  reset,
  phrase,
  aire = 24,
}: {
  erreur: Error & { digest?: string };
  reset: () => void;
  /** Ce que CET écran dit de sa panne, quand la cause lui appartient vraiment. */
  phrase: string;
  /** Marge haute et basse de la carte, en pixels. L'écran racine respire un peu plus. */
  aire?: number;
}) {
  // **La décision est prise une fois, au rendu, et ne bouge plus.**
  //
  // Elle lit `sessionStorage`, qui n'existe pas côté serveur — d'où le repli.
  // Ce repli ne peut PAS produire d'écart d'hydratation, et la raison mérite
  // d'être écrite : un morceau de code manquant est une panne du navigateur,
  // jamais du rendu serveur. Quand cet écran est rendu sur le serveur, la cause
  // est forcément autre, `estMorceauIntrouvable` répond non, et la valeur de ce
  // repli ne change alors strictement rien à ce qui est affiché.
  const [reprise] = useState<Reprise>(() =>
    repriseApresErreur(erreur, {
      phraseDeLEcran: phrase,
      rechargementPossible:
        typeof window === "undefined" ? false : peutRechargerSeul(dernierRechargement(), Date.now()),
    })
  );

  useEffect(() => {
    if (!reprise.automatique) return;
    // Noter AVANT de recharger : la page suivante doit trouver la trace, sinon
    // la garde ne garde rien et l'on obtient la boucle qu'elle interdit.
    noterRechargement();
    window.location.reload();
  }, [reprise]);

  const agir = () => {
    if (reprise.rechargement) {
      noterRechargement();
      window.location.reload();
      return;
    }
    reset();
  };

  return (
    <>
      <div
        className="rounded-[4px] px-5 text-center"
        style={{ backgroundColor: colors.card, paddingTop: aire, paddingBottom: aire }}
      >
        <p className="text-[14px]" style={{ color: colors.muted }}>
          {reprise.phrase}
        </p>
      </div>

      {EN_DEVELOPPEMENT && erreur?.message ? (
        <div
          className="mt-4 overflow-x-auto rounded-[4px] px-5 py-4 text-left"
          style={{ backgroundColor: colors.card }}
        >
          <p className={smallCaps} style={{ color: colors.rust, marginBottom: 8 }}>
            Cause
          </p>
          <pre
            className="whitespace-pre-wrap break-words text-[12px] leading-snug"
            style={{ color: colors.ink, fontFamily: "ui-monospace, monospace" }}
          >
            {erreur.message}
          </pre>
        </div>
      ) : null}

      {erreur?.digest ? (
        <p className="mt-3 text-center text-[11px]" style={{ color: colors.muted }}>
          Référence : {erreur.digest}
        </p>
      ) : null}

      {/*
        La réserve du bas n'est pas de l'espacement : la bulle de l'assistant est
        `fixed` en bas à droite, et sur un écran de téléphone elle **mordait sur
        le bouton** dès que le message dépassait deux lignes — ce qui est le cas
        du message de morceau manquant, et de toute cause affichée en
        développement. Mesuré en capture, pas supposé. Sans elle, la page ne
        défile pas et le bouton reste sous la bulle, sans recours.
      */}
      <div className="mt-4 pb-40">
        <PrimaryButton onClick={agir}>{reprise.bouton}</PrimaryButton>
      </div>
    </>
  );
}
