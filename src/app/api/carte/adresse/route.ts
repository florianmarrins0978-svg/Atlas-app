import { NextResponse } from "next/server";
import { getCurrentCtx } from "@/server/session-ctx";
import { exigerOuverture } from "@/server/garde-route";
import { verifierLimite } from "@/server/rate-limit";
import { LIMITES } from "@/server/rate-limit/types";
import { lireLeGps } from "@/lib/carte-du-point";
import { adresseAuPoint } from "@/server/adresses/base-adresse-nationale";

// L'adresse au point GPS de la fiche de sécurité. Comptée avec l'aide aux
// adresses : c'est le même service, et la même raison de ne pas en être un relais.

export const dynamic = "force-dynamic";

export async function GET(requete: Request) {
  const ctx = await getCurrentCtx();
  const refus = await exigerOuverture(ctx);
  if (refus) return refus;
  const limite = await verifierLimite(`adresses:${ctx.entrepriseId}`, LIMITES.rechercheAdresse);
  if (!limite.autorise) return NextResponse.json({ adresse: null });

  const point = lireLeGps(new URL(requete.url).searchParams.get("gps") ?? "");
  if (!point) return NextResponse.json({ adresse: null }, { status: 400 });
  return NextResponse.json({ adresse: await adresseAuPoint(point.lat, point.lon) }, { headers: { "Cache-Control": "no-store" } });
}
