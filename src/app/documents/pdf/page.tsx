import { notFound } from "next/navigation";
import EnTeteEcran from "@/components/atlas/EnTeteEcran";
import { colors, font } from "@/lib/design-tokens";
import { fichierAccepteParLaVisionneuse } from "@/lib/visionneuse-pdf";
import VisionneusePdf from "./VisionneusePdf";

export const dynamic = "force-dynamic";

/**
 * L'écran qui peint un PDF DANS l'application — sa capture du 11 septembre
 * 2026 : *« quand j'ouvre le pdf pour voir la facture j'ai pas de touche
 * retour »*. Le pourquoi et ce que l'adresse accepte sont dans
 * `src/lib/visionneuse-pdf.ts`.
 *
 * Aucune lecture en base ici : le fichier est demandé par le navigateur à sa
 * route, qui pose elle-même l'entreprise et le rôle (`exigerOuverture`). Cet
 * écran ne sait rien de plus sur le document que son adresse et son titre.
 */
export default async function VisionneusePdfPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const fichier = fichierAccepteParLaVisionneuse(
    typeof params.fichier === "string" ? params.fichier : undefined
  );
  if (!fichier) notFound();
  const titre = typeof params.titre === "string" && params.titre.trim() ? params.titre.trim() : "Document";
  const surtitre = typeof params.de === "string" && params.de.trim() ? params.de.trim() : undefined;

  return (
    <div style={{ backgroundColor: colors.cream, color: colors.ink, fontFamily: font.body, minHeight: "100%" }}>
      <div className="pb-16">
        <EnTeteEcran
          surtitre={surtitre}
          titre={titre}
          // Le repli, quand aucun écran ne précède : ouvert à froid depuis un
          // signet, il n'y a rien à quoi revenir sinon l'accueil.
          retour={{ href: "/", libelle: "Retour à l'accueil" }}
        />
        <VisionneusePdf fichier={fichier} />
      </div>
    </div>
  );
}
