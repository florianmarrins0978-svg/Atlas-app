import { NextResponse } from "next/server";
import { getCurrentCtx } from "@/server/session-ctx";
import { exigerOuverture } from "@/server/garde-route";
import { getPiece } from "@/server/repositories/pieces-importees";
import { lireObjet } from "@/server/storage";
import { enTetesDeRemise, veutTelecharger } from "@/lib/remise-de-fichier";

// Le fichier d'une pièce importée, tel qu'il est arrivé : jamais recomposé.
//
// **Le genre est dans l'adresse** (`/api/pieces-importees/facture/<id>/pdf`,
// qui finit par `/pdf` comme toute route PDF : la visionneuse l'exige) pour
// que la fiche du client nomme et range la pièce sans deviner
// (`natureDeLaPiece`). Il n'y décide de rien : la porte se règle sur le genre
// lu en base, et une adresse qui ment sur lui ne sert rien.
//
// **Une facture importée suit la porte des factures** : un commercial, qui
// n'ouvre aucune facture d'Atlas, n'ouvre pas davantage celles qu'on a
// importées (`FACTURE_DU_CHANTIER`, `acces-roles.ts`).

export const dynamic = "force-dynamic";

export async function GET(requete: Request, { params }: { params: Promise<{ genre: string; id: string }> }) {
  const { genre, id } = await params;
  const ctx = await getCurrentCtx();
  const refus = await exigerOuverture(ctx);
  if (refus) return refus;
  const piece = await getPiece(ctx, id);
  const introuvable = NextResponse.json({ error: "Introuvable" }, { status: 404 });
  // Le genre de l'adresse doit être celui de la base : c'est sur l'adresse que
  // `exigerOuverture` a refusé (ou non) la facture à un commercial.
  if (!piece || piece.genre !== genre) return introuvable;
  try {
    const octets = await lireObjet(piece.fichierCle);
    const nom = `${piece.genre ?? "piece"}-${(piece.numero ?? piece.jour ?? "importee").replace(/[^\w-]+/g, "-")}.pdf`;
    return new NextResponse(new Uint8Array(octets), {
      headers: { ...enTetesDeRemise({ telecharger: veutTelecharger(requete.url), nom, type: "application/pdf" }), "Cache-Control": "no-store" },
    });
  } catch {
    return NextResponse.json({ error: "Fichier introuvable" }, { status: 404 });
  }
}
