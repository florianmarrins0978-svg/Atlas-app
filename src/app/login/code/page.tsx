import { redirect } from "next/navigation";
import PorteDeNuit from "@/components/atlas/PorteDeNuit";
import { connexionEnAttente } from "@/server/double-verification-connexion";
import FormulaireCode from "./FormulaireCode";

export const dynamic = "force-dynamic";

/**
 * LE CODE, APRÈS LE MOT DE PASSE — `appli/double-verification.html`, onglet 2.
 *
 * On n'arrive ici qu'avec une connexion en attente, c'est-à-dire après un
 * premier facteur juste. Sans elle, l'écran n'a rien à vérifier : retour à la
 * porte, plutôt qu'un champ dont la saisie mènerait à « délai passé ».
 */
export default async function CodePage() {
  if (!(await connexionEnAttente())) redirect("/login");
  return (
    <PorteDeNuit className="atlas-bas-sans-barre flex min-h-[100dvh] flex-col px-[22px] pb-5">
      <FormulaireCode />
    </PorteDeNuit>
  );
}
