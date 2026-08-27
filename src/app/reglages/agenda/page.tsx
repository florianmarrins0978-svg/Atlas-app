import Link from "next/link";
import { colors, font, smallCaps } from "@/lib/design-tokens";
import { getCurrentCtx } from "@/server/session-ctx";
import { estProprietaire } from "@/server/autorisation";
import RubriqueReservee from "../RubriqueReservee";
import { etatAgenda } from "@/server/repositories/agendas-externes";
import { etatAgendaApple } from "@/server/repositories/agenda-apple";
import AgendaClient from "./AgendaClient";
import AgendaAppleClient from "./AgendaAppleClient";

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

  /**
   * **RÉSERVÉ AU PATRON — constat F8, 25 août 2026.**
   *
   * Cette page était la SEULE rubrique réservée au propriétaire à ne pas se
   * garder : dix autres le faisaient, celle-ci l'avait oublié. Un salarié qui
   * tapait l'adresse y lisait le compte d'agenda relié — l'identifiant iCloud ou
   * Google du patron — et son état de connexion.
   *
   * **Le lien était bien caché** (`rubriquesReglages` ne le rend qu'au patron),
   * et cela ne protégeait rien : une adresse se tape. Les ÉCRITURES, elles,
   * étaient déjà gardées par `exigerProprietaire` dans `actions.ts` — c'est la
   * lecture qui manquait.
   *
   * **Le refus est rendu AVANT toute lecture** : `etatAgenda` et
   * `etatAgendaApple` ne sont plus appelés du tout pour un salarié. Une garde
   * posée après aurait chargé la donnée avant de refuser de la montrer.
   */
  if (!(await estProprietaire(ctx))) {
    return (
      <RubriqueReservee
        titre="Intégrations"
        quoi="Le calendrier relié appartient au compte du patron."
      />
    );
  }

  const [etat, etatApple, params] = await Promise.all([
    etatAgenda(ctx),
    etatAgendaApple(ctx),
    searchParams,
  ]);

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

        {/*
          **Deux raccordements sur le même écran, et Google d'abord.** Ce n'est
          pas une préférence : le raccordement Google existait, et déplacer un
          écran qu'il connaît pour faire de la place au nouveau lui ferait
          chercher. iCloud vient donc dessous, avec son propre en-tête.
        */}
        <AgendaClient etat={etat} issue={params.issue ?? null} />
        <div className="mt-8 px-6">
          <div style={{ height: 1, backgroundColor: colors.line }} />
        </div>
        <AgendaAppleClient etat={etatApple} />
      </div>
    </div>
  );
}
