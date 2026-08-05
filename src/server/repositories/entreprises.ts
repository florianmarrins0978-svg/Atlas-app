import { eq, sql } from "drizzle-orm";
import { db } from "../db/client";
import { withEntreprise } from "../db/with-entreprise";
import { entreprises, entrepriseCompteurs, users, membresEntreprise } from "../db/schema";
import type { Ctx } from "./context";

// Cas particulier : à la création, l'entreprise n'existe pas encore, donc
// withEntreprise() (qui exige une adhésion préexistante) ne peut pas s'appliquer.
// Cette fonction gère elle-même sa transaction et fixe le contexte RLS dès que
// l'entreprise existe, avant toute écriture sur une table à entreprise_id.
export async function creerEntreprise(
  data: { nom: string; siret?: string; adresse?: string; telephone?: string; email?: string; iban?: string },
  utilisateur: { id?: string; email?: string; nom?: string }
) {
  return db.transaction(async (tx) => {
    const [entreprise] = await tx.insert(entreprises).values(data).returning();

    let utilisateurId = utilisateur.id;
    if (!utilisateurId) {
      if (!utilisateur.email) throw new Error("email requis pour créer un nouvel utilisateur");
      const [u] = await tx.insert(users).values({ email: utilisateur.email, nom: utilisateur.nom }).returning();
      utilisateurId = u.id;
    }

    // Contexte RLS fixé dès maintenant — obligatoire avant toute écriture sur
    // membres_entreprise / entreprise_compteurs (FORCE ROW LEVEL SECURITY).
    await tx.execute(sql`SELECT set_config('app.entreprise_id', ${entreprise.id}, true)`);

    await tx.insert(membresEntreprise).values({
      entrepriseId: entreprise.id,
      utilisateurId,
      role: "proprietaire",
    });

    // Provisioning atomique du compteur — ON CONFLICT DO NOTHING pour rester
    // idempotent si la fonction était rappelée avec la même entreprise (ne devrait
    // pas arriver en usage normal, mais sans risque de double-provisioning).
    await tx.insert(entrepriseCompteurs).values({ entrepriseId: entreprise.id }).onConflictDoNothing();

    return { entreprise, utilisateurId };
  });
}

/** L'entreprise active, telle que ses écrans de réglages la lisent. */
export async function getEntreprise(ctx: Ctx) {
  return withEntreprise(ctx.utilisateurId, ctx.entrepriseId, async (tx) => {
    const [e] = await tx.select().from(entreprises).where(eq(entreprises.id, ctx.entrepriseId)).limit(1);
    return e ?? null;
  });
}

/**
 * Met à jour les réglages de l'entreprise.
 *
 * Le nombre d'équipes est borné ici en plus de la contrainte de base (migration
 * 0019) : zéro équipe rendrait tout jour indisponible et le patron ne pourrait
 * plus rien envoyer, sans qu'aucun écran ne lui dise pourquoi.
 */
/**
 * Met à jour l'identité de l'entreprise.
 *
 * Les coordonnées (adresse, SIRET, téléphone, e-mail, IBAN) se saisissent
 * depuis l'en-tête du devis : c'est là que le patron les voit imprimées, donc
 * là qu'il remarque qu'elles manquent. Sans IBAN, son client reçoit un devis
 * qu'il ne peut pas payer — et jusqu'ici aucun écran ne les demandait.
 */
export async function mettreAJourEntreprise(
  ctx: Ctx,
  data: {
    nom?: string;
    nombreEquipes?: number;
    adresse?: string | null;
    siret?: string | null;
    telephone?: string | null;
    email?: string | null;
    iban?: string | null;
  }
) {
  return withEntreprise(ctx.utilisateurId, ctx.entrepriseId, async (tx) => {
    const valeurs: Record<string, unknown> & { updatedAt: Date } = { updatedAt: new Date() };
    if (data.nom !== undefined) valeurs.nom = data.nom;
    for (const champ of ["adresse", "siret", "telephone", "email", "iban"] as const) {
      // Une chaîne vide vaut « effacé », pas « inchangé » : le patron doit
      // pouvoir retirer un SIRET saisi de travers.
      if (data[champ] !== undefined) valeurs[champ] = data[champ]?.trim() || null;
    }
    if (data.nombreEquipes !== undefined) {
      valeurs.nombreEquipes = Math.min(20, Math.max(1, Math.trunc(data.nombreEquipes)));
    }
    const [e] = await tx
      .update(entreprises)
      .set(valeurs)
      .where(eq(entreprises.id, ctx.entrepriseId))
      .returning();
    return e ?? null;
  });
}
