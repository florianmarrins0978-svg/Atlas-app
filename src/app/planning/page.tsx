import { getCurrentCtx } from "@/server/session-ctx";
import { listerChantiersPourPlanning } from "@/server/repositories/chantiers";
import { etatAgenda, periodesOccupeesExterieures } from "@/server/repositories/agendas-externes";
import { HORIZON_OCCUPATION_PATRON_JOURS, ajouterJours } from "@/server/disponibilites";
import { getEntreprise } from "@/server/repositories/entreprises";
import { listerEquipes } from "@/server/repositories/equipes";
import PlanningClient from "./PlanningClient";

export const dynamic = "force-dynamic";

export default async function PlanningPage() {
  const ctx = await getCurrentCtx();

  const maintenant = new Date();
  const [chantiers, entreprise, equipesNommees, agenda, periodes] = await Promise.all([
    listerChantiersPourPlanning(ctx),
    getEntreprise(ctx),
    listerEquipes(ctx),
    etatAgenda(ctx),
    // **Sur la même fenêtre que ses journées barrées — douze mois.** Une autre
    // fenêtre afficherait des rendez-vous là où le calendrier ne barre rien, ou
    // l'inverse : deux vues du même agenda qui se contredisent sur le même
    // écran. Rend une liste vide quand rien n'est relié, sans appel réseau.
    periodesOccupeesExterieures(
      ctx,
      maintenant,
      ajouterJours(maintenant, HORIZON_OCCUPATION_PATRON_JOURS)
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
      agenda={{ configure: agenda.configure, relie: agenda.relie, actif: agenda.actif, enPanne: Boolean(agenda.derniereErreur) }}
      // **Seuls la date et l'intitulé traversent, jamais l'objet complet.**
      // Ce qui arrive dans un composant client arrive dans le navigateur : y
      // envoyer plus que ce qui s'affiche, c'est publier plus que ce qu'on
      // montre. Ici tout va au patron, mais la règle vaut d'être tenue partout
      // — c'est celle qui protège la page du client (`docs/AGENT.md` §2.2 bis).
      rendezVous={periodes.map((p) => ({
        debut: p.debut.toISOString(),
        fin: p.fin.toISOString(),
        intitule: p.intitule ?? null,
        journeeEntiere: Boolean(p.journeeEntiere),
      }))}
    />
  );
}
