import { and, desc, eq, isNull, isNotNull, lt, gt, sql } from "drizzle-orm";
import { withEntreprise } from "../db/with-entreprise";
import { chantiers, entreprises, envoisDevis } from "../db/schema";
import { lireRappels, normaliserRappels, seuilAncienneté, type ReglagesRappels } from "../../lib/rappels";
import type { Ctx } from "./context";

/**
 * Les deux rappels : leur réglage, et ce qu'ils rappellent.
 *
 * **Tout passe par `withEntreprise`** — ici les données appartiennent bien à une
 * entreprise, contrairement au compte de la personne (`compte.ts`). Une requête
 * hors de ce cadre ne renverrait rien, silencieusement.
 */

export async function lireReglagesRappels(ctx: Ctx): Promise<ReglagesRappels> {
  return withEntreprise(ctx.utilisateurId, ctx.entrepriseId, async (tx) => {
    const [ligne] = await tx
      .select({
        devisSansReponseJours: entreprises.rappelDevisSansReponseJours,
        chantierNonFactureJours: entreprises.rappelChantierNonFactureJours,
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
        rappelDevisSansReponseJours: propre.devisSansReponseJours,
        rappelChantierNonFactureJours: propre.chantierNonFactureJours,
      })
      .where(eq(entreprises.id, ctx.entrepriseId));
    return propre;
  });
}

export type Rappel = {
  genre: "devis-sans-reponse" | "chantier-non-facture";
  chantierId: string;
  chantierNom: string;
  /** Depuis quand la situation dure — jamais un nombre de jours pré-calculé,
   *  pour que l'écran le formule dans sa langue. */
  depuis: Date;
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
  if (reglages.devisSansReponseJours === null && reglages.chantierNonFactureJours === null) return [];

  return withEntreprise(ctx.utilisateurId, ctx.entrepriseId, async (tx) => {
    const sortie: Rappel[] = [];

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

    // Le plus ancien EN PREMIER : c'est celui qui a le plus attendu, et celui
    // qu'on risque le plus d'oublier tout à fait.
    return sortie.sort((a, b) => a.depuis.getTime() - b.depuis.getTime());
  });
}
