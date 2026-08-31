import { colors, font, voile } from "@/lib/design-tokens";

// L'action principale, à la forme d'Arborea (`.primary` dans `appli/app.html`).
//
// **Pourquoi une carte plutôt qu'un bouton.** Le patron a comparé les deux le
// 3 août 2026, captures à l'appui, et choisi celle-ci. Un bouton plat dit ce
// qu'on touche ; la carte dit ce qui arrive ensuite — et sur une application
// dont le cœur est la dictée, l'annoncer vaut la hauteur qu'elle prend.
//
// **La sous-ligne décrit le parcours réel, pas une promesse.** Après l'appui,
// on saisit le client et l'adresse, puis on arrive sur la fiche du chantier où
// se fait la dictée. Écrire « Dictez votre chantier » comme Arborea aurait
// annoncé un geste qui vient un écran plus tard.
//
// **L'icône n'est pas le micro d'Arborea**, pour la même raison : chez lui la
// carte ouvre l'écran de dictée, ici elle ouvre un formulaire. Un micro y
// serait une petite tromperie, répétée à chaque ouverture de l'application.
//
// **Ce composant n'est monté nulle part aujourd'hui** (aucun `import` dans
// `src/`) : il reste comme référence de la carte retenue le 3 août. Sa flèche
// était donc invisible — raison de plus pour qu'elle parte : elle serait
// revenue à l'écran le jour où on le remonte.
//
// **Pas de flèche au bout, et elle ne doit pas revenir.** Le modèle d'Arborea
// en portait une ; le patron l'a fait retirer partout le 25 août 2026 — *« il
// m'avait semblé t'avoir demandé de supprimer toutes les flèches »*. Une carte
// pleine, avec son rond et son ombre, dit déjà qu'on l'appuie. Le contrôle qui
// la refuse : `scripts/test-aucune-fleche.ts`.
//
// Les mesures viennent du modèle : 20px de rayon, 56px pour le rond, titre en
// Playfair 600 à 1,35rem, sous-ligne à 0,9rem, ombre teintée de vert pin.

export default function ActionPrincipale({
  href,
  titre,
  sousTitre,
  icone,
}: {
  href: string;
  titre: string;
  sousTitre: string;
  icone: React.ReactNode;
}) {
  return (
    <a
      href={href}
      className="atlas-plein flex items-center gap-5 px-6 py-6"
      style={{
        backgroundColor: colors.rust,
        color: colors.cream,
        borderRadius: 20,
        boxShadow: "0 16px 36px rgba(47,59,47,0.22)",
      }}
    >
      <span
        aria-hidden="true"
        className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-full"
        style={{ backgroundColor: voile(colors.cream, 0.13) }}
      >
        {icone}
      </span>

      <span className="min-w-0 flex-1">
        <strong
          className="block text-[21.6px] font-semibold leading-tight"
          style={{ fontFamily: font.display }}
        >
          {titre}
        </strong>
        <span className="mt-0.5 block text-[14.4px] leading-snug" style={{ color: voile(colors.cream, 0.82) }}>
          {sousTitre}
        </span>
      </span>
    </a>
  );
}
