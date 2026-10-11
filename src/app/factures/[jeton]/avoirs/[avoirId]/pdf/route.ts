import { NextResponse } from "next/server";
import { pdfAvoirParJeton } from "@/server/repositories/envois-factures";
import { enTetesDeRemise, veutTelecharger } from "@/lib/remise-de-fichier";

// L'avoir, ouvert par le client depuis le lien de la facture qu'il corrige
// (sa question du 24 septembre 2026). Mêmes règles que le PDF de la facture
// (`../../../pdf/route.ts`) : le fichier archivé, jamais refait ; un lien
// inconnu ou périmé ramène à la page, qui dit qu'il n'est plus valable.
export const dynamic = "force-dynamic";

export async function GET(req: Request, { params }: { params: Promise<{ jeton: string; avoirId: string }> }) {
  const { jeton, avoirId } = await params;
  const fichier = await pdfAvoirParJeton(jeton, avoirId);

  if (!fichier) {
    return NextResponse.redirect(new URL(`/factures/${encodeURIComponent(jeton)}`, req.url), 303);
  }

  return new NextResponse(new Uint8Array(fichier.octets), {
    headers: {
      ...enTetesDeRemise({ telecharger: veutTelecharger(req.url), nom: fichier.nom, type: "application/pdf" }),
      "Cache-Control": "no-store",
      "X-Robots-Tag": "noindex, nofollow",
    },
  });
}
