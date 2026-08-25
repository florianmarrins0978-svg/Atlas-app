import { getCurrentCtx } from "@/server/session-ctx";
import { etatAgenda } from "@/server/repositories/agendas-externes";
import { contextePlanning } from "@/server/contexte-planning";
import { getRole } from "@/server/autorisation";
import PlanningClient from "./PlanningClient";

export const dynamic = "force-dynamic";

export default async function PlanningPage() {
  const ctx = await getCurrentCtx();

  const maintenant = new Date();
  // **Le même chargement que l'écran d'envoi**, depuis le 22 août 2026 : les
  // deux peignent la même journée, et deux chargements séparés finiraient par
  // ne plus lire les mêmes absences (`src/server/contexte-planning.ts`).
  const [contexte, agenda, role] = await Promise.all([
    contextePlanning(ctx, maintenant),
    etatAgenda(ctx),
    getRole(ctx),
  ]);

  return (
    <PlanningClient
      initialChantiers={contexte.chantiers}
      nombreEquipes={contexte.nombreEquipes}
      equipesNommees={contexte.equipesNommees}
      absences={contexte.absences}
      agenda={{ configure: agenda.configure, relie: agenda.relie, actif: agenda.actif, enPanne: Boolean(agenda.derniereErreur) }}
      // Le rôle décide des portes que l'écran propose — la fiche d'un chantier,
      // le raccordement de l'agenda. Ce qui REFUSE les adresses, c'est
      // `GardeAcces` ; ceci évite seulement de dessiner des portes closes.
      role={role}
    />
  );
}
