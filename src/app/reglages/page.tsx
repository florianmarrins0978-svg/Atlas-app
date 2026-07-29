import ScreenHeader from "@/components/ScreenHeader";
import Link from "next/link";
import { getCurrentCtx } from "@/server/session-ctx";
import { listerTarifs } from "@/server/repositories/tarifs";
import ReglagesClient from "./ReglagesClient";

export const dynamic = "force-dynamic";

export default async function ReglagesPage() {
  const ctx = await getCurrentCtx();
  const tarifs = await listerTarifs(ctx);

  return (
    <div>
      <ScreenHeader title="Tarifs" />
      <ReglagesClient initialTarifs={tarifs.map((t) => ({ id: t.id, intitule: t.intitule, prix: t.prix }))} />
      <div className="px-4 pb-4">
        <Link href="/catalogue" className="text-xs text-ink/50 underline">
          Voir le catalogue des prestations et matériels →
        </Link>
      </div>
    </div>
  );
}
