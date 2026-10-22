import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";
import { withEntreprise } from "../db/with-entreprise";
import { chantiers, clients, envoisPieces, piecesImportees } from "../db/schema";
import type { Ctx } from "./context";
import { trouverOuCreerClient } from "./clients";
import type { ChampsLus } from "@/lib/import-pieces";
import { statutApresLecture } from "@/lib/import-pieces";
import { logger } from "../logger";

/**
 * DEVIS ET FACTURES IMPORTÉS — le dépôt (migration 0135).
 *
 * **Rien ne sort de `withEntreprise`** (`CLAUDE.md` §3) : ces pièces portent
 * le nom, l'adresse et ce qu'a payé chaque client d'un artisan.
 *
 * **Une pièce n'est jamais lue deux fois en même temps.** Chaque envoi de
 * fichier relance la lecture (`after()`), et plusieurs peuvent tourner
 * ensemble : `prendrePiecesALire` les réserve par `FOR UPDATE SKIP LOCKED`, et
 * une lecture interrompue (serveur redémarré) se reprend après dix minutes.
 */

export type EnvoiEnBase = typeof envoisPieces.$inferSelect;
export type PieceEnBase = typeof piecesImportees.$inferSelect;

export async function creerEnvoi(ctx: Ctx, nom: string, attendues: number): Promise<EnvoiEnBase> {
  return withEntreprise(ctx.utilisateurId, ctx.entrepriseId, async (tx) => {
    // **Un envoi pas encore rangé se REPREND** au lieu d'en ouvrir un second :
    // c'est ainsi qu'un envoi coupé (appli fermée) repart où il en était quand
    // il choisit à nouveau le même fichier. Ouvrir un second envoi laisserait
    // les pièces du premier sans écran pour les ranger.
    const [dernier] = await tx.select().from(envoisPieces).orderBy(desc(envoisPieces.createdAt)).limit(1);
    if (dernier && !dernier.rangeLe) {
      const [repris] = await tx
        .update(envoisPieces)
        .set({ attendues: Math.max(dernier.attendues, attendues) })
        .where(eq(envoisPieces.id, dernier.id))
        .returning();
      return repris;
    }
    const [e] = await tx
      .insert(envoisPieces)
      .values({ entrepriseId: ctx.entrepriseId, nom: nom.slice(0, 160), attendues, createdBy: ctx.utilisateurId })
      .returning();
    return e;
  });
}

/**
 * Les empreintes déjà gardées, parmi celles annoncées. L'écran ne renvoie pas
 * ce qui est déjà là : un envoi coupé reprend où il en était, et un même zip
 * importé deux fois ne double rien.
 */
export async function empreintesConnues(ctx: Ctx, empreintes: string[]): Promise<string[]> {
  if (empreintes.length === 0) return [];
  return withEntreprise(ctx.utilisateurId, ctx.entrepriseId, async (tx) => {
    const lignes = await tx
      .select({ e: piecesImportees.empreinte })
      .from(piecesImportees)
      .where(inArray(piecesImportees.empreinte, empreintes));
    return lignes.map((l) => l.e);
  });
}

/**
 * L'envoi est fini : il attend désormais ce qui est vraiment arrivé. Les
 * fichiers refusés en route (format, poids) ne doivent pas laisser la bande
 * attendre pour toujours une pièce qui ne viendra pas.
 */
export async function fermerEnvoi(ctx: Ctx, id: string): Promise<void> {
  await withEntreprise(ctx.utilisateurId, ctx.entrepriseId, async (tx) => {
    const [{ n }] = await tx
      .select({ n: sql<number>`count(*)::int` })
      .from(piecesImportees)
      .where(eq(piecesImportees.envoiId, id));
    // Rien d'arrivé du tout : l'envoi part, il n'y a rien à ranger.
    if (n === 0) await tx.delete(envoisPieces).where(eq(envoisPieces.id, id));
    else await tx.update(envoisPieces).set({ attendues: n }).where(eq(envoisPieces.id, id));
  });
}

export async function getEnvoi(ctx: Ctx, id: string): Promise<EnvoiEnBase | undefined> {
  return withEntreprise(ctx.utilisateurId, ctx.entrepriseId, async (tx) => {
    const [e] = await tx.select().from(envoisPieces).where(eq(envoisPieces.id, id)).limit(1);
    return e;
  });
}

/** Garde une pièce. `null` : elle était déjà là (même empreinte). */
export async function deposerPiece(
  ctx: Ctx,
  p: { envoiId: string; empreinte: string; fichierCle: string; fichierNom: string | null }
): Promise<PieceEnBase | null> {
  return withEntreprise(ctx.utilisateurId, ctx.entrepriseId, async (tx) => {
    const [ligne] = await tx
      .insert(piecesImportees)
      .values({ entrepriseId: ctx.entrepriseId, ...p })
      .onConflictDoNothing()
      .returning();
    return ligne ?? null;
  });
}

const REPRISE_APRES = "10 minutes";

/** Réserve jusqu'à `combien` pièces à lire, dont celles d'une lecture interrompue. */
export async function prendrePiecesALire(ctx: Ctx, combien: number): Promise<{ id: string; fichierCle: string }[]> {
  return withEntreprise(ctx.utilisateurId, ctx.entrepriseId, async (tx) => {
    const r = await tx.execute(sql`
      UPDATE pieces_importees SET statut = 'en_lecture', lecture_commencee_le = now(), updated_at = now()
       WHERE id IN (
         SELECT id FROM pieces_importees
          WHERE statut = 'a_lire'
             OR (statut = 'en_lecture' AND lecture_commencee_le < now() - ${REPRISE_APRES}::interval)
          ORDER BY created_at
          LIMIT ${combien}
          FOR UPDATE SKIP LOCKED)
      RETURNING id, fichier_cle`);
    return (r.rows as { id: string; fichier_cle: string }[]).map((l) => ({ id: l.id, fichierCle: l.fichier_cle }));
  });
}

export async function noterLecture(ctx: Ctx, id: string, champs: ChampsLus): Promise<void> {
  await withEntreprise(ctx.utilisateurId, ctx.entrepriseId, async (tx) => {
    await tx
      .update(piecesImportees)
      .set({
        statut: statutApresLecture(champs),
        genre: champs.genre,
        numero: champs.numero,
        jour: champs.jour,
        montantTtc: champs.montantTtc,
        nomLu: champs.nomLu,
        updatedAt: new Date(),
      })
      .where(and(eq(piecesImportees.id, id), eq(piecesImportees.statut, "en_lecture")));
  });
}

/** Une pièce dont le fichier ne se lit pas du tout : elle passe à vérifier, sans rien deviner. */
export async function noterIllisible(ctx: Ctx, id: string): Promise<void> {
  await withEntreprise(ctx.utilisateurId, ctx.entrepriseId, async (tx) => {
    await tx
      .update(piecesImportees)
      .set({ statut: "a_verifier", updatedAt: new Date() })
      .where(and(eq(piecesImportees.id, id), eq(piecesImportees.statut, "en_lecture")));
  });
}

// ─── Ce que l'écran montre ────────────────────────────────────────────────

export type EtatEnvoi = {
  id: string;
  nom: string;
  attendues: number;
  /** Arrivées sur le serveur. */
  recues: number;
  /** Lues, qu'elles se rangent seules ou soient à vérifier. */
  lues: number;
  aVerifier: number;
  pretes: number;
  rangees: number;
  rangeLe: Date | null;
  /** L'arrivée de la dernière pièce : passé deux minutes sans rien, l'envoi est coupé. */
  derniereArrivee: Date | null;
};

/**
 * L'envoi le plus récent qui n'est pas encore entièrement rangé, ou le dernier
 * rangé depuis moins d'une minute (pour « Annuler »). `null` : rien en cours.
 */
export async function envoiEnCours(ctx: Ctx): Promise<EtatEnvoi | null> {
  return withEntreprise(ctx.utilisateurId, ctx.entrepriseId, async (tx) => {
    const [e] = await tx.select().from(envoisPieces).orderBy(desc(envoisPieces.createdAt)).limit(1);
    if (!e) return null;
    const [{ derniere }] = await tx
      .select({ derniere: sql<Date | null>`max(${piecesImportees.createdAt})` })
      .from(piecesImportees)
      .where(eq(piecesImportees.envoiId, e.id));
    const comptes = await tx
      .select({ statut: piecesImportees.statut, n: sql<number>`count(*)::int` })
      .from(piecesImportees)
      .where(eq(piecesImportees.envoiId, e.id))
      .groupBy(piecesImportees.statut);
    const n = (s: string) => comptes.find((c) => c.statut === s)?.n ?? 0;
    const recues = comptes.reduce((t, c) => t + c.n, 0);
    const etat: EtatEnvoi = {
      id: e.id,
      nom: e.nom,
      attendues: e.attendues,
      recues,
      lues: n("lue") + n("a_verifier") + n("rangee"),
      aVerifier: n("a_verifier"),
      pretes: n("lue"),
      rangees: n("rangee"),
      rangeLe: e.rangeLe,
      derniereArrivee: derniere ? new Date(derniere) : null,
    };
    const toutRange = recues > 0 && etat.rangees === recues;
    if (toutRange && (!e.rangeLe || Date.now() - e.rangeLe.getTime() > 60_000)) return null;
    return etat;
  });
}

export async function piecesAVerifier(ctx: Ctx, envoiId: string): Promise<PieceEnBase[]> {
  return withEntreprise(ctx.utilisateurId, ctx.entrepriseId, async (tx) =>
    tx
      .select()
      .from(piecesImportees)
      .where(and(eq(piecesImportees.envoiId, envoiId), eq(piecesImportees.statut, "a_verifier")))
      .orderBy(asc(piecesImportees.jour), asc(piecesImportees.createdAt))
  );
}

/** Le nom qu'il a tapé, et le genre s'il manquait. La pièce devient prête. */
export async function nommerPiece(
  ctx: Ctx,
  id: string,
  nom: string,
  genre: "devis" | "facture" | null
): Promise<boolean> {
  return withEntreprise(ctx.utilisateurId, ctx.entrepriseId, async (tx) => {
    const [p] = await tx.select().from(piecesImportees).where(eq(piecesImportees.id, id)).limit(1);
    if (!p || p.statut !== "a_verifier") return false;
    const leGenre = p.genre ?? genre;
    if (!leGenre) return false;
    await tx
      .update(piecesImportees)
      .set({ nomLu: nom, genre: leGenre, statut: "lue", updatedAt: new Date() })
      .where(eq(piecesImportees.id, id));
    return true;
  });
}

/**
 * Range toutes les pièces prêtes de l'envoi : chaque nom est retrouvé parmi ses
 * clients, ou crée une fiche (`trouverOuCreerClient`, la même règle que la
 * création d'un chantier, éprouvée ailleurs). Les fiches créées sont notées
 * sur l'envoi, pour qu'« Annuler » sache lesquelles retirer.
 */
export async function rangerEnvoi(ctx: Ctx, envoiId: string): Promise<{ rangees: number; clientsCrees: number }> {
  const pretes = await withEntreprise(ctx.utilisateurId, ctx.entrepriseId, async (tx) =>
    tx
      .select({ id: piecesImportees.id, nom: piecesImportees.nomLu })
      .from(piecesImportees)
      .where(and(eq(piecesImportees.envoiId, envoiId), eq(piecesImportees.statut, "lue")))
  );
  // Un nom, une recherche : dix factures de M. Bernard ne cherchent M. Bernard qu'une fois.
  const parNom = new Map<string, string[]>();
  for (const p of pretes) {
    if (!p.nom) continue;
    const cle = p.nom.trim().toLowerCase();
    parNom.set(cle, [...(parNom.get(cle) ?? []), p.id]);
  }
  const crees: string[] = [];
  let rangees = 0;
  for (const ids of parNom.values()) {
    const nom = pretes.find((p) => p.id === ids[0])!.nom!.trim();
    const { client, reutilise } = await trouverOuCreerClient(ctx, { nom });
    if (!reutilise) crees.push(client.id);
    await withEntreprise(ctx.utilisateurId, ctx.entrepriseId, async (tx) => {
      await tx
        .update(piecesImportees)
        .set({ clientId: client.id, statut: "rangee", updatedAt: new Date() })
        .where(and(inArray(piecesImportees.id, ids), eq(piecesImportees.statut, "lue")));
    });
    rangees += ids.length;
  }
  await withEntreprise(ctx.utilisateurId, ctx.entrepriseId, async (tx) => {
    await tx
      .update(envoisPieces)
      .set({ clientsCrees: crees, rangeLe: new Date() })
      .where(eq(envoisPieces.id, envoiId));
  });
  return { rangees, clientsCrees: crees.length };
}

/**
 * « Annuler » : les pièces de l'envoi redeviennent prêtes, et les fiches que
 * ce rangement a créées partent, **sauf si on s'en est servi depuis** (un
 * chantier ouvert dessus, une autre pièce rangée chez elle) : on ne retire
 * jamais ce qui porte autre chose que cet envoi.
 */
export async function annulerRangement(ctx: Ctx, envoiId: string): Promise<boolean> {
  return withEntreprise(ctx.utilisateurId, ctx.entrepriseId, async (tx) => {
    const [e] = await tx.select().from(envoisPieces).where(eq(envoisPieces.id, envoiId)).limit(1);
    if (!e?.rangeLe) return false;
    await tx
      .update(piecesImportees)
      .set({ clientId: null, statut: "lue", updatedAt: new Date() })
      .where(and(eq(piecesImportees.envoiId, envoiId), eq(piecesImportees.statut, "rangee")));
    // Une fiche à la fois, chacune dans son point de reprise : une table qu'on
    // n'a pas listée ici peut la porter (un contrat, une fiche d'entretien), et
    // son refus ne doit retenir qu'elle, jamais l'annulation entière.
    for (const id of e.clientsCrees) {
      try {
        await tx.transaction(async (sp) => {
          await sp.delete(clients).where(
            and(
              eq(clients.id, id),
              sql`NOT EXISTS (SELECT 1 FROM ${chantiers} c WHERE c.client_id = ${clients.id})`,
              sql`NOT EXISTS (SELECT 1 FROM ${piecesImportees} p WHERE p.client_id = ${clients.id})`
            )
          );
        });
      } catch (err) {
        logger.info("Fiche créée par un import gardée à l'annulation : elle porte autre chose", {
          erreur: err instanceof Error ? err.message : String(err),
        });
      }
    }
    await tx.update(envoisPieces).set({ clientsCrees: [], rangeLe: null }).where(eq(envoisPieces.id, envoiId));
    return true;
  });
}

// ─── Sur la fiche du client ───────────────────────────────────────────────

export async function piecesDuClient(ctx: Ctx, clientId: string): Promise<PieceEnBase[]> {
  return withEntreprise(ctx.utilisateurId, ctx.entrepriseId, async (tx) =>
    tx
      .select()
      .from(piecesImportees)
      .where(and(eq(piecesImportees.clientId, clientId), eq(piecesImportees.statut, "rangee")))
  );
}

export async function getPiece(ctx: Ctx, id: string): Promise<PieceEnBase | undefined> {
  return withEntreprise(ctx.utilisateurId, ctx.entrepriseId, async (tx) => {
    const [p] = await tx.select().from(piecesImportees).where(eq(piecesImportees.id, id)).limit(1);
    return p;
  });
}
