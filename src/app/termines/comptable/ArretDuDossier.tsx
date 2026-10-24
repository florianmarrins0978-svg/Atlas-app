"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { colors, font } from "@/lib/design-tokens";
import { jourComplet } from "@/lib/pour-mon-comptable";
import { arreterDossierAction } from "./actions";

/**
 * « ARRÊTER MON DOSSIER ICI » — sa règle du 24 octobre 2026 : *« l'utilisateur
 * décide quand il veut l'arrêter, avec une touche »* (planche, écrans 2 et 5).
 *
 * La date d'arrêt se choisit (aujourd'hui par défaut) ; celle du début ne se
 * choisit qu'au tout premier dossier. Tant qu'une ligne attend sa pièce, le
 * bouton n'est pas proposé : un dossier incomplet ne se range pas.
 */
export default function ArretDuDossier({
  du,
  premier,
  aujourdhui,
  aJustifier,
}: {
  du: string;
  premier: boolean;
  aujourdhui: string;
  aJustifier: number;
}) {
  const router = useRouter();
  const [enCours, demarrer] = useTransition();
  const [ouvert, setOuvert] = useState(false);
  const [debut, setDebut] = useState(du);
  const [fin, setFin] = useState(aujourdhui);
  const [refus, setRefus] = useState<string | null>(null);

  function arreter() {
    setRefus(null);
    demarrer(async () => {
      const r = await arreterDossierAction(premier ? debut : null, fin);
      if (!r.ok) {
        setRefus(r.raison);
        return;
      }
      router.push("/termines/comptable/dossiers");
    });
  }

  const champ = {
    border: `1px solid ${colors.line}`,
    backgroundColor: colors.cream,
    color: colors.ink,
  };

  return (
    <article className="mx-6 mt-4 rounded-[18px] px-[18px] py-4" style={{ backgroundColor: colors.card }} data-atlas="dossier-en-cours">
      <p className="m-0 text-[16px] leading-[1.3]" style={{ fontFamily: font.display }}>
        Dossier en cours, depuis le {jourComplet(du)}
      </p>
      {!ouvert ? (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setOuvert(true)}
            className="min-h-[44px] rounded-full px-5 text-[14px] font-medium"
            style={{ border: `1px solid ${colors.line}`, backgroundColor: colors.cream, color: colors.ink }}
            data-atlas="arreter-mon-dossier"
          >
            Arrêter mon dossier ici
          </button>
          <Link href="/termines/comptable/dossiers" className="min-h-[44px] px-2 py-3 text-[14px] font-medium" style={{ color: colors.rust }} data-atlas="mes-dossiers">
            Mes dossiers justifiés
          </Link>
        </div>
      ) : (
        <>
          {premier && (
            <label className="mt-3 block text-[13px]" style={{ color: colors.inkSoft }}>
              Du
              <input type="date" value={debut} max={fin} onChange={(e) => setDebut(e.target.value)} className="mt-1.5 block min-h-[44px] w-full rounded-[10px] px-3 text-[15px]" style={champ} data-atlas="date-debut" />
            </label>
          )}
          <label className="mt-3 block text-[13px]" style={{ color: colors.inkSoft }}>
            Au
            <input type="date" value={fin} max={aujourdhui} onChange={(e) => setFin(e.target.value)} className="mt-1.5 block min-h-[44px] w-full rounded-[10px] px-3 text-[15px]" style={champ} data-atlas="date-arret" />
          </label>
          {aJustifier > 0 ? (
            <p className="mt-2 text-[13.5px] leading-[1.45]" style={{ color: colors.alert }}>
              {aJustifier} {aJustifier > 1 ? "lignes attendent" : "ligne attend"} encore un justificatif. Réglez-les d’abord au Check up.
            </p>
          ) : (
            <p className="mt-2 text-[13.5px]" style={{ color: colors.inkSoft }}>
              Le dossier ira du {jourComplet(premier ? debut : du)} au {jourComplet(fin)}.
            </p>
          )}
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {aJustifier === 0 && (
              <button type="button" disabled={enCours} onClick={arreter} className="atlas-plein min-h-[44px] rounded-full px-5 text-[14px] font-medium disabled:opacity-60" style={{ backgroundColor: colors.plein, color: colors.card }} data-atlas="arreter-et-ranger">
                {enCours ? "Rangement…" : "Arrêter et ranger"}
              </button>
            )}
            <button type="button" disabled={enCours} onClick={() => setOuvert(false)} className="min-h-[44px] px-2 text-[14px] font-medium" style={{ color: colors.inkSoft }}>
              Annuler
            </button>
          </div>
        </>
      )}
      {refus && (
        <p role="alert" className="mt-2 rounded-lg px-3 py-2 text-[13px]" style={{ backgroundColor: colors.carteRougeFond, color: colors.carteRougeTexte }}>
          {refus}
        </p>
      )}
    </article>
  );
}
