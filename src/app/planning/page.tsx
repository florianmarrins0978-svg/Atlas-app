import { getCurrentCtx } from "@/server/session-ctx";
import { etatAgenda } from "@/server/repositories/agendas-externes";
import { contextePlanning } from "@/server/contexte-planning";
import PlanningClient from "./PlanningClient";

export const dynamic = "force-dynamic";

export default async function PlanningPage() {
  const ctx = await getCurrentCtx();

  const maintenant = new Date();
  // **Le même chargement que l'écran d'envoi**, depuis le 22 août 2026 : les
  // deux peignent la même journée, et deux chargements séparés finiraient par
  // ne plus lire les mêmes absences (`src/server/contexte-planning.ts`).
  const [contexte, agenda] = await Promise.all([contextePlanning(ctx, maintenant), etatAgenda(ctx)]);

  return (
    <PlanningClient
      initialChantiers={contexte.chantiers}
      nombreEquipes={contexte.nombreEquipes}
      equipesNommees={contexte.equipesNommees}
      absences={contexte.absences}
      agenda={{ configure: agenda.configure, relie: agenda.relie, actif: agenda.actif, enPanne: Boolean(agenda.derniereErreur) }}
    />
  );
}
