import { redirect } from "next/navigation";
import { colors, font } from "@/lib/design-tokens";
import EnTeteEcran from "@/components/atlas/EnTeteEcran";
import { getCurrentCtx } from "@/server/session-ctx";
import { accesDeLaPersonne } from "@/server/autorisation";
import { CompteFermeError } from "@/server/db/with-entreprise";
import { garderLaPage } from "@/server/garde-page";
import SeDeconnecter from "../reglages/SeDeconnecter";

export const dynamic = "force-dynamic";

/**
 * LE COMPTE DE L'ENTREPRISE EST FERMÉ — ce que lit un salarié, ou un
 * commercial, une fois que le patron a fermé le compte (5 novembre 2026,
 * question 33 de `docs/QUESTIONS.md` ; la planche le lui avait dit : « vos
 * salariés n'auront plus accès à Atlas »).
 *
 * `withEntreprise` le refuse partout ; `garderLaPage` l'envoie ici plutôt que
 * de le laisser devant une page d'erreur à chaque adresse. **Cet écran ne lit
 * rien de l'entreprise**, pas même son nom : c'est exactement ce qui lui est
 * fermé. Il ne reste qu'à sortir, avec la sortie qui existe déjà.
 *
 * Ouvert par quelqu'un dont le compte n'est pas fermé, il le renvoie à
 * l'accueil : la phrase serait fausse.
 */
export default async function CompteFermePage() {
  await garderLaPage();
  let ferme = false;
  try {
    await accesDeLaPersonne(await getCurrentCtx());
  } catch (err) {
    if (!(err instanceof CompteFermeError)) throw err;
    ferme = true;
  }
  if (!ferme) redirect("/");

  return (
    <div style={{ backgroundColor: colors.cream, color: colors.ink, fontFamily: font.body, minHeight: "100%" }}>
      <EnTeteEcran titre="Compte fermé" allure="soignee" assistant={false} />
      <p className="mx-[26px] mt-8 text-[17px] leading-[1.45]" style={{ color: colors.ink }} data-atlas="compte-ferme-salarie">
        Le compte de l&apos;entreprise est fermé.
      </p>
      <SeDeconnecter nomEntreprise={null} />
    </div>
  );
}
