/**
 * Un pictogramme filaire, dans la couleur de ce qui le porte (`currentColor`).
 *
 * **Pourquoi pas `IconeReglage`** (`src/app/reglages/icones.tsx`) : ses traits
 * sont toujours dorés, et les planches soignées du 26 octobre 2026
 * (`appli/soignee/reglages-*.html`) posent les pictogrammes dans des pastilles
 * au ton de ce qu'elles annoncent, vert pour Face ID posé, rouge pour la
 * sortie. Un trait doré sur une pastille verte dirait deux choses à la fois.
 *
 * C'est l'enveloppe, pas le dessin : `Picto` y verse les tracés du kit des
 * planches (`appli/soignee/kit.js`), et les écrans de « Moi » (Notifications,
 * Mot de passe, Double vérification, Couleurs) leurs tracés propres. Une seule
 * définition du trait, pour que deux pictogrammes voisins ne diffèrent jamais
 * par leur épaisseur ou leurs bouts.
 */
export default function Trace({
  children,
  taille = 22,
  epaisseur = 1.6,
}: {
  children: React.ReactNode;
  taille?: number;
  epaisseur?: number;
}) {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      width={taille}
      height={taille}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={epaisseur}
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ flex: "none" }}
    >
      {children}
    </svg>
  );
}
