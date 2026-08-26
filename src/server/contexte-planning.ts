import { chantiersDeLEquipe, listerChantiersPourPlanning } from "@/server/repositories/chantiers";
import { getEntreprise } from "@/server/repositories/entreprises";
import { listerEquipes } from "@/server/repositories/equipes";
import { absencesSurLaFenetre } from "@/server/repositories/absences-equipe";
import { HORIZON_OCCUPATION_PATRON_JOURS, ajouterJours, versJourIso } from "@/server/disponibilites";
import type { Ctx } from "@/server/repositories/context";
import { accesDeLaPersonne } from "@/server/autorisation";

/**
 * TOUT CE QU'IL FAUT POUR PEINDRE UNE JOURNÉE — chargé une seule fois, servi
 * à deux écrans.
 *
 * ───────────────────────────────────────────────────────────────────────────
 * **Pourquoi cette fonction existe.** Depuis le 22 août 2026, l'écran d'envoi
 * montre le MÊME calendrier que le planning quand le patron choisit une date à
 * proposer — sa demande, validée sur planche 91 : *« on devrait avoir le visuel
 * du calendrier qui se trouve dans la catégorie planning, avec la possibilité
 * de cliquer sur les jours pour voir quels chantiers y sont déjà affectés »*.
 *
 * Les deux écrans ont donc besoin des mêmes quatre choses : les chantiers
 * datés, le nombre d'équipes, leurs noms, et les absences sur la fenêtre. Les
 * charger séparément aurait été le début de la divergence — un écran lisant les
 * absences et l'autre non, par exemple, ferait annoncer libre au premier une
 * journée que le second refuse. C'est le défaut que `CLAUDE.md` §3 nomme, et
 * il s'est déjà produit ici : voir le commentaire d'`absencesSurLaFenetre`
 * dans l'ancien chargement du planning.
 *
 * **La fenêtre est celle du PATRON** (douze mois), jamais celle du client. Les
 * deux horizons sont séparés à dessein (`docs/AGENT.md` §2.2 bis) : élargir
 * celui-ci n'ouvre pas le carnet de commandes.
 * ───────────────────────────────────────────────────────────────────────────
 */
export async function contextePlanning(ctx: Ctx, maintenant: Date) {
  const [chantiers, entreprise, equipesNommees, absences, acces] = await Promise.all([
    listerChantiersPourPlanning(ctx),
    getEntreprise(ctx),
    listerEquipes(ctx),
    absencesSurLaFenetre(
      ctx,
      versJourIso(maintenant),
      versJourIso(ajouterJours(maintenant, HORIZON_OCCUPATION_PATRON_JOURS))
    ),
    accesDeLaPersonne(ctx),
  ]);

  /**
   * **CE QU'IL VOIT DU PLANNING — et le tamis est posé ICI, au serveur.**
   *
   * Sa règle du 13 août 2026 : *« Accès à tout, mais le patron choisira s'il a
   * accès qu'à ses chantiers ou à tout. »* Un réglage par PERSONNE : deux
   * salariés peuvent ne pas voir le même planning.
   *
   * **Pourquoi dans le CHARGEMENT et pas à l'écran.** Filtrer au navigateur
   * laisserait la liste entière descendre : les noms de clients, les adresses et
   * les pense-bêtes de tous les chantiers seraient dans la page, sous les yeux
   * de qui sait regarder. C'est exactement ce que `docs/QUESTIONS.md` §10 refuse
   * pour les montants, et la raison vaut mot pour mot ici.
   *
   * **Une portée resserrée sans équipe rattachée ne montre RIEN**, jamais tout.
   * L'inverse rendrait le resserrement silencieusement inopérant, et le patron
   * croirait avoir restreint (migration 0065).
   */
  const chantiersVisibles =
    acces?.porteePlanning === "ses_equipes"
      ? await (async () => {
          if (!acces.equipeId) return [];
          const siens = await chantiersDeLEquipe(ctx, acces.equipeId);
          return chantiers.filter((c) => siens.has(c.id));
        })()
      : chantiers;

  return {
    chantiers: chantiersVisibles,
    // Le compteur fait autorité sur le NOMBRE ; la table ne porte que des noms
    // (`ARCHITECTURE.md` §51). Les deux traversent : un écran ne peut pas
    // décider d'un libellé sans les deux.
    nombreEquipes: entreprise?.nombreEquipes ?? 1,
    equipesNommees: equipesNommees.map((e) => ({ rang: e.rang, nom: e.nom })),
    absences,
  };
}

export type ContextePlanning = Awaited<ReturnType<typeof contextePlanning>>;
