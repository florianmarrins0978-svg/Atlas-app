"use client";

import { colors, smallCaps } from "@/lib/design-tokens";
import { CIVILITES, type Civilite, type CiviliteChoisie } from "@/lib/civilite";

/**
 * « Mr » / « Mme », deux pastilles au-dessus du nom.
 *
 * ───────────────────────────────────────────────────────────────────────────
 * **Le patron, le 13 août 2026 :** *« il faut intégrer une case
 * monsieur-madame. Mais je veux que ça soit sous la forme Mr Mme, en cliquable,
 * on choisit au-dessus du nom. »*
 *
 * Ce que ça répare : le matin même, l'application posait « Mr. » devant tout
 * patronyme nu — sur le devis, et surtout dans le message qui part chez le
 * client. Une cliente lisait donc « Bonjour Mr. Roux ». La civilité était un
 * DÉFAUT ; elle devient une donnée qu'il choisit.
 *
 * ── Trois décisions de dessin, et leur pourquoi ─────────────────────────────
 *
 * - **Rien n'est présélectionné.** Cocher « Mr » d'avance rendrait son silence
 *   indiscernable d'un choix, et remettrait en base la supposition qu'on vient
 *   justement de retirer. Tant qu'il n'a rien touché, l'affichage garde la
 *   règle d'avant — c'est ce qui fait que ses clients existants ne changent pas
 *   d'apparence du jour au lendemain.
 * - **Un second appui DÉSÉLECTIONNE.** Sans cela, une pastille touchée par
 *   erreur ne se reprend plus : il n'existe aucun troisième bouton « ni l'un ni
 *   l'autre » — ce serait trois pastilles là où il en a demandé deux — et la
 *   société est très exactement ce cas-là.
 * - **La capsule, comme partout ailleurs** (`ARCHITECTURE.md` §67). Ce sont des
 *   boutons : ils prennent la forme des boutons, sans quoi le contrôle
 *   `test-boutons-arrondis` les refuserait — et il aurait raison.
 *
 * `aria-pressed` plutôt qu'un groupe de boutons radio : deux états, pris et
 * repris, c'est ce que ce rôle décrit. Un lecteur d'écran annonce alors
 * « Mme, non pressé » plutôt qu'un choix obligatoire qui n'existe pas.
 */
export default function ChoixCivilite({
  valeur,
  onChange,
  fige = false,
  sansLegende = false,
}: {
  valeur: CiviliteChoisie;
  onChange: (v: Civilite | null) => void;
  /** Un devis parti ne se modifie plus : les pastilles s'affichent, éteintes. */
  fige?: boolean;
  /**
   * **Sur l'écran du devis, l'étiquette s'efface** — vu en capture le 13 août
   * 2026, et c'est le genre de défaut qu'aucun contrôle ne dit. Cet écran est
   * « à l'image du papier » : tous ses champs sont nus, sans libellé, pour
   * qu'il se lise comme le document qui sortira. Une étiquette en petites
   * capitales au milieu du bloc « Client » y ressemble à un formulaire collé
   * sur une lettre.
   *
   * Le groupe garde son nom pour qui n'écoute pas l'écran : `aria-label`
   * remplace la légende, il n'y a pas de trou d'accessibilité.
   */
  sansLegende?: boolean;
}) {
  return (
    <fieldset
      className={sansLegende ? "flex flex-col" : "flex flex-col gap-1.5"}
      aria-label={sansLegende ? "Civilité du client" : undefined}
    >
      {!sansLegende && (
        <legend className={smallCaps} style={{ color: colors.muted }}>
          Civilité (facultatif)
        </legend>
      )}
      <div className={sansLegende ? "flex gap-2 pb-1.5" : "flex gap-2"}>
        {(Object.keys(CIVILITES) as Civilite[]).map((cle) => {
          const actif = valeur === cle;
          return (
            <button
              key={cle}
              type="button"
              disabled={fige}
              aria-pressed={actif}
              data-atlas={`civilite-${cle}`}
              // Un second appui rend le choix : voir l'en-tête.
              onClick={() => onChange(actif ? null : cle)}
              className="rounded-full px-6 py-2.5 text-[15px] font-medium disabled:opacity-50"
              style={{
                backgroundColor: actif ? colors.rustTint : colors.card,
                color: actif ? colors.rust : colors.ink,
                // Le contour signale le choix sans compter sur la seule couleur
                // — un fond teinté seul se perd au soleil, sur un chantier.
                boxShadow: actif ? `inset 0 0 0 1px ${colors.rust}` : "none",
              }}
            >
              {/* « Mr », sans point, comme il l'a écrit. Le point n'apparaît
                  que devant le nom (`CIVILITES`), là où il se lit comme une
                  abréviation et non comme une étiquette. */}
              {cle === "mr" ? "Mr" : "Mme"}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}
