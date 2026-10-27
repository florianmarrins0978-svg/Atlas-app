"use client";

import { colors } from "@/lib/design-tokens";
import { ROLES, ceQueLeRoleChange, libelleRole, type Role } from "@/lib/acces-roles";
import CocheRonde from "@/components/atlas/reglages/CocheRonde";
import Paquet from "@/components/atlas/reglages/Paquet";
import Picto from "@/components/atlas/reglages/Picto";

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
 * 11 octobre 2026 arrive donc aux deux endroits à la fois, et c'est voulu, comme
 * celle des Réglages soignés le 26 octobre (`appli/soignee/reglages-equipe.html`).
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
  /** Le titre doré « Son rôle » au-dessus, dans son paquet. Utile sur l'écran
   *  de création, où rien d'autre ne dit ce que ces cartes règlent. */
  titre?: boolean;
  onChoisir: (role: Role) => void;
}) {
  const dit = ceQueLeRoleChange(valeur);

  const contenu = (
    <>
      {/* **TROIS SUR UNE LIGNE, PATRON À PART — sa planche du 11 octobre 2026**
          (`appli/donner-un-acces-corrige.html`, version Corrigé). Le 2×2 du
          30 août mettait Patron au rang des trois autres ; or le choisir, c'est
          donner tout Atlas. Il est donc posé seul, dessous, et dit ce qu'il
          donne. L'ordre des trois reste celui de `ROLES`.

          **Des cartes, et non plus des pilules** (planche du 26 octobre) : la
          coche ronde au-dessus du mot, comme les choix de Mon entreprise. Le
          choix pris se cerne de l'encre d'action et se teinte, jamais plein. */}
      <div className="grid grid-cols-3 gap-2">
        {ROLES.filter((r) => r !== "proprietaire").map((r) => (
          <CarteRole key={r} role={r} choisi={r === valeur} inerte={inerte} onChoisir={onChoisir} />
        ))}
      </div>
      <CarteRole
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

          **Plus rien de barré** (planche du 11 octobre 2026) : une ligne barrée
          se lit comme une erreur effacée, pas comme un refus. Le droit porte un
          coche, le refus un cadenas.

          **L'une sous l'autre, en 15 px** (planche du 26 octobre) : « Pourra »
          sur une plage verte, la couleur de ce qui marche ; « Ne pourra pas »
          sur la plage claire. Deux colonnes de 13,5 px se déchiffraient. */}
      <div data-atlas="droits-du-role" className="mt-3 grid gap-2">
        <div className="rounded-[6px] px-4 pb-2 pt-3.5" style={{ backgroundColor: colors.carteVertFond }}>
          <p className={TITRE_COLONNE} style={{ color: colors.carteVertTexte }}>Pourra</p>
          <ul>
            {dit.peut.map((l) => (
              <li key={l} className={LIGNE} style={{ color: colors.ink }}>
                <span className={PICTO} style={{ color: colors.carteVertTexte }}>
                  <Picto nom="coche" taille={18} epaisseur={2.4} />
                </span>
                {l}
              </li>
            ))}
          </ul>
        </div>
        <div className="rounded-[6px] px-4 pb-2 pt-3.5" style={{ backgroundColor: colors.card }}>
          <p className={TITRE_COLONNE} style={{ color: colors.inkSoft }}>Ne pourra pas</p>
          {dit.nonPlus.length > 0 ? (
            <ul>
              {dit.nonPlus.map((l) => (
                <li key={l} className={LIGNE} style={{ color: colors.inkSoft }}>
                  <span className={PICTO} style={{ color: colors.inkSoft }}>
                    <Picto nom="cadenas" taille={18} />
                  </span>
                  {l}
                </li>
              ))}
            </ul>
          ) : (
            <p className="mb-2 text-[15px]" style={{ color: colors.inkSoft }}>Rien ne lui est fermé.</p>
          )}
        </div>
      </div>
    </>
  );

  // **Sans filet sous le titre.** Sa demande du 25 août 2026, capture à
  // l'appui : *« ça aussi tu peux retirer »* — le trait qui part du mot et file
  // jusqu'au bord. Le titre du paquet n'en porte pas.
  return titre ? (
    <Paquet titre="Son rôle" sansPlage>
      {contenu}
    </Paquet>
  ) : (
    contenu
  );
}

const TITRE_COLONNE = "mb-1.5 text-[14px] font-bold";
const LIGNE = "relative pb-[7px] pl-[27px] pt-0.5 text-[15px] leading-[1.4]";
const PICTO = "absolute left-0 top-[3px]";

/**
 * Une carte de rôle : teintée, cernée et cochée quand elle est choisie, jamais
 * pleine. C'est un ÉTAT, et le plein est réservé au geste qui crée le compte
 * (sa capture du 26 août, en tête de ce fichier). `dit`, que seul Patron porte,
 * s'écrit à droite de la carte.
 *
 * **La coche est en or** : elle se voit sur les sept chartes, le fond teinté
 * bouge de l'une à l'autre.
 */
function CarteRole({
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
      data-atlas={`carte-role-${role}`}
      className={`flex rounded-[14px] text-[15px] font-semibold transition-shadow duration-200 ${
        dit
          ? "mt-2 min-h-[56px] w-full flex-row items-center gap-3 px-4 text-left"
          : "min-h-[80px] min-w-0 flex-col items-center justify-center gap-2 px-1 py-2.5"
      }`}
      style={
        choisi
          ? { backgroundColor: colors.rustTint, color: colors.ink, boxShadow: `inset 0 0 0 2px ${colors.rust}` }
          : { backgroundColor: colors.card, color: colors.inkSoft, boxShadow: `inset 0 0 0 1px ${colors.line}` }
      }
    >
      <CocheRonde pris={choisi} />
      {libelleRole(role)}
      {dit && (
        <span className="ml-auto text-[14.5px] font-normal" style={{ color: colors.inkSoft }}>
          {dit}
        </span>
      )}
    </button>
  );
}
