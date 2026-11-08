"use server";

import { revalidatePath } from "next/cache";
import { patronQuiImporte } from "@/server/import/garde";
import { annulerRangement, getEnvoi, piecesLuesDeLEnvoi, rangerEnvoiSelonLePlan } from "@/server/repositories/pieces-importees";
import { clientsQuOnPeutReconnaitre } from "@/server/repositories/clients";
import { lignesDesPdf, type PieceLueDuPdf } from "@/lib/import-pieces";
import { lignesPourLeClient, planDeRangement, type ChoixAdresse, type ClientConnu } from "@/lib/import-tableau";
import { logger } from "@/server/logger";

// Lire, ranger, annuler. **Un refus se rend, il ne se lève pas** : le message
// d'une exception levée par une action serveur n'arrive jamais jusqu'à l'écran
// (`AGENTS.md`, « rendre le défaut bavard »).

type Refus = { ok: false; raison: string };
const INTROUVABLE: Refus = { ok: false, raison: "Cet envoi n'existe plus." };
// Les six secondes passées, ou un envoi plus récent ouvert entre-temps
// (`annulerRangement`) : le bandeau le dit à la place de son compte.
const PLUS_ANNULABLE: Refus = { ok: false, raison: "Ce rangement ne peut plus s’annuler." };
/**
 * Le client chez qui l'envoi se range, s'il part de sa fiche et que la fiche
 * existe encore ; sinon personne : ses pièces se rangent par leur nom.
 */
const destinationDe = (envoi: { clientId: string | null }, connus: readonly ClientConnu[]) =>
  (envoi.clientId && connus.find((c) => c.id === envoi.clientId)) || null;

/** Les colonnes que l'écran et la règle connaissent d'un client, et elles seules. */
const pourLEcran = (c: ClientConnu): ClientConnu => ({ id: c.id, nom: c.nom, telephone: c.telephone, email: c.email, adresse: c.adresse, creeLe: c.creeLe });

/**
 * Les PDF lus d'un envoi, et les clients déjà là : de quoi montrer l'écran
 * « Par client » des tableaux (sa demande du 31 octobre 2026, *« que ça soit
 * un CSV, Excel ou un PDF, il faut que ça soit la même chose »*).
 */
export async function piecesDeLEnvoiAction(
  envoiId: string
): Promise<{ ok: true; pieces: PieceLueDuPdf[]; connus: ClientConnu[]; pourLeClient: ClientConnu | null } | Refus> {
  const ctx = await patronQuiImporte();
  const envoi = ctx ? await getEnvoi(ctx, envoiId) : undefined;
  if (!ctx || !envoi) return INTROUVABLE;
  const [pieces, connus] = await Promise.all([piecesLuesDeLEnvoi(ctx, envoiId), clientsQuOnPeutReconnaitre(ctx)]);
  // **Ouvert depuis sa fiche** (8 novembre 2026) : l'écran ne connaît que lui,
  // et tout s'y range (`lignesPourLeClient`).
  // Son client effacé depuis, l'envoi redevient un envoi de Vos clients : ses
  // pièces se rangent par leur nom (migration 0177).
  const client = destinationDe(envoi, connus);
  if (client) return { ok: true, pieces, connus: [pourLEcran(client)], pourLeClient: pourLEcran(client) };
  return { ok: true, pieces, connus: connus.map(pourLEcran), pourLeClient: null };
}

/** Une chaîne de l'écran, bornée : il ne fixe ni sa longueur ni sa forme. */
const nomTape = (v: unknown) => (typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, 120) : "");

/**
 * Ses réponses, puis le rangement. **Le serveur ne se fie pas au plan de
 * l'écran** : il relit les pièces en base et refait le plan avec la même règle
 * (`lignesDesPdf`, `planDeRangement`), comme pour un tableau, et refuse ce qui
 * attend encore une réponse.
 *
 * Les noms tapés et les genres répondus arrivent par l'identifiant de la pièce,
 * jamais par un rang que l'écran aurait calculé.
 */
export async function rangerLesPdfAction(
  envoiId: string,
  reponses: { choix: Record<string, ChoixAdresse>; tapes: Record<string, string>; genres: Record<string, "devis" | "facture"> },
  /** Le client que l'écran montre, ou `null` : ce qu'il a vu doit être ce qui se range. */
  pourLeClientId: string | null = null
): Promise<{ ok: true; rangees: number } | Refus> {
  const ctx = await patronQuiImporte();
  const envoi = ctx ? await getEnvoi(ctx, envoiId) : undefined;
  if (!ctx || !envoi) return INTROUVABLE;
  try {
    const genres: Record<string, "devis" | "facture"> = {};
    for (const [id, g] of Object.entries(reponses?.genres ?? {})) if (g === "devis" || g === "facture") genres[id] = g;
    const [pieces, connus] = await Promise.all([piecesLuesDeLEnvoi(ctx, envoiId), clientsQuOnPeutReconnaitre(ctx)]);
    const { lignes, idDuRang } = lignesDesPdf(pieces, genres);
    const tapes: Record<number, string> = {};
    for (const [rang, id] of idDuRang) {
      const nom = nomTape(reponses?.tapes?.[id]);
      if (nom) tapes[rang] = nom;
    }
    const choix = reponses?.choix && typeof reponses.choix === "object" ? reponses.choix : {};
    // **Ouvert depuis sa fiche** : le serveur refait le même plan que l'écran,
    // toutes les pièces sous son nom, et ne range rien ailleurs que chez lui.
    const client = destinationDe(envoi, connus);
    // Sa fiche effacée pendant qu'il regardait l'écran : rien ne se range
    // ailleurs que là où l'écran l'a montré.
    if ((client?.id ?? null) !== pourLeClientId) {
      return { ok: false, raison: "Ce client n’existe plus. Rouvrez l’import depuis Vos clients." };
    }
    const plan = client
      ? planDeRangement(lignesPourLeClient(lignes, client), [client], {}, {})
      : planDeRangement(lignes, connus, choix, tapes);
    if (!plan.ok) return { ok: false, raison: `Vérifiez ${plan.adresses} adresse${plan.adresses > 1 ? "s" : ""}.` };
    // Un nom qui ne se compare à rien (« M. » seul) ne retrouverait pas sa
    // fiche, et en ferait naître une : refusé plutôt que rangé ailleurs.
    if (client && plan.clients.some((c) => c.existant !== client.id)) {
      return { ok: false, raison: "Ce client ne se retrouve pas. Importez depuis Vos clients." };
    }
    const { rangees } = await rangerEnvoiSelonLePlan(ctx, envoiId, plan.clients, idDuRang);
    revalidatePath("/clients");
    if (client) revalidatePath(`/clients/${client.id}`);
    return { ok: true, rangees };
  } catch (err) {
    logger.error("Rangement des pièces importées impossible", { erreur: err instanceof Error ? err.message : String(err) });
    return { ok: false, raison: "Les pièces n’ont pas pu être rangées. Réessayez." };
  }
}

export async function annulerRangementAction(envoiId: string): Promise<{ ok: true } | Refus> {
  const ctx = await patronQuiImporte();
  if (!ctx) return INTROUVABLE;
  try {
    const envoi = await getEnvoi(ctx, envoiId);
    const r = await annulerRangement(ctx, envoiId);
    if (!r.ok) return r.pourquoi === "introuvable" ? INTROUVABLE : PLUS_ANNULABLE;
    revalidatePath("/clients");
    if (envoi?.clientId) revalidatePath(`/clients/${envoi.clientId}`);
    return { ok: true };
  } catch (err) {
    logger.error("Annulation d'un rangement impossible", { erreur: err instanceof Error ? err.message : String(err) });
    // Sans « Réessayez » : le bandeau part avec ses six secondes, et le
    // bouton avec lui.
    return { ok: false, raison: "Le rangement n’a pas pu être annulé." };
  }
}
