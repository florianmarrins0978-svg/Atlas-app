/**
 * LES ICÔNES DE LA PAGE DU COMPTABLE — les tracés de la planche choisie le
 * 25 octobre 2026 (`appli/soignee/kit.js`, ICONES) : un trait, sans
 * remplissage, de la couleur du texte. Elles remplacent les caractères ✓ et ✕,
 * dont le dessin changeait d'une police à l'autre.
 *
 * Même forme que celle du dossier côté patron (`nom`, `taille`, `epaisseur`) :
 * les deux se réuniront sans que leurs appels changent.
 */
const TRACES = {
  coche: <path d="M5 12.5l4.5 4.5L19 7.5" />,
  croix: <path d="M6.5 6.5l11 11M17.5 6.5l-11 11" />,
  facture: (
    <>
      <path d="M6 3.5h12v17l-2-1.3-2 1.3-2-1.3-2 1.3-2-1.3-2 1.3z" />
      <path d="M9 8.5h6M9 12h6M9 15.5h3.5" />
    </>
  ),
  document: (
    <>
      <path d="M6.5 3.5H14l4 4v13H6.5z" />
      <path d="M14 3.5v4h4M9.5 12.5h5M9.5 16h5" />
    </>
  ),
  banque: <path d="M3.5 9.5L12 4.5l8.5 5M5.5 9.5v8M9.8 9.5v8M14.2 9.5v8M18.5 9.5v8M3.5 19.5h17" />,
  alerte: (
    <>
      <path d="M12 4l9 15.5H3z" />
      <path d="M12 10v4.5M12 17v.4" />
    </>
  ),
} as const;

export type NomIcone = keyof typeof TRACES;

export default function Icone({ nom, taille = 20, epaisseur = 1.75, className }: { nom: NomIcone; taille?: number; epaisseur?: number; className?: string }) {
  return (
    <svg
      width={taille}
      height={taille}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={epaisseur}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={`flex-none ${className ?? ""}`}
    >
      {TRACES[nom]}
    </svg>
  );
}
