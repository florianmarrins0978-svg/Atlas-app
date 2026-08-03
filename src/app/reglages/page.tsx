import Link from "next/link";
import { colors, font, smallCaps } from "@/lib/design-tokens";
import { getCurrentCtx } from "@/server/session-ctx";
import { listerTarifs } from "@/server/repositories/tarifs";
import { getEntreprise } from "@/server/repositories/entreprises";
import ReglagesClient from "./ReglagesClient";

export const dynamic = "force-dynamic";

export default async function ReglagesPage() {
  const ctx = await getCurrentCtx();
  const [tarifs, entreprise] = await Promise.all([listerTarifs(ctx), getEntreprise(ctx)]);

  return (
    <div style={{ backgroundColor: colors.cream, color: colors.ink, fontFamily: font.body, minHeight: "100%" }}>
      <div className="pb-24">
        <div className="px-6 pt-8">
          <p className={smallCaps} style={{ color: colors.rust, marginBottom: 8 }}>
            Mon entreprise
          </p>
          <h1 className="text-[32px] leading-tight" style={{ fontFamily: font.display }}>
            Réglages
          </h1>
        </div>

        <ReglagesClient
          initialTarifs={tarifs.map((t) => ({ id: t.id, intitule: t.intitule, prix: t.prix, unite: t.unite }))}
          initialNombreEquipes={entreprise?.nombreEquipes ?? 1}
        />

        <div className="px-6 pt-8">
          <Link href="/catalogue" className="text-[14px] font-medium" style={{ color: colors.rust }}>
            Voir le catalogue des prestations et matériels →
          </Link>
        </div>
      </div>
    </div>
  );
}
