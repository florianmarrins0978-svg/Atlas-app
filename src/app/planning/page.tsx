import { getCurrentCtx } from "@/server/session-ctx";
import { listerChantiersPourPlanning } from "@/server/repositories/chantiers";
import { etatAgenda } from "@/server/repositories/agendas-externes";
import { HORIZON_OCCUPATION_PATRON_JOURS, ajouterJours } from "@/server/disponibilites";
import { getEntreprise } from "@/server/repositories/entreprises";
import { listerEquipes } from "@/server/repositories/equipes";
import { absencesSurLaFenetre } from "@/server/repositories/absences-equipe";
import { versJourIso } from "@/server/disponibilites";
import PlanningClient from "./PlanningClient";

export const dynamic = "force-dynamic";

export default async function PlanningPage() {
  const ctx = await getCurrentCtx();

  const maintenant = new Date();
  const [chantiers, entreprise, equipesNommees, agenda, absences] = await Promise.all([
    listerChantiersPourPlanning(ctx),
    getEntreprise(ctx),
    listerEquipes(ctx),
    etatAgenda(ctx),
    // **Sur la même fenêtre que le reste, et pour la même raison.** Une équipe
    // absente retire de la place ; si le planning l'ignorait, il montrerait un
    // jour libre que l'écran d'envoi refuserait — deux vérités sur la même
    // capacité, sur deux écrans qui se suivent (`CLAUDE.md` §3).
    absencesSurLaFenetre(
      ctx,
      versJourIso(maintenant),
      versJourIso(ajouterJours(maintenant, HORIZON_OCCUPATION_PATRON_JOURS))
    ),
  ]);

  return (
    <PlanningClient
      initialChantiers={chantiers}
      // Le compteur fait autorité sur le NOMBRE ; la table ne porte que des
      // noms (`ARCHITECTURE.md` §51). Les deux traversent : l'écran ne peut pas
      // décider d'un libellé sans les deux.
      nombreEquipes={entreprise?.nombreEquipes ?? 1}
      equipesNommees={equipesNommees.map((e) => ({ rang: e.rang, nom: e.nom }))}
      absences={absences}
      agenda={{ configure: agenda.configure, relie: agenda.relie, actif: agenda.actif, enPanne: Boolean(agenda.derniereErreur) }}
    />
  );
}
