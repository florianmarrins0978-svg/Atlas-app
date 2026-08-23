import { getEntreprise } from "./repositories/entreprises";
import { releveTvaCollectee } from "./repositories/factures";
import { totalTvaDeductible } from "./repositories/achats-tva";
import { libellePeriode, periodeCourante, PERIODICITE_TVA_PAR_DEFAUT } from "./periode-tva";
import { tvaDue } from "@/lib/achat-tva";
import type { Ctx } from "./repositories/context";

/**
 * Ce qu'il reste à payer de TVA sur la période en cours — pour l'annoncer
 * ailleurs que sur l'écran du relevé.
 *
 * ───────────────────────────────────────────────────────────────────────────
 * **Le patron, le 23 août 2026 :** *« je trouve que l'outil Ma TVA à déclarer,
 * il est caché, on ne le voit pas trop »* — il vivait tout en bas de
 * « Terminés », après la liste entière. Trois places lui ont été dessinées
 * (`docs/maquettes/86-ou-mettre-ma-tva.html`) ; il a retenu **la B** : une
 * carte, en tête, **portant le montant**.
 *
 * **Pourquoi cette lecture vit ici et non dans l'écran.** L'écran du relevé
 * compose déjà ces trois chiffres — collectée, déductible, reste. Les
 * recomposer dans « Terminés » aurait donné deux additions de la même somme,
 * et c'est LUI qui aurait vu deux montants différents à deux écrans
 * d'intervalle, sans savoir lequel croire (`CLAUDE.md` §3).
 *
 * ── CE QUE CETTE LECTURE COÛTE, ET QU'IL FAUT ASSUMER ───────────────────────
 *
 * Trois requêtes de plus sur un écran qu'il ouvre souvent : l'entreprise (pour
 * son rythme), les factures de la période, ses achats. C'est le prix de la
 * proposition B, dit devant la planche avant qu'il ne choisisse.
 *
 * ── ET LA RÉSERVE QUE L'ÉCRAN DOIT PORTER ──────────────────────────────────
 *
 * Ce montant **n'est pas dû le jour où il le lit**. Il dépend du rythme (mois
 * ou trimestre) et du régime (encaissements ou débits), et il n'est exigible
 * qu'à l'échéance de la période. Affiché seul, il se lirait comme « ce que je
 * dois aujourd'hui ». C'est pourquoi la carte nomme sa période et porte
 * « Reste à payer » — et non « À payer ».
 */
export type TvaCourante = {
  /** « Août 2026 », ou « 3e trimestre 2026 » selon son rythme. */
  periode: string;
  /** Collectée moins déductible, jamais négatif (voir `tvaDue`). */
  reste: number;
};

export async function tvaDeLaPeriodeCourante(ctx: Ctx): Promise<TvaCourante> {
  const entreprise = await getEntreprise(ctx);
  const periodicite = entreprise?.periodiciteTva ?? PERIODICITE_TVA_PAR_DEFAUT;
  const periode = periodeCourante(periodicite);

  const [releve, deductible] = await Promise.all([
    releveTvaCollectee(ctx, periode.debut, periode.fin),
    totalTvaDeductible(ctx, periode.debut, periode.fin),
  ]);

  return {
    periode: libellePeriode(periode),
    reste: tvaDue(Number(releve.totalTva), deductible),
  };
}
