import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { db } from "../db/client";
import { acceptationsDocuments, documentsLegaux, users } from "../db/schema";
import { VERSIONS_DOCUMENTS } from "../documents-legaux/versions";

// Accès aux documents légaux et à la preuve de leur acceptation
// (voir docs/RGPD.md §8).
//
// Particularité de ce dépôt : il ne passe PAS par withEntreprise(). Une
// acceptation lie une personne, pas une entreprise — et elle doit pouvoir être
// recueillie avant même qu'une entreprise soit rattachée au compte, c'est-à-dire
// à un moment où aucun entrepriseId n'existe. Le contexte RLS employé est donc
// app.utilisateur_id, comme pour la lecture d'adhésion propre (migration 0012).

export type DocumentAAccepter = {
  id: string;
  type: string;
  version: string;
  titre: string;
  contenu: string;
  empreinte: string;
  acceptationRequise: boolean;
};

export type PreuveAcceptation = {
  adresseIp: string | null;
  agentUtilisateur: string | null;
};

// La PUBLICATION d'une version n'a délibérément pas sa place ici : elle exige
// le rôle propriétaire et vit dans scripts/run-migrations.ts. L'application
// n'a que SELECT sur documents_legaux — c'est ce qui garantit qu'une version
// publiée ne puisse jamais être réécrite depuis une requête applicative, et
// donc qu'une acceptation désigne toujours un texte inchangé.

/**
 * La version en vigueur de chaque type : la plus récemment publiée.
 *
 * Volontairement calculé à la lecture plutôt que porté par un drapeau
 * « en_vigueur » : un drapeau se désynchronise, une date de publication non.
 */
export async function documentsEnVigueur(): Promise<DocumentAAccepter[]> {
  const tous = await db
    .select({
      id: documentsLegaux.id,
      type: documentsLegaux.type,
      version: documentsLegaux.version,
      titre: documentsLegaux.titre,
      contenu: documentsLegaux.contenu,
      empreinte: documentsLegaux.empreinte,
      acceptationRequise: documentsLegaux.acceptationRequise,
      publieAt: documentsLegaux.publieAt,
    })
    .from(documentsLegaux)
    .orderBy(desc(documentsLegaux.publieAt));

  const parType = new Map<string, DocumentAAccepter>();
  for (const d of tous) {
    if (!parType.has(d.type)) parType.set(d.type, d);
  }

  // Ordre d'affichage : celui déclaré dans versions.ts, pas celui de la base.
  const ordre = VERSIONS_DOCUMENTS.map((v) => v.type);
  return ordre.map((t) => parType.get(t)).filter((d): d is DocumentAAccepter => d !== undefined);
}

/**
 * Les documents que cet utilisateur doit encore accepter.
 *
 * Un document dont l'acceptation n'est pas requise n'y figure jamais : il reste
 * consultable sans bloquer l'accès à l'application.
 */
export async function documentsAAccepter(utilisateurId: string): Promise<DocumentAAccepter[]> {
  const enVigueur = await documentsEnVigueur();
  const requis = enVigueur.filter((d) => d.acceptationRequise);
  if (requis.length === 0) return [];

  const dejaAcceptes = await db.transaction(async (tx) => {
    await tx.execute(sql`SELECT set_config('app.utilisateur_id', ${utilisateurId}, true)`);
    return tx
      .select({ documentId: acceptationsDocuments.documentId })
      .from(acceptationsDocuments)
      .where(
        and(
          eq(acceptationsDocuments.utilisateurId, utilisateurId),
          inArray(
            acceptationsDocuments.documentId,
            requis.map((d) => d.id)
          )
        )
      );
  });

  const acceptes = new Set(dejaAcceptes.map((a) => a.documentId));
  return requis.filter((d) => !acceptes.has(d.id));
}

/**
 * Consigne l'acceptation de plusieurs documents en une seule transaction.
 *
 * Tout ou rien : accepter « les conditions et le contrat » est un geste unique
 * du point de vue de l'utilisateur, il doit l'être aussi en base. Une
 * acceptation partiellement enregistrée serait une preuve fausse.
 *
 * Réaccepter un document déjà accepté est sans effet (la première acceptation
 * fait foi et n'est jamais écrasée).
 */
export async function enregistrerAcceptations(
  utilisateurId: string,
  documentIds: string[],
  preuve: PreuveAcceptation
): Promise<{ enregistrees: number }> {
  if (documentIds.length === 0) return { enregistrees: 0 };

  return db.transaction(async (tx) => {
    await tx.execute(sql`SELECT set_config('app.utilisateur_id', ${utilisateurId}, true)`);

    const inserees = await tx
      .insert(acceptationsDocuments)
      .values(
        documentIds.map((documentId) => ({
          utilisateurId,
          documentId,
          adresseIp: preuve.adresseIp,
          agentUtilisateur: preuve.agentUtilisateur,
        }))
      )
      .onConflictDoNothing({
        target: [acceptationsDocuments.utilisateurId, acceptationsDocuments.documentId],
      })
      .returning({ id: acceptationsDocuments.id });

    return { enregistrees: inserees.length };
  });
}

/** Les acceptations d'un utilisateur, la plus récente d'abord. */
export async function acceptationsDe(utilisateurId: string) {
  return db.transaction(async (tx) => {
    await tx.execute(sql`SELECT set_config('app.utilisateur_id', ${utilisateurId}, true)`);
    return tx
      .select({
        documentId: acceptationsDocuments.documentId,
        accepteAt: acceptationsDocuments.accepteAt,
        adresseIp: acceptationsDocuments.adresseIp,
        agentUtilisateur: acceptationsDocuments.agentUtilisateur,
        type: documentsLegaux.type,
        version: documentsLegaux.version,
        empreinte: documentsLegaux.empreinte,
      })
      .from(acceptationsDocuments)
      .innerJoin(documentsLegaux, eq(documentsLegaux.id, acceptationsDocuments.documentId))
      .where(eq(acceptationsDocuments.utilisateurId, utilisateurId))
      .orderBy(desc(acceptationsDocuments.accepteAt));
  });
}

/**
 * Le compte de cette session existe-t-il encore ?
 *
 * Interrogé sous le rôle applicatif, comme le reste : un contrôle fait sous un
 * rôle privilégié pourrait répondre « oui » là où l'application voit « non ».
 * Aucune politique d'isolation ne s'applique à `users` pour cette lecture — on
 * ne demande qu'une existence, jamais un contenu.
 */
export async function utilisateurExiste(utilisateurId: string): Promise<boolean> {
  const [ligne] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.id, utilisateurId))
    .limit(1);
  return Boolean(ligne);
}
