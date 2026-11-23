import { sql } from "drizzle-orm";
import { db } from "../db/client";

/**
 * UN ESSAI PAR ENTREPRISE, RECONNUE À SON SIREN — sa décision du 23 novembre
 * 2026 (migration 0195, `appli/soignee/essai-par-entreprise.html`).
 *
 * **Pas de `withEntreprise`, et c'est le but** : la question porte sur TOUTES
 * les entreprises (ce SIREN a-t-il déjà eu son essai ailleurs ?), ce qu'aucune
 * entreprise ne peut lire sous la RLS. Elle passe donc par deux fonctions de la
 * base, qui ne rendent qu'un oui ou un non : `atlas_app` n'a aucun droit sur la
 * table elle-même (le modèle de `verifier_mot_de_passe`, migration 0064).
 */
type Executant = Pick<typeof db, "execute">;

/** Vrai si l'essai revient à cette entreprise ; faux si une autre l'a eu. */
export async function prendreLEssaiDuSiren(executant: Executant, siren: string, entrepriseId: string): Promise<boolean> {
  const r = await executant.execute(sql`SELECT public.prendre_essai_du_siren(${siren}, ${entrepriseId}::uuid) AS accorde`);
  return (r.rows[0] as { accorde: boolean } | undefined)?.accorde !== false;
}

/** Avant que le compte existe : ce SIREN a-t-il déjà eu son essai ? Ne prend rien. */
export async function essaiDuSirenDejaPris(siren: string): Promise<boolean> {
  const r = await db.execute(sql`SELECT public.essai_du_siren_deja_pris(${siren}) AS pris`);
  return (r.rows[0] as { pris: boolean } | undefined)?.pris === true;
}
