/**
 * LES SERVICES À LA PERSONNE : ce que la base porte (migration 0178).
 *
 * Les réglages de Mon entreprise, leur logo, le compte de l'activité à côté,
 * ce que le papier imprime, et le numéro de chaque intervenant. Les règles
 * vivent dans `src/lib/services-a-la-personne.ts` ; ce dépôt lit, écrit, et
 * appelle les mêmes fonctions que l'écran.
 *
 * **Tout passe par `withEntreprise`** (`CLAUDE.md` §3), ou par la transaction
 * de l'appelant quand le papier se compose au milieu d'une autre écriture.
 */
import { and, asc, eq, gte, isNotNull, isNull, lt, sql } from "drizzle-orm";
import {
  compterLActiviteACote,
  mentionSurLePapier,
  type CompteDeLActiviteACote,
  type ReglagesServicesALaPersonne,
} from "@/lib/services-a-la-personne";
import type { CiviliteChoisie } from "@/lib/civilite";
import { MAX_SALARIES } from "@/lib/equipes";
import { jourIso } from "@/lib/jour";
import { LectureSeuleError, withEntreprise } from "../db/with-entreprise";
import type { DbOrTx } from "../db/client";
import { avoirs, entreprises, equipes, factures } from "../db/schema";
import type { ServicesALaPersonneDocument } from "../pdf/document-commun";
import { logoLu } from "./entreprises";
import type { Ctx } from "./context";

// ─── Mon entreprise ──────────────────────────────────────────────────────────

/**
 * Écrit les réglages DÉJÀ relus par `saisieServicesALaPersonneLue` : l'action
 * appelle la règle, ce dépôt n'en écrit pas une seconde. Un champ absent
 * n'est pas touché.
 */
export async function reglerServicesALaPersonne(
  ctx: Ctx,
  valeurs: Partial<ReglagesServicesALaPersonne>
): Promise<void> {
  const colonnes: Partial<typeof entreprises.$inferInsert> = {};
  if (valeurs.declaree !== undefined) colonnes.sapDeclaree = valeurs.declaree;
  if (valeurs.numero !== undefined) colonnes.sapNumero = valeurs.numero;
  if (valeurs.declareeLe !== undefined) colonnes.sapDeclareeLe = valeurs.declareeLe;
  if (valeurs.activiteACote !== undefined) colonnes.sapActiviteACote = valeurs.activiteACote;
  if (Object.keys(colonnes).length === 0) return;
  await withEntreprise(ctx.utilisateurId, ctx.entrepriseId, async (tx) => {
    await tx
      .update(entreprises)
      .set({ ...colonnes, updatedAt: new Date() })
      .where(eq(entreprises.id, ctx.entrepriseId));
  });
}

/**
 * Pose, ou retire, le logo des services à la personne. **Rend la clé d'avant**,
 * pour que l'appelant efface l'ancien fichier une fois la nouvelle écrite :
 * l'inverse laisserait, si l'écriture tombe, une entreprise qui pointe vers
 * une image disparue (le même ordre que son logo, `reglages/documents/actions.ts`).
 *
 * L'ancien fichier peut partir, à l'inverse de l'attestation décennale : aucune
 * pièce ne cite cette clé, et une pièce partie garde son PDF archivé.
 */
export async function poserLogoServicesALaPersonne(
  ctx: Ctx,
  logo: { cle: string; mime: string } | null
): Promise<{ avant: string | null }> {
  return withEntreprise(ctx.utilisateurId, ctx.entrepriseId, async (tx) => {
    const [e] = await tx
      .select({ cle: entreprises.sapLogoCle })
      .from(entreprises)
      .where(eq(entreprises.id, ctx.entrepriseId))
      .limit(1);
    await tx
      .update(entreprises)
      .set({ sapLogoCle: logo?.cle ?? null, sapLogoMime: logo?.mime ?? null, updatedAt: new Date() })
      .where(eq(entreprises.id, ctx.entrepriseId));
    return { avant: e?.cle ?? null };
  });
}

// ─── L'activité à côté ───────────────────────────────────────────────────────

/**
 * Le compte de l'année civile en cours : le HT des factures ARRÊTÉES, avec et
 * sans la case, moins leurs avoirs, chacun du côté de sa facture. Un brouillon
 * ne compte pas, il n'est parti chez personne : la règle du plafond de la
 * franchise (`franchise-plafond.ts`).
 */
export async function compteDeLActiviteACote(
  ctx: Ctx,
  maintenant: Date = new Date()
): Promise<CompteDeLActiviteACote> {
  // L'année se lit à Paris (`jourIso`), comme pour la franchise.
  const annee = Number(jourIso(maintenant).slice(0, 4));
  const du = `${annee}-01-01`;
  const au = `${annee + 1}-01-01`;
  return withEntreprise(ctx.utilisateurId, ctx.entrepriseId, async (tx) => {
    const [f] = await tx
      .select({
        toutes: sql<string | null>`(sum(${factures.totalHt}))::text`,
        horsSap: sql<string | null>`(sum(${factures.totalHt}) filter (where not ${factures.servicesALaPersonne}))::text`,
      })
      .from(factures)
      .where(
        and(
          eq(factures.entrepriseId, ctx.entrepriseId),
          eq(factures.statut, "emise"),
          gte(factures.dateEmission, du),
          lt(factures.dateEmission, au)
        )
      );
    const [a] = await tx
      .select({
        tous: sql<string | null>`(sum(${avoirs.totalHt}))::text`,
        horsSap: sql<string | null>`(sum(${avoirs.totalHt}) filter (where not ${factures.servicesALaPersonne}))::text`,
      })
      .from(avoirs)
      .innerJoin(factures, eq(factures.id, avoirs.factureId))
      .where(and(eq(avoirs.entrepriseId, ctx.entrepriseId), gte(avoirs.dateEmission, du), lt(avoirs.dateEmission, au)));
    return compterLActiviteACote({
      annee,
      factures: { toutes: f?.toutes ?? "0", horsSap: f?.horsSap ?? "0" },
      avoirs: { tous: a?.tous ?? "0", horsSap: a?.horsSap ?? "0" },
    });
  });
}

// ─── Le papier ───────────────────────────────────────────────────────────────

/** Ce qu'une pièce dit de sa case et de son client : la ligne du devis ou de la facture. */
export type CaseDuDocument = {
  servicesALaPersonne?: boolean | null;
  clientNom?: string | null;
  clientCivilite?: CiviliteChoisie;
};

/**
 * Le logo et la mention qu'une pièce imprime, ou `null`.
 *
 * **La case est sur la pièce, la déclaration sur l'entreprise, lue à cet
 * instant** : une entreprise qui n'est plus déclarée n'imprime plus de numéro,
 * même sur un brouillon coché avant. Une pièce partie ne se recompose pas :
 * son PDF archivé garde ce qu'il portait (`emettreFacture`, `envoyerDevis`).
 * Le seul papier recomposé d'une pièce partie, l'exemplaire acquitté, relit
 * donc la déclaration du jour, comme il relit déjà le logo (`TODO.md`).
 */
export async function papierServicesALaPersonne(
  tx: DbOrTx,
  entrepriseId: string,
  doc: CaseDuDocument
): Promise<ServicesALaPersonneDocument | null> {
  if (!doc.servicesALaPersonne) return null;
  const [e] = await tx
    .select({
      declaree: entreprises.sapDeclaree,
      numero: entreprises.sapNumero,
      declareeLe: entreprises.sapDeclareeLe,
      logoCle: entreprises.sapLogoCle,
      logoMime: entreprises.sapLogoMime,
    })
    .from(entreprises)
    .where(eq(entreprises.id, entrepriseId))
    .limit(1);
  if (!e) return null;
  const mention = mentionSurLePapier({
    coche: true,
    declaree: e.declaree,
    numero: e.numero,
    declareeLe: e.declareeLe,
    clientNom: doc.clientNom,
    clientCivilite: doc.clientCivilite,
  });
  if (!mention) return null;
  return { mention, logo: await logoLu(e.logoCle, e.logoMime, "Logo des services à la personne") };
}

// ─── Le numéro de chaque intervenant ─────────────────────────────────────────

/**
 * Les numéros d'intervenant de l'équipe, par rang, ou `null` quand
 * l'entreprise n'est pas déclarée (Équipe ne les montre pas).
 *
 * **C'est la « première lecture » du lot 1.** Un salarié créé depuis la
 * migration 0178 a déjà le sien (`trg_numero_intervenant`). Ceux d'avant, et
 * ceux qu'annonce le compteur sans ligne en base, le reçoivent ici, dans
 * l'ordre des rangs, par la même fonction SQL que le déclencheur : il n'y a
 * qu'une façon de tirer un numéro. Un salarié au-delà du compteur n'en reçoit
 * pas : il ne travaille plus là, et s'il revient il le recevra alors.
 *
 * **En lecture seule** (essai terminé, compte fermé), rien ne s'écrit : les
 * numéros déjà donnés se lisent, les autres attendent.
 */
export async function numerosDesIntervenants(ctx: Ctx): Promise<Record<number, number> | null> {
  try {
    return await withEntreprise(ctx.utilisateurId, ctx.entrepriseId, (tx) =>
      lireLesNumeros(tx, ctx.entrepriseId, true)
    );
  } catch (erreur) {
    if (!(erreur instanceof LectureSeuleError)) throw erreur;
    return withEntreprise(ctx.utilisateurId, ctx.entrepriseId, (tx) => lireLesNumeros(tx, ctx.entrepriseId, false));
  }
}

async function lireLesNumeros(
  tx: DbOrTx,
  entrepriseId: string,
  numeroter: boolean
): Promise<Record<number, number> | null> {
  const [e] = await tx
    .select({ declaree: entreprises.sapDeclaree, nombreSalaries: entreprises.nombreSalaries })
    .from(entreprises)
    .where(eq(entreprises.id, entrepriseId))
    .limit(1);
  if (!e?.declaree) return null;

  if (numeroter) {
    const lignes = await tx
      .select({ rang: equipes.rang, numero: equipes.numeroIntervenant })
      .from(equipes)
      .where(eq(equipes.entrepriseId, entrepriseId));
    const parRang = new Map(lignes.map((l) => [l.rang, l.numero]));
    const jusqua = Math.min(MAX_SALARIES, Math.max(0, e.nombreSalaries));
    for (let rang = 1; rang <= jusqua; rang++) {
      if (!parRang.has(rang)) {
        // Une ligne sans nom : le salarié existe au compteur, et son numéro doit
        // tenir d'une attestation à l'autre. Le déclencheur le lui donne. Deux
        // lectures en même temps : la seconde trouve la ligne de la première,
        // et le numéro qu'elle a tiré pour rien reste un trou, jamais un doublon.
        await tx.insert(equipes).values({ entrepriseId, rang }).onConflictDoNothing();
      } else if (parRang.get(rang) === null) {
        await tx
          .update(equipes)
          .set({ numeroIntervenant: sql`tirer_numero_intervenant(${entrepriseId}::uuid)`, updatedAt: new Date() })
          .where(and(eq(equipes.entrepriseId, entrepriseId), eq(equipes.rang, rang), isNull(equipes.numeroIntervenant)));
      }
    }
  }

  const numerotes = await tx
    .select({ rang: equipes.rang, numero: equipes.numeroIntervenant })
    .from(equipes)
    .where(and(eq(equipes.entrepriseId, entrepriseId), isNotNull(equipes.numeroIntervenant)))
    .orderBy(asc(equipes.rang));
  return Object.fromEntries(numerotes.map((l) => [l.rang, l.numero as number]));
}
