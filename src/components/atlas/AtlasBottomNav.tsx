"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { colors } from "@/lib/design-tokens";

// Le bandeau du bas, refait le 10 août 2026 d'après la version retenue.
//
// **Le trait remplace l'aplat.** Avant : une pilule flottante dont l'onglet
// courant était un bloc vert plein. Désormais un bandeau plein, cerné d'un
// seul cheveu en haut, et un TRAIT D'OR qui glisse d'un onglet à l'autre. Le
// patron a nommé ce mouvement « trait G » : il dépasse légèrement sa cible,
// revient, et le mot choisi monte de deux pixels à sa rencontre.
//
// **Pourquoi c'est mieux qu'un aplat.** Le vert plein était un second bloc de
// couleur sur un écran qui n'en veut qu'un — celui de « Nouveau chantier ». Le
// trait dit où l'on est sans rien peser, et son déplacement dit d'où l'on
// vient : sur un écran ouvert vingt fois par jour, c'est la seule animation qui
// apprenne quelque chose.
//
// **Il n'y a plus d'icônes**, et c'est délibéré : quatre pictogrammes sous
// quatre mots répétaient la même information deux fois. **Cette décision tient
// à cinq onglets** — elle a été reposée le 17 août, et il l'a maintenue.
//
// ══ LE CINQUIÈME ONGLET, 17 août 2026 — et ce qu'il a coûté ══════════════════
//
// Sa question : « je vais créer des outils comme celui-là pour les paysagistes,
// après je ferai la même chose pour les terrasses bois — une catégorie paysage,
// ou on range ça dans les réglages ? » Sa décision : **un onglet « Outils »**.
// Le raisonnement complet, et ce qui a été écarté, sont dans `ARCHITECTURE.md`
// §125 ; les cinq variantes de barre dans `docs/maquettes/76-le-cinquieme-onglet.html`.
//
// **La cinquième colonne ne rentrait PAS sans rien changer, et c'est mesuré :**
// sur un écran de 360 px, une colonne tombe de 89,5 à 71,6 px — or « CHANTIERS »
// en demande 78,8 à 9,5 px / 0,28em. Il débordait de 7,2 px.
//
// **Resserrer le seul espacement (0,18em) ne suffisait pas non plus** : 70,3 px
// pour 71,6, soit 1,3 px de marge. C'est un faux confort — une autre police de
// téléphone, et le mot repasse dessous. Le défaut aurait été invisible ici et
// visible chez lui.
//
// **Sa variante retenue, « C » : la lettre à 8,5 px, espacement 0,14em.**
// 59,8 px pour 71,6, soit 11,8 px de marge — de quoi encaisser une autre
// police. `scripts/verifier-barre-basse.mjs` mesure la barre à 360 px avant
// chaque livraison, plutôt que de refaire confiance à ce commentaire.

const ONGLETS = [
  { href: "/", label: "Chantiers" },
  { href: "/planning", label: "Planning" },
  { href: "/termines", label: "Terminés" },
  // **« Paysage », et non « Outils » — son dernier mot, le 17 août au soir.**
  // Il avait d'abord retenu « Outils », et j'avais écarté « Paysage » au motif
  // que le paysage est son métier ENTIER, donc ne distinguerait rien. Il est
  // revenu dessus, et c'est son produit : l'onglet porte le NOM DU MÉTIER
  // qu'il sert, pas la nature de ce qu'il contient. Le jour où un menuisier
  // s'en servira, il y aura un onglet « Menuiserie » à côté — et ça se lira
  // mieux que deux listes d'« outils » qu'il faudrait départager en entrant.
  //
  // Il reste que l'onglet porte une LISTE : l'arrosage d'abord, la terrasse
  // bois ensuite. Le nommer « Arrosage » aurait obligé à le renommer au second.
  { href: "/paysage", label: "Paysage" },
  // « Réglages » depuis que cet écran porte aussi le nombre d'équipes : un
  // onglet nommé « Tarifs » cacherait le réglage qui commande le planning.
  { href: "/reglages", label: "Réglages" },
];

export default function AtlasBottomNav() {
  const pathname = usePathname();
  const indexActif = ONGLETS.reduce(
    (trouve, t, i) => (estActif(pathname, t.href) ? i : trouve),
    // Aucun onglet ne correspond (une fiche chantier, par exemple) : le trait
    // reste sous « Chantiers », d'où l'on vient forcément.
    0,
  );

  return (
    <nav
      className="atlas-nav-basse fixed inset-x-0 bottom-0 z-20 mx-auto max-w-md"
      aria-label="Navigation principale"
      style={{ backgroundColor: colors.cream, borderTop: `1px solid ${colors.line}` }}
    >
      <div className="relative grid grid-cols-5 px-3.5 pb-2 pt-[18px]">
        {ONGLETS.map((t, i) => {
          const actif = i === indexActif;
          return (
            <Link
              key={t.href}
              href={t.href}
              aria-current={actif ? "page" : undefined}
              className="pb-2 text-center text-[8.5px] font-medium uppercase"
              style={{
                color: actif ? colors.ink : colors.muted,
                letterSpacing: "0.14em",
                transform: actif ? "translateY(-2px)" : "none",
                transition:
                  "color 320ms cubic-bezier(0.22,0.61,0.36,1), transform 340ms cubic-bezier(0.34,1.4,0.5,1)",
              }}
            >
              {t.label}
            </Link>
          );
        })}

        {/* Le trait. Sa largeur est le CINQUIÈME de la rangée, marges déduites ;
            son déplacement se fait en pourcentage de sa propre largeur, donc il
            reste juste quel que soit l'écran. La courbe dépasse légèrement (1.4
            en troisième point) : c'est ce « G » que le patron a retenu. */}
        <span
          aria-hidden="true"
          className="pointer-events-none absolute bottom-2 left-3.5"
          style={{
            width: "calc((100% - 1.75rem) / 5)",
            transform: `translateX(${indexActif * 100}%)`,
            transition: "transform 540ms cubic-bezier(0.34,1.4,0.5,1)",
          }}
        >
          <span className="block h-px" style={{ backgroundColor: colors.or }} />
        </span>
      </div>
    </nav>
  );
}

function estActif(chemin: string, href: string): boolean {
  return href === "/" ? chemin === "/" : chemin.startsWith(href);
}
