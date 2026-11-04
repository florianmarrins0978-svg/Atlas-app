"use client";

import { useState } from "react";
import BottomSheet from "@/components/atlas/BottomSheet";
import RepartirLaMainOeuvre, { choixDeDepart } from "@/components/atlas/RepartirLaMainOeuvre";
import { ListeDesPartenaires, PartenairePris, PastilleMesPartenaires } from "@/components/atlas/PartenairesDeLaMainOeuvre";
import { colors, font } from "@/lib/design-tokens";
import {
  aLaJournee,
  mainOeuvreDUnPartenaire,
  quantiteDuPartenaire,
  quantiteTapee,
  type PrixDePartenaire,
} from "@/lib/feuille-main-oeuvre";
import { ecrireChoix, lireChoix, questionDeLaMainOeuvre, type QuestionMainOeuvre } from "@/lib/main-oeuvre-dictee";

/**
 * ─── LA MAIN D'ŒUVRE DICTÉE, ET « MES PARTENAIRES » — son « B » du 4 novembre 2026 ───
 *
 * Sa demande : *« quand je dicte deux jours deux hommes, et que l'application
 * me demande ligne main d'œuvre ou répartir, ça serait bien que j'aie
 * l'encadré Mes partenaires »*. Planche
 * `appli/soignee/main-oeuvre-dictee-partenaires.html`, version B : un prix
 * touché DEVIENT la main d'œuvre, comme dans la feuille du devis.
 *
 * **Ce que l'écran montre est ce qui part** (`CLAUDE.md` §3) : le total et le
 * calcul se lisent sur la réponse enregistrée (`valeur`), avec les règles de
 * la feuille (`mainOeuvreDUnPartenaire`, `quantiteDuPartenaire`), que le
 * serveur rejoue sur les prix relus en base (`partenaireDuChoix`). Une
 * quantité tapée qui ne se lit pas ne s'enregistre pas : le total reste celui
 * de la dernière qui se lisait, et c'est celui-là qui partirait.
 */
export default function MainOeuvreDeLaDictee({
  libelle,
  mainOeuvre,
  valeur,
  onChange,
}: {
  /** « Main d'œuvre », ou rien quand la question d'avant porte déjà ce libellé. */
  libelle: string | null;
  mainOeuvre: QuestionMainOeuvre;
  valeur: string;
  onChange: (valeur: string) => void;
}) {
  const choix = lireChoix(valeur) ?? lireChoix(choixDeDepart(mainOeuvre))!;
  const pris = choix.partenaire ? (mainOeuvre.partenaires.find((p) => p.id === choix.partenaire!.prixId) ?? null) : null;
  const quantite = pris ? quantiteDuPartenaire(pris, mainOeuvre.jours, choix.partenaire!.quantite) : null;
  const duPartenaire = pris && quantite !== null ? mainOeuvreDUnPartenaire(pris, quantite) : null;
  const total = pris === null ? mainOeuvre.total : (duPartenaire?.montant ?? null);
  const detail = pris === null ? mainOeuvre.detail : (duPartenaire?.calcul ?? "Écrivez une quantité au-dessus de zéro.");

  const [ouverte, setOuverte] = useState(false);
  const [saisie, setSaisie] = useState(quantite !== null ? String(quantite).replace(".", ",") : "1");

  const sansPartenaire = { mode: choix.mode, parts: choix.parts, retires: choix.retires };
  function choisir(p: PrixDePartenaire) {
    onChange(ecrireChoix({ ...sansPartenaire, partenaire: { prixId: p.id, quantite: aLaJournee(p.unite) ? mainOeuvre.jours : 1 } }));
    setSaisie("1");
    setOuverte(false);
  }
  function revenirASonEquipe() {
    onChange(ecrireChoix(sansPartenaire));
    setOuverte(false);
  }
  function taper(texte: string) {
    setSaisie(texte);
    const n = quantiteTapee(texte);
    if (pris && n !== null) onChange(ecrireChoix({ ...sansPartenaire, partenaire: { prixId: pris.id, quantite: n } }));
  }

  return (
    <>
      <div className="flex items-center justify-between gap-3">
        <p className="text-[12px]" style={{ color: colors.muted }}>
          {libelle}
        </p>
        <PastilleMesPartenaires pris={pris !== null} onClick={() => setOuverte(true)} />
      </div>
      <p className="text-[15px] font-medium" style={{ color: colors.ink, marginTop: 2 }} data-atlas="mo-question">
        {questionDeLaMainOeuvre(total)}
      </p>

      <div className="mt-2">
        <RepartirLaMainOeuvre
          question={{ ...mainOeuvre, total: total ?? "0", detail }}
          valeur={valeur}
          onChange={onChange}
          sousLeDetail={
            pris && (
              <div className="mt-2 flex flex-col gap-2">
                <PartenairePris prix={pris} onRevenir={revenirASonEquipe} />
                {!aLaJournee(pris.unite) && (
                  <label className="flex items-center justify-between gap-3">
                    <span className="text-[14px]" style={{ color: colors.inkSoft }}>
                      {pris.unite === "heure" || pris.unite === "h" ? "Heures" : `Quantité, en ${pris.unite}`}
                    </span>
                    <input
                      inputMode="decimal"
                      value={saisie}
                      onChange={(e) => taper(e.target.value)}
                      data-atlas="mo-quantite"
                      className="h-11 w-[104px] rounded-[10px] border-0 px-3 text-right text-[17px] outline-none"
                      style={{ backgroundColor: colors.card, boxShadow: `inset 0 0 0 1.5px ${colors.line}`, color: colors.ink }}
                    />
                  </label>
                )}
              </div>
            )
          }
        />
      </div>

      <BottomSheet open={ouverte} onBackdropClick={() => setOuverte(false)}>
        <p className="mb-3 text-[26px] leading-tight" style={{ fontFamily: font.display, color: colors.ink }}>
          Mes partenaires
        </p>
        <ListeDesPartenaires partenaires={mainOeuvre.partenaires} onChoisir={choisir} onMonEquipe={revenirASonEquipe} />
      </BottomSheet>
    </>
  );
}
