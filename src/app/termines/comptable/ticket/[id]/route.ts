import { NextResponse } from "next/server";
import { getCurrentCtx } from "@/server/session-ctx";
import { exigerOuverture } from "@/server/garde-route";
import { peutOuvrir } from "@/server/autorisation";
import { photoDuTicket } from "@/server/repositories/pour-mon-comptable";
import { lireObjet } from "@/server/storage";
import { typeDepuisCle } from "@/lib/type-de-fichier";

/**
 * LA PHOTO D'UN TICKET — pour la voir depuis le relevé du dossier.
 *
 * **Aucune route ne servait encore `achats_tva.photo_cle`** : `/api/fichiers`
 * ne sert que les photos de chantier, les notes et le logo. Celle-ci ne prend
 * pas une clé de stockage mais l'identifiant du TICKET, relu sous la RLS : une
 * clé tapée à la main, ou le ticket d'une autre entreprise, rend « introuvable ».
 *
 * Réservée à qui ouvre le dossier (patron et facturation) : un écran gardé ne
 * suffit pas, une route s'appelle sans passer par l'écran.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await getCurrentCtx();
  const refus = await exigerOuverture(ctx);
  if (refus) return refus;
  if (!(await peutOuvrir(ctx, "/termines/comptable"))) return NextResponse.json({ error: "Introuvable" }, { status: 404 });
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
