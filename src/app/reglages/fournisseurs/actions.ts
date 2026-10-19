"use server";

import { revalidatePath } from "next/cache";
import { getCurrentCtx } from "@/server/session-ctx";
import { exigerProprietaire } from "@/server/autorisation";
import { refusDuPdfDepose } from "@/server/pdf/attestation-deposee";
import { enregistrerObjet } from "@/server/storage";
import { verifierLimite, LIMITES } from "@/server/rate-limit";
import { preparerPhotoEntrante } from "@/server/photo-entrante";
import { logger } from "@/server/logger";
import { lireDevisFournisseur } from "@/server/ai/services/lire-devis-fournisseur";
import {
  ajouterDevisRecu,
  ajouterPrixAchat,
  creerSociete,
  getDevisRecu,
  getSociete,
  reglerMarge,
  reglerMargeSociete,
  retirerPrixAchat,
} from "@/server/repositories/fournisseurs-partenaires";
import { lireMarge, lirePrixHt, UNITES_ACHAT, type RubriqueAchat } from "@/lib/prix-achat";
import { sourceDuDevisLu, type LigneDevisLue } from "@/lib/devis-fournisseur-lu";
// Les mêmes bornes qu'un papier de véhicule : un PDF ou une photo de moins de
// 8 Mo. Une seconde liste de formats finirait par diverger de la première.
import { refusDuDocumentVehicule, typeDuDocument } from "@/lib/vehicules";

/**
 * LES GESTES DE « FOURNISSEURS ET PARTENAIRES » — sa planche du 18 et du
 * 19 octobre 2026. **Le patron seul** : ce sont ses prix d'achat et ses marges.
 *
 * Un refus attendu se rend en VALEUR, jamais en exception : le message d'une
 * exception levée ici n'arriverait pas jusqu'à son écran (`AGENTS.md`).
 */

type Refus = { ok: false; raison: string };

const rafraichir = () => revalidatePath("/reglages/fournisseurs");

async function patron(action: string): Promise<{ ok: true; ctx: Awaited<ReturnType<typeof getCurrentCtx>> } | Refus> {
  const ctx = await getCurrentCtx();
  try {
    await exigerProprietaire(ctx, action);
  } catch {
    return { ok: false, raison: "Seul le patron peut modifier ses fournisseurs et ses partenaires." };
  }
  return { ok: true, ctx };
}

function journaliser(quoi: string, err: unknown) {
  logger.error(quoi, { erreur: err instanceof Error ? err.message : String(err) });
}

export async function creerSocieteAction(rubrique: RubriqueAchat, nom: string): Promise<{ ok: true; id: string } | Refus> {
  const garde = await patron("ajouter un fournisseur ou un partenaire");
  if (!garde.ok) return garde;
  const propre = nom.replace(/\s+/g, " ").trim();
  if (!propre) return { ok: false, raison: "Donnez son nom." };
  if (rubrique !== "fournisseur" && rubrique !== "partenaire") return { ok: false, raison: "Cette rubrique n’existe pas." };
  try {
    const s = await creerSociete(garde.ctx, rubrique, propre.slice(0, 120));
    rafraichir();
    return { ok: true, id: s.id };
  } catch (err) {
    journaliser("Création d'un fournisseur impossible", err);
    return { ok: false, raison: "La société n’a pas pu être ajoutée. Réessayez." };
  }
}

/** Une des deux marges générales. Vide : plus de marge, la ligne reste à chiffrer. */
export async function reglerMargeGeneraleAction(
  laquelle: "materiel" | "mainOeuvre",
  brut: string
): Promise<{ ok: true; marge: string | null } | Refus> {
  const garde = await patron("régler une marge");
  if (!garde.ok) return garde;
  if (laquelle !== "materiel" && laquelle !== "mainOeuvre") return { ok: false, raison: "Cette marge n’existe pas." };
  const lu = lireMarge(brut);
  if (!lu.ok) return lu;
  try {
    const m = await reglerMarge(garde.ctx, laquelle, lu.marge);
    rafraichir();
    return { ok: true, marge: m[laquelle] };
  } catch (err) {
    journaliser("Réglage d'une marge impossible", err);
    return { ok: false, raison: "La marge n’a pas pu être enregistrée. Réessayez." };
  }
}

/** La marge d'une seule société. Vide : elle reprend la marge générale. */
export async function reglerMargeSocieteAction(id: string, brut: string): Promise<{ ok: true; marge: string | null } | Refus> {
  const garde = await patron("régler la marge d'une société");
  if (!garde.ok) return garde;
  const lu = lireMarge(brut);
  if (!lu.ok) return lu;
  try {
    const s = await reglerMargeSociete(garde.ctx, id, lu.marge);
    if (!s) return { ok: false, raison: "Cette société n’existe plus." };
    rafraichir();
    return { ok: true, marge: s.marge };
  } catch (err) {
    journaliser("Réglage de la marge d'une société impossible", err);
    return { ok: false, raison: "La marge n’a pas pu être enregistrée. Réessayez." };
  }
}

const aujourdhui = () => new Date().toLocaleDateString("fr-FR", { timeZone: "Europe/Paris" });

export async function ajouterPrixAction(
  societeId: string,
  ligne: { nom: string; unite: string; prix: string }
): Promise<{ ok: true } | Refus> {
  const garde = await patron("ajouter un prix d'achat");
  if (!garde.ok) return garde;
  const nom = ligne.nom.replace(/\s+/g, " ").trim().slice(0, 160);
  const prixHt = lirePrixHt(ligne.prix);
  if (!nom) return { ok: false, raison: "Donnez son nom." };
  if (prixHt === null) return { ok: false, raison: "Tapez son prix hors taxes." };
  try {
    const s = await getSociete(garde.ctx, societeId);
    if (!s) return { ok: false, raison: "Cette société n’existe plus." };
    if (!UNITES_ACHAT[s.rubrique].includes(ligne.unite)) return { ok: false, raison: "Choisissez son unité." };
    await ajouterPrixAchat(garde.ctx, s.id, { nom, unite: ligne.unite, prixHt, source: `Tapé le ${aujourdhui()}` });
    rafraichir();
    return { ok: true };
  } catch (err) {
    journaliser("Ajout d'un prix d'achat impossible", err);
    return { ok: false, raison: "Le prix n’a pas pu être enregistré. Réessayez." };
  }
}

export async function retirerPrixAction(id: string): Promise<{ ok: true } | Refus> {
  const garde = await patron("retirer un prix d'achat");
  if (!garde.ok) return garde;
  try {
    if (!(await retirerPrixAchat(garde.ctx, id))) return { ok: false, raison: "Ce prix n’existe plus." };
    rafraichir();
    return { ok: true };
  } catch (err) {
    journaliser("Retrait d'un prix d'achat impossible", err);
    return { ok: false, raison: "Le prix n’a pas pu être retiré. Réessayez." };
  }
}

/**
 * GARDER UN DEVIS REÇU — une photo ou un PDF, nommé. Le fichier est rangé tout
 * de suite (« se garde ») ; ce qu'Atlas y LIT est seulement rendu à l'écran.
 * **Aucun prix n'est écrit avant son accord** (`accepterLignesDuDevisAction`),
 * comme `ImportTarifs.tsx`.
 *
 * La lecture ne fait jamais échouer le dépôt : sans elle, le devis est gardé et
 * les prix se tapent à la main.
 */
export async function deposerDevisRecuAction(
  formData: FormData
): Promise<{ ok: true; devisId: string; lu: { lignes: LigneDevisLue[]; ecartees: number } | null } | Refus> {
  const garde = await patron("garder un devis reçu");
  if (!garde.ok) return garde;
  const { ctx } = garde;
  try {
    const fichier = formData.get("fichier");
    const societeId = formData.get("societeId");
    const nomDonne = formData.get("nom");
    if (!(fichier instanceof File)) return { ok: false, raison: "Aucun fichier reçu." };
    if (typeof societeId !== "string") return { ok: false, raison: "Cette société n’existe plus." };
    const societe = await getSociete(ctx, societeId);
    if (!societe) return { ok: false, raison: "Cette société n’existe plus." };

    const mime = fichier.type.split(";")[0].trim().toLowerCase();
    const refus = refusDuDocumentVehicule(mime, fichier.size);
    if (refus) return { ok: false, raison: refus };
    const limite = await verifierLimite(`televersement:${ctx.entrepriseId}`, LIMITES.televersementFichier);
    if (!limite.autorise) return { ok: false, raison: limite.message };

    let octets: Buffer;
    let extension: string;
    let mimeRange: string;
    if (mime === "application/pdf") {
      const brut = new Uint8Array(await fichier.arrayBuffer());
      const refusPdf = await refusDuPdfDepose(brut);
      if (refusPdf) return { ok: false, raison: refusPdf };
      octets = Buffer.from(brut);
      extension = ".pdf";
      mimeRange = mime;
    } else {
      // La porte commune des photos : signature vérifiée, position GPS retirée.
      const prete = await preparerPhotoEntrante(fichier, "devis reçu");
      if (!prete.ok) return { ok: false, raison: prete.raison };
      octets = Buffer.from(prete.photo.octets);
      extension = prete.photo.extension;
      mimeRange = prete.photo.mimeType;
    }
    if (!typeDuDocument(`devis${extension}`)) return { ok: false, raison: "Ce format ne se lit pas. Choisissez un PDF, ou une photo." };

    const objet = await enregistrerObjet(`entreprises/${ctx.entrepriseId}/devis-recus`, octets, extension, mimeRange);
    const nom = (typeof nomDonne === "string" ? nomDonne.replace(/\s+/g, " ").trim().slice(0, 120) : "") || `Devis du ${aujourdhui()}`;
    const devis = await ajouterDevisRecu(ctx, societe.id, {
      nom,
      fichierCle: objet.storageKey,
      fichierNom: mime === "application/pdf" ? fichier.name.slice(0, 160) : null,
      nature: mime === "application/pdf" ? "pdf" : "photo",
    });

    let lu: { lignes: LigneDevisLue[]; ecartees: number } | null = null;
    try {
      lu = await lireDevisFournisseur(octets.toString("base64"), mimeRange, societe.rubrique);
    } catch (err) {
      journaliser("Lecture d'un devis reçu impossible", err);
    }
    rafraichir();
    return { ok: true, devisId: devis.id, lu };
  } catch (err) {
    journaliser("Dépôt d'un devis reçu impossible", err);
    return { ok: false, raison: "Le devis n’a pas pu être gardé. Réessayez." };
  }
}

/**
 * Ce qu'il a accepté d'un devis lu passe dans « Mes prix ». **Rien n'est repris
 * du navigateur sans être relu** : nom, unité et prix se revalident ici, et la
 * société est celle du devis, jamais une autre.
 */
export async function accepterLignesDuDevisAction(
  devisId: string,
  lignes: { designation: string; reference?: string | null; unite: string; prixHt: string }[]
): Promise<{ ok: true; ajoutes: number; refuses: number } | Refus> {
  const garde = await patron("prendre les prix d'un devis reçu");
  if (!garde.ok) return garde;
  try {
    const devis = await getDevisRecu(garde.ctx, devisId);
    if (!devis) return { ok: false, raison: "Ce devis n’existe plus." };
    const societe = await getSociete(garde.ctx, devis.societeId);
    if (!societe) return { ok: false, raison: "Cette société n’existe plus." };
    let ajoutes = 0;
    let refuses = 0;
    for (const l of lignes.slice(0, 200)) {
      const nom = l.designation?.replace(/\s+/g, " ").trim().slice(0, 160);
      const prixHt = lirePrixHt(String(l.prixHt ?? ""));
      if (!nom || prixHt === null || !UNITES_ACHAT[societe.rubrique].includes(l.unite)) {
        refuses++;
        continue;
      }
      await ajouterPrixAchat(garde.ctx, societe.id, {
        nom,
        reference: typeof l.reference === "string" && l.reference.trim() ? l.reference.trim().slice(0, 60) : null,
        unite: l.unite,
        prixHt,
        releveLe: devis.recuLe,
        source: sourceDuDevisLu(devis.nom, devis.recuLe),
        devisRecuId: devis.id,
      });
      ajoutes++;
    }
    rafraichir();
    return { ok: true, ajoutes, refuses };
  } catch (err) {
    journaliser("Prise des prix d'un devis reçu impossible", err);
    return { ok: false, raison: "Les prix n’ont pas pu être enregistrés. Réessayez." };
  }
}
