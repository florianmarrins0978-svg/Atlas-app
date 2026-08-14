import Link from "next/link";
import { colors, font, libelleCaps } from "@/lib/design-tokens";
import type { EnsembleRubriques, Rubrique } from "@/lib/rubriques-reglages";
import IconeReglage from "./icones";

/**
 * Le sommaire des réglages, dans la grammaire des écrans refaits.
 *
 * **La disposition vient de sa planche du 14 août 2026** — icône, titre, ligne
 * d'explication, chevron — et les couleurs de `design-tokens.ts`. Sa planche
 * était noir et or ; interrogé, il a répondu « crème, comme le reste ». Un seul
 * écran sombre au milieu de vingt se lit comme un écran d'une autre
 * application (`ARCHITECTURE.md` §95).
 *
 * **Des filets, pas des cadres**, comme le planning, les terminés et l'accueil.
 * La charte n'a aucune ombre (`cardShadow` vaut « none ») et presque aucun
 * rayon : ici le luxe est fait de ce qu'elle refuse.
 *
 * **Deux pièges déjà payés sur l'écran d'identité** (`ARCHITECTURE.md` §94), et
 * évités ici par construction : le premier bloc ne porte pas de trait — le
 * cheveu de l'en-tête ferme déjà au-dessus de lui — et la dernière ligne d'une
 * liste non plus, sinon son filet tombe trente pixels au-dessus du trait de la
 * section suivante et dessine une bande morte.
 */
export default function Sommaire({ ensembles }: { ensembles: EnsembleRubriques[] }) {
  return (
    <div>
      {ensembles.map((ensemble, i) => (
        <section
          key={ensemble.titre}
          // Pas de `!important` pour défaire les classes du premier bloc : en
          // Tailwind 4 le modificateur s'écrit en suffixe, et un `!mt-[26px]`
          // hérité de la version 3 ne fait tout simplement RIEN — le bloc
          // aurait gardé son trait sous le cheveu de l'en-tête, exactement le
          // défaut corrigé sur l'écran d'identité (`ARCHITECTURE.md` §94).
          className={`mx-[26px] ${i === 0 ? "mt-[26px]" : "mt-[30px] border-t pt-[18px]"}`}
          style={i === 0 ? undefined : { borderColor: colors.line }}
        >
          <p className={`mb-[10px] ${libelleCaps}`} style={{ color: colors.muted }}>
            {ensemble.titre}
          </p>
          {ensemble.rubriques.map((r, j) => (
            <Ligne key={r.nom} rubrique={r} derniere={j === ensemble.rubriques.length - 1} />
          ))}
        </section>
      ))}
    </div>
  );
}

/**
 * Une rubrique.
 *
 * **Codée, c'est un lien ; à venir, ce n'est rien du tout** — pas un lien mort,
 * pas un bouton inerte. Un chevron sur une ligne qui ne mène nulle part promet
 * une page, et le patron a déjà appuyé deux fois sur des choses qui ne
 * répondaient pas.
 */
function Ligne({ rubrique, derniere }: { rubrique: Rubrique; derniere: boolean }) {
  const aVenir = rubrique.href === null;

  const contenu = (
    <>
      <IconeReglage nom={rubrique.icone} eteinte={aVenir} />
      <span className="min-w-0 flex-1">
        <span
          className="block text-[17px] leading-[1.25]"
          style={{ fontFamily: font.display, color: aVenir ? colors.muted : colors.ink }}
        >
          {rubrique.nom}
        </span>
        <span className="mt-[3px] block text-[11.5px] leading-[1.5]" style={{ color: colors.muted }}>
          {rubrique.dit}
        </span>
      </span>
      {aVenir ? (
        <span className={libelleCaps} style={{ color: colors.or, opacity: 0.9, flex: "none" }}>
          Bientôt
        </span>
      ) : (
        // Le chevron est une affordance, pas un ornement : il dit « ça
        // s'ouvre ». Dessiné avec deux bordures plutôt qu'une image — c'est un
        // trait de la charte, pas un pictogramme de plus.
        <span
          aria-hidden="true"
          className="h-2 w-2 rotate-45"
          style={{
            flex: "none",
            borderRight: `1.5px solid ${colors.chevron}`,
            borderTop: `1.5px solid ${colors.chevron}`,
          }}
        />
      )}
    </>
  );

  // 56 px : au-delà de la cible de 44 px d'Apple, et c'est TOUTE la ligne qui
  // se touche — pas l'icône, pas le seul libellé.
  const classe = `flex min-h-[56px] w-full items-center gap-[15px] py-[13px] text-left ${
    derniere ? "" : "border-b"
  }`;
  const style = derniere ? undefined : { borderColor: colors.line };

  if (aVenir) {
    return (
      <div className={classe} style={style}>
        {contenu}
      </div>
    );
  }
  return (
    <Link href={rubrique.href!} className={classe} style={style}>
      {contenu}
    </Link>
  );
}
