import { NextResponse } from "next/server";
import { pdfFactureParJeton } from "@/server/repositories/envois-factures";

// La facture, ouverte par le client depuis le lien que le patron lui a envoyé
// — sans compte, sans application.
//
// Elle existe parce que rien ne portait la facture jusqu'au client : l'écran du
// patron annonçait « facture arrêtée », il a compris « facture partie », et son
// client n'a jamais rien reçu (6 août 2026).
//
// Le fichier servi est celui ARCHIVÉ au moment de l'arrêt, jamais un document
// régénéré : une facture est une pièce comptable, ce que le client garde ne
// doit pas pouvoir changer sous ses yeux.
export const dynamic = "force-dynamic";

export async function GET(req: Request, { params }: { params: Promise<{ jeton: string }> }) {
  const { jeton } = await params;
  const fichier = await pdfFactureParJeton(jeton);

  if (!fichier) {
    // Jamais de JSON brut à un client : il n'y comprend rien et appelle son
    // artisan. Un lien inconnu et un lien expiré rendent la même page — les
    // distinguer apprendrait à un visiteur au hasard qu'un jeton a existé.
    return NextResponse.redirect(new URL(`/factures/${encodeURIComponent(jeton)}`, req.url), 303);
  }

  return new NextResponse(new Uint8Array(fichier.octets), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${fichier.nom}"`,
      // Une facture n'a rien à faire dans un cache partagé ni dans un index.
      "Cache-Control": "no-store",
      "X-Robots-Tag": "noindex, nofollow",
    },
  });
}
