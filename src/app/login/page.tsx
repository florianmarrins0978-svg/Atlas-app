import PorteDeNuit from "@/components/atlas/PorteDeNuit";
import { fournisseursAAfficher } from "@/lib/fournisseurs-connexion";
import { clesFournisseurs } from "@/server/cles-fournisseurs";
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
 *   · `src/lib/fournisseurs-connexion.ts` dit qui se dessine, et qui est branché.
 *
 * **Pourquoi la question des clés se pose ici et pas dans le formulaire.** Les
 * clés ne se lisent qu'au serveur (`clesFournisseurs`). Les deux marques se
 * dessinent désormais dans tous les cas — sa décision du 11 septembre 2026 —,
 * mais l'écran doit savoir LESQUELLES sont branchées : une qui ne l'est pas
 * refuse, en le disant, au lieu de sortir d'Atlas.
 */
export default function LoginPage() {
  const fournisseurs = fournisseursAAfficher(clesFournisseurs());

  return (
    <PorteDeNuit className="atlas-bas-sans-barre flex min-h-[100dvh] flex-col px-[22px] pb-5">
      <FormulaireConnexion fournisseurs={fournisseurs} />
    </PorteDeNuit>
  );
}
