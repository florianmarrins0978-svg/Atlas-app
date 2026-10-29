import { logger } from "@/server/logger";
import type { Courriel, ResultatEnvoi } from "./index";

/**
 * Brevo — le service qu'il a choisi le 14 septembre 2026.
 *
 * Une seule route de leur API, `POST /v3/smtp/email`, avec la clé en en-tête
 * `api-key`. L'expéditeur doit avoir été VÉRIFIÉ dans leur console
 * (Expéditeurs) : sans cela Brevo répond 400 et rien ne part — c'est pourquoi
 * `env.ts` refuse une clé sans `COURRIEL_EXPEDITEUR`.
 *
 * **Ce qui sort d'ici : une adresse, un objet, un texte**, et le seul document
 * qu'il a accepté d'y faire passer : l'attestation signée de son comptable
 * (29 octobre 2026). Jamais le contenu d'un chantier, jamais une donnée client. Une réponse qui n'est pas 2xx est un échec dit à l'appelant, pas
 * une exception — l'écran doit pouvoir proposer « Renvoyer ».
 */
const ADRESSE_BREVO = "https://api.brevo.com/v3/smtp/email";

export async function envoyerParBrevo(
  courriel: Courriel,
  acces: { cle: string; expediteur: string }
): Promise<ResultatEnvoi> {
  const controleur = new AbortController();
  const delai = setTimeout(() => controleur.abort(), 15_000);
  try {
    const reponse = await fetch(ADRESSE_BREVO, {
      method: "POST",
      headers: {
        "api-key": acces.cle,
        "content-type": "application/json",
        accept: "application/json",
      },
      body: JSON.stringify({
        sender: { name: "Atlas", email: acces.expediteur },
        to: [{ email: courriel.a }],
        subject: courriel.objet,
        textContent: courriel.texte,
        ...(courriel.pieceJointe
          ? { attachment: [{ name: courriel.pieceJointe.nom, content: Buffer.from(courriel.pieceJointe.contenu).toString("base64") }] }
          : {}),
      }),
      signal: controleur.signal,
    });
    if (!reponse.ok) {
      // Le corps de Brevo dit POURQUOI (expéditeur non vérifié, clé
      // invalide, quota) : il va au journal, jamais à l'écran.
      const corps = await reponse.text().catch(() => "");
      logger.error("Brevo a refusé l'envoi", { statut: reponse.status, corps: corps.slice(0, 500) });
      return { ok: false, raison: `Brevo a répondu ${reponse.status}` };
    }
    return { ok: true };
  } catch (erreur) {
    logger.error("Brevo injoignable", { erreur: erreur instanceof Error ? erreur.message : String(erreur) });
    return { ok: false, raison: "Brevo injoignable" };
  } finally {
    clearTimeout(delai);
  }
}
