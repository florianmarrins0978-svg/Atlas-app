import Link from "next/link";
import EnTeteEcran from "@/components/atlas/EnTeteEcran";
import TuileIcone from "@/components/atlas/TuileIcone";
import { cardShadow, colors, font, libelleCaps, radius, texteSituation } from "@/lib/design-tokens";
import { accesALaFonction, estOutilOffert, etiquetteDeLOutil, type AccesALaFonction, type FonctionReservee } from "@/lib/abonnements";
import { getCurrentCtx } from "@/server/session-ctx";
import { abonnementDeLEntreprise } from "@/server/repositories/abonnements";
import { offresDejaPrises } from "@/server/repositories/offres";
import DessinOutilPaysage, { type OutilDessine } from "@/components/atlas/DessinOutilPaysage";
import { garderLaPage } from "@/server/garde-page";

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
 * **CE QUI EST DIT ICI EST VRAI, ET C'EST TOUT LE SUJET DE CET ÉCRAN.** Un
 * outil « à venir » n'est pas une ligne de la liste : une ligne qui promettrait
 * un écran inexistant serait la troisième fois qu'il appuie sur quelque chose
 * qui ne répond pas (`reglages/Sommaire.tsx`). La terrasse bois se dit donc
 * dans une phrase sous la liste, depuis la planche
 * `appli/paysage-les-outils.html` (11 octobre 2026).
 *
 * **L'arrosage est entré dans l'application le 20 août 2026** — *« code le tout
 * dans l'appli »*. Jusque-là, cet écran ouvrait une page publiée à côté, hors
 * d'Atlas, et le disait. Ce commentaire décrivait donc un monde disparu : il est
 * corrigé dans le même commit que le code, comme le dépôt l'exige.
 */
export const metadata = { title: "Paysage, Cause" };

/*
 * LA PLANCHE `appli/paysage-les-outils.html`, version « Corrigé », retenue le
 * 11 octobre 2026. Les phrases grises sous chaque outil sont parties : elles se
 * lisaient mal au soleil, et l'outil s'explique une fois ouvert. Un dessin à
 * gauche fait reconnaître l'outil d'un coup d'œil.
 */
type Outil = {
  nom: string;
  href: string;
  /** La fonction que la formule doit ouvrir ; absente, l'outil est ouvert à tous. */
  fonction?: FonctionReservee;
  /** Le dessin de la planche, partagé avec le bloc des outils de l'écran Abonnement. */
  dessin: OutilDessine;
};

const OUTILS: Outil[] = [
  {
    // **DANS l'application depuis le 20 août 2026** — *« code le tout dans
    // l'appli »*. Il ouvrait jusque-là une page publiée à côté, hors d'Atlas.
    nom: "Plan d'arrosage automatique",
    href: "/paysage/arrosage",
    fonction: "arrosage",
    dessin: "arrosage",
  },
  {
    // Sa demande du 17 août : *« la ranger comme étant un outil dans la case
    // paysage à côté de arrosage automatique et terrasse bois »*.
    nom: "Fiche de chantier",
    href: "/paysage/fiche",
    fonction: "fiche-chantier",
    dessin: "fiche-chantier",
  },
  {
    // **Le troisième outil, et le premier qui APPELLE un modèle.** Sa demande du
    // 20 août 2026 : une photo, un diagnostic probable, une conduite à tenir.
    // Le principe qui le gouverne — « le modèle observe, la base décide » — est
    // en tête de `drizzle/0056_diagnostic_vegetal.sql`.
    //
    // **Il s'ouvre même quand la base est vide**, et c'est délibéré : l'écran
    // dit alors qu'aucune fiche validée n'existe encore. C'est précisément le
    // parcours qu'il faut éprouver avant d'y verser des fiches.
    nom: "Diagnostic végétal",
    href: "/paysage/diagnostic",
    fonction: "diagnostic",
    dessin: "diagnostic",
  },
  // Sa décision du 21 septembre 2026, après avoir vu Terminés : *« il faut créer
  // une catégorie dans Paysage »*. La fiche elle-même se remplit depuis le
  // planning ; ici vivent celles qui sont signées, gardées deux ans.
  {
    nom: "Fiches de sécurité",
    href: "/paysage/fiches-securite",
    dessin: "fiches-securite",
  },
];

export default async function PaysagePage() {
  await garderLaPage();
  // L'artisan découvrait la fermeture APRÈS avoir appuyé (la planche, état
  // « Formule Artisan »). La liste la dit désormais, mais ne décide de rien :
  // la règle reste `fonctionOuverte`, la même que lit `OuvertParLaFormule`.
  const ctx = await getCurrentCtx();
  const abonnement = await abonnementDeLEntreprise(ctx);
  // Le plan et le diagnostic offerts une fois (19 novembre 2026) : la ligne dit
  // « 1 offert » tant qu'il ne l'a pas pris. Sans abonnement, rien ne se compte.
  const prises = abonnement ? await offresDejaPrises(ctx) : new Set<string>();

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

        <nav
          aria-label="Outils"
          className="mx-4 mt-[28px] overflow-hidden"
          style={{ backgroundColor: colors.card, borderRadius: radius.card, boxShadow: cardShadow }}
        >
          {OUTILS.map((o, i) => (
            <LigneOutil
              key={o.nom}
              outil={o}
              premiere={i === 0}
              acces={
                o.fonction === undefined
                  ? "ouverte"
                  : accesALaFonction(abonnement, o.fonction, estOutilOffert(o.fonction) && prises.has(o.fonction))
              }
            />
          ))}
        </nav>

        <p className={`mx-[26px] mt-[22px] ${texteSituation}`} style={{ color: colors.inkSoft }}>
          La terrasse bois arrive bientôt.
        </p>
      </div>
    </div>
  );
}

function LigneOutil({ outil, premiere, acces }: { outil: Outil; premiere: boolean; acces: AccesALaFonction }) {
  const fermee = acces === "fermee";
  const etiquette = etiquetteDeLOutil(acces);
  // 64 px : on touche juste, même avec des gants (la planche). La ligne fermée
  // reste un lien : l'écran fermé reste atteignable, c'est la règle de
  // `FonctionReservee`.
  return (
    <Link
      href={outil.href}
      className="relative flex min-h-[64px] w-full items-center gap-[14px] py-[10px] pl-[14px] pr-[18px] text-left"
    >
      {premiere ? null : (
        // Le filet part sous le nom, pas sous le dessin : la planche.
        <span
          aria-hidden="true"
          className="absolute right-0 top-0 h-px"
          style={{ left: 68, backgroundColor: colors.line }}
        />
      )}
      <TuileIcone eteinte={fermee}>
        <DessinOutilPaysage outil={outil.dessin} />
      </TuileIcone>
      <span
        className="min-w-0 flex-1 text-[18px] leading-[1.25]"
        style={{ fontFamily: font.display, color: colors.ink }}
      >
        {outil.nom}
      </span>
      {etiquette ? (
        // « 1 offert » sans cadenas : l'outil s'ouvre. « En option » avec : il
        // ne s'ouvre plus, et l'écran qu'il ouvre dit comment l'ajouter.
        <span
          className={`flex flex-none items-center gap-[6px] ${libelleCaps}`}
          style={{ color: colors.or }}
          data-atlas={`etiquette-${outil.fonction}`}
        >
          {fermee && (
            <svg
              aria-hidden="true"
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            >
              <rect x="4.5" y="10.5" width="15" height="10" rx="2" />
              <path d="M8 10.5V7.5a4 4 0 0 1 8 0v3" />
            </svg>
          )}
          {etiquette}
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
    </Link>
  );
}
