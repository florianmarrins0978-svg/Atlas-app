import { eq } from "drizzle-orm";
import { chantiers, creneauxChantier } from "../db/schema";
import { resumeDesCreneaux } from "../../lib/creneaux-chantier";
import type { Creneau } from "../../lib/disponibilites";
import type { withEntreprise } from "../db/with-entreprise";

type Tx = Parameters<Parameters<typeof withEntreprise>[2]>[0];

/**
 * OÙ LE CHANTIER EST POSÉ — le SEUL écrivain, et c'est tout l'intérêt.
 *
 * ───────────────────────────────────────────────────────────────────────────
 * **Pourquoi cette fonction a quitté `chantiers.ts`, le 10 septembre 2026.**
 *
 * Elle y était privée, et le lot qui l'a créée affirmait « un seul écrivain ».
 * C'était faux : `envois-devis.ts` pose lui aussi un chantier — quand le client
 * accepte une date — et il écrivait `date_planifiee` **sans** toucher aux
 * créneaux. Le chantier restait alors affiché à son ancienne place, et la date
 * choisie par le client n'apparaissait nulle part au planning.
 *
 * Deux écrivains pour une même vérité, c'est la divergence garantie que
 * `CLAUDE.md` §3 interdit. Ils partagent donc la même porte.
 * ───────────────────────────────────────────────────────────────────────────
 *
 * **Ce qu'elle n'écrit JAMAIS : `duree_demi_journees`.** C'est ce que le devis
 * a vendu ; l'écart entre cette durée et le nombre de créneaux est précisément
 * ce qui attend une place (`ARCHITECTURE.md` §322). Le réduire au passage
 * ferait disparaître la demi-journée rendue sans un mot.
 *
 * `date_planifiee` et `creneau_debut` sont **dérivées** du premier créneau :
 * une vingtaine d'endroits les lisent encore, et elles ne doivent jamais
 * raconter autre chose que la table.
 */
export async function ecrireLesCreneaux(
  tx: Tx,
  qui: { entrepriseId: string; utilisateurId?: string | null },
  chantierId: string,
  poses: readonly Creneau[]
) {
  await tx.delete(creneauxChantier).where(eq(creneauxChantier.chantierId, chantierId));
  if (poses.length > 0) {
    await tx.insert(creneauxChantier).values(
      poses.map((c) => ({
        entrepriseId: qui.entrepriseId,
        chantierId,
        jour: c.jour,
        demi: c.moment,
      }))
    );
  }
  const resume = resumeDesCreneaux(poses);
  await tx
    .update(chantiers)
    .set({
      datePlanifiee: resume.jour,
      creneauDebut: resume.moment,
      // **Personne, quand c'est le CLIENT qui pose.** Il répond depuis un lien
      // public, sans compte : écrire un `updated_by` reviendrait à attribuer
      // son geste à quelqu'un de l'entreprise.
      ...(qui.utilisateurId ? { updatedBy: qui.utilisateurId } : {}),
      updatedAt: new Date(),
    })
    .where(eq(chantiers.id, chantierId));
}
