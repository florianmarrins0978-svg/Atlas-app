import EnTeteEcran from "@/components/atlas/EnTeteEcran";
import { colors, font } from "@/lib/design-tokens";
import { getCurrentCtx } from "@/server/session-ctx";
import { estProprietaire } from "@/server/autorisation";
import { getEntreprise } from "@/server/repositories/entreprises";
import { listerEquipes } from "@/server/repositories/equipes";
import RubriqueReservee from "../RubriqueReservee";
import VosEquipes from "../VosEquipes";

export const dynamic = "force-dynamic";

/**
 * « Planning » — combien d'équipes partent en même temps, et comment on les
 * appelle.
 *
 * **Pourquoi les équipes atterrissent ICI et non dans « Équipe ».** Le mot est
 * pris deux fois dans Atlas, et c'est la confusion que la planche du 13 août
 * avait relevée (`ARCHITECTURE.md` §88) : une « équipe » au sens de cet écran
 * est une FILE DU PLANNING — une colonne de jours occupables —, pas un groupe
 * de comptes. Le nombre d'équipes décide de ce que le planning propose ; il n'a
 * rien à voir avec qui a le droit de se connecter.
 *
 * C'est aussi le libellé qu'il a écrit lui-même sur sa planche du 14 août :
 * « Planning — horaires, équipes et disponibilités ». La rubrique « Équipe »
 * lui reste réservée aux utilisateurs et aux rôles, qui ne sont pas codés.
 *
 * **Ce qui n'y est pas encore, et qu'il ne faut pas laisser croire :** les
 * horaires et les jours travaillés. Le titre les annonce parce que c'est son
 * mot ; le contenu ne les invente pas.
 */
export default async function PlanningReglagesPage() {
  const ctx = await getCurrentCtx();
  if (!(await estProprietaire(ctx))) {
    return (
      <RubriqueReservee
        titre="Planning"
        quoi="Le nombre d'équipes qui partent en même temps décide de tout le planning de l'entreprise."
      />
    );
  }

  const [entreprise, equipes] = await Promise.all([getEntreprise(ctx), listerEquipes(ctx)]);

  return (
    <div style={{ backgroundColor: colors.cream, color: colors.ink, fontFamily: font.body, minHeight: "100%" }}>
      <div className="pb-24">
        <EnTeteEcran
          surtitre="Réglages"
          titre="Planning"
          retour={{ href: "/reglages", libelle: "Retour aux réglages" }}
        />

        <VosEquipes
          initialNombreEquipes={entreprise?.nombreEquipes ?? 1}
          initialNoms={equipes.map((e) => ({ rang: e.rang, nom: e.nom }))}
        />

        {/* **Dire ce qui n'existe pas vaut mieux que de laisser chercher.** Le
            titre de la rubrique promet des horaires : sans cette phrase, il
            ferait défiler l'écran pour les trouver. */}
        <p className="mx-[26px] mt-[30px] border-t pt-[18px] text-[12px] leading-[1.7]"
           style={{ borderColor: colors.line, color: colors.muted }}>
          Les horaires et les jours travaillés ne se règlent pas encore : le planning
          raisonne en demi-journées, et chaque jour est libre ou porte le nom de son
          chantier.
        </p>
      </div>
    </div>
  );
}
