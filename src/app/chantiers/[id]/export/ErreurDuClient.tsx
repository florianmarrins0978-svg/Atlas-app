"use client";

import BottomSheet from "@/components/atlas/BottomSheet";
import { colors, surPlein } from "@/lib/design-tokens";
import { avecCivilite, type CiviliteClient } from "@/lib/civilite";

/**
 * « LE CLIENT S'EST TROMPÉ » — son choix 3 du 7 octobre 2026
 * (`appli/devis-accepte-par-erreur.html`) : un seul mot sur la page, et la
 * question propose les deux suites, selon ce que le client a dit au téléphone.
 *
 * **La feuille n'écrit rien.** Elle rend le choix à l'écran, qui le fait
 * passer par le tiroir des six secondes (`useRetraits`) : la question avant,
 * l'annulation après, comme pour « Supprimer » au planning.
 *
 * **Le sujet se lit dans la donnée, jamais deviné** (`CLAUDE.md` §3) : « Il »
 * pour Mr, « Elle » pour Mme, et « Le client » quand rien ne le dit.
 */
export default function ErreurDuClient({
  ouvert,
  clientNom,
  clientCivilite,
  onChoisir,
  onRenoncer,
}: {
  ouvert: boolean;
  clientNom: string;
  clientCivilite: CiviliteClient | null;
  onChoisir: (vers: "attente" | "refusee") => void;
  onRenoncer: () => void;
}) {
  const sujet = clientCivilite === "mr" ? "Il" : clientCivilite === "mme" ? "Elle" : "Le client";
  const nom = avecCivilite(clientNom, clientCivilite ?? undefined) || "Le client";
  return (
    <BottomSheet open={ouvert} onBackdropClick={onRenoncer}>
      <div data-atlas="erreur-du-client">
        <p className="mb-2 text-center text-[17px]" style={{ color: colors.ink }}>
          {nom} s’est {clientCivilite === "mme" ? "trompée" : "trompé"} ?
        </p>
        <p className="mb-6 text-center text-[13px] leading-[1.5]" style={{ color: colors.muted }}>
          Dans les deux cas, le chantier quitte le planning.
        </p>
        <button
          type="button"
          data-atlas="vers-attente"
          onClick={() => onChoisir("attente")}
          className="h-[52px] w-full cursor-pointer rounded-full text-[15px] font-semibold"
          style={{ background: colors.alert, color: surPlein, WebkitTapHighlightColor: "transparent" }}
        >
          {sujet} veut une autre date
        </button>
        <button
          type="button"
          data-atlas="vers-refus"
          onClick={() => onChoisir("refusee")}
          className="mt-2.5 h-[52px] w-full cursor-pointer rounded-full text-[15px] font-semibold"
          style={{
            background: "transparent",
            color: colors.alert,
            boxShadow: `inset 0 0 0 1.5px ${colors.alert}`,
            WebkitTapHighlightColor: "transparent",
          }}
        >
          {sujet} ne veut plus du devis
        </button>
        <button
          type="button"
          onClick={onRenoncer}
          className="mt-4 block w-full cursor-pointer text-center text-[13px]"
          style={{ color: colors.muted }}
        >
          Annuler
        </button>
      </div>
    </BottomSheet>
  );
}
