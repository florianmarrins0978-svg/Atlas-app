"use server";

import { headers } from "next/headers";
import { validerDatesDuMois } from "@/server/repositories/dates-du-mois";
import { logger } from "@/server/logger";
import { verifierLimite, LIMITES } from "@/server/rate-limit";
import { horsProductionReelle, sourceDuVisiteur } from "@/server/source-visiteur";
import { SOURCE_NON_ETABLIE } from "@/lib/source-visiteur";
import { adresseClient } from "@/lib/adresse-client";
import { jourIso } from "@/lib/jour";

export type EtatDates = { erreur: string } | { succes: string } | undefined;

/**
 * LA VALIDATION DES DATES DU MOIS par le client, sans compte ni session.
 *
 * **Les bornes de la réponse au contrat, et pour les mêmes raisons**
 * (`contrat/[jeton]/actions.ts`) : le jeton ne se devine pas, ce qu'on borne
 * est le coût. Les jours changés arrivent en JSON, et le dépôt les revérifie
 * un à un contre le planning : rien de ce que la page envoie n'est cru.
 */
export async function validerDatesAction(_etat: EtatDates, formData: FormData): Promise<EtatDates> {
  const jeton = String(formData.get("jeton") ?? "");
  const illisible = { erreur: "Votre réponse n'a pas pu être lue. Rechargez la page, puis recommencez." };
  let lu: unknown;
  try {
    lu = JSON.parse(String(formData.get("changements") ?? "{}"));
  } catch (err) {
    logger.warn("Dates du mois : réponse illisible", { err: String(err) });
    return illisible;
  }
  if (!lu || typeof lu !== "object" || Array.isArray(lu)) return illisible;
  const changements = Object.fromEntries(
    Object.entries(lu).filter((e): e is [string, string] => typeof e[1] === "string")
  );

  const source = await sourceDuVisiteur(horsProductionReelle());
  const seuils: Array<readonly [string, { max: number; fenetreMs: number }]> = [[`dates-contrat:${jeton}`, LIMITES.reponseDevis]];
  if (source !== SOURCE_NON_ETABLIE) seuils.push([`dates-contrat:source:${source}`, LIMITES.reponseDevisParSource]);
  for (const [cle, limite] of seuils) {
    const cadence = await verifierLimite(cle, limite);
    if (!cadence.autorise) {
      const minutes = Math.max(1, Math.ceil(cadence.retryAfterSecondes / 60));
      logger.warn("Cadence atteinte sur la validation des dates du mois");
      return {
        erreur: `Trop de tentatives en peu de temps. Patientez ${minutes} minute${minutes > 1 ? "s" : ""}, puis recommencez : vos dates restent prévues.`,
      };
    }
  }

  const entetes = await headers();
  const r = await validerDatesDuMois(
    jeton,
    { changements, adresseIp: adresseClient(entetes), agent: entetes.get("user-agent") },
    jourIso(new Date())
  );
  if (!r.ok) {
    return {
      erreur:
        r.motif === "deja_repondu"
          ? "Vous avez déjà validé ces dates."
          : r.motif === "date_prise"
            ? "Un des jours choisis vient d'être pris. Rechargez la page pour voir les jours libres."
            : r.motif === "autre_date_refusee"
              ? "Ces dates ne se changent pas en ligne. Contactez votre artisan."
              : "Ce lien n'est plus valable. Contactez votre artisan pour en recevoir un nouveau.",
    };
  }
  logger.info("Dates du mois validées par le client", { changees: r.changes });
  return { succes: "Merci, vos dates sont retenues." };
}
