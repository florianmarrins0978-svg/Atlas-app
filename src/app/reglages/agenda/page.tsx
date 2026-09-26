import EnTeteEcran from "@/components/atlas/EnTeteEcran";
import { colors, font } from "@/lib/design-tokens";
import { getCurrentCtx } from "@/server/session-ctx";
import { estProprietaire } from "@/server/autorisation";
import RubriqueReservee from "../RubriqueReservee";
import { etatAgenda } from "@/server/repositories/agendas-externes";
import { etatAgendaApple } from "@/server/repositories/agenda-apple";
import MonAgendaClient from "./MonAgendaClient";

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
        titre="Mon agenda"
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
        {/* **L'EN-TÊTE COMMUNE DEPUIS LE 6 SEPTEMBRE 2026** (`ARCHITECTURE.md`
            §263). Cet écran se dessinait le sien — titre à 32 px au lieu de 36,
            surtitre doré AU-DESSUS du titre alors qu'il a demandé l'inverse le
            26 août, et **aucun bouton d'assistant**. Le recours manquait donc
            précisément sur l'écran le plus difficile des Réglages, celui qui
            demande d'aller générer un mot de passe chez Apple.

            **Le surtitre disait « Mes disponibilités ».** Il ne dit plus que
            « Réglages », parce que la grammaire de ce mot est « d'où l'on
            vient » et non « de quoi ça parle » — c'est ce qui permet de savoir
            où la flèche ramène sans l'essayer. */}
        <EnTeteEcran
          surtitre="Réglages"
          titre="Mon agenda"
          retour={{ href: "/reglages", libelle: "Retour aux réglages" }}
        />

        {/* **Plus de phrase d'explication, plus de titre d'état** : sa demande
            du 26 septembre 2026, « trop de mots ». Google d'abord, iCloud
            dessous, comme avant : il reconnaît son écran à la place des choses. */}
        <MonAgendaClient google={etat} apple={etatApple} issue={params.issue ?? null} />
      </div>
    </div>
  );
}
