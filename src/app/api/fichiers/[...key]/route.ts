import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getCurrentCtx } from "@/server/session-ctx";
import { withEntreprise } from "@/server/db/with-entreprise";
import { photos, notesVocales, entreprises } from "@/server/db/schema";
import { lireObjet } from "@/server/storage";

// Équivalent local d'une URL signée : jamais de lien direct stocké, la clé est
// vérifiée à chaque requête contre l'entreprise du contexte avant lecture du
// fichier — remplacé par de vraies URLs signées à la connexion d'un bucket réel.
export async function GET(_req: Request, { params }: { params: Promise<{ key: string[] }> }) {
  const { key } = await params;
  const storageKey = key.join("/");

  const ctx = await getCurrentCtx();

  const mimeType = await withEntreprise(ctx.utilisateurId, ctx.entrepriseId, async (tx) => {
    const [photo] = await tx
      .select({ mimeType: photos.mimeType })
      .from(photos)
      .where(eq(photos.storageKey, storageKey))
      .limit(1);
    if (photo) return photo.mimeType;
    const [note] = await tx
      .select({ mimeType: notesVocales.mimeType })
      .from(notesVocales)
      .where(eq(notesVocales.storageKey, storageKey))
      .limit(1);
    if (note) return note.mimeType;
    // **Le logo de l'entreprise passe par le même guichet.** La ligne
    // `entreprises` est déjà bornée par l'isolation : une clef d'une autre
    // entreprise ne trouve rien ici, exactement comme une photo.
    const [e] = await tx
      .select({ mimeType: entreprises.logoMime })
      .from(entreprises)
      .where(eq(entreprises.logoStorageKey, storageKey))
      .limit(1);
    return e?.mimeType ?? null;
  });

  if (!mimeType) {
    return NextResponse.json({ error: "Fichier introuvable" }, { status: 404 });
  }

  try {
    const octets = await lireObjet(storageKey);
    return new NextResponse(new Uint8Array(octets), {
      headers: { "Content-Type": mimeType, "Cache-Control": "private, max-age=3600" },
    });
  } catch {
    return NextResponse.json({ error: "Fichier introuvable" }, { status: 404 });
  }
}
