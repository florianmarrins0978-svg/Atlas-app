import { NextResponse, after } from "next/server";
import { createHash } from "node:crypto";
import { patronQuiImporte } from "@/server/import/garde";
import { deposerPiece, empreintesConnues, getEnvoi } from "@/server/repositories/pieces-importees";
import { traiterPiecesEnAttente } from "@/server/import/traiter-pieces";
import { photoEnPdf, refusDuPdfImporte } from "@/server/import/lire-piece";
import { preparerPhotoEntrante } from "@/server/photo-entrante";
import { enregistrerObjet, supprimerObjet } from "@/server/storage";
import { verifierLimite, LIMITES } from "@/server/rate-limit";
import { logger } from "@/server/logger";
import { formatDuFichier, LIMITES_IMPORT } from "@/lib/import-pieces";

// Une pièce, et une seule par requête : le zip s'ouvre sur le téléphone, et le
// serveur ne reçoit jamais 1 Go d'un coup (`docs/importer-devis-factures.md`).
//
// **Un refus se rend, il ne se lève pas** : l'écran le nomme dans la liste des
// pièces non importées, au lieu d'un « erreur serveur » qui ne dit rien.
//
// La lecture part APRÈS la réponse (`after`) : l'envoi n'attend pas l'IA, et le
// serveur continue de lire quand le téléphone est fermé.

export const dynamic = "force-dynamic";

const EMPREINTE = /^[0-9a-f]{64}$/;
const refuser = (raison: string, status = 400) => NextResponse.json({ ok: false, raison }, { status });

export async function POST(requete: Request) {
  const ctx = await patronQuiImporte();
  if (!ctx) return NextResponse.json({ error: "Introuvable" }, { status: 404 });

  // La taille AVANT de lire le corps : rien ne passe en mémoire pour rien.
  const annonce = Number(requete.headers.get("content-length") ?? 0);
  if (annonce > LIMITES_IMPORT.octetsParDocument + 64 * 1024) return refuser("Ce fichier pèse plus de 15 Mo.", 413);

  const limite = await verifierLimite(`import-piece:${ctx.entrepriseId}`, LIMITES.importPiece);
  if (!limite.autorise) return refuser(limite.message, 429);

  const form = await requete.formData().catch(() => null);
  const fichier = form?.get("fichier");
  const envoiId = form?.get("envoiId");
  const empreinte = form?.get("empreinte");
  if (!(fichier instanceof File) || typeof envoiId !== "string" || typeof empreinte !== "string" || !EMPREINTE.test(empreinte)) {
    return refuser("Ce fichier n'est pas arrivé entier.");
  }
  if (fichier.size > LIMITES_IMPORT.octetsParDocument) return refuser("Ce fichier pèse plus de 15 Mo.", 413);
  if (!(await getEnvoi(ctx, envoiId))) return refuser("Cet envoi n'existe plus.");

  const brut = new Uint8Array(await fichier.arrayBuffer());
  // L'empreinte annoncée est recalculée : c'est elle qui dédoublonne, et un
  // écran ne la fixe pas à la place des octets.
  if (createHash("sha256").update(brut).digest("hex") !== empreinte) return refuser("Ce fichier n'est pas arrivé entier.");
  if ((await empreintesConnues(ctx, [empreinte])).length > 0) return NextResponse.json({ ok: true, deja: true });

  const format = formatDuFichier(fichier.name);
  let pdf: Uint8Array;
  if (format === "pdf") {
    const refus = await refusDuPdfImporte(brut);
    if (refus) return refuser(refus);
    pdf = brut;
  } else if (format === "photo") {
    const prete = await preparerPhotoEntrante(new File([brut], fichier.name, { type: fichier.type || "image/jpeg" }), "pièce importée");
    if (!prete.ok) return refuser(prete.raison);
    pdf = await photoEnPdf(prete.photo.octets, prete.photo.mimeType);
  } else {
    return refuser("Ce format ne s'importe pas. Choisissez des PDF, des photos ou un dossier .zip.");
  }

  const objet = await enregistrerObjet(`entreprises/${ctx.entrepriseId}/pieces-importees`, Buffer.from(pdf), ".pdf", "application/pdf");
  const piece = await deposerPiece(ctx, {
    envoiId,
    empreinte,
    fichierCle: objet.storageKey,
    fichierNom: fichier.name.slice(0, 160),
  });
  if (!piece) {
    // Le même fichier est arrivé deux fois au même instant : on ne garde pas le double.
    await supprimerObjet(objet.storageKey);
    return NextResponse.json({ ok: true, deja: true });
  }

  after(async () => {
    try {
      await traiterPiecesEnAttente(ctx);
    } catch (err) {
      logger.error("Lecture des pièces importées interrompue", { erreur: err instanceof Error ? err.message : String(err) });
    }
  });
  return NextResponse.json({ ok: true, deja: false });
}
