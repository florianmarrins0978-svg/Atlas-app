import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getCurrentCtx } from "@/server/session-ctx";
import { withEntreprise } from "@/server/db/with-entreprise";
import { factures } from "@/server/db/schema";
import { genererPdfFacturePourApercu } from "@/server/repositories/factures";
import { lireObjet } from "@/server/storage";

// Sert la facture en PDF. Calquée sur la route du devis, et pour la même
// raison : une facture émise est immuable, donc on rend le fichier archivé au
// moment de l'émission — jamais une reconstruction depuis les données du jour,
// qui pourrait ne plus être celle que le client a reçue.
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await getCurrentCtx();

  const f = await withEntreprise(ctx.utilisateurId, ctx.entrepriseId, async (tx) => {
    const [row] = await tx.select().from(factures).where(eq(factures.id, id)).limit(1);
    return row ?? null;
  });

  if (!f) {
    return NextResponse.json({ error: "Facture introuvable" }, { status: 404 });
  }

  if (f.statut === "emise" && f.pdfStorageKey) {
    try {
      const octets = await lireObjet(f.pdfStorageKey);
      return new NextResponse(new Uint8Array(octets), {
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `inline; filename="facture-${f.numeroCommercial}.pdf"`,
        },
      });
    } catch {
      return NextResponse.json({ error: "Fichier introuvable" }, { status: 404 });
    }
  }

  const pdfBytes = await genererPdfFacturePourApercu(ctx, id);
  return new NextResponse(new Uint8Array(pdfBytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="facture-${f.numeroCommercial}-brouillon.pdf"`,
    },
  });
}
