import EnTeteEcran from "@/components/atlas/EnTeteEcran";
import { colors, font } from "@/lib/design-tokens";
import { doubleVerificationObligatoire } from "@/lib/double-verification";
import { getCurrentCtx } from "@/server/session-ctx";
import { getRole } from "@/server/autorisation";
import { horsProductionReelle } from "@/server/source-visiteur";
import { etatDoubleVerification } from "@/server/repositories/double-verification";
import SectionDoubleVerification from "../SectionDoubleVerification";

export const dynamic = "force-dynamic";

/**
 * RÉGLAGES, DOUBLE VÉRIFICATION — `appli/double-verification.html`, onglet 1.
 *
 * Sa propre rubrique plutôt qu'une section de « Mot de passe » : voir
 * `src/lib/rubriques-reglages.ts`. Aucune garde de rôle : c'est la rubrique de
 * la personne, comme le mot de passe.
 */
export default async function DoubleVerificationReglagesPage() {
  const ctx = await getCurrentCtx();
  const etat = await etatDoubleVerification(ctx.utilisateurId);
  const obligatoire = doubleVerificationObligatoire((await getRole(ctx)) ?? "", !horsProductionReelle());

  return (
    <div
      className="atlas-ecran"
      style={{ backgroundColor: colors.cream, color: colors.ink, fontFamily: font.body }}
    >
      <EnTeteEcran
        surtitre="Moi"
        titre="Double vérification"
        retour={{ href: "/reglages", libelle: "Retour aux réglages" }}
      />
      <div className="atlas-colonne-defile" style={{ overscrollBehavior: "contain" }}>
        <SectionDoubleVerification etatInitial={etat} obligatoire={obligatoire} />
      </div>
    </div>
  );
}
