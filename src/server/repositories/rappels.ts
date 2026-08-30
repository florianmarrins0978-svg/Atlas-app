import { and, desc, eq, isNull, isNotNull, lt, gt, sql } from "drizzle-orm";
import { withEntreprise } from "../db/with-entreprise";
import { chantiers, entreprises, envoisDevis, factures, rappelsVus } from "../db/schema";
import {
  lireRappels,
  normaliserRappels,
  seuilAncienneté,
  echeanceFacture,
  rappelFactureDu,
  rappelEncoreTu,
  silenceApresVuJours,
  type GenreRappel,
  type GenreAcquittable,
  type ReglagesRappels,
} from "../../lib/rappels";
import type { Ctx } from "./context";

/**
 * Les quatre rappels : leur réglage, et ce qu'ils rappellent.
 *
 * **Tout passe par `withEntreprise`** — ici les données appartiennent bien à une
 * entreprise, contrairement au compte de la personne (`compte.ts`). Une requête
 * hors de ce cadre ne renverrait rien, silencieusement.
 */

export async function lireReglagesRappels(ctx: Ctx): Promise<ReglagesRappels> {
  return withEntreprise(ctx.utilisateurId, ctx.entrepriseId, async (tx) => {
    const [ligne] = await tx
      .select({
        chantierSansDevisJours: entreprises.rappelChantierSansDevisJours,
        devisSansReponseJours: entreprises.rappelDevisSansReponseJours,
        chantierNonFactureJours: entreprises.rappelChantierNonFactureJours,
        factureImpayeeJours: entreprises.rappelFactureImpayeeJours,
        factureImpayeeRythmeJours: entreprises.rappelFactureRythmeJours,
      })
      .from(entreprises)
      .where(eq(entreprises.id, ctx.entrepriseId))
      .limit(1);
    return lireRappels(ligne);
  });
}

export async function ecrireReglagesRappels(ctx: Ctx, saisie: Partial<ReglagesRappels>): Promise<ReglagesRappels> {
  const propre = normaliserRappels(saisie);
  return withEntreprise(ctx.utilisateurId, ctx.entrepriseId, async (tx) => {
    await tx
      .update(entreprises)
      .set({
        rappelChantierSansDevisJours: propre.chantierSansDevisJours,
        rappelDevisSansReponseJours: propre.devisSansReponseJours,
        rappelChantierNonFactureJours: propre.chantierNonFactureJours,
        rappelFactureImpayeeJours: propre.factureImpayeeJours,
        rappelFactureRythmeJours: propre.factureImpayeeRythmeJours,
      })
      .where(eq(entreprises.id, ctx.entrepriseId));
    return propre;
  });
}

export type Rappel = {
  genre: GenreRappel;
  chantierId: string;
  chantierNom: string;
  /** Depuis quand la situation dure — jamais un nombre de jours pré-calculé,
   *  pour que l'écran le formule dans sa langue. */
  depuis: Date;
  /**
   * Ce que porte le seul rappel d'impayé, et lui seul.
   *
   * **Le RESTE dû, jamais le total.** Sur une facture partiellement réglée,
   * afficher le total ferait réclamer une somme déjà encaissée ; afficher le
   * reste sans rappeler le total la ferait passer pour une petite facture. Les
   * deux sont donc là (sa planche, écran 1).
   */
  facture?: {
    id: string;
    numero: string;
    /** En centimes d'euro, pour que l'écran mette la forme sans arrondir deux fois. */
    resteDuCts: number;
    totalCts: number;
  };
};

/**
 * Ce qu'il y a à rappeler, maintenant.
 *
 * **`maintenant` est un PARAMÈTRE, jamais `new Date()` pris ici.** Sans cela,
 * aucune suite ne pourrait éprouver « au bout de sept jours » sans attendre
 * sept jours — et c'est exactement le contrôle qui compte.
 *
 * **Un rappel éteint ne coûte aucune requête.** Ce n'est pas une optimisation :
 * une requête jouée puis jetée finirait par être lue comme la preuve que le
 * rappel fonctionne, alors qu'il est coupé.
 */
export async function rappelsEnCours(ctx: Ctx, maintenant: Date): Promise<Rappel[]> {
  const reglages = await lireReglagesRappels(ctx);
  if (
    reglages.chantierSansDevisJours === null &&
    reglages.devisSansReponseJours === null &&
    reglages.chantierNonFactureJours === null &&
    reglages.factureImpayeeJours === null
  ) {
    return [];
  }

  return withEntreprise(ctx.utilisateurId, ctx.entrepriseId, async (tx) => {
    const sortie: Rappel[] = [];

    // **Le chantier ouvert dont aucun devis n'est parti.** Sa demande du
    // 14 août 2026 — « comme la Mme Félicie, vue il y a quatorze jours, aucun
    // devis envoyé ».
    //
    // Il se lit sur le CHANTIER, pas sur un envoi : c'est ce qui le distingue
    // de « devis sans réponse » juste en dessous. Un devis jamais parti ne
    // laisse aucune ligne dans `envois_devis`, donc rien à interroger là-bas.
    if (reglages.chantierSansDevisJours !== null) {
      const seuil = seuilAncienneté(maintenant, reglages.chantierSansDevisJours);
      const lignes = await tx
        .select({ id: chantiers.id, nom: chantiers.nom, creeAt: chantiers.createdAt })
        .from(chantiers)
        .where(
          and(
            eq(chantiers.entrepriseId, ctx.entrepriseId),
            isNull(chantiers.deletedAt),
            isNull(chantiers.devisEnvoyeAt),
            // **Un chantier TERMINÉ ne réclame plus de devis.** Sans cette
            // ligne, un petit dépannage fait et clos sans devis rappellerait
            // pour toujours — et c'est justement le cas où le patron a raison
            // de ne pas en avoir fait.
            isNull(chantiers.termineAt),
            sql`${chantiers.createdAt} < ${seuil}`
          )
        )
        .orderBy(desc(chantiers.createdAt));

      for (const l of lignes) {
        sortie.push({
          genre: "chantier-sans-devis",
          chantierId: l.id,
          chantierNom: l.nom,
          depuis: l.creeAt,
        });
      }
    }

    if (reglages.devisSansReponseJours !== null) {
      const seuil = seuilAncienneté(maintenant, reglages.devisSansReponseJours);
      const lignes = await tx
        .select({
          chantierId: envoisDevis.chantierId,
          chantierNom: chantiers.nom,
          envoyeAt: envoisDevis.envoyeAt,
        })
        .from(envoisDevis)
        .innerJoin(chantiers, eq(envoisDevis.chantierId, chantiers.id))
        .where(
          and(
            eq(envoisDevis.entrepriseId, ctx.entrepriseId),
            isNull(envoisDevis.reponse),
            isNull(chantiers.deletedAt),
            lt(envoisDevis.envoyeAt, seuil),
            // **Un lien EXPIRÉ a déjà sa propre alerte** (`EnvoiCaduc`, sur
            // l'accueil). Le rappeler ici une seconde fois ferait deux cartes
            // pour un seul devis, et le patron chercherait la différence.
            gt(envoisDevis.expireAt, maintenant)
          )
        )
        .orderBy(desc(envoisDevis.envoyeAt));

      // **Un seul rappel par chantier.** Un devis renvoyé en deuxième version
      // laisse deux envois : deux cartes pour un même chantier se lisent comme
      // deux chantiers qui dorment.
      const vus = new Set<string>();
      for (const l of lignes) {
        if (vus.has(l.chantierId)) continue;
        vus.add(l.chantierId);
        sortie.push({
          genre: "devis-sans-reponse",
          chantierId: l.chantierId,
          chantierNom: l.chantierNom,
          depuis: l.envoyeAt,
        });
      }
    }

    if (reglages.chantierNonFactureJours !== null) {
      const seuil = seuilAncienneté(maintenant, reglages.chantierNonFactureJours);
      const lignes = await tx
        .select({ id: chantiers.id, nom: chantiers.nom, termineAt: chantiers.termineAt })
        .from(chantiers)
        .where(
          and(
            eq(chantiers.entrepriseId, ctx.entrepriseId),
            isNull(chantiers.deletedAt),
            isNotNull(chantiers.termineAt),
            isNull(chantiers.factureEnvoyeeAt),
            sql`${chantiers.termineAt} < ${seuil}`
          )
        )
        .orderBy(desc(chantiers.termineAt));

      for (const l of lignes) {
        sortie.push({
          genre: "chantier-non-facture",
          chantierId: l.id,
          chantierNom: l.nom,
          depuis: l.termineAt!,
        });
      }
    }

    // ── Le quatrième : une facture dont le règlement n'est pas arrivé ─────
    //
    // **« A plus B », sa réponse du 16 août 2026** : l'échéance quand elle
    // existe — le délai de paiement réglé dans « Devis & factures » — et le
    // jour de l'envoi sinon (`echeanceFacture`).
    if (reglages.factureImpayeeJours !== null) {
      const [reglage] = await tx
        .select({ delai: entreprises.delaiPaiementJours })
        .from(entreprises)
        .where(eq(entreprises.id, ctx.entrepriseId))
        .limit(1);
      const delai = reglage?.delai ?? null;

      const lignes = await tx
        .select({
          id: factures.id,
          numero: factures.numeroCommercial,
          chantierId: factures.chantierId,
          chantierNom: chantiers.nom,
          totalTtc: factures.totalTtc,
          envoyeeLe: chantiers.factureEnvoyeeAt,
          repousseeLe: chantiers.rappelFactureRepousseLe,
          // **La somme des règlements décide, jamais un état posé à la main.**
          // Une facture marquée « payée » sans règlement enregistré, ou
          // l'inverse, se contrediraient — et c'est le premier des trois
          // pièges de sa planche.
          recu: sql<string>`COALESCE((
            SELECT SUM(p.montant) FROM paiements_facture p WHERE p.facture_id = ${factures.id}
          ), 0)`,
        })
        .from(factures)
        .innerJoin(chantiers, eq(factures.chantierId, chantiers.id))
        .where(
          and(
            eq(factures.entrepriseId, ctx.entrepriseId),
            eq(factures.statut, "emise"),
            isNull(chantiers.deletedAt),
            isNotNull(chantiers.factureEnvoyeeAt)
          )
        );

      for (const l of lignes) {
        const totalCts = Math.round(Number(l.totalTtc) * 100);
        const resteDuCts = totalCts - Math.round(Number(l.recu) * 100);
        // Soldée : elle sort du rappel le jour même, sans geste.
        if (resteDuCts <= 0) continue;

        const echeance = echeanceFacture(l.envoyeeLe!, delai);
        const du = rappelFactureDu({
          maintenant,
          echeance,
          apresJours: reglages.factureImpayeeJours,
          rythmeJours: reglages.factureImpayeeRythmeJours,
          // Une date civile en base : on la lit comme un jour, pas un instant.
          repousseeLe: l.repousseeLe ? new Date(`${l.repousseeLe}T00:00:00Z`) : null,
        });
        if (!du) continue;

        sortie.push({
          genre: "facture-impayee",
          chantierId: l.chantierId,
          chantierNom: l.chantierNom,
          // Ce qui compte pour lui, c'est le retard : on compte depuis
          // l'échéance, pas depuis l'envoi.
          depuis: echeance,
          facture: { id: l.id, numero: l.numero, resteDuCts, totalCts },
        });
      }
    }

    // ── Ce qu'il a déjà acquitté d'un « J'ai vu » ────────────────────────
    //
    // **Lu APRÈS coup, en une requête, et non genre par genre.** Trois requêtes
    // rendraient la même table trois fois ; et filtrer dans chaque bloc
    // dupliquerait la règle en trois exemplaires qui finiraient par diverger.
    //
    // L'impayé n'est pas concerné : son silence à lui vit sur le chantier
    // (`rappelFactureRepousseLe`) et il est déjà appliqué plus haut.
    // **Aucun rappel acquittable en vue : pas de requête.** Une requête jouée
    // puis jetée finit par être lue comme la preuve que l'acquit fonctionne.
    const acquittables = sortie.some((r) => r.genre !== "facture-impayee");
    const acquittements = acquittables
      ? await tx
          .select({ genre: rappelsVus.genre, chantierId: rappelsVus.chantierId, vuLe: rappelsVus.vuLe })
          .from(rappelsVus)
          .where(eq(rappelsVus.entrepriseId, ctx.entrepriseId))
      : [];
    const vus = new Map(acquittements.map((a) => [`${a.genre}:${a.chantierId}`, a.vuLe]));

    const parlants = sortie.filter((r) => {
      if (r.genre === "facture-impayee") return true;
      const vuLe = vus.get(`${r.genre}:${r.chantierId}`) ?? null;
      // **Un devis RENVOYÉ après le « J'ai vu » n'est pas caché pour autant**, et
      // aucune ligne n'est nécessaire pour ça : le silence dure le délai du
      // rappel, et un envoi parti APRÈS l'acquittement met ce même délai à
      // devenir rappelable. Il arrive donc toujours après le réveil. Une garde
      // « situation née après l'acquittement » a été écrite ici puis retirée :
      // elle ne pouvait jamais devenir vraie, et un contrôle qu'on ne peut pas
      // voir rougir ne prouve rien (`CLAUDE.md` §5).
      return !rappelEncoreTu({
        maintenant,
        vuLe,
        silenceJours: silenceApresVuJours(r.genre as GenreAcquittable, reglages),
      });
    });

    // Le plus ancien EN PREMIER : c'est celui qui a le plus attendu, et celui
    // qu'on risque le plus d'oublier tout à fait.
    return parlants.sort((a, b) => a.depuis.getTime() - b.depuis.getTime());
  });
}


/**
 * « J'ai vu » sur un rappel — sa demande du 30 août 2026.
 *
 * *« Pour chaque notification je dois pouvoir cliquer sur vu pour les faire
 * disparaître ; pourquoi certaines n'ont pas cette fonction ? »*
 *
 * **Le dernier geste écrase le précédent** (`ON CONFLICT DO UPDATE`) : deux
 * lignes pour un même rappel donneraient deux dates de réveil, et la plus
 * ancienne le ferait revenir alors qu'il vient d'être acquitté.
 *
 * **`false` quand le chantier n'est pas à cette entreprise** — la RLS le rendrait
 * de toute façon invisible, mais l'écran doit pouvoir le DIRE plutôt que de
 * laisser la carte partir puis revenir sans explication.
 */
export async function marquerRappelVu(
  ctx: Ctx,
  genre: GenreAcquittable,
  chantierId: string,
  maintenant: Date = new Date()
): Promise<boolean> {
  return withEntreprise(ctx.utilisateurId, ctx.entrepriseId, async (tx) => {
    const [c] = await tx
      .select({ id: chantiers.id })
      .from(chantiers)
      .where(and(eq(chantiers.id, chantierId), eq(chantiers.entrepriseId, ctx.entrepriseId)))
      .limit(1);
    if (!c) return false;
    await tx
      .insert(rappelsVus)
      .values({ entrepriseId: ctx.entrepriseId, chantierId, genre, vuLe: maintenant })
      .onConflictDoUpdate({
        target: [rappelsVus.entrepriseId, rappelsVus.genre, rappelsVus.chantierId],
        set: { vuLe: maintenant },
      });
    return true;
  });
}

/**
 * « Plus tard » — repousser le rappel d'UNE facture.
 *
 * **C'est le seul moteur du rythme.** Tant qu'il n'a rien touché, la carte
 * reste : une carte qui s'endormirait toute seule pourrait passer un jour où il
 * n'ouvre pas l'application, et il ne saurait jamais qu'elle est passée (sa
 * planche du 16 août 2026, écran 5).
 *
 * `jour` est une date CIVILE, calculée au serveur : le téléphone peut être à
 * l'heure d'ailleurs, et « toutes les semaines » se compte en jours.
 */
export async function repousserRappelFacture(ctx: Ctx, factureId: string, jour: string): Promise<boolean> {
  return withEntreprise(ctx.utilisateurId, ctx.entrepriseId, async (tx) => {
    // **On écrit sur le CHANTIER, pas sur la facture.** Une facture émise est
    // immuable (`trg_facture_immuable`, migration 0018), et l'affaiblir pour
    // une commodité d'écran serait un contournement — ce que `CLAUDE.md` §4
    // interdit. La relation est de un à un : rien ne se perd.
    const [f] = await tx
      .select({ chantierId: factures.chantierId })
      .from(factures)
      .where(and(eq(factures.id, factureId), eq(factures.entrepriseId, ctx.entrepriseId)))
      .limit(1);
    if (!f) return false;
    const r = await tx
      .update(chantiers)
      .set({ rappelFactureRepousseLe: jour })
      .where(and(eq(chantiers.id, f.chantierId), eq(chantiers.entrepriseId, ctx.entrepriseId)));
    return r.rowCount === 1;
  });
}
