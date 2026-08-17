import { and, eq, isNull } from "drizzle-orm";
import { withEntreprise } from "../db/with-entreprise";
import { clients } from "../db/schema";
import type { Ctx } from "./context";
import type { Civilite } from "@/lib/civilite";
import { rapprocherClient, complementsPourFiche } from "@/lib/rapprochement-client";

export async function listerClients(ctx: Ctx) {
  return withEntreprise(ctx.utilisateurId, ctx.entrepriseId, (tx) =>
    tx.select().from(clients).where(isNull(clients.deletedAt))
  );
}

export async function getClient(ctx: Ctx, id: string) {
  return withEntreprise(ctx.utilisateurId, ctx.entrepriseId, async (tx) => {
    const rows = await tx
      .select()
      .from(clients)
      .where(and(eq(clients.id, id), isNull(clients.deletedAt)))
      .limit(1);
    return rows[0] ?? null;
  });
}

export type CanalClient = "sms" | "email";

/**
 * Retrouver la fiche d'un client déjà connu, ou en créer une.
 *
 * **Le patron, le 17 août 2026 :** *« si je crée un nouveau chantier, mais que
 * c'est monsieur Martins et qu'on a déjà une fiche client monsieur Martins, [il
 * faut que] le devis, la facture s'ajoute à la fiche client de monsieur Martins
 * qui est déjà créé. »* Jusque-là `creerClient` insérait toujours, et sa fiche
 * client annonçait « 1 chantier » à vie.
 *
 * **La règle de reconnaissance vit dans `src/lib/rapprochement-client.ts`**,
 * pure et éprouvée sans base (`CLAUDE.md` §3). Ici, on ne fait que la nourrir
 * et écrire ce qu'elle décide.
 *
 * **Les clients EFFACÉS sont hors du jeu.** Un effacement RGPD pose `deletedAt`
 * en même temps que `effaceLe` (`donnees-client.ts`), et rattacher un chantier
 * neuf à cette fiche-là ressusciterait un dossier que le client a demandé de
 * faire disparaître. Le filtre est donc explicite, même s'il fait doublon avec
 * `deletedAt` : c'est une garantie qu'on veut lire.
 */
export async function trouverOuCreerClient(
  ctx: Ctx,
  data: {
    nom: string;
    civilite?: Civilite;
    telephone?: string;
    adresse?: string;
    email?: string;
    canalCommunication?: CanalClient;
  }
): Promise<{ client: typeof clients.$inferSelect; reutilise: boolean }> {
  const existants = await withEntreprise(ctx.utilisateurId, ctx.entrepriseId, (tx) =>
    tx
      .select({
        id: clients.id,
        nom: clients.nom,
        telephone: clients.telephone,
        email: clients.email,
        adresse: clients.adresse,
        civilite: clients.civilite,
        canalCommunication: clients.canalCommunication,
        creeLe: clients.createdAt,
      })
      .from(clients)
      .where(and(isNull(clients.deletedAt), isNull(clients.effaceLe)))
  );

  const verdict = rapprocherClient(data, existants);
  if (verdict.type === "creer") {
    return { client: await creerClient(ctx, data), reutilise: false };
  }

  const retrouve = existants.find((c) => c.id === verdict.id)!;
  // **La civilité et le canal complètent aussi, sous la même règle : que du
  // vide.** Ils ne passent pas par `complementsPourFiche` parce que ce sont des
  // énumérations et non du texte libre — les y mêler aurait demandé un type
  // flou pour un gain nul.
  const aEcrire: Parameters<typeof mettreAJourClient>[2] = complementsPourFiche(retrouve, data);
  if (data.civilite && !retrouve.civilite) aEcrire.civilite = data.civilite;
  if (data.canalCommunication && !retrouve.canalCommunication) {
    aEcrire.canalCommunication = data.canalCommunication;
  }

  const client =
    Object.keys(aEcrire).length > 0
      ? ((await mettreAJourClient(ctx, verdict.id, aEcrire)) ?? (await getClient(ctx, verdict.id))!)
      : (await getClient(ctx, verdict.id))!;

  return { client, reutilise: true };
}

export async function creerClient(
  ctx: Ctx,
  data: {
    nom: string;
    /** « Mr » / « Mme », ou absent : les trois états (migration 0038). */
    civilite?: Civilite;
    telephone?: string;
    adresse?: string;
    email?: string;
    // Canal convenu avec le client pour l'envoi du devis (docs/AGENT.md §2.1).
    // C'est un choix du client, pas un réglage de l'application : un artisan
    // sait que certains des siens ne lisent jamais leurs e-mails.
    canalCommunication?: CanalClient;
  }
) {
  return withEntreprise(ctx.utilisateurId, ctx.entrepriseId, async (tx) => {
    const [row] = await tx
      .insert(clients)
      .values({ entrepriseId: ctx.entrepriseId, ...data, createdBy: ctx.utilisateurId })
      .returning();
    return row;
  });
}

/**
 * Met à jour les coordonnées et le canal d'un client.
 *
 * Les champs absents de `data` ne sont pas touchés : un écran qui ne présente
 * que le canal ne doit pas effacer un téléphone au passage.
 */
export async function mettreAJourClient(
  ctx: Ctx,
  id: string,
  data: {
    nom?: string;
    civilite?: Civilite | null;
    telephone?: string | null;
    adresse?: string | null;
    email?: string | null;
    canalCommunication?: CanalClient | null;
  }
) {
  return withEntreprise(ctx.utilisateurId, ctx.entrepriseId, async (tx) => {
    const [row] = await tx
      .update(clients)
      .set({ ...data, updatedAt: new Date() })
      .where(
        and(
          eq(clients.id, id),
          eq(clients.entrepriseId, ctx.entrepriseId),
          isNull(clients.deletedAt)
        )
      )
      .returning();
    return row ?? null;
  });
}
