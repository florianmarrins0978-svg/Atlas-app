import { NextResponse } from "next/server";
import { getCurrentCtx } from "@/server/session-ctx";
import { getRole } from "@/server/autorisation";
import { cheminAutorise } from "@/lib/acces-roles";
import { lirePlan } from "@/server/repositories/dossiers-arrosage";
import { lireObjet } from "@/server/storage";
import { typeDepuisCle } from "@/lib/type-de-fichier";

/**
 * La photo du croquis d'un plan enregistré, pour « Voir la saisie » (sa
 * réponse 3 : elle est gardée). Mêmes portes que le PDF : l'écran « Paysage »
 * de son rôle, et le dossier de son entreprise. Un dossier oublié n'en a plus
 * (`oublierDesDossiersDans`) : 404, jamais une image d'un autre.
 */
export const dynamic = "force-dynamic";

export async function GET(_requete: Request, { params }: { params: Promise<{ dossier: string; plan: string }> }) {
  const { dossier, plan } = await params;
  const ctx = await getCurrentCtx();
  const role = await getRole(ctx);
  if (!role || !cheminAutorise(role, "/paysage")) return NextResponse.json({ error: "Interdit" }, { status: 403 });
  const p = await lirePlan(ctx, dossier, plan);
  if (!p || !p.photoCle) return NextResponse.json({ error: "Cette photo n'est plus là" }, { status: 404 });
  const octets = await lireObjet(p.photoCle);
  return new NextResponse(new Uint8Array(octets), {
    headers: { "Content-Type": typeDepuisCle(p.photoCle), "Cache-Control": "private, max-age=3600" },
  });
}
