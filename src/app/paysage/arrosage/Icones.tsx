/**
 * Les dessins des gestes du plan d'arrosage, d'après sa planche soignée du
 * 26 octobre 2026 (`appli/soignee/arrosage.html`, `kit.js`) : un seul trait
 * (1,75 sur une grille de 24), la couleur de ce qui les porte.
 */
const TRACES = {
  photo: (
    <>
      <rect x="3.5" y="6.5" width="17" height="13" rx="2" />
      <path d="M8.5 6.5L10 4h4l1.5 2.5" />
      <circle cx="12" cy="13" r="3.5" />
    </>
  ),
  crayon: (
    <>
      <path d="M4.5 19.5l1-4.3L15.6 5.1a2.1 2.1 0 0 1 3 3L8.5 18.5z" />
      <path d="M13.5 7.2l3 3" />
    </>
  ),
  bas: <path d="M5.5 9l6.5 6.5L18.5 9" />,
  envoyer: (
    <>
      <path d="M20.5 3.5l-17 7 7 3 3 7z" />
      <path d="M10.5 13.5l10-10" />
    </>
  ),
  etincelle: (
    <>
      <path d="M11 4l1.7 4.6L17.5 10l-4.8 1.6L11 16.5l-1.7-4.9L4.5 10l4.8-1.4z" />
      <path d="M18 14.5l.7 1.8 1.8.7-1.8.7-.7 1.8-.7-1.8-1.8-.7 1.8-.7z" />
    </>
  ),
  plus: <path d="M12 5v14M5 12h14" />,
  document: (
    <>
      <path d="M6.5 3.5H14l4 4v13H6.5z" />
      <path d="M14 3.5v4h4M9.5 12.5h5M9.5 16h5" />
    </>
  ),
} as const;

export type NomIcone = keyof typeof TRACES;

export default function Icone({ nom, taille = 22 }: { nom: NomIcone; taille?: number }) {
  return (
    <svg
      aria-hidden="true"
      width={taille}
      height={taille}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="flex-none"
    >
      {TRACES[nom]}
    </svg>
  );
}
