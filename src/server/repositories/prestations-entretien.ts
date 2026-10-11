// Le modèle de fiche d'entretien — lecture et écriture.
//
// **Tout passe par `withEntreprise`** (`CLAUDE.md` §3) : une requête hors de ce
// cadre ne renvoie rien, *silencieusement*. Aucune fonction d'ici n'appelle `db`
// en direct.
//
// **Un seul modèle par entreprise**, décidé le 16 août 2026 — rien n'est rangé
// par client. Le récit est en tête de `src/lib/prestations-entretien.ts`.

import { and, asc, eq, sql } from "drizzle-orm";
import type { DbOrTx } from "../db/client";
import { withEntreprise } from "../db/with-entreprise";
import { prestationsEntretien } from "../db/schema";
import type { Ctx } from "./context";
import {
  MAX_PRESTATIONS,
  libelleNettoye,
  memeLibelle,
  modeleRemis,
  type RefusPrestation,
} from "@/lib/prestations-entretien";

export type { RefusPrestation };

export type Prestation = {
  id: string;
  famille: string;
  libelle: string;
  ordre: number;
};

/** L'écart entre deux lignes : il laisse la place d'en insérer sans tout réécrire. */
const PAS_ORDRE = 10;

/**
 * Le modèle de l'entreprise, dans l'ordre où il se coche.
 *
 * **Ne pose rien de lui-même** : lire n'écrit pas. Le modèle est là parce
 * qu'il a été posé à la création du compte (`creerEntreprise`, depuis le
 * 29 septembre 2026, et la migration 0116 pour les comptes d'avant), ou remis
 * par son bouton (`remettreLeModele`). Une liste vide veut dire qu'il a tout
 * retiré.
 */
export async function listerPrestations(ctx: Ctx): Promise<Prestation[]> {
  return withEntreprise(ctx.utilisateurId, ctx.entrepriseId, async (tx) => {
    return tx
      .select({
        id: prestationsEntretien.id,
        famille: prestationsEntretien.famille,
        libelle: prestationsEntretien.libelle,
        ordre: prestationsEntretien.ordre,
      })
      .from(prestationsEntretien)
      .where(eq(prestationsEntretien.entrepriseId, ctx.entrepriseId))
      .orderBy(asc(prestationsEntretien.ordre), asc(prestationsEntretien.libelle));
  });
}

/**
 * Ajoute une prestation à la fin d'une famille.
 *
 * **Rend un refus plutôt que de lever**, et ce n'est pas un détail de style :
 * l'exception d'une action serveur n'arrive JAMAIS jusqu'au patron — Next.js la
 * remplace en production par un identifiant opaque, et son banc sert une version
 * bâtie. Un refus attendu se rend donc en valeur (`HANDOVER.md`, piège 0 ter).
 */
export async function ajouterPrestation(
  ctx: Ctx,
  brut: { famille: string; libelle: string }
): Promise<{ ok: true; prestation: Prestation } | { ok: false; refus: RefusPrestation }> {
  const famille = libelleNettoye(brut.famille);
  const libelle = libelleNettoye(brut.libelle);
  if (!famille) return { ok: false, refus: "famille_vide" };
  if (!libelle) return { ok: false, refus: "libelle_vide" };

  return withEntreprise(ctx.utilisateurId, ctx.entrepriseId, async (tx) => {
    const existantes = await tx
      .select({
        libelle: prestationsEntretien.libelle,
        famille: prestationsEntretien.famille,
        ordre: prestationsEntretien.ordre,
      })
      .from(prestationsEntretien)
      .where(eq(prestationsEntretien.entrepriseId, ctx.entrepriseId));

    if (existantes.length >= MAX_PRESTATIONS) {
      return { ok: false as const, refus: "trop_de_prestations" as const };
    }
    // **La comparaison est indulgente**, et elle doit l'être : « Tonte » et
    // « tonte » sont le même geste, et deux cases pour un seul geste donneraient
    // une ligne en double sur le rapport du client.
    if (existantes.some((p) => memeLibelle(p.libelle, libelle))) {
      return { ok: false as const, refus: "doublon" as const };
    }

    // **Se ranger À LA FIN DE SA FAMILLE, pas à la fin de la fiche.** Une ligne
    // de pelouse ajoutée en mars doit se retrouver avec les autres lignes de
    // pelouse — sinon il la cherche au bas de l'écran, sur un chantier.
    const deLaFamille = existantes.filter((p) => memeLibelle(p.famille, famille));
    const ordre =
      deLaFamille.length > 0
        ? Math.max(...deLaFamille.map((p) => p.ordre)) + 1
        : (existantes.length > 0 ? Math.max(...existantes.map((p) => p.ordre)) : 0) + PAS_ORDRE;

    const [creee] = await tx
      .insert(prestationsEntretien)
      .values({
        entrepriseId: ctx.entrepriseId,
        // La famille reprend l'orthographe DÉJÀ en place quand elle existe :
        // sans cela, « propreté » saisi en minuscules ouvrirait une seconde
        // famille à l'écran alors que le patron croyait compléter la première.
        famille: deLaFamille[0]?.famille ?? famille,
        libelle,
        ordre,
      })
      .returning({
        id: prestationsEntretien.id,
        famille: prestationsEntretien.famille,
        libelle: prestationsEntretien.libelle,
        ordre: prestationsEntretien.ordre,
      });
    return { ok: true as const, prestation: creee };
  });
}

/**
 * Retire une prestation du modèle.
 *
 * **Ce retrait est définitif en base, et réversible à l'écran** : l'écran garde
 * la ligne barrée le temps du « Annuler » et n'appelle ceci qu'ensuite
 * (`useRetraits`, règle du 10 août 2026). Le faire autrement — un drapeau
 * « retirée » en base — laisserait grossir la fiche de lignes invisibles que
 * personne ne ramasserait jamais.
 *
 * **Et surtout : cela ne touche à AUCUN rapport déjà envoyé.** Ceux-ci ne lisent
 * pas ce modèle ; ils porteront leur propre copie. Retirer « Scarification » en
 * octobre ne doit rien changer aux rapports de juillet, qui sont partis chez le
 * client.
 */
export async function retirerPrestation(
  ctx: Ctx,
  id: string
): Promise<{ ok: true } | { ok: false; refus: RefusPrestation }> {
  return withEntreprise(ctx.utilisateurId, ctx.entrepriseId, async (tx) => {
    const supprimees = await tx
      .delete(prestationsEntretien)
      .where(
        and(
          eq(prestationsEntretien.id, id),
          eq(prestationsEntretien.entrepriseId, ctx.entrepriseId)
        )
      )
      .returning({ id: prestationsEntretien.id });
    if (supprimees.length === 0) return { ok: false as const, refus: "introuvable" as const };
    return { ok: true as const };
  });
}

/** Réécrit le libellé d'une prestation. */
export async function renommerPrestation(
  ctx: Ctx,
  id: string,
  brut: string
): Promise<{ ok: true } | { ok: false; refus: RefusPrestation }> {
  const libelle = libelleNettoye(brut);
  if (!libelle) return { ok: false, refus: "libelle_vide" };

  return withEntreprise(ctx.utilisateurId, ctx.entrepriseId, async (tx) => {
    const autres = await tx
      .select({ id: prestationsEntretien.id, libelle: prestationsEntretien.libelle })
      .from(prestationsEntretien)
      .where(eq(prestationsEntretien.entrepriseId, ctx.entrepriseId));

    if (autres.some((p) => p.id !== id && memeLibelle(p.libelle, libelle))) {
      return { ok: false as const, refus: "doublon" as const };
    }
    const modifiees = await tx
      .update(prestationsEntretien)
      .set({ libelle, updatedAt: new Date() })
      .where(
        and(
          eq(prestationsEntretien.id, id),
          eq(prestationsEntretien.entrepriseId, ctx.entrepriseId)
        )
      )
      .returning({ id: prestationsEntretien.id });
    if (modifiees.length === 0) return { ok: false as const, refus: "introuvable" as const };
    return { ok: true as const };
  });
}

/**
 * Renomme une famille entière.
 *
 * La famille étant une colonne de texte, la renommer c'est réécrire ses lignes.
 * C'est le prix — assumé — de ne pas avoir fait une table pour un mot que le
 * patron change trois fois par an (voir la migration `0051`).
 */
export async function renommerFamille(
  ctx: Ctx,
  ancienne: string,
  brut: string
): Promise<{ ok: true; touchees: number } | { ok: false; refus: RefusPrestation }> {
  const famille = libelleNettoye(brut);
  if (!famille) return { ok: false, refus: "famille_vide" };

  return withEntreprise(ctx.utilisateurId, ctx.entrepriseId, async (tx) => {
    const touchees = await tx
      .update(prestationsEntretien)
      .set({ famille, updatedAt: new Date() })
      .where(
        and(
          eq(prestationsEntretien.entrepriseId, ctx.entrepriseId),
          // `lower()` plutôt qu'une égalité stricte : l'écran envoie le nom tel
          // qu'il l'affiche, et une casse différente laisserait la moitié des
          // lignes sous l'ancien nom — une famille coupée en deux, sans un mot.
          sql`lower(${prestationsEntretien.famille}) = lower(${ancienne})`
        )
      )
      .returning({ id: prestationsEntretien.id });
    if (touchees.length === 0) return { ok: false as const, refus: "introuvable" as const };
    return { ok: true as const, touchees: touchees.length };
  });
}

/**
 * Retire une famille entière — **et toutes ses prestations avec elle**.
 *
 * **Sa remarque du 24 août 2026** : l'endroit où il compose sa fiche sert à
 * *« ajouter des catégories, en enlever, en créer »*. « En enlever » n'existait
 * pas : il fallait retirer les prestations une par une, et la famille
 * disparaissait toute seule quand la dernière tombait. Six appuis au pouce,
 * avec des gants, pour retirer une famille qu'il ne fait pas.
 *
 * **Une famille n'est pas une ligne en base, c'est une colonne de texte** (voir
 * `renommerFamille`) : la retirer, c'est supprimer ses prestations. Elle rend
 * donc combien elle en a emporté — ce que l'écran, lui, annonce AVANT le geste,
 * d'après ce qu'il affiche. Le chiffre sert ici à ce qu'un contrôle puisse dire
 * « deux, et pas la famille voisine » : sans lui, un retrait trop large et un
 * retrait juste se ressemblent.
 *
 * **Aucun rapport déjà envoyé n'est touché**, comme pour une prestation seule :
 * ceux-ci portent leur propre copie (migration `0055`).
 */
export async function retirerFamille(
  ctx: Ctx,
  famille: string
): Promise<{ ok: true; retirees: number } | { ok: false; refus: RefusPrestation }> {
  return withEntreprise(ctx.utilisateurId, ctx.entrepriseId, async (tx) => {
    const supprimees = await tx
      .delete(prestationsEntretien)
      .where(
        and(
          eq(prestationsEntretien.entrepriseId, ctx.entrepriseId),
          // `lower()` comme au renommage : l'écran envoie le nom tel qu'il
          // l'affiche, et une casse différente laisserait la moitié des lignes
          // derrière — une famille à moitié retirée, sans un mot.
          sql`lower(${prestationsEntretien.famille}) = lower(${famille})`
        )
      )
      .returning({ id: prestationsEntretien.id });
    if (supprimees.length === 0) return { ok: false as const, refus: "introuvable" as const };
    return { ok: true as const, retirees: supprimees.length };
  });
}

/**
 * Remet ce qui manque du modèle Atlas sur la fiche, sans toucher à ses lignes.
 *
 * **Sa réponse « B » du 29 septembre 2026** (`modeleRemis`, la règle) : le
 * bouton « Remettre le modèle Atlas » ramène les lignes du modèle qu'il avait
 * retirées, chacune dans sa famille ; ce qu'il a ajouté lui-même reste. Sur une
 * fiche vide, c'est le modèle entier : **la même écriture sert à la création
 * d'un compte** (`creerEntreprise`), pour que le modèle soit là d'office, sa
 * demande du même jour.
 *
 * **Prend une transaction où le contexte d'entreprise est déjà posé** : la
 * table est sous FORCE RLS, et `creerEntreprise` n'a pas encore d'adhésion pour
 * passer par `withEntreprise`.
 *
 * Renvoie les lignes ajoutées, pour que l'écran puisse les retirer si l'on
 * appuie sur « Annuler ». Toutes les lignes sont renumérotées d'après la fiche
 * remise : insérer au milieu d'une famille sans cela pourrait tomber sur un
 * ordre déjà pris, et deux lignes se croiseraient au rechargement.
 */
export async function remettreLeModeleDans(
  tx: DbOrTx,
  entrepriseId: string
): Promise<{ ok: true; ajoutees: Prestation[] } | { ok: false; refus: "trop_de_prestations" }> {
  const existantes = await tx
    .select({
      id: prestationsEntretien.id,
      famille: prestationsEntretien.famille,
      libelle: prestationsEntretien.libelle,
      ordre: prestationsEntretien.ordre,
    })
    .from(prestationsEntretien)
    .where(eq(prestationsEntretien.entrepriseId, entrepriseId))
    .orderBy(asc(prestationsEntretien.ordre), asc(prestationsEntretien.libelle));
  const fiche = modeleRemis(existantes);
  if (fiche.length === existantes.length) return { ok: true, ajoutees: [] };
  if (fiche.length > MAX_PRESTATIONS) return { ok: false, refus: "trop_de_prestations" };

  const ajoutees: Prestation[] = [];
  for (const [i, ligne] of fiche.entries()) {
    const ordre = (i + 1) * PAS_ORDRE;
    if ("id" in ligne) {
      if (ligne.ordre !== ordre) {
        await tx.update(prestationsEntretien).set({ ordre }).where(eq(prestationsEntretien.id, ligne.id));
      }
      continue;
    }
    const [creee] = await tx
      .insert(prestationsEntretien)
      .values({ entrepriseId, famille: ligne.famille, libelle: ligne.libelle, ordre })
      .returning({
        id: prestationsEntretien.id,
        famille: prestationsEntretien.famille,
        libelle: prestationsEntretien.libelle,
        ordre: prestationsEntretien.ordre,
      });
    ajoutees.push(creee);
  }
  return { ok: true, ajoutees };
}

export async function remettreLeModele(ctx: Ctx) {
  return withEntreprise(ctx.utilisateurId, ctx.entrepriseId, (tx) => remettreLeModeleDans(tx, ctx.entrepriseId));
}
