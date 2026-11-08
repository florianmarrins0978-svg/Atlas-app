/**
 * MON ANNÉE : ce que la base dit de l'année, pour l'écran de Réglages et la
 * ligne de Terminés. Sa planche du 8 novembre 2026
 * (`appli/soignee/mon-annee.html`). Les comptes eux-mêmes vivent dans
 * `src/lib/mon-annee.ts` : ce fichier lit, il ne décide de rien.
 *
 * **Le chiffre d'affaires, c'est celui du plafond de la franchise**
 * (`franchise-plafond.ts`) : les factures ÉMISES, en HT, à leur date
 * d'émission, moins les avoirs à la leur. Un brouillon n'est parti chez
 * personne.
 *
 * **Les factures IMPORTÉES comptent par leur HT** (`htDeLaPieceImportee`) :
 * celui que l'import lit depuis la migration 0176, et que `chercherLesHt`
 * cherche une fois sur les plus anciennes. Assujetti et sans HT lu, une pièce
 * reste dehors : rien ne se déduit du TTC.
 */
import { and, desc, eq, gte, inArray, isNull, lte } from "drizzle-orm";
import { estEnAlsaceMoselle } from "@/lib/jours-feries";
import { jourIso } from "@/lib/jour";
import { centimesDe } from "@/lib/franchise-plafond";
import { aFacturerPartout, preparer } from "@/lib/termines-par-mois";
import { enDecimal, htDeLaPieceImportee, type MouvementPourBenefice, type Piece } from "@/lib/mon-annee";
import { withEntreprise } from "../db/with-entreprise";
import {
  avoirs,
  chantiers,
  devis,
  entreprises,
  envoisDevis,
  factures,
  liaisonsBancaires,
  mouvementsBancaires,
  objectifsAnnee,
  piecesImportees,
} from "../db/schema";
import { listerChantiersTermines } from "./factures";
import type { Ctx } from "./context";

export type Attente = { nombre: number; centimes: number };

export type DonneesMonAnnee = {
  aujourdHui: string;
  annee: number;
  objectif: { chiffreAffaires: number; benefice: number | null } | null;
  surTermines: boolean;
  alsaceMoselle: boolean;
  /** Les pièces de cette année ET de l'an dernier. */
  pieces: Piece[];
  /** `false` : la banque n'est pas reliée, et le bénéfice ne se compte pas. */
  banqueReliee: boolean;
  mouvements: MouvementPourBenefice[];
  peutRentrer: { aFacturer: Attente; signes: Attente; sansReponse: Attente };
};

/** Un montant en centimes, ou rien : un montant illisible ne vaut pas zéro. */
function centimes(montant: string | null): number | null {
  return montant === null ? null : centimesDe(montant);
}

type Tx = Parameters<Parameters<typeof withEntreprise>[2]>[0];

/** L'année et ses bornes, lues à Paris (`jourIso`), comme le plafond de la franchise. */
function lAnnee(maintenant: Date) {
  const aujourdHui = jourIso(maintenant);
  const annee = Number(aujourdHui.slice(0, 4));
  return { aujourdHui, annee, du: `${annee - 1}-01-01`, au: `${annee}-12-31` };
}

/** Les réglages de l'entreprise que Mon année lit. */
async function lEntreprise(tx: Tx, entrepriseId: string) {
  const [e] = await tx
    .select({ adresse: entreprises.adresse, regimeTva: entreprises.regimeTva, surTermines: entreprises.monAnneeSurTermines })
    .from(entreprises)
    .where(eq(entreprises.id, entrepriseId))
    .limit(1);
  return { regimeTva: e?.regimeTva ?? "assujettie", surTermines: e?.surTermines ?? false, alsaceMoselle: estEnAlsaceMoselle(e?.adresse) };
}

async function lObjectif(tx: Tx, entrepriseId: string, annee: number): Promise<DonneesMonAnnee["objectif"]> {
  const [o] = await tx
    .select({ ca: objectifsAnnee.chiffreAffairesHt, benefice: objectifsAnnee.benefice })
    .from(objectifsAnnee)
    .where(and(eq(objectifsAnnee.entrepriseId, entrepriseId), eq(objectifsAnnee.annee, annee)))
    .limit(1);
  return o ? { chiffreAffaires: centimesDe(o.ca), benefice: centimes(o.benefice) } : null;
}

/** Les factures émises, les avoirs et les factures importées, en HT, entre deux jours. */
async function lesPieces(tx: Tx, regimeTva: "assujettie" | "franchise", du: string, au: string): Promise<Piece[]> {
  const emises = await tx
    .select({ jour: factures.dateEmission, ht: factures.totalHt })
    .from(factures)
    .where(and(eq(factures.statut, "emise"), gte(factures.dateEmission, du), lte(factures.dateEmission, au)));
  const deduits = await tx
    .select({ jour: avoirs.dateEmission, ht: avoirs.totalHt })
    .from(avoirs)
    .where(and(gte(avoirs.dateEmission, du), lte(avoirs.dateEmission, au)));
  const importees = await tx
    .select({ jour: piecesImportees.jour, ht: piecesImportees.montantHt, ttc: piecesImportees.montantTtc })
    .from(piecesImportees)
    .where(and(eq(piecesImportees.genre, "facture"), gte(piecesImportees.jour, du), lte(piecesImportees.jour, au)));
  return [
    ...emises.map((f) => ({ jour: f.jour, centimes: centimesDe(f.ht) })),
    ...deduits.map((a) => ({ jour: a.jour, centimes: -centimesDe(a.ht) })),
    ...importees.flatMap((p) => {
      const ht = htDeLaPieceImportee(p.ht, p.ttc, regimeTva);
      return p.jour && ht ? [{ jour: p.jour, centimes: centimesDe(ht) }] : [];
    }),
  ];
}

export async function donneesMonAnnee(ctx: Ctx, maintenant: Date = new Date()): Promise<DonneesMonAnnee> {
  const { aujourdHui, annee, du, au } = lAnnee(maintenant);

  // **« À facturer », c'est celui de Terminés, et lui seul** : la même lecture,
  // la même règle (`aFacturerPartout`). Deux définitions auraient donné deux
  // comptes à deux écrans d'intervalle.
  const aFacturerIds = aFacturerPartout(preparer(await listerChantiersTermines(ctx, aujourdHui))).map((l) => l.id);

  return withEntreprise(ctx.utilisateurId, ctx.entrepriseId, async (tx) => {
    const e = await lEntreprise(tx, ctx.entrepriseId);
    const objectif = await lObjectif(tx, ctx.entrepriseId, annee);
    const pieces = await lesPieces(tx, e.regimeTva, du, au);

    const [liaison] = await tx.select({ id: liaisonsBancaires.id }).from(liaisonsBancaires).limit(1);
    const mouvements = liaison
      ? (
          await tx
            .select({
              jour: mouvementsBancaires.jour,
              montant: mouvementsBancaires.montant,
              sens: mouvementsBancaires.sens,
              motif: mouvementsBancaires.motif,
              justification: mouvementsBancaires.justification,
            })
            .from(mouvementsBancaires)
            .where(and(gte(mouvementsBancaires.jour, `${annee}-01-01`), lte(mouvementsBancaires.jour, au)))
        ).map((m) => ({ jour: m.jour, centimes: centimesDe(m.montant), sens: m.sens, motif: m.motif, justification: m.justification }))
      : [];

    // ─── Ce qui peut encore rentrer ─────────────────────────────────────────
    //
    // Chaque chantier compte UNE fois : son dernier envoi de devis décide s'il
    // est signé ou sans réponse, et un chantier déjà « à facturer » n'est ni
    // l'un ni l'autre. Un montant inconnu ne compte pas pour zéro : le
    // chantier est compté, son montant non.

    // À facturer : la facture préparée si elle existe, sinon le dernier devis envoyé.
    let aFacturer: Attente = { nombre: aFacturerIds.length, centimes: 0 };
    if (aFacturerIds.length > 0) {
      const brouillons = await tx
        .select({ chantierId: factures.chantierId, ht: factures.totalHt })
        .from(factures)
        .where(and(inArray(factures.chantierId, aFacturerIds), eq(factures.statut, "brouillon")));
      const derniersDevis = await tx
        .selectDistinctOn([devis.chantierId], { chantierId: devis.chantierId, ht: devis.totalHt })
        .from(devis)
        .where(and(inArray(devis.chantierId, aFacturerIds), eq(devis.statut, "envoye")))
        .orderBy(devis.chantierId, desc(devis.numeroVersion));
      const parChantier = new Map<string, number>();
      for (const d of derniersDevis) parChantier.set(d.chantierId, centimesDe(d.ht));
      for (const b of brouillons) parChantier.set(b.chantierId, centimesDe(b.ht));
      aFacturer = { nombre: aFacturerIds.length, centimes: [...parChantier.values()].reduce((t, c) => t + c, 0) };
    }

    const envois = await tx
      .selectDistinctOn([envoisDevis.chantierId], {
        chantierId: envoisDevis.chantierId,
        reponse: envoisDevis.reponse,
        expireAt: envoisDevis.expireAt,
        envoyeAt: envoisDevis.envoyeAt,
        retireAt: chantiers.retireDeLaListeAt,
        ht: devis.totalHt,
      })
      .from(envoisDevis)
      .innerJoin(chantiers, eq(envoisDevis.chantierId, chantiers.id))
      .innerJoin(devis, eq(envoisDevis.devisId, devis.id))
      // Un chantier déjà facturé n'a plus rien à faire rentrer de son devis.
      .where(and(isNull(chantiers.deletedAt), isNull(chantiers.factureEnvoyeeAt)))
      .orderBy(envoisDevis.chantierId, desc(envoisDevis.envoyeAt));
    const dejaAFacturer = new Set(aFacturerIds);
    const signes: Attente = { nombre: 0, centimes: 0 };
    const sansReponse: Attente = { nombre: 0, centimes: 0 };
    for (const v of envois) {
      if (dejaAFacturer.has(v.chantierId)) continue;
      const montant = centimes(v.ht) ?? 0;
      if (v.reponse === "acceptee") {
        signes.nombre++;
        signes.centimes += montant;
      } else if (
        v.reponse === null &&
        v.expireAt > maintenant &&
        // Glissé hors de la liste, il ne revient pas : la frontière de
        // `retireDeLaListe`, celle des rappels.
        (v.retireAt === null || v.envoyeAt > v.retireAt)
      ) {
        sansReponse.nombre++;
        sansReponse.centimes += montant;
      }
    }

    return {
      aujourdHui,
      annee,
      objectif,
      surTermines: e.surTermines,
      alsaceMoselle: e.alsaceMoselle,
      pieces,
      banqueReliee: Boolean(liaison),
      mouvements,
      peutRentrer: { aFacturer, signes, sansReponse },
    };
  });
}

export type PorteMonAnnee = {
  aujourdHui: string;
  objectif: DonneesMonAnnee["objectif"];
  pieces: Piece[];
  alsaceMoselle: boolean;
};

/**
 * Ce que la ligne de Terminés a besoin de savoir, et rien d'autre. `null`
 * tant qu'il ne l'a pas allumée : sa règle, *« il ne faut pas que ça
 * s'affiche de base »*. Ni les devis ni la banque ne se lisent pour elle.
 */
export async function porteMonAnnee(ctx: Ctx, maintenant: Date = new Date()): Promise<PorteMonAnnee | null> {
  const { aujourdHui, annee, du, au } = lAnnee(maintenant);
  return withEntreprise(ctx.utilisateurId, ctx.entrepriseId, async (tx) => {
    const e = await lEntreprise(tx, ctx.entrepriseId);
    if (!e.surTermines) return null;
    return {
      aujourdHui,
      objectif: await lObjectif(tx, ctx.entrepriseId, annee),
      pieces: await lesPieces(tx, e.regimeTva, du, au),
      alsaceMoselle: e.alsaceMoselle,
    };
  });
}

export async function ecrireObjectif(ctx: Ctx, annee: number, chiffreAffaires: number, benefice: number | null): Promise<void> {
  await withEntreprise(ctx.utilisateurId, ctx.entrepriseId, async (tx) => {
    const valeurs = {
      chiffreAffairesHt: enDecimal(chiffreAffaires),
      benefice: benefice === null ? null : enDecimal(benefice),
      updatedAt: new Date(),
    };
    await tx
      .insert(objectifsAnnee)
      .values({ entrepriseId: ctx.entrepriseId, annee, ...valeurs })
      .onConflictDoUpdate({ target: [objectifsAnnee.entrepriseId, objectifsAnnee.annee], set: valeurs });
  });
}

export async function ecrireSurTermines(ctx: Ctx, oui: boolean): Promise<void> {
  await withEntreprise(ctx.utilisateurId, ctx.entrepriseId, async (tx) => {
    await tx.update(entreprises).set({ monAnneeSurTermines: oui }).where(eq(entreprises.id, ctx.entrepriseId));
  });
}
