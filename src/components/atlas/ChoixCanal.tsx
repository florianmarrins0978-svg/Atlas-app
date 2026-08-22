"use client";

import { colors } from "@/lib/design-tokens";

/**
 * « Par SMS » ou « Par e-mail » — la capsule, partout où l'on choisit un canal.
 *
 * ───────────────────────────────────────────────────────────────────────────
 * **Extraite le 22 août 2026, à sa demande.** Devant la planche 84, sur l'écran
 * de la facture : *« le choix SMS ou e-mail, mais de la même forme que sur la
 * page fiche client »*.
 *
 * Elle vivait dans `FormulaireNouveauChantier`, taillée aux mesures de sa
 * maquette (`.canal button` — 14 px de texte, un liseré gris au repos, l'or et
 * le fond papier quand le canal est pris). La recopier sur la facture aurait
 * donné deux dessins du même geste, qui auraient divergé au premier
 * ajustement — et c'est LUI qui aurait vu deux capsules différentes pour la
 * même question à deux écrans d'intervalle (`CLAUDE.md` §3).
 *
 * ── `disponible`, ET C'EST SA RÈGLE, PAS UNE PRÉCAUTION ─────────────────────
 *
 * *« Non, refuse l'envoi : ça veut dire qu'il communique avec le client par
 * SMS, donc il enverra par SMS. »* — sa réponse, le même jour, à la question de
 * l'adresse manquante.
 *
 * Un canal sans coordonnée est donc **inerte**, jamais masqué. Les deux raisons
 * se tiennent, et la seconde est la sienne :
 *
 * - proposer « Par e-mail » quand Atlas n'a pas d'adresse mène à un message
 *   ouvert sans destinataire — le défaut qu'il a déjà payé ;
 * - le **masquer** ferait disparaître une capsule d'un écran à l'autre, et
 *   chercher pourquoi. Inerte, elle dit ce qui manque sans rien promettre.
 *
 * **Aucun champ de saisie ici, et c'est délibéré** : il a écarté l'idée. Sur le
 * devis, `TransmettreAuClient` en propose un — c'est le seul écran où une
 * coordonnée manquante se rattrape, et il n'a pas voulu l'étendre.
 */
export default function ChoixCanal({
  libelle,
  actif,
  disponible,
  onClick,
}: {
  libelle: string;
  actif: boolean;
  /** La coordonnée existe-t-elle ? Sinon la capsule reste inerte. */
  disponible: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!disponible}
      aria-pressed={actif}
      data-atlas={`canal-${libelle.toLowerCase().includes("sms") ? "sms" : "email"}`}
      // Les mesures de sa maquette (`.canal button`) : 14 px de texte, un
      // liseré gris au repos, l'OR et le fond papier quand le canal est pris.
      className="flex-1 rounded-full py-[11px] text-[14px] disabled:opacity-40"
      style={{
        backgroundColor: actif ? colors.rustTint : "transparent",
        color: actif ? colors.ink : colors.inkSoft,
        boxShadow: `inset 0 0 0 1px ${actif ? colors.or : colors.line}`,
      }}
    >
      {libelle}
    </button>
  );
}
