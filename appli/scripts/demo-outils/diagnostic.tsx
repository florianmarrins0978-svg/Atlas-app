/**
 * LE DIAGNOSTIC VÉGÉTAL, POUR DE VRAI, DANS LE TÉLÉPHONE DU SITE.
 *
 * Sa demande du 20 novembre 2026 : « pareil avec les autres outils » que pour
 * le plan d'arrosage. Les deux écrans de l'outil, montés comme l'appli les
 * monte, dans son cadre : la photo (src/app/paysage/diagnostic/page.tsx),
 * puis le résultat (src/app/paysage/diagnostic/[id]/page.tsx). Ce sont des
 * écrans « serveur » : routeur.tsx les rend ici, la base remplacée par la
 * vraie fiche du platane (bouchons/diagnostic.ts).
 */
import { createRoot } from "react-dom/client";
import CadreApplication from "@/components/atlas/CadreApplication";
import DiagnosticPage from "@/app/paysage/diagnostic/page";
import ResultatPage from "@/app/paysage/diagnostic/[id]/page";
import { Routeur } from "./routeur";
import { ecouterLaPage } from "./pilote";

const ROUTES = [
  { motif: /^\/paysage\/diagnostic$/, ecran: () => <DiagnosticPage /> },
  { motif: /^\/paysage\/diagnostic\/([^/]+)$/, ecran: (m: RegExpMatchArray) => <ResultatPage params={Promise.resolve({ id: m[1] })} /> },
];

createRoot(document.getElementById("racine")!).render(
  <Routeur routes={ROUTES} depart="/paysage/diagnostic" cadre={(vue) => <CadreApplication role="proprietaire">{vue}</CadreApplication>} />
);

ecouterLaPage('[data-atlas="ecran-diagnostic"], [data-atlas="ecran-diagnostic-resultat"]');
