import { NextResponse } from "next/server";
import { getCurrentCtx } from "@/server/session-ctx";
import { getRole } from "@/server/autorisation";
import { exigerChantierDansSaPortee } from "@/server/garde-action";
import { peutPoserUnRetour } from "@/lib/acces-roles";
import { contexteDuChantier, ficheDuChantier } from "@/server/repositories/fiches-securite";
import { listerPhotos } from "@/server/repositories/photos";
import { lireObjet } from "@/server/storage";
import { composerFicheSecuritePdf } from "@/server/pdf/fiche-securite-pdf";
import { enTetesDeRemise, veutTelecharger } from "@/lib/remise-de-fichier";

// LE PDF DE LA FICHE DE SÉCURITÉ — refait à la demande depuis le contenu gardé.
//
// Sous /planning, comme la fiche elle-même : un salarié doit pouvoir l'ouvrir
// sur le chantier (« disponible en permanence sur le chantier »). Le même
// chemin sert « Ouvrir » (dans le navigateur), « Enregistrer » (`?telecharger=1`,
// le téléphone le range dans ses fichiers) et « Transmettre » (le PDF lu puis
// posé sur la feuille de partage).

export async function GET(requete: Request, { params }: { params: Promise<{ chantierId: string }> }) {
  const { chantierId } = await params;
  const ctx = await getCurrentCtx();
  const role = await getRole(ctx);
  if (!role || !peutPoserUnRetour(role)) return NextResponse.json({ error: "Interdit" }, { status: 403 });
  await exigerChantierDansSaPortee(ctx, chantierId, "ouvrir le PDF de la fiche de sécurité");
  const [fiche, contexte] = await Promise.all([ficheDuChantier(ctx, chantierId), contexteDuChantier(ctx, chantierId)]);
  if (!fiche || !contexte) return NextResponse.json({ error: "Aucune fiche pour ce chantier" }, { status: 404 });
  const photosDuChantier = await listerPhotos(ctx, chantierId);
  const gardees = fiche.contenu.photoIds
    .map((id) => photosDuChantier.find((p) => p.id === id))
    .filter((p): p is NonNullable<typeof p> => p !== undefined);
  const photos = await Promise.all(
    gardees.map(async (p) => ({ octets: new Uint8Array(await lireObjet(p.storageKey)), mime: p.mimeType }))
  );
  const pdf = await composerFicheSecuritePdf({
    chantierNom: contexte.chantierNom,
    numeroDevis: contexte.numeroDevis,
    adresse: contexte.adresse,
    jour: contexte.datePlanifiee,
    entrepriseNom: contexte.entreprise.nom,
    clientNom: contexte.client?.nom ?? null,
    contenu: fiche.contenu,
    signataire: fiche.signataire,
    signeeLe: fiche.signeeLe,
    signaturePng: fiche.signaturePng,
    photos,
  });
  return new NextResponse(new Uint8Array(pdf), {
    headers: enTetesDeRemise({
      telecharger: veutTelecharger(requete.url),
      nom: "fiche-de-securite.pdf",
      type: "application/pdf",
    }),
  });
}
