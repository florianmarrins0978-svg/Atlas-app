import { createHash } from "node:crypto";
import { and, asc, desc, eq, inArray, isNotNull, isNull, sql } from "drizzle-orm";
import { withEntreprise } from "../db/with-entreprise";
import { chantiers, clients, envoisPieces, piecesImportees } from "../db/schema";
import type { Ctx } from "./context";
import { trouverOuCreerClient } from "./clients";
import type { ChampsLus } from "@/lib/import-pieces";
import { statutApresLecture } from "@/lib/import-pieces";
import type { ClientAPoser } from "@/lib/import-tableau";
import { complementsPourFiche } from "@/lib/rapprochement-client";
import { logger } from "../logger";

/**
 * DEVIS ET FACTURES IMPORTÉS — le dépôt (migration 0136).
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

// ─── Un tableau (28 octobre 2026) ─────────────────────────────────────────

/** Ce qu'un tableau a rangé, pour la phrase qui le dit. */
export type BilanTableau = {
  envoiId: string | null;
  rangees: number;
  clientsCrees: number;
  /** Déjà importées : ce tableau une seconde fois, ou le PDF de la même pièce. */
  dejaLa: number;
  /** Cases vides de fiches déjà là, complétées. */
  completees: number;
};

/** Ce qui empêche de ranger deux fois la même ligne, d'un import à l'autre. */
function empreinteDeLigne(cle: string): string {
  return createHash("sha256").update(`tableau|${cle}`).digest("hex");
}

const numeroCompare = (genre: string | null, numero: string) => `${genre}|${numero.replace(/\s+/g, "").toUpperCase()}`;

/**
 * Range un tableau, **d'un seul tenant** : les fiches créées, les cases vides
 * complétées et les pièces posées réussissent ensemble ou pas du tout. Un
 * rangement à moitié fait laisserait des fiches sans pièces, que rien ne
 * désignerait à « Annuler ».
 *
 * `aPoser` sort de `planDeRangement` (`src/lib/import-tableau.ts`) : l'écran a
 * montré ce plan-là, ligne pour ligne.
 *
 * **Une pièce déjà là ne se range pas deux fois** : même ligne d'un tableau
 * déjà importé (son empreinte), ou même numéro qu'une pièce importée en PDF.
 * Une fiche qui n'aurait plus aucune pièce ne se crée pas.
 *
 * **Une fiche déjà là ne voit que ses cases VIDES complétées** (sa réponse du
 * 28 octobre), par la règle de toute l'appli, `complementsPourFiche` ; ce qui
 * est écrit est noté sur l'envoi, pour qu'« Annuler » le vide à nouveau.
 */
export async function rangerTableau(ctx: Ctx, nom: string, aPoser: readonly ClientAPoser[]): Promise<BilanTableau> {
  return withEntreprise(ctx.utilisateurId, ctx.entrepriseId, async (tx) => {
    const toutes = aPoser.flatMap((c) => c.pieces.map((p) => empreinteDeLigne(p.cle)));
    const connues = new Set<string>();
    for (let i = 0; i < toutes.length; i += 1000) {
      const lignes = await tx
        .select({ e: piecesImportees.empreinte })
        .from(piecesImportees)
        .where(inArray(piecesImportees.empreinte, toutes.slice(i, i + 1000)));
      for (const l of lignes) connues.add(l.e);
    }
    const numeros = new Set(
      (
        await tx
          .select({ genre: piecesImportees.genre, numero: piecesImportees.numero })
          .from(piecesImportees)
          .where(isNotNull(piecesImportees.numero))
      ).map((l) => numeroCompare(l.genre, l.numero!))
    );
    const retenus = aPoser
      .map((c) => ({
        ...c,
        pieces: c.pieces.filter(
          (p) => !connues.has(empreinteDeLigne(p.cle)) && !(p.numero && numeros.has(numeroCompare(p.genre, p.numero)))
        ),
      }))
      .filter((c) => c.pieces.length > 0);
    const total = retenus.reduce((t, c) => t + c.pieces.length, 0);
    if (total === 0) return { envoiId: null, rangees: 0, clientsCrees: 0, dejaLa: toutes.length, completees: 0 };

    const [envoi] = await tx
      .insert(envoisPieces)
      .values({ entrepriseId: ctx.entrepriseId, nom: nom.trim().slice(0, 160) || "Tableau", attendues: total, createdBy: ctx.utilisateurId })
      .returning({ id: envoisPieces.id });

    const crees: string[] = [];
    const completees: { clientId: string; champ: "adresse" | "telephone"; valeur: string }[] = [];
    const lignes: (typeof piecesImportees.$inferInsert)[] = [];
    for (const c of retenus) {
      let clientId: string;
      if (c.existant) {
        const [fiche] = await tx
          .select({ id: clients.id, nom: clients.nom, telephone: clients.telephone, email: clients.email, adresse: clients.adresse, creeLe: clients.createdAt })
          .from(clients)
          .where(and(eq(clients.id, c.existant), isNull(clients.deletedAt), isNull(clients.effaceLe)))
          .limit(1);
        // Retirée entre la lecture et le rangement : tout s'annule, et la
        // relecture du tableau la verra absente.
        if (!fiche) throw new Error("Une fiche du tableau a disparu pendant le rangement.");
        const plus = complementsPourFiche(fiche, { nom: fiche.nom, adresse: c.adresse, telephone: c.telephone });
        if (plus.adresse || plus.telephone) {
          await tx
            .update(clients)
            .set({ ...(plus.adresse ? { adresse: plus.adresse } : {}), ...(plus.telephone ? { telephone: plus.telephone } : {}), updatedAt: new Date() })
            .where(eq(clients.id, fiche.id));
          if (plus.adresse) completees.push({ clientId: fiche.id, champ: "adresse", valeur: plus.adresse });
          if (plus.telephone) completees.push({ clientId: fiche.id, champ: "telephone", valeur: plus.telephone });
        }
        clientId = fiche.id;
      } else {
        // Les colonnes de `creerClient`, et elles seules.
        const [neuf] = await tx
          .insert(clients)
          .values({
            entrepriseId: ctx.entrepriseId,
            nom: c.nom,
            ...(c.adresse ? { adresse: c.adresse } : {}),
            ...(c.telephone ? { telephone: c.telephone } : {}),
            createdBy: ctx.utilisateurId,
          })
          .returning({ id: clients.id });
        crees.push(neuf.id);
        clientId = neuf.id;
      }
      for (const p of c.pieces) {
        lignes.push({
          entrepriseId: ctx.entrepriseId,
          envoiId: envoi.id,
          empreinte: empreinteDeLigne(p.cle),
          fichierCle: null,
          statut: "rangee",
          genre: p.genre,
          numero: p.numero,
          jour: p.jour,
          montantTtc: p.montant,
          nomLu: p.nom,
          objet: p.objet,
          adresseChantier: p.chantier,
          clientId,
        });
      }
    }
    let rangees = 0;
    for (let i = 0; i < lignes.length; i += 500) {
      const posees = await tx.insert(piecesImportees).values(lignes.slice(i, i + 500)).onConflictDoNothing().returning({ id: piecesImportees.id });
      rangees += posees.length;
    }
    await tx
      .update(envoisPieces)
      .set({ clientsCrees: crees, casesCompletees: completees, rangeLe: new Date(), attendues: Math.max(rangees, 1) })
      .where(eq(envoisPieces.id, envoi.id));
    return { envoiId: envoi.id, rangees, clientsCrees: crees.length, dejaLa: toutes.length - rangees, completees: completees.length };
  });
}

/**
 * « Annuler » : les pièces de l'envoi redeviennent prêtes, et les fiches que
 * ce rangement a créées partent, **sauf si on s'en est servi depuis** (un
 * chantier ouvert dessus, une autre pièce rangée chez elle) : on ne retire
 * jamais ce qui porte autre chose que cet envoi.
 *
 * **Un tableau s'annule en entier** (28 octobre 2026) : ses pièces n'ont pas
 * de fichier à relire, elles partent, et le tableau se réimporte. Les cases
 * vides qu'il avait complétées se vident, si personne ne les a changées depuis.
 */
export async function annulerRangement(ctx: Ctx, envoiId: string): Promise<boolean> {
  return withEntreprise(ctx.utilisateurId, ctx.entrepriseId, async (tx) => {
    const [e] = await tx.select().from(envoisPieces).where(eq(envoisPieces.id, envoiId)).limit(1);
    if (!e?.rangeLe) return false;
    await tx.delete(piecesImportees).where(and(eq(piecesImportees.envoiId, envoiId), isNull(piecesImportees.fichierCle)));
    for (const c of e.casesCompletees) {
      const colonne = c.champ === "adresse" ? clients.adresse : clients.telephone;
      await tx
        .update(clients)
        .set(c.champ === "adresse" ? { adresse: null, updatedAt: new Date() } : { telephone: null, updatedAt: new Date() })
        .where(and(eq(clients.id, c.clientId), eq(colonne, c.valeur)));
    }
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
    // Un envoi vidé (un tableau) part : il n'a plus rien à ranger, et la bande
    // de Vos clients annoncerait « 0 sur 312 ».
    const [{ restent }] = await tx
      .select({ restent: sql<number>`count(*)::int` })
      .from(piecesImportees)
      .where(eq(piecesImportees.envoiId, envoiId));
    if (restent === 0) await tx.delete(envoisPieces).where(eq(envoisPieces.id, envoiId));
    else await tx.update(envoisPieces).set({ clientsCrees: [], casesCompletees: [], rangeLe: null }).where(eq(envoisPieces.id, envoiId));
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
