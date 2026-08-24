import { NextResponse } from "next/server";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { TYPOGRAPHIES } from "@/lib/allure-documents";

/**
 * LES POLICES DES DOCUMENTS, SERVIES À L'ÉCRAN.
 *
 * **Sans elles, l'écran des réglages ment.** Il propose neuf typographies ; le
 * navigateur, lui, n'en connaît aucune — il retombe sur Georgia pour les quatre
 * serif et sur la police de l'appareil pour les cinq linéales. Le patron
 * choisissait donc « Playfair Display » en regardant du Georgia, et découvrait
 * la vraie sur le devis parti chez son client. Vu à la capture, le 24 août 2026.
 *
 * **Ce sont EXACTEMENT les fichiers que le PDF embarque**, pas une copie dans
 * `public/`. Deux jeux de fichiers finiraient par diverger, et c'est l'aperçu
 * qui aurait raison à l'écran pendant que le document aurait raison chez le
 * client (`CLAUDE.md` §3).
 *
 * **Le nom demandé n'est jamais concaténé au chemin.** Il est cherché dans la
 * liste des typographies : tout ce qui n'y figure pas repart en 404, et aucun
 * `../` ne peut remonter dans le dépôt.
 */
const AUTORISES = new Set(
  TYPOGRAPHIES.flatMap((t) => (t.fichiers ? [t.fichiers.normal, t.fichiers.gras] : []))
);

export async function GET(_req: Request, { params }: { params: Promise<{ fichier: string }> }) {
  const { fichier } = await params;
  if (!AUTORISES.has(fichier)) {
    return NextResponse.json({ error: "Police inconnue" }, { status: 404 });
  }
  try {
    const octets = await readFile(path.join(process.cwd(), "src/server/pdf/polices", fichier));
    return new NextResponse(new Uint8Array(octets), {
      headers: {
        "Content-Type": "font/ttf",
        // Elles ne changent jamais sans changer de nom : un an de cache, et
        // c'est autant de moins à télécharger sur un forfait de chantier.
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch {
    return NextResponse.json({ error: "Police introuvable" }, { status: 404 });
  }
}
