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
                Votre fiche n&apos;a encore aucune prestation. Composez-la une fois, dans les
                réglages : elle servira à tous vos passages.
              </p>
              {/* **Un salarié n'y a pas droit, et l'écran ne le lui promet
                  pas** : la rubrique est réservée au propriétaire, et le lien
                  ne l'ouvrirait que sur « Rubrique réservée ». */}
              {proprietaire ? (
                <Link
                  href="/reglages/fiche-entretien"
                  className="mt-[12px] inline-block text-[13px] font-semibold"
                  style={{ color: colors.rust }}
                >
                  Composer ma fiche
                </Link>
              ) : (
                <p className="mt-[12px] text-[13px]" style={{ color: colors.muted }}>
                  C&apos;est au patron de la composer, dans ses réglages.
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

        {/* ─── Le chemin vers l'endroit où la fiche se compose ────────────────
            **Sa remarque du 24 août 2026** : *« Avant, il y avait un endroit où
            je pouvais créer ma fiche sur mesure. Ajouter des catégories, en
            enlever, en créer. Aujourd'hui, cet endroit a disparu. »*

            Il n'avait pas disparu — il n'apparaissait QUE sur une fiche vide.
            Le lien « Composer ma fiche » vivait dans l'encart ci-dessus, celui
            qui s'efface dès la première prestation posée : l'écran retirait sa
            propre porte au moment exact où le patron commençait à s'en servir,
            et il ne restait qu'un chemin par Réglages qu'il n'a pas retrouvé.

            Il est donc **en bas et permanent**, jamais dans le bouton du haut :
            ce qu'il vient faire ici neuf fois sur dix, c'est ouvrir une fiche,
            pas la recomposer. */}
        {proprietaire && modele.length > 0 && (
          <section className="mx-[26px] mt-[30px] border-t pt-[18px]" style={{ borderColor: colors.line }}>
            <Link href="/reglages/fiche-entretien" className="flex min-h-[44px] items-center gap-[15px]">
              <span className="min-w-0 flex-1">
                <span className="block text-[15px]" style={{ fontFamily: font.display }}>
                  Composer ma fiche
                </span>
                <span className="mt-[3px] block text-[11.5px] leading-[1.5]" style={{ color: colors.muted }}>
                  {modele.length} prestation{modele.length > 1 ? "s" : ""} — ajoutez, retirez ou
                  renommez vos catégories
                </span>
              </span>
              {/* Le même chevron que les lignes du dessus et que le sommaire des
                  réglages : une ligne qui mène quelque part se reconnaît à lui,
                  et sans lui celle-ci se lit comme une phrase d'explication. */}
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
      </div>
    </div>
  );
}
