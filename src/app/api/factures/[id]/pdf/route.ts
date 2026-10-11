import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getCurrentCtx } from "@/server/session-ctx";
import { exigerOuverture } from "@/server/garde-route";
import { withEntreprise } from "@/server/db/with-entreprise";
import { factures } from "@/server/db/schema";
import { genererPdfFacturePourApercu } from "@/server/repositories/factures";
import { lireObjet } from "@/server/storage";
import { enTetesDeRemise, veutTelecharger } from "@/lib/remise-de-fichier";

// Sert la facture en PDF. Calquée sur la route du devis, et pour la même
// raison : une facture émise est immuable, donc on rend le fichier archivé au
// moment de l'émission — jamais une reconstruction depuis les données du jour,
// qui pourrait ne plus être celle que le client a reçue.
//
// **`?telecharger=1` range le fichier au lieu de l'ouvrir.** Le patron, le
// 10 août 2026 : sous « Voir la facture en PDF », il ne pouvait que la
// regarder, jamais la garder (`TODO.md` §8). C'est le serveur qui tranche, et
// non le seul attribut `download` du lien : celui-ci est ignoré par certaines
// versions d'iOS, et le PDF s'ouvrait alors dans un onglet, sans rien ranger.
//
// **Et la disposition ne suffisait pas non plus** — son constat du 7 septembre
// 2026 : « quand je clique sur télécharger ça ne la télécharge pas ». Un PDF
// servi comme un PDF reste un document que Safari sait peindre. Ce qui range
// vraiment le fichier est dans `src/lib/remise-de-fichier.ts`, avec ses
// raisons.
//
// **Et le nom du fichier porte le numéro** — « F2026-0001.pdf ». Il en aura des
// centaines dans le même dossier ; « facture (17).pdf » ne se retrouve pas.
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const telecharger = veutTelecharger(req.url);
  const ctx = await getCurrentCtx();

  // Le rôle referme ce que la barre du bas ne montre plus : une adresse d'API
  // se tape, et une page retirée du sommaire répondait quand même.
  const refus = await exigerOuverture(ctx);
  if (refus) return refus;
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
        headers: enTetesDeRemise({
          telecharger,
          nom: `${f.numeroCommercial}.pdf`,
          type: "application/pdf",
        }),
      });
    } catch {
      return NextResponse.json({ error: "Fichier introuvable" }, { status: 404 });
    }
  }

  const pdfBytes = await genererPdfFacturePourApercu(ctx, id);
  return new NextResponse(new Uint8Array(pdfBytes), {
    // Un brouillon le dit dans son nom : deux fichiers du même numéro
    // finiraient par cohabiter dans son dossier, et rien ne dirait lequel le
    // client a reçu.
    headers: enTetesDeRemise({
      telecharger,
      nom: `${f.numeroCommercial}-brouillon.pdf`,
      type: "application/pdf",
    }),
  });
}
