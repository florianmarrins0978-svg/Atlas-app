import { NextResponse } from "next/server";
import { getCurrentCtx } from "@/server/session-ctx";
import { exigerOuverture } from "@/server/garde-route";
import { peutOuvrir } from "@/server/autorisation";
import { fichierDuDossier } from "@/server/repositories/dossiers-comptables";
import { nomDuFecDuDossier } from "@/server/dossier-comptable";
import { lireObjet } from "@/server/storage";
import { enTetesDeRemise } from "@/lib/remise-de-fichier";
import { nomDeLExcel } from "@/lib/excel-du-dossier";

/**
 * L'EXCEL ET LE FEC D'IMPORT D'UN DOSSIER RANGÉ (ses choix du 24 novembre
 * 2026) : rangés avec le PDF au même instant, relus sous la RLS par
 * l'identifiant du dossier, jamais par une clé de stockage ; réservés à qui
 * ouvre le dossier, comme le PDF (`../pdf/route.ts`).
 *
 * Ils se TÉLÉCHARGENT toujours : ni l'un ni l'autre ne se regarde dans la
 * visionneuse, ils s'ouvrent dans le tableur ou le logiciel du comptable.
 */
const TYPE = {
  excel: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  // Le FEC est en ISO 8859-15 : le dire évite qu'un éditeur le lise en UTF-8
  // et casse chaque accent.
  fec: "text/plain; charset=iso-8859-15",
} as const;

export async function GET(_req: Request, { params }: { params: Promise<{ id: string; forme: string }> }) {
  const { id, forme } = await params;
  const ctx = await getCurrentCtx();
  const refus = await exigerOuverture(ctx);
  if (refus) return refus;
  if (!(await peutOuvrir(ctx, "/termines/comptable"))) return NextResponse.json({ error: "Introuvable" }, { status: 404 });
  if (!/^[0-9a-f-]{36}$/i.test(id) || (forme !== "excel" && forme !== "fec")) return NextResponse.json({ error: "Introuvable" }, { status: 404 });

  const d = await fichierDuDossier(ctx, id);
  // Un dossier rangé avant le 24 novembre 2026 n'a que son PDF.
  const cle = forme === "excel" ? d?.excelCle : d?.fecCle;
  if (!d || !cle) return NextResponse.json({ error: "Introuvable" }, { status: 404 });
  const fec = await nomDuFecDuDossier(ctx, d);
  const contenu = await lireObjet(cle);
  return new NextResponse(new Uint8Array(contenu), {
    headers: {
      ...enTetesDeRemise({ telecharger: true, nom: forme === "excel" ? nomDeLExcel(fec) : fec, type: TYPE[forme] }),
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
