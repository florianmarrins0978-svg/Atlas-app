import { NextResponse } from "next/server";
import { getCurrentCtx } from "@/server/session-ctx";
import { exigerOuverture } from "@/server/garde-route";
import { estProprietaire } from "@/server/autorisation";
import { getDevisRecu } from "@/server/repositories/fournisseurs-partenaires";
import { lireObjet } from "@/server/storage";
import { typeDuFichierRecu } from "@/lib/devis-fournisseur-lu";

/**
 * Ouvrir un devis ou une facture reçus — sa photo, son PDF ou son tableur,
 * depuis « Devis » ou « Factures ».
 *
 * **Le patron seul**, comme la rubrique : ce sont les prix de ses fournisseurs.
 * La clé ne vient jamais de l'adresse : elle se lit sur la ligne du devis, que
 * l'isolation borne à l'entreprise. Le type servi se déduit de son extension,
 * posée par le serveur ; un tableur se télécharge.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await getCurrentCtx();
  const refus = await exigerOuverture(ctx);
  if (refus) return refus;
  if (!(await estProprietaire(ctx))) return NextResponse.json({ error: "Introuvable" }, { status: 404 });

  const devis = await getDevisRecu(ctx, id);
  const type = devis ? typeDuFichierRecu(devis.fichierCle) : null;
  if (!devis || !type) return NextResponse.json({ error: "Introuvable" }, { status: 404 });

  const contenu = await lireObjet(devis.fichierCle);
  // Un en-tête HTTP ne porte que de l'ASCII : « Facture d'octobre » y perd ses
  // accents plutôt que de faire tomber la réponse.
  const nomJoint = `${devis.nom.normalize("NFD").replace(/[^A-Za-z0-9 ._-]/g, "").trim() || "document"}${devis.fichierCle.slice(devis.fichierCle.lastIndexOf("."))}`;
  return new NextResponse(new Uint8Array(contenu), {
    headers: {
      "Content-Type": type.type,
      "Content-Disposition": type.joint ? `attachment; filename="${nomJoint}"` : "inline",
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
