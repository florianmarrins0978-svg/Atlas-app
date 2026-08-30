import type { Outil } from "./types";
import { lireInformationsChantier } from "./lire-informations-chantier";
import { lirePrestations } from "./lire-prestations";
import { lireMateriels } from "./lire-materiels";
import { lireTranscription } from "./lire-transcription";
import { lireNotes } from "./lire-notes";
import { lireDevis } from "./lire-devis";
import { lireTarifs } from "./lire-tarifs";
import { rechercherTarifsCompatibles } from "./rechercher-tarifs-compatibles";
import { rechercherChantier } from "./rechercher-chantier";
import { rechercherPrestation } from "./rechercher-prestation";
import { rechercherMaterielCatalogueOutil } from "./rechercher-materiel-catalogue";
import { rechercherHistoriquePrix } from "./rechercher-historique-prix";
import { rechercheSynonymes } from "./rechercher-synonymes";
import { calculerChiffrage } from "./calculer-chiffrage";
import { rechercherDocuments } from "./rechercher-documents";
import { executerWorkflow } from "./executer-workflow";
import { rechercherModeEmploi } from "./rechercher-mode-emploi";
import { lireReglagesDocuments } from "./lire-reglages-documents";
import { lirePrestationsEntretien } from "./lire-prestations-entretien";
import { rechercherLignesDevis } from "./rechercher-lignes-devis";
import { lireClients } from "./lire-clients";
import { lirePlanning } from "./lire-planning";

export const outilsDisponibles: Outil[] = [
  // **En tête, et ce n'est pas un rangement.** C'est par lui qu'on entre quand
  // le patron nomme un client depuis la liste (`rechercher-chantier.ts`).
  //
  // **`CreerChantier` a quitté cette liste le 26 août 2026.** C'était le seul
  // outil qui écrivait de lui-même — une exception ouverte la veille sur sa
  // demande *« ça aussi il doit pouvoir le faire »*. Il le peut toujours : le
  // geste est devenu une PROPOSITION (`creer_chantier`), parce qu'à la question
  // « y a-t-il des gestes sans risque qu'il fasse directement ? » il a répondu
  // le lendemain : *« je pense qu'il ne doit pas pouvoir le faire, très
  // important que ça reste le doigt du patron »*. Les deux demandes tiennent
  // ensemble — il SAIT le faire, et c'est le patron qui appuie.
  rechercherChantier,
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
  lireReglagesDocuments,
  lirePrestationsEntretien,
  rechercherLignesDevis,
  lireClients,
  lirePlanning,
];

export function getOutil(nom: string): Outil | undefined {
  return outilsDisponibles.find((o) => o.nom === nom);
}
