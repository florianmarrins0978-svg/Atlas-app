import { NextResponse } from "next/server";
import { getCurrentCtx } from "@/server/session-ctx";
import { exigerOuverture } from "@/server/garde-route";
import { pdfDuContratPourLePatron } from "@/server/repositories/contrats-entretien";
import { enTetesDeRemise, veutTelecharger } from "@/lib/remise-de-fichier";

// Le PDF du contrat d'entretien, pour l'aperçu du patron.
//
// **Composé à chaque demande, jamais stocké** : un contrat envoyé est figé en
// base (ses prestations en jsonb, et l'empreinte qui prouve ce qui est parti),
// si bien que le recomposer rend le même document. Stocker une copie ferait
// deux vérités sur ce que le client a lu.
export async function GET(requete: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await getCurrentCtx();

  const refus = await exigerOuverture(ctx);
  if (refus) return refus;

  const pdf = await pdfDuContratPourLePatron(ctx, id);
  if (!pdf) return NextResponse.json({ error: "Contrat introuvable" }, { status: 404 });

  return new NextResponse(new Uint8Array(pdf), {
    headers: enTetesDeRemise({
      telecharger: veutTelecharger(requete.url),
      nom: "contrat-d-entretien.pdf",
      type: "application/pdf",
    }),
  });
}
