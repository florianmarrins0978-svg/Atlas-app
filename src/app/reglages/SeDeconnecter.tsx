"use client";

import { useState, useTransition } from "react";
import BottomSheet from "@/components/atlas/BottomSheet";
import { colors, font, surPlein } from "@/lib/design-tokens";
import { seDeconnecterAction } from "./deconnexion-actions";

/**
 * SE DÉCONNECTER — la sortie, au bas des Réglages.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * **LE DESSIN N'EST PAS NEUF : c'est celui de « Supprimer ce client »**, qu'il
 * a tranché sur maquette le 2 septembre 2026
 * (`src/app/clients/[id]/SupprimerCeClient.tsx`). Ce n'est pas de l'économie de
 * travail — c'est ce qu'il a demandé le 9 septembre devant ma première
 * proposition : *« va voir comment font les grandes applications et fais comme
 * eux, là ce que tu me proposes ne fait pas pro »*.
 *
 * **Ce qu'était cette première version, et pourquoi elle était mauvaise :** une
 * feuille à DEUX boutons — « de cet appareil » / « de tous mes appareils » —
 * posée au moment où l'on veut juste sortir. Aucune application grand public ne
 * demande ça : WhatsApp, Instagram, les Réglages d'iOS posent une ligne en bas
 * et une confirmation, et rangent la déconnexion générale dans la sécurité.
 * C'est déjà où Atlas la range — sous « Mot de passe ».
 *
 * ─── LE GESTE NE S'ANNONCE PAS, IL SE TROUVE ────────────────────────────────
 *
 * Une capsule cernée de rouge serait le seul objet dessiné de cet écran, et
 * elle appellerait l'œil vers la sortie. En capitales espacées de 9,5 px elle
 * reste parfaitement lisible et cesse d'appeler — **et la cible fait quand même
 * 44 px de haut**, invisiblement : le mot est petit, pas le bouton.
 *
 * ─── DEUX APPUIS, ET LE SECOND N'EST PAS UNE POLITESSE ──────────────────────
 *
 * Un seul toucher au fond d'un écran de réglages se déclenche par mégarde, et
 * l'on se retrouve devant la page de connexion sans comprendre pourquoi. C'est
 * le raisonnement déjà écrit dans `ConnexionClient` pour « Me déconnecter
 * partout ».
 *
 * ─── PAS DE SURTITRE D'ALERTE, CONTRAIREMENT À LA SUPPRESSION ───────────────
 *
 * Là-bas, « SUPPRESSION DÉFINITIVE » avertit d'un geste irréversible. Se
 * déconnecter se défait en cinq secondes : le même signal posé sur un geste
 * anodin s'apprend à être ignoré, et l'on perd l'avertissement là où il compte
 * vraiment (`CLAUDE.md` §4 ter).
 *
 * ─── ET RIEN SOUS LE TITRE ──────────────────────────────────────────────────
 *
 * La maquette portait « votre mot de passe — ou Face ID — vous fera revenir ».
 * Il l'a fait retirer le jour même : *« y'a pas besoin de la phrase en gris qui
 * explique »*. Comment on rentre dans Atlas n'a pas à se rappeler au moment
 * d'en sortir. Le nom du compte dit d'où l'on sort, le bouton dit ce qu'on
 * fait.
 */
export default function SeDeconnecter({ nomEntreprise }: { nomEntreprise: string | null }) {
  const [ouverte, setOuverte] = useState(false);
  const [enCours, demarrer] = useTransition();

  function partir() {
    // **Aucun `catch` ici non plus.** L'action se termine par une redirection
    // qui remonte jusqu'au routeur ; l'avaler laisserait l'écran en place avec
    // un cookie déjà effacé, donc figé.
    demarrer(async () => {
      await seDeconnecterAction();
    });
  }

  return (
    <>
      <div className="mt-10 px-[26px]">
        <button
          type="button"
          data-atlas="se-deconnecter"
          onClick={() => setOuverte(true)}
          className="inline-flex min-h-[44px] cursor-pointer items-center text-[9.5px] font-medium uppercase"
          style={{
            background: "transparent",
            color: colors.alert,
            letterSpacing: "0.28em",
            WebkitTapHighlightColor: "transparent",
          }}
        >
          Se déconnecter
        </button>
      </div>

      <BottomSheet open={ouverte} onBackdropClick={enCours ? undefined : () => setOuverte(false)}>
        {/* **Le titre nomme d'où l'on sort.** Sans nom lisible — une entreprise
            que la base ne rend pas —, on ne fabrique pas un libellé plausible
            (`docs/AGENT.md` §3) : la feuille pose alors la question elle-même,
            ce qui reste vrai dans les deux cas. */}
        <h2
          className="mt-1 text-[26px] leading-[1.15]"
          style={{ fontFamily: font.display, color: colors.ink }}
        >
          {nomEntreprise ?? "Se déconnecter ?"}
        </h2>

        <button
          type="button"
          data-atlas="confirmer-deconnexion"
          disabled={enCours}
          onClick={partir}
          className="mt-5 h-[52px] w-full rounded-full text-[15px] font-semibold"
          style={{
            background: colors.alert,
            color: surPlein,
            cursor: enCours ? "default" : "pointer",
            WebkitTapHighlightColor: "transparent",
          }}
        >
          {enCours ? "En cours…" : "Se déconnecter"}
        </button>

        {/* « Annuler » n'est pas un second bouton, c'est la sortie : deux
            capsules empilées se pèsent l'une l'autre, et la plus grave des deux
            perd de son poids — 2 septembre 2026. */}
        <button
          type="button"
          onClick={() => setOuverte(false)}
          disabled={enCours}
          className="mt-1.5 h-[46px] w-full cursor-pointer text-[14px]"
          style={{ background: "transparent", color: colors.muted }}
        >
          Annuler
        </button>
      </BottomSheet>
    </>
  );
}
