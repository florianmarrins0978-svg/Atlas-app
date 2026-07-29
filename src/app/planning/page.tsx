import { getCurrentCtx } from "@/server/session-ctx";
import { listerChantiersPourPlanning } from "@/server/repositories/chantiers";
import PlanningClient from "./PlanningClient";

export const dynamic = "force-dynamic";

export default async function PlanningPage() {
  const ctx = await getCurrentCtx();
  const chantiers = await listerChantiersPourPlanning(ctx);

  return <PlanningClient initialChantiers={chantiers} />;
}
