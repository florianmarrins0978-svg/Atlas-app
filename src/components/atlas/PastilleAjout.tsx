"use client";

import { colors, voile } from "@/lib/design-tokens";
import IconeTrait, { type NomIcone } from "./IconeTrait";

/**
 * La pastille d'action des planches soignées : un bouton arrondi, une icône au
 * trait, un mot. Née sur le devis (planche du chantier, choisie le 1er novembre
 * 2026 : avant, des liens de 14 points qu'on ne reconnaissait pas comme des
 * boutons), reprise par la facture (`.pilule` de `appli/soignee/facture.html`,
 * 2 novembre 2026). Une seule pièce pour toutes les pastilles de l'appli : les
 * deux lots en avaient chacun une copie, réunies ici le 3 novembre, sans quoi
 * elles auraient divergé au premier ajustement (`CLAUDE.md` §3).
 *
 * **Le « + » reste un caractère, pas une icône**, quand il porte le nom du
 * geste : « + Ajouter une ligne » et « + Ajouter une TVA » sont les noms que
 * lisent un lecteur d'écran et trente-deux suites. Une icône muette les aurait
 * renommés en silence.
 */
export default function PastilleAjout({
  libelle,
  icone,
  plus = false,
  or = false,
  onClick,
  repere,
}: {
  libelle: string;
  icone?: NomIcone;
  plus?: boolean;
  or?: boolean;
  onClick: () => void;
  repere?: string;
}) {
  return (
    <button
      type="button"
      data-atlas={repere}
      onClick={onClick}
      // **Le bord gauche est plus court quand un signe ouvre la pastille** : le
      // signe porte son propre air. Un mot seul (« Réessayer », 3 novembre
      // 2026) reprend les deux bords égaux du bouton de sa planche
      // (`.bouton-petit`), sans quoi il paraîtrait poussé à droite.
      className={`inline-flex min-h-[44px] items-center gap-1.5 rounded-full ${icone || plus ? "pl-3 pr-4" : "px-4"} text-[14.5px] font-semibold active:scale-[0.98]`}
      style={{ color: or ? colors.or : colors.ink, boxShadow: `inset 0 0 0 1.5px ${or ? voile(colors.or, 0.6) : colors.line}` }}
    >
      {icone && <IconeTrait nom={icone} taille={17} />}
      {plus && (
        <span className="text-[20px] font-light leading-none" style={{ marginTop: -2 }}>
          +
        </span>
      )}
      {plus ? ` ${libelle}` : libelle}
    </button>
  );
}
