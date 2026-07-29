import { sql } from "drizzle-orm";
import { db } from "../db/client";
import { entreprises, entrepriseCompteurs, users, membresEntreprise } from "../db/schema";

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
