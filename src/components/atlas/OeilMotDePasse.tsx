"use client";

/**
 * L'ŒIL QUI MONTRE CE QU'ON TAPE — un seul dessin, deux écrans.
 *
 * *Demandé le 14 août 2026 :* ***« met le petit œil à côté pour afficher ou non
 * le mdp »***. Il vivait depuis dans `NouveauCompte.tsx`, écrit à la main.
 *
 * **Il en sort le 8 septembre 2026 parce qu'un DEUXIÈME écran en a besoin** —
 * la porte, où l'on choisit son mot de passe deux fois. La planche le disait
 * déjà : *« un second dessin pour le même geste finirait par diverger »*, et
 * c'est le libellé lu à voix haute, plus que le tracé, qui aurait dérivé.
 *
 * **LA COULEUR SE PASSE, ELLE NE SE DÉCIDE PAS ICI.** Les deux écrans ne
 * vivent pas sous la même charte : les réglages suivent celle du patron, la
 * porte est en Nuit faute de patron connu. Un composant qui choisirait sa
 * couleur serait juste sur l'un et invisible sur l'autre.
 */
export default function OeilMotDePasse({
  ouvert,
  onBasculer,
  quoi,
  couleur,
  couleurOuvert,
  className,
}: {
  ouvert: boolean;
  onBasculer: () => void;
  /** Ce qu'on montre, au féminin de son libellé : « le mot de passe ». */
  quoi: string;
  couleur: string;
  couleurOuvert: string;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onBasculer}
      aria-label={ouvert ? `Masquer ${quoi}` : `Afficher ${quoi}`}
      aria-pressed={ouvert}
      // 44 px : la cible tactile d'Atlas. Le pictogramme en fait 21.
      className={`flex h-11 w-11 flex-none items-center justify-center ${className ?? ""}`}
      style={{ color: ouvert ? couleurOuvert : couleur }}
    >
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        className="h-[21px] w-[21px]"
        style={{ fill: "none", stroke: "currentColor", strokeWidth: 1.4, strokeLinecap: "round", strokeLinejoin: "round" }}
      >
        <path d="M2.4 12S6 5.8 12 5.8 21.6 12 21.6 12 18 18.2 12 18.2 2.4 12 2.4 12Z" />
        <circle cx="12" cy="12" r="3.1" />
        {ouvert && <path d="M4 20 20 4" />}
      </svg>
    </button>
  );
}
