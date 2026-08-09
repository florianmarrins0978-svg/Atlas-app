import Link from "next/link";
import { colors, font, smallCaps } from "@/lib/design-tokens";
import { getCurrentCtx } from "@/server/session-ctx";
import { etatAgenda } from "@/server/repositories/agendas-externes";
import AgendaClient from "./AgendaClient";

export const dynamic = "force-dynamic";

/**
 * « Mon agenda » — le seul écran où l'artisan décide de relier, ou non.
 *
 * **Sa demande, le 9 août 2026 :** *« ce qui serait bien, c'est que
 * l'utilisateur puisse, s'il le souhaite ou non, connecter son planning à son
 * agenda Google. »* Le « ou non » est la moitié qui compte : cet écran doit
 * pouvoir ne rien faire, et le dire clairement.
 */
export default async function AgendaPage({
  searchParams,
}: {
  searchParams: Promise<{ issue?: string }>;
}) {
  const ctx = await getCurrentCtx();
  const [etat, params] = await Promise.all([etatAgenda(ctx), searchParams]);

  return (
    <div style={{ backgroundColor: colors.cream, color: colors.ink, fontFamily: font.body, minHeight: "100%" }}>
      <div className="pb-24">
        <div className="px-6 pt-8">
          <Link
            href="/reglages"
            aria-label="Retour aux réglages"
            className="flex h-10 w-10 items-center justify-center rounded-full"
            style={{ backgroundColor: colors.rustTint }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={colors.rust} strokeWidth="2.4">
              <path d="M15 5l-7 7 7 7" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </Link>
        </div>

        <div className="px-6 pt-5">
          <p className={smallCaps} style={{ color: colors.rust, marginBottom: 8 }}>
            Mes disponibilités
          </p>
          <h1 className="text-[32px] leading-tight" style={{ fontFamily: font.display }}>
            Mon agenda
          </h1>
          <p className="mt-3 text-[14px] leading-snug" style={{ color: colors.muted }}>
            Atlas propose des dates à vos clients à partir de vos chantiers.{" "}
            <strong>Un rendez-vous noté ailleurs, il ne le voit pas</strong> — et il peut proposer ce jour-là.
          </p>
        </div>

        <AgendaClient etat={etat} issue={params.issue ?? null} />
      </div>
    </div>
  );
}
