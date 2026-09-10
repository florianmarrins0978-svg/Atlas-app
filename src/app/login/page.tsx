import PorteDeNuit from "@/components/atlas/PorteDeNuit";
import { fournisseursDisponibles } from "@/lib/fournisseurs-connexion";
import { getEnv } from "@/server/env";
import FormulaireConnexion from "./FormulaireConnexion";

/**
 * LA PORTE D'ATLAS — écran 3 de `appli/la-porte-en-plein-air.html`.
 *
 * **Cet écran est au SERVEUR, et c'est tout ce qu'il fait de plus.** Il lit les
 * clés des fournisseurs, ce qu'un écran ne peut pas faire, et passe la liste au
 * formulaire. Le reste — la nuit, les champs, le refus — vit à côté :
 *
 *   · `PorteDeNuit` pose la charte sombre, partagée avec la création de compte ;
 *   · `FormulaireConnexion` dessine et envoie ;
 *   · `src/lib/fournisseurs-connexion.ts` décide qui a le droit d'apparaître.
 *
 * **Pourquoi la question des clés se pose ici et pas dans le formulaire.**
 * `getEnv()` n'existe qu'au serveur. Un composant client qui devinerait la
 * réponse afficherait un bouton menant à une page d'erreur d'Auth.js — et le
 * seul écran qu'on voit avant d'être connecté est le pire endroit pour ça.
 */
export default function LoginPage() {
  const env = getEnv();
  const fournisseurs = fournisseursDisponibles({
    googleId: env.googleClientId,
    googleSecret: env.googleClientSecret,
    appleId: env.appleClientId,
    appleSecret: env.appleClientSecret,
  });

  return (
    <PorteDeNuit className="atlas-bas-sans-barre flex min-h-[100dvh] flex-col px-[22px] pb-5">
      <FormulaireConnexion fournisseurs={fournisseurs} />
    </PorteDeNuit>
  );
}
