import { NextResponse } from "next/server";
import { getCurrentCtx } from "@/server/session-ctx";
import { exigerOuverture } from "@/server/garde-route";
import { estProprietaire } from "@/server/autorisation";
import { getDevisRecu } from "@/server/repositories/fournisseurs-partenaires";
import { lireObjet } from "@/server/storage";
import { typeDuDocument } from "@/lib/vehicules";

/**
 * Ouvrir un devis reçu — sa photo ou son PDF, depuis « Devis reçus ».
 *
 * **Le patron seul**, comme la rubrique : ce sont les prix de ses fournisseurs.
 * La clé ne vient jamais de l'adresse : elle se lit sur la ligne du devis, que
 * l'isolation borne à l'entreprise. Le type servi se déduit de son extension,
 * posée par le serveur.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await getCurrentCtx();
  const refus = await exigerOuverture(ctx);
  if (refus) return refus;
  if (!(await estProprietaire(ctx))) return NextResponse.json({ error: "Introuvable" }, { status: 404 });

  const devis = await getDevisRecu(ctx, id);
  const type = devis ? typeDuDocument(devis.fichierCle) : null;
  if (!devis || !type) return NextResponse.json({ error: "Introuvable" }, { status: 404 });

  const contenu = await lireObjet(devis.fichierCle);
  return new NextResponse(new Uint8Array(contenu), {
    headers: {
      "Content-Type": type,
      "Content-Disposition": "inline",
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
