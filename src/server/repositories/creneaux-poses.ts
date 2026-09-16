import { and, eq, isNotNull } from "drizzle-orm";
import { chantiers, creneauxChantier, equipesDuChantier } from "../db/schema";
import { creneauxOccupes, resumeDesCreneaux } from "../../lib/creneaux-chantier";
import { reporterEquipes, type LigneEquipe } from "../../lib/equipes-par-jour";
import type { Creneau, Moment } from "../../lib/disponibilites";
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
  // **Où il était AVANT** — pour que ses équipes datées le suivent (0093).
  // Un chantier jamais morcelé n'a aucune ligne et vaut son bloc : c'est le
  // repli de `creneauxOccupes`, le même que partout ailleurs.
  const [pose] = await tx
    .select({
      jour: chantiers.datePlanifiee,
      moment: chantiers.creneauDebut,
      dureeDemiJournees: chantiers.dureeDemiJournees,
    })
    .from(chantiers)
    .where(eq(chantiers.id, chantierId))
    .limit(1);
  const anciens = await tx
    .select({ jour: creneauxChantier.jour, demi: creneauxChantier.demi })
    .from(creneauxChantier)
    .where(eq(creneauxChantier.chantierId, chantierId));
  const avant = pose
    ? creneauxOccupes(
        pose,
        anciens.map((l) => ({ jour: l.jour, moment: l.demi }) as Creneau)
      )
    : [];

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

  await reporterLesEquipes(tx, qui.entrepriseId, chantierId, avant, poses);
}

/**
 * QUAND LE CHANTIER BOUGE, SES ÉQUIPES DATÉES LE SUIVENT — migration 0093.
 *
 * Depuis le 15 septembre 2026 une affectation peut porter un jour (« Julien à
 * partir du 4e jour »). Un chantier reposé une autre semaine emmènerait sinon
 * des lignes datées de la semaine d'avant : personne dessus au planning, et
 * Julien annoncé sur des jours où le chantier n'est plus. La règle — mêmes
 * jours : rien ; d'autres jours : le 4e reste le 4e ; plus de jours : repli en
 * lignes sans jour — vit dans `reporterEquipes`, pas ici.
 *
 * **Appelée par le seul écrivain des créneaux**, et par `deplanifierChantier`
 * qui les efface sans passer par lui.
 */
export async function reporterLesEquipes(
  tx: Tx,
  entrepriseId: string,
  chantierId: string,
  avant: readonly Creneau[],
  apres: readonly Creneau[]
) {
  const lignes = await tx
    .select({
      id: equipesDuChantier.id,
      jour: equipesDuChantier.jour,
      demi: equipesDuChantier.demi,
      equipeId: equipesDuChantier.equipeId,
    })
    .from(equipesDuChantier)
    .where(
      and(eq(equipesDuChantier.entrepriseId, entrepriseId), eq(equipesDuChantier.chantierId, chantierId))
    );
  const plates: LigneEquipe<string>[] = lignes.map((l) => ({
    jour: l.jour,
    demi: l.demi as Moment,
    equipe: l.equipeId,
  }));
  const reportees = reporterEquipes(plates, avant, apres);
  if (reportees === null) return;

  await tx
    .delete(equipesDuChantier)
    .where(
      and(
        eq(equipesDuChantier.entrepriseId, entrepriseId),
        eq(equipesDuChantier.chantierId, chantierId),
        isNotNull(equipesDuChantier.jour)
      )
    );
  if (reportees.length > 0) {
    await tx.insert(equipesDuChantier).values(
      reportees.map((l) => ({
        entrepriseId,
        chantierId,
        jour: l.jour,
        demi: l.demi,
        equipeId: l.equipe,
      }))
    );
  }
}
