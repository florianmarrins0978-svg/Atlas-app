import type { Outil } from "./types";
import { lireInformationsChantier } from "./lire-informations-chantier";
import { lirePrestations } from "./lire-prestations";
import { lireMateriels } from "./lire-materiels";
import { lireTranscription } from "./lire-transcription";
import { lireNotes } from "./lire-notes";
import { lireDevis } from "./lire-devis";
import { lireTarifs } from "./lire-tarifs";
import { rechercherTarifsCompatibles } from "./rechercher-tarifs-compatibles";
import { creerChantierOutil } from "./creer-chantier";
import { rechercherChantier } from "./rechercher-chantier";
import { rechercherPrestation } from "./rechercher-prestation";
import { rechercherMaterielCatalogueOutil } from "./rechercher-materiel-catalogue";
import { rechercherHistoriquePrix } from "./rechercher-historique-prix";
import { rechercheSynonymes } from "./rechercher-synonymes";
import { calculerChiffrage } from "./calculer-chiffrage";
import { rechercherDocuments } from "./rechercher-documents";
import { executerWorkflow } from "./executer-workflow";

export const outilsDisponibles: Outil[] = [
  // **En tête, et ce n'est pas un rangement.** C'est le seul outil qui marche
  // sans chantier ouvert : c'est par lui qu'on entre quand le patron nomme un
  // client depuis la liste (`rechercher-chantier.ts`).
  rechercherChantier,
  // **Le seul outil qui écrit**, et l'exception est étroite : il ouvre une
  // fiche vide, il n'engage rien (`creer-chantier.ts`).
  creerChantierOutil,
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
];

export function getOutil(nom: string): Outil | undefined {
  return outilsDisponibles.find((o) => o.nom === nom);
}
