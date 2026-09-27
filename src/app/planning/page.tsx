import { getCurrentCtx } from "@/server/session-ctx";
import { etatAgenda, rappelAgendaMasque } from "@/server/repositories/agendas-externes";
import { etatAgendaApple } from "@/server/repositories/agenda-apple";
import { bandeauAgendaDuPlanning } from "@/lib/agenda-externe";
import { contextePlanning } from "@/server/contexte-planning";
import { getRole } from "@/server/autorisation";
import { chantierDemandeAuPlanning } from "@/lib/lien-planning";
import { reglesDuRetour } from "@/server/regles-du-retour";
import { chantiersAvecRetourDuJour } from "@/server/repositories/retours-intervention";
import { peutPoserUnRetour } from "@/lib/acces-roles";
import { datesDuMoisPourLePlanning } from "@/server/repositories/dates-du-mois";
import { peutModifierLePlanning } from "@/lib/acces-roles";
import { jourIso } from "@/lib/jour";
import { originePublique } from "@/server/origine-publique";
import { headers } from "next/headers";
import PlanningClient from "./PlanningClient";

export const dynamic = "force-dynamic";

/**
 * **`?chantier=<id>` OUVRE LE PLANNING SUR SA JOURNÉE** — sa réponse du
 * 4 septembre 2026 (« sa journée »), et c'est ce qui permet à la fiche du
 * chantier de partir (`ARCHITECTURE.md` §254).
 *
 * **Il se lit ICI, au serveur, et non par `useSearchParams`** : cet écran est
 * un composant client, et l'y lire l'aurait enveloppé d'un `Suspense` pour un
 * paramètre que la page a déjà sous la main.
 */
export default async function PlanningPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const ctx = await getCurrentCtx();
  const chantierDemande = chantierDemandeAuPlanning((await searchParams).chantier);

  const maintenant = new Date();
  // **Le même chargement que l'écran d'envoi**, depuis le 22 août 2026 : les
  // deux peignent la même journée, et deux chargements séparés finiraient par
  // ne plus lire les mêmes absences (`src/server/contexte-planning.ts`).
  const [contexte, google, apple, masque, role, regles, envoyes] = await Promise.all([
    contextePlanning(ctx, maintenant),
    etatAgenda(ctx),
    etatAgendaApple(ctx),
    rappelAgendaMasque(ctx),
    getRole(ctx),
    reglesDuRetour(ctx),
    chantiersAvecRetourDuJour(ctx, maintenant),
  ]);
  // Les dates du mois des contrats ne s'envoient que par qui pose le planning :
  // pour les autres, rien ne descend (ni les numéros ni les adresses des
  // clients sous contrat).
  const datesDuMois =
    role && peutModifierLePlanning(role) ? await datesDuMoisPourLePlanning(ctx, jourIso(maintenant)) : null;

  return (
    <PlanningClient
      initialChantiers={contexte.chantiers}
      nombreEquipes={contexte.nombreEquipes}
      nombreSalaries={contexte.nombreSalaries}
      equipesNommees={contexte.equipesNommees}
      absences={contexte.absences}
      bandeauAgenda={bandeauAgendaDuPlanning([google, apple], masque)}
      // Le rôle décide des portes que l'écran propose — la fiche d'un chantier,
      // le raccordement de l'agenda. Ce qui REFUSE les adresses, c'est
      // `GardeAcces` ; ceci évite seulement de dessiner des portes closes.
      role={role}
      // Le chantier dont on vient : sa journée s'ouvre, et ses portes montent.
      chantierDemande={chantierDemande}
      // « Retour à envoyer » : le réglage allumé, et une personne qui peut
      // poser un retour. Sans elle, le rappel lui demanderait un geste qu'elle
      // n'a pas.
      retourDuJour={{ demande: regles.demande && role !== null && peutPoserUnRetour(role), envoyes }}
      // L'envoi des dates du mois d'un contrat (planche 130), et l'adresse que
      // le lien portera chez le client.
      datesDuMois={datesDuMois ? { ...datesDuMois, origine: originePublique(await headers()) } : null}
    />
  );
}
