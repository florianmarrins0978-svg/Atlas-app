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
  listerSocietes,
  poserTotauxDuDevisRecu,
  prixDeLaSociete,
  remplacerPrixAchat,
  reglerMarge,
  reglerContactSociete,
  reglerMargeSociete,
  retirerPrixAchat,
} from "@/server/repositories/fournisseurs-partenaires";
import { lireAdresseMail, lireMarge, lireMorceauDeMessage, lirePrixHt, lireTelephone, UNITES_ACHAT, type RubriqueAchat } from "@/lib/prix-achat";
import { getEntreprise } from "@/server/repositories/entreprises";
import { normaliserPourRecherche } from "@/lib/recherche-client";
import {
  lignesDuTableau,
  rapprocherDuPrix,
  sourceDeLaFactureLue,
  societeReconnue,
  sourceDuDevisLu,
  typeDuFichierRecu,
  type DevisLu,
  type EmetteurLu,
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
  champs: { email?: string; telephone?: string; debut?: string; fin?: string }
): Promise<{ ok: true; email: string | null; telephone: string | null; debut: string | null; fin: string | null } | Refus> {
  const garde = await patron("régler l'adresse ou le message d'un fournisseur");
  if (!garde.ok) return garde;
  const aRegler: { email?: string | null; telephone?: string | null; debutMail?: string | null; finMail?: string | null } = {};
  if (typeof champs.email === "string") {
    const lu = lireAdresseMail(champs.email);
    if (!lu.ok) return lu;
    aRegler.email = lu.email;
  }
  if (typeof champs.telephone === "string") {
    const lu = lireTelephone(champs.telephone);
    if (!lu.ok) return lu;
    aRegler.telephone = lu.telephone;
  }
  if (typeof champs.debut === "string") aRegler.debutMail = lireMorceauDeMessage(champs.debut);
  if (typeof champs.fin === "string") aRegler.finMail = lireMorceauDeMessage(champs.fin);
  try {
    const avant = await getSociete(garde.ctx, id);
    if (!avant || avant.rubrique !== "fournisseur") return { ok: false, raison: "Ce fournisseur n’existe plus." };
    const s = await reglerContactSociete(garde.ctx, avant.id, aRegler);
    if (!s) return { ok: false, raison: "Ce fournisseur n’existe plus." };
    rafraichir();
    return { ok: true, email: s.email, telephone: s.telephone, debut: s.debutMail, fin: s.finMail };
  } catch (err) {
    journaliser("Réglage du contact d'un fournisseur impossible", err);
    // Dire CE qui n'a pas tenu : sa fiche n'envoie que l'adresse, la liste du
    // plan d'arrosage que le début ou la fin du message. « Ce n'a pas pu être
    // enregistré » n'était pas une phrase (planche du 26 octobre 2026).
    const quoi =
      typeof champs.email === "string"
        ? "L’adresse n’a pas pu être enregistrée"
        : typeof champs.telephone === "string"
          ? "Le téléphone n’a pas pu être enregistré"
          : "Le message n’a pas pu être enregistré";
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
 * Le fichier reçu, vérifié comme tout fichier qui entre : un tableur se lit
 * AVANT d'être gardé (celui que la règle des tarifs ne sait pas ouvrir est
 * refusé avec sa raison, plutôt que rangé illisible) ; une photo passe la
 * porte commune (signature vérifiée, position GPS retirée) ; un PDF est relu.
 * Le dépôt dans une fiche et le dépôt depuis la liste passent ici l'un et
 * l'autre : une seule porte pour un même fichier.
 */
type FichierPret = {
  octets: Buffer;
  extension: string;
  mimeRange: string;
  nature: "photo" | "pdf" | "tableur";
  nomDuFichier: string;
  /** Ce que la règle des tarifs a lu d'un tableur ; `null` pour une photo ou un PDF, que lit l'IA. */
  luDuTableur: DevisLu | null;
};

async function preparerLeFichier(
  fichier: unknown,
  genre: "devis" | "facture",
  rubrique: RubriqueAchat,
  entrepriseId: string
): Promise<{ ok: true; pret: FichierPret } | Refus> {
  if (!(fichier instanceof File)) return { ok: false, raison: "Aucun fichier reçu." };
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
  const limite = await verifierLimite(`televersement:${entrepriseId}`, LIMITES.televersementFichier);
  if (!limite.autorise) return { ok: false, raison: limite.message };

  let pret: FichierPret;
  if (estTableur) {
    const brut = new Uint8Array(await fichier.arrayBuffer());
    const lecture = lireFichierTarifs(fichier.name, brut);
    if (lecture.statut === "refuse") return { ok: false, raison: lecture.raison };
    const extension = lecture.format === "excel" ? ".xlsx" : ".csv";
    pret = {
      octets: Buffer.from(brut),
      extension,
      mimeRange: typeDuFichierRecu(`f${extension}`)?.type ?? "application/octet-stream",
      nature: "tableur",
      nomDuFichier: fichier.name.slice(0, 160),
      luDuTableur: lignesDuTableau(lecture.lecture, rubrique),
    };
  } else if (mime === "application/pdf") {
    const brut = new Uint8Array(await fichier.arrayBuffer());
    const refusPdf = await refusDuPdfDepose(brut);
    if (refusPdf) return { ok: false, raison: refusPdf };
    pret = { octets: Buffer.from(brut), extension: ".pdf", mimeRange: mime, nature: "pdf", nomDuFichier: fichier.name.slice(0, 160), luDuTableur: null };
  } else {
    const prete = await preparerPhotoEntrante(fichier, genre === "facture" ? "facture reçue" : "devis reçu");
    if (!prete.ok) return { ok: false, raison: prete.raison };
    pret = {
      octets: Buffer.from(prete.photo.octets),
      extension: prete.photo.extension,
      mimeRange: prete.photo.mimeType,
      nature: "photo",
      nomDuFichier: fichier.name.slice(0, 160),
      luDuTableur: null,
    };
  }
  if (!typeDuFichierRecu(`f${pret.extension}`)) return { ok: false, raison: "Ce format ne se lit pas. Choisissez un PDF, une photo ou un fichier Excel." };
  return { ok: true, pret };
}

/** Ce qui se lit du fichier : le tableur par la règle des tarifs, le reste par l'IA. Jamais d'échec : sans lecture, `null`. */
async function lireLeFichier(pret: FichierPret, rubrique: RubriqueAchat): Promise<DevisLu | null> {
  if (pret.nature === "tableur") return pret.luDuTableur;
  try {
    return await lireDevisFournisseur(pret.octets.toString("base64"), pret.mimeRange, rubrique);
  } catch (err) {
    journaliser("Lecture d'un devis reçu impossible", err);
    return null;
  }
}

async function garderLeFichier(
  ctx: Awaited<ReturnType<typeof getCurrentCtx>>,
  societeId: string,
  pret: FichierPret,
  nomDonne: unknown,
  genre: "devis" | "facture"
) {
  const objet = await enregistrerObjet(`entreprises/${ctx.entrepriseId}/devis-recus`, pret.octets, pret.extension, pret.mimeRange);
  const nom =
    (typeof nomDonne === "string" ? nomDonne.replace(/\s+/g, " ").trim().slice(0, 120) : "") ||
    `${genre === "facture" ? "Facture" : "Devis"} du ${aujourdhui()}`;
  return ajouterDevisRecu(ctx, societeId, {
    nom,
    fichierCle: objet.storageKey,
    fichierNom: pret.nature === "photo" ? null : pret.nomDuFichier,
    nature: pret.nature,
    genre,
  });
}

/**
 * GARDER UN DEVIS OU UNE FACTURE REÇUS — une photo, un PDF, ou un fichier Excel
 * ou CSV (sa demande du 23 octobre 2026), nommé. Le fichier est rangé tout de
 * suite (« se garde ») ; ce qu'Atlas y LIT est seulement rendu à l'écran.
 * **Aucun prix n'est écrit avant son accord** (`accepterLignesDuDevisAction`),
 * comme `ImportTarifs.tsx`.
 *
 * La lecture ne fait jamais échouer le dépôt : sans elle, le document est gardé
 * et les prix se tapent à la main.
 */
export async function deposerDevisRecuAction(
  formData: FormData
): Promise<{ ok: true; devisId: string; lu: DevisLu | null } | Refus> {
  const garde = await patron("garder un devis ou une facture reçus");
  if (!garde.ok) return garde;
  const { ctx } = garde;
  try {
    const societeId = formData.get("societeId");
    const genre = formData.get("genre") === "facture" ? "facture" : "devis";
    if (typeof societeId !== "string") return { ok: false, raison: "Cette société n’existe plus." };
    const societe = await getSociete(ctx, societeId);
    if (!societe) return { ok: false, raison: "Cette société n’existe plus." };
    const prep = await preparerLeFichier(formData.get("fichier"), genre, societe.rubrique, ctx.entrepriseId);
    if (!prep.ok) return prep;
    const devis = await garderLeFichier(ctx, societe.id, prep.pret, formData.get("nom"), genre);
    const lu = await lireLeFichier(prep.pret, societe.rubrique);
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

type LigneAPrendre = { designation: string; reference?: string | null; unite: string; prixHt: string };

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
async function prendreLesLignes(
  ctx: Awaited<ReturnType<typeof getCurrentCtx>>,
  devis: { id: string; nom: string; recuLe: string; genre: "devis" | "facture" },
  societe: { id: string; rubrique: RubriqueAchat },
  lignes: readonly LigneAPrendre[]
): Promise<{ ajoutes: number; refuses: number }> {
  const facture = devis.genre === "facture";
  let connus: PrixConnu[] = facture ? await prixDeLaSociete(ctx, societe.id) : [];
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
    const pose = ancienId ? await remplacerPrixAchat(ctx, ancienId, ligne) : await ajouterPrixAchat(ctx, societe.id, ligne);
    if (!pose) {
      refuses++;
      continue;
    }
    // Deux lignes de la même facture pour la même pièce : la seconde
    // remplace la première, jamais un prix déjà retiré.
    if (facture) connus = [pose, ...connus.filter((p) => p.id !== ancienId)];
    ajoutes++;
  }
  return { ajoutes, refuses };
}

export async function accepterLignesDuDevisAction(
  devisId: string,
  lignes: LigneAPrendre[]
): Promise<{ ok: true; ajoutes: number; refuses: number } | Refus> {
  const garde = await patron("prendre les prix d'un devis reçu");
  if (!garde.ok) return garde;
  try {
    const devis = await getDevisRecu(garde.ctx, devisId);
    if (!devis) return { ok: false, raison: "Ce document n’existe plus." };
    const societe = await getSociete(garde.ctx, devis.societeId);
    if (!societe) return { ok: false, raison: "Cette société n’existe plus." };
    const r = await prendreLesLignes(garde.ctx, devis, societe, lignes);
    rafraichir();
    return { ok: true, ...r };
  } catch (err) {
    journaliser("Prise des prix d'un devis reçu impossible", err);
    return { ok: false, raison: "Les prix n’ont pas pu être enregistrés. Réessayez." };
  }
}

// ── Un devis déposé sans choisir la société ────────────────────────────────
//
// Sa planche du 19 novembre 2026 (`appli/fournisseur-depuis-son-devis.html`),
// codée le 20 sur son « oui » : depuis la liste, il prend un devis en photo
// sans choisir le fournisseur. Cause lit son nom, son mail, son téléphone et
// ses prix ; nouveau, sa fiche se propose préremplie ; déjà chez lui, la
// sienne se complète. **En deux temps, et rien n'est gardé au premier** : lire
// ne range ni le fichier ni la société, ranger se fait sur son appui, avec le
// même fichier renvoyé. « Ne rien créer » ne laisse donc aucune trace.

export type SocieteProposee = { id: string; nom: string; email: string | null; telephone: string | null };

/**
 * L'en-tête lu, sans ce qui est à lui : un modèle qui recopierait le nom de
 * l'artisan (le destinataire, imprimé lui aussi) lui ferait créer sa propre
 * entreprise comme fournisseur.
 */
function pasLuiMeme(e: EmetteurLu | null, sonNom: string | null): EmetteurLu | null {
  if (!e?.nom || !sonNom) return e;
  if (normaliserPourRecherche(e.nom) !== normaliserPourRecherche(sonNom)) return e;
  return e.email === null && e.telephone === null ? null : { ...e, nom: null };
}

export async function lireUnDevisSansSocieteAction(formData: FormData): Promise<
  | { ok: true; lu: DevisLu | null; emetteur: EmetteurLu | null; reconnue: SocieteProposee | null; siennes: SocieteProposee[] }
  | Refus
> {
  const garde = await patron("lire un devis reçu");
  if (!garde.ok) return garde;
  const { ctx } = garde;
  const rubrique: RubriqueAchat = formData.get("rubrique") === "partenaire" ? "partenaire" : "fournisseur";
  try {
    const prep = await preparerLeFichier(formData.get("fichier"), "devis", rubrique, ctx.entrepriseId);
    if (!prep.ok) return prep;
    const [lu, entreprise, societes] = await Promise.all([lireLeFichier(prep.pret, rubrique), getEntreprise(ctx), listerSocietes(ctx, rubrique)]);
    const emetteur = pasLuiMeme(lu?.emetteur ?? null, entreprise?.nom ?? null);
    const siennes = societes.map((x) => ({ id: x.id, nom: x.nom, email: x.email, telephone: x.telephone }));
    return { ok: true, lu, emetteur, reconnue: societeReconnue(emetteur, siennes), siennes };
  } catch (err) {
    journaliser("Lecture d'un devis sans société impossible", err);
    return { ok: false, raison: "Le devis n’a pas pu être lu. Réessayez." };
  }
}

/**
 * Ranger le devis lu, sur son appui : chez la société choisie (dont le mail et
 * le téléphone qui manquaient se complètent, jamais ne s'écrasent), ou chez
 * une société créée de ce qu'il a relu. Puis les prix cochés, par la même
 * règle que la fiche (`prendreLesLignes`).
 */
export async function rangerLeDevisLuAction(
  formData: FormData
): Promise<{ ok: true; societeId: string; ajoutes: number; refuses: number } | Refus> {
  const garde = await patron("ranger un devis reçu");
  if (!garde.ok) return garde;
  const { ctx } = garde;
  const rubrique: RubriqueAchat = formData.get("rubrique") === "partenaire" ? "partenaire" : "fournisseur";
  const texte = (cle: string) => {
    const v = formData.get(cle);
    return typeof v === "string" ? v : "";
  };
  let lignes: LigneAPrendre[];
  try {
    const brutes: unknown = JSON.parse(texte("lignes") || "[]");
    lignes = Array.isArray(brutes) ? (brutes as LigneAPrendre[]) : [];
  } catch (err) {
    journaliser("Lignes d'un devis lu illisibles", err);
    return { ok: false, raison: "Les prix cochés ne se lisent pas. Rechargez l’écran." };
  }
  const mail = lireAdresseMail(texte("email"));
  if (!mail.ok) return mail;
  const tel = lireTelephone(texte("telephone"));
  if (!tel.ok) return tel;
  try {
    // Le fichier d'abord : refusé, il ne doit laisser derrière lui ni société
    // créée, ni contact complété.
    const prep = await preparerLeFichier(formData.get("fichier"), "devis", rubrique, ctx.entrepriseId);
    if (!prep.ok) return prep;
    let societeId: string;
    const choisie = texte("societeId");
    if (choisie) {
      const s = await getSociete(ctx, choisie);
      if (!s || s.rubrique !== rubrique) return { ok: false, raison: "Cette société n’existe plus. Rechargez l’écran." };
      const manquants: { email?: string | null; telephone?: string | null } = {};
      if (s.email === null && mail.email) manquants.email = mail.email;
      if (s.telephone === null && tel.telephone) manquants.telephone = tel.telephone;
      if (Object.keys(manquants).length > 0) await reglerContactSociete(ctx, s.id, manquants);
      societeId = s.id;
    } else {
      const nom = texte("nom").replace(/\s+/g, " ").trim().slice(0, 120);
      if (!nom) return { ok: false, raison: "Donnez son nom." };
      const creee = await creerSociete(ctx, rubrique, nom, { email: mail.email, telephone: tel.telephone });
      societeId = creee.id;
    }
    const devis = await garderLeFichier(ctx, societeId, prep.pret, formData.get("nomDevis"), "devis");
    const r = await prendreLesLignes(ctx, devis, { id: societeId, rubrique }, lignes);
    rafraichir();
    return { ok: true, societeId, ...r };
  } catch (err) {
    journaliser("Rangement d'un devis lu impossible", err);
    return { ok: false, raison: "Le devis n’a pas pu être rangé. Réessayez." };
  }
}
