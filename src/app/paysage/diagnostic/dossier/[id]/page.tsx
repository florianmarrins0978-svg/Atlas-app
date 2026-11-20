import Link from "next/link";
import { notFound } from "next/navigation";
import EnTeteEcran from "@/components/atlas/EnTeteEcran";
import IconeTrait from "@/components/atlas/IconeTrait";
import { colors, font } from "@/lib/design-tokens";
import { ligneDuDiagnostic, nomDuDiagnostic, situationDuDossier } from "@/lib/dossiers-diagnostic";
import { getCurrentCtx } from "@/server/session-ctx";
import { lireUnDossierDeDiagnostics } from "@/server/repositories/diagnostics";
import { garderLaPage } from "@/server/garde-page";

/**
 * Un dossier de diagnostics : un chantier, ou un dossier à lui (sa planche du
 * 20 novembre 2026, `appli/soignee/diagnostic-dossiers.html`).
 *
 * Chaque ligne dit ce qu'il cherchait à retrouver : SA photo, la maladie, le
 * jour, et le début de sa note. Elle ouvre le diagnostic, où se lit la note
 * entière. **Ce dossier ne se montre pas sur la fiche du chantier**, sa réponse
 * du même jour : il vit ici, sous l'écran Diagnostic.
 */
export const dynamic = "force-dynamic";
export const metadata = { title: "Dossier, Cause" };

export default async function DossierDeDiagnosticsPage({ params }: { params: Promise<{ id: string }> }) {
  await garderLaPage();
  const { id } = await params;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) notFound();
  const ctx = await getCurrentCtx();
  const dossier = await lireUnDossierDeDiagnostics(ctx, id);
  if (!dossier) notFound();
  const maintenant = new Date();

  return (
    <div style={{ backgroundColor: colors.cream, color: colors.ink, fontFamily: font.body, minHeight: "100%" }}>
      <div className="pb-16" data-atlas="ecran-dossier-diagnostics">
        <EnTeteEcran
          allure="soignee"
          assistant={false}
          titre={dossier.nom}
          retour={{ href: "/paysage/diagnostic", libelle: "Retour au diagnostic" }}
        />
        <div className="px-[22px]">
          <p className="mt-2 text-[14.5px] leading-[1.4]" style={{ color: colors.inkSoft }}>
            {situationDuDossier(dossier.genre, dossier.diagnostics.length, null, maintenant)}
          </p>

          {dossier.diagnostics.length > 0 && (
            <ul className="mt-6 rounded-[6px] px-[18px] py-1" style={{ backgroundColor: colors.card }}>
              {dossier.diagnostics.map((d, i) => (
                <li key={d.id} style={i > 0 ? { boxShadow: `inset 0 1px 0 ${colors.line}` } : undefined}>
                  <Link
                    href={`/paysage/diagnostic/${d.id}`}
                    className="flex min-h-[80px] items-center gap-3.5 py-3"
                    data-atlas="dossier-diagnostic"
                  >
                    {d.photoId ? (
                      // eslint-disable-next-line @next/next/no-img-element -- pansement assumé : sa photo sort d’une route authentifiée qui revérifie l’entreprise, que l’optimiseur de next/image ne sait pas traverser (TODO.md, la photo de pièce en img)
                      <img
                        src={`/api/diagnostic/photo/${d.photoId}`}
                        alt=""
                        loading="lazy"
                        className="h-14 w-14 flex-none rounded-[6px] object-cover"
                      />
                    ) : (
                      // La photo a été purgée avant d'être rangée : la place reste,
                      // pour que les lignes s'alignent, sans image inventée.
                      <span
                        className="grid h-14 w-14 flex-none place-items-center rounded-[6px]"
                        style={{ backgroundColor: colors.rustTint, color: colors.rust }}
                      >
                        <IconeTrait nom="photo" taille={22} epaisseur={1.7} />
                      </span>
                    )}
                    <span className="min-w-0 flex-1">
                      <span className="block text-[18px] leading-[1.25]" style={{ fontFamily: font.display }}>
                        {nomDuDiagnostic(d.statut, d.nomDeLaFiche)}
                      </span>
                      <span className="mt-[3px] block text-[14.5px] leading-[1.4]" style={{ color: colors.inkSoft }}>
                        {ligneDuDiagnostic(d.createdAt, d.note, maintenant)}
                      </span>
                    </span>
                    <span style={{ color: colors.chevron }}>
                      <IconeTrait nom="suivant" taille={22} epaisseur={1.7} />
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
