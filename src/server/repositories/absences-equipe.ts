// Les jours où une équipe n'est pas là.
//
// *Le patron, le 14 août 2026 : « une équipe qui doit partir en déplacement
// pour cinq jours ».* Retenu sur maquette (`docs/maquettes/55`, proposition A).
//
// **Tout passe par `withEntreprise`** (`CLAUDE.md` §3) : une requête hors de ce
// cadre ne renvoie rien, *silencieusement*. Aucune fonction d'ici n'appelle
// `db` en direct.
//
// **Ce dépôt ne décide rien.** Il ne juge pas si une absence est valide — cette
// règle est pure et vit dans `src/lib/absences-equipe.ts`, parce que l'écran
// s'en sert aussi pour éteindre son bouton. Deux implémentations d'une même
// règle finissent toujours par diverger.

import { and, asc, eq, gte, isNull, lte } from "drizzle-orm";
import { withEntreprise } from "../db/with-entreprise";
import { absencesEquipe, equipes } from "../db/schema";
import type { Ctx } from "./context";
import type { JourIso } from "../disponibilites";

export type AbsenceEnregistree = {
  id: string;
  equipeId: string;
  /** Le rang de l'équipe — c'est lui que l'écran affiche, jamais l'identifiant. */
  rang: number;
  nom: string | null;
  premierJour: JourIso;
  dernierJour: JourIso;
  motif: string | null;
};

/**
 * Les absences de l'entreprise, la plus proche d'abord.
 *
 * **Seulement celles qui ne sont pas finies**, quand `depuis` est donné : une
 * liste qui accumulerait deux ans de déplacements passés deviendrait
 * illisible, et le patron ne la relirait plus. L'historique n'est pas perdu
 * pour autant — les lignes restent en base.
 */
export async function listerAbsencesEquipe(
  ctx: Ctx,
  depuis?: JourIso
): Promise<AbsenceEnregistree[]> {
  return withEntreprise(ctx.utilisateurId, ctx.entrepriseId, async (tx) => {
    return tx
      .select({
        id: absencesEquipe.id,
        equipeId: absencesEquipe.equipeId,
        rang: equipes.rang,
        nom: equipes.nom,
        premierJour: absencesEquipe.premierJour,
        dernierJour: absencesEquipe.dernierJour,
        motif: absencesEquipe.motif,
      })
      .from(absencesEquipe)
      .innerJoin(equipes, eq(absencesEquipe.equipeId, equipes.id))
      .where(
        and(
          eq(absencesEquipe.entrepriseId, ctx.entrepriseId),
          isNull(absencesEquipe.deletedAt),
          ...(depuis ? [gte(absencesEquipe.dernierJour, depuis)] : [])
        )
      )
      .orderBy(asc(absencesEquipe.premierJour), asc(equipes.rang));
  });
}

/**
 * Les absences qui croisent une fenêtre, pour le calcul de la capacité.
 *
 * Volontairement plus maigre que `listerAbsencesEquipe` : le calcul n'a besoin
 * ni du nom, ni du motif, et une jointure de moins sur un chemin traversé à
 * chaque affichage du planning n'est pas rien.
 */
export async function absencesSurLaFenetre(
  ctx: Ctx,
  debut: JourIso,
  fin: JourIso
): Promise<{ equipeId: string; premierJour: JourIso; dernierJour: JourIso }[]> {
  return withEntreprise(ctx.utilisateurId, ctx.entrepriseId, async (tx) => {
    return tx
      .select({
        equipeId: absencesEquipe.equipeId,
        premierJour: absencesEquipe.premierJour,
        dernierJour: absencesEquipe.dernierJour,
      })
      .from(absencesEquipe)
      .where(
        and(
          eq(absencesEquipe.entrepriseId, ctx.entrepriseId),
          isNull(absencesEquipe.deletedAt),
          // Croisement, pas inclusion : une absence commencée avant la fenêtre
          // et finie dedans compte tout autant.
          lte(absencesEquipe.premierJour, fin),
          gte(absencesEquipe.dernierJour, debut)
        )
      );
  });
}

/**
 * Noter une absence, l'équipe étant désignée par son RANG.
 *
 * Par le rang, comme `nommerEquipe` : l'écran montre des lignes qui n'existent
 * pas encore en base — le patron peut noter l'absence de la troisième équipe
 * sans l'avoir jamais nommée. La ligne d'équipe est donc créée au besoin,
 * plutôt que d'exiger vingt lignes vides d'avance.
 *
 * **Rend `null` plutôt que de lever** quand le rang dépasse le nombre
 * d'équipes : c'est un refus attendu, et le message d'une exception levée par
 * une action serveur n'atteint jamais l'écran du patron (`AGENTS.md`).
 */
export async function noterAbsenceEquipe(
  ctx: Ctx,
  entree: { rang: number; premierJour: JourIso; dernierJour: JourIso; motif: string | null }
): Promise<AbsenceEnregistree | null> {
  const rang = Math.trunc(entree.rang);
  if (!Number.isInteger(rang) || rang < 1) return null;

  return withEntreprise(ctx.utilisateurId, ctx.entrepriseId, async (tx) => {
    const [equipe] = await tx
      .select({ id: equipes.id, rang: equipes.rang, nom: equipes.nom })
      .from(equipes)
      .where(and(eq(equipes.entrepriseId, ctx.entrepriseId), eq(equipes.rang, rang)))
      .limit(1);

    // L'équipe n'a jamais été nommée : elle existe quand même dans le planning
    // (le compteur fait autorité sur le nombre, `ARCHITECTURE.md` §51). On pose
    // sa ligne, sans nom — ce n'est pas un trou à combler.
    const cible =
      equipe ??
      (
        await tx
          .insert(equipes)
          .values({ entrepriseId: ctx.entrepriseId, rang })
          .returning({ id: equipes.id, rang: equipes.rang, nom: equipes.nom })
      )[0];
    if (!cible) return null;

    const [creee] = await tx
      .insert(absencesEquipe)
      .values({
        entrepriseId: ctx.entrepriseId,
        equipeId: cible.id,
        premierJour: entree.premierJour,
        dernierJour: entree.dernierJour,
        motif: entree.motif?.trim() ? entree.motif.trim() : null,
      })
      .returning({
        id: absencesEquipe.id,
        equipeId: absencesEquipe.equipeId,
        premierJour: absencesEquipe.premierJour,
        dernierJour: absencesEquipe.dernierJour,
        motif: absencesEquipe.motif,
      });
    if (!creee) return null;

    return { ...creee, rang: cible.rang, nom: cible.nom };
  });
}

/**
 * Retirer une absence — en douceur.
 *
 * **`undefined` veut dire « la RLS a filtré, ou c'était déjà retiré ».** Dans
 * les deux cas l'écran doit remettre la ligne plutôt que la faire disparaître à
 * tort (`ARCHITECTURE.md` §48) : une absence effacée par erreur rendrait des
 * dates que le patron croyait bloquées.
 */
export async function retirerAbsenceEquipe(ctx: Ctx, id: string): Promise<{ id: string } | undefined> {
  return withEntreprise(ctx.utilisateurId, ctx.entrepriseId, async (tx) => {
    const [ligne] = await tx
      .update(absencesEquipe)
      .set({ deletedAt: new Date(), updatedAt: new Date() })
      .where(
        and(
          eq(absencesEquipe.id, id),
          eq(absencesEquipe.entrepriseId, ctx.entrepriseId),
          isNull(absencesEquipe.deletedAt)
        )
      )
      .returning({ id: absencesEquipe.id });
    return ligne;
  });
}
