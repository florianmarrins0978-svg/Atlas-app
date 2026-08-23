/**
 * Trois points qui enflent et se rétractent l'un après l'autre — l'attente
 * d'Atlas pendant qu'il travaille.
 *
 * **Pourquoi ce composant existe plutôt que trois `<i>` posés sur place.** Le
 * dépôt a déjà payé deux fois le geste dessiné à la main : le bouton de la
 * feuille d'envoi et celui de la facture, tous deux passés à côté d'une
 * décision d'ensemble parce qu'ils étaient peints dans leur écran
 * (`ARCHITECTURE.md` §66 et §73). Une attente recopiée divergerait pareil — et
 * il en existe déjà une seconde, immobile, sur le bouton d'ajout de photo
 * (`Pellicule.tsx`), qui attend son tour.
 *
 * **Le geste vient de lui.** Proposition C de
 * `docs/maquettes/43-l-attente-a-lessai.html`, désignée le 13 août 2026 : ils
 * n'avancent pas, ils respirent sur place. Rien ne sort du rond de 44 px, donc
 * rien ne peut cogner ce qui est à côté. Les mesures vivent dans
 * `globals.css` (`.atlas-souffle`) — les y reprendre, jamais de mémoire.
 *
 * **La couleur n'est pas écrite ici** : les points prennent `currentColor`,
 * donc celle de ce qui les porte.
 */
export default function PointsQuiSoufflent({ className }: { className?: string }) {
  return (
    // `aria-hidden` : ces points ne disent rien à qui ne les voit pas. Ce qui
    // porte le sens, c'est la phrase annoncée à côté — un lecteur d'écran qui
    // épellerait trois points décoratifs couvrirait ce qui compte.
    <span className={`atlas-souffle${className ? ` ${className}` : ""}`} aria-hidden="true">
      <i />
      <i />
      <i />
    </span>
  );
}
