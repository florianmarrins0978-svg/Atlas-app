import EnTeteEcran from "./EnTeteEcran";
import PrimaryButton from "./PrimaryButton";
import { colors, font, texteSituation } from "@/lib/design-tokens";

/**
 * Ce qu'ouvre un écran de CRÉATION quand l'essai est terminé.
 *
 * Le serveur refuse de toute façon (`withEntreprise`, lecture seule) ; mais
 * laisser remplir un formulaire entier pour un refus au bout serait une panne
 * déguisée. La phrase est celle de l'accueil (`phraseLectureSeule`) — une
 * seule voix —, et le bouton mène au seul geste qui rouvre tout.
 */
export default function EcranLectureSeule({ titre, phrase }: { titre: string; phrase: string }) {
  return (
    <div style={{ backgroundColor: colors.cream, color: colors.ink, fontFamily: font.body, minHeight: "100%" }}>
      <EnTeteEcran titre={titre} retour={{ href: "/", libelle: "Retour à l'accueil" }} allure="commune" />
      <div className="mx-[26px] mt-8" data-atlas="ecran-lecture-seule">
        <p className={texteSituation} style={{ color: colors.inkSoft }}>
          {phrase}
        </p>
        <div className="mt-5">
          <PrimaryButton href="/reglages/abonnement" repere="lecture-seule-sabonner">
            Choisir une formule
          </PrimaryButton>
        </div>
      </div>
    </div>
  );
}
