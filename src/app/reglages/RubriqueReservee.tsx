import EnTeteEcran from "@/components/atlas/EnTeteEcran";
import PastilleIcone from "@/components/atlas/reglages/PastilleIcone";
import Picto from "@/components/atlas/reglages/Picto";
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
      <EnTeteEcran titre={titre} retour={{ href: "/reglages", libelle: "Retour aux réglages" }} allure="soignee" />
      {/* Une plage et un cadenas bleu (planches des Réglages soignés,
          26 octobre 2026) : le bleu informe, il ne refuse pas. La phrase en
          gris de 13 px se lisait comme une note de bas de page, alors qu'elle
          est tout l'écran. */}
      <div
        className="mx-[22px] mt-7 flex items-start gap-[14px] rounded-[6px] px-[18px] py-[18px]"
        style={{ backgroundColor: colors.card }}
      >
        <PastilleIcone ton="bleu">
          <Picto nom="cadenas" taille={22} />
        </PastilleIcone>
        <p className="mt-0.5 text-[16px] leading-[1.5]" style={{ color: colors.ink }}>
          {/* `{" "}` explicite : écrite « {quoi} Ces réglages », la phrase sortait
              collée — « …compte salarié.Ces réglages… ». JSX ne garde pas
              l'espace entre une expression et le texte qui la suit. Vu sur une
              capture le 14 août 2026, par aucun test (`CLAUDE.md` §5). */}
          {quoi}
          {" "}
          Ces réglages appartiennent au patron de l&apos;entreprise.
        </p>
      </div>
    </div>
  );
}
