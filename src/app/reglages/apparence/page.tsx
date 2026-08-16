import EnTeteEcran from "@/components/atlas/EnTeteEcran";
import { colors, font } from "@/lib/design-tokens";
import { getCurrentCtx } from "@/server/session-ctx";
import { lireCharte } from "@/server/repositories/charte-personne";
import { CHARTE_PAR_DEFAUT } from "@/lib/chartes";
import ApparenceClient from "./ApparenceClient";

export const dynamic = "force-dynamic";

/**
 * « Apparence » — les sept chartes de couleurs.
 *
 * *Elles viennent de la planche des seize
 * (`docs/maquettes/11-ecran-retenu-seize-couleurs.html`, engendrée par
 * `scripts/engendrer-maquette-couleurs.mjs`), retenue par le patron le 14 août
 * 2026.* ***« Garde seulement pour l'instant nuit, beurre, moka, pierre,
 * sylve »*** *— plus la rose-violet, Prune — puis* ***« oui garde Origine en
 * défaut, fais les sept »***.
 *
 * **Le mode sombre qu'il demandait EST dans cette liste** : Nuit et Sylve. Un
 * interrupteur « sombre » séparé se serait contredit avec le choix de charte
 * dès qu'on aurait pris Nuit avec le sombre éteint (`ARCHITECTURE.md` §109).
 *
 * **Aucune garde de rôle** : c'est le goût de la personne, pas une décision
 * d'entreprise — la rubrique vit dans l'ensemble « Moi » du sommaire.
 */
export default async function ApparencePage() {
  await getCurrentCtx();
  const choisie = (await lireCharte()) ?? CHARTE_PAR_DEFAUT;

  return (
    <div style={{ backgroundColor: colors.cream, color: colors.ink, fontFamily: font.body, minHeight: "100%" }}>
      <EnTeteEcran
        surtitre="Moi"
        titre="Apparence"
        retour={{ href: "/reglages", libelle: "Retour aux réglages" }}
      />
      <ApparenceClient initiale={choisie} />
    </div>
  );
}
