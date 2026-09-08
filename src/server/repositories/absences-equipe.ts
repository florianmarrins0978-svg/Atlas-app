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

import { and, asc, eq, gte, inArray, isNull, isNotNull, lte } from "drizzle-orm";
import { withEntreprise } from "../db/with-entreprise";
import { absencesEquipe, chantiers, equipes, equipesDuChantier } from "../db/schema";
import { joursPresentsSurLeChantier } from "../../lib/equipe-absente";
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
  /** Les bornes de demi-journée — journée entière par défaut (0076). */
  premierDemi: string;
  dernierDemi: string;
  motif: string | null;
};

/**
 * Ce que la POSE d'une absence a produit — l'absence, et ce qu'elle a défait.
 *
 * **Un type à part, et ce n'est pas de la cosmétique** : `listerAbsencesEquipe`
 * rend des absences, pas des poses. Coller ce champ sur le type commun
 * l'aurait obligée à inventer une liste vide qui ne veut rien dire — et un
 * lecteur l'aurait crue.
 */
export type AbsencePosee = AbsenceEnregistree & {
  /**
   * ─── LES CHANTIERS D'OÙ CETTE PERSONNE VIENT D'ÊTRE RETIRÉE ───────────────
   *
   * **Sa consigne du 8 septembre 2026 : « pas de pansement, corrige le problème
   * à la racine ».** Elle est arrivée devant un correctif qui interdisait de
   * COCHER un absent — et qui laissait intactes les affectations posées AVANT
   * le congé. La porte était fermée d'un côté, grande ouverte de l'autre :
   * poser un congé n'a jamais rien réconcilié.
   *
   * **Le vrai défaut n'était pas la coche, c'était l'absence de
   * réconciliation.** Un congé est un fait nouveau qui rend fausses les
   * affectations qu'il traverse ; les laisser en base, c'est garder deux
   * vérités sur la même journée et compter sur lui pour voir laquelle est
   * périmée. Il l'a vu, une fois, sur une capture — les autres fois, un
   * chantier serait parti avec quelqu'un qui n'y était pas.
   *
   * **Elles sont RENDUES, jamais retirées en silence** (`CLAUDE.md` §4 : rien
   * ne se décide à sa place). L'écran nomme les chantiers concernés : sans ça,
   * une demi-journée passerait de « Julien » à personne sans qu'il l'apprenne,
   * et un chantier sans personne est exactement ce qu'on veut éviter.
   */
  chantiersLiberes: { id: string; nom: string }[];
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
        premierDemi: absencesEquipe.premierDemi,
        dernierDemi: absencesEquipe.dernierDemi,
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
): Promise<
  {
    id: string;
    equipeId: string;
    rang: number;
    premierJour: JourIso;
    dernierJour: JourIso;
    /**
     * **Les bornes de demi-journée passent par ICI, et c'est le chemin qui
     * compte** : c'est cette fonction qui alimente le calcul de capacité, donc
     * les dates proposées aux clients. Les oublier aurait laissé une absence
     * d'un matin bloquer la journée entière — le défaut qu'il signale le
     * 8 septembre 2026, corrigé partout sauf là où il se voit.
     */
    premierDemi: string;
    dernierDemi: string;
  }[]
> {
  return withEntreprise(ctx.utilisateurId, ctx.entrepriseId, async (tx) => {
    return tx
      .select({
        // **`id` et `rang` ont rejoint la sélection le 6 septembre 2026**, pour
        // que le PLANNING puisse fermer et rouvrir un jour sans quitter l'écran.
        //
        // Le calcul de disponibilité, lui, n'en a toujours pas besoin — il ne
        // lit que l'équipe et les dates (`fusionnerAbsences`). Les deux champs
        // servent à l'écran : `id` pour retirer la ligne d'un appui, `rang`
        // pour écrire le NOM de la personne plutôt qu'un numéro, comme le fait
        // déjà l'écran des absences (`libelleSalarie`).
        id: absencesEquipe.id,
        equipeId: absencesEquipe.equipeId,
        rang: equipes.rang,
        premierJour: absencesEquipe.premierJour,
        dernierJour: absencesEquipe.dernierJour,
        premierDemi: absencesEquipe.premierDemi,
        dernierDemi: absencesEquipe.dernierDemi,
      })
      .from(absencesEquipe)
      .innerJoin(equipes, eq(equipes.id, absencesEquipe.equipeId))
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
  entree: {
    rang: number;
    premierJour: JourIso;
    dernierJour: JourIso;
    motif: string | null;
    /**
     * Les bornes de demi-journée — son choix D2 du 8 septembre 2026.
     *
     * **Facultatives, et c'est ce qui garde le geste courant en un appui** :
     * absentes, elles valent la journée entière, exactement comme avant. Il ne
     * touche « Matin » ou « Après-midi » que le jour où ça compte.
     */
    premierDemi?: string | null;
    dernierDemi?: string | null;
  }
): Promise<AbsencePosee | null> {
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
        // **Tout ce qui n'est pas « apres_midi » vaut matin**, et l'inverse
        // pour la fin : une valeur venue de l'écran ne doit pas pouvoir poser
        // une absence que la base refuse. La contrainte 0076 la rattraperait,
        // mais par une erreur de base — qui n'arrive jamais jusqu'au patron.
        premierDemi: entree.premierDemi === "apres_midi" ? "apres_midi" : "matin",
        dernierDemi: entree.dernierDemi === "matin" ? "matin" : "apres_midi",
        motif: entree.motif?.trim() ? entree.motif.trim() : null,
      })
      .returning({
        id: absencesEquipe.id,
        equipeId: absencesEquipe.equipeId,
        premierJour: absencesEquipe.premierJour,
        dernierJour: absencesEquipe.dernierJour,
        premierDemi: absencesEquipe.premierDemi,
        dernierDemi: absencesEquipe.dernierDemi,
        motif: absencesEquipe.motif,
      });
    if (!creee) return null;

    // ─── LA RÉCONCILIATION, DANS LA MÊME TRANSACTION ──────────────────────
    // **Dans la même, et c'est le point.** Faite après coup, une panne entre
    // les deux laisserait le congé posé et les affectations fausses — soit
    // exactement l'état qu'on répare, mais désormais invisible parce que
    // l'écran croirait le travail fait.
    const poses = await tx
      .select({
        id: chantiers.id,
        nom: chantiers.nom,
        datePlanifiee: chantiers.datePlanifiee,
        creneauDebut: chantiers.creneauDebut,
        dureeDemiJournees: chantiers.dureeDemiJournees,
      })
      .from(chantiers)
      .innerJoin(equipesDuChantier, eq(equipesDuChantier.chantierId, chantiers.id))
      .where(
        and(
          eq(chantiers.entrepriseId, ctx.entrepriseId),
          eq(equipesDuChantier.equipeId, cible.id),
          isNull(chantiers.deletedAt),
          isNotNull(chantiers.datePlanifiee)
        )
      );

    // ─── CE QUI A CHANGÉ AVEC SON CHOIX C, LE 8 SEPTEMBRE 2026 ────────────
    // **On ne retire QUE si la personne ne vient plus AUCUN jour.**
    //
    // La version d'hier retirait dès qu'un jour du chantier tombait sur le
    // congé : elle vidait un chantier de deux jours pour une absence d'un
    // seul, et le §286 empêchait ensuite de recocher. C'était un
    // contournement du modèle, qui ne savait pas dire « Julien vendredi mais
    // pas jeudi ».
    //
    // La proposition C le dit : la pastille porte les jours où il vient. Une
    // affectation partiellement recouverte reste donc VRAIE — la retirer
    // ferait perdre au patron un choix encore valable, et sur le seul jour où
    // son gars était disponible.
    //
    // Le retrait ne garde qu'un cas, et il est nécessaire : le congé couvre
    // TOUT le chantier. Là, la coche n'annonce plus personne, et la laisser
    // ferait partir un chantier avec un nom qui n'y sera jamais.
    //
    // **Les absences déjà en base comptent, pas seulement celle qu'on pose** :
    // deux congés qui se suivent peuvent couvrir un chantier qu'aucun ne
    // couvre seul. Ne regarder que la nouvelle laisserait ce cas passer.
    const toutes = await tx
      .select({
        premierJour: absencesEquipe.premierJour,
        dernierJour: absencesEquipe.dernierJour,
        premierDemi: absencesEquipe.premierDemi,
        dernierDemi: absencesEquipe.dernierDemi,
      })
      .from(absencesEquipe)
      .where(
        and(
          eq(absencesEquipe.entrepriseId, ctx.entrepriseId),
          eq(absencesEquipe.equipeId, cible.id),
          isNull(absencesEquipe.deletedAt)
        )
      );
    const siennes = toutes.map((a) => ({ ...a, rang: cible.rang }));

    const touches = new Map<string, string>();
    for (const c of poses) {
      if (touches.has(c.id)) continue;
      if (joursPresentsSurLeChantier(cible.rang, c, siennes).length === 0) {
        touches.set(c.id, c.nom);
      }
    }

    if (touches.size > 0) {
      await tx
        .delete(equipesDuChantier)
        .where(
          and(
            eq(equipesDuChantier.entrepriseId, ctx.entrepriseId),
            eq(equipesDuChantier.equipeId, cible.id),
            inArray(equipesDuChantier.chantierId, [...touches.keys()])
          )
        );
    }

    return {
      ...creee,
      rang: cible.rang,
      nom: cible.nom,
      chantiersLiberes: [...touches].map(([id, nom]) => ({ id, nom })),
    };
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
