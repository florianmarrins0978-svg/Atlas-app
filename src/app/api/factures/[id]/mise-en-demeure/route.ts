import { NextResponse } from "next/server";
import { getCurrentCtx } from "@/server/session-ctx";
import { exigerOuverture } from "@/server/garde-route";
import { miseEnDemeure } from "@/server/repositories/factures-non-payees";
import { genererPdfMiseEnDemeure } from "@/server/pdf/mise-en-demeure-pdf";
import { enTetesDeRemise, veutTelecharger } from "@/lib/remise-de-fichier";
import { jourIso } from "@/lib/jour";

// La lettre de mise en demeure, à télécharger puis envoyer en recommandé
// (planche `appli/mise-en-demeure.html`, 24 septembre 2026).
//
// **Composée à la demande, datée du jour, jamais archivée** : ce n'est pas une
// pièce comptable. La preuve, c'est l'accusé de réception de la Poste, pas un
// fichier chez nous ; et une lettre téléchargée un mois plus tard doit porter
// sa vraie date et le reste dû de ce jour-là.
//
// La porte est celle de la facture (`FACTURE_DU_CHANTIER`, `acces-roles.ts`) :
// un rôle qui ne voit pas la facture ne réclame pas son paiement.
export const dynamic = "force-dynamic";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await getCurrentCtx();
  const refus = await exigerOuverture(ctx);
  if (refus) return refus;

  const r = await miseEnDemeure(ctx, id, jourIso(new Date()));
  if (!r.ok) {
    console.error("[mise en demeure] refusée", { factureId: id, refus: r.refus });
    return NextResponse.json({ error: r.refus }, { status: 404 });
  }
  const pdf = await genererPdfMiseEnDemeure(r.lettre, r.entete);
  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      ...enTetesDeRemise({ telecharger: veutTelecharger(req.url), nom: `mise-en-demeure-${r.numero}.pdf`, type: "application/pdf" }),
      "Cache-Control": "no-store",
    },
  });
}
