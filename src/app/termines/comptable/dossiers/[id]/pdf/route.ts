import { NextResponse } from "next/server";
import { getCurrentCtx } from "@/server/session-ctx";
import { exigerOuverture } from "@/server/garde-route";
import { peutOuvrir } from "@/server/autorisation";
import { fichierDuDossier } from "@/server/repositories/dossiers-comptables";
import { lireObjet } from "@/server/storage";
import { enTetesDeRemise, veutTelecharger } from "@/lib/remise-de-fichier";

/**
 * LE PDF D'UN DOSSIER RANGÉ — « Ouvrir » (dans la visionneuse, d'où son
 * `/pdf` final) et « Télécharger » de Mes dossiers justifiés. Relu sous la RLS
 * par son identifiant, jamais par une clé de stockage ; réservé à qui ouvre le
 * dossier.
 */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await getCurrentCtx();
  const refus = await exigerOuverture(ctx);
  if (refus) return refus;
  if (!(await peutOuvrir(ctx, "/termines/comptable"))) return NextResponse.json({ error: "Introuvable" }, { status: 404 });
  if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: "Introuvable" }, { status: 404 });

  const d = await fichierDuDossier(ctx, id);
  if (!d) return NextResponse.json({ error: "Introuvable" }, { status: 404 });
  const contenu = await lireObjet(d.cle);
  return new NextResponse(new Uint8Array(contenu), {
    headers: {
      ...enTetesDeRemise({ telecharger: veutTelecharger(req.url), nom: `Dossier justifié du ${d.du} au ${d.au}.pdf`, type: "application/pdf" }),
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
