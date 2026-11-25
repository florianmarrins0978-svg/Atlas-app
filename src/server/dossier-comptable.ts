import { gardeJusquAu, libelleMotif, refusDArret } from "@/lib/pour-mon-comptable";
import { categorieDeLaLigneComptable, numeroDuCompte, situationDe, lireNumerosChoisis, type CleCompta } from "@/lib/categories-comptables";
import {
  cleDeLaTva,
  enCentimes,
  montantsDeLaLigne,
  numerosDesPieces,
  prendUnNumeroA,
  registreDesVentes,
  type ChiffresDeLaPiece,
  type FactureDuDossier,
  type Justificatif,
} from "@/lib/dossier-du-comptable";
import { ecrituresDuDossier, enIso885915, nomDuFec, texteDuFec } from "@/lib/fec-import";
import { feuillesDuDossier } from "@/lib/excel-du-dossier";
import { ecrireClasseur } from "@/lib/xlsx";
import { logger } from "./logger";
import { enregistrerObjet, lireObjet, supprimerObjet } from "./storage";
import { getEntreprise } from "./repositories/entreprises";
import { liaisonDeLEntreprise } from "./repositories/banque";
import { ligneAJustifier, lignesDuReleve, pieceDeLaLigne, type LigneDuReleve } from "./repositories/pour-mon-comptable";
import { dossierEnCours, premierJourDesDossiers, rangerDossier } from "./repositories/dossiers-comptables";
import { facturesDuDossier } from "./repositories/ventes-du-dossier";
import { composerDossierComptable, type Fichier, type LignePourLeDossier, type PieceDeLaLigne } from "./pdf/dossier-comptable-pdf";
import type { Ctx } from "./repositories/context";
import { jourIso } from "@/lib/jour";

/**
 * ARRÊTER LE DOSSIER : lot 3 de « Pour mon comptable », et ses trois fichiers
 * depuis le 24 novembre 2026.
 *
 * Sa règle du 24 octobre 2026 : *« l'utilisateur décide quand il veut
 * l'arrêter, avec une touche »*. Le dossier va du lendemain du précédent
 * arrêt (ou, pour le premier, du jour qu'il choisit) jusqu'au jour choisi ;
 * il est refusé tant qu'une ligne de cette période attend sa pièce ; il sort
 * en PDF, en Excel et en FEC d'import, rangés ensemble, et ne s'efface plus.
 *
 * **Les trois sortent du même modèle, au même instant** : la catégorie et le
 * numéro de compte de chaque ligne, le numéro de sa pièce, son hors taxe et sa
 * TVA se calculent ici une fois (`src/lib/dossier-du-comptable.ts`), puis
 * chaque fichier les écrit. Deux calculs finiraient par donner au comptable
 * deux chiffres pour la même ligne.
 */

export type ResultatArret = { ok: true; id: string } | { ok: false; raison: string };

/**
 * Un fichier rangé, lu dans le stockage. Une pièce disparue n'empêche pas le
 * dossier : sa place le dit sur le PDF, et le journal dit pourquoi.
 */
async function lire(cle: string, nature: Fichier["nature"]): Promise<Fichier | null> {
  try {
    return { octets: new Uint8Array(await lireObjet(cle)), nature };
  } catch (err) {
    logger.warn("Une pièce du dossier du comptable est introuvable dans le stockage", {
      erreur: err instanceof Error ? err.message : String(err),
    });
    return null;
  }
}

/**
 * Le fichier qui justifie la ligne. Lequel, c'est `pieceDeLaLigne` qui le dit,
 * pour le dossier comme pour la page du comptable : deux choix finiraient par
 * poser deux pièces différentes. Un tableur n'en a pas (il ne se pose pas dans
 * un PDF : la ligne garde sa pièce réécrite).
 */
async function original(l: LigneDuReleve): Promise<Fichier | null> {
  const o = pieceDeLaLigne(l);
  return o ? lire(o.cle, o.nature === "pdf" ? "pdf" : "image") : null;
}

const veille = (jour: string) => {
  const d = new Date(`${jour}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
};

type Contexte = {
  situation: ReturnType<typeof situationDe>;
  choisis: ReturnType<typeof lireNumerosChoisis>;
  franchise: boolean;
  /** Les factures du dossier, par numéro : ce qu'une ligne payée par l'une d'elles en lit. */
  factures: Map<string, FactureDuDossier>;
};

function justificatifDe(l: LigneDuReleve): { genre: Justificatif; mots: string } {
  if (l.justification === "ticket" && l.ticket) return { genre: "ticket", mots: `Ticket ${l.ticket.fournisseur}` };
  if (l.justification === "facture" && l.factureRecue) return { genre: "facture", mots: `Facture ${l.factureRecue.societe}, ${l.factureRecue.nom}` };
  if (l.justification === "facture_hors_atlas") return { genre: "facture-hors-cause", mots: l.sens === "sortie" ? "Facture du fournisseur" : "Facture faite hors de Cause" };
  if (l.factureEmise) return { genre: "facture-emise", mots: `Facture ${l.factureEmise.numero}, émise par Cause` };
  if (l.justification === "ticket_perdu") return { genre: "perdu", mots: "Ticket perdu, mention validée" };
  return { genre: "motif", mots: l.motif ? `Par sa nature : ${libelleMotif(l.motif, l.sens).toLocaleLowerCase("fr-FR")}` : "Par sa nature" };
}

function chiffresDe(l: LigneDuReleve): ChiffresDeLaPiece {
  if (l.justification === "ticket" && l.ticket) return { genre: "ticket", tva: enCentimes(l.ticket.tvaDeductible), ttc: l.ticket.totalTtc === null ? null : enCentimes(l.ticket.totalTtc) };
  if (l.justification === "facture" && l.factureRecue) {
    return { genre: "facture", ht: l.factureRecue.totalHt === null ? null : enCentimes(l.factureRecue.totalHt), ttc: l.factureRecue.totalTtc === null ? null : enCentimes(l.factureRecue.totalTtc) };
  }
  if (l.justification === "facture_hors_atlas") return { genre: "non-lue" };
  return { genre: "aucune" };
}

async function pourLeDossier(l: LigneDuReleve, ref: string, x: Contexte): Promise<LignePourLeDossier> {
  const cle: CleCompta = categorieDeLaLigneComptable({
    sens: l.sens,
    justification: l.justification,
    motif: l.motif,
    natureDuTicket: l.ticket?.nature ?? null,
    factureEmise: l.factureEmise !== null,
    choisie: l.categorieChoisie,
  });
  const ttc = enCentimes(l.montant);
  const montants = montantsDeLaLigne({ cle, sens: l.sens, ttc, franchise: x.franchise, perdu: l.justification === "ticket_perdu", piece: chiffresDe(l) });
  const cleTva = cleDeLaTva(cle);
  const facture = l.factureEmise ? x.factures.get(l.factureEmise.numero) : undefined;
  const justificatif = justificatifDe(l);

  const piece: PieceDeLaLigne | null =
    l.justification === "ticket" && l.ticket
      ? {
          genre: "ticket",
          fournisseur: l.ticket.fournisseur,
          date: l.ticket.dateAchat,
          totalTtc: l.ticket.totalTtc,
          tva: l.ticket.tvaDeductible,
          photo: await original(l),
          photoNette: l.ticket.photoNetteCle ? await lire(l.ticket.photoNetteCle, "image") : null,
          lignes: l.ticket.lignesImprimees,
        }
      : l.justification === "facture" && l.factureRecue
        ? { genre: "facture", societe: l.factureRecue.societe, nom: l.factureRecue.nom, totalTtc: l.factureRecue.totalTtc, fichier: await original(l) }
        : l.justification === "facture_hors_atlas" && l.pieceJointe
          ? { genre: "facture-hors-atlas", sortie: l.sens === "sortie", totalTtc: l.pieceJointe.total, fichier: await original(l) }
          : l.factureEmise
            ? { genre: "facture-emise", numero: l.factureEmise.numero }
            : null;

  return {
    ref,
    jour: l.jour,
    libelle: l.libelle || (l.contrepartie ?? ""),
    sens: l.sens,
    ttc,
    ...montants,
    cle,
    compte: numeroDuCompte(cle, x.situation, x.choisis),
    compteTva: cleTva && montants.tva > 0 ? numeroDuCompte(cleTva, x.situation, x.choisis) : null,
    tiers: l.ticket?.fournisseur ?? l.factureRecue?.societe ?? facture?.client ?? l.contrepartie ?? null,
    pieceDate: l.justification === "ticket" && l.ticket ? l.ticket.dateAchat : null,
    achat: l.sens === "sortie" && (l.justification === "facture" || l.justification === "facture_hors_atlas"),
    // Ce que la facture vaut après TOUS ses avoirs : c'est sur ce total que se
    // compte la part de TVA d'un paiement (`apresAvoirs`, `exigibilite-tva.ts`).
    facture: facture
      ? {
          numero: facture.numero,
          client: facture.client,
          tva: facture.tva - facture.avoirs.reduce((s, a) => s + a.tva, 0),
          ttc: facture.ttc - facture.avoirs.reduce((s, a) => s + a.ttc, 0),
        }
      : null,
    justificatif: justificatif.genre,
    pieceEnMots: justificatif.mots,
    piece,
    ticketPerdu: l.justification === "ticket_perdu",
    motif: l.justification === "motif" ? l.motif : null,
    ecart: l.ecart,
  };
}

/**
 * Combien de pièces « A » l'année a déjà rangées avant ce dossier : les lignes
 * de l'année depuis le tout premier dossier, jusqu'à la veille de celui-ci.
 */
async function piecesDejaRangees(ctx: Ctx, du: string): Promise<Record<string, number>> {
  const annee = du.slice(0, 4);
  const premier = (await premierJourDesDossiers(ctx)) ?? du;
  const debut = [`${annee}-01-01`, premier].sort().at(-1)!;
  if (debut >= du) return { [annee]: 0 };
  const avant = await lignesDuReleve(ctx, debut, veille(du));
  return { [annee]: avant.filter((l) => prendUnNumeroA({ factureEmise: l.factureEmise?.numero ?? null })).length };
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

  const [entreprise, liaison, deja] = await Promise.all([getEntreprise(ctx), liaisonDeLEntreprise(ctx), piecesDejaRangees(ctx, du)]);
  const numerosPayes = lignes.flatMap((l) => (l.factureEmise ? [l.factureEmise.numero] : []));
  const factures = await facturesDuDossier(ctx, du, demande.au, numerosPayes);
  const x: Contexte = {
    situation: situationDe({ formeJuridique: entreprise?.formeJuridique ?? null }),
    choisis: lireNumerosChoisis(entreprise?.numerosComptes ?? {}),
    franchise: entreprise?.regimeTva === "franchise",
    factures: new Map(factures.map((f) => [f.numero, f])),
  };
  const exigibilite = entreprise?.tvaExigibilite ?? "encaissements";
  const compte = (cle: CleCompta) => numeroDuCompte(cle, x.situation, x.choisis);
  const refs = numerosDesPieces(
    lignes.map((l) => ({ jour: l.jour, factureEmise: l.factureEmise?.numero ?? null })),
    deja
  );
  const pourLePdf: LignePourLeDossier[] = [];
  for (const [i, l] of lignes.entries()) pourLePdf.push(await pourLeDossier(l, refs[i]!, x));
  const ventes = registreDesVentes(factures, du, demande.au);
  const comptes = {
    clients: compte("clients"),
    fournisseurs: compte("fournisseurs"),
    banque: compte("banque"),
    ventes: compte("ventes"),
    tvaCollectee: compte("tvaCollectee"),
    tvaEnAttente: compte("tvaEnAttente"),
    tvaDeductible: compte("tvaDeductible"),
    tvaImmobilisations: compte("tvaImmobilisations"),
  };

  const garde = gardeJusquAu(demande.au);
  const { pdf, pageDe } = await composerDossierComptable({
    entreprise: { nom: entreprise?.nom ?? "", siret: entreprise?.siret ?? null, adresse: entreprise?.adresse ?? null },
    banque: liaison ? liaison.banque || "Banque reliée" : null,
    du,
    au: demande.au,
    rangeLe: aujourdhui,
    gardeJusquAu: garde,
    lignes: pourLePdf,
    ventes,
    comptes,
    exigibilite,
    franchise: x.franchise,
  });
  const ecritures = ecrituresDuDossier({ du, au: demande.au, exigibilite, franchise: x.franchise, comptes, ventes: ventes.periode, lignes: pourLePdf });
  const fec = enIso885915(texteDuFec(ecritures));
  const excel = await ecrireClasseur(
    feuillesDuDossier({ ventes: ventes.periode, lignes: pourLePdf, ecritures, comptes, compteDesVentes: comptes.ventes, pageDe, compteDe: compte }),
    demande.maintenant
  );

  const dossier = `entreprises/${ctx.entrepriseId}/dossiers`;
  const [objetPdf, objetExcel, objetFec] = await Promise.all([
    enregistrerObjet(dossier, Buffer.from(pdf), ".pdf", "application/pdf"),
    enregistrerObjet(dossier, Buffer.from(excel), ".xlsx", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"),
    enregistrerObjet(dossier, Buffer.from(fec), ".txt", "text/plain; charset=iso-8859-15"),
  ]);
  const r = await rangerDossier(ctx, {
    du,
    au: demande.au,
    fichierCle: objetPdf.storageKey,
    tailleOctets: objetPdf.tailleOctets,
    empreinte: objetPdf.checksum,
    gardeJusquAu: garde,
    excelCle: objetExcel.storageKey,
    fecCle: objetFec.storageKey,
  });
  // Rangé deux fois (deux appuis rapprochés) : les fichiers du second ne servent à rien.
  if (!r.ok) await Promise.all([objetPdf, objetExcel, objetFec].map((o) => supprimerObjet(o.storageKey)));
  return r;
}

/** Le nom sous lequel le FEC d'un dossier rangé se télécharge. */
export async function nomDuFecDuDossier(ctx: Ctx, d: { du: string; au: string }): Promise<string> {
  const entreprise = await getEntreprise(ctx);
  return nomDuFec(entreprise?.siret ?? null, d.du, d.au);
}
