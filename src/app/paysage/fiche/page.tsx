import Link from "next/link";
import EnTeteEcran from "@/components/atlas/EnTeteEcran";
import { colors, font, smallCaps } from "@/lib/design-tokens";
import { getCurrentCtx } from "@/server/session-ctx";
import { estProprietaire } from "@/server/autorisation";
import { listerPassages } from "@/server/repositories/passages-entretien";
import { listerPrestations } from "@/server/repositories/prestations-entretien";
import OuvrirFiche from "./OuvrirFiche";
import FichesEnCours from "./FichesEnCours";
import LignePassage from "./LignePassage";

export const dynamic = "force-dynamic";
export const metadata = { title: "Fiche de chantier — Atlas" };

/**
 * « Fiche de chantier » — ce qu'il retrouve en ouvrant l'outil.
 *
 * **Cet écran existe parce qu'une fiche ne s'ouvre PAS toute seule.** Créer un
 * passage à la simple ouverture d'une page écrirait une fiche en base parce que
 * quelqu'un a appuyé sur un onglet — et lui en laisserait douze vides au bout
 * d'une semaine. C'est la même règle que le modèle fourni, qui ne se pose qu'au
 * geste (`prestations-entretien.ts`).
 *
 * **Les brouillons d'abord.** Une fiche laissée en plan hier soir est ce qu'il
 * vient chercher ; les rapports partis, eux, se consultent. Et depuis le
 * 24 août 2026, ils se retirent : `FichesEnCours` porte le geste.
 */
export default async function FichesPage() {
  const ctx = await getCurrentCtx();
  const [passages, modele, proprietaire] = await Promise.all([
    listerPassages(ctx),
    listerPrestations(ctx),
    estProprietaire(ctx),
  ]);

  const brouillons = passages.filter((p) => p.envoyeLe === null);
  const partis = passages.filter((p) => p.envoyeLe !== null);

  return (
    <div style={{ backgroundColor: colors.cream, color: colors.ink, fontFamily: font.body, minHeight: "100%" }}>
      {/* `pb-24`, et non `pb-10` : c'est la mesure des réglages
          (`reglages/page.tsx`), et la porte du modèle est désormais la DERNIÈRE
          chose de l'écran — celle qui vient buter sur la barre d'onglets, posée
          par-dessus la page.

          **Mesuré plutôt que supposé, le 24 août 2026** : à fond de défilement,
          elle finissait 60 px au-dessus de la barre, contre 116 px avec cette
          marge. Elle n'était donc pas cachée — la dire cachée serait annoncer
          une panne corrigée là où seul le confort l'était (`AGENTS.md`) —, mais
          serrée contre elle, et deux écrans voisins ne se terminaient pas
          pareil. */}
      <div className="pb-24" data-atlas="ecran-fiches-chantier">
        <EnTeteEcran
          surtitre="Outils du métier"
          titre="Fiche de chantier"
          retour={{ href: "/paysage", libelle: "Retour à Paysage" }}
        />

        {/* ─── Composer ma fiche, EN PREMIER ─────────────────────────────────
            **Sa décision du 26 août 2026**, après avoir choisi la proposition B
            de `appli/ma-fiche-rangee.html` : *« la B, mais il faut que la
            rubrique se trouve sous le titre en premier, et son titre doré doit
            être "composer ma fiche" ou "ma fiche perso". »*

            **Cette place CONTREDIT une consigne du 24 août**, qui vivait ici en
            toutes lettres : le lien avait été mis « en bas et permanent », au
            motif que neuf fois sur dix il vient ouvrir une fiche, pas la
            recomposer. Ce raisonnement était le NÔTRE ; celui-ci est le sien, et
            il l'emporte. La consigne est récrite plutôt que contournée — sans
            quoi la prochaine session la redescendrait de bonne foi en citant un
            texte devenu faux (la faute du trait gris, `ARCHITECTURE.md` §172).

            **Elle reste réservée au patron.** Le déplacement depuis les Réglages
            n'ouvre rien : un salarié ne voit pas cette rubrique, et la page
            qu'elle ouvre le refuserait de toute façon. */}
        {proprietaire && modele.length > 0 && (
          <section className="mx-[26px] mt-[20px]">
            {/* **UNE CARTE, ET PAS PLEINE LARGEUR** — ses deux mots du 26 août
                2026, une heure après la première version : *« c'est bien mais
                juste une phrase, on la trouve difficilement ; je pense qu'un
                onglet carré serait le mieux »*, puis, devant les trois formes
                proposées : *« une carte mais fais-la moins large »*.

                **Ce que la phrase ne faisait pas.** Une ligne de texte au milieu
                d'un écran de texte ne se distingue pas d'un intertitre : ni
                fond, ni cadre, ni couleur d'action, et un chevron de huit
                pixels pour seul aveu qu'on peut appuyer.

                **Moins large qu'une carte pleine.** Elle prend la largeur de
                son texte, plafonnée — un pavé bord à bord pèserait autant que
                « Ouvrir une fiche », qui est le geste de tous les jours, et
                c'est le défaut que la planche annonçait. Le plafond existe pour
                les gros caractères du téléphone : sans lui la carte redeviendrait
                pleine largeur chez qui grossit son texte, c'est-à-dire là où
                l'on croyait avoir réglé la question. */}
            <Link
              href="/paysage/fiche/composer"
              data-atlas="carte-composer-ma-fiche"
              // **4 px, et non 14** : la charte veut ses plages presque droites
              // — « au-delà de 6 px, une plage devient un galet et l'écran perd
              // sa tenue ». La capsule est réservée à ce qu'on APPUIE ; ceci est
              // une carte qu'on parcourt, comme « Ma TVA à déclarer ».
              className="flex w-fit max-w-[270px] min-h-[44px] items-center gap-[14px] rounded-[4px] px-[16px] py-[13px]"
              // `rustTint` est le PAPIER de la charte (`--paper`), pas une
              // teinte de terre cuite : le nom vient d'avant la reprise
              // d'Arborea. C'est le fond des éléments teintés, et il reste
              // lisible sur les deux chartes sombres.
              style={{ backgroundColor: colors.rustTint, border: `1px solid ${colors.line}` }}
            >
              <span className="min-w-0 flex-1">
                <span className="block text-[16px] leading-[1.2]" style={{ fontFamily: font.display }}>
                  Composer ma fiche
                </span>
                <span className="mt-[3px] block text-[11.5px] leading-[1.45]" style={{ color: colors.muted }}>
                  {modele.length} prestation{modele.length > 1 ? "s" : ""}
                </span>
              </span>
              {/* Le même chevron que les lignes du dessous et que le sommaire des
                  réglages : ce qui mène quelque part se reconnaît à lui. */}
              <span
                aria-hidden="true"
                className="h-2 w-2 rotate-45"
                style={{
                  flex: "none",
                  borderRight: `1.5px solid ${colors.chevron}`,
                  borderTop: `1.5px solid ${colors.chevron}`,
                }}
              />
            </Link>
          </section>
        )}

        <section className="mx-[26px] mt-[22px]">
          {/* **Le modèle vide se dit ICI, avant le bouton.** Ouvrir une fiche
              sans une seule ligne à cocher donnerait un écran blanc : autant
              l'envoyer composer sa fiche, qui est le geste qui manque. */}
          {modele.length === 0 ? (
            <div
              className="rounded-[18px] px-[18px] py-[16px]"
              style={{ backgroundColor: colors.card, border: `1px solid ${colors.line}` }}
            >
              <p className="text-[13.5px] leading-[1.6]" style={{ color: colors.inkSoft }}>
                Votre fiche n&apos;a encore aucune prestation. Composez-la une fois :
                elle servira à tous vos passages.
              </p>
              {/* **Un salarié n'y a pas droit, et l'écran ne le lui promet
                  pas** : la rubrique est réservée au propriétaire, et le lien
                  ne l'ouvrirait que sur « Rubrique réservée ». */}
              {proprietaire ? (
                <Link
                  href="/paysage/fiche/composer"
                  className="mt-[12px] inline-block text-[13px] font-semibold"
                  style={{ color: colors.rust }}
                >
                  Composer ma fiche
                </Link>
              ) : (
                <p className="mt-[12px] text-[13px]" style={{ color: colors.muted }}>
                  C&apos;est au patron de la composer.
                </p>
              )}
            </div>
          ) : (
            <OuvrirFiche />
          )}
        </section>

        <FichesEnCours brouillons={brouillons} />

        {partis.length > 0 && (
          <section className="mx-[26px] mt-[28px]">
            <h2 className={smallCaps} style={{ color: colors.muted }}>
              Rapports envoyés
            </h2>
            <div className="mt-[10px]">
              {partis.map((p) => (
                <LignePassage key={p.id} passage={p} />
              ))}
            </div>
          </section>
        )}

      </div>
    </div>
  );
}
