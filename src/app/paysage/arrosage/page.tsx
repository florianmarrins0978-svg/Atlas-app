import EnTeteEcran from "@/components/atlas/EnTeteEcran";
import { getConfigIA } from "@/server/ai/config";
import ArrosageClient from "./ArrosageClient";

/**
 * « Plan d'arrosage » — l'outil, DANS l'application.
 *
 * *Sa demande du 20 août 2026 : « code le tout dans l'appli ».* Jusque-là
 * l'outil vivait à part, publié sur une page qu'il ouvrait depuis son
 * téléphone, et l'écran « Paysage » l'envoyait hors d'Atlas.
 *
 * **La clé d'IA se lit ICI, côté serveur, et se passe à l'écran.** Le composant
 * client ne peut pas la voir — et ne doit pas : une clé qui traverserait le fil
 * jusqu'au navigateur serait lisible par n'importe qui. Seul le fait qu'elle
 * existe voyage.
 */
export const metadata = { title: "Plan d'arrosage — Atlas" };
export const dynamic = "force-dynamic";

export default async function ArrosagePage() {
  const ia = getConfigIA();
  // N'importe lequel des deux suffit : le croquis part chez celui qui est posé.
  const iaPrete = Boolean(ia.anthropicApiKey || ia.openaiApiKey);

  return (
    <div>
      {/* **Le titre est porté par l'en-tête de l'application, pas par l'écran.**
          Un `titre=""` laissait un `h1` vide et quatre cents pixels de vide
          avant « Plan d'arrosage » — vu à la capture, pas au test. */}
      <EnTeteEcran
        retour={{ href: "/paysage", libelle: "Retour à Paysage" }}
        surtitre="Paysage"
        titre="Plan d’arrosage"
      />
      <ArrosageClient iaPrete={iaPrete} />
    </div>
  );
}
