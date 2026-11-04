"use client";

import { useRef, useState } from "react";
import BottomSheet from "./BottomSheet";
import PrimaryButton from "./PrimaryButton";
import { colors, font, voile } from "@/lib/design-tokens";
// « 5.50 » se lit « 5,5 » : la case et les raccourcis parlent comme lui.
import { tauxLisible as tauxEnMots } from "@/lib/reduction-devis";
import type { ApercuDuTaux, LectureDuTaux } from "@/lib/feuilles-du-taux";

/**
 * ─── UNE TVA, UN ACOMPTE, UNE REMISE : LE CHIFFRE QU'IL TAPE ─────────────────
 *
 * Sa réponse du 1er novembre 2026 devant la planche du devis : *« TVA, acompte,
 * remise, je dois pouvoir écrire ce que je veux »*. La feuille s'ouvre donc sur
 * une grande case au pavé de chiffres ; les valeurs courantes ne sont que des
 * raccourcis dessous. Planche : `appli/soignee/chantier.html?ecran=devis`.
 *
 * **La feuille ne décide de rien.** Ce qu'un chiffre vaut, c'est l'écran qui
 * la monte qui le dit (`lire`), avec les fonctions pures que le serveur oppose
 * à son tour (`tauxTvaValide`, `pourcentValide`, `tauxCumuleValide`) : une
 * seule règle pour construire l'écran et revalider ce qu'il renvoie
 * (`CLAUDE.md` §3). Ce que l'ajout produira se montre AVANT d'ajouter
 * (`apercu`), avec les totaux de l'écran, jamais avec un calcul à elle.
 *
 * **Le devis et la facture la montent** depuis le 4 novembre 2026 (planche
 * `appli/soignee/facture.html`, page « ts ») : elle a quitté `devis-complet/`
 * pour les pièces communes. La TVA et la remise y ont chacune leur montage,
 * une seule fois pour les deux pièces (`FeuilleDeLaTva`, `FeuilleDeLaRemise`).
 */

type Props = {
  ouverte: boolean;
  titre: string;
  /** Le nom de la case pour un lecteur d'écran : ce que le chiffre veut dire. */
  nomDeLaCase: string;
  valeurInitiale: string;
  raccourcis: readonly string[];
  lire: (saisie: string) => LectureDuTaux;
  apercu?: (taux: string) => ApercuDuTaux | null;
  /** Une ligne au-dessus du résultat, quand le geste en a besoin (le moment d'un acompte). */
  precision?: string;
  bouton: (taux: string) => string;
  repere: string;
  onValider: (taux: string) => void;
  onFermer: () => void;
};

export default function FeuilleDuTaux(props: Props) {
  // **Chaque ouverture repart de la valeur proposée** : le contenu ne vit que
  // feuille ouverte (`BottomSheet` ne rend rien fermée), donc son état naît à
  // chaque ouverture. Une feuille rouverte sur ce qu'il avait tapé puis
  // abandonné ferait croire que ce chiffre est posé.
  return (
    <BottomSheet open={props.ouverte} onBackdropClick={props.onFermer}>
      <ContenuDeLaFeuille {...props} />
    </BottomSheet>
  );
}

function ContenuDeLaFeuille(props: Props) {
  const [saisie, setSaisie] = useState(tauxEnMots(props.valeurInitiale));
  const caseRef = useRef<HTMLInputElement>(null);

  const lecture = props.lire(saisie);
  const taux = "taux" in lecture ? lecture.taux : null;
  const apercu = taux !== null && props.apercu ? props.apercu(taux) : null;

  return (
    <div data-atlas={props.repere}>
      <p
        className="mb-4 text-[26px] leading-tight"
        style={{ fontFamily: font.display, color: colors.ink }}
      >
        {props.titre}
      </p>

      <label
        className="flex h-[68px] items-baseline justify-end gap-2 rounded-[14px] px-[18px]"
        style={{
          backgroundColor: colors.card,
          boxShadow: `inset 0 0 0 ${"refus" in lecture ? 2 : 1.5}px ${"refus" in lecture ? colors.carteAmbreTexte : colors.line}`,
        }}
      >
        <input
          ref={caseRef}
          inputMode="decimal"
          autoComplete="off"
          value={saisie}
          onChange={(e) => setSaisie(e.target.value)}
          aria-label={props.nomDeLaCase}
          aria-invalid={"refus" in lecture || undefined}
          data-atlas={`${props.repere}-case`}
          className="h-full min-w-0 flex-1 border-0 bg-transparent p-0 text-right outline-none"
          style={{
            fontFamily: font.display,
            fontSize: 40,
            lineHeight: "68px",
            color: colors.ink,
          }}
        />
        <span
          className="text-[26px]"
          style={{ fontFamily: font.display, color: colors.inkSoft }}
        >
          %
        </span>
      </label>

      {"refus" in lecture && (
        <p
          className="mt-2 text-[14.5px]"
          role="alert"
          style={{ color: colors.carteAmbreTexte }}
          data-atlas={`${props.repere}-refus`}
        >
          {lecture.refus}
        </p>
      )}

      {props.raccourcis.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2.5">
          {props.raccourcis.map((r) => {
            const choisi = taux !== null && Number(taux) === Number(r);
            return (
              <button
                key={r}
                type="button"
                aria-pressed={choisi}
                onClick={() => {
                  setSaisie(tauxEnMots(r));
                  caseRef.current?.blur();
                }}
                className="min-h-[44px] rounded-full px-4 text-[15px] font-semibold"
                style={{
                  color: colors.ink,
                  boxShadow: `inset 0 0 0 ${choisi ? 2 : 1.5}px ${choisi ? colors.ink : colors.line}`,
                }}
              >
                {tauxEnMots(r)} %
              </button>
            );
          })}
        </div>
      )}

      {(props.precision || apercu) && (
        <div
          className="mt-4 rounded-[10px] px-4 py-3.5"
          style={{ backgroundColor: voile(colors.or, 0.13) }}
        >
          {props.precision && (
            <p className="text-[14.5px]" style={{ color: colors.inkSoft }}>
              {props.precision}
            </p>
          )}
          {apercu && (
            <>
              <p className="text-[14.5px]" style={{ color: colors.inkSoft }}>
                {apercu.calcul}
              </p>
              <p
                className="mt-1 text-[28px] leading-tight"
                style={{
                  fontFamily: font.display,
                  color: colors.ink,
                  fontVariantNumeric: "tabular-nums lining-nums",
                }}
                data-atlas={`${props.repere}-montant`}
              >
                {apercu.montant}
              </p>
              {apercu.dessous && (
                <p
                  className="mt-1 text-[14.5px]"
                  style={{ color: colors.inkSoft }}
                >
                  {apercu.dessous}
                </p>
              )}
            </>
          )}
        </div>
      )}

      <div className="mt-5">
        <PrimaryButton
          disabled={taux === null}
          onClick={() => {
            if (taux !== null) props.onValider(taux);
          }}
          repere={`${props.repere}-valider`}
          pleineLargeur
        >
          {props.bouton(taux ?? props.valeurInitiale)}
        </PrimaryButton>
      </div>
      <button
        type="button"
        onClick={props.onFermer}
        className="mt-2 block min-h-[44px] w-full text-center text-[15px] font-semibold"
        style={{ color: colors.inkSoft }}
      >
        Annuler
      </button>
    </div>
  );
}
