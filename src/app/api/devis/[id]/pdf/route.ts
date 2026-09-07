import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getCurrentCtx } from "@/server/session-ctx";
import { exigerOuverture } from "@/server/garde-route";
import { withEntreprise } from "@/server/db/with-entreprise";
import { devis } from "@/server/db/schema";
import { genererPdfPourApercu, getOuCreerDevisBrouillon } from "@/server/repositories/devis";
import { lireObjet } from "@/server/storage";
import { enTetesDeRemise, veutTelecharger } from "@/lib/remise-de-fichier";

export async function GET(requete: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await getCurrentCtx();

  // Le rôle referme ce que la barre du bas ne montre plus : une adresse d'API
  // se tape, et une page retirée du sommaire répondait quand même.
  const refus = await exigerOuverture(ctx);
  if (refus) return refus;
  // **« Aperçu » et « Télécharger » ne sont pas le même geste.**
  //
  // Le 7 août 2026, le patron : « quand je clique sur télécharger le PDF, ça me
  // propose pas de l'enregistrer, ça ouvre juste une page de plus ». Le lien
  // servait le document `inline` dans les deux cas — un navigateur l'affiche
  // alors, et n'offre rien. C'est le geste attendu pour un aperçu ; c'est
  // l'inverse de ce qu'il demandait.
  //
  // **Et servir le PDF comme un PDF ne suffisait pas** (7 septembre 2026) :
  // Safari le peint alors au lieu de l'enregistrer. Voir
  // `src/lib/remise-de-fichier.ts`.
  const enPieceJointe = veutTelecharger(requete.url);

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
        headers: enTetesDeRemise({
          telecharger: enPieceJointe,
          nom: `devis-${d.numeroCommercial}.pdf`,
          type: "application/pdf",
        }),
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
    headers: enTetesDeRemise({
      telecharger: enPieceJointe,
      nom: `devis-${d.numeroCommercial}-brouillon.pdf`,
      type: "application/pdf",
    }),
  });
}
