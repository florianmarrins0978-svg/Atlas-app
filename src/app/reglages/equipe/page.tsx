import EnTeteEcran from "@/components/atlas/EnTeteEcran";
import { colors, font } from "@/lib/design-tokens";
import { getCurrentCtx } from "@/server/session-ctx";
import { estProprietaire } from "@/server/autorisation";
import { getEntreprise } from "@/server/repositories/entreprises";
import { listerEquipes } from "@/server/repositories/equipes";
import { equipesPourRattachement, listerAcces } from "@/server/repositories/membres-entreprise";
import { listerAbsencesEquipe } from "@/server/repositories/absences-equipe";
import { jourIso } from "@/lib/jour";
import RubriqueReservee from "../RubriqueReservee";
import VosEquipes from "../VosEquipes";
import QuiAAcces from "./QuiAAcces";
import AbsencesEquipe from "../AbsencesEquipe";

export const dynamic = "force-dynamic";

/**
 * « Équipe » — combien partent, et comment elles s'appellent.
 *
 * **Le patron, le 14 août 2026 :** *« les équipes n'apparaissent plus,
 * pourquoi ? Faut les rajouter dans la catégorie équipe aussi. »*
 *
 * **Ce qui s'était passé, et c'est moi qui l'ai fait :** le 14 août au matin,
 * l'écran des réglages est devenu un sommaire et le bloc des équipes est parti
 * dans « Planning » (`ARCHITECTURE.md` §96). Le raisonnement tenait — ici
 * « équipe » désigne une FILE DU PLANNING, pas un compte (§88) — mais il ne
 * tient plus devant l'usage : il les a cherchées sous « Équipe », et c'est là
 * qu'il faut qu'elles soient.
 *
 * **Le même écran est donc servi aux deux adresses**, et c'est le MÊME
 * composant — pas une copie. Deux listes d'équipes qui divergeraient seraient
 * deux vérités sur le nombre de chantiers qui partent le même jour, c'est-à-dire
 * sur ce que le planning propose (`CLAUDE.md` §3).
 *
 * **LES COMPTES SONT ICI DEPUIS LE 25 AOÛT 2026.** Cet en-tête disait le
 * contraire — « ce qui n'est PAS ici : les comptes, les rôles et les
 * permissions » —, et c'était vrai jusqu'à ce lot. Les deux listes cohabitent
 * désormais sur le même écran, dans cet ordre et sans se mélanger : « Qui a
 * accès » porte des COMPTES, « Vos équipes » porte des FILES DU PLANNING
 * (`docs/QUESTIONS.md` §10).
 */
export default async function EquipePage() {
  const ctx = await getCurrentCtx();
  if (!(await estProprietaire(ctx))) {
    return (
      <RubriqueReservee
        titre="Équipe"
        quoi="Le nombre d'équipes qui partent en même temps décide de tout le planning de l'entreprise."
      />
    );
  }

  const aujourdHui = jourIso(new Date());
  // Seulement ce qui n'est pas fini : une liste qui accumulerait deux ans de
  // déplacements passés ne se relirait plus.
  const [entreprise, equipes, absences, acces, equipesRattachables] = await Promise.all([
    getEntreprise(ctx),
    listerEquipes(ctx),
    listerAbsencesEquipe(ctx, aujourdHui),
    listerAcces(ctx),
    equipesPourRattachement(ctx),
  ]);

  return (
    <div style={{ backgroundColor: colors.cream, color: colors.ink, fontFamily: font.body, minHeight: "100%" }}>
      <div className="pb-24">
        <EnTeteEcran
          surtitre="Réglages"
          titre="Équipe"
          retour={{ href: "/reglages", libelle: "Retour aux réglages" }}
        />

        {/* **Les comptes d'abord, les files du planning ensuite.** Sur sa
            planche du 13 août, « Qui a accès » ouvre l'écran : c'est la question
            qu'on se pose en venant ici. Les équipes, elles, se règlent une fois
            pour toutes. */}
        <QuiAAcces
          acces={acces}
          moi={ctx.utilisateurId}
          equipes={equipesRattachables}
          nombreEquipes={entreprise?.nombreEquipes ?? 1}
        />

        <VosEquipes
          initialNombreEquipes={entreprise?.nombreEquipes ?? 1}
          initialNoms={equipes.map((e) => ({ rang: e.rang, nom: e.nom }))}
        />

        {/* **Sous les noms, comme il l'a retenu** (`docs/maquettes/55`,
            proposition A) : c'est là que vivent les équipes, et c'est là qu'on
            va quand on prépare la semaine. */}
        <AbsencesEquipe
          nombreEquipes={entreprise?.nombreEquipes ?? 1}
          noms={equipes.map((e) => ({ rang: e.rang, nom: e.nom }))}
          initialAbsences={absences.map((a) => ({
            id: a.id,
            rang: a.rang,
            nom: a.nom,
            premierJour: a.premierJour,
            dernierJour: a.dernierJour,
            motif: a.motif,
          }))}
          aujourdHui={aujourdHui}
        />

        {/* **Dire pourquoi le planning n'écrit rien à une seule équipe.** C'est
            sa propre règle du 10 août — *« s'il n'a pas d'équipe et qu'il ne met
            rien, il ne faut pas qu'il y ait quand même écrit équipe A équipe
            B »* — mais elle ressemble à une panne quand on l'a oubliée. Il a
            justement demandé le 14 août pourquoi les équipes « n'apparaissent
            plus » sur son planning. */}
        <p className="mx-[26px] mt-[30px] border-t pt-[18px] text-[12px] leading-[1.7]"
           style={{ borderColor: colors.line, color: colors.muted }}>
          À une seule équipe, le planning n&apos;écrit aucun nom : il n&apos;y a personne à
          distinguer. Les noms apparaissent à partir de deux.
        </p>

      </div>
    </div>
  );
}
