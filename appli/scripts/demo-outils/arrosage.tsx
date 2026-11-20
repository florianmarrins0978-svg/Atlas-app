/**
 * LE PLAN D'ARROSAGE, POUR DE VRAI, DANS LE TÉLÉPHONE DU SITE.
 *
 * Sa demande du 20 novembre 2026 : « leur montrer toute la page », que l'on
 * puisse toucher 25 ou 32, la nourrice, n'importe quelle pièce pour la changer
 * ou la supprimer, puis la liste et l'envoi au fournisseur.
 *
 * L'écran est monté exactement comme src/app/paysage/arrosage/page.tsx le
 * monte, dans le cadre de l'appli (CadreApplication, sa barre d'onglets) :
 * mêmes composants, même calcul, même feuille de style. Le croquis « lu » est
 * celui du jardin de la démonstration (bouchons/arrosage.ts) ; on l'envoie au premier
 * rendu, comme si la photo venait d'être lue.
 */
import { createRoot } from "react-dom/client";
import CadreApplication from "@/components/atlas/CadreApplication";
import EnTeteEcran from "@/components/atlas/EnTeteEcran";
import ArrosageClient from "@/app/paysage/arrosage/ArrosageClient";
import { ecouterLaPage } from "./pilote";

function Ecran() {
  return (
    <CadreApplication role="proprietaire">
      <div>
        <EnTeteEcran retour={{ href: "/paysage", libelle: "Retour à Paysage" }} surtitre="Paysage" titre="Plan d’arrosage" />
        <ArrosageClient iaPrete motifIA={null} />
      </div>
    </CadreApplication>
  );
}

createRoot(document.getElementById("racine")!).render(<Ecran />);

// Le croquis part dès que le formulaire est là : l'écran s'ouvre sur le plan.
const envoyer = () => {
  const formulaire = document.querySelector("form");
  if (!formulaire) return requestAnimationFrame(envoyer);
  formulaire.requestSubmit();
};
requestAnimationFrame(envoyer);

ecouterLaPage('[data-atlas="plan-arrosage"]');
