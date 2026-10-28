import { NextResponse } from "next/server";
import { getCurrentCtx } from "@/server/session-ctx";
import { exigerOuverture } from "@/server/garde-route";
import { photoDuTicket } from "@/server/repositories/achats-tva";
import { lireObjet } from "@/server/storage";
import { typeDepuisCle } from "@/lib/type-de-fichier";

/**
 * LA PHOTO D'UN TICKET, par l'identifiant de l'achat.
 *
 * **Sa demande du 27 octobre 2026** : que l'assistant joigne le ticket de
 * carburant ou de restaurant qu'il a retrouvé. Jusque-là, un ticket ne
 * s'ouvrait que rapproché d'une ligne de banque (`comptable/piece/[ligne]`) ;
 * un ticket encore seul n'avait aucune adresse.
 *
 * Sous `/termines/tva`, l'écran des tickets : `exigerOuverture` lit ce chemin
 * et ferme la route à qui n'ouvre pas cet écran (le salarié, le commercial).
 */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await getCurrentCtx();
  const refus = await exigerOuverture(ctx);
  if (refus) return refus;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: "Introuvable" }, { status: 404 });

  const cle = await photoDuTicket(ctx, id);
  if (!cle) return NextResponse.json({ error: "Introuvable" }, { status: 404 });
  const contenu = await lireObjet(cle);
  return new NextResponse(new Uint8Array(contenu), {
    headers: {
      "Content-Type": typeDepuisCle(cle),
      "Content-Disposition": "inline",
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
