import { NextResponse } from "next/server";
import { getCurrentCtx } from "@/server/session-ctx";
import { exigerOuverture } from "@/server/garde-route";
import { peutOuvrir } from "@/server/autorisation";
import { fichierDeLAttestation } from "@/server/repositories/verification-comptable";
import { lireObjet } from "@/server/storage";
import { enTetesDeRemise, veutTelecharger } from "@/lib/remise-de-fichier";

/**
 * L'ATTESTATION DU COMPTABLE, rangée avec son dossier : relue sous la RLS par
 * son identifiant, comme le bilan. L'adresse finit par `/pdf` : la visionneuse
 * d'Atlas n'ouvre que celles-là.
 */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await getCurrentCtx();
  const refus = await exigerOuverture(ctx);
  if (refus) return refus;
  if (!(await peutOuvrir(ctx, "/termines/comptable"))) return NextResponse.json({ error: "Introuvable" }, { status: 404 });
  if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: "Introuvable" }, { status: 404 });

  const a = await fichierDeLAttestation(ctx, id);
  if (!a) return NextResponse.json({ error: "Introuvable" }, { status: 404 });
  const contenu = await lireObjet(a.cle);
  return new NextResponse(new Uint8Array(contenu), {
    headers: {
      ...enTetesDeRemise({ telecharger: veutTelecharger(req.url), nom: "Attestation du comptable.pdf", type: "application/pdf" }),
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
