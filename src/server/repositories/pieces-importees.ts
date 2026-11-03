import { createHash } from "node:crypto";
import { and, asc, desc, eq, inArray, isNotNull, isNull, ne, sql } from "drizzle-orm";
import { withEntreprise } from "../db/with-entreprise";
import { chantiers, clients, envoisPieces, piecesImportees } from "../db/schema";
import type { Ctx } from "./context";
import type { ChampsLus } from "@/lib/import-pieces";
import { statutApresLecture, type PieceLueDuPdf } from "@/lib/import-pieces";
import type { ClientAPoser } from "@/lib/import-tableau";
import { complementsPourFiche } from "@/lib/rapprochement-client";
import { annulationAdmise, resteAAnnuler } from "@/lib/delai-annuler";
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

type Tx = Parameters<Parameters<typeof withEntreprise>[2]>[0];

/**
 * **UN ENVOI NE CONNAÎT QU'UN RANGEMENT** (3 novembre 2026).
 *
 * « Annuler » défait le rangement d'un envoi : ses pièces rangées, ses fiches
 * créées, ses cases complétées. Son import du 3 novembre en a rangé 48 sur 51,
 * trois devis sans nom lisible restant à ranger. Rangés plus tard dans le
 * même envoi, ils auraient fait du premier rangement et du second un seul
 * « Annuler » : défaire le second aurait détaché de leurs fiches 48 pièces
 * acceptées depuis longtemps. Ce qui reste d'un envoi rangé part donc dans un
 * envoi neuf avant tout nouveau rangement.
 *
 * **Et ce qui reste suit toujours le DERNIER envoi**, parce que c'est le seul
 * que la bande de « Vos clients » et l'écran d'import regardent
 * (`envoiEnCours`) : laissé derrière un envoi plus récent, il n'aurait plus de
 * porte. D'où les trois appelants : le second rangement lui-même, l'envoi
 * suivant (`creerEnvoi`) et un tableau (`rangerTableau`).
 *
 * Écarté : marquer chaque pièce du rangement qui l'a posée. C'était une
 * colonne et une migration, pour tenir la même règle.
 *
 * Un envoi jamais rangé ne se vide pas : il se reprend (`creerEnvoi`).
 */
async function emporterLesRestes(tx: Tx, depuis: EnvoiEnBase | undefined, vers: string): Promise<number> {
  if (!depuis?.rangeLe) return 0;
  const emportees = await tx
    .update(piecesImportees)
    .set({ envoiId: vers, updatedAt: new Date() })
    .where(and(eq(piecesImportees.envoiId, depuis.id), ne(piecesImportees.statut, "rangee")))
    .returning({ id: piecesImportees.id });
  return emportees.length;
}

/** Le plus récent, verrouillé : deux gestes sur le même envoi passent l'un après l'autre. */
async function dernierEnvoi(tx: Tx): Promise<EnvoiEnBase | undefined> {
  const [dernier] = await tx.select().from(envoisPieces).orderBy(desc(envoisPieces.createdAt)).limit(1).for("update");
  return dernier;
}

export async function creerEnvoi(ctx: Ctx, nom: string, attendues: number): Promise<EnvoiEnBase> {
  return withEntreprise(ctx.utilisateurId, ctx.entrepriseId, async (tx) => {
    // **Un envoi pas encore rangé se REPREND** au lieu d'en ouvrir un second :
    // c'est ainsi qu'un envoi coupé (appli fermée) repart où il en était quand
    // il choisit à nouveau le même fichier. Ouvrir un second envoi laisserait
    // les pièces du premier sans écran pour les ranger.
    const dernier = await dernierEnvoi(tx);
    if (dernier && !dernier.rangeLe) {
      const [repris] = await tx
        .update(envoisPieces)
        .set({ attendues: Math.max(dernier.attendues, attendues) })
        .where(eq(envoisPieces.id, dernier.id))
        .returning();
      return repris;
    }
    // **Un envoi déjà rangé ne se reprend pas, même s'il garde des restes** :
    // il porterait un second rangement. Ses restes partent avec l'envoi neuf,
    // et se rangent avec ce qu'il apporte (`emporterLesRestes`).
    const [e] = await tx
      .insert(envoisPieces)
      .values({ entrepriseId: ctx.entrepriseId, nom: nom.slice(0, 160), attendues, createdBy: ctx.utilisateurId })
      .returning();
    const restes = await emporterLesRestes(tx, dernier, e.id);
    if (restes === 0) return e;
    // Il attend ce qu'il annonce plus ce qui restait : « 3 sur 13 », jamais « 13 sur 10 ».
    const [avecLesRestes] = await tx
      .update(envoisPieces)
      .set({ attendues: attendues + restes })
      .where(eq(envoisPieces.id, e.id))
      .returning();
    return avecLesRestes;
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
        adresseLue: champs.adresseLue?.slice(0, 300) ?? null,
        telephoneLu: champs.telephoneLu?.slice(0, 40) ?? null,
        chantierLu: champs.chantierLu?.slice(0, 300) ?? null,
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

/**
 * Où en est l'envoi. **Les comptes disent ce qui RESTE** (3 novembre 2026) :
 * une pièce rangée n'est plus attendue, ni reçue, ni lue. Sans quoi la bande
 * annoncerait « 51 documents lus » pour trois devis à nommer.
 */
export type EtatEnvoi = {
  id: string;
  nom: string;
  attendues: number;
  /** Arrivées sur le serveur, et pas encore rangées. */
  recues: number;
  /** Lues, qu'elles se rangent seules ou soient à vérifier. */
  lues: number;
  aVerifier: number;
  pretes: number;
  /** Les pièces de son rangement : « N documents rangés ». */
  rangees: number;
  /**
   * Ce qu'il reste de temps à « Annuler » ce rangement, en millisecondes,
   * compté à l'heure du SERVEUR ; `null` : rien à annuler. L'écran pose son
   * minuteur sur ce chiffre, jamais sur l'heure du téléphone.
   */
  annulableMs: number | null;
  /** L'arrivée de la dernière pièce : passé deux minutes sans rien, l'envoi est coupé. */
  derniereArrivee: Date | null;
};

/**
 * L'envoi le plus récent, tant qu'il a quelque chose à dire : une lecture en
 * cours, des pièces à ranger, ou « Annuler » pendant les six secondes qui
 * suivent un rangement (`ANNULER_PENDANT_MS`). `null` : rien en cours.
 *
 * **Le bandeau « N documents rangés » part au bout de ses six secondes, que
 * tout soit rangé ou non** (sa capture du 3 novembre 2026, *« il faut qu'il
 * disparaisse un jour »*). Avant, l'envoi n'était lâché qu'une fois TOUT
 * rangé : trois pièces sans nom gardaient le bandeau pour toujours. Ce qui
 * reste se montre ensuite comme avant tout rangement.
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
    const rangees = n("rangee");
    const restent = comptes.reduce((t, c) => t + c.n, 0) - rangees;
    const annulableMs = e.rangeLe ? resteAAnnuler(e.rangeLe, Date.now()) : null;
    // Rien ne reste, et ce qui a été rangé ne s'annule plus : la bande s'en va.
    if (restent === 0 && annulableMs === null && (rangees > 0 || e.rangeLe)) return null;
    return {
      id: e.id,
      nom: e.nom,
      // **Un envoi rangé n'attend plus rien** : il ne se range qu'arrivé en
      // entier, et ne se reprend plus (`creerEnvoi`). Déduire ses pièces
      // rangées de ce qu'il annonçait mentait dès qu'un client supprimé en
      // emportait : « 1 sur 3 » se lisait « Envoi interrompu ».
      attendues: e.rangeLe ? restent : Math.max(e.attendues - rangees, restent),
      recues: restent,
      lues: n("lue") + n("a_verifier"),
      aVerifier: n("a_verifier"),
      pretes: n("lue"),
      rangees,
      annulableMs,
      derniereArrivee: derniere ? new Date(derniere) : null,
    };
  });
}

/**
 * Les pièces lues d'un envoi, à ranger : ce que l'écran « Par client » montre,
 * et ce que le rangement relit. **Le même ordre des deux côtés** (arrivée, puis
 * identifiant) : le rang d'une pièce est sa place ici (`lignesDesPdf`).
 */
export async function piecesLuesDeLEnvoi(ctx: Ctx, envoiId: string): Promise<PieceLueDuPdf[]> {
  return withEntreprise(ctx.utilisateurId, ctx.entrepriseId, async (tx) =>
    tx
      .select({
        id: piecesImportees.id,
        genre: piecesImportees.genre,
        numero: piecesImportees.numero,
        jour: piecesImportees.jour,
        montantTtc: piecesImportees.montantTtc,
        nomLu: piecesImportees.nomLu,
        adresseLue: piecesImportees.adresseLue,
        telephoneLu: piecesImportees.telephoneLu,
        chantierLu: piecesImportees.chantierLu,
      })
      .from(piecesImportees)
      .where(and(eq(piecesImportees.envoiId, envoiId), inArray(piecesImportees.statut, ["lue", "a_verifier"])))
      .orderBy(asc(piecesImportees.createdAt), asc(piecesImportees.id))
  );
}

/** Ce qu'un rangement a écrit dans des cases vides, pour qu'« Annuler » les vide. */
type CaseCompletee = { clientId: string; champ: "adresse" | "telephone"; valeur: string };

/**
 * La fiche que le plan désigne : celle qu'il a déjà, dont seules les cases
 * VIDES se complètent (sa réponse du 28 octobre, `complementsPourFiche`), ou
 * une fiche neuve. Une seule écriture pour les tableaux et les PDF.
 */
async function ficheDuPlan(
  tx: Parameters<Parameters<typeof withEntreprise>[2]>[0],
  ctx: Ctx,
  c: ClientAPoser,
  crees: string[],
  completees: CaseCompletee[]
): Promise<string> {
  if (c.existant) {
    const [fiche] = await tx
      .select({ id: clients.id, nom: clients.nom, telephone: clients.telephone, email: clients.email, adresse: clients.adresse, creeLe: clients.createdAt })
      .from(clients)
      .where(and(eq(clients.id, c.existant), isNull(clients.deletedAt), isNull(clients.effaceLe)))
      .limit(1);
    // Retirée entre la lecture et le rangement : tout s'annule, et la
    // relecture la verra absente.
    if (!fiche) throw new Error("Une fiche du rangement a disparu pendant le rangement.");
    const plus = complementsPourFiche(fiche, { nom: fiche.nom, adresse: c.adresse, telephone: c.telephone });
    if (plus.adresse || plus.telephone) {
      await tx
        .update(clients)
        .set({ ...(plus.adresse ? { adresse: plus.adresse } : {}), ...(plus.telephone ? { telephone: plus.telephone } : {}), updatedAt: new Date() })
        .where(eq(clients.id, fiche.id));
      if (plus.adresse) completees.push({ clientId: fiche.id, champ: "adresse", valeur: plus.adresse });
      if (plus.telephone) completees.push({ clientId: fiche.id, champ: "telephone", valeur: plus.telephone });
    }
    return fiche.id;
  }
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
  return neuf.id;
}

/**
 * Range les PDF d'un envoi selon le plan que l'écran a montré
 * (`planDeRangement` sur `lignesDesPdf`), **d'un seul tenant**, comme un
 * tableau : les fiches, les cases complétées et les pièces réussissent
 * ensemble ou pas du tout.
 *
 * Chaque pièce garde le nom tel qu'il est lu ou tapé, son genre (lu ou
 * répondu) et l'adresse de son chantier. Ce que le plan ne range pas (un nom
 * qui attend, deux clients d'un même nom sans adresse) reste à ranger.
 */
export async function rangerEnvoiSelonLePlan(
  ctx: Ctx,
  envoiId: string,
  aPoser: readonly ClientAPoser[],
  idDuRang: ReadonlyMap<number, string>
): Promise<{ rangees: number; clientsCrees: number; completees: number }> {
  return withEntreprise(ctx.utilisateurId, ctx.entrepriseId, async (tx) => {
    // Verrouillé : deux onglets qui rangent le même envoi passent l'un après l'autre.
    const [envoi] = await tx.select().from(envoisPieces).where(eq(envoisPieces.id, envoiId)).limit(1).for("update");
    // Rien à ranger : rien ne s'écrit, et le rangement d'avant garde son « Annuler ».
    if (!envoi || !aPoser.some((c) => c.pieces.some((p) => idDuRang.has(p.rang)))) return { rangees: 0, clientsCrees: 0, completees: 0 };
    // Déjà rangé une fois : ce qui reste se range dans un envoi neuf, et
    // « Annuler » ne défera que ce rangement-ci (`emporterLesRestes`).
    let ici = envoi.id;
    if (envoi.rangeLe) {
      const [neuf] = await tx
        .insert(envoisPieces)
        .values({ entrepriseId: ctx.entrepriseId, nom: envoi.nom, attendues: 1, createdBy: ctx.utilisateurId })
        .returning({ id: envoisPieces.id });
      const restes = await emporterLesRestes(tx, envoi, neuf.id);
      await tx.update(envoisPieces).set({ attendues: Math.max(restes, 1) }).where(eq(envoisPieces.id, neuf.id));
      ici = neuf.id;
    }
    const crees: string[] = [];
    const completees: CaseCompletee[] = [];
    let rangees = 0;
    for (const c of aPoser) {
      const ids = c.pieces.map((p) => idDuRang.get(p.rang)).filter((id): id is string => !!id);
      if (ids.length === 0) continue;
      const clientId = await ficheDuPlan(tx, ctx, c, crees, completees);
      for (const p of c.pieces) {
        const id = idDuRang.get(p.rang);
        if (!id) continue;
        const posee = await tx
          .update(piecesImportees)
          .set({ clientId, statut: "rangee", nomLu: p.nom, genre: p.genre, adresseChantier: p.chantier, updatedAt: new Date() })
          .where(and(eq(piecesImportees.id, id), eq(piecesImportees.envoiId, ici), inArray(piecesImportees.statut, ["lue", "a_verifier"])))
          .returning({ id: piecesImportees.id });
        // Une pièce rangée entre-temps par un autre onglet : tout s'annule,
        // plutôt qu'une fiche créée sans ses pièces.
        if (posee.length === 0) throw new Error("Une pièce du rangement a changé pendant le rangement.");
        rangees++;
      }
    }
    await tx
      .update(envoisPieces)
      .set({ clientsCrees: crees, casesCompletees: completees, rangeLe: new Date() })
      .where(eq(envoisPieces.id, ici));
    return { rangees, clientsCrees: crees.length, completees: completees.length };
  });
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

    const dernier = await dernierEnvoi(tx);
    const [envoi] = await tx
      .insert(envoisPieces)
      .values({ entrepriseId: ctx.entrepriseId, nom: nom.trim().slice(0, 160) || "Tableau", attendues: total, createdBy: ctx.utilisateurId })
      .returning({ id: envoisPieces.id });
    // Ce qu'un rangement de PDF a laissé suit le tableau : il devient le dernier envoi.
    await emporterLesRestes(tx, dernier, envoi.id);

    const crees: string[] = [];
    const completees: CaseCompletee[] = [];
    const lignes: (typeof piecesImportees.$inferInsert)[] = [];
    for (const c of retenus) {
      const clientId = await ficheDuPlan(tx, ctx, c, crees, completees);
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

/** Pourquoi « Annuler » ne passe pas : l'écran le dit (`annulerRangementAction`). */
export type RefusAnnulation = "introuvable" | "plus-annulable";

/**
 * « Annuler » : les pièces du rangement redeviennent prêtes, et les fiches que
 * ce rangement a créées partent, **sauf si on s'en est servi depuis** (un
 * chantier ouvert dessus, une autre pièce rangée chez elle) : on ne retire
 * jamais ce qui porte autre chose que cet envoi.
 *
 * **Le dernier rangement, et lui seul** : un envoi n'en connaît qu'un
 * (`emporterLesRestes`), défaire l'envoi, c'est défaire celui-là.
 *
 * **Un tableau s'annule en entier** (28 octobre 2026) : ses pièces n'ont pas
 * de fichier à relire, elles partent, et le tableau se réimporte. Les cases
 * vides qu'il avait complétées se vident, si personne ne les a changées depuis.
 */
export async function annulerRangement(
  ctx: Ctx,
  envoiId: string
): Promise<{ ok: true } | { ok: false; pourquoi: RefusAnnulation }> {
  return withEntreprise(ctx.utilisateurId, ctx.entrepriseId, async (tx) => {
    const [e] = await tx.select().from(envoisPieces).where(eq(envoisPieces.id, envoiId)).limit(1).for("update");
    if (!e) return { ok: false, pourquoi: "introuvable" };
    // **Six secondes, plus la marge du réseau, comptées ICI** (`delai-annuler.ts`).
    // Le bandeau parti, un onglet resté ouvert ne défait pas un rangement
    // qu'il a laissé passer : rien ne l'en empêchait, sinon l'heure.
    if (!e.rangeLe || !annulationAdmise(e.rangeLe, Date.now())) return { ok: false, pourquoi: "plus-annulable" };
    // **Seul le dernier envoi s'annule** : derrière un envoi plus récent, les
    // pièces revenues à ranger n'auraient plus aucun écran (`envoiEnCours`).
    const dernier = await dernierEnvoi(tx);
    if (dernier?.id !== e.id) return { ok: false, pourquoi: "plus-annulable" };
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
    // Gardé, il n'attend que ce qu'il porte : un tableau qui avait emporté les
    // restes d'un envoi de PDF n'attend plus ses propres lignes, parties.
    else await tx.update(envoisPieces).set({ clientsCrees: [], casesCompletees: [], rangeLe: null, attendues: restent }).where(eq(envoisPieces.id, envoiId));
    return { ok: true };
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
