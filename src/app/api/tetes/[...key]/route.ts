import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { getCurrentCtx } from "@/server/session-ctx";
import { exigerOuverture } from "@/server/garde-route";
import { withEntreprise } from "@/server/db/with-entreprise";
import { equipes, membresEntreprise } from "@/server/db/schema";
import { lireObjet } from "@/server/storage";
import { typeDepuisCle } from "@/lib/type-de-fichier";
import { logger } from "@/server/logger";

// LES TÊTES, ET RIEN D'AUTRE — 27 septembre 2026.
//
// *« Chaque personne doit pouvoir mettre et changer sa photo de profil »* : la
// tête d'un gars se voit sur le planning, dans Équipe, dans Mon compte, donc
// par TOUS les comptes de l'entreprise, salariés compris.
//
// **Pourquoi une route à part, et pas `/api/fichiers`.** Le salarié n'atteint
// pas `/api/fichiers`, et c'est voulu (`acces-roles.ts`) : elle sert aussi les
// photos de chantier et les notes vocales. La lui ouvrir pour voir des têtes lui
// aurait ouvert tout le reste. Celle-ci ne répond QUE pour une clef posée comme
// photo d'une personne de SON entreprise.
//
// Le filtre sur l'entreprise est écrit à chaque requête : `membres_entreprise`
// laisse chacun lire ses adhésions dans toutes ses entreprises (0012), et une
// protection qui ne tient qu'à une politique se perd sans bruit (le logo,
// `api/fichiers`, 29 août 2026). Le type servi vient de l'extension que le
// SERVEUR a posée, jamais de la base (constat M1).
export async function GET(_req: Request, { params }: { params: Promise<{ key: string[] }> }) {
  const { key } = await params;
  const storageKey = key.join("/");

  const ctx = await getCurrentCtx();
  const refus = await exigerOuverture(ctx);
  if (refus) return refus;

  const autorise = await withEntreprise(ctx.utilisateurId, ctx.entrepriseId, async (tx) => {
    const [salarie] = await tx
      .select({ id: equipes.id })
      .from(equipes)
      .where(and(eq(equipes.entrepriseId, ctx.entrepriseId), eq(equipes.photoStorageKey, storageKey)))
      .limit(1);
    if (salarie) return true;
    const [compte] = await tx
      .select({ id: membresEntreprise.id })
      .from(membresEntreprise)
      .where(
        and(
          eq(membresEntreprise.entrepriseId, ctx.entrepriseId),
          eq(membresEntreprise.photoStorageKey, storageKey)
        )
      )
      .limit(1);
    return Boolean(compte);
  });

  if (!autorise) return NextResponse.json({ error: "Fichier introuvable" }, { status: 404 });

  try {
    const octets = await lireObjet(storageKey);
    return new NextResponse(new Uint8Array(octets), {
      headers: { "Content-Type": typeDepuisCle(storageKey), "Cache-Control": "private, max-age=3600" },
    });
  } catch (err) {
    // Une clef autorisée dont le fichier manque : ce n'est pas un refus, c'est
    // une panne, et elle se dit dans le journal plutôt que de se taire.
    logger.error("Tête introuvable pour une clef autorisée", {
      cle: storageKey,
      erreur: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.json({ error: "Fichier introuvable" }, { status: 404 });
  }
}
