import { categorieDeLaLigne, gardeJusquAu, refusDArret } from "@/lib/pour-mon-comptable";
import { logger } from "./logger";
import { enregistrerObjet, lireObjet, supprimerObjet } from "./storage";
import { getEntreprise } from "./repositories/entreprises";
import { liaisonDeLEntreprise } from "./repositories/banque";
import { ligneAJustifier, lignesDuReleve, type LigneDuReleve } from "./repositories/pour-mon-comptable";
import { dossierEnCours, rangerDossier } from "./repositories/dossiers-comptables";
import { composerDossierComptable, type Fichier, type LignePourLeDossier } from "./pdf/dossier-comptable-pdf";
import type { Ctx } from "./repositories/context";
import { jourIso } from "@/lib/jour";

/**
 * ARRÊTER LE DOSSIER — lot 3 de « Pour mon comptable ».
 *
 * Sa règle du 24 octobre 2026 : *« l'utilisateur décide quand il veut
 * l'arrêter, avec une touche »*. Le dossier va du lendemain du précédent
 * arrêt (ou, pour le premier, du jour qu'il choisit) jusqu'au jour choisi ;
 * il est refusé tant qu'une ligne de cette période attend sa pièce ; il sort
 * en PDF, rangé avec son empreinte, et ne s'efface plus.
 */

export type ResultatArret = { ok: true; id: string } | { ok: false; raison: string };

/** Le fichier d'une pièce, lu dans le stockage. Une pièce disparue n'empêche pas le dossier. */
async function lire(cle: string | null, nature: Fichier["nature"]): Promise<Fichier | null> {
  if (!cle) return null;
  try {
    return { octets: new Uint8Array(await lireObjet(cle)), nature };
  } catch (err) {
    logger.warn("Une pièce du dossier du comptable est introuvable dans le stockage", {
      erreur: err instanceof Error ? err.message : String(err),
    });
    return null;
  }
}

async function pourLeDossier(l: LigneDuReleve): Promise<LignePourLeDossier> {
  const categorie = categorieDeLaLigne({ sens: l.sens, libelle: l.libelle, natureDuTicket: l.ticket?.nature ?? null, justification: l.justification });
  const piece: LignePourLeDossier["piece"] =
    l.justification === "ticket" && l.ticket
      ? {
          genre: "ticket",
          fournisseur: l.ticket.fournisseur,
          date: l.ticket.dateAchat,
          totalTtc: l.ticket.totalTtc,
          tva: l.ticket.tvaDeductible,
          photo: await lire(l.ticket.photoCle, "image"),
          lignes: l.ticket.lignesImprimees,
        }
      : l.justification === "facture" && l.factureRecue
        ? {
            genre: "facture",
            societe: l.factureRecue.societe,
            nom: l.factureRecue.nom,
            totalTtc: l.factureRecue.totalTtc,
            // Un tableur ne se pose pas dans un PDF : la ligne garde la pièce
            // réécrite, et le fichier reste dans Atlas.
            fichier: l.factureRecue.nature === "tableur" ? null : await lire(l.factureRecue.fichierCle, l.factureRecue.nature === "pdf" ? "pdf" : "image"),
          }
        : l.factureEmise
          ? { genre: "facture-emise", numero: l.factureEmise.numero }
          : null;
  return {
    jour: l.jour,
    libelle: l.libelle || (l.contrepartie ?? ""),
    sens: l.sens,
    montant: l.montant,
    categorie,
    piece,
    ticketPerdu: l.justification === "ticket_perdu",
    motif: l.justification === "motif" ? l.motif : null,
  };
}

export async function arreterLeDossier(ctx: Ctx, demande: { du: string | null; au: string; maintenant: Date }): Promise<ResultatArret> {
  const enCours = await dossierEnCours(ctx, demande.maintenant);
  // Le début ne se choisit qu'au PREMIER dossier ; ensuite, c'est le lendemain
  // du précédent, et rien d'autre : deux dossiers ne couvrent jamais un même jour.
  const du = enCours.premier && demande.du ? demande.du : enCours.du;
  const aujourdhui = jourIso(demande.maintenant);
  const refus = refusDArret({ du, au: demande.au, aujourdhui });
  if (refus) return { ok: false, raison: refus };

  const lignes = await lignesDuReleve(ctx, du, demande.au);
  const manquent = lignes.filter(ligneAJustifier).length;
  if (manquent > 0) {
    return {
      ok: false,
      raison: `${manquent} ${manquent > 1 ? "lignes attendent" : "ligne attend"} encore un justificatif avant cette date. Réglez-les d'abord au Check up.`,
    };
  }

  const [entreprise, liaison] = await Promise.all([getEntreprise(ctx), liaisonDeLEntreprise(ctx)]);
  const garde = gardeJusquAu(demande.au);
  const pdf = await composerDossierComptable({
    entreprise: { nom: entreprise?.nom ?? "", siret: entreprise?.siret ?? null, adresse: entreprise?.adresse ?? null },
    banque: liaison ? liaison.banque || "Banque reliée" : null,
    du,
    au: demande.au,
    rangeLe: aujourdhui,
    gardeJusquAu: garde,
    lignes: await Promise.all(lignes.map(pourLeDossier)),
  });

  const objet = await enregistrerObjet(`entreprises/${ctx.entrepriseId}/dossiers`, Buffer.from(pdf), ".pdf", "application/pdf");
  const r = await rangerDossier(ctx, {
    du,
    au: demande.au,
    fichierCle: objet.storageKey,
    tailleOctets: objet.tailleOctets,
    empreinte: objet.checksum,
    gardeJusquAu: garde,
  });
  // Rangé deux fois (deux appuis rapprochés) : le second PDF ne sert à rien.
  if (!r.ok) await supprimerObjet(objet.storageKey);
  return r;
}
