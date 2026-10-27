"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { colors } from "@/lib/design-tokens";
import { jourComplet } from "@/lib/pour-mon-comptable";
import { arreterDossierAction } from "./actions";
import Icone from "@/components/atlas/IconeTrait";

/**
 * « ARRÊTER MON DOSSIER ICI » — sa règle du 24 octobre 2026 : *« l'utilisateur
 * décide quand il veut l'arrêter, avec une touche »*.
 *
 * La date d'arrêt se choisit (aujourd'hui par défaut) ; celle du début ne se
 * choisit qu'au tout premier dossier. **Tant qu'une ligne attend sa pièce, le
 * bouton le dit d'avance** (planche du 25 octobre) : il s'ouvrait sur un refus,
 * c'est-à-dire après qu'il avait déjà touché. Le serveur refuse de toute façon
 * un dossier incomplet (`arreterLeDossier`).
 */
export default function ArretDuDossier({
  du,
  premier,
  aujourdhui,
  aJustifier,
  ouvert,
  onOuvert,
  onPasse,
}: {
  du: string;
  premier: boolean;
  aujourdhui: string;
  aJustifier: number;
  /** Ouvert, le Check up du bas se retire : un seul bouton plein à la fois. */
  ouvert: boolean;
  onOuvert: (ouvert: boolean) => void;
  onPasse: (texte: string) => void;
}) {
  const router = useRouter();
  const [enCours, demarrer] = useTransition();
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

  const champ = { boxShadow: `inset 0 0 0 1.5px ${colors.line}`, backgroundColor: colors.cream, color: colors.ink };
  const attend = aJustifier > 0;

  return (
    <section className="mx-6 mt-3 rounded-[18px] px-[18px] py-[18px]" style={{ backgroundColor: colors.card }} data-atlas="dossier-en-cours">
      {!ouvert ? (
        <>
          <button
            type="button"
            aria-disabled={attend}
            onClick={() => (attend ? onPasse("Justifiez d’abord les lignes du dessus.") : onOuvert(true))}
            className="inline-flex min-h-[52px] w-full items-center justify-center gap-2.5 rounded-full px-5 text-[16px] font-medium"
            style={attend ? { backgroundColor: colors.lineSoft, color: colors.inkSoft } : { boxShadow: `inset 0 0 0 1.5px ${colors.line}`, backgroundColor: colors.card, color: colors.ink }}
            data-atlas="arreter-mon-dossier"
          >
            <Icone nom="cadenas" taille={21} />
            Arrêter mon dossier ici
          </button>
          {attend && (
            <p className="mt-2.5 text-[15px] leading-[1.45]" style={{ color: colors.inkSoft }} data-atlas="arret-attend">
              Possible une fois {aJustifier > 1 ? `les ${aJustifier} lignes justifiées.` : "la dernière ligne justifiée."}
            </p>
          )}
        </>
      ) : (
        <>
          {premier && (
            <label className="block text-[15px] font-medium" style={{ color: colors.inkSoft }}>
              Du
              <input type="date" value={debut} max={fin} onChange={(e) => setDebut(e.target.value)} className="mt-2 block min-h-[52px] w-full rounded-[12px] px-3.5 text-[16px]" style={champ} data-atlas="date-debut" />
            </label>
          )}
          <label className={`block text-[15px] font-medium ${premier ? "mt-3.5" : ""}`} style={{ color: colors.inkSoft }}>
            Au
            <input type="date" value={fin} max={aujourdhui} onChange={(e) => setFin(e.target.value)} className="mt-2 block min-h-[52px] w-full rounded-[12px] px-3.5 text-[16px]" style={champ} data-atlas="date-arret" />
          </label>
          <p className="mt-3 text-[15px] leading-[1.45]" style={{ color: colors.ink }}>
            Le dossier ira du {jourComplet(premier ? debut : du)} au {jourComplet(fin)}.
          </p>
          <div className="mt-3.5 flex items-center gap-2">
            <button type="button" disabled={enCours} onClick={arreter} className="atlas-plein inline-flex min-h-[54px] flex-1 items-center justify-center gap-2.5 rounded-full px-5 text-[16px] font-medium disabled:opacity-60" style={{ backgroundColor: colors.plein, color: colors.card }} data-atlas="arreter-et-ranger">
              <Icone nom="cadenas" taille={21} />
              {enCours ? "Rangement…" : "Arrêter et ranger"}
            </button>
            <button type="button" disabled={enCours} onClick={() => onOuvert(false)} className="min-h-[54px] px-3 text-[16px] font-medium" style={{ color: colors.inkSoft }}>
              Annuler
            </button>
          </div>
        </>
      )}
      {refus && (
        <p role="alert" className="mt-2.5 rounded-[12px] px-3.5 py-2.5 text-[14px]" style={{ backgroundColor: colors.carteRougeFond, color: colors.carteRougeTexte }}>
          {refus}
        </p>
      )}
    </section>
  );
}
