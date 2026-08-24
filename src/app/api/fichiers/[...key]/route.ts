import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getCurrentCtx } from "@/server/session-ctx";
import { withEntreprise } from "@/server/db/with-entreprise";
import { photos, notesVocales, entreprises } from "@/server/db/schema";
import { lireObjet } from "@/server/storage";
import { typeDepuisCle } from "@/lib/type-de-fichier";

// Équivalent local d'une URL signée : jamais de lien direct stocké, la clé est
// vérifiée à chaque requête contre l'entreprise du contexte avant lecture du
// fichier — remplacé par de vraies URLs signées à la connexion d'un bucket réel.
//
// ─────────────────────────────────────────────────────────────────────────────
// **LE TYPE SERVI NE VIENT PLUS DE LA BASE, et c'était une faille** (audit du
// 23 août 2026, constat M1). Cette route renvoyait `photos.mimeType`, écrit au
// dépôt tel que **le navigateur l'avait déclaré**. Annoncer `image/svg+xml`
// faisait donc servir un document SVG depuis notre propre domaine — et un SVG
// peut porter du script, qui s'exécute alors avec la session de l'artisan.
//
// La requête ci-dessous ne sert plus qu'à **autoriser** : elle répond « cette
// clé appartient-elle à cette entreprise ? ». Le type, lui, se déduit de
// l'extension, que le SERVEUR a posée (`src/lib/type-de-fichier.ts`).
//
// **`nosniff` ne suffisait pas**, et il faut le dire pour qu'on ne le croie pas
// une seconde fois : il interdit de DEVINER un type, pas d'en annoncer un.
export async function GET(_req: Request, { params }: { params: Promise<{ key: string[] }> }) {
  const { key } = await params;
  const storageKey = key.join("/");

  const ctx = await getCurrentCtx();

  const autorise = await withEntreprise(ctx.utilisateurId, ctx.entrepriseId, async (tx) => {
    const [photo] = await tx
      .select({ id: photos.id })
      .from(photos)
      .where(eq(photos.storageKey, storageKey))
      .limit(1);
    if (photo) return true;
    const [note] = await tx
      .select({ id: notesVocales.id })
      .from(notesVocales)
      .where(eq(notesVocales.storageKey, storageKey))
      .limit(1);
    if (note) return true;
    // **Le logo de l'entreprise passe par le même guichet.** La ligne
    // `entreprises` est déjà bornée par l'isolation : une clef d'une autre
    // entreprise ne trouve rien ici, exactement comme une photo.
    const [e] = await tx
      .select({ id: entreprises.id })
      .from(entreprises)
      .where(eq(entreprises.logoStorageKey, storageKey))
      .limit(1);
    return Boolean(e);
  });

  if (!autorise) {
    return NextResponse.json({ error: "Fichier introuvable" }, { status: 404 });
  }

  try {
    const octets = await lireObjet(storageKey);
    return new NextResponse(new Uint8Array(octets), {
      headers: { "Content-Type": typeDepuisCle(storageKey), "Cache-Control": "private, max-age=3600" },
    });
  } catch {
    return NextResponse.json({ error: "Fichier introuvable" }, { status: 404 });
  }
}
