import { and, desc, eq } from "drizzle-orm";
import { withEntreprise } from "../db/with-entreprise";
import { leconsPrix, lignesPrix } from "../db/schema";
import { signatureLecon, type LeconObservee } from "../../lib/lecons-prix";
import type { Ctx } from "./context";

// La mémoire des corrections — écriture et lecture, rien d'autre.
//
// Toute la règle (ce qui se rapproche, ce qui ne se rapproche pas, ce que dit
// le rappel) vit dans `src/lib/lecons-prix.ts`, pure et éprouvable sans base.
// C'est la règle du dépôt (`CLAUDE.md` §3), et elle a sa raison d'être ici :
// confondre deux techniques d'abattage rappellerait un prix faux de 800 €, et
// ce genre de défaut se trouve en jouant des exemples, pas en montant une base.

/**
 * Retient le prix que le patron a arrêté sur une ligne de devis.
 *
 * **Silencieux par construction**, et c'est délibéré. Cette fonction est
 * appelée à chaque fois qu'il quitte un champ de prix : la faire échouer
 * bruyamment sur un libellé qu'on ne sait pas classer reviendrait à
 * l'empêcher d'écrire son devis parce qu'on n'a pas su en tirer une leçon.
 * L'apprentissage ne doit jamais gêner le travail.
 *
 * Ne retient rien quand :
 * - le libellé ne désigne aucun métier reconnaissable (« Divers »,
 *   « Déplacement ») — un rapprochement fantaisiste vaut moins que rien ;
 * - le montant est nul ou illisible — c'est une ligne en cours de saisie, pas
 *   une décision. Sans ce filtre, la mémoire rappellerait « la dernière fois :
 *   0 € ».
 */
export async function retenirLecon(ctx: Ctx, lignePrixId: string): Promise<boolean> {
  return withEntreprise(ctx.utilisateurId, ctx.entrepriseId, async (tx) => {
    const [ligne] = await tx
      .select()
      .from(lignesPrix)
      .where(and(eq(lignesPrix.id, lignePrixId), eq(lignesPrix.entrepriseId, ctx.entrepriseId)))
      .limit(1);
    if (!ligne) return false;

    const signature = signatureLecon(ligne.libelle);
    if (!signature) return false;

    const montant = Number(ligne.montant);
    if (!Number.isFinite(montant) || montant <= 0) return false;

    // Une seule leçon par ligne, mise à jour à chaque correction : il tape son
    // prix chiffre par chiffre, et compter chaque frappe emplirait la mémoire
    // de 1, puis 10, puis 100 en allant vers 1 000. Seule sa dernière décision
    // compte.
    await tx
      .insert(leconsPrix)
      .values({
        entrepriseId: ctx.entrepriseId,
        lignePrixId: ligne.id,
        chantierId: ligne.chantierId,
        signature: signature.cle,
        libelle: ligne.libelle,
        prix: ligne.montant,
      })
      .onConflictDoUpdate({
        target: leconsPrix.lignePrixId,
        set: {
          signature: signature.cle,
          libelle: ligne.libelle,
          prix: ligne.montant,
          constateLe: new Date(),
        },
      });
    return true;
  });
}

/**
 * Ce qu'il a facturé pour ce genre de travail, le plus récent d'abord.
 *
 * `chantierExclu` retire le chantier en cours : se rappeler à soi-même le prix
 * qu'on vient d'écrire n'apprend rien, et afficherait « la dernière fois :
 * 1 400 € » juste sous une ligne à 1 400 €.
 */
export async function leconsComparables(
  ctx: Ctx,
  libelle: string,
  options: { chantierExclu?: string; limite?: number } = {}
): Promise<LeconObservee[]> {
  const signature = signatureLecon(libelle);
  if (!signature) return [];

  return withEntreprise(ctx.utilisateurId, ctx.entrepriseId, async (tx) => {
    const lignes = await tx
      .select({
        prix: leconsPrix.prix,
        constateLe: leconsPrix.constateLe,
        libelle: leconsPrix.libelle,
        chantierId: leconsPrix.chantierId,
      })
      .from(leconsPrix)
      .where(and(eq(leconsPrix.entrepriseId, ctx.entrepriseId), eq(leconsPrix.signature, signature.cle)))
      .orderBy(desc(leconsPrix.constateLe))
      .limit(options.limite ?? 20);

    return lignes
      .filter((l) => l.chantierId !== options.chantierExclu)
      .map(({ prix, constateLe, libelle: lib }) => ({ prix, constateLe, libelle: lib }));
  });
}
