import { getCurrentCtx } from "@/server/session-ctx";
import { exigerOuverture } from "@/server/garde-route";
import { verifierLimite } from "@/server/rate-limit";
import { LIMITES } from "@/server/rate-limit/types";
import { tuileDemandee } from "@/lib/carte-du-point";
import { lireUneTuile } from "@/server/carte/geoplateforme-tuiles";

// Une tuile de la carte du point GPS (fiche de sécurité).
//
// **Réservée à quelqu'un de connecté, et comptée**, comme l'aide aux adresses :
// sans cela, l'adresse publique du banc d'essai deviendrait un relais ouvert
// vers l'IGN, et c'est nous qui serions coupés.

export const dynamic = "force-dynamic";

export async function GET(requete: Request) {
  const ctx = await getCurrentCtx();
  const refus = await exigerOuverture(ctx);
  if (refus) return refus;
  const limite = await verifierLimite(`carte:${ctx.entrepriseId}`, LIMITES.tuilesDeCarte);
  if (!limite.autorise) return new Response(null, { status: 429 });

  const q = new URL(requete.url).searchParams;
  const demande = tuileDemandee(q.get("fond"), q.get("z"), q.get("x"), q.get("y"));
  if (!demande) return new Response(null, { status: 400 });
  const tuile = await lireUneTuile(demande.fond, demande.z, demande.x, demande.y);
  if (!tuile) return new Response(null, { status: 502 });
  return new Response(new Blob([new Uint8Array(tuile.octets)], { type: tuile.mime }), {
    // Une tuile ne change pas d'un jour à l'autre ; privée, parce que la route l'est.
    headers: { "Cache-Control": "private, max-age=86400" },
  });
}
