import EnTeteEcran from "@/components/atlas/EnTeteEcran";
import { colors, font } from "@/lib/design-tokens";
import PrendreUnePhoto from "./PrendreUnePhoto";

/**
 * « Diagnostic végétal » — l'écran d'entrée, et il tient en trois lignes.
 *
 * **Sa règle produit, mot pour mot :** *« 1 photo → 1 résultat principal →
 * 3 informations essentielles → 1 action recommandée. La complexité doit être
 * dans le moteur et la base de données, jamais dans l'interface. »*
 *
 * D'où ce qui n'est PAS ici, et ce n'est pas un manque :
 *
 *  - **aucun formulaire**, aucun choix d'essence, aucune saison à cocher. Le
 *    modèle lit l'essence sur la photo quand elle est lisible, la saison est la
 *    date du jour, et le reste se déduit ou reste inconnu ;
 *  - **aucun questionnaire**. Sa demande : *« je ne veux PAS d'un formulaire
 *    complexe ni d'un questionnaire systématique »* ;
 *  - **aucune liste des diagnostics passés**. Elle viendra si elle manque —
 *    l'ajouter d'avance encombrerait l'écran d'un service que personne n'a
 *    encore demandé.
 */
export const metadata = { title: "Diagnostic végétal — Atlas" };

export default function DiagnosticPage() {
  return (
    <div
      style={{
        backgroundColor: colors.cream,
        color: colors.ink,
        fontFamily: font.body,
        minHeight: "100%",
      }}
    >
      <div className="pb-16" data-atlas="ecran-diagnostic">
        <EnTeteEcran
          surtitre="Paysage"
          titre="Diagnostic végétal"
          retour={{ href: "/paysage", libelle: "Retour aux outils" }}
        />

        <section className="mx-[26px] mt-[30px]">
          <p className="text-[15px] leading-[1.6]" style={{ color: colors.inkSoft }}>
            Photographiez la zone qui vous semble anormale.
          </p>

          <div className="mt-[26px]">
            <PrendreUnePhoto libelle="Prendre une photo" />
          </div>

          <p className="mt-[18px] text-center text-[12px]" style={{ color: colors.muted }}>
            Feuille, écorce, branche ou champignon.
          </p>
        </section>
      </div>
    </div>
  );
}
