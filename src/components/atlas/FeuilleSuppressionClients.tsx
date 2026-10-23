"use client";

import BottomSheet from "@/components/atlas/BottomSheet";
import { colors, font, surPlein } from "@/lib/design-tokens";

/**
 * LA FEUILLE QUI CONFIRME LA SUPPRESSION D'UN OU DE PLUSIEURS CLIENTS.
 *
 * **Une seule feuille pour les deux gestes — 23 octobre 2026.** Sa demande :
 * *« supprimer plusieurs clients à la fois en cochant, avec la même mention de
 * sécurité que pour un client »* (`appli/supprimer-plusieurs-clients.html`).
 * Deux copies de la prévention finiraient par diverger, et c'est la garde la
 * plus grave de l'application qui perdrait une phrase sans que personne le voie
 * (`CLAUDE.md` §3). Le bas de la fiche (`SupprimerCeClient`) et la liste
 * (`ListeClients`) la montent toutes deux ; seul le pluriel change.
 *
 * ─── LA PRÉVENTION NE PARLE QUE SI ELLE A QUELQUE CHOSE À DIRE ──────────────
 *
 * Un client tout neuf n'a rien à perdre : l'alarmer pour rien apprend à ignorer
 * l'alarme, et l'on perd le garde-fou sans s'en apercevoir (`CLAUDE.md` §4 ter).
 * La question de la sauvegarde n'apparaît donc **que** s'il y a des documents.
 */
export type PieceGardee = {
  numero: string;
  pourquoi: string;
  /** Le client qui la porte, quand la feuille en vise plusieurs. */
  nom?: string;
};

export default function FeuilleSuppressionClients({
  ouverte,
  titre,
  noms,
  documents,
  conserve,
  sauvegarde,
  basculerSauvegarde,
  refus,
  enCours,
  libelleConfirmer,
  confirmer,
  fermer,
}: {
  ouverte: boolean;
  /** Le nom du client, ou « 3 clients ». */
  titre: string;
  /** Les noms visés, quand il y en a plusieurs : on relit qui part avant d'appuyer. */
  noms: string[] | null;
  /** Combien de documents ils portent, tous ensemble. Zéro : pas de prévention. */
  documents: number;
  /** Ce que la loi oblige à garder, déjà nommé, jamais deviné ici. */
  conserve: PieceGardee[];
  sauvegarde: boolean;
  basculerSauvegarde: () => void;
  refus: string | null;
  enCours: boolean;
  libelleConfirmer: string;
  confirmer: () => void;
  fermer: () => void;
}) {
  const plusieurs = noms !== null && noms.length > 1;
  // Sans document, rien à sauvegarder : le verrou n'aurait aucun sens.
  const verrouille = documents > 0 && !sauvegarde;

  return (
    <BottomSheet open={ouverte} onBackdropClick={enCours ? undefined : fermer}>
      {/* **Ce qui va se passer se nomme avant le nom de qui le subit.** En
          capitales d'alerte : c'est la seule chose de cette feuille qui doit
          se lire avant d'avoir lu quoi que ce soit d'autre. */}
      <p
        className="mt-1 text-[9.5px] font-medium uppercase"
        style={{ color: colors.alert, letterSpacing: "0.28em" }}
      >
        Suppression définitive
      </p>
      <h2
        className="mt-[11px] text-[26px] leading-[1.15]"
        style={{ fontFamily: font.display, color: colors.ink }}
      >
        {titre}
      </h2>
      {plusieurs && (
        <p data-atlas="noms-supprimes" className="mt-2 text-[14.5px] leading-[1.55]" style={{ color: colors.ink }}>
          {noms.join(", ")}.
        </p>
      )}

      {/* **Ce que la loi cloue se dit AVANT, avec son numéro.** « Des documents
          sont conservés » est une phrase ; « la facture n° F2026-0009 est
          conservée dix ans » se retrouve dans un classeur. Ce qu'il ne peut
          pas situer, il le croit perdu.

          **Le pavé teinté est devenu deux filets — 2 septembre 2026.** Un
          aplat de couleur au milieu d'une feuille de suppression se lit comme
          un encart d'information, alors que c'est la seule bonne nouvelle de
          l'écran : ce qui est gardé. Deux cheveux et un intertitre d'or
          séparent aussi bien, sans poser d'objet. */}
      {conserve.length > 0 && (
        <div data-atlas="ce-qui-reste">
          <div className="mt-[18px] h-px w-full" style={{ background: colors.lineSoft }} />
          <p
            className="mt-[18px] text-[9.5px] font-medium uppercase"
            style={{ color: colors.or, letterSpacing: "0.28em" }}
          >
            Conservé par la loi
          </p>
          {/* **La raison s'écrit UNE fois, les numéros autant qu'il en faut.**
              Deux factures répétaient « une facture émise se conserve dix ans »
              deux fois de suite, vu à la capture, pas au code. Ce qui change
              d'une ligne à l'autre, c'est le numéro ; le reste est du bruit
              (`CLAUDE.md` §3). Sur plusieurs clients, le numéro seul ne dirait
              pas de qui c'est la facture : son nom le suit. */}
          {[...new Set(conserve.map((p) => p.pourquoi))].map((pourquoi) => (
            <p key={pourquoi} className="mt-2 text-[13.5px] leading-[1.55]" style={{ color: colors.ink }}>
              {conserve
                .filter((p) => p.pourquoi === pourquoi)
                .map((p) => (plusieurs && p.nom ? `n° ${p.numero} (${p.nom})` : `n° ${p.numero}`))
                .join(", ")}{" "}
              : {pourquoi}
            </p>
          ))}
          <div className="mt-[18px] h-px w-full" style={{ background: colors.lineSoft }} />
        </div>
      )}

      <p
        data-atlas={documents > 0 ? "prevention" : undefined}
        className="mt-[18px] text-[14.5px] leading-[1.55]"
        style={{ color: colors.inkSoft }}
      >
        {documents > 0
          ? plusieurs
            ? "Leurs devis, leurs photos et leurs notes seront détruits. C’est définitif."
            : "Ses devis, ses photos et ses notes seront détruits. C’est définitif."
          : plusieurs
            ? "Aucun n’a de document. C’est définitif."
            : "Il n’a aucun document. C’est définitif."}
      </p>

      {/* **La question de la sauvegarde, et c'est elle qui déverrouille.** Sa
          règle : *« et si le client dit oui il peut supprimer quand même »*. */}
      {documents > 0 && (
        <button
          type="button"
          data-atlas="sauvegarde-ailleurs"
          aria-pressed={sauvegarde}
          onClick={basculerSauvegarde}
          // **`rounded-full`, comme tous les boutons** : sa règle du 12 août
          // 2026, tenue par `scripts/test-boutons-arrondis.ts`, qui a attrapé
          // le rayon de 12 px que cette case portait d'abord.
          className="mt-4 flex w-full cursor-pointer items-center gap-3 rounded-full px-[18px] py-[13px] text-left"
          style={{
            background: sauvegarde ? colors.rustTint : "transparent",
            border: `1px solid ${sauvegarde ? colors.rust : colors.line}`,
            WebkitTapHighlightColor: "transparent",
          }}
        >
          <CaseCochee cochee={sauvegarde} />
          <span className="text-[14px] leading-[1.4]" style={{ color: colors.ink }}>
            J’ai sauvegardé ces documents ailleurs
          </span>
        </button>
      )}

      {refus && (
        <p data-atlas="refus" className="mt-4 text-[13.5px] leading-[1.5]" style={{ color: colors.alert }}>
          {refus}
        </p>
      )}

      <button
        type="button"
        data-atlas="confirmer-suppression"
        disabled={verrouille || enCours}
        onClick={confirmer}
        className="mt-5 h-[52px] w-full rounded-full text-[15px] font-semibold"
        style={{
          background: verrouille ? colors.line : colors.alert,
          color: verrouille ? colors.muted : surPlein,
          cursor: verrouille || enCours ? "default" : "pointer",
          WebkitTapHighlightColor: "transparent",
        }}
      >
        {enCours ? "Suppression…" : libelleConfirmer}
      </button>
      {/* **« Annuler » n'est pas un second bouton, c'est la sortie.** Deux
          capsules empilées se pèsent l'une l'autre, et la plus grave des deux
          perd de son poids. Un mot suffit (2 septembre 2026). */}
      <button
        type="button"
        onClick={fermer}
        disabled={enCours}
        className="mt-1.5 h-[46px] w-full cursor-pointer text-[14px]"
        style={{ background: "transparent", color: colors.muted }}
      >
        Annuler
      </button>
    </BottomSheet>
  );
}

/**
 * La case ronde qui se coche : la même dans la feuille et devant chaque client
 * de la liste, pour que cocher se lise partout de la même façon.
 */
export function CaseCochee({ cochee }: { cochee: boolean }) {
  return (
    <span
      aria-hidden="true"
      className="flex h-[22px] w-[22px] flex-shrink-0 items-center justify-center rounded-full"
      style={{
        background: cochee ? colors.rust : "transparent",
        border: `1px solid ${cochee ? colors.rust : colors.line}`,
      }}
    >
      {cochee && (
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={surPlein} strokeWidth="3">
          <path d="M4 12l6 6L20 6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}
    </span>
  );
}
