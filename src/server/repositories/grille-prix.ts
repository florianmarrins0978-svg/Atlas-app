import { and, eq, sql } from "drizzle-orm";
import { withEntreprise } from "../db/with-entreprise";
import { grillePrix } from "../db/schema";
import type { Ctx } from "./context";
import { celluleDeNature, type CelluleFendage, type NatureGrille } from "../../lib/grille-prix";

/** Ré-exporté pour les actions serveur, qui ne doivent typer qu'un seul module. */
export type NatureGrilleServeur = NatureGrille;

/**
 * La grille de prix du fendage, en base.
 *
 * Les bornes des tranches et la façon de désigner une case vivent dans
 * `src/lib/grille-prix.ts` : fonctions pures, éprouvables sans base, et
 * discutables avec le patron sans lire une requête. Ce fichier ne fait que lire
 * et écrire.
 *
 * **Tout passe par `withEntreprise`** — ce sont ses prix de vente, et une
 * requête posée hors de ce cadre ne renverrait rien, silencieusement
 * (`CLAUDE.md` §3).
 */

export type CasePleine = {
  nature: NatureGrille;
  cellule: CelluleFendage;
  prix: string;
  origine: "saisi" | "devis";
  constateLe: Date;
};

/** Toutes les cases remplies, toutes natures confondues. */
export async function lireGrillePrix(ctx: Ctx): Promise<CasePleine[]> {
  return withEntreprise(ctx.utilisateurId, ctx.entrepriseId, async (tx) => {
    const lignes = await tx.select().from(grillePrix);
    return lignes
      .map((l) => {
        const cellule = celluleDeNature(l.nature, l.cellule);
        // Une clé qu'aucune tranche ne reconnaît : les bornes ont changé depuis
        // qu'elle a été écrite. On l'ignore plutôt que d'afficher un prix sans
        // savoir à quel arbre il correspond — et on ne la supprime pas, pour
        // qu'un retour en arrière sur les bornes la retrouve.
        return cellule
          ? { nature: l.nature, cellule, prix: l.prix, origine: l.origine, constateLe: l.constateLe }
          : null;
      })
      .filter((c): c is CasePleine => c !== null);
  });
}

/**
 * Une grille sous la forme qu'attend `prixDuFendage` : clé de case → prix.
 *
 * **Une nature à la fois, et jamais deux mélangées.** `d70` désigne une case
 * chez l'abattage comme chez le fendage : les réunir ferait chiffrer une fente
 * au prix d'un démontage.
 */
export async function prixConnusDe(ctx: Ctx, nature: NatureGrille): Promise<Map<string, string>> {
  const cases = await lireGrillePrix(ctx);
  return new Map(cases.filter((c) => c.nature === nature).map((c) => [c.cellule.cle, c.prix]));
}

/**
 * Le montant tel qu'un artisan l'écrit, ou `null` si ce n'en est pas un.
 *
 * **« 1 200 » doit valoir mille deux cents, pas rien.** Un `Number()` posé
 * directement sur cette chaîne rend `NaN` — et comme un montant illisible
 * EFFACE la case, taper un prix à quatre chiffres avec une espace l'aurait
 * supprimée en silence. Le patron aurait vu son prix disparaître à l'instant
 * même où il le posait, sans un mot d'explication.
 *
 * Les espaces (y compris l'insécable que produit un clavier de téléphone), la
 * virgule décimale et le symbole € sont donc acceptés.
 */
function lireMontant(prix: string | null): number | null {
  const propre = (prix ?? "")
    .replace(/[\s\u00a0\u202f]/g, "")
    .replace("€", "")
    .replace(",", ".");
  if (propre === "") return null;
  const montant = Number(propre);
  return Number.isFinite(montant) && montant > 0 ? montant : null;
}

/**
 * Pose ou corrige le prix d'une case.
 *
 * Un prix vide ou nul **efface** la case au lieu d'y écrire zéro : une case
 * qu'on vide redevient une question posée, alors qu'un zéro enregistré se
 * proposerait sur un devis avec l'autorité de sa grille.
 *
 * `origine` distingue ce qu'il a décidé à l'avance (`saisi`) de ce qu'il a
 * réellement pratiqué (`devis`). Une saisie à la main l'emporte toujours sur une
 * observation — c'est sa décision explicite, contre une déduction.
 */
export async function poserPrixGrille(
  ctx: Ctx,
  nature: NatureGrille,
  cle: string,
  prix: string | null,
  origine: "saisi" | "devis" = "saisi"
): Promise<void> {
  // **La case est validée ici, contre la liste des cases possibles.** C'est ce
  // qui fait qu'une clé fabriquée depuis un navigateur n'écrit rien : la garde
  // n'est pas dans l'écran, qui ne protège que ce qu'on regarde.
  if (!celluleDeNature(nature, cle)) return;

  const montant = lireMontant(prix);
  if (montant === null) {
    await withEntreprise(ctx.utilisateurId, ctx.entrepriseId, async (tx) => {
      await tx.delete(grillePrix).where(and(eq(grillePrix.nature, nature), eq(grillePrix.cellule, cle)));
    });
    return;
  }

  await withEntreprise(ctx.utilisateurId, ctx.entrepriseId, async (tx) => {
    await tx
      .insert(grillePrix)
      .values({ entrepriseId: ctx.entrepriseId, nature, cellule: cle, prix: montant.toFixed(2), origine })
      .onConflictDoUpdate({
        target: [grillePrix.entrepriseId, grillePrix.nature, grillePrix.cellule],
        set: { prix: montant.toFixed(2), origine, constateLe: sql`now()` },
        // Une observation ne piétine pas une décision : si le patron a posé ce
        // prix lui-même dans les réglages, un devis ne le réécrit pas dans son
        // dos. L'inverse, si : ce qu'il vient d'écrire sur un vrai devis vaut
        // mieux qu'une observation plus ancienne.
        setWhere:
          origine === "saisi" ? undefined : sql`${grillePrix.origine} = 'devis'`,
      });
  });
}
