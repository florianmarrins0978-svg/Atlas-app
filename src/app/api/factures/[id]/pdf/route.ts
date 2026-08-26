import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getCurrentCtx } from "@/server/session-ctx";
import { exigerOuverture } from "@/server/garde-route";
import { withEntreprise } from "@/server/db/with-entreprise";
import { factures } from "@/server/db/schema";
import { genererPdfFacturePourApercu } from "@/server/repositories/factures";
import { lireObjet } from "@/server/storage";

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
// **Et le nom du fichier porte le numéro** — « F2026-0001.pdf ». Il en aura des
// centaines dans le même dossier ; « facture (17).pdf » ne se retrouve pas.
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const telecharger = new URL(req.url).searchParams.get("telecharger") === "1";
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
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": remise(telecharger, `${f.numeroCommercial}.pdf`),
        },
      });
    } catch {
      return NextResponse.json({ error: "Fichier introuvable" }, { status: 404 });
    }
  }

  const pdfBytes = await genererPdfFacturePourApercu(ctx, id);
  return new NextResponse(new Uint8Array(pdfBytes), {
    headers: {
      "Content-Type": "application/pdf",
      // Un brouillon le dit dans son nom : deux fichiers du même numéro
      // finiraient par cohabiter dans son dossier, et rien ne dirait lequel
      // le client a reçu.
      "Content-Disposition": remise(telecharger, `${f.numeroCommercial}-brouillon.pdf`),
    },
  });
}

/** `attachment` range le fichier, `inline` l'ouvre. Le nom est le même dans les deux cas. */
function remise(telecharger: boolean, nom: string): string {
  return `${telecharger ? "attachment" : "inline"}; filename="${nom}"`;
}
