// Le modèle de fiche d'entretien — lecture et écriture.
//
// **Tout passe par `withEntreprise`** (`CLAUDE.md` §3) : une requête hors de ce
// cadre ne renvoie rien, *silencieusement*. Aucune fonction d'ici n'appelle `db`
// en direct.
//
// **Un seul modèle par entreprise**, décidé le 16 août 2026 — rien n'est rangé
// par client. Le récit est en tête de `src/lib/prestations-entretien.ts`.

import { and, asc, eq, sql } from "drizzle-orm";
import { withEntreprise } from "../db/with-entreprise";
import { prestationsEntretien } from "../db/schema";
import type { Ctx } from "./context";
import {
  MAX_PRESTATIONS,
  MODELE_FOURNI,
  libelleNettoye,
  memeLibelle,
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
 * **Rend une liste VIDE quand rien n'a été posé**, et ne pose rien de lui-même.
 * Semer le modèle fourni au premier regard écrirait vingt lignes en base parce
 * que quelqu'un a ouvert un écran — y compris s'il ne fait pas d'entretien. La
 * pose est un geste, et elle a sa fonction (`poserModeleFourni`).
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
 * Pose le modèle fourni — **seulement si la fiche est vide**.
 *
 * La garde n'est pas une précaution : sans elle, un second appui sur le bouton
 * doublerait les vingt lignes, et le patron n'aurait aucun moyen de savoir
 * laquelle des deux « Tonte et ébarbage » il vient de cocher. L'index unique
 * refuserait d'ailleurs le doublon — mais après avoir écrit la moitié de la
 * liste, ce qui est pire qu'un refus franc.
 */
export async function poserModeleFourni(
  ctx: Ctx
): Promise<{ ok: true; posees: number } | { ok: false; refus: "fiche_non_vide" }> {
  return withEntreprise(ctx.utilisateurId, ctx.entrepriseId, async (tx) => {
    const [{ combien }] = await tx
      .select({ combien: sql<number>`count(*)::int` })
      .from(prestationsEntretien)
      .where(eq(prestationsEntretien.entrepriseId, ctx.entrepriseId));
    if (combien > 0) return { ok: false as const, refus: "fiche_non_vide" as const };

    await tx.insert(prestationsEntretien).values(
      MODELE_FOURNI.map((p, i) => ({
        entrepriseId: ctx.entrepriseId,
        famille: p.famille,
        libelle: p.libelle,
        ordre: (i + 1) * PAS_ORDRE,
      }))
    );
    return { ok: true as const, posees: MODELE_FOURNI.length };
  });
}
