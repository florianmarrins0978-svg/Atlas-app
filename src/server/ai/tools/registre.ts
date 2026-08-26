import type { Outil } from "./types";
import { lireInformationsChantier } from "./lire-informations-chantier";
import { lirePrestations } from "./lire-prestations";
import { lireMateriels } from "./lire-materiels";
import { lireTranscription } from "./lire-transcription";
import { lireNotes } from "./lire-notes";
import { lireDevis } from "./lire-devis";
import { lireTarifs } from "./lire-tarifs";
import { rechercherTarifsCompatibles } from "./rechercher-tarifs-compatibles";
import { rechercherPrestation } from "./rechercher-prestation";
import { rechercherMaterielCatalogueOutil } from "./rechercher-materiel-catalogue";
import { rechercherHistoriquePrix } from "./rechercher-historique-prix";
import { rechercheSynonymes } from "./rechercher-synonymes";
import { calculerChiffrage } from "./calculer-chiffrage";
import { rechercherDocuments } from "./rechercher-documents";
import { executerWorkflow } from "./executer-workflow";
import { rechercherModeEmploi } from "./rechercher-mode-emploi";
import { rechercherLignesDevis } from "./rechercher-lignes-devis";
import { rechercherChantier } from "./rechercher-chantier";
import { lireClients } from "./lire-clients";
import { lirePlanning } from "./lire-planning";

export const outilsDisponibles: Outil[] = [
  lireInformationsChantier,
  lirePrestations,
  lireMateriels,
  lireTranscription,
  lireNotes,
  lireDevis,
  lireTarifs,
  rechercherTarifsCompatibles,
  rechercherPrestation,
  rechercherMaterielCatalogueOutil,
  rechercherHistoriquePrix,
  rechercheSynonymes,
  calculerChiffrage,
  rechercherDocuments,
  executerWorkflow,
  rechercherModeEmploi,
  rechercherLignesDevis,
  rechercherChantier,
  lireClients,
  lirePlanning,
];

export function getOutil(nom: string): Outil | undefined {
  return outilsDisponibles.find((o) => o.nom === nom);
}
