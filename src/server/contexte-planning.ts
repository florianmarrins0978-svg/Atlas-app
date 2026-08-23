import { listerChantiersPourPlanning } from "@/server/repositories/chantiers";
import { getEntreprise } from "@/server/repositories/entreprises";
import { listerEquipes } from "@/server/repositories/equipes";
import { absencesSurLaFenetre } from "@/server/repositories/absences-equipe";
import { HORIZON_OCCUPATION_PATRON_JOURS, ajouterJours, versJourIso } from "@/server/disponibilites";
import type { Ctx } from "@/server/repositories/context";

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
  const [chantiers, entreprise, equipesNommees, absences] = await Promise.all([
    listerChantiersPourPlanning(ctx),
    getEntreprise(ctx),
    listerEquipes(ctx),
    absencesSurLaFenetre(
      ctx,
      versJourIso(maintenant),
      versJourIso(ajouterJours(maintenant, HORIZON_OCCUPATION_PATRON_JOURS))
    ),
  ]);

  return {
    chantiers,
    // Le compteur fait autorité sur le NOMBRE ; la table ne porte que des noms
    // (`ARCHITECTURE.md` §51). Les deux traversent : un écran ne peut pas
    // décider d'un libellé sans les deux.
    nombreEquipes: entreprise?.nombreEquipes ?? 1,
    equipesNommees: equipesNommees.map((e) => ({ rang: e.rang, nom: e.nom })),
    absences,
  };
}

export type ContextePlanning = Awaited<ReturnType<typeof contextePlanning>>;
