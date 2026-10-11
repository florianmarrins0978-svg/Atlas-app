// L'organigramme : ce qu'il lit, et les trois gestes du patron dessus.
//
// **Tout passe par `withEntreprise`** (`CLAUDE.md` §3). Aucune fonction d'ici
// ne vérifie le rôle : c'est l'action serveur qui l'exige (`exigerProprietaire`),
// comme pour le compteur des salariés.
//
// **Ce qu'il ne rend JAMAIS : une adresse, un accès, un mot de passe.** Tout le
// monde lit l'organigramme (sa règle du 27 septembre 2026) ; un salarié n'a pas
// à y trouver l'adresse du commercial.

import { and, asc, eq } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { withEntreprise } from "../db/with-entreprise";
import { entreprises, equipes, membresEntreprise, users } from "../db/schema";
import type { Ctx } from "./context";
import { assurerEquipeDeRang, nommerEquipe } from "./equipes";
import { nomAffiche } from "@/lib/identite-personne";
import { MAX_SALARIES } from "@/lib/equipes";
import {
  photoDUnCompte,
  peutEtreSousCeChef,
  type CompteOrganigramme,
  type SalarieOrganigramme,
} from "@/lib/organigramme";

// Le nom de salarié qu'un compte EST (`membres_entreprise.salarie_id`, 0111).
const salarieRelie = alias(equipes, "salarie_relie");

export type DonneesOrganigramme = {
  comptes: CompteOrganigramme[];
  salaries: SalarieOrganigramme[];
  nombreSalaries: number;
};

export async function lireOrganigramme(ctx: Ctx): Promise<DonneesOrganigramme> {
  return withEntreprise(ctx.utilisateurId, ctx.entrepriseId, async (tx) => {
    // Trois requêtes À LA SUITE : une transaction n'a qu'une connexion, et
    // `pg` refuse de plus en plus d'y mêler deux requêtes à la fois.
    const lignesComptes = await tx
      .select({
        membreId: membresEntreprise.id,
        utilisateurId: membresEntreprise.utilisateurId,
        prenom: users.prenom,
        nom: users.nom,
        role: membresEntreprise.role,
        relie: salarieRelie.id,
        photoDuNom: salarieRelie.photoStorageKey,
        photoDuCompte: membresEntreprise.photoStorageKey,
      })
      .from(membresEntreprise)
      .innerJoin(users, eq(users.id, membresEntreprise.utilisateurId))
      .leftJoin(
        salarieRelie,
        and(eq(salarieRelie.id, membresEntreprise.salarieId), eq(salarieRelie.entrepriseId, ctx.entrepriseId))
      )
      .where(eq(membresEntreprise.entrepriseId, ctx.entrepriseId))
      .orderBy(asc(membresEntreprise.createdAt));
    const salaries = await tx
      .select({
        id: equipes.id,
        rang: equipes.rang,
        nom: equipes.nom,
        estChef: equipes.estChef,
        chefId: equipes.chefId,
        photoStorageKey: equipes.photoStorageKey,
      })
      .from(equipes)
      .where(eq(equipes.entrepriseId, ctx.entrepriseId))
      .orderBy(asc(equipes.rang));
    const [entreprise] = await tx
      .select({ nombreSalaries: entreprises.nombreSalaries })
      .from(entreprises)
      .where(eq(entreprises.id, ctx.entrepriseId))
      .limit(1);
    return {
      // Le nom se compose par la fonction du dépôt, comme dans « Qui a accès » :
      // `users.nom` est le nom de famille depuis la migration 0077.
      comptes: lignesComptes.map(({ prenom, nom, relie, photoDuNom, photoDuCompte, ...reste }) => ({
        ...reste,
        nom: nomAffiche({ prenom, nom }) || nom,
        photo: photoDUnCompte({ relie: relie !== null, photoDuNom, photoDuCompte }),
      })),
      salaries,
      nombreSalaries: entreprise?.nombreSalaries ?? 0,
    };
  });
}

export type RefusOrganigramme = "hors-compteur" | "chef-invalide" | "plein" | "nom-vide";
export type ResultatOrganigramme = { ok: true } | { ok: false; refus: RefusOrganigramme };

/**
 * Donner ou retirer le titre de chef d'équipe.
 *
 * **Retirer le titre libère ses gars** (ils passent « Sans chef ») : laisser
 * leur `chef_id` pointer vers quelqu'un qui n'est plus chef les rangerait sous
 * lui le jour où il le redevient, sans que personne l'ait redemandé.
 */
export async function nommerChef(ctx: Ctx, rang: number, estChef: boolean): Promise<ResultatOrganigramme> {
  const { nombreSalaries } = await lireOrganigramme(ctx);
  if (!Number.isInteger(rang) || rang < 1 || rang > nombreSalaries) return { ok: false, refus: "hors-compteur" };
  const id = await assurerEquipeDeRang(ctx, rang);
  await withEntreprise(ctx.utilisateurId, ctx.entrepriseId, async (tx) => {
    // Un chef n'a pas de chef : le terrain n'a qu'un étage.
    await tx
      .update(equipes)
      .set({ estChef, chefId: null, updatedAt: new Date() })
      .where(and(eq(equipes.entrepriseId, ctx.entrepriseId), eq(equipes.id, id)));
    if (!estChef) {
      await tx
        .update(equipes)
        .set({ chefId: null, updatedAt: new Date() })
        .where(and(eq(equipes.entrepriseId, ctx.entrepriseId), eq(equipes.chefId, id)));
    }
  });
  return { ok: true };
}

/**
 * Ranger un gars sous un chef, ou le retirer de dessous (`chefRang` null).
 * Un seul chef : écrire le nouveau remplace l'ancien.
 */
export async function rangerSousChef(
  ctx: Ctx,
  garsRang: number,
  chefRang: number | null
): Promise<ResultatOrganigramme> {
  const { salaries, nombreSalaries } = await lireOrganigramme(ctx);
  if (!Number.isInteger(garsRang) || garsRang < 1 || garsRang > nombreSalaries) {
    return { ok: false, refus: "hors-compteur" };
  }
  let chefId: string | null = null;
  if (chefRang !== null) {
    if (!peutEtreSousCeChef(garsRang, chefRang, salaries, nombreSalaries)) return { ok: false, refus: "chef-invalide" };
    chefId = salaries.find((s) => s.rang === chefRang)!.id;
  }
  const garsId = await assurerEquipeDeRang(ctx, garsRang);
  await withEntreprise(ctx.utilisateurId, ctx.entrepriseId, (tx) =>
    tx
      .update(equipes)
      .set({ chefId, updatedAt: new Date() })
      .where(and(eq(equipes.entrepriseId, ctx.entrepriseId), eq(equipes.id, garsId)))
  );
  return { ok: true };
}

/**
 * Ajouter un gars de terrain : le compteur monte d'un, et la ligne prend son
 * nom — le même geste que le + de « Combien de salariés ? », sans seconde liste.
 *
 * **La ligne du nouveau rang repart à zéro sur le titre et le chef** : un rang
 * redescendu puis remonté garde son nom (`equipes` le veut), mais le titre d'un
 * ancien ne passe pas au nouveau venu.
 */
export async function ajouterSalarie(ctx: Ctx, nom: string, chefRang: number | null): Promise<ResultatOrganigramme> {
  const propre = nom.trim();
  if (!propre) return { ok: false, refus: "nom-vide" };
  const { salaries, nombreSalaries } = await lireOrganigramme(ctx);
  if (nombreSalaries >= MAX_SALARIES) return { ok: false, refus: "plein" };
  const rang = nombreSalaries + 1;
  if (chefRang !== null && !peutEtreSousCeChef(rang, chefRang, salaries, rang)) {
    return { ok: false, refus: "chef-invalide" };
  }
  const chefId = chefRang === null ? null : salaries.find((s) => s.rang === chefRang)!.id;

  const ligne = await nommerEquipe(ctx, rang, propre);
  await withEntreprise(ctx.utilisateurId, ctx.entrepriseId, async (tx) => {
    await tx
      .update(equipes)
      .set({ estChef: false, chefId, updatedAt: new Date() })
      .where(and(eq(equipes.entrepriseId, ctx.entrepriseId), eq(equipes.id, ligne.id)));
    // Plus personne n'avait ce rang pour chef : un ancien de ce rang ne garde
    // pas de gars sous lui.
    await tx
      .update(equipes)
      .set({ chefId: null, updatedAt: new Date() })
      .where(and(eq(equipes.entrepriseId, ctx.entrepriseId), eq(equipes.chefId, ligne.id)));
    await tx
      .update(entreprises)
      .set({ nombreSalaries: rang, updatedAt: new Date() })
      .where(eq(entreprises.id, ctx.entrepriseId));
  });
  return { ok: true };
}
