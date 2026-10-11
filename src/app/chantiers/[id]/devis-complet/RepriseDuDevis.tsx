"use client";

import { useEffect, useRef, useState } from "react";
import { colors, surPlein } from "@/lib/design-tokens";
import { enEuros } from "@/lib/euros";
import { lignesAMettreAJour, lireTauxDeHausse, type ReponseGrille } from "@/lib/hausse-du-devis";
import { repriseDuDevisAction } from "./actions";

/**
 * LE DEVIS REPRIS : les deux cadres en tête de la feuille — ses décisions du
 * 26 septembre 2026, sur `appli/augmenter-un-devis-repris.html`.
 *
 * 1. **« Votre grille a changé »** : « Dernier devis » a repris l'ancien devis
 *    à SES prix. Si sa grille porte un autre prix pour une ligne, on le lui
 *    DEMANDE — *« pas comme ça sans qu'il le sache »*.
 * 2. **« Augmenter les prix »** : 5, 10, 30 % ou le taux qu'il tape, sur les
 *    lignes reprises et jamais retouchées. Le calcul et l'arrondi vivent dans
 *    `src/lib/hausse-du-devis.ts`, l'écriture dans `appliquerLaReprise`.
 *
 * **Rien ne s'affiche sur un devis qui n'est pas une reprise** : sans ligne
 * reprise ni hausse posée, ce composant ne rend rien, et l'écran d'un devis
 * neuf ne change pas d'un pixel.
 */

const PASTILLES = [5, 10, 30];

/** Ce que la feuille sait d'une ligne pour ces deux cadres. */
export type LigneDeReprise = {
  id: string;
  libelle: string;
  prixAncien: string | null;
  prixGrille: string | null;
};

export default function RepriseDuDevis({
  chantierId,
  lignes,
  reponseInitiale,
  hausseInitiale,
  ecrire,
  onPrix,
}: {
  chantierId: string;
  lignes: LigneDeReprise[];
  reponseInitiale: ReponseGrille;
  hausseInitiale: number;
  /** La file d'écriture de la feuille : une hausse ne double jamais un prix tapé en cours d'envoi. */
  ecrire: <T>(ecriture: () => Promise<T>) => Promise<T>;
  /** Les prix réécrits, à poser dans la feuille sans la recharger. */
  onPrix: (maj: { id: string; prixUnitaire: string; montant: string }[]) => void;
}) {
  const [reponse, setReponse] = useState<ReponseGrille>(reponseInitiale);
  const [hausse, setHausse] = useState(hausseInitiale);
  const [saisie, setSaisie] = useState(hausseInitiale ? String(hausseInitiale).replace(".", ",") : "");
  const [refus, setRefus] = useState<string | null>(null);
  const attente = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (attente.current) clearTimeout(attente.current);
  }, []);

  const reprises = lignes.filter((l) => l.prixAncien !== null);
  const aMettreAJour = lignesAMettreAJour(reprises);
  if (reprises.length === 0 && hausse === 0) return null;

  async function envoyer(choix: { reponse?: ReponseGrille; hausse?: string }) {
    const r = await ecrire(() => repriseDuDevisAction(chantierId, choix));
    if (!r.ok) {
      setRefus(r.raison);
      return;
    }
    setRefus(null);
    setReponse(r.reponse);
    setHausse(r.hausse);
    onPrix(r.lignes);
  }

  function repondre(valeur: ReponseGrille) {
    setReponse(valeur);
    void envoyer({ reponse: valeur });
  }

  function toucherPastille(t: number) {
    if (attente.current) clearTimeout(attente.current);
    const suivante = hausse === t ? 0 : t;
    setHausse(suivante);
    setSaisie(suivante ? String(suivante) : "");
    void envoyer({ hausse: String(suivante) });
  }

  // Le taux tapé part une demi-seconde après le dernier chiffre : envoyé à
  // chaque touche, « 12 » réécrirait tout le devis à 1 % avant d'arriver à 12.
  function taper(texte: string) {
    setSaisie(texte);
    if (attente.current) clearTimeout(attente.current);
    const lu = lireTauxDeHausse(texte);
    if (lu === null) {
      setRefus("Entre 0,1 et 100 %.");
      return;
    }
    setRefus(null);
    setHausse(lu);
    attente.current = setTimeout(() => void envoyer({ hausse: texte }), 500);
  }

  return (
    <div className="mb-6 flex flex-col gap-3">
      {aMettreAJour.length > 0 && reponse === null && (
        <div
          className="rounded-lg p-3"
          style={{ boxShadow: `inset 0 0 0 1.5px ${colors.or}` }}
          data-atlas="question-grille"
        >
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.12em]" style={{ color: colors.orTexte }}>
            Votre grille a changé
          </p>
          {aMettreAJour.map((l) => (
            <p key={l.id} className="text-[14.5px] leading-normal tabular-nums">
              {l.libelle} : <s style={{ color: colors.muted }}>{enEuros(Number(l.prixAncien))}</s> devient{" "}
              {enEuros(Number(l.prixGrille))}
            </p>
          ))}
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={() => repondre("oui")}
              className="h-[42px] flex-1 rounded-full text-[14.5px] font-medium"
              style={{ backgroundColor: colors.plein, color: surPlein }}
            >
              Mettre à jour
            </button>
            <button
              type="button"
              onClick={() => repondre("non")}
              className="h-[42px] flex-1 rounded-full text-[14.5px] font-medium"
              style={{ color: colors.ink, boxShadow: `inset 0 0 0 1px ${colors.line}` }}
            >
              Garder les anciens
            </button>
          </div>
        </div>
      )}

      {aMettreAJour.length > 0 && reponse !== null && (
        <p className="flex items-center justify-between gap-3 text-[14px]" style={{ color: colors.inkSoft }}>
          <span>{reponse === "oui" ? "Prix mis à jour." : "Anciens prix gardés."}</span>
          <button
            type="button"
            onClick={() => repondre(null)}
            className="text-[14px] font-medium"
            style={{ color: colors.orTexte }}
          >
            Changer
          </button>
        </p>
      )}

      <div className="rounded-lg px-3 pb-3 pt-2.5" style={{ backgroundColor: colors.rustTint }} data-atlas="hausse-reprise">
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.12em]" style={{ color: colors.rust }}>
          Augmenter les prix
        </p>
        <div className="flex flex-wrap items-center gap-[7px]">
          {PASTILLES.map((t) => (
            <button
              key={t}
              type="button"
              aria-pressed={hausse === t}
              onClick={() => toucherPastille(t)}
              className="h-[34px] whitespace-nowrap rounded-full px-3 text-[14px] font-medium"
              style={
                hausse === t
                  ? { backgroundColor: colors.plein, color: surPlein }
                  : { backgroundColor: colors.card, color: colors.ink, boxShadow: `inset 0 0 0 1px ${colors.line}` }
              }
            >
              {`+ ${t} %`}
            </button>
          ))}
          <label
            className="flex h-[34px] items-center gap-1 rounded-full pl-2 pr-3"
            style={{ backgroundColor: colors.card, boxShadow: `inset 0 0 0 1px ${colors.line}` }}
          >
            <input
              value={saisie}
              inputMode="decimal"
              autoComplete="off"
              aria-label="Autre pourcentage"
              onChange={(e) => taper(e.target.value)}
              className="w-10 border-0 bg-transparent p-0 text-right text-[16px] font-medium outline-none"
              style={{ color: colors.ink }}
            />
            <span className="text-[14px]" style={{ color: colors.inkSoft }}>
              %
            </span>
          </label>
        </div>
        {refus && (
          <p className="mt-2 text-[13px]" style={{ color: colors.alert }}>
            {refus}
          </p>
        )}
      </div>
    </div>
  );
}
