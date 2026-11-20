import { NextResponse } from "next/server";
import { getCurrentCtx } from "@/server/session-ctx";
import { exigerOuverture } from "@/server/garde-route";
import { lireClePhotoDiagnostic } from "@/server/repositories/diagnostics";
import { lireObjet } from "@/server/storage";
import { logger } from "@/server/logger";
import { typeDepuisCle } from "@/lib/type-de-fichier";

/**
 * Servir SA photo de diagnostic, pour la vignette d'un dossier (sa demande du
 * 20 novembre 2026 : retrouver ce qu'il a déjà photographié).
 *
 * **Par identifiant, jamais par clé de stockage**, comme
 * `/api/phyto/image/[id]` : une route qui accepterait une clé laisserait
 * deviner un chemin. L'identifiant est relu sous RLS ET contre l'entreprise du
 * contexte (`lireClePhotoDiagnostic`) : la photo d'un jardin prise par une
 * autre société ne sort jamais d'ici.
 *
 * **Le type vient de l'extension que le SERVEUR a posée**, pas de ce que le
 * navigateur avait déclaré (audit du 23 août 2026, constat M1, voir
 * `/api/fichiers`). Une photo purgée ne se sert plus.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
    return NextResponse.json({ erreur: "Photo introuvable." }, { status: 404 });
  }

  const ctx = await getCurrentCtx();
  // Une photo de diagnostic est une donnée d'entreprise : elle suit le rôle.
  const refus = await exigerOuverture(ctx);
  if (refus) return refus;

  const cle = await lireClePhotoDiagnostic(ctx, id);
  if (!cle) return NextResponse.json({ erreur: "Photo introuvable." }, { status: 404 });

  let octets: Buffer;
  try {
    octets = await lireObjet(cle);
  } catch (erreur) {
    // La ligne existe et le fichier manque : ce n'est pas un refus, c'est une
    // panne du stockage, et elle se dit dans le journal avant de répondre.
    logger.error("Photo de diagnostic absente du stockage", { photoId: id, erreur });
    return NextResponse.json({ erreur: "Photo introuvable." }, { status: 404 });
  }
  return new NextResponse(new Uint8Array(octets), {
    headers: {
      "Content-Type": typeDepuisCle(cle),
      "X-Content-Type-Options": "nosniff",
      // Privée : c'est la photo d'un jardin, elle ne se garde que chez lui.
      "Cache-Control": "private, max-age=3600",
    },
  });
}
