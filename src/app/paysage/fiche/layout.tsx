import type { ReactNode } from "react";
import OuvertParLaFormule from "../OuvertParLaFormule";

// Un outil d'« Entreprise » depuis le 24 septembre 2026 : tout ce qui vit sous
// ce dossier passe par cette porte, aujourd'hui comme demain.
export default function Layout({ children }: { children: ReactNode }) {
  return (
    <OuvertParLaFormule fonction="fiche-chantier" titre="Fiche de chantier">
      {children}
    </OuvertParLaFormule>
  );
}
