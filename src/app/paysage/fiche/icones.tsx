/**
 * Les dessins de la fiche de chantier, au trait, recopiés de sa planche du
 * 9 novembre 2026 (`appli/fiche-de-chantier-soignee.html`, D et B) : la
 * planchette de l'outil dans Paysage, écrite pour une fiche en cours, cochée
 * pour un rapport parti ; et la liste qu'on compose, crayon au bout.
 *
 * **Ici, et non dans `IconeTrait`** : ce jeu-là sert trente-quatre écrans, et
 * trois dessins qu'un seul écran emploie y auraient fait mesurer chacun d'eux.
 * Le jour où un autre écran les veut, ils y montent.
 */
const TRACES = {
  enCours: (
    <>
      <rect x="5" y="4.5" width="14" height="16.5" rx="2" />
      <path d="M9 3h6v3H9z" />
      <path d="M8.5 11h7M8.5 15h4.5" />
    </>
  ),
  envoyee: (
    <>
      <rect x="5" y="4.5" width="14" height="16.5" rx="2" />
      <path d="M9 3h6v3H9z" />
      <path d="M8.5 12.5l2 2 4-4.5" />
    </>
  ),
  composer: (
    <>
      <path d="M4 6.5h11M4 11.5h11M4 16.5h6" />
      <path d="M14.2 20.5l.8-3.3 5.2-5.2a1.6 1.6 0 0 1 2.3 2.3l-5.2 5.2z" />
    </>
  ),
} as const;

export default function IconeDeFiche({
  nom,
  taille,
  epaisseur,
}: {
  nom: keyof typeof TRACES;
  taille: number;
  epaisseur: number;
}) {
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
      className="flex-none"
    >
      {TRACES[nom]}
    </svg>
  );
}
