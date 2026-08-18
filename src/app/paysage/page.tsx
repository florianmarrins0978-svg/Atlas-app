import Link from "next/link";
import EnTeteEcran from "@/components/atlas/EnTeteEcran";
import { colors, font, libelleCaps } from "@/lib/design-tokens";

/**
 * « Paysage » — les outils de calcul du métier, derrière le cinquième onglet.
 *
 * **Sa décision du 17 août 2026.** Sa question : *« L'idée, c'est de créer des
 * outils comme celui-là pour les paysagistes ; après je ferai la même chose
 * pour les terrasses bois. Pour toi le mieux c'est de créer une nouvelle
 * catégorie paysage ? Ou alors on range ça dans les réglages ? »* — et sa
 * réponse au formulaire : **un cinquième onglet**. Le raisonnement, et ce qui a
 * été écarté (les Réglages, l'attache au chantier), sont dans
 * `ARCHITECTURE.md` §125.
 *
 * **« PAYSAGE », ET NON « OUTILS » — son dernier mot, le 17 août au soir.** Il
 * avait d'abord retenu « Outils », et j'avais écarté « Paysage » au motif que
 * le paysage est son métier ENTIER, donc ne distinguerait rien. **Il est revenu
 * dessus, et c'est son produit.** Son choix se défend mieux que mon objection :
 * l'onglet porte le nom du MÉTIER qu'il sert, pas la nature de ce qu'il
 * contient. Le jour où un menuisier s'en servira, il y aura un onglet
 * « Menuiserie » à côté — et ça se lira mieux que deux listes d'« outils »
 * qu'il faudrait départager en entrant.
 *
 * **Il reste que l'onglet porte une LISTE** : l'arrosage aujourd'hui, la
 * terrasse bois ensuite. C'est pourquoi le titre de l'écran n'est pas
 * « Arrosage » — le nommer d'après son premier occupant obligerait à le
 * renommer au second, et un onglet qui change de nom fait perdre le repère de
 * celui qui l'ouvre vingt fois par jour.
 *
 * **CE QUI EST DIT ICI EST VRAI, ET C'EST TOUT LE SUJET DE CET ÉCRAN.** L'outil
 * d'arrosage n'est PAS dans l'application : c'est une page publiée à part, qu'il
 * éprouve depuis son téléphone. L'écran le dit et ouvre la page hors de
 * l'application, au lieu de faire croire à une intégration qui n'existe pas.
 * Une ligne qui promettrait un écran interne serait la troisième fois qu'il
 * appuie sur quelque chose qui ne répond pas (`reglages/Sommaire.tsx`).
 */
export const metadata = { title: "Paysage — Atlas" };

/** L'adresse de la maquette essayable, publiée avec `appli/` (`pages.yml`). */
const ARROSAGE = "https://florianmarrins0978-svg.github.io/Atlas-app/arrosage.html";

type Outil = {
  nom: string;
  dit: string;
  /** `null` = pas encore fait. Alors AUCUN lien, et l'écran l'annonce. */
  href: string | null;
  /** Hors de l'application : l'écran le dit, et le lien s'ouvre à côté. */
  dehors?: boolean;
};

const OUTILS: Outil[] = [
  {
    nom: "Plan d'arrosage automatique",
    dit: "Les zones, les arroseurs, les secteurs, et la liste à envoyer au fournisseur.",
    href: ARROSAGE,
    dehors: true,
  },
  {
    nom: "Terrasse bois",
    dit: "Lambourdes, plots, visserie — le même principe, à partir des mesures.",
    href: null,
  },
];

export default function PaysagePage() {
  return (
    <div
      style={{
        backgroundColor: colors.cream,
        color: colors.ink,
        fontFamily: font.body,
        minHeight: "100%",
      }}
    >
      <div className="pb-10" data-atlas="ecran-paysage">
        <EnTeteEcran surtitre="Outils du métier" titre="Paysage" />

        <section className="mx-[26px] mt-[26px]">
          {OUTILS.map((o, i) => (
            <LigneOutil key={o.nom} outil={o} derniere={i === OUTILS.length - 1} />
          ))}
        </section>

        <p
          className="mx-[26px] mt-[24px] text-[12.5px] leading-[1.7]"
          style={{ color: colors.muted }}
        >
          Ces outils sortent des <b style={{ color: colors.ink, fontWeight: 600 }}>quantités</b>,
          jamais un prix du catalogue. La liste part chez votre fournisseur ; son devis
          revient par le parcours habituel.
        </p>
      </div>
    </div>
  );
}

function LigneOutil({ outil, derniere }: { outil: Outil; derniere: boolean }) {
  const aVenir = outil.href === null;

  const contenu = (
    <>
      <span className="min-w-0 flex-1">
        <span
          className="block text-[17px] leading-[1.25]"
          style={{ fontFamily: font.display, color: aVenir ? colors.muted : colors.ink }}
        >
          {outil.nom}
        </span>
        <span className="mt-[3px] block text-[11.5px] leading-[1.5]" style={{ color: colors.muted }}>
          {outil.dit}
        </span>
      </span>
      {aVenir ? (
        <span className={libelleCaps} style={{ color: colors.or, opacity: 0.9, flex: "none" }}>
          Bientôt
        </span>
      ) : outil.dehors ? (
        // **« À l'essai » plutôt qu'un chevron.** Le chevron dit « ça s'ouvre
        // ici » ; cette page-là s'ouvre AILLEURS, et elle n'est pas encore un
        // écran d'Atlas. Le mot vaut mieux qu'un signe qui mentirait.
        <span className={libelleCaps} style={{ color: colors.or, opacity: 0.9, flex: "none" }}>
          À l&apos;essai
        </span>
      ) : (
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
  // se touche — la même mesure que le sommaire des réglages.
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

  if (outil.dehors) {
    return (
      <a
        href={outil.href!}
        target="_blank"
        rel="noopener noreferrer"
        className={classe}
        style={style}
      >
        {contenu}
      </a>
    );
  }

  return (
    <Link href={outil.href!} className={classe} style={style}>
      {contenu}
    </Link>
  );
}
