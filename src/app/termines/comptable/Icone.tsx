/**
 * LES ICÔNES DU DOSSIER — les tracés de la planche choisie le 25 octobre 2026
 * (`appli/soignee/kit.js`, la même grammaire : un trait, sans remplissage, de
 * la couleur du texte). Elles disent la nature d'un geste ; aucune ne décore.
 */
const TRACES = {
  alerte: <><path d="M12 4l9 15.5H3z" /><path d="M12 10v4.5M12 17v.4" /></>,
  coche: <path d="M5 12.5l4.5 4.5L19 7.5" />,
  facture: <><path d="M6 3.5h12v17l-2-1.3-2 1.3-2-1.3-2 1.3-2-1.3-2 1.3z" /><path d="M9 8.5h6M9 12h6M9 15.5h3.5" /></>,
  photo: <><rect x="3.5" y="6.5" width="17" height="13" rx="2" /><path d="M8.5 6.5L10 4h4l1.5 2.5" /><circle cx="12" cy="13" r="3.5" /></>,
  cadenas: <><rect x="5" y="10.5" width="14" height="10" rx="2" /><path d="M8 10.5V8a4 4 0 0 1 8 0v2.5" /></>,
  banque: <path d="M3.5 9.5L12 4.5l8.5 5M5.5 9.5v8M9.8 9.5v8M14.2 9.5v8M18.5 9.5v8M3.5 19.5h17" />,
  document: <><path d="M6.5 3.5H14l4 4v13H6.5z" /><path d="M14 3.5v4h4M9.5 12.5h5M9.5 16h5" /></>,
  suivant: <path d="M9 5l7 7-7 7" />,
  sablier: <path d="M7 3.5h10M7 20.5h10M8 3.5c0 5 8 5 8 8.5s-8 3.5-8 8.5M16 3.5c0 5-8 5-8 8.5" />,
  scanner: <path d="M4 8V5.5A1.5 1.5 0 0 1 5.5 4H8M16 4h2.5A1.5 1.5 0 0 1 20 5.5V8M20 16v2.5a1.5 1.5 0 0 1-1.5 1.5H16M8 20H5.5A1.5 1.5 0 0 1 4 18.5V16M7 12h10" />,
  retour: <path d="M15 5l-7 7 7 7" />,
  plus: <path d="M12 5v14M5 12h14" />,
  envoyer: <><path d="M20.5 3.5l-17 7 7 3 3 7z" /><path d="M10.5 13.5l10-10" /></>,
  telecharger: <path d="M12 4v11M7.5 10.5L12 15l4.5-4.5M5 19.5h14" />,
  info: <><circle cx="12" cy="12" r="8.5" /><path d="M12 11v5.5M12 7.8v.4" /></>,
  annuler: <><path d="M9 6.5L4.5 11 9 15.5" /><path d="M4.5 11H15a5 5 0 0 1 0 10h-2.5" /></>,
  copier: <><rect x="8" y="8" width="12" height="12" rx="2" /><path d="M16 8V5.5A1.5 1.5 0 0 0 14.5 4h-9A1.5 1.5 0 0 0 4 5.5v9A1.5 1.5 0 0 0 5.5 16H8" /></>,
  email: <><rect x="3.5" y="5.5" width="17" height="13" rx="2" /><path d="M4 7l8 6 8-6" /></>,
  oeil: <><path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z" /><circle cx="12" cy="12" r="3" /></>,
} as const;

export type NomIcone = keyof typeof TRACES;

export default function Icone({ nom, taille = 20, epaisseur = 1.6, className }: { nom: NomIcone; taille?: number; epaisseur?: number; className?: string }) {
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
