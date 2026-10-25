import { NextResponse } from "next/server";
import { CorpsTropGros, jsonBorne } from "@/server/corps-borne";
import { patronQuiImporte } from "@/server/import/garde";
import { creerEnvoi, fermerEnvoi, getEnvoi } from "@/server/repositories/pieces-importees";
import { refusDeLEnvoi } from "@/lib/import-pieces";

// Ouvrir un envoi (ou reprendre celui qui n'est pas rangé), puis le fermer.
//
// L'écran a déjà compté et refusé ; le serveur recompte, parce qu'un écran se
// contourne (`refusDeLEnvoi`, la même règle des deux côtés).

export const dynamic = "force-dynamic";

export async function POST(requete: Request) {
  const ctx = await patronQuiImporte();
  if (!ctx) return NextResponse.json({ error: "Introuvable" }, { status: 404 });
  // Quelques champs : 16 Ko suffisent largement, et rien de plus n'entre en mémoire.
  let lu: unknown;
  try {
    lu = await jsonBorne(requete, 16 * 1024);
  } catch (erreur) {
    if (erreur instanceof CorpsTropGros) return NextResponse.json({ ok: false, raison: "Demande trop longue." }, { status: 413 });
    throw erreur;
  }
  const corps = lu as
    | { nom?: unknown; nombre?: unknown; octets?: unknown; fermer?: unknown }
    | null;

  // La fin d'un envoi : il attend désormais ce qui est vraiment arrivé.
  if (typeof corps?.fermer === "string") {
    if (!(await getEnvoi(ctx, corps.fermer))) return NextResponse.json({ ok: false, raison: "Cet envoi n'existe plus." }, { status: 400 });
    await fermerEnvoi(ctx, corps.fermer);
    return NextResponse.json({ ok: true });
  }

  const nombre = typeof corps?.nombre === "number" ? Math.floor(corps.nombre) : 0;
  const octets = typeof corps?.octets === "number" ? corps.octets : 0;
  const refus = refusDeLEnvoi(nombre, octets);
  if (refus) return NextResponse.json({ ok: false, raison: refus }, { status: 400 });
  const nom = typeof corps?.nom === "string" && corps.nom.trim() ? corps.nom.trim() : "Devis et factures";
  const envoi = await creerEnvoi(ctx, nom, nombre);
  return NextResponse.json({ ok: true, envoiId: envoi.id });
}
