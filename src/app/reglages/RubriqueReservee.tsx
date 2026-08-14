import EnTeteEcran from "@/components/atlas/EnTeteEcran";
import { colors, font } from "@/lib/design-tokens";

/**
 * Ce qu'un membre voit s'il tape l'adresse d'une rubrique de l'entreprise.
 *
 * **Une rubrique absente du sommaire ne suffit pas** : une adresse se tape, se
 * garde en favori, se retrouve dans un historique. `docs/QUESTIONS.md` §10 a
 * tranché le 7 août 2026 que masquer ne protège rien — la page ne lit donc
 * AUCUNE valeur avant d'avoir vérifié le rôle, et c'est l'ordre des lignes dans
 * chaque page qui le garantit, pas cette pièce-ci.
 *
 * **Elle explique plutôt qu'elle ne refuse.** « Accès interdit » laisse croire à
 * une panne ou à un compte mal réglé, et le salarié va demander au patron de
 * lui « ouvrir les droits ». Dire à qui cela appartient clôt la question.
 */
export default function RubriqueReservee({ titre, quoi }: { titre: string; quoi: string }) {
  return (
    <div style={{ backgroundColor: colors.cream, color: colors.ink, fontFamily: font.body, minHeight: "100%" }}>
      <EnTeteEcran
        surtitre="Réglages"
        titre={titre}
        retour={{ href: "/reglages", libelle: "Retour aux réglages" }}
      />
      <p className="mx-[26px] mt-8 text-[13px] leading-[1.7]" style={{ color: colors.muted }}>
        {/* `{" "}` explicite : écrite « {quoi} Ces réglages », la phrase sortait
            collée — « …compte salarié.Ces réglages… ». JSX ne garde pas
            l'espace entre une expression et le texte qui la suit. Vu sur une
            capture le 14 août 2026, par aucun test (`CLAUDE.md` §5). */}
        {quoi}
        {" "}
        Ces réglages appartiennent au patron de l&apos;entreprise.
      </p>
    </div>
  );
}
