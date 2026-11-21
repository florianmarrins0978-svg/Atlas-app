import { NextResponse } from "next/server";
import { getCurrentCtx } from "@/server/session-ctx";
import { getRole } from "@/server/autorisation";
import { cheminAutorise } from "@/lib/acces-roles";
import { lirePlan } from "@/server/repositories/dossiers-arrosage";
import { lireObjet } from "@/server/storage";
import { enTetesDeRemise, veutTelecharger } from "@/lib/remise-de-fichier";

/**
 * Le PDF d'un plan d'arrosage enregistré : CELUI archivé à l'enregistrement,
 * jamais reconstruit (`ARCHITECTURE.md` §599). Ouvert sans l'option (sa réponse
 * 5) ; il faut l'écran « Paysage » de son rôle, et le dossier de son
 * entreprise : un autre identifiant ne rend rien, la RLS le cache.
 */
export const dynamic = "force-dynamic";

export async function GET(requete: Request, { params }: { params: Promise<{ dossier: string; plan: string }> }) {
  const { dossier, plan } = await params;
  const ctx = await getCurrentCtx();
  const role = await getRole(ctx);
  if (!role || !cheminAutorise(role, "/paysage")) return NextResponse.json({ error: "Interdit" }, { status: 403 });
  const p = await lirePlan(ctx, dossier, plan);
  if (!p || !p.pdfCle) return NextResponse.json({ error: "Ce plan n'est plus là" }, { status: 404 });
  const octets = await lireObjet(p.pdfCle);
  const jour = p.createdAt.toISOString().slice(0, 10);
  return new NextResponse(new Uint8Array(octets), {
    headers: enTetesDeRemise({ telecharger: veutTelecharger(requete.url), nom: `plan-d-arrosage-${jour}-version-${p.version}.pdf`, type: "application/pdf" }),
  });
}
