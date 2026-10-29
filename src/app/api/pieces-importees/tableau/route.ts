import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { CorpsTropGros, formDataBornee } from "@/server/corps-borne";
import { patronQuiImporte } from "@/server/import/garde";
import { grilleDuFichier } from "@/server/import/lire-tableau";
import { clientsQuOnPeutReconnaitre } from "@/server/repositories/clients";
import { rangerTableau } from "@/server/repositories/pieces-importees";
import { verifierLimite, LIMITES } from "@/server/rate-limit";
import { logger } from "@/server/logger";
import {
  lireLignes,
  OCTETS_TABLEAU_MAX,
  planDeRangement,
  reglagesDesDecisions,
  type ChoixAdresse,
  type Decisions,
} from "@/lib/import-tableau";

// IMPORTER UN TABLEAU DE DEVIS ET FACTURES — ses demandes du 28 octobre 2026,
// planche `appli/soignee/clients-importer.html`.
//
// **Deux temps, une seule route.** Sans réponses, elle LIT : les cellules et
// les clients déjà là partent à l'écran, qui montre par client ce qui sera
// rangé (`src/lib/import-tableau.ts`). Avec ses réponses, elle RELIT le même
// fichier et RANGE : le serveur ne se fie pas à des lignes que l'écran
// renverrait, il refait le plan avec la même règle, et refuse ce qui attend
// encore une réponse. Une route plutôt qu'une action serveur : dix ans de
// pièces dépassent la borne de corps d'une action.
//
// **Un refus se rend, il ne se lève pas** (`AGENTS.md`).

export const dynamic = "force-dynamic";

const refuser = (raison: string, status = 400) => NextResponse.json({ ok: false, raison }, { status });
const MARGE = 256 * 1024;

export async function POST(requete: Request) {
  const ctx = await patronQuiImporte();
  if (!ctx) return NextResponse.json({ error: "Introuvable" }, { status: 404 });

  const annonce = Number(requete.headers.get("content-length") ?? 0);
  if (annonce > OCTETS_TABLEAU_MAX + MARGE) return refuser("Ce tableau pèse plus de 10 Mo. Coupez-le en deux.", 413);
  const limite = await verifierLimite(`import-piece:${ctx.entrepriseId}`, LIMITES.importPiece);
  if (!limite.autorise) return refuser(limite.message, 429);

  const form = await formDataBornee(requete, OCTETS_TABLEAU_MAX + MARGE).catch((erreur: unknown) =>
    erreur instanceof CorpsTropGros ? ("trop-gros" as const) : null
  );
  if (form === "trop-gros") return refuser("Ce tableau pèse plus de 10 Mo. Coupez-le en deux.", 413);
  const fichier = form?.get("fichier");
  if (!(fichier instanceof File)) return refuser("Ce fichier n'est pas arrivé entier.");
  if (fichier.size > OCTETS_TABLEAU_MAX) return refuser("Ce tableau pèse plus de 10 Mo. Coupez-le en deux.", 413);

  const lu = grilleDuFichier(fichier.name, new Uint8Array(await fichier.arrayBuffer()));
  if (!lu.ok) return refuser(lu.raison);
  const connus = await clientsQuOnPeutReconnaitre(ctx);

  const brut = form?.get("decisions");
  if (typeof brut !== "string") {
    return NextResponse.json({
      ok: true,
      nom: fichier.name,
      grille: lu.grille,
      connus: connus.map((c) => ({ id: c.id, nom: c.nom, telephone: c.telephone, email: c.email, adresse: c.adresse, creeLe: c.creeLe })),
    });
  }

  let decisions: Decisions & { choix?: Record<string, ChoixAdresse>; tapes?: Record<string, string> };
  try {
    decisions = JSON.parse(brut);
  } catch {
    return refuser("Vos réponses ne sont pas arrivées entières. Réessayez.");
  }
  const reglages = reglagesDesDecisions(lu.grille, decisions ?? {});
  if (!reglages.ok) return refuser(reglages.manque, 409);
  const { lignes } = lireLignes(lu.grille, reglages.reglages);
  const tapes: Record<number, string> = {};
  for (const [rang, nom] of Object.entries(decisions.tapes ?? {})) {
    if (/^\d+$/.test(rang) && typeof nom === "string") tapes[Number(rang)] = nom;
  }
  const plan = planDeRangement(lignes, connus, decisions.choix && typeof decisions.choix === "object" ? decisions.choix : {}, tapes);
  if (!plan.ok) return refuser(`Vérifiez ${plan.adresses} adresse${plan.adresses > 1 ? "s" : ""}.`, 409);

  try {
    const bilan = await rangerTableau(ctx, fichier.name, plan.clients);
    revalidatePath("/clients");
    return NextResponse.json({ ok: true, ...bilan, sansNom: plan.sansNom, aPart: plan.aPart });
  } catch (err) {
    logger.error("Rangement d'un tableau impossible", { erreur: err instanceof Error ? err.message : String(err) });
    return refuser("Le tableau n'a pas pu être rangé. Réessayez.", 500);
  }
}
