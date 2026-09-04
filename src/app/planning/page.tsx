import { getCurrentCtx } from "@/server/session-ctx";
import { etatAgenda } from "@/server/repositories/agendas-externes";
import { contextePlanning } from "@/server/contexte-planning";
import { getRole } from "@/server/autorisation";
import { chantierDemandeAuPlanning } from "@/lib/lien-planning";
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
  const [contexte, agenda, role] = await Promise.all([
    contextePlanning(ctx, maintenant),
    etatAgenda(ctx),
    getRole(ctx),
  ]);

  return (
    <PlanningClient
      initialChantiers={contexte.chantiers}
      nombreEquipes={contexte.nombreEquipes}
      nombreSalaries={contexte.nombreSalaries}
      equipesNommees={contexte.equipesNommees}
      absences={contexte.absences}
      agenda={{ configure: agenda.configure, relie: agenda.relie, actif: agenda.actif, enPanne: Boolean(agenda.derniereErreur) }}
      // Le rôle décide des portes que l'écran propose — la fiche d'un chantier,
      // le raccordement de l'agenda. Ce qui REFUSE les adresses, c'est
      // `GardeAcces` ; ceci évite seulement de dessiner des portes closes.
      role={role}
      // Le chantier dont on vient : sa journée s'ouvre, et ses portes montent.
      chantierDemande={chantierDemande}
    />
  );
}
