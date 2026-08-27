import { and, asc, eq } from "drizzle-orm";
import { withEntreprise } from "../db/with-entreprise";
import { prestations } from "../db/schema";
import type { Ctx } from "./context";
import { quantiteDuLibelle, quantiteLue } from "../../lib/prestation-structuree";

export async function listerPrestations(ctx: Ctx, chantierId: string) {
  return withEntreprise(ctx.utilisateurId, ctx.entrepriseId, (tx) =>
    tx.select().from(prestations).where(eq(prestations.chantierId, chantierId)).orderBy(asc(prestations.ordre))
  );
}

/**
 * Ce qu'une prestation peut porter en plus de son nom, depuis le 26 août 2026.
 *
 * **Facultatif partout, et c'est la clé de la compatibilité.** Une prestation
 * créée à la main sur l'écran Informations n'en fournit aucun, et doit
 * continuer à s'enregistrer exactement comme avant. Ce qui n'est pas donné
 * reste `NULL` en base — « on ne sait pas », jamais une valeur par défaut.
 */
export type StructurePrestation = {
  quantite?: string | null;
  unite?: string | null;
  nature?: string | null;
  espece?: string | null;
  methode?: string | null;
  caracteristiques?: Record<string, number | string> | null;
  aConfirmer?: boolean | null;
};

export async function ajouterPrestation(
  ctx: Ctx,
  chantierId: string,
  libelle: string,
  structure: StructurePrestation = {}
) {
  return withEntreprise(ctx.utilisateurId, ctx.entrepriseId, async (tx) => {
    const existantes = await tx.select().from(prestations).where(eq(prestations.chantierId, chantierId));
    const [row] = await tx
      .insert(prestations)
      .values({ entrepriseId: ctx.entrepriseId, chantierId, libelle, ordre: existantes.length, ...structure })
      .returning();
    return row;
  });
}

/**
 * Complète les champs structurés d'une prestation déjà écrite.
 *
 * **Elle n'écrase jamais par du vide.** Seules les clés réellement fournies
 * sont posées : un appelant qui ne connaît que la méthode ne doit pas effacer
 * la quantité au passage. C'est ce qui permet à deux sources d'alimenter la
 * même ligne — la dictée pour la mesure, ses réponses à l'arrêt pour la
 * technique — sans se marcher dessus.
 */
export async function completerPrestation(ctx: Ctx, id: string, structure: StructurePrestation) {
  const aPoser = Object.fromEntries(Object.entries(structure).filter(([, v]) => v !== undefined));
  if (Object.keys(aPoser).length === 0) return null;
  return withEntreprise(ctx.utilisateurId, ctx.entrepriseId, async (tx) => {
    const [row] = await tx
      .update(prestations)
      .set({ ...aPoser, updatedAt: new Date() })
      .where(eq(prestations.id, id))
      .returning();
    return row ?? null;
  });
}

/**
 * L'artisan renomme une prestation — et sa mesure suit.
 *
 * ─── Ce que ce chemin réparait mal ──────────────────────────────────────────
 *
 * Sa plainte du 27 août 2026 : *« il ne doit plus être obligé de transformer
 * "Haie (800 ml)" en "Haie (80 ml)" pour corriger sa quantité. »* Le défaut
 * était en réalité pire que ça : quand il le FAISAIT, **rien ne changeait** —
 * le chiffrage lisait la colonne, restée à 800, et le refus de trancher entre
 * les deux (le contrat du lot C) empêchait alors de calculer quoi que ce soit.
 * Sa correction ne servait à rien et il ne pouvait pas le savoir.
 *
 * Le libellé n'est plus une base de données ; il reste une **saisie**. Une
 * quantité qu'il écrit à la main est donc lue, posée dans les colonnes, et
 * marquée comme sienne — une extraction ultérieure ne l'écrasera pas, et elle
 * tranchera face à un texte que personne n'aura mis à jour.
 */
export async function modifierPrestation(ctx: Ctx, id: string, libelle: string) {
  const dite = quantiteDuLibelle(libelle);
  return withEntreprise(ctx.utilisateurId, ctx.entrepriseId, async (tx) => {
    const [avant] = await tx.select().from(prestations).where(eq(prestations.id, id)).limit(1);

    // On ne touche aux colonnes que s'il a réellement écrit une mesure, et
    // qu'elle diffère de celle qui est là. Renommer pour une faute de frappe ne
    // doit pas marquer la ligne comme corrigée.
    const mesureChangee =
      dite !== null && (Number(avant?.quantite) !== Number(dite.quantite) || (avant?.unite ?? "") !== dite.unite);

    const [row] = await tx
      .update(prestations)
      .set({
        libelle,
        ...(mesureChangee ? { quantite: dite.quantite, unite: dite.unite, corrigeParHumain: true } : {}),
        updatedAt: new Date(),
      })
      .where(eq(prestations.id, id))
      .returning();
    return row;
  });
}

/**
 * L'artisan corrige directement les données structurées d'une prestation.
 *
 * **Le chemin explicite qu'appelle le §8 du brief du 27 août 2026** : corriger
 * une quantité sans passer par le texte. Ce qu'il pose ici fait foi — aucune
 * extraction future ne l'écrase (`corrigeParHumain`), et sa valeur tranche
 * quand le libellé dit autre chose (`mesures-prestation.ts`).
 *
 * **Effacer est un geste comme un autre** : passer `null` retire la mesure, et
 * la ligne redevient « à mesurer » plutôt que de garder un chiffre faux.
 */
export async function corrigerMesurePrestation(
  ctx: Ctx,
  id: string,
  mesure: { quantite: string | null; unite: string | null }
) {
  const quantite = mesure.quantite ? quantiteLue(mesure.quantite) : null;
  const unite = mesure.unite?.trim() || null;
  // La base l'exige, et une mesure sans son unité ne veut rien dire.
  const ensemble = quantite !== null && unite !== null;
  return withEntreprise(ctx.utilisateurId, ctx.entrepriseId, async (tx) => {
    const [row] = await tx
      .update(prestations)
      .set({
        quantite: ensemble ? quantite : null,
        unite: ensemble ? unite : null,
        corrigeParHumain: true,
        updatedAt: new Date(),
      })
      .where(eq(prestations.id, id))
      .returning();
    return row ?? null;
  });
}

export async function supprimerPrestation(ctx: Ctx, id: string) {
  return withEntreprise(ctx.utilisateurId, ctx.entrepriseId, async (tx) => {
    await tx.delete(prestations).where(eq(prestations.id, id));
  });
}

// Réordonnancement — capacité disponible et testée au niveau repository ; aucun
// contrôle visuel de réorganisation n'existe encore sur cet écran (aucune
// maquette validée n'en prévoit un), voir compte rendu du lot.
export async function reordonnerPrestations(ctx: Ctx, chantierId: string, idsEnOrdre: string[]) {
  return withEntreprise(ctx.utilisateurId, ctx.entrepriseId, async (tx) => {
    for (let i = 0; i < idsEnOrdre.length; i++) {
      await tx
        .update(prestations)
        .set({ ordre: i, updatedAt: new Date() })
        .where(and(eq(prestations.id, idsEnOrdre[i]), eq(prestations.chantierId, chantierId)));
    }
  });
}
