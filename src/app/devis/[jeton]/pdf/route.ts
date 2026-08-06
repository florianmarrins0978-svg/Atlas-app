import { NextResponse } from "next/server";
import { pdfDevisParJeton } from "@/server/repositories/envois-devis";

// Le devis complet, ouvert par le client depuis sa page — sans compte.
//
// Le patron a voulu une page réduite aux trois totaux. Le détail vit donc ici :
// c'est le PDF archivé au moment de l'envoi, celui-là même sur lequel le client
// engage son accord.
//
// Un lien inconnu et un lien expiré rendent le même 404 : distinguer les deux
// apprendrait à un visiteur au hasard qu'un jeton a existé.
export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: Promise<{ jeton: string }> }) {
  const { jeton } = await params;
  const fichier = await pdfDevisParJeton(jeton);

  if (!fichier) {
    // **Jamais de JSON brut à un client.**
    //
    // Le 6 août 2026, le client du patron a touché « voir le devis en PDF » et
    // reçu, en pleine page : {"error":"Ce lien n'est plus valable"}. Un client
    // qui lit cela ne comprend rien, ne sait pas quoi faire, et appelle
    // l'artisan — quand il n'en conclut pas que le devis est un piège.
    //
    // La page du devis, elle, sait déjà expliquer un lien mort en français et
    // dire quoi faire. On l'y renvoie. Un lien inconnu et un lien expiré y
    // rendent le même message : distinguer les deux apprendrait à un visiteur
    // au hasard qu'un jeton a existé.
    return NextResponse.redirect(new URL(`/devis/${encodeURIComponent(jeton)}`, _req.url), 303);
  }

  return new NextResponse(new Uint8Array(fichier.octets), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${fichier.nom}"`,
      // Un devis n'a rien à faire dans un cache partagé ni dans un index.
      "Cache-Control": "no-store",
      "X-Robots-Tag": "noindex, nofollow",
    },
  });
}
