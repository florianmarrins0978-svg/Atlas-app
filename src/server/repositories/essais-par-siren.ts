import { sql } from "drizzle-orm";
import { db } from "../db/client";

/**
 * UN ESSAI PAR ENTREPRISE, RECONNUE À SON SIREN — sa décision du 23 novembre
 * 2026 (migration 0195, `appli/soignee/essai-par-entreprise.html`).
 *
 * **Pas de `withEntreprise`, et c'est le but** : la question porte sur TOUTES
 * les entreprises (ce SIREN a-t-il déjà eu son essai ailleurs ?), ce qu'aucune
 * entreprise ne peut lire sous la RLS. Elle passe donc par deux fonctions de la
 * base, qui ne rendent qu'un mot : `atlas_app` n'a aucun droit sur la
 * table elle-même (le modèle de `verifier_mot_de_passe`, migration 0064).
 */
type Executant = Pick<typeof db, "execute">;

/** Vrai si l'essai revient à cette entreprise ; faux si une autre l'a eu. */
export async function prendreLEssaiDuSiren(executant: Executant, siren: string, entrepriseId: string): Promise<boolean> {
  const r = await executant.execute(sql`SELECT public.prendre_essai_du_siren(${siren}, ${entrepriseId}::uuid) AS accorde`);
  return (r.rows[0] as { accorde: boolean } | undefined)?.accorde !== false;
}

/**
 * Avant que le compte existe : ce SIREN a-t-il déjà eu son essai, et son
 * compte est-il encore là ? Ne prend rien. `compte` et `essai` disent les deux
 * phrases de sa planche ; `libre`, rien.
 */
export type EtatDuSiren = "libre" | "compte" | "essai";
export async function etatDeLEssaiDuSiren(siren: string): Promise<EtatDuSiren> {
  const r = await db.execute(sql`SELECT public.etat_de_l_essai_du_siren(${siren}) AS etat`);
  const etat = (r.rows[0] as { etat: string } | undefined)?.etat;
  return etat === "compte" || etat === "essai" ? etat : "libre";
}
