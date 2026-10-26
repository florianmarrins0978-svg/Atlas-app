"use client";

import { useState, useTransition } from "react";
import BottomSheet from "@/components/atlas/BottomSheet";
import { colors, font, radius, surPlein } from "@/lib/design-tokens";
import { deconnexionAction } from "@/app/login/actions";

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
 *
 * ─── L'ACTION EXISTAIT DÉJÀ, ET ELLE DORMAIT ────────────────────────────────
 *
 * `deconnexionAction` vit dans `src/app/login/actions.ts` depuis longtemps,
 * **sans aucun appelant**. J'en ai écrit une seconde, identique, avant de la
 * trouver — la faute que `CLAUDE.md` §5 ter nomme : chercher qui fait déjà
 * quelque chose d'approchant AVANT d'écrire. Le doublon a été retiré. Elle
 * reste où elle est, avec ses sœurs qui ouvrent la session, et où le contrôle
 * des actions gardées porte déjà son exemption motivée.
 */
export default function SeDeconnecter({ nomEntreprise }: { nomEntreprise: string | null }) {
  const [ouverte, setOuverte] = useState(false);
  const [enCours, demarrer] = useTransition();

  function partir() {
    // **Aucun `catch` ici non plus.** L'action se termine par une redirection
    // qui remonte jusqu'au routeur ; l'avaler laisserait l'écran en place avec
    // un cookie déjà effacé, donc figé.
    demarrer(async () => {
      await deconnexionAction();
    });
  }

  return (
    <>
      {/* **En toutes lettres, sur sa plage — sa planche du 25 octobre 2026.**
          En 9,5 px de capitales espacées, le geste se cherchait ; il se lit
          désormais comme les rubriques au-dessus de lui, dans son rouge. */}
      <div className="mt-[28px] px-[26px]">
        <button
          type="button"
          data-atlas="se-deconnecter"
          onClick={() => setOuverte(true)}
          className="flex min-h-[60px] w-full cursor-pointer items-center gap-[12px] px-[18px] text-left text-[17px] font-semibold"
          style={{
            background: colors.card,
            borderRadius: radius.card,
            color: colors.alert,
            WebkitTapHighlightColor: "transparent",
          }}
        >
          <svg
            aria-hidden="true"
            focusable="false"
            width="22"
            height="22"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{ flex: "none" }}
          >
            <path d="M14.5 4.5h4v15h-4M10 8l-4 4 4 4M6 12h9.5" />
          </svg>
          Se déconnecter
        </button>
      </div>

      <FeuilleDeSortie
        ouverte={ouverte}
        // **Le titre nomme d'où l'on sort.** Sans nom lisible — une entreprise
        // que la base ne rend pas —, on ne fabrique pas un libellé plausible
        // (`docs/AGENT.md` §3) : la feuille pose alors la question elle-même,
        // ce qui reste vrai dans les deux cas.
        titre={nomEntreprise ?? "Se déconnecter ?"}
        libelle="Se déconnecter"
        dataAtlas="confirmer-deconnexion"
        enCours={enCours}
        onConfirmer={partir}
        onFermer={() => setOuverte(false)}
      />
    </>
  );
}

/**
 * LA FEUILLE D'UNE SORTIE : le nom d'où l'on sort, le bouton rouge, et
 * « Annuler » en simple mot.
 *
 * **Une seule feuille pour les deux sorties** — se déconnecter d'ici, et se
 * déconnecter partout (« Mot de passe »). Sa planche soignée du 26 octobre 2026
 * (`appli/soignee/reglages-connexion.html`) fait monter la confirmation de
 * « Me déconnecter partout » dans CETTE feuille, celle qu'il a retenue le 2 et
 * le 9 septembre : ouverte DANS l'écran, elle poussait tout vers le bas, et
 * l'écran qui ne devait plus défiler défilait. Deux feuilles écrites à la main
 * auraient divergé à la première retouche (`CLAUDE.md` §3).
 *
 * `children` porte ce que la sortie coûte, quand elle coûte quelque chose :
 * « celui-ci compris », Face ID retiré. Se déconnecter d'ici ne coûte rien, et
 * n'en dit rien.
 */
export function FeuilleDeSortie({
  ouverte,
  titre,
  libelle,
  dataAtlas,
  enCours,
  onConfirmer,
  onFermer,
  children,
}: {
  ouverte: boolean;
  titre: string;
  /** Le mot du bouton rouge : le geste lui-même, pas « Confirmer ». */
  libelle: string;
  dataAtlas?: string;
  enCours: boolean;
  onConfirmer: () => void;
  onFermer: () => void;
  children?: React.ReactNode;
}) {
  return (
    <BottomSheet open={ouverte} onBackdropClick={enCours ? undefined : onFermer}>
      <h2 className="mt-1 text-[26px] leading-[1.15]" style={{ fontFamily: font.display, color: colors.ink }}>
        {titre}
      </h2>

      {children}

      <button
        type="button"
        data-atlas={dataAtlas}
        disabled={enCours}
        onClick={onConfirmer}
        className="mt-5 h-[52px] w-full rounded-full text-[15px] font-semibold"
        style={{
          background: colors.alert,
          color: surPlein,
          cursor: enCours ? "default" : "pointer",
          WebkitTapHighlightColor: "transparent",
        }}
      >
        {enCours ? "En cours…" : libelle}
      </button>

      {/* « Annuler » n'est pas un second bouton, c'est la sortie : deux
          capsules empilées se pèsent l'une l'autre, et la plus grave des deux
          perd de son poids — 2 septembre 2026. */}
      <button
        type="button"
        onClick={onFermer}
        disabled={enCours}
        className="mt-1.5 h-[46px] w-full cursor-pointer text-[14px]"
        style={{ background: "transparent", color: colors.muted }}
      >
        Annuler
      </button>
    </BottomSheet>
  );
}
