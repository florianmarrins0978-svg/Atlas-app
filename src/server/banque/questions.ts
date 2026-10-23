import { jourIso } from "@/lib/jour";
import type { FactureARapprocher } from "@/lib/rapprochement-bancaire";
import { questionsDesVirements, type QuestionDeVirement } from "@/lib/virement-en-mots";
import type { Ctx } from "../repositories/context";
import { virementsDepuis } from "../repositories/banque";
import { facturesEnAttente } from "../repositories/paiements-facture";

/**
 * Combien de jours un virement sans réponse reste une question.
 *
 * Soixante : un client qui paie un mois après l'échéance doit encore être
 * reconnu ; au delà, le patron a noté le paiement à la main depuis longtemps,
 * et une carte surgie du passé le ferait douter.
 */
const QUESTIONS_SUR_JOURS = 60;

/** Les factures en attente, dans la forme que la règle de rapprochement lit. */
export async function facturesARapprocher(ctx: Ctx): Promise<FactureARapprocher[]> {
  return (await facturesEnAttente(ctx)).map((f) => ({
    id: f.id,
    numero: f.numeroCommercial,
    clientNom: f.clientNom,
    reste: f.reste,
    dateEmission: f.dateEmission,
  }));
}

export function debutDesQuestions(maintenant: Date): string {
  return jourIso(new Date(maintenant.getTime() - QUESTIONS_SUR_JOURS * 24 * 3600 * 1000));
}

/**
 * Les virements qui attendent sa réponse — LA source de l'accueil et de Ma TVA.
 *
 * Une seule fonction pour les deux écrans : c'est ce qui fait qu'un « oui »
 * donné sur l'un fait disparaître la question de l'autre, sans rien
 * synchroniser.
 */
export async function questionsEnAttente(ctx: Ctx, maintenant: Date): Promise<QuestionDeVirement[]> {
  const [virements, factures] = await Promise.all([
    virementsDepuis(ctx, debutDesQuestions(maintenant)),
    facturesARapprocher(ctx),
  ]);
  return questionsDesVirements(virements, factures);
}

