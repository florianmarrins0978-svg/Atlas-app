import Link from "next/link";
import { colors, font, smallCaps } from "@/lib/design-tokens";
import { decrireEtatIA } from "@/lib/etat-ia";
import { getCurrentCtx } from "@/server/session-ctx";
import { getConfigIA } from "@/server/ai/config";
import { listerTarifs } from "@/server/repositories/tarifs";
import ReglagesClient from "./ReglagesClient";

export const dynamic = "force-dynamic";

export default async function ReglagesPage() {
  const ctx = await getCurrentCtx();
  const tarifs = await listerTarifs(ctx);

  // Seuls les NOMS des fournisseurs traversent jusqu'à l'écran — jamais les
  // clés, qui n'ont rien à faire dans du HTML rendu.
  const config = getConfigIA();
  const etatsIA = decrireEtatIA(config.transcriptionProvider, config.llmProvider);

  return (
    <div style={{ backgroundColor: colors.cream, color: colors.ink, fontFamily: font.body, minHeight: "100%" }}>
      <div className="pb-24">
        <div className="px-6 pt-8">
          <p className={smallCaps} style={{ color: colors.rust, marginBottom: 8 }}>
            Mon entreprise
          </p>
          <h1 className="text-[32px] leading-tight" style={{ fontFamily: font.display }}>
            Tarifs
          </h1>
        </div>

        <ReglagesClient
          initialTarifs={tarifs.map((t) => ({ id: t.id, intitule: t.intitule, prix: t.prix, unite: t.unite }))}
        />

        <div className="px-6 pt-8">
          <Link href="/catalogue" className="text-[14px] font-medium" style={{ color: colors.rust }}>
            Voir le catalogue des prestations et matériels →
          </Link>
        </div>

        {/*
          Qui écoute et qui rédige, dit à l'écran.

          Le patron a payé deux comptes, posé quatre clés, puis dicté — et
          l'application a continué à fabriquer ses réponses sans rien dire. Il a
          fallu qu'il pose la question pour l'apprendre. Un bloc que personne ne
          regarde tant que tout va bien, et qui répond en deux secondes le jour
          où l'on doute.
        */}
        <section className="px-6 pt-10">
          <p className={smallCaps} style={{ color: colors.rust, marginBottom: 8 }}>
            Intelligence artificielle
          </p>
          <h2 className="text-[22px] leading-tight" style={{ fontFamily: font.display, marginBottom: 12 }}>
            Ce que l&apos;application utilise
          </h2>

          <div className="flex flex-col gap-3">
            {etatsIA.map((etat) => (
              <div
                key={etat.role}
                className="rounded-xl p-4"
                style={{
                  backgroundColor: colors.card,
                  // Un liseré n'apparaît que si quelque chose ne fait pas ce
                  // qu'on croit : tout va bien doit rester discret.
                  borderLeft: etat.nature === "reel" ? "none" : `3px solid ${colors.rust}`,
                }}
              >
                <p className="text-[13px]" style={{ color: colors.muted, marginBottom: 2 }}>
                  {etat.role}
                </p>
                <p className="text-[15px] font-medium" style={{ color: colors.ink }}>
                  {etat.libelle}
                </p>
                <p className="text-[13px] leading-snug" style={{ color: colors.inkSoft, marginTop: 6 }}>
                  {etat.explication}
                </p>
              </div>
            ))}
          </div>

          <p className="text-[12px] leading-snug" style={{ color: colors.muted, marginTop: 10 }}>
            Se règle par les variables <code>TRANSCRIPTION_PROVIDER</code> et <code>LLM_PROVIDER</code>, jamais par la
            seule présence d&apos;une clé. Mode d&apos;emploi : <code>docs/ESSAYER.md</code>.
          </p>
        </section>
      </div>
    </div>
  );
}
