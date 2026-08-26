"use client";

import { colors, libelleCaps } from "@/lib/design-tokens";
import { ROLES, ceQueLeRoleChange, libelleRole, type Role } from "@/lib/acces-roles";

/**
 * LE RÔLE, ET CE QU'IL CHANGE — dessiné UNE fois, employé aux deux endroits.
 *
 * ───────────────────────────────────────────────────────────────────────────
 * **CE QUE SA CAPTURE DU 26 AOÛT 2026 A CORRIGÉ.**
 *
 * *« Pour valider un compte c'est pas clair, la case est déjà noire comme la
 * catégorie salarié, on comprend pas bien. »*
 *
 * La pastille du rôle CHOISI était noire pleine — exactement comme le bouton
 * qui crée le compte, juste en dessous. Deux aplats noirs côte à côte, l'un qui
 * règle un état et l'autre qui déclenche une action : rien ne disait lequel
 * faisait quoi.
 *
 * **La charte le disait déjà, et on ne l'avait pas suivie** : le plein porte ce
 * qu'on FAIT, jamais ce qu'on LIT (`design-tokens.ts`). Un rôle n'est pas une
 * action, c'est un état. Il se marque donc d'un fond teinté et d'un coche — et
 * le plein redevient ce qu'il n'aurait jamais dû cesser d'être : LE bouton de
 * l'écran, et le seul.
 *
 * ───────────────────────────────────────────────────────────────────────────
 * **POURQUOI UN COMPOSANT, ET PAS DEUX FOIS LE MÊME BLOC.**
 *
 * Le même choix se fait à deux endroits : quand on crée un compte, et quand on
 * change le rôle de quelqu'un qui en a déjà un. Deux rédactions divergeraient
 * (`CLAUDE.md` §3), et ici la divergence se lirait ainsi — la pastille teintée
 * d'un côté, noire de l'autre, c'est-à-dire le défaut qu'il vient de signaler,
 * revenu par la moitié de l'écran qu'on aurait oubliée.
 *
 * **Les phrases viennent de `acces-roles.ts`**, avec la règle qu'elles
 * décrivent. Écrites ici, elles auraient vieilli à la première restriction
 * déplacée — et une promesse fausse sur un écran d'accès est pire que pas
 * d'écran du tout : le patron croirait avoir fermé.
 */
export default function ChoixRole({
  valeur,
  inerte = false,
  titre = false,
  onChoisir,
}: {
  valeur: Role;
  inerte?: boolean;
  /** Le libellé « SON RÔLE » au-dessus. Utile sur l'écran de création, où rien
   *  d'autre ne dit ce que ces trois pastilles règlent. */
  titre?: boolean;
  onChoisir: (role: Role) => void;
}) {
  const dit = ceQueLeRoleChange(valeur);

  return (
    <>
      {titre && (
        // **Aucun filet au bout d'un intertitre** — sa demande du 25 août 2026.
        // Celui-ci avait survécu au retrait : le contrôle
        // (`scripts/test-accueil-en-tete.ts`) le dénonçait sur `main`, et il
        // avait raison. Seuls les séparateurs de blocs restent.
        <p className={`mb-2 ${libelleCaps}`} style={{ color: colors.muted }}>
          Son rôle
        </p>
      )}

      <div className="flex gap-2">
        {ROLES.map((r) => {
          const choisi = r === valeur;
          return (
            <button
              key={r}
              type="button"
              disabled={inerte}
              onClick={() => !choisi && onChoisir(r)}
              aria-pressed={choisi}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-full py-2.5 text-[12.5px]"
              style={
                choisi
                  ? {
                      // Teinté, jamais plein : c'est un ÉTAT. Le plein est réservé
                      // au geste qui crée le compte.
                      backgroundColor: colors.rustTint,
                      color: colors.ink,
                      fontWeight: 600,
                      border: "1px solid transparent",
                    }
                  : { border: `1px solid ${colors.line}`, color: colors.muted }
              }
            >
              {/* Le coche dit « celui-là », sans avoir à comparer trois fonds.
                  Il est en or : c'est ce qu'on LIT, et il se voit sur les sept
                  chartes — le fond teinté, lui, bouge d'une charte à l'autre. */}
              {choisi && (
                <svg
                  aria-hidden="true"
                  viewBox="0 0 24 24"
                  className="h-[13px] w-[13px]"
                  style={{ fill: "none", stroke: colors.or, strokeWidth: 2.2, strokeLinecap: "round", strokeLinejoin: "round" }}
                >
                  <path d="m5 13 4.5 4.5L19 7" />
                </svg>
              )}
              {libelleRole(r)}
            </button>
          );
        })}
      </div>

      {/* **La liste SUIT le rôle choisi.** Trouvé sur la planche même, avant de
          la lui donner : elle montrait « Commercial » coché et, dessous, le
          périmètre du SALARIÉ. Une maquette — ou un écran — qui ment sur ce que
          fait un rôle est pire qu'un écran absent : il aurait choisi
          « Commercial » en lisant « le planning et rien d'autre ». */}
      <ul className="mt-3 space-y-1">
        {dit.peut.map((l) => (
          <li key={l} className="relative pl-4 text-[12.5px]" style={{ color: colors.ink }}>
            <i
              className="absolute left-0.5 top-[9px] block h-1 w-1 rounded-full"
              style={{ backgroundColor: colors.or }}
            />
            {l}
          </li>
        ))}
        {dit.nonPlus.map((l) => (
          <li key={l} className="relative pl-4 text-[12.5px] line-through" style={{ color: colors.muted }}>
            <i
              className="absolute left-0.5 top-[9px] block h-1 w-1 rounded-full"
              style={{ backgroundColor: colors.line }}
            />
            {l}
          </li>
        ))}
      </ul>
    </>
  );
}
