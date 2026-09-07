import Link from "next/link";
import { colors, font, libelleCaps } from "@/lib/design-tokens";
import type { EnsembleRubriques, Rubrique } from "@/lib/rubriques-reglages";
import IconeReglage from "./icones";

/**
 * Le sommaire des réglages, dans la grammaire des écrans refaits.
 *
 * **La disposition vient de sa planche du 14 août 2026** — icône, titre,
 * chevron — et les couleurs de `design-tokens.ts`. Sa planche était noir et or ;
 * interrogé, il a répondu « crème, comme le reste ». Un seul écran sombre au
 * milieu de vingt se lit comme un écran d'une autre application
 * (`ARCHITECTURE.md` §95).
 *
 * **La ligne d'explication que portait sa planche n'y est plus, depuis le
 * 5 septembre 2026.** Il l'a demandé le 19 août — *« il y a beaucoup trop de
 * mots dans tous les sens »* — et la question est restée sans réponse jusqu'à
 * ce qu'il demande, le 5 septembre, qu'elle soit tranchée plutôt que reposée.
 * Douze phrases grises retirées, quatre titres corrigés pour qu'ils se
 * suffisent : `appli/sommaire-des-reglages.html` montre les deux états côte à
 * côte, avec les mesures.
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
          {/* **`inkSoft` et non `muted` — mesuré, pas ressenti (5 septembre
              2026).** Ces deux mots sont, avec les titres de rubrique, tout ce
              qui reste à lire sur cet écran depuis que les douze gloses sont
              parties : ils portent la seule séparation qui compte, ce qui est à
              l'entreprise et ce qui est à lui.

              Or `libelleCaps` fait **9,5 px en capitales espacées**, et `muted`
              tient entre **2,85** (Moka) et **3,59** (Brume) de contraste sur
              les six chartes claires, là où la norme demande 4,5. `inkSoft`
              monte à **8,0** sur Origine. Sa consigne du 5 septembre — des
              patrons qui lisent mal, au soleil, sur un téléphone — se joue
              exactement là.

              **La charte n'est PAS touchée, et c'est délibéré** : ce gris est
              le sien, relevé sur le site d'Arborea, et `test-chartes-lisibles`
              refuse volontairement d'y poser un seuil (`scripts/…:144`). Ce qui
              change, c'est OÙ on l'emploie — plus pour du texte à lire. */}
          {/* **Un titre vide ne dessine RIEN — 7 septembre 2026.** Le sommaire
              de « Devis & factures » n'a qu'un ensemble de quatre lignes : il
              n'y a pas de familles à séparer, et un intertitre vide laissait un
              blanc de dix pixels qu'on lit comme un défaut d'alignement. */}
          {ensemble.titre !== "" && (
            <p className={`mb-[10px] ${libelleCaps}`} style={{ color: colors.inkSoft }}>
              {ensemble.titre}
            </p>
          )}
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
      {/* **19 px, et LA LIGNE NE GRANDIT PAS POUR AUTANT.** À 19 px sur 1,25 le
          nom fait 24 px de haut ; avec les 13 px de rembourrage de part et
          d'autre, la ligne mesure 50 px — le `min-h-[56px]` continue donc de
          commander, et l'écran ne s'allonge pas d'un pixel. C'est le seul
          endroit de ce lot où l'on gagne sans rien payer.

          **La ligne d'explication est partie le 5 septembre 2026** — les douze
          d'un coup, sa demande du 19 août enfin tranchée
          (`docs/QUESTIONS.md` §23). Elle vivait ici en 11,5 px de `muted`,
          c'est-à-dire le plus petit texte le moins contrasté de l'application,
          sur l'écran le plus ouvert après l'accueil. */}
      <span className="min-w-0 flex-1">
        <span
          className="block text-[19px] leading-[1.25]"
          style={{ fontFamily: font.display, color: aVenir ? colors.muted : colors.ink }}
        >
          {rubrique.nom}
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
