import { NextResponse } from "next/server";
import { patronQuiImporte } from "@/server/import/garde";
import { empreintesConnues } from "@/server/repositories/pieces-importees";

// Ce qui est déjà gardé, parmi un paquet de pièces : l'écran ne renvoie pas ce
// qui est là. C'est ce qui fait reprendre un envoi coupé où il en était, et
// qui empêche un même zip importé deux fois de rien doubler.

export const dynamic = "force-dynamic";

const EMPREINTE = /^[0-9a-f]{64}$/;
/** Un paquet à la fois : l'écran en envoie quelques-unes, jamais deux mille. */
const PAQUET_MAX = 50;

export async function POST(requete: Request) {
  const ctx = await patronQuiImporte();
  if (!ctx) return NextResponse.json({ error: "Introuvable" }, { status: 404 });
  const corps = (await requete.json().catch(() => null)) as { empreintes?: unknown } | null;
  const empreintes = (Array.isArray(corps?.empreintes) ? corps.empreintes : [])
    .filter((e): e is string => typeof e === "string" && EMPREINTE.test(e))
    .slice(0, PAQUET_MAX);
  return NextResponse.json({ connues: await empreintesConnues(ctx, empreintes) });
}
