"use client";

import { colors } from "@/lib/design-tokens";
import IconeTrait from "./IconeTrait";

/**
 * LA CROIX QUI RETIRE — la planche du devis, validée le 1er novembre 2026
 * (`appli/soignee/chantier.html?ecran=devis`) : *« La croix remplace le « − »
 * doré pour retirer »*. La remise, l'acompte et une catégorie de TVA la
 * prennent ; chaque ligne porte déjà la sienne.
 *
 * **44 px au doigt, 16 dessinés.** Le « − » cerclé de 26 px (sa proposition B
 * du 17 août 2026) tenait tout juste au doigt. La zone grandit, le dessin
 * s'allège, et la marge négative garde à la rangée la hauteur que le « − »
 * lui donnait : sans elle, chaque ligne des totaux gagnait 18 px.
 *
 * **Dans l'encre douce, pas dans l'or**, comme sur la planche : l'or dit ce
 * qui est consenti au client, la croix n'est qu'un geste.
 */
export default function CroixRetirer({
  libelle,
  repere,
  onClick,
  taille = 16,
  className = "",
}: {
  /** Le nom que lit un lecteur d'écran, et que les suites cherchent. */
  libelle: string;
  repere?: string;
  onClick: () => void;
  taille?: number;
  /** Le placement dans sa rangée (marge latérale), jamais le dessin. */
  className?: string;
}) {
  return (
    <button
      type="button"
      aria-label={libelle}
      data-atlas={repere}
      onClick={onClick}
      className={`-my-[9px] flex h-11 w-11 flex-none items-center justify-center rounded-full ${className}`}
      style={{ color: colors.inkSoft }}
    >
      <IconeTrait nom="croix" taille={taille} />
    </button>
  );
}
