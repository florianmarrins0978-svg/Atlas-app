"use client";

import { useState } from "react";
import Link from "next/link";
import { colors, surPlein } from "@/lib/design-tokens";
import { SERIF } from "@/components/atlas/PorteDeNuit";
import DemanderPreuve from "@/components/atlas/DemanderPreuve";
import { useActiverFaceId } from "@/app/reglages/connexion/useActiverFaceId";
import type { LigneRecap } from "@/lib/recapitulatif-compte";

/**
 * Face ID, puis Tout est prêt — les deux derniers écrans de la porte.
 *
 * **Face ID ne se montre que si le téléphone sait le faire**, et pas à qui l'a
 * déjà : un bouton qui ne peut pas aboutir est un piège. Le mot de passe reste,
 * quoi qu'il réponde (sa règle du 23 août 2026), et « Plus tard » n'efface
 * rien : la rubrique Mot de passe le propose toujours.
 */
export default function PretClient({
  lignes,
  phrase,
  dejaFaceId,
}: {
  lignes: LigneRecap[];
  phrase: string | null;
  dejaFaceId: boolean;
}) {
  const [passe, setPasse] = useState(false);
  const [enregistre, setEnregistre] = useState(false);
  const faceId = useActiverFaceId(() => setEnregistre(true));

  // Tant que l'appareil n'a pas répondu, rien : ni Face ID qui disparaîtrait
  // sous le doigt, ni le récapitulatif qui sauterait ensuite.
  if (!faceId.teste) return null;

  const montrerFaceId = !passe && !dejaFaceId && faceId.disponible;
  if (montrerFaceId) {
    return (
      <>
        <div className="flex flex-1 flex-col justify-center py-6">
          <svg
            width="76"
            height="76"
            viewBox="0 0 76 76"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.6"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
            className="mb-[22px]"
            style={{ color: colors.or }}
          >
            <path d="M4 22V12a8 8 0 0 1 8-8h10M54 4h10a8 8 0 0 1 8 8v10M72 54v10a8 8 0 0 1-8 8H54M22 72H12a8 8 0 0 1-8-8V54" />
            <path d="M26 28v5M50 28v5M38 30v13h-4M28 52c6 5 14 5 20 0" />
          </svg>
          <h1 className="text-[30px] leading-[1.12] tracking-[-0.01em]" style={SERIF}>
            Ouvrir Atlas avec Face&nbsp;ID&nbsp;?
          </h1>
          <p className="mt-2 text-[15px] leading-[1.45]" style={{ color: colors.inkSoft }}>
            Sans retaper votre mot de passe.
          </p>
          {enregistre && (
            <p
              role="status"
              className="mt-5 rounded-[14px] px-4 py-[13px] text-[14.5px] leading-[1.45]"
              style={{ backgroundColor: colors.carteVertFond, color: colors.carteVertTexte }}
            >
              Cet appareil est enregistré. Vous pourrez ouvrir Atlas avec Face ID.
            </p>
          )}
          {faceId.refus && (
            <p role="alert" className="mt-5 text-[14.5px] leading-[1.45]" style={{ color: colors.alert }}>
              {faceId.refus}
            </p>
          )}
        </div>
        <div className="flex-shrink-0 pb-1">
          {enregistre ? (
            <button
              type="button"
              onClick={() => setPasse(true)}
              className="min-h-[56px] w-full rounded-full text-[17px] font-semibold"
              style={{ background: colors.plein, color: surPlein }}
            >
              Continuer
            </button>
          ) : (
            <>
              <button
                type="button"
                onClick={faceId.activer}
                disabled={faceId.enCours}
                className="min-h-[56px] w-full rounded-full text-[17px] font-semibold disabled:opacity-60"
                style={{ background: colors.plein, color: surPlein }}
              >
                {faceId.enCours ? "Un instant…" : "Activer Face ID"}
              </button>
              <button
                type="button"
                onClick={() => setPasse(true)}
                className="mt-1 min-h-[48px] w-full text-[15.5px] font-semibold"
                style={{ color: colors.inkSoft }}
              >
                Plus tard
              </button>
            </>
          )}
        </div>
        <DemanderPreuve
          ouvert={faceId.preuveDemandee !== null}
          motif={faceId.preuveDemandee?.motif ?? ""}
          onAbandon={() => faceId.setPreuveDemandee(null)}
          onProuve={() => {
            const reprendre = faceId.preuveDemandee?.reprendre;
            faceId.setPreuveDemandee(null);
            reprendre?.();
          }}
        />
      </>
    );
  }

  return (
    <>
      <div className="flex-1 overflow-y-auto pb-4 pt-[30px]">
        <h1 className="text-[30px] leading-[1.12] tracking-[-0.01em]" style={SERIF}>
          {phrase ? "C’est fait." : "Tout est prêt."}
        </h1>
        {phrase && (
          <p className="mt-2 text-[15.5px] font-semibold leading-[1.45]" style={{ color: colors.carteAmbreTexte }}>
            {phrase}
          </p>
        )}
        {/* **Les paquets de Mon entreprise, dans son ordre** : il reconnaîtra
            l'écran le jour où il viendra corriger une case. Ce qui manque se
            dit en or à la place de la valeur, jamais en rouge : ce n'est pas
            une faute, c'est une case à remplir. */}
        <dl className="mt-[18px] rounded-[14px] px-[18px]" style={{ backgroundColor: colors.card }} data-atlas="recapitulatif">
          {lignes.map((l, i) => (
            <div
              key={l.paquet}
              className="py-[13px]"
              style={i > 0 ? { boxShadow: `inset 0 1px 0 ${colors.line}` } : undefined}
              data-manque={l.manque ? "" : undefined}
            >
              <dt className="text-[14px] font-semibold" style={{ color: l.manque ? colors.carteAmbreTexte : colors.inkSoft }}>
                {l.paquet}
              </dt>
              <dd className="m-0">
                {l.manque ? (
                  <span className="mt-[3px] block text-[15.5px] font-semibold" style={{ color: colors.carteAmbreTexte }}>
                    {l.manque}
                  </span>
                ) : (
                  <>
                    <span className="mt-[3px] block text-[18px] leading-[1.3]" style={SERIF}>
                      {l.valeur}
                    </span>
                    {l.detail && (
                      <span className="mt-1 block text-[13.5px] leading-[1.4]" style={{ color: colors.inkSoft }}>
                        {l.detail}
                      </span>
                    )}
                  </>
                )}
              </dd>
            </div>
          ))}
        </dl>
        <p className="mt-[14px] text-[14.5px]" style={{ color: colors.inkSoft }}>
          Tout se change dans <b style={{ color: colors.ink, fontWeight: 600 }}>Réglages</b>,{" "}
          <b style={{ color: colors.ink, fontWeight: 600 }}>Mon entreprise</b>.
        </p>
      </div>
      <div className="flex-shrink-0 pb-1 pt-2">
        {/* Vers l'accueil, et cette fois pour de bon : le code et les
            conditions sont derrière lui (les deux gardes du gabarit l'ont
            vérifié pour arriver ici). */}
        <Link
          href="/"
          className="flex min-h-[56px] w-full items-center justify-center rounded-full text-[17px] font-semibold"
          style={{ background: colors.plein, color: surPlein }}
        >
          Entrer dans Atlas
        </Link>
      </div>
    </>
  );
}
