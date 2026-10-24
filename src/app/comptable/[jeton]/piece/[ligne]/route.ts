import { NextResponse } from "next/server";
import { pieceParJeton } from "@/server/repositories/verification-comptable";
import { lireObjet } from "@/server/storage";
import { typeDepuisCle } from "@/lib/type-de-fichier";

/**
 * LA PIÈCE D'ORIGINE D'UNE LIGNE, pour le comptable : la photo du ticket ou la
 * facture reçue. Elle prend le jeton et l'identifiant de la LIGNE, jamais une
 * clé de stockage : une ligne hors du dossier, ou d'une autre entreprise, rend
 * « introuvable » (`pieceParJeton`).
 */
export async function GET(_req: Request, { params }: { params: Promise<{ jeton: string; ligne: string }> }) {
  const { jeton, ligne } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(ligne)) return NextResponse.json({ error: "Introuvable" }, { status: 404 });
  const piece = await pieceParJeton(jeton, ligne);
  if (!piece) return NextResponse.json({ error: "Introuvable" }, { status: 404 });
  const contenu = await lireObjet(piece.cle);
  return new NextResponse(new Uint8Array(contenu), {
    headers: {
      "Content-Type": typeDepuisCle(piece.cle),
      "Content-Disposition": "inline",
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
      "X-Robots-Tag": "noindex",
    },
  });
}
