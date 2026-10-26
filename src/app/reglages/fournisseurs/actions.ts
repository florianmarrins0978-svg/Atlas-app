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
import { lireFichierTarifs } from "@/server/import/lire-fichier-tarifs";
import {
  ajouterDevisRecu,
  ajouterPrixAchat,
  creerSociete,
  getDevisRecu,
  getSociete,
  poserTotauxDuDevisRecu,
  prixDeLaSociete,
  remplacerPrixAchat,
  reglerMarge,
  reglerContactSociete,
  reglerMargeSociete,
  retirerPrixAchat,
} from "@/server/repositories/fournisseurs-partenaires";
import { lireAdresseMail, lireMarge, lireMorceauDeMessage, lirePrixHt, UNITES_ACHAT, type RubriqueAchat } from "@/lib/prix-achat";
import {
  lignesDuTableau,
  rapprocherDuPrix,
  sourceDeLaFactureLue,
  sourceDuDevisLu,
  typeDuFichierRecu,
  type DevisLu,
  type PrixConnu,
} from "@/lib/devis-fournisseur-lu";
// Les mêmes bornes qu'un papier de véhicule : un PDF ou une photo de moins de
// 8 Mo. Une seconde liste de formats finirait par diverger de la première.
import { refusDuDocumentVehicule } from "@/lib/vehicules";

// La borne de l'import des tarifs : un tableur plus lourd n'est plus une liste de prix.
const TABLEUR_MAX_OCTETS = 5_000_000;

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

/**
 * L'adresse mail d'un fournisseur, et le début et la fin de SON message — sa
 * planche du 20 octobre 2026 (`appli/arrosage-prix-par-fournisseur.html`).
 * L'adresse se tape sur sa fiche, le message sous la liste du plan ; tous deux
 * se gardent pour les prochaines fois. Un champ absent ne bouge pas.
 */
export async function reglerContactAction(
  id: string,
  champs: { email?: string; debut?: string; fin?: string }
): Promise<{ ok: true; email: string | null; debut: string | null; fin: string | null } | Refus> {
  const garde = await patron("régler l'adresse ou le message d'un fournisseur");
  if (!garde.ok) return garde;
  const aRegler: { email?: string | null; debutMail?: string | null; finMail?: string | null } = {};
  if (typeof champs.email === "string") {
    const lu = lireAdresseMail(champs.email);
    if (!lu.ok) return lu;
    aRegler.email = lu.email;
  }
  if (typeof champs.debut === "string") aRegler.debutMail = lireMorceauDeMessage(champs.debut);
  if (typeof champs.fin === "string") aRegler.finMail = lireMorceauDeMessage(champs.fin);
  try {
    const avant = await getSociete(garde.ctx, id);
    if (!avant || avant.rubrique !== "fournisseur") return { ok: false, raison: "Ce fournisseur n’existe plus." };
    const s = await reglerContactSociete(garde.ctx, avant.id, aRegler);
    if (!s) return { ok: false, raison: "Ce fournisseur n’existe plus." };
    rafraichir();
    return { ok: true, email: s.email, debut: s.debutMail, fin: s.finMail };
  } catch (err) {
    journaliser("Réglage du contact d'un fournisseur impossible", err);
    // Dire CE qui n'a pas tenu : sa fiche n'envoie que l'adresse, la liste du
    // plan d'arrosage que le début ou la fin du message. « Ce n'a pas pu être
    // enregistré » n'était pas une phrase (planche du 26 octobre 2026).
    const quoi = typeof champs.email === "string" ? "L’adresse n’a pas pu être enregistrée" : "Le message n’a pas pu être enregistré";
    return { ok: false, raison: `${quoi}. Réessayez.` };
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
 * GARDER UN DEVIS OU UNE FACTURE REÇUS — une photo, un PDF, ou un fichier Excel
 * ou CSV (sa demande du 23 octobre 2026), nommé. Le fichier est rangé tout de
 * suite (« se garde ») ; ce qu'Atlas y LIT est seulement rendu à l'écran.
 * **Aucun prix n'est écrit avant son accord** (`accepterLignesDuDevisAction`),
 * comme `ImportTarifs.tsx`.
 *
 * La lecture ne fait jamais échouer le dépôt : sans elle, le document est gardé
 * et les prix se tapent à la main. Un tableur, lui, se lit AVANT d'être gardé :
 * celui que la règle des tarifs ne sait pas ouvrir est refusé avec sa raison,
 * plutôt que rangé illisible.
 */
export async function deposerDevisRecuAction(
  formData: FormData
): Promise<{ ok: true; devisId: string; lu: DevisLu | null } | Refus> {
  const garde = await patron("garder un devis ou une facture reçus");
  if (!garde.ok) return garde;
  const { ctx } = garde;
  try {
    const fichier = formData.get("fichier");
    const societeId = formData.get("societeId");
    const nomDonne = formData.get("nom");
    const genre = formData.get("genre") === "facture" ? "facture" : "devis";
    if (!(fichier instanceof File)) return { ok: false, raison: "Aucun fichier reçu." };
    if (typeof societeId !== "string") return { ok: false, raison: "Cette société n’existe plus." };
    const societe = await getSociete(ctx, societeId);
    if (!societe) return { ok: false, raison: "Cette société n’existe plus." };

    const mime = fichier.type.split(";")[0].trim().toLowerCase();
    // Un CSV n'a pas de type sûr (« text/csv », « application/vnd.ms-excel »,
    // ou rien du tout depuis un iPhone) : tout ce qui n'est ni un PDF ni une
    // image va à la règle des tarifs, qui reconnaît le fichier à son CONTENU.
    const estTableur = mime !== "application/pdf" && !mime.startsWith("image/");
    if (estTableur) {
      if (fichier.size === 0) return { ok: false, raison: "Ce fichier est vide." };
      if (fichier.size > TABLEUR_MAX_OCTETS) return { ok: false, raison: "Ce fichier dépasse 5 Mo. Prenez-en un plus léger." };
    } else {
      const refus = refusDuDocumentVehicule(mime, fichier.size);
      if (refus) return { ok: false, raison: refus };
    }
    const limite = await verifierLimite(`televersement:${ctx.entrepriseId}`, LIMITES.televersementFichier);
    if (!limite.autorise) return { ok: false, raison: limite.message };

    let octets: Buffer;
    let extension: string;
    let mimeRange: string;
    let nature: "photo" | "pdf" | "tableur";
    let lu: DevisLu | null = null;
    if (estTableur) {
      const brut = new Uint8Array(await fichier.arrayBuffer());
      const lecture = lireFichierTarifs(fichier.name, brut);
      if (lecture.statut === "refuse") return { ok: false, raison: lecture.raison };
      lu = lignesDuTableau(lecture.lecture, societe.rubrique);
      octets = Buffer.from(brut);
      extension = lecture.format === "excel" ? ".xlsx" : ".csv";
      mimeRange = typeDuFichierRecu(`f${extension}`)?.type ?? "application/octet-stream";
      nature = "tableur";
    } else if (mime === "application/pdf") {
      const brut = new Uint8Array(await fichier.arrayBuffer());
      const refusPdf = await refusDuPdfDepose(brut);
      if (refusPdf) return { ok: false, raison: refusPdf };
      octets = Buffer.from(brut);
      extension = ".pdf";
      mimeRange = mime;
      nature = "pdf";
    } else {
      // La porte commune des photos : signature vérifiée, position GPS retirée.
      const prete = await preparerPhotoEntrante(fichier, genre === "facture" ? "facture reçue" : "devis reçu");
      if (!prete.ok) return { ok: false, raison: prete.raison };
      octets = Buffer.from(prete.photo.octets);
      extension = prete.photo.extension;
      mimeRange = prete.photo.mimeType;
      nature = "photo";
    }
    if (!typeDuFichierRecu(`f${extension}`)) return { ok: false, raison: "Ce format ne se lit pas. Choisissez un PDF, une photo ou un fichier Excel." };

    const objet = await enregistrerObjet(`entreprises/${ctx.entrepriseId}/devis-recus`, octets, extension, mimeRange);
    const nom =
      (typeof nomDonne === "string" ? nomDonne.replace(/\s+/g, " ").trim().slice(0, 120) : "") ||
      `${genre === "facture" ? "Facture" : "Devis"} du ${aujourdhui()}`;
    const devis = await ajouterDevisRecu(ctx, societe.id, {
      nom,
      fichierCle: objet.storageKey,
      fichierNom: nature === "photo" ? null : fichier.name.slice(0, 160),
      nature,
      genre,
    });

    if (!estTableur) {
      try {
        lu = await lireDevisFournisseur(octets.toString("base64"), mimeRange, societe.rubrique);
      } catch (err) {
        journaliser("Lecture d'un devis reçu impossible", err);
      }
    }
    // Les totaux se gardent sur la facture même s'il ne prend aucun prix : ils
    // disent ce qu'il a payé, à côté du fichier.
    if (genre === "facture" && lu && (lu.totalHt !== null || lu.totalTtc !== null)) {
      await poserTotauxDuDevisRecu(ctx, devis.id, { totalHt: lu.totalHt, totalTtc: lu.totalTtc });
    }
    rafraichir();
    return { ok: true, devisId: devis.id, lu };
  } catch (err) {
    journaliser("Dépôt d'un devis reçu impossible", err);
    return { ok: false, raison: "Le document n’a pas pu être gardé. Réessayez." };
  }
}

/**
 * Ce qu'il a accepté d'un devis ou d'une facture lus passe dans ses prix, la
 * partie « Prix » de la fiche (et non « Mes prix », l'écran de ses grilles de
 * vente).
 * **Rien n'est repris du navigateur sans être relu** : nom, unité et prix se
 * revalident ici, et la société est celle du document, jamais une autre.
 *
 * **Une facture REMPLACE le prix qu'elle confirme ou corrige** : c'est ce qu'il
 * a vraiment payé. Le rapprochement se refait ici, sur les prix en base, avec
 * la règle qui a dessiné l'écran (`rapprocherDuPrix`). Un devis, lui, ajoute
 * comme avant : c'est une offre, pas un prix payé.
 */
export async function accepterLignesDuDevisAction(
  devisId: string,
  lignes: { designation: string; reference?: string | null; unite: string; prixHt: string }[]
): Promise<{ ok: true; ajoutes: number; refuses: number } | Refus> {
  const garde = await patron("prendre les prix d'un devis reçu");
  if (!garde.ok) return garde;
  try {
    const devis = await getDevisRecu(garde.ctx, devisId);
    if (!devis) return { ok: false, raison: "Ce document n’existe plus." };
    const societe = await getSociete(garde.ctx, devis.societeId);
    if (!societe) return { ok: false, raison: "Cette société n’existe plus." };
    const facture = devis.genre === "facture";
    let connus: PrixConnu[] = facture ? await prixDeLaSociete(garde.ctx, societe.id) : [];
    let ajoutes = 0;
    let refuses = 0;
    for (const l of lignes.slice(0, 200)) {
      const nom = l.designation?.replace(/\s+/g, " ").trim().slice(0, 160);
      const prixHt = lirePrixHt(String(l.prixHt ?? ""));
      if (!nom || prixHt === null || !UNITES_ACHAT[societe.rubrique].includes(l.unite)) {
        refuses++;
        continue;
      }
      const ligne = {
        nom,
        reference: typeof l.reference === "string" && l.reference.trim() ? l.reference.trim().slice(0, 60) : null,
        unite: l.unite,
        prixHt,
        releveLe: devis.recuLe,
        source: facture ? sourceDeLaFactureLue(devis.nom, devis.recuLe) : sourceDuDevisLu(devis.nom, devis.recuLe),
        devisRecuId: devis.id,
      };
      const r = facture ? rapprocherDuPrix({ designation: nom, reference: ligne.reference, unite: l.unite, prixHt }, connus) : null;
      const ancienId = r && r.etat !== "nouveau" ? r.ancien.id : null;
      const pose = ancienId ? await remplacerPrixAchat(garde.ctx, ancienId, ligne) : await ajouterPrixAchat(garde.ctx, societe.id, ligne);
      if (!pose) {
        refuses++;
        continue;
      }
      // Deux lignes de la même facture pour la même pièce : la seconde
      // remplace la première, jamais un prix déjà retiré.
      if (facture) connus = [pose, ...connus.filter((p) => p.id !== ancienId)];
      ajoutes++;
    }
    rafraichir();
    return { ok: true, ajoutes, refuses };
  } catch (err) {
    journaliser("Prise des prix d'un devis reçu impossible", err);
    return { ok: false, raison: "Les prix n’ont pas pu être enregistrés. Réessayez." };
  }
}
