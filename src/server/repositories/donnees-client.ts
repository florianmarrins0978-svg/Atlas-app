import { and, eq, inArray, isNotNull } from "drizzle-orm";
import { withEntreprise } from "../db/with-entreprise";
import {
  brouillonsInformations,
  chantiers,
  clients,
  devis,
  envoisDevis,
  fichiersAPurger,
  lignesPrix,
  materiel,
  notesVocales,
  photos,
  prestations,
  propositionsIa,
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

// --- Effacement -----------------------------------------------------------

export type RapportEffacement = {
  /** Nombre d'éléments réellement supprimés, toutes catégories confondues. */
  supprimes: number;
  detail: Record<string, number>;
  /** Pièces conservées au titre d'une obligation légale. */
  conservees: number;
  echeanceConservation: string | null;
  /** Phrase à remettre à la personne. `null` si rien n'a été conservé. */
  motif: string | null;
};

/**
 * Efface un client : retire ce qui peut l'être, conserve ce que la loi impose.
 *
 * **Ce n'est pas une suppression de ligne.** Le droit à l'effacement cède
 * devant une obligation légale de conservation : un devis accepté vaut
 * engagement et se conserve, et l'identité qui y figure ne peut pas être
 * anonymisée sans le vider de sa valeur probante.
 *
 * Ce qui part : chantiers, photos, notes vocales et leur audio, transcriptions,
 * brouillons, prestations, matériel, lignes de prix, propositions de
 * l'assistant, envois de devis — et, sur la fiche client, tout ce qui sert à
 * recontacter (téléphone, e-mail, canal, adresse).
 *
 * Ce qui reste : les devis acceptés, et le nom du client, sans lesquels la
 * pièce ne vaut plus rien.
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

    const chantiersDuClient = await tx
      .select({ id: chantiers.id })
      .from(chantiers)
      .where(and(eq(chantiers.clientId, clientId), eq(chantiers.entrepriseId, ctx.entrepriseId)));
    const chantierIds = chantiersDuClient.map((c) => c.id);

    const detail: Record<string, number> = {};
    let conservees = 0;
    let plusRecenteConservation: Date | null = null;

    if (chantierIds.length > 0) {
      // Les devis liés à un envoi accepté valent engagement : on les garde.
      const envois = await tx
        .select({ devisId: envoisDevis.devisId, responduAt: envoisDevis.responduAt })
        .from(envoisDevis)
        .where(
          and(
            inArray(envoisDevis.chantierId, chantierIds),
            eq(envoisDevis.entrepriseId, ctx.entrepriseId),
            eq(envoisDevis.reponse, "acceptee")
          )
        );
      const devisAConserver = new Set(envois.map((e) => e.devisId));
      conservees = devisAConserver.size;
      for (const e of envois) {
        if (e.responduAt && (!plusRecenteConservation || e.responduAt > plusRecenteConservation)) {
          plusRecenteConservation = e.responduAt;
        }
      }

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

      // Devis non conservés uniquement.
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

      // Les chantiers ne partent que s'ils ne portent plus aucune pièce
      // conservée — supprimer un chantier emporterait son devis en cascade.
      if (devisAConserver.size === 0) {
        const r = (await tx
          .delete(chantiers)
          .where(
            and(inArray(chantiers.id, chantierIds), eq(chantiers.entrepriseId, ctx.entrepriseId))
          )) as { rowCount?: number };
        detail.chantiers = r?.rowCount ?? 0;
      } else {
        detail.chantiers = 0;
      }
    }

    const echeance =
      conservees > 0
        ? echeanceConservation(plusRecenteConservation ?? maintenant, CONSERVATION_LEGALE.devisAccepteAns)
        : null;

    // La fiche client : on retire tout ce qui sert à recontacter. Le nom reste
    // si — et seulement si — une pièce conservée en a besoin pour rester
    // valable ; sinon il part aussi.
    await tx
      .update(clients)
      .set({
        nom: conservees > 0 ? client.nom : "Client effacé",
        telephone: null,
        email: null,
        adresse: null,
        canalCommunication: null,
        effaceLe: maintenant,
        conservationMotif: motifConservation(conservees, echeance),
        updatedAt: maintenant,
        deletedAt: maintenant,
      })
      .where(eq(clients.id, clientId));

    const supprimes = Object.values(detail).reduce((total, n) => total + n, 0);

    return {
      supprimes,
      detail,
      conservees,
      echeanceConservation: echeance ? echeance.toISOString().slice(0, 10) : null,
      motif: motifConservation(conservees, echeance),
    };
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
