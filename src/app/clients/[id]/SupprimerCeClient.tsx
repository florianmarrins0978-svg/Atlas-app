"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import BottomSheet from "@/components/atlas/BottomSheet";
import { colors, font, surPlein, voile } from "@/lib/design-tokens";
import { supprimerClientAction } from "./actions";

/**
 * SUPPRIMER UN CLIENT — sa proposition C, tranchée le 27 août 2026.
 *
 * *« Je pense la C ; lorsqu'un client a des documents il faut mettre la phrase
 * de prévention, et une phrase disant également avez-vous sauvegardé ses
 * documents autre part — et si le client dit oui il peut supprimer quand
 * même. »*
 *
 * ─── LE GESTE EST EN BAS DE LA FICHE, ET C'EST DÉLIBÉRÉ ─────────────────────
 *
 * La planche proposait deux places : ici, ou en glissant la ligne dans la liste.
 * Il n'a pas tranché celle-là. Le bas de la fiche est retenu parce que c'est le
 * choix qu'on peut défaire : un geste qu'on trouve **en le cherchant** ne se
 * déclenche pas au pouce en faisant défiler une liste. L'autre reste ouvert.
 *
 * ─── LA PRÉVENTION NE PARLE QUE SI ELLE A QUELQUE CHOSE À DIRE ──────────────
 *
 * Un client tout neuf n'a rien à perdre : l'alarmer pour rien apprend à ignorer
 * l'alarme, et l'on perd le garde-fou sans s'en apercevoir (`CLAUDE.md` §4 ter).
 * La question de la sauvegarde n'apparaît donc **que** s'il y a des documents.
 */
export default function SupprimerCeClient({
  clientId,
  nom,
  documents,
  conserve,
}: {
  clientId: string;
  nom: string;
  /** Combien de documents ce client porte. Zéro : pas de prévention. */
  documents: number;
  /** Ce que la loi oblige à garder, déjà nommé — jamais deviné ici. */
  conserve: { numero: string; pourquoi: string }[];
}) {
  const router = useRouter();
  const [ouverte, setOuverte] = useState(false);
  const [sauvegarde, setSauvegarde] = useState(false);
  const [refus, setRefus] = useState<string | null>(null);
  const [enCours, demarrer] = useTransition();

  // Sans document, rien à sauvegarder : le verrou n'aurait aucun sens.
  const verrouille = documents > 0 && !sauvegarde;

  function fermer() {
    setOuverte(false);
    setSauvegarde(false);
    setRefus(null);
  }

  function supprimer() {
    setRefus(null);
    demarrer(async () => {
      const issue = await supprimerClientAction(clientId);
      if (!issue.ok) {
        setRefus(issue.message);
        return;
      }
      // La fiche n'existe plus : y rester montrerait un écran vide.
      router.replace("/clients");
      router.refresh();
    });
  }

  return (
    <>
      <div className="mt-10 px-[26px]">
        <button
          type="button"
          data-atlas="supprimer-client"
          onClick={() => setOuverte(true)}
          className="h-12 w-full cursor-pointer rounded-full text-[14px] font-semibold"
          style={{
            background: "transparent",
            border: `1px solid ${voile(colors.alert, 0.45)}`,
            color: colors.alert,
            WebkitTapHighlightColor: "transparent",
          }}
        >
          Supprimer ce client
        </button>
      </div>

      <BottomSheet open={ouverte} onBackdropClick={enCours ? undefined : fermer}>
        <h2
          className="mt-2 text-[24px] leading-[1.2]"
          style={{ fontFamily: font.display, color: colors.ink }}
        >
          {nom}
        </h2>

        {/* **Ce que la loi cloue se dit AVANT, avec son numéro.** « Des documents
            sont conservés » est une phrase ; « la facture n° F2026-0009 est
            conservée dix ans » se retrouve dans un classeur. Ce qu'il ne peut
            pas situer, il le croit perdu. */}
        {conserve.length > 0 && (
          <div
            data-atlas="ce-qui-reste"
            className="mt-4 rounded-[12px] px-[15px] py-[13px]"
            style={{ background: colors.rustTint }}
          >
            {/* **La raison s'écrit UNE fois, les numéros autant qu'il en faut.**
                Deux factures répétaient « une facture émise se conserve dix ans »
                deux fois de suite — vu à la capture, pas au code. Ce qui change
                d'une ligne à l'autre, c'est le numéro ; le reste est du bruit
                (`CLAUDE.md` §3). */}
            {[...new Set(conserve.map((p) => p.pourquoi))].map((pourquoi) => (
              <p key={pourquoi} className="text-[13.5px] leading-[1.5]" style={{ color: colors.ink }}>
                {conserve
                  .filter((p) => p.pourquoi === pourquoi)
                  .map((p) => `n° ${p.numero}`)
                  .join(", ")}{" "}
                — {pourquoi}
              </p>
            ))}
          </div>
        )}

        {documents > 0 ? (
          <p
            data-atlas="prevention"
            className="mt-4 text-[14px] leading-[1.5]"
            style={{ color: colors.inkSoft }}
          >
            Ses devis, ses photos et ses notes seront détruits. C’est définitif.
          </p>
        ) : (
          <p className="mt-4 text-[14px] leading-[1.5]" style={{ color: colors.inkSoft }}>
            Il n’a aucun document. C’est définitif.
          </p>
        )}

        {/* **La question de la sauvegarde, et c'est elle qui déverrouille.** Sa
            règle : *« et si le client dit oui il peut supprimer quand même »*. */}
        {documents > 0 && (
          <button
            type="button"
            data-atlas="sauvegarde-ailleurs"
            aria-pressed={sauvegarde}
            onClick={() => setSauvegarde((v) => !v)}
            // **`rounded-full`, comme tous les boutons** — sa règle du 12 août
            // 2026, tenue par `scripts/test-boutons-arrondis.ts`, qui a attrapé
            // le rayon de 12 px que cette case portait d'abord.
            className="mt-4 flex w-full cursor-pointer items-center gap-3 rounded-full px-[18px] py-[13px] text-left"
            style={{
              background: sauvegarde ? colors.rustTint : "transparent",
              border: `1px solid ${sauvegarde ? colors.rust : colors.line}`,
              WebkitTapHighlightColor: "transparent",
            }}
          >
            <span
              className="flex h-[22px] w-[22px] flex-shrink-0 items-center justify-center rounded-full"
              style={{
                background: sauvegarde ? colors.rust : "transparent",
                border: `1px solid ${sauvegarde ? colors.rust : colors.line}`,
              }}
            >
              {sauvegarde && (
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={surPlein} strokeWidth="3">
                  <path d="M4 12l6 6L20 6" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              )}
            </span>
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
          onClick={supprimer}
          className="mt-5 h-[52px] w-full rounded-full text-[15px] font-semibold"
          style={{
            background: verrouille ? colors.line : colors.alert,
            color: verrouille ? colors.muted : surPlein,
            cursor: verrouille || enCours ? "default" : "pointer",
            WebkitTapHighlightColor: "transparent",
          }}
        >
          {enCours ? "Suppression…" : "Supprimer"}
        </button>
        <button
          type="button"
          onClick={fermer}
          disabled={enCours}
          className="mt-2.5 h-[52px] w-full cursor-pointer rounded-full text-[15px]"
          style={{ background: "transparent", border: `1px solid ${colors.line}`, color: colors.ink }}
        >
          Annuler
        </button>
      </BottomSheet>
    </>
  );
}
