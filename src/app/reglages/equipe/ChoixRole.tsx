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
 * revenu par la moitié de l'écran qu'on aurait oubliée. La planche du
 * 11 octobre 2026 arrive donc aux deux endroits à la fois, et c'est voulu.
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
   *  d'autre ne dit ce que ces pastilles règlent. */
  titre?: boolean;
  onChoisir: (role: Role) => void;
}) {
  const dit = ceQueLeRoleChange(valeur);

  return (
    <>
      {titre && (
        // **Sans filet.** Sa demande du 25 août 2026, capture à l'appui : *« ça
        // aussi tu peux retirer »* — le trait qui part du mot et file jusqu'au
        // bord. Il était revenu ici le 26, sur un écran neuf ;
        // `test-accueil-en-tete.ts` l'a repris. Les séparateurs de BLOCS, eux,
        // restent : *« ceux qui séparent les blocs, laisse-les »*.
        <p className={`mb-2.5 ${libelleCaps}`} style={{ color: colors.inkSoft }}>Son rôle</p>
      )}

      {/* **TROIS SUR UNE LIGNE, PATRON À PART — sa planche du 11 octobre 2026**
          (`appli/donner-un-acces-corrige.html`, version Corrigé). Le 2×2 du
          30 août mettait Patron au rang des trois autres ; or le choisir, c'est
          donner tout Atlas. Il est donc posé seul, dessous, et dit ce qu'il
          donne. L'ordre des trois reste celui de `ROLES`. */}
      <div className="grid grid-cols-3 gap-2">
        {ROLES.filter((r) => r !== "proprietaire").map((r) => (
          <Pastille key={r} role={r} choisi={r === valeur} inerte={inerte} onChoisir={onChoisir} />
        ))}
      </div>
      <Pastille
        role="proprietaire"
        choisi={valeur === "proprietaire"}
        inerte={inerte}
        onChoisir={onChoisir}
        dit="Tout, comme vous"
      />

      {/* **La liste SUIT le rôle choisi.** Trouvé sur la planche du 26 août,
          avant de la lui donner : elle montrait « Commercial » coché et, dessous,
          le périmètre du SALARIÉ. Un écran qui ment sur ce que fait un rôle est
          pire qu'un écran absent.

          **Deux colonnes, plus rien de barré** (planche du 11 octobre 2026) :
          une ligne barrée se lit comme une erreur effacée, pas comme un refus.
          Le droit porte un coche, le refus un cadenas. */}
      <div
        data-atlas="droits-du-role"
        className="mt-3.5 grid grid-cols-2 gap-3.5 rounded-2xl px-4 pb-1.5 pt-4"
        style={{ backgroundColor: colors.card }}
      >
        <div>
          <p className={TITRE_COLONNE} style={{ color: colors.inkSoft }}>Pourra</p>
          <ul>
            {dit.peut.map((l) => (
              <li key={l} className={LIGNE} style={{ color: colors.ink }}>
                <svg
                  aria-hidden="true"
                  viewBox="0 0 24 24"
                  className={PICTO}
                  style={{ ...TRAIT, stroke: colors.rust, strokeWidth: 1.8 }}
                >
                  <path d="m5 13 4.5 4.5L19 7" />
                </svg>
                {l}
              </li>
            ))}
          </ul>
        </div>
        <div className="border-l pl-3.5" style={{ borderColor: colors.line }}>
          <p className={TITRE_COLONNE} style={{ color: colors.inkSoft }}>Ne pourra pas</p>
          {dit.nonPlus.length > 0 ? (
            <ul>
              {dit.nonPlus.map((l) => (
                <li key={l} className={LIGNE} style={{ color: colors.inkSoft }}>
                  <svg
                    aria-hidden="true"
                    viewBox="0 0 24 24"
                    className={PICTO}
                    style={{ ...TRAIT, stroke: colors.inkSoft, strokeWidth: 1.7 }}
                  >
                    <rect x="5" y="11" width="14" height="9" rx="2" />
                    <path d="M8 11V8a4 4 0 0 1 8 0v3" />
                  </svg>
                  {l}
                </li>
              ))}
            </ul>
          ) : (
            <p className="mb-2 text-[13.5px]" style={{ color: colors.inkSoft }}>Rien ne lui est fermé.</p>
          )}
        </div>
      </div>
    </>
  );
}

const TITRE_COLONNE = "mb-2 text-[9.5px] font-medium uppercase tracking-[0.28em]";
const LIGNE = "relative mb-2 pl-5 text-[13.5px] leading-[1.4]";
const PICTO = "absolute left-0 top-[2px] h-[14px] w-[14px]";
const TRAIT = { fill: "none", strokeLinecap: "round", strokeLinejoin: "round" } as const;

/**
 * Une pastille de rôle : teintée et cochée quand elle est choisie, jamais
 * pleine. C'est un ÉTAT, et le plein est réservé au geste qui crée le compte
 * (sa capture du 26 août, en tête de ce fichier). `dit`, que seul Patron porte,
 * s'écrit à droite de la pastille.
 */
function Pastille({
  role,
  choisi,
  inerte,
  onChoisir,
  dit,
}: {
  role: Role;
  choisi: boolean;
  inerte: boolean;
  onChoisir: (role: Role) => void;
  dit?: string;
}) {
  return (
    <button
      type="button"
      disabled={inerte}
      onClick={() => !choisi && onChoisir(role)}
      aria-pressed={choisi}
      className={`flex items-center gap-1.5 rounded-full py-2.5 text-[12.5px] ${
        dit ? "mt-2 w-full justify-between px-4 text-left" : "justify-center px-1"
      }`}
      style={
        choisi
          ? { backgroundColor: colors.rustTint, color: colors.ink, fontWeight: 600, border: "1px solid transparent" }
          : { border: `1px solid ${colors.line}`, color: colors.muted }
      }
    >
      <span className="flex items-center gap-1.5">
        {/* Le coche dit « celui-là », sans avoir à comparer les fonds. Il est en
            or : il se voit sur les sept chartes, le fond teinté bouge de l'une
            à l'autre. */}
        {choisi && (
          <svg
            aria-hidden="true"
            viewBox="0 0 24 24"
            className="h-[13px] w-[13px] flex-none"
            style={{ ...TRAIT, stroke: colors.or, strokeWidth: 2.2 }}
          >
            <path d="m5 13 4.5 4.5L19 7" />
          </svg>
        )}
        {libelleRole(role)}
      </span>
      {dit && (
        <span className="font-normal" style={{ color: colors.muted }}>
          {dit}
        </span>
      )}
    </button>
  );
}
