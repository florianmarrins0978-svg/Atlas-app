/**
 * LES FICHES DE CHANTIER, POUR DE VRAI, SANS SERVEUR : LE PLATEAU DE LEURS FILMS.
 *
 * Sa demande du 20 novembre 2026 : « pareil avec les autres outils ». Les
 * écrans de l'outil, montés comme l'appli les monte, dans son cadre : la
 * liste (src/app/paysage/fiche/page.tsx), « Composer ma fiche », une fiche
 * (src/app/paysage/fiche/[id]/page.tsx), le rapport envoyé tel que la liste
 * l'ouvre (src/app/documents/entretien/[jeton]/page.tsx), et le compte rendu
 * que reçoit le client (src/app/entretien/[jeton]/page.tsx). Les données sont
 * le carnet de bouchons/fiches.ts.
 */
import { createRoot } from "react-dom/client";
import CadreApplication from "@/components/atlas/CadreApplication";
import FichesPage from "@/app/paysage/fiche/page";
import ComposerMaFichePage from "@/app/paysage/fiche/composer/page";
import FichePage from "@/app/paysage/fiche/[id]/page";
import PageRapportClient from "@/app/entretien/[jeton]/page";
import RapportDansLAppliPage from "@/app/documents/entretien/[jeton]/page";
import { Routeur } from "./routeur";
import { ecouterLeTournage } from "./pilote";

const ROUTES = [
  { motif: /^\/paysage\/fiche$/, ecran: () => <FichesPage /> },
  { motif: /^\/paysage\/fiche\/composer$/, ecran: () => <ComposerMaFichePage /> },
  { motif: /^\/paysage\/fiche\/([^/]+)$/, ecran: (m: RegExpMatchArray) => <FichePage params={Promise.resolve({ id: m[1] })} /> },
  { motif: /^\/entretien\/([^/]+)$/, ecran: (m: RegExpMatchArray) => <PageRapportClient params={Promise.resolve({ jeton: m[1] })} /> },
  { motif: /^\/documents\/entretien\/([^/]+)$/, ecran: (m: RegExpMatchArray) => <RapportDansLAppliPage params={Promise.resolve({ jeton: m[1] })} /> },
];

createRoot(document.getElementById("racine")!).render(
  <Routeur routes={ROUTES} depart="/paysage/fiche" cadre={(vue) => <CadreApplication role="proprietaire">{vue}</CadreApplication>} />
);

ecouterLeTournage();
