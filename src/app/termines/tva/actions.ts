"use server";

import { getCurrentCtx } from "@/server/session-ctx";
import { creerAchatTva, supprimerAchatTva } from "@/server/repositories/achats-tva";
import { enregistrerObjet } from "@/server/storage";
import { verifierLimite, LIMITES } from "@/server/rate-limit";
import { verifierTailleFichier } from "@/server/upload-limits";
import { achatComplet, montantSaisi, type SaisieAchat } from "@/lib/achat-tva";

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

export type ResultatTicket = { ok: true; cle: string } | { ok: false; raison: string };

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
  if (!fichier.type.startsWith("image/")) return { ok: false, raison: "Le fichier doit être une image." };

  // Vérifié via `size`, sans lire le contenu : un fichier surdimensionné ne
  // doit pas passer par la mémoire avant d'être refusé.
  const taille = verifierTailleFichier(fichier);
  if (!taille.ok) return { ok: false, raison: taille.message };

  const ctx = await getCurrentCtx();
  const limite = await verifierLimite(`televersement:${ctx.entrepriseId}`, LIMITES.televersementFichier);
  if (!limite.autorise) return { ok: false, raison: limite.message };

  const octets = Buffer.from(await fichier.arrayBuffer());
  const ext = fichier.type === "image/png" ? ".png" : fichier.type === "image/webp" ? ".webp" : ".jpg";
  const objet = await enregistrerObjet(`entreprises/${ctx.entrepriseId}/tickets`, octets, ext);
  return { ok: true, cle: objet.storageKey };
}
