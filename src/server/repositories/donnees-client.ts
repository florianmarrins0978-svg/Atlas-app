import { and, eq, inArray, isNotNull, sql } from "drizzle-orm";
import { withEntreprise } from "../db/with-entreprise";
import {
  brouillonsInformations,
  chantiers,
  clients,
  devis,
  envoisDevis,
  factures,
  fichiersAPurger,
  lignesPrix,
  materiel,
  notesVocales,
  photos,
  prestations,
  propositionsIa,
  messagesAssistant,
} from "../db/schema";
import type { Ctx } from "./context";
import { CONSERVATION_LEGALE, echeanceConservation, motifConservation } from "../retention";

// Droits des personnes — voir docs/RGPD.md §5.
//
// Les clients de l'artisan exercent leurs droits AUPRÈS DE LUI, pas auprès de
// nous : notre obligation est de lui en donner les moyens. Ces deux fonctions
// sont ces moyens.

// --- Export ---------------------------------------------------------------

export type ExportClient = {
  exporteLe: string;
  client: Record<string, unknown>;
  chantiers: {
    chantier: Record<string, unknown>;
    prestations: Record<string, unknown>[];
    materiel: Record<string, unknown>[];
    lignesPrix: Record<string, unknown>[];
    notesVocales: Record<string, unknown>[];
    photos: Record<string, unknown>[];
    devis: Record<string, unknown>[];
  }[];
};

/**
 * Toutes les données rattachées à un client, dans un format lisible.
 *
 * Volontairement exhaustif : un export partiel ne satisfait pas une demande
 * d'accès, et l'artisan n'a aucun moyen de vérifier ce qui manque.
 *
 * Les clés de stockage des fichiers sont incluses par honnêteté — elles
 * signalent l'existence d'une photo ou d'un enregistrement. Les fichiers
 * eux-mêmes se récupèrent séparément : les inliner produirait un export de
 * plusieurs dizaines de mégaoctets qu'aucune messagerie n'accepte.
 */
export async function exporterClient(
  ctx: Ctx,
  clientId: string,
  maintenant: Date = new Date()
): Promise<ExportClient | null> {
  return withEntreprise(ctx.utilisateurId, ctx.entrepriseId, async (tx) => {
    const [client] = await tx
      .select()
      .from(clients)
      .where(and(eq(clients.id, clientId), eq(clients.entrepriseId, ctx.entrepriseId)))
      .limit(1);
    if (!client) return null;

    const chantiersDuClient = await tx
      .select()
      .from(chantiers)
      .where(and(eq(chantiers.clientId, clientId), eq(chantiers.entrepriseId, ctx.entrepriseId)));

    const detail = [];
    for (const chantier of chantiersDuClient) {
      const [pres, mat, prix, notes, phot, dev] = await Promise.all([
        tx.select().from(prestations).where(eq(prestations.chantierId, chantier.id)),
        tx.select().from(materiel).where(eq(materiel.chantierId, chantier.id)),
        tx.select().from(lignesPrix).where(eq(lignesPrix.chantierId, chantier.id)),
        tx.select().from(notesVocales).where(eq(notesVocales.chantierId, chantier.id)),
        tx.select().from(photos).where(eq(photos.chantierId, chantier.id)),
        tx.select().from(devis).where(eq(devis.chantierId, chantier.id)),
      ]);
      detail.push({
        chantier,
        prestations: pres,
        materiel: mat,
        lignesPrix: prix,
        notesVocales: notes,
        photos: phot,
        devis: dev,
      });
    }

    return {
      exporteLe: maintenant.toISOString(),
      client,
      chantiers: detail,
    };
  });
}

// --- Ce qui NE PEUT PAS partir --------------------------------------------

/**
 * Une pièce que la loi oblige à garder, nommée pour être montrée à l'écran.
 *
 * **Elle porte son numéro, et c'est délibéré.** « Une facture est conservée »
 * est une phrase ; « la facture n° F2026-0009 est conservée dix ans » se
 * retrouve dans un classeur. Ce que le patron ne peut pas situer, il le croit
 * perdu.
 */
export type PieceConservee = {
  quoi: "facture" | "devis-accepte";
  numero: string;
  /** Ce qu'on lui dit, dans ses mots. */
  pourquoi: string;
  /** Jusqu'à quand, au format « AAAA-MM-JJ ». */
  jusquAu: string;
};

/**
 * Ce qu'une suppression laisserait derrière elle — **avant** de rien toucher.
 *
 * **Une seule règle, deux emplois** (`CLAUDE.md` §3) : cet écran d'avertissement
 * et la suppression elle-même lisent la MÊME fonction. Deux implémentations
 * finiraient par diverger, et c'est l'écran qui mentirait — on lui promettrait
 * que tout part, et la facture resterait.
 */
async function cequiDoitRester(
  tx: Parameters<Parameters<typeof withEntreprise>[2]>[0],
  ctx: Ctx,
  chantierIds: string[],
  maintenant: Date
): Promise<{ pieces: PieceConservee[]; devisAConserver: Set<string>; chantiersAConserver: Set<string> }> {
  const pieces: PieceConservee[] = [];
  const devisAConserver = new Set<string>();
  const chantiersAConserver = new Set<string>();
  if (chantierIds.length === 0) return { pieces, devisAConserver, chantiersAConserver };

  // ─── Les factures ÉMISES — dix ans, Code de commerce L123-22 ──────────────
  //
  // **Ce n'est pas Atlas qui refuse, c'est la base ET la loi.** La clé
  // étrangère `factures_chantier_entreprise_fk` est en RESTRICT : un chantier
  // qui porte une facture ne se supprime pas, quoi qu'on demande. Le lire ici
  // permet de le DIRE avant, plutôt que de laisser tomber une erreur brute.
  const facturesEmises = await tx
    .select({
      id: factures.id,
      chantierId: factures.chantierId,
      devisId: factures.devisId,
      numero: factures.numeroCommercial,
      emiseLe: factures.emiseLe,
    })
    .from(factures)
    .where(
      and(
        inArray(factures.chantierId, chantierIds),
        eq(factures.entrepriseId, ctx.entrepriseId),
        eq(factures.statut, "emise")
      )
    );
  for (const f of facturesEmises) {
    chantiersAConserver.add(f.chantierId);
    devisAConserver.add(f.devisId);
    pieces.push({
      quoi: "facture",
      numero: f.numero,
      pourquoi: "Une facture émise se conserve dix ans.",
      jusquAu: echeanceConservation(f.emiseLe ?? maintenant, CONSERVATION_LEGALE.facturesAns)
        .toISOString()
        .slice(0, 10),
    });
  }

  // ─── Les devis ACCEPTÉS — cinq ans, ils valent engagement ─────────────────
  const acceptes = await tx
    .select({ devisId: envoisDevis.devisId, chantierId: envoisDevis.chantierId, responduAt: envoisDevis.responduAt })
    .from(envoisDevis)
    .where(
      and(
        inArray(envoisDevis.chantierId, chantierIds),
        eq(envoisDevis.entrepriseId, ctx.entrepriseId),
        eq(envoisDevis.reponse, "acceptee")
      )
    );
  const numeros = new Map<string, string>();
  if (acceptes.length > 0) {
    for (const d of await tx
      .select({ id: devis.id, numero: devis.numeroCommercial })
      .from(devis)
      .where(inArray(devis.id, acceptes.map((a) => a.devisId)))) {
      numeros.set(d.id, d.numero);
    }
  }
  for (const a of acceptes) {
    if (devisAConserver.has(a.devisId)) continue; // déjà retenu par sa facture
    devisAConserver.add(a.devisId);
    chantiersAConserver.add(a.chantierId);
    pieces.push({
      quoi: "devis-accepte",
      numero: numeros.get(a.devisId) ?? "?",
      pourquoi: "Un devis accepté vaut engagement : il se conserve cinq ans.",
      jusquAu: echeanceConservation(a.responduAt ?? maintenant, CONSERVATION_LEGALE.devisAccepteAns)
        .toISOString()
        .slice(0, 10),
    });
  }

  return { pieces, devisAConserver, chantiersAConserver };
}

/**
 * Ce que la suppression de ce client laisserait — **sans rien toucher**.
 *
 * C'est ce que l'écran montre avant de demander confirmation : sa règle du
 * 27 août 2026 — *« lorsqu'un client a des documents il faut mettre la phrase
 * de prévention »*. Une phrase générale ne prévient de rien ; ce qui prévient,
 * c'est le numéro de la facture qui restera.
 */
export async function apercuSuppressionClient(
  ctx: Ctx,
  clientId: string,
  maintenant: Date = new Date()
): Promise<{ nom: string; pieces: PieceConservee[]; documents: number } | null> {
  return withEntreprise(ctx.utilisateurId, ctx.entrepriseId, async (tx) => {
    const [client] = await tx
      .select({ nom: clients.nom })
      .from(clients)
      .where(and(eq(clients.id, clientId), eq(clients.entrepriseId, ctx.entrepriseId)))
      .limit(1);
    if (!client) return null;

    const desChantiers = await tx
      .select({ id: chantiers.id })
      .from(chantiers)
      .where(and(eq(chantiers.clientId, clientId), eq(chantiers.entrepriseId, ctx.entrepriseId)));
    const chantierIds = desChantiers.map((c) => c.id);
    const { pieces } = await cequiDoitRester(tx, ctx, chantierIds, maintenant);

    // **Le compte des documents décide de la phrase de prévention.** Un client
    // qui n'a rien reçu n'a pas besoin qu'on l'alarme ; c'est sa règle du
    // 27 août, et elle vaut dans les deux sens (`CLAUDE.md` §4 ter : un
    // avertissement qui parle à tort s'apprend à être ignoré).
    let documents = 0;
    if (chantierIds.length > 0) {
      const [{ n } = { n: 0 }] = await tx
        .select({ n: devis.id })
        .from(devis)
        .where(inArray(devis.chantierId, chantierIds))
        .then((lignes) => [{ n: lignes.length }]);
      documents = n;
    }
    return { nom: client.nom, pieces, documents: documents + pieces.length };
  });
}

// --- Effacement -----------------------------------------------------------

export type RapportEffacement = {
  /** Nombre d'éléments réellement supprimés, toutes catégories confondues. */
  supprimes: number;
  detail: Record<string, number>;
  /** Ce que la loi oblige à garder, nommé pièce par pièce. Vide si rien ne reste. */
  pieces: PieceConservee[];
  /**
   * Le client a-t-il ENTIÈREMENT disparu ?
   *
   * Faux quand une pièce légale l'a retenu : la facture porte son nom, et un
   * nom retiré la vide de sa valeur probante.
   */
  disparu: boolean;
  /** Phrase à remettre à la personne. `null` si rien n'a été conservé. */
  motif: string | null;
};

/**
 * Supprime un client — **sa proposition C, tranchée le 27 août 2026.**
 *
 * *« Je pense la C ; lorsqu'un client a des documents il faut mettre la phrase
 * de prévention, et une phrase disant avez-vous sauvegardé ses documents autre
 * part — et s'il dit oui il peut supprimer quand même. »*
 *
 * **Tout part, sauf ce que la loi cloue.** Chantiers, photos, notes vocales et
 * leur audio, transcriptions, brouillons, prestations, matériel, lignes de prix,
 * propositions de l'assistant, envois — et, depuis sa décision, **les devis
 * envoyés qui n'ont pas été acceptés** : ils n'engagent rien
 * (`src/server/retention.ts`), et les garder revenait à ne jamais pouvoir
 * supprimer un client à qui l'on a écrit une fois.
 *
 * **Ce qui résiste, et qu'aucune confirmation ne lève :**
 *
 *   · une **facture émise** — dix ans, Code de commerce L123-22, et la clé
 *     étrangère est en RESTRICT : la base refuserait de toute façon ;
 *   · un **devis accepté** — cinq ans, il vaut engagement.
 *
 * Dans ces deux cas le client ne disparaît pas : son nom reste sur la pièce,
 * tout le reste part, et le rapport DIT ce qui a été gardé, avec son numéro.
 * `disparu` vaut alors faux — l'écran s'en sert pour ne pas annoncer une
 * suppression qui n'a pas eu lieu.
 *
 * **La porte du déclencheur s'ouvre ICI et nulle part ailleurs.** Un devis
 * envoyé est protégé par `trg_devis_immuable` (migration 0001) ; la migration
 * 0068 lui apprend à céder pour un `DELETE`, et seulement quand ce réglage de
 * session est posé. Il vit le temps de la transaction et meurt avec elle.
 */
export async function effacerClient(
  ctx: Ctx,
  clientId: string,
  maintenant: Date = new Date()
): Promise<RapportEffacement | null> {
  return withEntreprise(ctx.utilisateurId, ctx.entrepriseId, async (tx) => {
    const [client] = await tx
      .select()
      .from(clients)
      .where(and(eq(clients.id, clientId), eq(clients.entrepriseId, ctx.entrepriseId)))
      .limit(1);
    if (!client) return null;

    // **Le troisième argument est `true` : la portée est la TRANSACTION.** Posé
    // à `false`, le réglage survivrait à la connexion rendue au pool, et la
    // prochaine requête à passer par là pourrait détruire un devis parti sans
    // que personne l'ait demandé.
    await tx.execute(sql`SELECT set_config('atlas.effacement_client', 'oui', true)`);

    const chantiersDuClient = await tx
      .select({ id: chantiers.id })
      .from(chantiers)
      .where(and(eq(chantiers.clientId, clientId), eq(chantiers.entrepriseId, ctx.entrepriseId)));
    const chantierIds = chantiersDuClient.map((c) => c.id);

    const detail: Record<string, number> = {};
    const { pieces, devisAConserver, chantiersAConserver } = await cequiDoitRester(
      tx,
      ctx,
      chantierIds,
      maintenant
    );

    if (chantierIds.length > 0) {
      // Fichiers : mis en file de purge plutôt que détruits sur place — une
      // transaction annulée ne doit jamais laisser un objet effacé face à une
      // ligne encore vivante.
      const fichiers = [
        ...(await tx
          .select({ cle: photos.storageKey })
          .from(photos)
          .where(inArray(photos.chantierId, chantierIds))),
        ...(await tx
          .select({ cle: notesVocales.storageKey })
          .from(notesVocales)
          .where(inArray(notesVocales.chantierId, chantierIds))),
      ]
        .map((f) => f.cle)
        .filter((c): c is string => c !== null);

      for (const cle of fichiers) {
        await tx.insert(fichiersAPurger).values({ storageKey: cle });
      }
      detail.fichiers = fichiers.length;

      const suppressions: [string, () => Promise<unknown>][] = [
        ["photos", () => tx.delete(photos).where(inArray(photos.chantierId, chantierIds))],
        ["notesVocales", () => tx.delete(notesVocales).where(inArray(notesVocales.chantierId, chantierIds))],
        ["brouillons", () => tx.delete(brouillonsInformations).where(inArray(brouillonsInformations.chantierId, chantierIds))],
        ["prestations", () => tx.delete(prestations).where(inArray(prestations.chantierId, chantierIds))],
        ["materiel", () => tx.delete(materiel).where(inArray(materiel.chantierId, chantierIds))],
        ["lignesPrix", () => tx.delete(lignesPrix).where(inArray(lignesPrix.chantierId, chantierIds))],
        ["propositionsIa", () => tx.delete(propositionsIa).where(inArray(propositionsIa.chantierId, chantierIds))],
        /**
         * **Ce qu'il a demandé à l'assistant DEPUIS les chantiers de ce
         * client** (migration 0069). Une conversation dit ce qu'on cherchait
         * chez quelqu'un ; l'effacement ne peut pas la laisser derrière.
         *
         * **Ce que cette ligne n'attrape PAS, et il faut le savoir** : un
         * message posé depuis un autre écran ne porte aucun chantier, et peut
         * pourtant nommer ce client. Le fil est plafonné à trente messages
         * (`fil-assistant.ts`), donc il s'efface de lui-même en une poignée
         * d'échanges — mais ce n'est pas une garantie, et c'est écrit dans
         * `TODO.md`.
         */
        [
          "messagesAssistant",
          () => tx.delete(messagesAssistant).where(inArray(messagesAssistant.chantierId, chantierIds)),
        ],
      ];
      for (const [nom, executer] of suppressions) {
        const r = (await executer()) as { rowCount?: number };
        detail[nom] = r?.rowCount ?? 0;
      }

      // Les envois portent le lien public vers le devis : ils sont retirés dans
      // tous les cas, y compris pour un devis conservé. Un lien qui survivrait
      // à un effacement rouvrirait l'accès aux données qu'on vient de retirer.
      const rEnvois = (await tx
        .delete(envoisDevis)
        .where(
          and(inArray(envoisDevis.chantierId, chantierIds), eq(envoisDevis.entrepriseId, ctx.entrepriseId))
        )) as { rowCount?: number };
      detail.envois = rEnvois?.rowCount ?? 0;

      // **Les devis ENVOYÉS partent aussi, sauf ceux qui sont cloués.** C'est ce
      // que sa décision du 27 août change : avant, tout devis parti bloquait
      // l'opération entière sur le déclencheur d'immuabilité.
      const tousDevis = await tx
        .select({ id: devis.id })
        .from(devis)
        .where(inArray(devis.chantierId, chantierIds));
      const devisSupprimables = tousDevis.map((d) => d.id).filter((id) => !devisAConserver.has(id));
      if (devisSupprimables.length > 0) {
        const r = (await tx.delete(devis).where(inArray(devis.id, devisSupprimables))) as {
          rowCount?: number;
        };
        detail.devis = r?.rowCount ?? 0;
      } else {
        detail.devis = 0;
      }

      // Un chantier ne part que s'il ne porte plus aucune pièce conservée —
      // le supprimer emporterait sa facture en cascade, ce que la clé étrangère
      // refuse de toute façon.
      const chantiersSupprimables = chantierIds.filter((id) => !chantiersAConserver.has(id));
      if (chantiersSupprimables.length > 0) {
        const r = (await tx
          .delete(chantiers)
          .where(
            and(inArray(chantiers.id, chantiersSupprimables), eq(chantiers.entrepriseId, ctx.entrepriseId))
          )) as { rowCount?: number };
        detail.chantiers = r?.rowCount ?? 0;
      } else {
        detail.chantiers = 0;
      }
    }

    const echeance = pieces.length > 0 ? pieces.map((p) => p.jusquAu).sort().at(-1) ?? null : null;
    const motif = motifConservation(pieces.length, echeance ? new Date(`${echeance}T00:00:00Z`) : null);

    if (pieces.length === 0) {
      // **RIEN NE RETIENT CE CLIENT : IL DISPARAÎT POUR DE BON.** C'est sa
      // proposition C, et c'est ce qui la distingue des deux autres — une fiche
      // renommée « Client effacé » qui reste dans la base n'est pas une
      // suppression, et il l'aurait retrouvée en cherchant.
      const r = (await tx
        .delete(clients)
        .where(and(eq(clients.id, clientId), eq(clients.entrepriseId, ctx.entrepriseId)))) as {
        rowCount?: number;
      };
      detail.client = r?.rowCount ?? 0;
      const supprimes = Object.values(detail).reduce((total, n) => total + n, 0);
      return { supprimes, detail, pieces, disparu: true, motif: null };
    }

    // Une pièce le retient : son nom reste (sans lui, la pièce ne vaut plus
    // rien), tout ce qui sert à le recontacter part.
    await tx
      .update(clients)
      .set({
        telephone: null,
        email: null,
        adresse: null,
        canalCommunication: null,
        effaceLe: maintenant,
        conservationMotif: motif,
        updatedAt: maintenant,
        deletedAt: maintenant,
      })
      .where(eq(clients.id, clientId));

    const supprimes = Object.values(detail).reduce((total, n) => total + n, 0);
    return { supprimes, detail, pieces, disparu: false, motif };
  });
}

/**
 * Les clients effacés, pour justifier a posteriori de ce qui a été fait.
 *
 * Filtre sur la date d'effacement, jamais sur `deletedAt` : un effacement pose
 * les deux, et chercher les lignes NON supprimées ne remonterait donc jamais
 * un seul client effacé — la fonction censée prouver l'effacement renverrait
 * toujours vide.
 */
export async function clientsEfface(ctx: Ctx) {
  return withEntreprise(ctx.utilisateurId, ctx.entrepriseId, async (tx) =>
    tx
      .select({
        id: clients.id,
        effaceLe: clients.effaceLe,
        conservationMotif: clients.conservationMotif,
      })
      .from(clients)
      .where(and(eq(clients.entrepriseId, ctx.entrepriseId), isNotNull(clients.effaceLe)))
  );
}
