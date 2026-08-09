/**
 * La branche d'eucalyptus qui déborde en haut à droite de l'écran d'accueil.
 *
 * **Dessinée, jamais importée.** Une photo détourée pèserait des centaines de
 * kilo-octets, s'afficherait floue sur un écran dense et ferait clignoter la
 * page le temps de son chargement. Ici : quelques centaines d'octets dans le
 * HTML, nets à toutes les tailles, et rien à télécharger — donc aucune
 * dépendance extérieure à casser un jour.
 *
 * **Une seule feuille, replacée onze fois.** La forme est définie une fois dans
 * `<defs>` puis rappelée par `<use>` avec une rotation et une échelle. C'est ce
 * qui garde le fichier lisible : corriger la feuille les corrige toutes.
 *
 * Elle est **décorative et rien d'autre** : `aria-hidden`, aucun texte, et
 * placée sous le contenu (`z-index`) pour ne jamais intercepter un doigt.
 * L'opacité reste basse — sur un écran qu'on ouvre vingt fois par jour, un
 * ornement qui se remarque finit par gêner.
 */
export default function BrancheEucalyptus({
  largeur = 300,
  opacite = 0.3,
}: {
  largeur?: number;
  opacite?: number;
}) {
  return (
    <svg
      viewBox="0 0 300 260"
      width={largeur}
      height={largeur * (260 / 300)}
      fill="none"
      aria-hidden="true"
      focusable="false"
      style={{ opacity: opacite }}
    >
      <defs>
        <path id="atlas-foliole" d="M0 0C9-11 27-13 38 0 27 13 9 11 0 0Z" />
        <linearGradient id="atlas-feuillage" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#93a98a" />
          <stop offset="1" stopColor="#6d8465" />
        </linearGradient>
      </defs>

      {/* Les tiges : une maîtresse, deux ramifications. */}
      <g stroke="#7d9070" strokeWidth="1.1" strokeLinecap="round" opacity="0.8">
        <path d="M262 4C230 44 199 95 179 147c-11 29-17 55-19 79" />
        <path d="M216 76c-19 9-38 21-54 36" />
        <path d="M198 120c-22 3-44 11-63 24" />
      </g>

      <g fill="url(#atlas-feuillage)">
        <use href="#atlas-foliole" transform="translate(252 12) rotate(-38) scale(0.65)" />
        <use href="#atlas-foliole" transform="translate(270 38) rotate(18) scale(0.57)" />
        <use href="#atlas-foliole" transform="translate(230 50) rotate(-52) scale(0.69)" />
        <use href="#atlas-foliole" transform="translate(248 80) rotate(12) scale(0.62)" />
        <use href="#atlas-foliole" transform="translate(208 98) rotate(-46) scale(0.66)" />
        <use href="#atlas-foliole" transform="translate(224 130) rotate(20) scale(0.59)" />
        <use href="#atlas-foliole" transform="translate(162 116) rotate(-160) scale(0.63)" />
        <use href="#atlas-foliole" transform="translate(188 168) rotate(28) scale(0.67)" />
        <use href="#atlas-foliole" transform="translate(138 164) rotate(-152) scale(0.61)" />
        <use href="#atlas-foliole" transform="translate(168 208) rotate(46) scale(0.56)" />
        <use href="#atlas-foliole" transform="translate(124 212) rotate(-124) scale(0.53)" />
      </g>
    </svg>
  );
}
