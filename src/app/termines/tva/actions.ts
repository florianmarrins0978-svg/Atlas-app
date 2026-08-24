"use server";

import { getCurrentCtx } from "@/server/session-ctx";
import { creerAchatTva, supprimerAchatTva } from "@/server/repositories/achats-tva";
import { enregistrerObjet } from "@/server/storage";
import { verifierLimite, LIMITES } from "@/server/rate-limit";
import { verifierTailleFichier } from "@/server/upload-limits";
import { achatComplet, montantSaisi, type SaisieAchat } from "@/lib/achat-tva";
import { lireTicket, type TicketLu } from "@/server/ai/services/lire-ticket";
import { revalidatePath } from "next/cache";
import {
  noterPaiement,
  reglerExigibilite,
  retirerPaiement,
  soldera,
  type ResultatPaiement,
} from "@/server/repositories/paiements-facture";
import { exigerProprietaire } from "@/server/autorisation";
import type { Exigibilite } from "@/lib/exigibilite-tva";
import { extensionPhoto, MESSAGE_PHOTO_REFUSEE, photoAcceptee, retirerMetadonnees } from "@/lib/exif";

/**
 * Enregistrer un achat, et le retirer.
 *
 * **Les refus se RENDENT, ils ne se lèvent pas.** Le message d'une exception
 * levée par une action serveur n'atteint jamais l'écran du patron : Next.js le
 * remplace en production par un identifiant opaque, et son banc sert une
 * version bâtie (`AGENTS.md`). Un refus attendu — un montant illisible, un
 * fournisseur vide — revient donc en valeur de retour, avec sa phrase.
 */

export type ResultatAchat =
  | { ok: true; id: string }
  | { ok: false; raison: string };

export async function ajouterAchatAction(formData: FormData): Promise<ResultatAchat> {
  const fournisseur = String(formData.get("fournisseur") ?? "").trim();
  const dateAchat = String(formData.get("dateAchat") ?? "").trim();
  const saisie = String(formData.get("saisie") ?? "main") as SaisieAchat;
  const photoCle = String(formData.get("photoCle") ?? "").trim() || null;

  const totalTtc = montantSaisi(String(formData.get("totalTtc") ?? ""));
  const tauxTva = montantSaisi(String(formData.get("tauxTva") ?? ""));
  const tvaDeductible = montantSaisi(String(formData.get("tvaDeductible") ?? ""));

  if (!achatComplet(fournisseur, tvaDeductible)) {
    return { ok: false, raison: "Il manque le fournisseur ou le montant de TVA." };
  }
  // **La date de l'ACHAT, jamais celle de la saisie.** Un ticket de juillet
  // scanné en septembre appartient à juillet : le ranger au jour de la saisie
  // le ferait disparaître de la période où il compte.
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateAchat)) {
    return { ok: false, raison: "La date n'est pas lisible." };
  }
  if (saisie !== "scan" && saisie !== "main") {
    return { ok: false, raison: "Origine de saisie inconnue." };
  }

  const ctx = await getCurrentCtx();
  const ligne = await creerAchatTva(ctx, {
    dateAchat,
    fournisseur,
    totalTtc,
    tauxTva,
    tvaDeductible: tvaDeductible as number,
    photoCle,
    saisie,
  });
  if (!ligne) return { ok: false, raison: "L'achat n'a pas pu être enregistré." };
  return { ok: true, id: ligne.id };
}

export async function supprimerAchatAction(id: string): Promise<{ ok: boolean }> {
  const ctx = await getCurrentCtx();
  const ligne = await supprimerAchatTva(ctx, id);
  // `undefined` = la RLS a filtré, ou la ligne était déjà retirée. Dans les
  // deux cas l'écran doit remettre la ligne plutôt que la faire disparaître à
  // tort (`ARCHITECTURE.md` §48).
  return { ok: Boolean(ligne) };
}

export type ResultatTicket =
  | { ok: true; cle: string; lu: TicketLu | null; lecture: string | null }
  | { ok: false; raison: string };

/**
 * Ranger la photo d'un ticket, et rendre sa clé.
 *
 * **Elle est enregistrée AVANT que le montant soit connu**, et c'est voulu : le
 * patron photographie sur le trottoir, la station derrière lui, et remplira les
 * chiffres à l'abri. Exiger les montants d'abord, c'est le faire ressortir le
 * ticket de sa poche.
 *
 * **La photo ne dispense pas de garder le papier.** Scanner ne remplace pas
 * l'original aux yeux de l'administration, sauf procédure de numérisation
 * formelle. L'écran le dit plutôt que de le laisser supposer.
 */
export async function rangerTicketAction(formData: FormData): Promise<ResultatTicket> {
  const fichier = formData.get("ticket");
  if (!(fichier instanceof File)) return { ok: false, raison: "Aucune photo reçue." };
  // **Liste blanche, plus `startsWith("image/")`** — audit du 23 août 2026,
  // constat M2 : l'ancienne ligne acceptait `image/svg+xml`, qui est un
  // document porteur de script, pas une image. Le HEIC de l'iPhone reste
  // accepté (`src/lib/exif.ts`) : c'est avec ça qu'il photographie ses tickets.
  if (!photoAcceptee(fichier.type)) return { ok: false, raison: MESSAGE_PHOTO_REFUSEE };

  // Vérifié via `size`, sans lire le contenu : un fichier surdimensionné ne
  // doit pas passer par la mémoire avant d'être refusé.
  const taille = verifierTailleFichier(fichier);
  if (!taille.ok) return { ok: false, raison: taille.message };

  const ctx = await getCurrentCtx();
  const limite = await verifierLimite(`televersement:${ctx.entrepriseId}`, LIMITES.televersementFichier);
  if (!limite.autorise) return { ok: false, raison: limite.message };

  const brut = Buffer.from(await fichier.arrayBuffer());

  /**
   * **Les métadonnées partent avant le rangement** — constat M3. Un ticket
   * photographié porte les coordonnées GPS de la station-service, l'heure
   * exacte, le modèle du téléphone. Aucune de ces trois choses n'entre dans une
   * déclaration de TVA.
   *
   * **Et un échec de nettoyage ne refuse jamais le ticket** : il est rangé tel
   * quel. Le geste du patron est sur le trottoir, la station derrière lui — ce
   * n'est pas le moment de lui opposer un refus (`termines/tva`, en-tête).
   */
  const nettoye = retirerMetadonnees(brut, fichier.type);
  const octets = Buffer.from(nettoye.octets);
  const objet = await enregistrerObjet(
    `entreprises/${ctx.entrepriseId}/tickets`,
    octets,
    extensionPhoto(fichier.type)
  );

  // **La photo est rangée AVANT la lecture, et le reste quoi qu'elle donne.**
  // Si le fournisseur d'IA est absent, refuse ou se trompe, le patron garde sa
  // preuve et saisit les montants : le geste n'est jamais perdu pour une panne
  // qui n'est pas la sienne.
  let lu: TicketLu | null = null;
  let lecture: string | null = null;
  try {
    const r = await lireTicket(octets.toString("base64"), fichier.type);
    if (r.ok) {
      lu = r.ticket;
      lecture = r.ticket.reserve;
    } else {
      lecture = r.raison;
    }
  } catch (err) {
    // **On journalise avant de se taire.** Un défaut muet est un défaut qu'on
    // répare à l'aveugle (`AGENTS.md`) — et celui-ci se produira chez le patron,
    // pas ici.
    console.error("Lecture du ticket échouée :", err);
    lecture = "La lecture automatique n’a pas abouti. Recopiez les montants.";
  }

  return { ok: true, cle: objet.storageKey, lu, lecture };
}

// ---------------------------------------------------------------------------
// Les règlements reçus — sa demande du 14 août 2026
// ---------------------------------------------------------------------------
//
// *« Lorsque la facture part, au lieu qu'elle rentre directement dans le relevé,
// elle arrive dans un endroit en attente ; lorsque j'ai reçu le paiement, je
// retourne dessus, je clique sur valider, et boum, elle va dans le relevé. »*
//
// **Mêmes règles qu'au-dessus : les refus se RENDENT.** « Il ne reste que
// 440,00 € à recevoir » doit lui parvenir mot pour mot ; levé, ce message
// deviendrait un identifiant opaque et il croirait l'application cassée.

export async function soldeFactureAction(factureId: string, aujourdHui: string): Promise<ResultatPaiement> {
  const ctx = await getCurrentCtx();
  const r = await soldera(ctx, factureId, aujourdHui);
  revalidatePath("/termines/tva");
  return r;
}

export async function noterPaiementAction(
  factureId: string,
  date: string,
  montant: string
): Promise<ResultatPaiement> {
  const ctx = await getCurrentCtx();
  const r = await noterPaiement(ctx, factureId, { date, montant });
  revalidatePath("/termines/tva");
  return r;
}

export async function retirerPaiementAction(paiementId: string): Promise<void> {
  const ctx = await getCurrentCtx();
  await retirerPaiement(ctx, paiementId);
  revalidatePath("/termines/tva");
}

/**
 * Changer de régime.
 *
 * **Réservé au propriétaire**, à la différence de la saisie d'un règlement :
 * ce choix décide de ce qui part à l'administration pour toute l'entreprise, et
 * il se déclare aux impôts. Un salarié n'a aucune raison d'y toucher.
 */
export async function reglerExigibiliteAction(regime: Exigibilite): Promise<void> {
  const ctx = await getCurrentCtx();
  await exigerProprietaire(ctx, "changer le moment où votre TVA devient exigible");
  await reglerExigibilite(ctx, regime);
  revalidatePath("/termines/tva");
}
