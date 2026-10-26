import { NextResponse } from "next/server";
import { getCurrentCtx } from "@/server/session-ctx";
import { exigerOuverture } from "@/server/garde-route";
import { peutOuvrir } from "@/server/autorisation";
import { pieceDuPatron } from "@/server/repositories/pour-mon-comptable";
import { lireObjet } from "@/server/storage";
import { typeDepuisCle } from "@/lib/type-de-fichier";

/**
 * LA PIÈCE D'UNE LIGNE DU RELEVÉ — la photo du ticket, la facture reçue, ou la
 * facture faite hors d'Atlas, pour la voir depuis le relevé du dossier.
 *
 * Elle ne prend pas une clé de stockage mais l'identifiant de la LIGNE, relue
 * sous la RLS : une clé tapée à la main, ou la ligne d'une autre entreprise,
 * rend « introuvable ». La même règle choisit la pièce que la page du
 * comptable (`pieceDeLaLigne`) : les deux montrent le même fichier.
 *
 * Réservée à qui ouvre le dossier (patron et facturation) : un écran gardé ne
 * suffit pas, une route s'appelle sans passer par l'écran.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ ligne: string }> }) {
  const { ligne } = await params;
  const ctx = await getCurrentCtx();
  const refus = await exigerOuverture(ctx);
  if (refus) return refus;
  if (!(await peutOuvrir(ctx, "/termines/comptable"))) return NextResponse.json({ error: "Introuvable" }, { status: 404 });
  if (!/^[0-9a-f-]{36}$/i.test(ligne)) return NextResponse.json({ error: "Introuvable" }, { status: 404 });

  const piece = await pieceDuPatron(ctx, ligne);
  if (!piece) return NextResponse.json({ error: "Introuvable" }, { status: 404 });
  const contenu = await lireObjet(piece.cle);
  return new NextResponse(new Uint8Array(contenu), {
    headers: {
      "Content-Type": typeDepuisCle(piece.cle),
      "Content-Disposition": "inline",
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
