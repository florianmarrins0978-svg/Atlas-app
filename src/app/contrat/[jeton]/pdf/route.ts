import { NextResponse } from "next/server";
import { pdfDuContratParJeton } from "@/server/repositories/contrats-entretien";
import { enTetesDeRemise, veutTelecharger } from "@/lib/remise-de-fichier";

// Le PDF du contrat, pour le client, par son lien : le jeton exact ouvre la
// ligne (`contrats_entretien_lecture_par_jeton`), et elle seule.
export const dynamic = "force-dynamic";

export async function GET(requete: Request, { params }: { params: Promise<{ jeton: string }> }) {
  const { jeton } = await params;
  const pdf = await pdfDuContratParJeton(jeton);
  if (!pdf) return NextResponse.json({ error: "Ce lien n'est plus valable" }, { status: 404 });
  return new NextResponse(new Uint8Array(pdf), {
    headers: enTetesDeRemise({
      telecharger: veutTelecharger(requete.url),
      nom: "contrat-d-entretien.pdf",
      type: "application/pdf",
    }),
  });
}
