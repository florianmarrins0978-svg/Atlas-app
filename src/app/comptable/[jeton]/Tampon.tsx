import { texteDuTampon, type Conclusion } from "@/lib/attestation-comptable";

/**
 * LE TAMPON DU CABINET — sa planche du 27 octobre 2026. Le nom du cabinet en
 * haut du cercle, la conclusion au centre, la date en bas : le texte sort de
 * `texteDuTampon`, le même que celui que le PDF imprime.
 *
 * Les deux arcs portent un identifiant propre à l'instance : deux tampons sur
 * la même page (l'attestation, puis l'écran « envoyée ») ne doivent pas se
 * prendre le chemin l'un de l'autre.
 */
export default function Tampon({
  conclusion,
  societe,
  jour,
  couleur,
  taille,
  id,
  className,
}: {
  conclusion: Conclusion;
  societe: string;
  jour: string;
  couleur: string;
  taille: number;
  id: string;
  className?: string;
}) {
  const t = texteDuTampon(conclusion, societe, jour);
  // Un cabinet au nom long se resserre sur son arc plutôt que d'en faire le tour.
  const serre = t.haut.length > 22 ? { textLength: 128, lengthAdjust: "spacingAndGlyphs" as const } : {};
  return (
    <svg viewBox="0 0 120 120" width={taille} height={taille} aria-hidden="true" className={className} style={{ color: couleur }}>
      <defs>
        <path id={`${id}-haut`} d="M 13 60 A 47 47 0 0 1 107 60" />
        <path id={`${id}-bas`} d="M 7.5 60 A 52.5 52.5 0 0 0 112.5 60" />
      </defs>
      <circle cx="60" cy="60" r="57" fill="none" stroke="currentColor" strokeWidth="2.4" />
      <circle cx="60" cy="60" r="38.5" fill="none" stroke="currentColor" strokeWidth="1.1" />
      <g fill="currentColor" fontWeight={700} style={{ fontFamily: "var(--font-body)" }}>
        <text fontSize="7.5" letterSpacing="0.7">
          <textPath href={`#${id}-haut`} startOffset="50%" textAnchor="middle" {...serre}>
            {t.haut}
          </textPath>
        </text>
        <text fontSize="7" letterSpacing="1.1">
          <textPath href={`#${id}-bas`} startOffset="50%" textAnchor="middle">
            {t.bas}
          </textPath>
        </text>
        {t.centre.length === 1 ? (
          <text x="60" y="64" textAnchor="middle" fontSize="10.5" letterSpacing="0.6">
            {t.centre[0]}
          </text>
        ) : t.centre[0] === "NON" ? (
          <>
            <text x="60" y="56" textAnchor="middle" fontSize="8.5" letterSpacing="1.2">
              {t.centre[0]}
            </text>
            <text x="60" y="68.5" textAnchor="middle" fontSize="10.5" letterSpacing="0.6">
              {t.centre[1]}
            </text>
          </>
        ) : (
          <>
            <text x="60" y="59" textAnchor="middle" fontSize="10.5" letterSpacing="0.6">
              {t.centre[0]}
            </text>
            <text x="60" y="70" textAnchor="middle" fontSize="6.6" letterSpacing="0.7">
              {t.centre[1]}
            </text>
          </>
        )}
      </g>
    </svg>
  );
}
