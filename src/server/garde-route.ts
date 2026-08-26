import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { cheminAutorise } from "@/lib/acces-roles";
import { accesDeLaPersonne } from "./autorisation";
import { getCurrentCtx } from "./session-ctx";
import type { Ctx } from "./repositories/context";

/**
 * LA GARDE DES ROUTES D'API — celles que `GardeAcces` ne peut pas voir.
 *
 * **Pourquoi elle existe.** Une route d'API ne traverse aucune mise en page :
 * la garde posée dans `layout.tsx` ne la protège pas. Or c'est exactement par là
 * qu'un PDF de devis sort du serveur, prix compris. `docs/QUESTIONS.md` §10 :
 * *« Les montants ne doivent pas sortir du serveur pour qui n'a pas le droit de
 * les voir — ni dans la page, ni dans le PDF, ni dans une réponse d'API. »*
 *
 * **Le chemin n'est pas deviné : il est LU de la requête**, par l'en-tête que le
 * middleware pose sur chacune (`x-atlas-pathname`). Le déduire du nom du fichier
 * de route obligerait chaque route à se décrire elle-même, et une description
 * recopiée finit toujours par ne plus correspondre. Plusieurs handlers de ce
 * dépôt n'ont même pas leur `Request` sous la main — d'où l'en-tête plutôt que
 * `requete.url`, qui n'aurait pas pu servir partout.
 *
 * Rend `null` quand tout va bien ; rend la réponse à retourner sinon. Écrit
 * ainsi — et non en levant — pour que l'appel se lise en une ligne au début du
 * handler, et qu'un oubli se voie à la relecture :
 *
 *     const refus = await exigerOuverture(ctx);
 *     if (refus) return refus;
 *
 * **404, jamais 403.** Distinguer « vous n'avez pas le droit » de « cela
 * n'existe pas » dirait à un curieux qu'il a visé juste — c'est déjà la règle
 * des routes de ce dépôt (voir la feuille de chantier).
 */
export async function exigerOuverture(ctx?: Ctx): Promise<NextResponse | null> {
  const chemin = (await headers()).get("x-atlas-pathname");
  // Sans chemin, on ne sait pas de quoi on parle. **On refuse**, ici, à
  // l'inverse de `GardeAcces` : une route d'API sert une donnée, et un doute
  // sur une donnée se tranche du côté fermé.
  if (!chemin) return NextResponse.json({ error: "Introuvable" }, { status: 404 });

  const contexte = ctx ?? (await getCurrentCtx());
  const acces = await accesDeLaPersonne(contexte);

  if (acces && cheminAutorise(acces.role, chemin)) return null;

  return NextResponse.json({ error: "Introuvable" }, { status: 404 });
}
