import EnTeteEcran from "@/components/atlas/EnTeteEcran";
import { colors, font } from "@/lib/design-tokens";
import { getCurrentCtx } from "@/server/session-ctx";
import { estProprietaire } from "@/server/autorisation";
import { getEntreprise } from "@/server/repositories/entreprises";
import { listerEquipes } from "@/server/repositories/equipes";
import { equipesPourRattachement, listerAcces } from "@/server/repositories/membres-entreprise";
import { listerAbsencesEquipe } from "@/server/repositories/absences-equipe";
import { etatAgenda } from "@/server/repositories/agendas-externes";
import { etatAgendaApple } from "@/server/repositories/agenda-apple";
import { jourIso } from "@/lib/jour";
import RubriqueReservee from "../RubriqueReservee";
import VosEquipes from "../VosEquipes";
import VosSalaries from "../VosSalaries";
import QuiAAcces from "./QuiAAcces";
import FinDeChantierReglage from "./FinDeChantierReglage";
import AbsencesEquipe from "../AbsencesEquipe";
import FonctionReservee from "@/components/atlas/FonctionReservee";
import { abonnementDeLEntreprise } from "@/server/repositories/abonnements";
import { fonctionOuverte } from "@/lib/abonnements";

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
  const [entreprise, equipes, absences, acces, equipesRattachables, google, apple, abonnement] =
    await Promise.all([
      getEntreprise(ctx),
      listerEquipes(ctx),
      listerAbsencesEquipe(ctx, aujourdHui),
      listerAcces(ctx),
      equipesPourRattachement(ctx),
      // **L'état RÉEL des deux raccordements, lu ici.** La phrase du bas
      // promettait « Atlas en tient compte » sans rien savoir : sans agenda
      // relié et actif, `periodesOccupeesPourEntreprise` rend une liste vide,
      // et des congés posés dans Google ne bloquaient rien du tout. Ce sont les
      // deux lectures que le calcul de disponibilité emploie lui-même — pas
      // leurs sosies (`CLAUDE.md` §3).
      etatAgenda(ctx),
      etatAgendaApple(ctx),
      abonnementDeLEntreprise(ctx),
    ]);
  // Les absences et les retours sont un plus d'« Entreprise » (10 septembre
  // 2026). La règle est dans `fonctionOuverte` ; sans abonnement, tout est ouvert.
  const absencesOuvertes = fonctionOuverte(abonnement?.formule, "absences");
  const retoursOuverts = fonctionOuverte(abonnement?.formule, "retours");

  const agendaRelie = (google.relie && google.actif) || (apple.relie && apple.actif);

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
          nombreSalaries={entreprise?.nombreSalaries ?? 0}
        />

        {/* **Ce que le patron exige en fin de chantier — 8 septembre 2026.**
            Il vit ICI, sous « Qui a accès » : c’est le même écran que celui où
            il décide de ce que ses gens peuvent faire, et cette exigence-là en
            est une. */}
        {/* Sans les retours, ce réglage ne commande plus rien : ce qu'il ne
            peut plus lire, on ne le fait pas réclamer à ses gars
            (`retour-actions.ts`, `reglesDuRetour`). */}
        {retoursOuverts && (
          <FinDeChantierReglage
            initialDemande={entreprise?.retourDemande ?? false}
            initialPhotoExigee={entreprise?.retourPhotoExigee ?? false}
          />
        )}

        <VosEquipes initialNombreEquipes={entreprise?.nombreEquipes ?? 1} />

        {/* **Les gens sous la capacité, et séparés d'elle** — sa demande du
            26 août 2026. Le compteur du dessus dit combien de chantiers
            tiennent dans une journée ; celui-ci dit qui part. Les mêler dans un
            seul bloc remettrait sous ses yeux la confusion qu'on vient de
            retirer du code. */}
        <VosSalaries
          initialNombreSalaries={entreprise?.nombreSalaries ?? 0}
          initialNoms={equipes.map((e) => ({ rang: e.rang, nom: e.nom }))}
        />

        {/* **Sous les noms, comme il l'a retenu** (`docs/maquettes/55`,
            proposition A) : c'est là que vivent les équipes, et c'est là qu'on
            va quand on prépare la semaine. */}
        {/* À sa place, jamais retirée : une rubrique qui disparaît se cherche.
            Ses absences déjà saisies ne s'effacent pas — elles reparaissent
            s'il monte de formule. */}
        {absencesOuvertes ? (
          <AbsencesEquipe
            nombreSalaries={entreprise?.nombreSalaries ?? 0}
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
            agendaRelie={agendaRelie}
          />
        ) : (
          <FonctionReservee fonction="absences" />
        )}

        {/* **RETIRÉ le 26 août 2026 : la phrase qui expliquait pourquoi le
            planning n'écrivait rien à une seule équipe.** Elle disait vrai tant
            qu'un seul compteur portait les deux métiers ; elle est devenue
            fausse en même temps que la coupure — et une phrase périmée sur un
            écran est pire qu'absente, on s'y fie encore. Ce qu'elle apprenait
            est désormais SOUS le compteur des salariés, là où il le lit
            (`phraseDesSalaries`), et sa consigne du 25 août vaut ici : « le
            moins de mots possible ». */}

      </div>
    </div>
  );
}
