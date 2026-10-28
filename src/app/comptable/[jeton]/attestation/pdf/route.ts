import { NextResponse } from "next/server";
import { fichierDeLAttestationParJeton } from "@/server/repositories/verification-comptable";
import { lireObjet } from "@/server/storage";
import { enTetesDeRemise, veutTelecharger } from "@/lib/remise-de-fichier";

/**
 * L'ATTESTATION SIGNÉE, pour le comptable qui veut la garder : la dernière de
 * SON lien, jamais une clé de stockage venue du navigateur. Un jeton inconnu
 * ou expiré rend « introuvable ».
 */
export async function GET(req: Request, { params }: { params: Promise<{ jeton: string }> }) {
  const { jeton } = await params;
  const a = await fichierDeLAttestationParJeton(jeton);
  if (!a) return NextResponse.json({ error: "Introuvable" }, { status: 404 });
  const contenu = await lireObjet(a.cle);
  return new NextResponse(new Uint8Array(contenu), {
    headers: {
      ...enTetesDeRemise({ telecharger: veutTelecharger(req.url), nom: "Attestation de vérification.pdf", type: "application/pdf" }),
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
      "X-Robots-Tag": "noindex",
    },
  });
}
