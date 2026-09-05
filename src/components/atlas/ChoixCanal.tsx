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
  apparence = "capsule",
}: {
  libelle: string;
  actif: boolean;
  /** La coordonnée existe-t-elle ? Sinon la capsule reste inerte. */
  disponible: boolean;
  onClick: () => void;
  /**
   * DEUX DESSINS DU MÊME GESTE, ET UNE SEULE RÈGLE.
   *
   * `"capsule"` — la pilule pleine largeur, celle de la facture, inchangée
   * depuis le 22 août 2026.
   *
   * `"reglage"` — deux mots sur une ligne, l'actif souligné d'or. **C'est la
   * planche « A — Épurée » qu'il a retenue le 2 septembre 2026**, et elle en
   * donne la raison en une phrase : *« l'envoi n'est plus une action : c'est un
   * réglage. Il en prend la forme — une ligne, deux mots — et rend 40 px à
   * l'anneau. »* Les deux capsules pleine largeur se lisaient comme des boutons
   * d'envoi alors qu'elles ne font que dire par où l'on écrira.
   *
   * **Un réglage de plus, pas un composant de plus** : recopier la capsule pour
   * l'habiller autrement aurait donné deux dessins du même geste, qui auraient
   * divergé au premier ajustement — et c'est LUI qui aurait vu deux réponses à
   * la même question à deux écrans d'intervalle (`CLAUDE.md` §3). C'est ce que
   * fait déjà `ChampAdresse` avec son `apparence`.
   */
  apparence?: "capsule" | "reglage";
}) {
  const repere = `canal-${libelle.toLowerCase().includes("sms") ? "sms" : "email"}`;

  if (apparence === "reglage") {
    return (
      <button
        type="button"
        onClick={onClick}
        disabled={!disponible}
        aria-pressed={actif}
        data-atlas={repere}
        // Les mesures de la planche (`.b-envoi button`) : 14 px, aucun fond, et
        // l'actif porte un trait d'or SOUS le mot — 1,5 px, comme le marqueur
        // d'onglet de la barre du bas. La hauteur de 34 px est celle du doigt.
        className="min-h-[34px] rounded-[2px] px-[10px] py-1.5 text-[14px] leading-none disabled:opacity-40"
        style={{
          background: "none",
          color: actif ? colors.ink : colors.inkSoft,
          boxShadow: actif ? `inset 0 -1.5px 0 ${colors.or}` : "none",
        }}
      >
        {libelle}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!disponible}
      aria-pressed={actif}
      data-atlas={repere}
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
