import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getCurrentCtx } from "@/server/session-ctx";
import { withEntreprise } from "@/server/db/with-entreprise";
import { devis } from "@/server/db/schema";
import { genererPdfPourApercu } from "@/server/repositories/devis";
import { lireObjet } from "@/server/storage";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await getCurrentCtx();

  const d = await withEntreprise(ctx.utilisateurId, ctx.entrepriseId, async (tx) => {
    const [row] = await tx.select().from(devis).where(eq(devis.id, id)).limit(1);
    return row ?? null;
  });

  if (!d) {
    return NextResponse.json({ error: "Devis introuvable" }, { status: 404 });
  }

  // Devis envoyé : sert le PDF réellement stocké au moment de l'envoi — jamais
  // régénéré depuis les données courantes du chantier.
  if (d.statut === "envoye" && d.pdfStorageKey) {
    try {
      const octets = await lireObjet(d.pdfStorageKey);
      return new NextResponse(new Uint8Array(octets), {
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `inline; filename="devis-${d.numeroCommercial}.pdf"`,
        },
      });
    } catch {
      return NextResponse.json({ error: "Fichier introuvable" }, { status: 404 });
    }
  }

  // Brouillon : aperçu généré à la demande, jamais stocké.
  const pdfBytes = await genererPdfPourApercu(ctx, id);
  return new NextResponse(new Uint8Array(pdfBytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="devis-${d.numeroCommercial}-brouillon.pdf"`,
    },
  });
}
