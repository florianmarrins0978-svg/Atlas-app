import { NextResponse } from "next/server";
import { getCurrentCtx } from "@/server/session-ctx";
import { exigerOuverture } from "@/server/garde-route";
import { getVehicule, COLONNES_DU_DOCUMENT } from "@/server/repositories/vehicules";
import { lireObjet } from "@/server/storage";
import { NATURES_DOCUMENT_VEHICULE, typeDuDocument, type NatureDocumentVehicule } from "@/lib/vehicules";

/**
 * Ouvrir un papier de véhicule — la carte grise ou l'assurance qu'un salarié
 * montre au constat, depuis son téléphone.
 *
 * **Sous `/reglages/vehicules`, et non sous `/api/fichiers`** : cette adresse
 * est ouverte à tous les rôles (`REGLAGES_A_TOUS`) ; celle des fichiers ne
 * l'est pas au salarié, et l'y ouvrir lui donnerait aussi les photos de
 * chantier. `exigerOuverture` applique la même règle que l'écran.
 *
 * La clé ne vient jamais de l'adresse : elle se lit sur la ligne du véhicule,
 * que l'isolation borne à l'entreprise. Le type servi se déduit de son
 * extension, posée par le serveur (`typeDuDocument`).
 */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string; nature: string }> }) {
  const { id, nature } = await params;
  const ctx = await getCurrentCtx();
  const refus = await exigerOuverture(ctx);
  if (refus) return refus;

  if (!(NATURES_DOCUMENT_VEHICULE as readonly string[]).includes(nature)) {
    return NextResponse.json({ error: "Introuvable" }, { status: 404 });
  }
  const vehicule = await getVehicule(ctx, id);
  const cle = vehicule ? (vehicule[COLONNES_DU_DOCUMENT[nature as NatureDocumentVehicule].cle] as string | null) : null;
  const type = cle ? typeDuDocument(cle) : null;
  if (!cle || !type) return NextResponse.json({ error: "Introuvable" }, { status: 404 });

  const contenu = await lireObjet(cle);
  return new NextResponse(new Uint8Array(contenu), {
    headers: {
      "Content-Type": type,
      "Content-Disposition": "inline",
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
