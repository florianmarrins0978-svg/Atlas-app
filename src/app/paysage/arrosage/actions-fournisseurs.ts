"use server";

import { revalidatePath } from "next/cache";
import { getCurrentCtx } from "@/server/session-ctx";
import { estProprietaire } from "@/server/autorisation";
import { logger } from "@/server/logger";
import { enregistrerDemande, getSociete, prixDesFournisseursPourLePlan } from "@/server/repositories/fournisseurs-partenaires";
import type { LigneDemandeEnvoyee } from "@/server/db/schema";
import { refusDuPdfDepose } from "@/server/pdf/attestation-deposee";
import { verifierLimite, LIMITES } from "@/server/rate-limit";
import { preparerPhotoEntrante } from "@/server/photo-entrante";
import { lireDevisFournisseur } from "@/server/ai/services/lire-devis-fournisseur";
import type { LigneDevisLue } from "@/lib/devis-fournisseur-lu";
// Les mêmes bornes qu'un devis reçu dans les réglages : un PDF ou une photo de moins de 8 Mo.
import { refusDuDocumentVehicule } from "@/lib/vehicules";
import { getConfigIA } from "@/server/ai/config";
import { etatVision } from "@/lib/etat-ia";

/**
 * Ce que l'écran du plan demande à « Fournisseurs et partenaires » — ses
 * planches du 18 octobre 2026 (les prix sur le plan, l'import d'un devis).
 *
 * **Le patron seul** lit ses prix d'achat, comme dans les réglages : à tout
 * autre rôle, l'écran ne reçoit rien et la partie « Le matériel du plan » ne
 * s'affiche pas. Un refus attendu se rend en valeur (`AGENTS.md`).
 */

export async function prixDesFournisseursAction(): Promise<Awaited<ReturnType<typeof prixDesFournisseursPourLePlan>> | null> {
  const ctx = await getCurrentCtx();
  if (!(await estProprietaire(ctx))) return null;
  return prixDesFournisseursPourLePlan(ctx);
}

/**
 * La liste envoyée s'enregistre chez le fournisseur choisi, dans « Demandes
 * envoyées » : sa demande du 19 octobre 2026, *« quand j'envoie ma liste de
 * pièces à Aqua Plus, il faut que ma liste s'enregistre dans une catégorie »*.
 */
export async function enregistrerLaDemandeAction(
  societeId: string,
  titre: string,
  lignes: LigneDemandeEnvoyee[]
): Promise<{ ok: true; nom: string } | { ok: false; raison: string }> {
  const ctx = await getCurrentCtx();
  if (!(await estProprietaire(ctx))) return { ok: false, raison: "Seul le patron enregistre ses demandes." };
  try {
    const s = await getSociete(ctx, societeId);
    if (!s || s.rubrique !== "fournisseur") return { ok: false, raison: "Ce fournisseur n’existe plus." };
    const propres = lignes.slice(0, 300).map((l) => ({
      designation: String(l.designation ?? "").slice(0, 200),
      reference: l.reference ? String(l.reference).slice(0, 60) : null,
      quantite: String(l.quantite ?? "").slice(0, 30),
    }));
    await enregistrerDemande(ctx, s.id, { titre: titre.trim().slice(0, 120) || "Plan d’arrosage", origine: "arrosage", lignes: propres });
    revalidatePath("/reglages/fournisseurs");
    return { ok: true, nom: s.nom };
  } catch (err) {
    logger.error("Enregistrement d'une demande au fournisseur impossible", { erreur: err instanceof Error ? err.message : String(err) });
    return { ok: false, raison: "La liste n’a pas pu être enregistrée. Réessayez." };
  }
}

/**
 * LIRE UN DEVIS FOURNISSEUR POUR LE PLAN — sa planche du 18 octobre 2026. La
 * photo ou le PDF est lu par l'IA (`lireDevisFournisseur`, la lecture des
 * réglages) et **rien n'est gardé** : l'écran reconnaît les pièces
 * (`devis-du-plan.ts`) et compose la nourrice.
 */
export async function lireLeDevisDuPlanAction(formData: FormData): Promise<{ ok: true; lignes: LigneDevisLue[]; ecartees: number } | { ok: false; raison: string }> {
  const ctx = await getCurrentCtx();
  // Sans lecteur d'images, le dire tel quel : « reprenez la photo » enverrait
  // chercher au mauvais endroit (la même règle que l'écran, `etatVision`).
  const vision = etatVision(getConfigIA());
  if (!vision.prete) return { ok: false, raison: `${vision.raison} Le devis ne sera pas lu.` };
  try {
    const fichier = formData.get("fichier");
    if (!(fichier instanceof File)) return { ok: false, raison: "Aucun fichier reçu." };
    const mime = fichier.type.split(";")[0].trim().toLowerCase();
    const refus = refusDuDocumentVehicule(mime, fichier.size);
    if (refus) return { ok: false, raison: refus };
    const limite = await verifierLimite(`televersement:${ctx.entrepriseId}`, LIMITES.televersementFichier);
    if (!limite.autorise) return { ok: false, raison: limite.message };
    let base64: string;
    let mimeLu: string;
    if (mime === "application/pdf") {
      const brut = new Uint8Array(await fichier.arrayBuffer());
      const refusPdf = await refusDuPdfDepose(brut);
      if (refusPdf) return { ok: false, raison: refusPdf };
      base64 = Buffer.from(brut).toString("base64");
      mimeLu = mime;
    } else {
      const prete = await preparerPhotoEntrante(fichier, "devis fournisseur");
      if (!prete.ok) return { ok: false, raison: prete.raison };
      base64 = Buffer.from(prete.photo.octets).toString("base64");
      mimeLu = prete.photo.mimeType;
    }
    const lu = await lireDevisFournisseur(base64, mimeLu, "fournisseur");
    if (!lu) return { ok: false, raison: "Le devis n’a pas pu être lu. Reprenez la photo, bien à plat." };
    return { ok: true, lignes: lu.lignes, ecartees: lu.ecartees };
  } catch (err) {
    logger.error("Lecture d'un devis pour le plan impossible", { erreur: err instanceof Error ? err.message : String(err) });
    return { ok: false, raison: "Le devis n’a pas pu être lu. Réessayez." };
  }
}
