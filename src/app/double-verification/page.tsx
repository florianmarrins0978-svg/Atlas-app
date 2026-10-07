import { redirect } from "next/navigation";
import EnTeteEcran from "@/components/atlas/EnTeteEcran";
import { colors, font } from "@/lib/design-tokens";
import { getCurrentCtxPourActiver } from "@/server/session-ctx";
import { etatDoubleVerification } from "@/server/repositories/double-verification";
import ActivationObligatoire from "./ActivationObligatoire";

export const dynamic = "force-dynamic";

/**
 * OÙ LE PATRON EST ENVOYÉ TANT QU'IL NE L'A PAS ACTIVÉE — sa réponse « A » du
 * 30 septembre 2026 (`appli/double-verification.html`).
 *
 * `getCurrentCtx` y renvoie le patron et la facturation, en production réelle,
 * depuis n'importe quel écran ou action. Cet écran-ci passe donc par
 * `getCurrentCtxPourActiver`, sans quoi il se renverrait à lui-même.
 *
 * Une fois activée, il n'a plus rien à faire ici : retour à l'accueil.
 */
export default async function DoubleVerificationPage() {
  const ctx = await getCurrentCtxPourActiver();
  if ((await etatDoubleVerification(ctx.utilisateurId)).active) redirect("/");

  return (
    <div
      className="atlas-ecran"
      style={{ backgroundColor: colors.cream, color: colors.ink, fontFamily: font.body }}
    >
      <EnTeteEcran titre="Double vérification" assistant={false} />
      <div className="atlas-colonne-defile" style={{ overscrollBehavior: "contain" }}>
        <ActivationObligatoire />
      </div>
    </div>
  );
}
