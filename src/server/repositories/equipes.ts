// Les équipes d'une entreprise, et leurs noms.
//
// **Tout passe par `withEntreprise`** (`CLAUDE.md` §3) : une requête hors de ce
// cadre ne renvoie rien, *silencieusement*. Aucune fonction d'ici n'appelle
// `db` en direct.
//
// **Ce dépôt ne décide JAMAIS d'un libellé.** Il rend ce que la base porte —
// `nom` compris, `null` inclus. Le repli « Équipe A » est un affichage, et il
// vit dans la seule fonction qui en décide (`src/lib/equipes.ts`).

import { and, asc, eq } from "drizzle-orm";
import { withEntreprise } from "../db/with-entreprise";
import { equipes } from "../db/schema";
import type { Ctx } from "./context";
import { MAX_EQUIPES } from "@/lib/equipes";

export type EquipeEnregistree = { id: string; rang: number; nom: string | null };

/**
 * Toutes les équipes nommées de l'entreprise, par rang croissant.
 *
 * **Rend AUSSI les rangs au-delà du compteur**, et c'est délibéré : ces lignes
 * sont conservées pour qu'un aller-retour sur le compteur ne perde pas un nom
 * saisi à la main. C'est `equipesAffichees` qui décide de ce qui se montre.
 */
export async function listerEquipes(ctx: Ctx): Promise<EquipeEnregistree[]> {
  return withEntreprise(ctx.utilisateurId, ctx.entrepriseId, async (tx) => {
    const lignes = await tx
      .select({ id: equipes.id, rang: equipes.rang, nom: equipes.nom })
      .from(equipes)
      .where(eq(equipes.entrepriseId, ctx.entrepriseId))
      .orderBy(asc(equipes.rang));
    return lignes;
  });
}

/**
 * Écrit — ou efface — le nom d'une équipe, désignée par son RANG.
 *
 * Par le rang et non par un identifiant : l'écran affiche des lignes qui
 * n'existent pas encore en base (le patron peut nommer la troisième sans avoir
 * touché la deuxième). Exiger un identifiant obligerait à créer vingt lignes
 * vides d'avance — c'est-à-dire à écrire en base ce que personne n'a saisi.
 *
 * **Un champ vidé remet `null`, il n'écrit pas une chaîne vide.** Sans cela, la
 * base porterait deux façons de dire « pas de nom » et `libelleEquipe` devrait
 * connaître les deux. Effacer un nom, c'est revenir au repli — un état normal,
 * pas une donnée manquante.
 */
export async function nommerEquipe(ctx: Ctx, rang: number, nom: string | null): Promise<EquipeEnregistree> {
  const rangBorne = Math.min(MAX_EQUIPES, Math.max(1, Math.trunc(rang)));
  const propre = nom?.trim() ? nom.trim() : null;

  return withEntreprise(ctx.utilisateurId, ctx.entrepriseId, async (tx) => {
    const [existante] = await tx
      .select({ id: equipes.id })
      .from(equipes)
      .where(and(eq(equipes.entrepriseId, ctx.entrepriseId), eq(equipes.rang, rangBorne)))
      .limit(1);

    if (existante) {
      const [maj] = await tx
        .update(equipes)
        .set({ nom: propre, updatedAt: new Date() })
        .where(and(eq(equipes.entrepriseId, ctx.entrepriseId), eq(equipes.rang, rangBorne)))
        .returning({ id: equipes.id, rang: equipes.rang, nom: equipes.nom });
      return maj;
    }

    const [creee] = await tx
      .insert(equipes)
      .values({ entrepriseId: ctx.entrepriseId, rang: rangBorne, nom: propre })
      .returning({ id: equipes.id, rang: equipes.rang, nom: equipes.nom });
    return creee;
  });
}

/**
 * L'équipe d'un rang donné, ou `null` si elle n'a jamais été nommée.
 *
 * Sert à la revalidation serveur : poser un chantier sur « l'équipe B » exige
 * de savoir laquelle c'est, et une ligne absente est un cas ordinaire — pas
 * une erreur.
 */
export async function equipeParRang(ctx: Ctx, rang: number): Promise<EquipeEnregistree | null> {
  return withEntreprise(ctx.utilisateurId, ctx.entrepriseId, async (tx) => {
    const [ligne] = await tx
      .select({ id: equipes.id, rang: equipes.rang, nom: equipes.nom })
      .from(equipes)
      .where(and(eq(equipes.entrepriseId, ctx.entrepriseId), eq(equipes.rang, Math.trunc(rang))))
      .limit(1);
    return ligne ?? null;
  });
}

/**
 * L'identifiant de l'équipe d'un rang, en la créant si elle n'existe pas.
 *
 * Appelée au moment de POSER un chantier, jamais à l'affichage : c'est le seul
 * instant où l'on a besoin d'une clé étrangère, et donc le seul où créer la
 * ligne se justifie. La créer plus tôt reviendrait à écrire en base une équipe
 * que personne n'a nommée ni employée.
 *
 * Le `nom` reste `null` : on enregistre qu'une équipe de rang N existe, pas
 * qu'elle s'appelle « Équipe B ».
 */
export async function assurerEquipeDeRang(ctx: Ctx, rang: number): Promise<string> {
  const existante = await equipeParRang(ctx, rang);
  if (existante) return existante.id;
  const creee = await nommerEquipe(ctx, rang, null);
  return creee.id;
}
