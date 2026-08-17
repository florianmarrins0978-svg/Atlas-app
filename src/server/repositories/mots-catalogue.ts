// Ses mots à lui — lecture et écriture, toujours sous `withEntreprise`.
//
// **Le catalogue commun est lu SANS contexte d'entreprise** (il n'en a pas :
// migration 0007, aucune RLS), ses mots le sont AVEC. Les deux se rejoignent
// dans `fusionnerCatalogue`, une fonction pure — c'est elle qui décide de
// l'écran, et elle s'éprouve sans base (`CLAUDE.md` §3).
//
// **Aucune fonction d'ici n'appelle `db` en direct.** Une requête hors de
// `withEntreprise` ne renvoie rien, *silencieusement* — le pire des défauts,
// puisqu'il ressemble à une base vide.

import { and, asc, eq, isNull, sql } from "drizzle-orm";
import { withEntreprise } from "../db/with-entreprise";
import { motsCatalogue } from "../db/schema";
import type { Ctx } from "./context";
import { listerCataloguePrestations } from "./catalogue-prestations";
import { listerCatalogueMateriels } from "./catalogue-materiels";
import {
  MAX_ENTREES_A_MOI,
  carteCorrespond,
  fusionnerCatalogue,
  motNettoye,
  refusDuMot,
  type CarteCatalogue,
  type MotAMoi,
  type RefusMot,
} from "@/lib/mots-catalogue";

export type Famille = "prestation" | "materiel";

/** Ses mots d'une famille, dans l'ordre où ils ont été écrits. */
async function sesMots(ctx: Ctx, famille: Famille): Promise<MotAMoi[]> {
  return withEntreprise(ctx.utilisateurId, ctx.entrepriseId, async (tx) => {
    const lignes = await tx
      .select({
        id: motsCatalogue.id,
        mot: motsCatalogue.mot,
        prestationId: motsCatalogue.prestationId,
        materielId: motsCatalogue.materielId,
        parentId: motsCatalogue.parentId,
      })
      .from(motsCatalogue)
      .where(and(eq(motsCatalogue.entrepriseId, ctx.entrepriseId), eq(motsCatalogue.famille, famille)))
      .orderBy(asc(motsCatalogue.createdAt), asc(motsCatalogue.mot));

    return lignes.map((l) => ({
      id: l.id,
      mot: l.mot,
      referenceId: famille === "prestation" ? l.prestationId : l.materielId,
      parentId: l.parentId,
    }));
  });
}

/** Le vocabulaire commun d'une famille, remis dans une forme unique. */
async function vocabulaireCommun(famille: Famille) {
  if (famille === "prestation") {
    const prestations = await listerCataloguePrestations();
    // **Variantes et synonymes fondus en une seule liste.** Sur sa capture, les
    // deux lignes disaient la même chose sous deux noms de jargon ; l'écran
    // n'en montre plus qu'une, « Aussi appelé ».
    return prestations.map((p) => ({
      id: p.id,
      nomCanonique: p.nomCanonique,
      mots: [...p.variantes, ...p.synonymes],
    }));
  }
  const materiels = await listerCatalogueMateriels();
  return materiels.map((m) => ({ id: m.id, nomCanonique: m.nomCanonique, mots: m.variantes }));
}

/**
 * L'écran entier d'une famille : le commun, ses mots posés dessus, ses entrées.
 *
 * C'est la seule lecture dont l'écran a besoin — et la même que la recherche
 * emploie, pour qu'un mot visible soit un mot reconnu.
 */
export async function listerCartes(ctx: Ctx, famille: Famille): Promise<CarteCatalogue[]> {
  const [communes, miens] = await Promise.all([vocabulaireCommun(famille), sesMots(ctx, famille)]);
  return fusionnerCatalogue({ communes, miens });
}

export type Ajout =
  | { ok: true; mot: { id: string; mot: string } }
  | { ok: false; refus: RefusMot };

/**
 * Pose un mot sur une entrée — celle d'Atlas, ou une des siennes.
 *
 * **Rend un refus plutôt que de lever**, et ce n'est pas un détail de style :
 * l'exception d'une action serveur n'arrive JAMAIS jusqu'au patron — Next.js la
 * remplace en production par un identifiant opaque, et son banc sert une
 * version bâtie (`HANDOVER.md`, piège 0 ter).
 */
export async function ajouterMot(
  ctx: Ctx,
  args: { famille: Famille; entreeId: string; mot: string }
): Promise<Ajout> {
  const cartes = await listerCartes(ctx, args.famille);
  const carte = cartes.find((c) => c.id === args.entreeId);
  if (!carte) return { ok: false, refus: "introuvable" };

  const refus = refusDuMot({
    mot: args.mot,
    motsDuCommun: [carte.nom, ...carte.motsCommuns],
    mesMotsDeLaFamille: cartes.flatMap((c) => [
      ...c.mesMots.map((m) => m.mot),
      ...(c.aMoi ? [c.nom] : []),
    ]),
    dejaSurCetteEntree: carte.mesMots.length,
  });
  if (refus) return { ok: false, refus };

  const propre = motNettoye(args.mot);
  if (!propre) return { ok: false, refus: "vide" };

  return withEntreprise(ctx.utilisateurId, ctx.entrepriseId, async (tx) => {
    const [ligne] = await tx
      .insert(motsCatalogue)
      .values({
        entrepriseId: ctx.entrepriseId,
        famille: args.famille,
        mot: propre,
        // Une entrée à lui se repère par `aMoi` : le mot s'accroche alors à SA
        // ligne (`parentId`), pas au catalogue partagé — qui ne la connaît pas.
        prestationId: !carte.aMoi && args.famille === "prestation" ? args.entreeId : null,
        materielId: !carte.aMoi && args.famille === "materiel" ? args.entreeId : null,
        parentId: carte.aMoi ? args.entreeId : null,
      })
      .returning({ id: motsCatalogue.id, mot: motsCatalogue.mot });
    return { ok: true, mot: ligne };
  });
}

/**
 * Crée une entrée qui n'existe que chez lui.
 *
 * **Elle n'entre PAS dans le catalogue partagé**, et c'est tout l'objet de la
 * table : une ligne ajoutée depuis son téléphone changerait le vocabulaire de
 * tous les autres artisans, sans qu'ils l'aient demandé.
 */
export async function creerEntree(
  ctx: Ctx,
  args: { famille: Famille; nom: string }
): Promise<Ajout> {
  const cartes = await listerCartes(ctx, args.famille);

  const refus = refusDuMot({
    mot: args.nom,
    motsDuCommun: cartes.filter((c) => !c.aMoi).flatMap((c) => [c.nom, ...c.motsCommuns]),
    mesMotsDeLaFamille: cartes.flatMap((c) => [
      ...c.mesMots.map((m) => m.mot),
      ...(c.aMoi ? [c.nom] : []),
    ]),
    dejaSurCetteEntree: 0,
  });
  if (refus) return { ok: false, refus };
  if (cartes.filter((c) => c.aMoi).length >= MAX_ENTREES_A_MOI) {
    return { ok: false, refus: "trop_d_entrees" };
  }

  const propre = motNettoye(args.nom);
  if (!propre) return { ok: false, refus: "vide" };

  return withEntreprise(ctx.utilisateurId, ctx.entrepriseId, async (tx) => {
    const [ligne] = await tx
      .insert(motsCatalogue)
      .values({ entrepriseId: ctx.entrepriseId, famille: args.famille, mot: propre })
      .returning({ id: motsCatalogue.id, mot: motsCatalogue.mot });
    return { ok: true, mot: ligne };
  });
}

/**
 * Retire un de SES mots — jamais un mot d'Atlas.
 *
 * La RLS suffit à empêcher d'effacer celui d'une autre entreprise ; le
 * vocabulaire commun, lui, n'est pas dans cette table et reste hors d'atteinte.
 * Retirer une de ses entrées emporte les mots qu'il y avait posés
 * (`ON DELETE CASCADE`) : les laisser orphelins rendrait des mots reconnus par
 * la dictée et invisibles à l'écran.
 */
export async function retirerMot(ctx: Ctx, id: string): Promise<{ retire: boolean }> {
  return withEntreprise(ctx.utilisateurId, ctx.entrepriseId, async (tx) => {
    const efface = await tx
      .delete(motsCatalogue)
      .where(and(eq(motsCatalogue.id, id), eq(motsCatalogue.entrepriseId, ctx.entrepriseId)))
      .returning({ id: motsCatalogue.id });
    return { retire: efface.length > 0 };
  });
}

/** Combien de mots il a posés, toutes familles confondues. Pour les suites. */
export async function compterMots(ctx: Ctx): Promise<number> {
  return withEntreprise(ctx.utilisateurId, ctx.entrepriseId, async (tx) => {
    const [ligne] = await tx
      .select({ n: sql<number>`count(*)::int` })
      .from(motsCatalogue)
      .where(and(eq(motsCatalogue.entrepriseId, ctx.entrepriseId), isNull(motsCatalogue.parentId)));
    return ligne?.n ?? 0;
  });
}

/**
 * Cherche dans les DEUX vocabulaires : celui d'Atlas, et le sien.
 *
 * **C'est ce qui donne son sens à l'écran.** Un mot qu'il ajoute et que la
 * recherche ignorerait serait visible et muet : il croirait avoir appris
 * quelque chose à Atlas, et la dictée continuerait de ne rien comprendre — sans
 * un message pour le lui dire (`AGENTS.md`, le défaut muet).
 *
 * **Les entrées d'Atlas passent devant les siennes.** Quand « écimage » a été
 * posé SUR « Élagage », c'est « Élagage » qui ressort — avec son historique de
 * prix et ses questions de chiffrage. Une entrée à lui n'a rien de tout cela :
 * elle ne doit sortir que si rien de commun ne correspond.
 */
export async function rechercherCartes(
  ctx: Ctx,
  famille: Famille,
  motCle: string
): Promise<CarteCatalogue[]> {
  const cle = (motCle ?? "").trim();
  if (!cle) return [];
  const cartes = await listerCartes(ctx, famille);
  return cartes.filter((c) => carteCorrespond(c, cle));
}
