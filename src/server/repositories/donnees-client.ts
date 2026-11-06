import { and, eq, inArray, isNotNull, isNull, ne, not, sql } from "drizzle-orm";
import { withEntreprise } from "../db/with-entreprise";
import {
  brouillonsInformations,
  chantiers,
  clients,
  contratsEntretien,
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
  piecesImportees,
} from "../db/schema";
import type { Ctx } from "./context";
import { genererJeton } from "./envois-devis";
import { CONSERVATION_LEGALE, motifConservation } from "../retention";
import { echeanceConservation } from "@/lib/conservation";
import { moisDuJour } from "@/lib/jour";
import { deOuD } from "@/lib/contrats-entretien";

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
 *
 * **La désignation est écrite ici, numéro compris** (2 novembre 2026). Un
 * contrat d'entretien n'a pas de numéro : il se nomme par son premier mois.
 * L'écran, qui écrivait « n° » devant, aurait affiché « n° Contrat… ».
 */
export type PieceConservee = {
  quoi: "facture" | "devis-accepte" | "contrat-accepte";
  /** « n° F2026-000007 », « Contrat d'entretien de mars 2026 ». */
  designation: string;
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
  ctx: Pick<Ctx, "entrepriseId">,
  /** `null` : des chantiers sans client, qui ne portent aucun contrat. */
  clientId: string | null,
  chantierIds: string[],
  maintenant: Date
): Promise<{ pieces: PieceConservee[]; devisAConserver: Set<string>; chantiersAConserver: Set<string> }> {
  const pieces: PieceConservee[] = [];
  const devisAConserver = new Set<string>();
  const chantiersAConserver = new Set<string>();

  // ─── Les contrats d'entretien ACCEPTÉS — sa décision du 2 novembre 2026 ───
  //
  // *« Un contrat accepté se garde comme une facture ; un contrat jamais
  // accepté part avec lui. »* La base le tenait déjà à sa façon : la clé
  // `contrats_entretien_client_entreprise_fk` n'a pas de cascade. Mais rien ne
  // le lisait ici, et la suppression tombait sur cette clé avec « n'a pas
  // abouti », sans dire ce qui la retenait. Un contrat ne vise pas un chantier
  // (ses passages en sont), il se lit donc par son client.
  const contratsAcceptes = clientId === null ? [] : await tx
    .select({ debut: contratsEntretien.debut, dureeMois: contratsEntretien.dureeMois, reponduLe: contratsEntretien.reponduLe })
    .from(contratsEntretien)
    .where(
      and(
        eq(contratsEntretien.clientId, clientId),
        eq(contratsEntretien.entrepriseId, ctx.entrepriseId),
        eq(contratsEntretien.statut, "accepte")
      )
    )
    .orderBy(contratsEntretien.debut);
  for (const c of contratsAcceptes) {
    // **Les dix ans courent de la fin de ce qui a été promis**, pas de
    // l'acceptation (Code de la consommation, D213-2) : un contrat de deux ans
    // accepté aujourd'hui engage encore dix ans après son dernier passage. Une
    // reconduction le prolonge encore ; rien ne purge sur cette date, elle
    // ne sert qu'à le dire.
    const fin = new Date(`${c.debut}T00:00:00Z`);
    fin.setUTCMonth(fin.getUTCMonth() + c.dureeMois);
    const depuis = c.reponduLe && c.reponduLe > fin ? c.reponduLe : fin;
    pieces.push({
      quoi: "contrat-accepte",
      designation: `Contrat d'entretien ${deOuD(`${moisDuJour(c.debut)} ${c.debut.slice(0, 4)}`)}`,
      pourquoi: `Un contrat accepté vaut engagement : il se conserve ${CONSERVATION_LEGALE.contratAccepteAns} ans.`,
      jusquAu: echeanceConservation(depuis, CONSERVATION_LEGALE.contratAccepteAns).toISOString().slice(0, 10),
    });
  }

  if (chantierIds.length === 0) return { pieces, devisAConserver, chantiersAConserver };

  // ─── TOUTES les factures, émises ou en brouillon ──────────────────────────
  //
  // **Ce n'est pas Atlas qui refuse, c'est la base ET la loi.** La clé
  // étrangère `factures_chantier_entreprise_fk` est en RESTRICT : un chantier
  // qui porte une facture ne se supprime pas, quoi qu'on demande. Le lire ici
  // permet de le DIRE avant, plutôt que de laisser tomber une erreur brute.
  //
  // **Le brouillon aussi, depuis le 2 novembre 2026.** Seules les émises
  // étaient lues : un chantier terminé et pas encore facturé faisait tomber la
  // suppression sur cette clé, sans un mot. Un brouillon a déjà PRIS son numéro
  // (`attribuerNumeroFacture`, à sa création) : l'effacer trouerait la suite
  // des factures, ce qu'un contrôle relève. Il reste donc, comme une émise.
  const facturesNumerotees = await tx
    .select({
      id: factures.id,
      chantierId: factures.chantierId,
      devisId: factures.devisId,
      numero: factures.numeroCommercial,
      statut: factures.statut,
      emiseLe: factures.emiseLe,
    })
    .from(factures)
    .where(and(inArray(factures.chantierId, chantierIds), eq(factures.entrepriseId, ctx.entrepriseId)));
  for (const f of facturesNumerotees) {
    chantiersAConserver.add(f.chantierId);
    // **Nul sur une facture directe** (migration 0086) : il n'y a pas de devis
    // à retenir, seulement la facture elle-même — déjà inscrite juste en
    // dessous. Sans cette garde, un `null` entrait dans l'ensemble des devis à
    // conserver, et le premier effacement qui l'aurait comparé aurait retenu, ou
    // laissé partir, un devis au hasard.
    if (f.devisId) devisAConserver.add(f.devisId);
    pieces.push({
      quoi: "facture",
      designation: `n° ${f.numero}`,
      pourquoi:
        f.statut === "emise"
          ? "Une facture émise se conserve dix ans."
          : "Une facture déjà numérotée reste : ses numéros doivent se suivre.",
      jusquAu: echeanceConservation(f.emiseLe ?? maintenant, CONSERVATION_LEGALE.facturesAns)
        .toISOString()
        .slice(0, 10),
    });
  }

  // ─── Les devis ACCEPTÉS — dix ans, ils valent engagement ──────────────────
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
      designation: `n° ${numeros.get(a.devisId) ?? "?"}`,
      pourquoi: `Un devis accepté vaut engagement : il se conserve ${CONSERVATION_LEGALE.devisAccepteAns} ans.`,
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
    const { pieces } = await cequiDoitRester(tx, ctx, clientId, chantierIds, maintenant);

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
    // Ses pièces importées comptent comme ses devis : elles partent avec lui
    // (`effacerClient`), donc la question de la sauvegarde doit se poser.
    const importees = await tx
      .select({ id: piecesImportees.id })
      .from(piecesImportees)
      .where(and(eq(piecesImportees.clientId, clientId), eq(piecesImportees.entrepriseId, ctx.entrepriseId)));
    // Ses contrats jamais acceptés aussi : ils partent avec lui. Les acceptés
    // sont déjà comptés, dans `pieces`.
    const contrats = await tx
      .select({ id: contratsEntretien.id })
      .from(contratsEntretien)
      .where(
        and(
          eq(contratsEntretien.clientId, clientId),
          eq(contratsEntretien.entrepriseId, ctx.entrepriseId),
          ne(contratsEntretien.statut, "accepte")
        )
      );
    return {
      nom: client.nom,
      pieces,
      documents: documents + importees.length + contrats.length + pieces.length,
    };
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
 *   · un **devis accepté** — dix ans, il vaut engagement (garantie décennale).
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
  return withEntreprise(ctx.utilisateurId, ctx.entrepriseId, (tx) => effacerClientDans(tx, ctx, clientId, maintenant));
}

/**
 * CE QUI PART DE CES CHANTIERS, et ce qui reste : la moitié « chantiers » de
 * l'effacement d'un client, séparée le 6 novembre 2026 pour servir aussi aux
 * chantiers SANS client d'un compte fermé (`effacerChantiersSansClientDans`).
 * Une seule règle de ce qui part d'un chantier, et deux appelants.
 */
async function effacerLesChantiersDans(
  tx: Parameters<Parameters<typeof withEntreprise>[2]>[0],
  ctx: Pick<Ctx, "entrepriseId">,
  chantierIds: string[],
  devisAConserver: Set<string>,
  chantiersAConserver: Set<string>,
  detail: Record<string, number>,
  maintenant: Date
): Promise<void> {
  if (chantierIds.length === 0) return;
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

  // **LE LIEN PART, LE « OUI » RESTE — sa réponse du 5 novembre 2026.**
  //
  // Un envoi porte deux choses : le lien public vers le devis, et la
  // réponse du client. Tout envoi partait, y compris celui d'un devis
  // conservé : le devis restait dix ans, la preuve qu'il avait été accepté
  // (le jour, la réponse, l'empreinte du devis lu) disparaissait. Et c'est
  // aussi par cet envoi que `cequiDoitRester` reconnaît un devis accepté :
  // un second effacement ne l'aurait plus vu.
  //
  // L'envoi qui porte l'acceptation d'un devis conservé reste donc ; son
  // lien meurt deux fois, jeton remplacé par un jeton jamais envoyé, et
  // échéance passée. Le mot libre du client part : il n'est pas la preuve.
  const gardes = [...devisAConserver];
  const preuveDAcceptation =
    gardes.length > 0
      ? and(inArray(envoisDevis.devisId, gardes), sql`coalesce(${envoisDevis.reponse} = 'acceptee', false)`)
      : undefined;
  const rEnvois = (await tx
    .delete(envoisDevis)
    .where(
      and(
        inArray(envoisDevis.chantierId, chantierIds),
        eq(envoisDevis.entrepriseId, ctx.entrepriseId),
        preuveDAcceptation ? not(preuveDAcceptation) : undefined
      )
    )) as { rowCount?: number };
  detail.envois = rEnvois?.rowCount ?? 0;
  if (preuveDAcceptation) {
    const preuves = await tx
      .select({ id: envoisDevis.id })
      .from(envoisDevis)
      .where(and(eq(envoisDevis.entrepriseId, ctx.entrepriseId), preuveDAcceptation));
    for (const { id } of preuves) {
      await tx
        .update(envoisDevis)
        .set({ jeton: genererJeton(), expireAt: maintenant, precisionClient: null })
        .where(eq(envoisDevis.id, id));
    }
  }

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

/**
 * LES CHANTIERS SANS CLIENT d'un compte fermé, trente jours après (6 novembre
 * 2026). Aucun client ne les porte, donc aucun effacement de client ne les
 * atteint : ils passent par la même règle, ce qui est cloué reste (facture,
 * devis accepté), le reste part.
 *
 * Même contrat que `effacerClientDans` : `app.entreprise_id` posé par
 * l'appelant, et la porte du déclencheur des devis ouverte par lui.
 */
export async function effacerChantiersSansClientDans(
  tx: Parameters<Parameters<typeof withEntreprise>[2]>[0],
  ctx: Pick<Ctx, "entrepriseId">,
  maintenant: Date
): Promise<number> {
  const sansClient = await tx
  .select({ id: chantiers.id })
  .from(chantiers)
  .where(and(eq(chantiers.entrepriseId, ctx.entrepriseId), isNull(chantiers.clientId)));
  const chantierIds = sansClient.map((c) => c.id);
  if (chantierIds.length === 0) return 0;
  const { devisAConserver, chantiersAConserver } = await cequiDoitRester(tx, ctx, null, chantierIds, maintenant);
  const detail: Record<string, number> = {};
  await effacerLesChantiersDans(tx, ctx, chantierIds, devisAConserver, chantiersAConserver, detail, maintenant);
  return detail.chantiers ?? 0;
}

/**
 * LE MÊME EFFACEMENT, DANS UNE TRANSACTION DÉJÀ OUVERTE — pour la purge des
 * comptes fermés (`fermeture-compte.ts`, 5 novembre 2026).
 *
 * Trente jours après la fermeture, tout client s'efface selon CETTE règle, et
 * pas une seconde : ses factures et ses devis acceptés restent, le reste part.
 * La purge n'a ni session ni utilisateur, et le compte est en lecture seule :
 * elle pose son contexte elle-même, comme les autres purges planifiées.
 *
 * L'appelant DOIT avoir posé `app.entreprise_id` sur cette transaction : sans
 * lui, la RLS ne laisse rien voir, et l'effacement ne trouverait aucun client.
 */
export async function effacerClientDans(
  tx: Parameters<Parameters<typeof withEntreprise>[2]>[0],
  ctx: Pick<Ctx, "entrepriseId">,
  clientId: string,
  maintenant: Date
): Promise<RapportEffacement | null> {
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
    clientId,
    chantierIds,
    maintenant
  );

  // **Ses pièces importées partent avec lui** — sa décision du 22 octobre
  // 2026, *« avec le même message »*. Ce sont les archives d'un autre
  // logiciel : rien ne les cloue ici, et la question de la sauvegarde a été
  // posée avant (`apercuSuppressionClient`). Laissées, elles gardaient son
  // nom sans plus aucun lien vers lui.
  const importees = await tx
    .delete(piecesImportees)
    .where(and(eq(piecesImportees.clientId, clientId), eq(piecesImportees.entrepriseId, ctx.entrepriseId)))
    .returning({ cle: piecesImportees.fichierCle });
  // Une ligne de tableau n'a pas de fichier à purger (migration 0154).
  for (const { cle } of importees) {
    if (cle) await tx.insert(fichiersAPurger).values({ storageKey: cle });
  }
  detail.piecesImportees = importees.length;

  await effacerLesChantiersDans(tx, ctx, chantierIds, devisAConserver, chantiersAConserver, detail, maintenant);

  // **Ses contrats jamais acceptés partent avec lui**, et APRÈS ses
  // chantiers : un passage de contrat est un chantier qui vise son contrat,
  // et la clé ne cède pas. Les dates du mois envoyées partent en cascade.
  // L'accepté reste : il est dans `pieces`, et retient le client plus bas.
  const rContrats = (await tx
    .delete(contratsEntretien)
    .where(
      and(
        eq(contratsEntretien.clientId, clientId),
        eq(contratsEntretien.entrepriseId, ctx.entrepriseId),
        ne(contratsEntretien.statut, "accepte")
      )
    )) as { rowCount?: number };
  detail.contrats = rContrats?.rowCount ?? 0;

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
