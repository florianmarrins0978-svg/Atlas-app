/**
 * Les pictogrammes du sommaire des réglages.
 *
 * **Ils viennent d'une planche que le patron a envoyée le 14 août 2026**, avec
 * ce seul mot : « c'est ça que je voulais ! ». Ses tracés sont recopiés de
 * `maquettes/atlas-reglages-sommaire.html`, et non redessinés à l'œil : deux
 * jeux de pictogrammes qui divergent, c'est un écran qui ne ressemble plus à ce
 * qu'il a validé.
 *
 * **Filaires, 22 px, épaisseur 1,4, EN OR.** Trois raisons, et aucune n'est
 * décorative :
 *
 *   - l'or porte ce qu'on LIT, le vert pin ce qu'on FAIT
 *     (`src/lib/design-tokens.ts`). Une icône ne se touche pas — c'est la ligne
 *     entière qui est la cible ; en vert, la liste serait treize boutons
 *     alignés, exactement l'aspect « tableau de bord » que le patron refuse ;
 *   - pleins ou plus épais, treize pictogrammes font une grille de couleurs et
 *     le regard ne trouve plus le mot qu'il cherche ;
 *   - à 22 px ils s'alignent sur la hauteur de capitale du titre en serif, sans
 *     déborder de la ligne.
 *
 * **Chacun est distinct, et cela se vérifie.** Dix pictogrammes recopiés
 * passeraient tous les contrôles d'une liste — complète, alignée, dorée — et
 * seraient parfaitement illisibles.
 */
import { colors } from "@/lib/design-tokens";

/** Le nom d'une icône. Ajouter une rubrique oblige à lui en donner une. */
export type NomIcone =
  | "compte"
  | "cloche"
  | "cadenas"
  | "contraste"
  | "immeuble"
  | "personnes"
  | "etiquette"
  | "feuille"
  | "liste_cochee"
  | "calendrier"
  | "etincelle"
  | "puzzle"
  | "couronne"
  | "bouclier";

const TRACES: Record<NomIcone, React.ReactNode> = {
  compte: (
    <>
      <circle cx="12" cy="8" r="3.6" />
      <path d="M4.8 20.5c0-3.7 3.2-5.8 7.2-5.8s7.2 2.1 7.2 5.8" />
    </>
  ),
  cloche: (
    <>
      <path d="M18 15.5V10a6 6 0 1 0-12 0v5.5L4.5 18h15z" />
      <path d="M10 20.4a2.2 2.2 0 0 0 4 0" />
    </>
  ),
  cadenas: (
    <>
      <rect x="5" y="10.5" width="14" height="10" rx="1.5" />
      <path d="M8 10.5V7.8a4 4 0 0 1 8 0v2.7" />
    </>
  ),
  contraste: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 3.5a8.5 8.5 0 0 0 0 17z" />
    </>
  ),
  immeuble: (
    <>
      <path d="M3.5 20.5V4.6a1 1 0 0 1 1-1H13a1 1 0 0 1 1 1v15.9" />
      <path d="M14 9.5h6a1 1 0 0 1 1 1v10" />
      <path d="M2.5 20.5h19" />
      <path d="M6.5 8h1M10 8h1M6.5 12h1M10 12h1M6.5 16h1M10 16h1M17 13.5h1M17 17h1" />
    </>
  ),
  personnes: (
    <>
      <circle cx="9" cy="8" r="3.2" />
      <path d="M2.8 19.8c0-3.3 2.8-5.2 6.2-5.2s6.2 1.9 6.2 5.2" />
      <path d="M16.2 5.7a3.2 3.2 0 0 1 0 6.2" />
      <path d="M17.6 14.3c2.1.6 3.6 2.2 3.6 4.6" />
    </>
  ),
  etiquette: (
    <>
      <path d="M3.2 11.4V4.2a1 1 0 0 1 1-1h7.2a1 1 0 0 1 .7.3l8.4 8.4a1 1 0 0 1 0 1.4l-7.2 7.2a1 1 0 0 1-1.4 0L3.5 12.1a1 1 0 0 1-.3-.7Z" />
      <circle cx="7.6" cy="7.6" r="1.3" />
    </>
  ),
  feuille: (
    <>
      <path d="M13.2 3H6.4A1.4 1.4 0 0 0 5 4.4v15.2A1.4 1.4 0 0 0 6.4 21h11.2a1.4 1.4 0 0 0 1.4-1.4V8.8z" />
      <path d="M13.2 3v5.8H19" />
      <path d="M8.4 13h7.2M8.4 16.6h5" />
    </>
  ),
  liste_cochee: (
    <>
      <path d="M4 6.5l1.8 1.8L9 5" />
      <path d="M4 12.5l1.8 1.8L9 9" />
      <path d="M4 18.5l1.8 1.8L9 15" />
      <path d="M12.5 7h7.5M12.5 13h7.5M12.5 19h5" />
    </>
  ),
  calendrier: (
    <>
      <rect x="3.5" y="5" width="17" height="15.5" rx="1.5" />
      <path d="M3.5 9.8h17" />
      <path d="M8 3.2v3.6M16 3.2v3.6" />
      <path d="M7.8 13.4h1.2M11.4 13.4h1.2M15 13.4h1.2M7.8 16.9h1.2M11.4 16.9h1.2" />
    </>
  ),
  etincelle: (
    <>
      <path d="M9.6 3.4 11.6 9l5.6 2-5.6 2-2 5.6-2-5.6L2 11l5.6-2z" />
      <path d="M18 3v3.8M16.1 4.9h3.8" />
    </>
  ),
  puzzle: (
    <path d="M9.2 3.6a2.1 2.1 0 0 1 4.2 0c0 .8-.5 1.2-.5 1.7 0 .5.4.8.9.8h2.6a1 1 0 0 1 1 1v2.7c0 .5.3.9.8.9.5 0 .9-.5 1.7-.5a2.1 2.1 0 0 1 0 4.2c-.8 0-1.2-.5-1.7-.5-.5 0-.8.4-.8.9V20a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7.1a1 1 0 0 1 1-1h2.8c.5 0 .9-.3.9-.8 0-.5-.5-.9-.5-1.7Z" />
  ),
  couronne: (
    <>
      <path d="M3.2 7.8 6.6 15.4h10.8l3.4-7.6-4.6 3-4.2-6.6-4.2 6.6z" />
      <path d="M6.6 18.8h10.8" />
    </>
  ),
  bouclier: (
    <>
      <path d="M12 3.2 5.2 5.9v5.3c0 4.2 2.8 7.9 6.8 9.1 4-1.2 6.8-4.9 6.8-9.1V5.9z" />
      <path d="M9.3 12.1l1.9 1.9 3.6-3.7" />
    </>
  ),
};

/**
 * L'icône d'une rubrique.
 *
 * `aria-hidden` : elle ne dit rien que le libellé ne dise déjà, et une lecture
 * à voix haute qui annoncerait « immeuble, mon entreprise » serait du bruit.
 */
export default function IconeReglage({ nom, eteinte = false }: { nom: NomIcone; eteinte?: boolean }) {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke={colors.or}
      strokeWidth="1.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      // Une rubrique qui n'existe pas encore garde son icône, en retrait : la
      // faire disparaître laisserait un trou dans la colonne, et l'œil lirait
      // la liste comme cassée.
      style={{ flex: "none", opacity: eteinte ? 0.45 : 1 }}
    >
      {TRACES[nom]}
    </svg>
  );
}
