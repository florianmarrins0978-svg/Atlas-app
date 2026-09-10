import { charte, variablesCharte } from "@/lib/chartes";

/**
 * LA PORTE, EN NUIT — le fond commun des deux écrans qu'on voit avant d'entrer.
 *
 * Écrans 2 et 3 de `appli/la-porte-en-plein-air.html`, choisis le 8 septembre
 * 2026 : la création de compte ET la connexion y sont **sombres**.
 *
 * **POURQUOI CETTE PIÈCE EXISTE.** La nuit avait été posée à la main dans
 * `creer-un-compte/page.tsx` et nulle part ailleurs : la connexion, l'autre
 * moitié de la même porte, était restée en crème. Deux écrans jumeaux dont un
 * seul portait la règle, c'est la divergence que `CLAUDE.md` §3 refuse — et
 * c'est le patron qui l'a vue, le 10 septembre 2026 : *« toi tu me montres un
 * écran blanc, regarde la photo, elle est noire, c'est celle-là que je veux »*.
 *
 * **POURQUOI ON POSE LES VARIABLES DE LA CHARTE, ET NON DES COULEURS.** Ici
 * personne n'est connu : `layout.tsx` n'a aucune charte à lire et retombe donc
 * sur Origine, qui est claire. En réécrivant les `--atlas-*` sur ce conteneur,
 * **tout ce qui est dedans devient nuit sans qu'on y touche** — les jetons de
 * `design-tokens.ts` sont déjà des `var(--atlas-…)`, et `.atlas-champ-gelule`
 * comme `.atlas-plein` lisent les mêmes. Recopier des couleurs écran par écran
 * aurait fait vivre huit chartes et demie.
 *
 * La charte est **nommée** plutôt que choisie : c'est la seule des huit qui
 * corresponde à la planche, et rien à cet instant ne permet d'en préférer une.
 */
const NUIT_CHARTE = charte("nuit");

export const NUIT = NUIT_CHARTE.jetons;

/**
 * Le dégradé de la planche, avec les valeurs du produit — pas les siennes.
 *
 * **Le premier arrêt est un halo CHAUD, et il compte.** La planche y pose un
 * brun doré (#3a2f18) ; `rustTint` (#1f211e) est presque neutre, et la porte
 * paraissait alors éteinte à côté de sa photo. Plutôt que de recopier sa
 * valeur — ce serait une neuvième charte —, on **mélange l'or de la charte à
 * la carte** : #B98B47 à 22 % sur #1a1d19 tombe à un cheveu de son brun, et
 * suivrait l'or si celui-ci changeait un jour.
 */
const HALO = `color-mix(in srgb, ${NUIT.or} 22%, ${NUIT.card})`;
const FOND = `radial-gradient(120% 62% at 8% 4%, ${HALO} 0%, ${NUIT.card} 40%, ${NUIT.cream} 78%)`;

export const SERIF = { fontFamily: "ui-serif, Georgia, serif" } as const;

/** La gélule sombre : champs, Google, Apple, Face ID. Une seule définition. */
export const CHAMP = {
  background: NUIT.card,
  color: NUIT.ink,
  boxShadow: `inset 0 0 0 1px ${NUIT.line}`,
} as const;

export default function PorteDeNuit({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      /**
       * `atlas-charte-locale` fait suivre les alias de `globals.css`
       * (`--ink`, `--card`, `--line`, `--or`…) à la charte posée ici. Sans
       * elle, ils gardent la valeur calculée à la racine — donc le repli
       * CLAIR — et l'on obtient un fond de nuit avec des champs crème.
       */
      className={["atlas-charte-locale", className].filter(Boolean).join(" ")}
      style={
        {
          ...variablesCharte(NUIT_CHARTE),
          background: FOND,
          color: NUIT.ink,
        } as React.CSSProperties
      }
    >
      {children}
    </div>
  );
}
