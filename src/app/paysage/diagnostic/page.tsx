import Link from "next/link";
import EnTeteEcran from "@/components/atlas/EnTeteEcran";
import IconeTrait from "@/components/atlas/IconeTrait";
import { colors, font } from "@/lib/design-tokens";
import { situationDuDossier } from "@/lib/dossiers-diagnostic";
import { getCurrentCtx } from "@/server/session-ctx";
import { lireMesDossiersDeDiagnostics } from "@/server/repositories/diagnostics";
import PrendreUnePhoto from "./PrendreUnePhoto";
import { garderLaPage } from "@/server/garde-page";

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
 *  - **aucune liste des diagnostics un par un**. Ce qu'il a demandé le
 *    20 novembre 2026, c'est de RANGER ceux qu'il veut retrouver : « Mes
 *    dossiers » sous le bouton de la photo, les chantiers qui en portent et
 *    ses dossiers à lui (planche `appli/soignee/diagnostic-dossiers.html`).
 *    Rien ne s'y montre tant qu'il n'a rien rangé.
 */
export const metadata = { title: "Diagnostic végétal, Cause" };

export default async function DiagnosticPage() {
  await garderLaPage();
  const ctx = await getCurrentCtx();
  const dossiers = await lireMesDossiersDeDiagnostics(ctx);
  const maintenant = new Date();
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

          {dossiers.length > 0 && (
            <div data-atlas="diagnostic-mes-dossiers">
              <p
                className="mb-2.5 mt-10 text-[13px] font-semibold uppercase tracking-[0.12em]"
                style={{ color: colors.inkSoft }}
              >
                Mes dossiers
              </p>
              <ul className="rounded-[6px] px-[18px] py-1" style={{ backgroundColor: colors.card }}>
                {dossiers.map((d, i) => (
                  <li key={d.id} style={i > 0 ? { boxShadow: `inset 0 1px 0 ${colors.line}` } : undefined}>
                    <Link
                      href={`/paysage/diagnostic/dossier/${d.id}`}
                      className="flex min-h-[72px] items-center gap-3.5 py-3"
                      data-atlas="diagnostic-dossier"
                    >
                      <span
                        className="grid h-11 w-11 flex-none place-items-center rounded-full"
                        style={{ backgroundColor: colors.rustTint, color: colors.rust }}
                      >
                        <IconeTrait nom={d.genre === "chantier" ? "chantier" : "dossier"} taille={22} epaisseur={1.7} />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-[18px] leading-[1.25]" style={{ fontFamily: font.display }}>
                          {d.nom}
                        </span>
                        <span className="mt-[3px] block text-[14.5px] leading-[1.4]" style={{ color: colors.inkSoft }}>
                          {situationDuDossier(d.genre, d.nombre, d.derniere, maintenant)}
                        </span>
                      </span>
                      <span style={{ color: colors.chevron }}>
                        <IconeTrait nom="suivant" taille={22} epaisseur={1.7} />
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
