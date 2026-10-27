import Trace from "./Trace";

/**
 * Les pictogrammes des Réglages soignés, recopiés de la boîte des planches
 * (`appli/soignee/kit.js`, `ICONES`, dans son ordre) et non redessinés à
 * l'œil : c'est la planche qu'il a regardée le 25 et le 26 octobre 2026.
 *
 * **Un seul jeu pour tous les écrans.** Sept écrans en avaient chacun un,
 * écrit à part ; les tracés concordaient encore, mais rien ne les y tenait, et
 * le premier coup de crayon sur l'un aurait fait deux cadenas dans la même
 * application. Un nom absent se dessine ici, depuis le kit, jamais dans
 * l'écran qui en a besoin.
 *
 * **Le trait suit `currentColor`** (`Trace`) : posé dans une `PastilleIcone`
 * verte, le micro passe au vert de la pastille ; devant « Ajouter un tarif »,
 * le plus prend l'or du mot ; le camion d'une ligne prend la couleur de son
 * état.
 */
export type NomPicto =
  | "suivant"
  | "bas"
  | "plus"
  | "moins"
  | "croix"
  | "coche"
  | "micro"
  | "calendrier"
  | "lieu"
  | "telephone"
  | "document"
  | "facture"
  | "vehicule"
  | "cadenas"
  | "crayon"
  | "photo"
  | "envoyer"
  | "telecharger"
  | "importer"
  | "banque"
  | "carte"
  | "entreprise"
  | "etiquette"
  | "etincelle"
  | "couronne"
  | "alerte"
  | "liste"
  | "annuler"
  | "note"
  | "oeil"
  | "carton"
  | "scanner";

const TRACES: Record<NomPicto, React.ReactNode> = {
  suivant: <path d="M9 5l7 7-7 7" />,
  bas: <path d="M5.5 9l6.5 6.5L18.5 9" />,
  plus: <path d="M12 5v14M5 12h14" />,
  moins: <path d="M5 12h14" />,
  croix: <path d="M6.5 6.5l11 11M17.5 6.5l-11 11" />,
  coche: <path d="M5 12.5l4.5 4.5L19 7.5" />,
  micro: (
    <>
      <rect x="9" y="3" width="6" height="11" rx="3" />
      <path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21M8.5 21h7" />
    </>
  ),
  calendrier: (
    <>
      <rect x="3.5" y="5" width="17" height="15.5" rx="2" />
      <path d="M3.5 10h17M8 3v4M16 3v4" />
    </>
  ),
  lieu: (
    <>
      <path d="M12 21s-6.5-6.2-6.5-11a6.5 6.5 0 0 1 13 0c0 4.8-6.5 11-6.5 11z" />
      <circle cx="12" cy="10" r="2.3" />
    </>
  ),
  telephone: (
    <path d="M6.6 3.5h2.9l1.5 4.4-2 1.3a11 11 0 0 0 5.8 5.8l1.3-2 4.4 1.5v2.9a2 2 0 0 1-2.2 2A16.5 16.5 0 0 1 4.6 5.7a2 2 0 0 1 2-2.2z" />
  ),
  document: (
    <>
      <path d="M6.5 3.5H14l4 4v13H6.5z" />
      <path d="M14 3.5v4h4M9.5 12.5h5M9.5 16h5" />
    </>
  ),
  facture: (
    <>
      <path d="M6 3.5h12v17l-2-1.3-2 1.3-2-1.3-2 1.3-2-1.3-2 1.3z" />
      <path d="M9 8.5h6M9 12h6M9 15.5h3.5" />
    </>
  ),
  vehicule: (
    <>
      <path d="M3 6.5h11v9.5H3zM14 10h3.8l3.2 3.2V16H14" />
      <circle cx="7" cy="17.5" r="1.8" />
      <circle cx="17.2" cy="17.5" r="1.8" />
    </>
  ),
  cadenas: (
    <>
      <rect x="5" y="10.5" width="14" height="10" rx="2" />
      <path d="M8 10.5V8a4 4 0 0 1 8 0v2.5" />
    </>
  ),
  crayon: (
    <>
      <path d="M4.5 19.5l1-4.3L15.6 5.1a2.1 2.1 0 0 1 3 3L8.5 18.5z" />
      <path d="M13.5 7.2l3 3" />
    </>
  ),
  photo: (
    <>
      <rect x="3.5" y="6.5" width="17" height="13" rx="2" />
      <path d="M8.5 6.5L10 4h4l1.5 2.5" />
      <circle cx="12" cy="13" r="3.5" />
    </>
  ),
  envoyer: (
    <>
      <path d="M20.5 3.5l-17 7 7 3 3 7z" />
      <path d="M10.5 13.5l10-10" />
    </>
  ),
  telecharger: <path d="M12 4v11M7.5 10.5L12 15l4.5-4.5M5 19.5h14" />,
  importer: <path d="M12 15V4M7.5 8.5L12 4l4.5 4.5M5 19.5h14" />,
  banque: <path d="M3.5 9.5L12 4.5l8.5 5M5.5 9.5v8M9.8 9.5v8M14.2 9.5v8M18.5 9.5v8M3.5 19.5h17" />,
  carte: (
    <>
      <rect x="3" y="6" width="18" height="12" rx="2" />
      <path d="M3 10h18M7 14.5h3" />
    </>
  ),
  entreprise: <path d="M5 20.5V4.5h9v16M14 9.5h5v11M3.5 20.5h17M8 8h3M8 11.5h3M8 15h3" />,
  etiquette: (
    <>
      <path d="M3.5 12.5V4.5h8l9 9-8 8z" />
      <circle cx="8" cy="8.5" r="1.5" />
    </>
  ),
  etincelle: (
    <>
      <path d="M11 4l1.7 4.6L17.5 10l-4.8 1.6L11 16.5l-1.7-4.9L4.5 10l4.8-1.4z" />
      <path d="M18 14.5l.7 1.8 1.8.7-1.8.7-.7 1.8-.7-1.8-1.8-.7 1.8-.7z" />
    </>
  ),
  couronne: <path d="M4 8l4 4 4-6 4 6 4-4-1.5 10.5h-13z" />,
  alerte: (
    <>
      <path d="M12 4l9 15.5H3z" />
      <path d="M12 10v4.5M12 17v.4" />
    </>
  ),
  liste: <path d="M8.5 6.5H20M8.5 12H20M8.5 17.5H20M4 6.5h.6M4 12h.6M4 17.5h.6" />,
  annuler: (
    <>
      <path d="M9 6.5L4.5 11 9 15.5" />
      <path d="M4.5 11H15a5 5 0 0 1 0 10h-2.5" />
    </>
  ),
  note: <path d="M5 5.5h14M5 10h14M5 14.5h9" />,
  oeil: (
    <>
      <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z" />
      <circle cx="12" cy="12" r="3" />
    </>
  ),
  carton: (
    <>
      <path d="M12 3.5l8 4.2v8.6l-8 4.2-8-4.2V7.7z" />
      <path d="M4 7.7l8 4.3 8-4.3M12 12v8.5" />
    </>
  ),
  scanner: (
    <path d="M4 8V5.5A1.5 1.5 0 0 1 5.5 4H8M16 4h2.5A1.5 1.5 0 0 1 20 5.5V8M20 16v2.5a1.5 1.5 0 0 1-1.5 1.5H16M8 20H5.5A1.5 1.5 0 0 1 4 18.5V16M7 12h10" />
  ),
};

/** `aria-hidden` (`Trace`) : le mot d'à côté dit déjà tout, et une lecture à voix haute qui annoncerait « micro » serait du bruit. */
export default function Picto({ nom, taille = 24, epaisseur = 1.75 }: { nom: NomPicto; taille?: number; epaisseur?: number }) {
  return (
    <Trace taille={taille} epaisseur={epaisseur}>
      {TRACES[nom]}
    </Trace>
  );
}
