import { eq, sql } from "drizzle-orm";
import { redirect } from "next/navigation";
import { auth } from "../auth";
import { db } from "./db/client";
import { membresEntreprise, users } from "./db/schema";
import type { Ctx } from "./repositories/context";
import { enrichirContexteRequete } from "./request-context";

export class NonAuthentifieError extends Error {
  constructor() {
    super("Aucune session valide.");
    this.name = "NonAuthentifieError";
  }
}

export class AucuneEntrepriseError extends Error {
  constructor(utilisateurId: string) {
    super(`L'utilisateur ${utilisateurId} n'a aucune adhésion d'entreprise active.`);
    this.name = "AucuneEntrepriseError";
  }
}

// Contexte authentifié réel, résolu à chaque requête (aucune mise en cache
// inter-requêtes, aucun stub de développement — remplace l'ancien
// src/server/auth-stub.ts). L'entrepriseId n'est JAMAIS lu depuis une donnée
// envoyée par le navigateur (le cookie de session mis à part, signé et
// vérifié par Auth.js) — il est toujours retrouvé ici, côté serveur, à partir
// du seul utilisateurId authentifié. Un utilisateur ne peut donc jamais
// construire un contexte pour une entreprise à laquelle il n'appartient pas.
//
// Limite MVP assumée : un utilisateur n'a qu'une seule entreprise active pour
// l'instant (première adhésion trouvée) — le changement d'entreprise pour un
// utilisateur multi-sociétés n'est pas encore un besoin du produit.
export async function getCurrentCtx(): Promise<Ctx> {
  // Dérogation strictement réservée aux tests automatisés : impossible à
  // activer en production (double garde — NODE_ENV et présence explicite de
  // la variable), utilisée uniquement pour exercer les Server Actions depuis
  // un script Node hors contexte de requête HTTP réel (où `auth()` n'a accès
  // à aucun cookie de session). Jamais un repli implicite : sans cette
  // variable explicitement positionnée par le test lui-même, ce chemin n'est
  // jamais emprunté.
  if (process.env.NODE_ENV !== "production" && process.env.AUTH_TEST_UTILISATEUR_ID) {
    return {
      utilisateurId: process.env.AUTH_TEST_UTILISATEUR_ID,
      entrepriseId: await resoudreEntrepriseId(process.env.AUTH_TEST_UTILISATEUR_ID),
    };
  }

  const session = await auth();
  const utilisateurId = session?.user?.id;
  if (!utilisateurId) {
    throw new NonAuthentifieError();
  }

  return { entrepriseId: await resoudreEntrepriseId(utilisateurId), utilisateurId };
}

async function resoudreEntrepriseId(utilisateurId: string): Promise<string> {
  return db.transaction(async (tx) => {
    // Fixe app.utilisateur_id (jamais app.entreprise_id, encore inconnu à ce
    // stade) — condition d'application de la politique RLS dédiée au
    // bootstrap (voir migration 0012_rls_lecture_propre_membre.sql).
    await tx.execute(sql`SELECT set_config('app.utilisateur_id', ${utilisateurId}, true)`);

    const [membre] = await tx
      .select({ entrepriseId: membresEntreprise.entrepriseId })
      .from(membresEntreprise)
      .where(eq(membresEntreprise.utilisateurId, utilisateurId))
      .orderBy(membresEntreprise.createdAt)
      .limit(1);

    if (!membre) {
      // **Deux situations que rien ne distinguait, et qui n'appellent pas du
      // tout le même remède.**
      //
      // Le compte n'existe PLUS : la session est périmée. Le 10 août 2026, le
      // jeu de démonstration a été refait, l'ancien compte supprimé, et le
      // navigateur du patron portait toujours ce fantôme. L'erreur remontait en
      // 500 sur chaque écran, sans jamais dire quoi faire. On l'envoie donc là
      // où le cookie sera effacé, puis à l'écran de connexion.
      //
      // Le compte existe mais n'a aucune adhésion : ce n'est PAS une session
      // périmée, et l'effacer serait pire que le défaut. Le compte se
      // reconnecterait, n'aurait toujours pas d'entreprise, et repartirait vers
      // l'effacement — une boucle dont on ne sort jamais. C'est une anomalie de
      // données, qui doit se voir comme telle : `AucuneEntrepriseError`, ce que
      // `test-auth-autorisation` exige depuis toujours. Le premier correctif
      // avait remplacé les deux cas par le premier, et cassait ce contrôle.
      const [existe] = await tx.select({ id: users.id }).from(users).where(eq(users.id, utilisateurId)).limit(1);
      if (!existe) {
        // `redirect()` lève une exception que Next.js reconnaît : elle traverse
        // ce qui l'appelle sans rien laisser à moitié fait.
        redirect("/api/session-perimee");
      }
      throw new AucuneEntrepriseError(utilisateurId);
    }
    enrichirContexteRequete({ utilisateurId, entrepriseId: membre.entrepriseId });
    return membre.entrepriseId;
  });
}
