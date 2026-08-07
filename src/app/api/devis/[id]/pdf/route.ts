import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getCurrentCtx } from "@/server/session-ctx";
import { withEntreprise } from "@/server/db/with-entreprise";
import { devis } from "@/server/db/schema";
import { genererPdfPourApercu, getOuCreerDevisBrouillon } from "@/server/repositories/devis";
import { lireObjet } from "@/server/storage";

export async function GET(requete: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await getCurrentCtx();

  // **« Aperçu » et « Télécharger » ne sont pas le même geste.**
  //
  // Le 7 août 2026, le patron : « quand je clique sur télécharger le PDF, ça me
  // propose pas de l'enregistrer, ça ouvre juste une page de plus ». Le lien
  // servait le document `inline` dans les deux cas — un navigateur l'affiche
  // alors, et n'offre rien. C'est le geste attendu pour un aperçu ; c'est
  // l'inverse de ce qu'il demandait.
  const enPieceJointe = new URL(requete.url).searchParams.get("telecharger") === "1";
  const disposition = enPieceJointe ? "attachment" : "inline";

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
          "Content-Disposition": `${disposition}; filename="devis-${d.numeroCommercial}.pdf"`,
        },
      });
    } catch {
      return NextResponse.json({ error: "Fichier introuvable" }, { status: 404 });
    }
  }

  // **Brouillon : on rafraîchit l'instantané AVANT d'imprimer.**
  //
  // Le 6 août 2026, le patron a écrit deux lignes sur l'écran du devis, touché
  // « Aperçu du PDF », et reçu un document vide : « rien n'a été enregistré ».
  // Ses lignes étaient pourtant bien en base — mais dans `lignes_prix`, celles
  // qu'il modifie, tandis que le PDF imprime `lignes_devis`, l'instantané du
  // document. Cet instantané n'était rafraîchi qu'au CHARGEMENT de la page,
  // donc avant qu'il n'écrive quoi que ce soit.
  //
  // Deux lectures d'une même chose qui divergent : exactement ce que
  // `CLAUDE.md` §3 interdit. Le rafraîchissement est donc fait ici, à
  // l'instant de l'impression — un aperçu qui montre autre chose que l'écran
  // ne sert à rien, et fait douter de ce qui est enregistré.
  //
  // Sans effet sur un devis envoyé : ce cas est déjà sorti plus haut, et
  // `getOuCreerDevisBrouillon` ne recalcule jamais un devis parti.
  await getOuCreerDevisBrouillon(ctx, d.chantierId);
  const pdfBytes = await genererPdfPourApercu(ctx, id);
  return new NextResponse(new Uint8Array(pdfBytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `${disposition}; filename="devis-${d.numeroCommercial}-brouillon.pdf"`,
    },
  });
}
