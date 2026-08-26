"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { colors } from "@/lib/design-tokens";
import { cheminAutorise, type Role } from "@/lib/acces-roles";

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

/**
 * **Les onglets qu'un rôle n'atteint pas ne sont pas dessinés.**
 *
 * Le rôle est résolu au SERVEUR et descendu ici (`src/app/layout.tsx`) : un
 * composant client qui lirait lui-même son rôle lirait une donnée envoyée au
 * navigateur, c'est-à-dire une donnée que le navigateur peut réécrire.
 *
 * **Et le filtre est la MÊME fonction que celle qui refuse** au serveur. Un
 * onglet affiché qui mènerait à un refus se lit comme une panne ; un onglet
 * caché dont l'adresse répondrait quand même serait un mensonge — c'est
 * exactement la faute que ce lot répare, et elle ne doit pas revenir par la
 * barre du bas (`CLAUDE.md` §3).
 *
 * `role` vaut `null` sur les écrans sans session : la barre est alors entière,
 * comme avant ce lot. Elle n'y est de toute façon pas rendue.
 */
export default function AtlasBottomNav({ role = null }: { role?: Role | null }) {
  const pathname = usePathname();
  const onglets = role === null ? ONGLETS : ONGLETS.filter((o) => cheminAutorise(role, o.href));
  const indexActif = onglets.reduce(
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
      {/* **Le nombre de colonnes suit le nombre d'onglets**, il n'est plus écrit
          en dur à cinq. Un salarié n'en voit que deux : figées à cinq, ses deux
          mots se seraient serrés dans le tiers gauche de l'écran, et les trois
          colonnes vides auraient ressemblé à un affichage tombé en panne.
          Moins d'onglets élargit les colonnes — la mesure de
          `verifier-barre-basse.mjs` reste donc valable, elle vise le pire cas. */}
      <div
        className="relative grid px-3.5 pb-2 pt-[18px]"
        style={{ gridTemplateColumns: `repeat(${onglets.length}, minmax(0, 1fr))` }}
      >
        {onglets.map((t, i) => {
          const actif = i === indexActif;
          return (
            <Link
              key={t.href}
              href={t.href}
              aria-current={actif ? "page" : undefined}
              // `relative z-[1]` : le marqueur est rendu APRÈS les liens dans le
              // document. Tant qu'il faisait un trait d'un pixel au ras du bas,
              // l'ordre était sans conséquence ; devenu pastille, il passerait
              // PAR-DESSUS le libellé et le rendrait illisible.
              className="relative z-[1] pb-2 text-center text-[8.5px] font-medium uppercase"
              style={{
                // Le repli EST la valeur d'aujourd'hui : une charte qui ne dit
                // rien laisse l'encre en place, au caractère près.
                color: actif ? `var(--atlas-onglet-encre, ${colors.ink})` : colors.muted,
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
        {/* **Son apparence suit la charte, son MOUVEMENT jamais.** Sa demande du
            24 août 2026 : « modifie aussi la sélection des catégories, juste
            pour Brume moderne ». Le marqueur devient une pastille sur cette
            charte-là ; partout ailleurs il reste le trait doré, parce que
            chaque variable a pour repli la valeur d'aujourd'hui. Le glissement,
            lui, ne bouge pas : c'est un choix qu'il a déjà fait en le voyant. */}
        <span
          aria-hidden="true"
          className="pointer-events-none absolute bottom-2 left-3.5 z-0"
          style={{
            // La largeur d'UNE colonne, marges déduites — et le diviseur suit le
            // nombre d'onglets réellement dessinés, sans quoi le trait viserait
            // un cinquième là où la colonne fait un demi.
            width: `calc((100% - 1.75rem) / ${onglets.length})`,
            top: "var(--atlas-onglet-haut, auto)",
            transform: `translateX(${indexActif * 100}%)`,
            transition: "transform 540ms cubic-bezier(0.34,1.4,0.5,1)",
          }}
        >
          <span
            className="block"
            style={{
              height: "var(--atlas-onglet-hauteur, 1px)",
              borderRadius: "var(--atlas-onglet-rayon, 0)",
              backgroundColor: `var(--atlas-onglet-fond, ${colors.or})`,
            }}
          />
        </span>
      </div>
    </nav>
  );
}

function estActif(chemin: string, href: string): boolean {
  return href === "/" ? chemin === "/" : chemin.startsWith(href);
}
