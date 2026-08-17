import Decimal from "decimal.js";
import type { Ctx } from "../repositories/context";
import { getChantier } from "../repositories/chantiers";
import { getOuCreerParametresChiffrage } from "../repositories/parametres-chiffrage";
import { listerHistoriquePrix } from "../repositories/historique-prix";
import { rechercherCartes } from "../repositories/mots-catalogue";
import { parseNombreFrancais } from "./parse";
import { calculerVariantes } from "./moteur";
import type { ChiffrageAvecVariantes } from "./types";

// Point d'entrée unique du chiffrage pour un chantier. Rassemble uniquement
// des données déjà réellement enregistrées (durée/équipe du chantier,
// paramètres de l'entreprise, historique de prix via le catalogue) — le
// moteur lui-même (moteur.ts) reste une fonction pure, sans accès base.
export async function chiffrerChantier(
  ctx: Ctx,
  chantierId: string,
  motCleCatalogue?: string
): Promise<ChiffrageAvecVariantes | null> {
  const chantier = await getChantier(ctx, chantierId);
  if (!chantier) return null;

  const parametres = await getOuCreerParametresChiffrage(ctx);

  const joursEstimes = parseNombreFrancais(chantier.dureePrevue);
  const nombreOuvriers = parseNombreFrancais(chantier.tailleEquipe);
  // Simplification volontaire (MVP) : un chef d'équipe est compté dès que
  // l'équipe annoncée dépasse une seule personne.
  const aUnChefEquipe = (nombreOuvriers ?? 0) > 1;

  let nomPrestation: string | undefined;
  let historique: ChiffrageAvecVariantes["historique"] = null;

  if (motCleCatalogue) {
    // **Ses mots à lui comptent ici aussi** (17 août 2026) : si « écime » a été
    // posé sur « Élagage », un chantier dicté avec ce mot doit être chiffré
    // comme un élagage, et non tomber dans le calcul sans nom de prestation.
    const correspondances = await rechercherCartes(ctx, "prestation", motCleCatalogue);
    const prestation = correspondances[0];
    if (prestation) {
      nomPrestation = prestation.nom;
      const lignesHistorique = await listerHistoriquePrix(ctx, prestation.id);
      if (lignesHistorique.length > 0) {
        const somme = lignesHistorique.reduce((acc, l) => acc.plus(l.prix), new Decimal(0));
        historique = {
          dernierPrix: lignesHistorique[0].prix,
          nombreDevis: lignesHistorique.length,
          moyenne: somme.dividedBy(lignesHistorique.length).toFixed(2),
        };
      }
    }
  }

  return calculerVariantes(
    {
      joursEstimes,
      nombreOuvriers,
      aUnChefEquipe,
      parametres: {
        coutJournalierOuvrier: parametres.coutJournalierOuvrier,
        coutJournalierChefEquipe: parametres.coutJournalierChefEquipe,
        coutDeplacement: parametres.coutDeplacement,
        margeCiblePourcent: parametres.margeCiblePourcent,
        tauxTvaDefaut: parametres.tauxTvaDefaut,
      },
      nomPrestation,
    },
    historique
  );
}
