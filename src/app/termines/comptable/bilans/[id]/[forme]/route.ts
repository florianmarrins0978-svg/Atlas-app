import { NextResponse } from "next/server";
import { getCurrentCtx } from "@/server/session-ctx";
import { exigerOuverture } from "@/server/garde-route";
import { peutOuvrir } from "@/server/autorisation";
import { fichierDuBilan } from "@/server/repositories/dossiers-comptables";
import { lireObjet } from "@/server/storage";
import { typeDepuisCle } from "@/lib/type-de-fichier";
import { enTetesDeRemise, veutTelecharger } from "@/lib/remise-de-fichier";

/**
 * LE BILAN DU COMPTABLE, rangé avec son dossier : relu sous la RLS par son
 * identifiant. Une route, deux adresses, selon ce qu'il est : `…/pdf` (que la
 * visionneuse accepte, ses routes finissant toutes par `/pdf`) ou `…/photo`.
 * Une adresse qui ne dit pas la vraie nature du fichier répond « introuvable ».
 */
export async function GET(req: Request, { params }: { params: Promise<{ id: string; forme: string }> }) {
  const { id, forme } = await params;
  const ctx = await getCurrentCtx();
  const refus = await exigerOuverture(ctx);
  if (refus) return refus;
  if (!(await peutOuvrir(ctx, "/termines/comptable"))) return NextResponse.json({ error: "Introuvable" }, { status: 404 });
  if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: "Introuvable" }, { status: 404 });

  const b = await fichierDuBilan(ctx, id);
  if (!b || forme !== b.nature) return NextResponse.json({ error: "Introuvable" }, { status: 404 });
  const contenu = await lireObjet(b.cle);
  const extension = b.cle.slice(b.cle.lastIndexOf("."));
  return new NextResponse(new Uint8Array(contenu), {
    headers: {
      ...enTetesDeRemise({
        telecharger: veutTelecharger(req.url),
        nom: `Bilan du comptable${extension}`,
        type: b.nature === "pdf" ? "application/pdf" : typeDepuisCle(b.cle),
      }),
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
