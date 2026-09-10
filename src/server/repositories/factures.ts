import { and, asc, desc, eq, isNotNull, isNull, or, sql } from "drizzle-orm";
import Decimal from "decimal.js";
import { withEntreprise } from "../db/with-entreprise";
import { allureDesDocuments, formatNumeroDe } from "./entreprises";
import { ecrireNumero, repartChaqueAnnee } from "@/lib/numero-documents";
import type { DbOrTx } from "../db/client";
import {
  chantiers,
  clients,
  devis,
  entreprises,
  factures,
  lignesDevis,
  lignesFacture,
  parametresChiffrage,
} from "../db/schema";
import type { Ctx } from "./context";
import { lireDevisQuiFaitFoi } from "./devis";
import { genererPdfFacture, type FacturePdfData } from "../pdf/facture-pdf";
import { enregistrerObjet } from "../storage";
import { jourIso } from "../../lib/jour";
import { echeanceFacture } from "../../lib/rappels";
import { validerEcheance } from "../../lib/echeance-facture";
import { ALLURE_PAR_DEFAUT } from "../../lib/allure-documents";
import { repriseDuDevis } from "../../lib/facture-face-au-devis";
import { factureNeeSansDevis } from "../../lib/lignes-corrigeables";
import { totauxAvecReduction } from "../../lib/reduction-devis";
import { ongletDepuisJalons } from "../../lib/onglet-chantier";
import {
  dansLaPeriode,
  enAttenteDeReglement,
  entreesDuReleve,
  type Exigibilite,
} from "../../lib/exigibilite-tva";
import { exigibiliteDe, facturesAvecPaiements, facturesEnAttente } from "./paiements-facture";
import {
  consigneDuLibelle,
  ibanSansEspace,
  messageNouvelIban,
  modalitesDeLaFacture,
  modalitesDePaiement,
  porteUnAutreIban,
} from "../../lib/modalites-paiement";
import { avecCivilite, type CiviliteChoisie } from "../../lib/civilite";

// Fin de chantier, facture et TVA — docs/AGENT.md §2.3.
//
// La facture naît du devis : mêmes lignes, mêmes montants. C'est ce qui permet
// à l'écran de confirmation d'être franchissable en un geste quand rien n'a
// bougé — il n'y a rien à ressaisir, seulement à vérifier.
//
// Rappel de §6 : Atlas PRÉPARE la facture, il ne l'émet pas au sens légal.

/** Délai de paiement porté sur la facture, à défaut d'accord particulier. */
const DELAI_PAIEMENT_JOURS = 30;

/**
 * Le taux du document quand il n'a jamais ouvert ses paramètres de chiffrage.
 *
 * **La même valeur que la colonne**, `parametres_chiffrage.taux_tva_defaut`,
 * qui la porte en `DEFAULT '20.00'`. Elle ne sert qu'aux factures directes
 * d'une entreprise dont la ligne de paramètres n'existe pas encore — le devis,
 * lui, passe par `getOuCreerParametresChiffrage`, qui la crée.
 */
const TAUX_TVA_PAR_DEFAUT = "20.00";

// Numérotation atomique, calquée sur celle des devis : le verrou de ligne posé
// par cet UPDATE sérialise les créations concurrentes d'une même entreprise.
// `prochain_numero_facture` est le PROCHAIN numéro libre, pas le dernier pris.
//
// **LE MILLÉSIME N'EST PLUS ÉCRIT EN DUR — correctif du 26 août 2026**, et la
// remise à 1 du 1ᵉʳ janvier se joue DANS l'UPDATE : voir le commentaire jumeau
// de `attribuerNumeroDevis`, qui porte le pourquoi en entier.
//
// **Les deux suites restent distinctes**, et c'est la règle du dessus : mêler
// devis et factures rendrait illisible la numérotation continue qu'attend un
// contrôle. D'où deux colonnes de compteur ET deux colonnes d'année — un devis
// peut partir en décembre et sa facture en janvier.
export async function attribuerNumeroFacture(tx: DbOrTx, entrepriseId: string): Promise<string> {
  const maintenant = new Date();
  const annee = maintenant.getFullYear();
  const mois = maintenant.getMonth() + 1;

  const format = await formatNumeroDe(tx, entrepriseId);
  const remise = repartChaqueAnnee(format);

  const result: unknown = await tx.execute(sql`
    UPDATE entreprise_compteurs
    SET prochain_numero_facture = CASE
          WHEN ${remise} AND annee_facture IS DISTINCT FROM ${annee} THEN 2
          ELSE prochain_numero_facture + 1
        END,
        annee_facture = ${annee}
    WHERE entreprise_id = ${entrepriseId}
    RETURNING prochain_numero_facture - 1 AS numero
  `);
  const numero = (result as { rows: { numero: number }[] }).rows[0].numero;
  return ecrireNumero(format, "facture", { annee, mois, numero });
}

/**
 * CE QU'UNE FACTURE RECOPIE DE SON DEVIS — écrit une fois, appelé deux fois.
 *
 * Ce que le client a accepté : **lui-même, et les prix**. C'est cela, et rien
 * d'autre, qui doit traverser depuis le devis.
 *
 * **Pourquoi une fonction plutôt que deux listes de champs.** La création
 * (`terminerChantier`) et la reprise (`reprendreLeDevisSurLaFacture`) recopient
 * exactement les mêmes colonnes. Deux listes tenues à la main auraient divergé
 * au premier champ ajouté — et le champ oublié, ce serait un prix, une adresse
 * ou un prix accordé absent de la facture (`CLAUDE.md` §3).
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * **L'IDENTITÉ DE L'ÉMETTEUR N'EN FAIT PLUS PARTIE — corrigé le 8 septembre
 * 2026, sur sa question.** *« Lorsque l'utilisateur modifie son IBAN dans ses
 * réglages ou le nom de sa société, les infos se modifient automatiquement dans
 * le lien que recevra le client ? »* — puis : *« ne fais pas de pansement, je
 * veux que tu corriges le problème à la racine. »*
 *
 * Elles ne se modifiaient pas, et la racine était ici : la facture recopiait
 * l'identité DU DEVIS, figée le jour du devis. **Un devis de janvier facturé en
 * juin partait avec l'IBAN de janvier** — et si l'artisan avait changé de banque
 * entre-temps, son client virait l'argent sur un compte fermé, sur une facture
 * toute neuve. Le nom de l'entreprise avait le même défaut, en pire : une
 * facture porte alors une raison sociale qui n'existe plus.
 *
 * Une facture n'est pas une copie du devis : c'est une pièce NEUVE, émise
 * aujourd'hui, qui porte l'identité d'aujourd'hui. C'est la règle que suivaient
 * déjà le régime de TVA (migration 0039) et le délai de paiement ; elle vaut
 * désormais pour toute l'identité (`identiteDeLEmetteur`, migration 0076).
 *
 * **Ce qui n'en fait PAS partie non plus :** le numéro commercial (consommé, il
 * ne se rejoue pas), la date d'émission et l'échéance (celles de la facture).
 */
/**
 * CE QU'UNE FACTURE TIENT DE SON ORIGINE — d'un devis, ou de la fiche client.
 *
 * **Ce type est ce qui empêche les deux portes de diverger** (`CLAUDE.md` §3).
 * Il est tiré des colonnes de la table, pas écrit à la main : le jour où une
 * colonne obligatoire s'ajoute, les DEUX chemins cessent de compiler — celui du
 * devis et celui de la facture directe. Une liste recopiée, elle, aurait laissé
 * le second partir sans elle, et le champ manquant aurait été un prix ou une
 * adresse absents des seules factures faites sans devis.
 */
type OrigineDeLaFacture = Pick<
  typeof factures.$inferInsert,
  | "devisId"
  | "clientNom"
  | "clientCivilite"
  | "clientAdresse"
  | "clientTelephone"
  | "clientEmail"
  | "adresseChantier"
  | "tauxTva"
  | "totalHt"
  | "totalTva"
  | "totalTtc"
  | "conditionsPaiement"
  | "devise"
  | "reductionPourcent"
  | "reductionMontant"
>;

function instantaneDuDevis(d: typeof devis.$inferSelect): OrigineDeLaFacture {
  return {
    devisId: d.id,
    clientNom: d.clientNom,
    clientCivilite: d.clientCivilite,
    clientAdresse: d.clientAdresse,
    clientTelephone: d.clientTelephone,
    clientEmail: d.clientEmail,
    adresseChantier: d.adresseChantier,
    conditionsPaiement: d.conditionsPaiement,
    devise: d.devise,
    tauxTva: d.tauxTva,
    totalHt: d.totalHt,
    totalTva: d.totalTva,
    totalTtc: d.totalTtc,
    // **Le prix accordé suit le devis jusqu'ici, et c'est la moitié de la
    // fonctionnalité.** Une remise consentie sur le devis puis absente de la
    // facture ferait payer au client le prix qu'on venait de lui retirer — et
    // c'est lui qui s'en apercevrait.
    reductionPourcent: d.reductionPourcent,
    reductionMontant: d.reductionMontant,
  };
}

/**
 * L'IDENTITÉ DE L'ÉMETTEUR, LUE SUR L'ENTREPRISE — au moment où la facture naît.
 *
 * **Les colonnes que cette fonction rend sont ensuite FIGÉES**, et c'est
 * essentiel : le PDF servi au client est le fichier ARCHIVÉ à l'arrêt, jamais un
 * document reconstruit (`factures/[jeton]/pdf/route.ts`). Si la page du client
 * lisait l'entreprise vivante pendant que le PDF porte l'ancienne valeur, le même
 * envoi montrerait DEUX IBAN au même client — pire que le défaut qu'on répare.
 *
 * Ce qui a changé le 8 septembre 2026 n'est donc pas le figeage : c'est son
 * INSTANT. Il était au devis, il est à la facture.
 *
 * **Le titulaire du compte y entre (migration 0076)** : un chèque libellé à
 * l'enseigne quand le compte est ouvert au nom propre se fait refuser au
 * guichet, et rien ne le figeait jusqu'ici.
 */
type EntreprisePourFacture = Pick<
  typeof entreprises.$inferSelect,
  | "nom"
  | "adresse"
  | "siret"
  | "email"
  | "telephone"
  | "iban"
  | "titulaireCompte"
  | "formeJuridique"
  | "capitalSocial"
  | "villeRcs"
  | "mentionsLegalesPosition"
  | "regimeTva"
>;

const COLONNES_EMETTEUR = {
  nom: entreprises.nom,
  adresse: entreprises.adresse,
  siret: entreprises.siret,
  email: entreprises.email,
  telephone: entreprises.telephone,
  iban: entreprises.iban,
  titulaireCompte: entreprises.titulaireCompte,
  formeJuridique: entreprises.formeJuridique,
  capitalSocial: entreprises.capitalSocial,
  villeRcs: entreprises.villeRcs,
  mentionsLegalesPosition: entreprises.mentionsLegalesPosition,
  regimeTva: entreprises.regimeTva,
} as const;

function identiteDeLEmetteur(e: EntreprisePourFacture | undefined) {
  return {
    // **Le nom ne peut pas être vide en base**, et une facture sans émetteur
    // n'est pas une facture : l'entreprise introuvable rend une chaîne vide
    // plutôt que de faire tomber l'insertion sur une contrainte, ce qui
    // n'apprendrait rien à personne. En pratique elle existe toujours — on est
    // dans son propre contexte d'entreprise.
    entrepriseNom: e?.nom ?? "",
    entrepriseAdresse: e?.adresse ?? null,
    entrepriseSiret: e?.siret ?? null,
    entrepriseEmail: e?.email ?? null,
    entrepriseTelephone: e?.telephone ?? null,
    entrepriseIban: e?.iban ?? null,
    entrepriseTitulaireCompte: e?.titulaireCompte ?? null,
    entrepriseFormeJuridique: e?.formeJuridique ?? null,
    entrepriseCapitalSocial: e?.capitalSocial ?? null,
    entrepriseVilleRcs: e?.villeRcs ?? null,
    entrepriseMentionsLegalesPosition: e?.mentionsLegalesPosition ?? null,
    // Le régime au jour de l'émission (migration 0039) : il était déjà lu ici,
    // et il rejoint simplement le reste de l'identité.
    entrepriseRegimeTva: e?.regimeTva ?? null,
  };
}

/** Les lignes de la facture, recopiées de celles du devis. */
function lignesRecopiees(
  entrepriseId: string,
  factureId: string,
  lignes: (typeof lignesDevis.$inferSelect)[]
) {
  return lignes.map((l) => ({
    entrepriseId,
    factureId,
    libelle: l.libelle,
    quantite: l.quantite,
    prixUnitaire: l.prixUnitaire,
    montant: l.montant,
    // **Sans ce report, une facture née d'un devis à deux TVA se réglait sur un
    // seul taux** — et l'écart partait dans une déclaration trimestrielle, là
    // où il coûte à l'artisan (migration 0073).
    tauxTva: l.tauxTva,
    ordre: l.ordre,
  }));
}

export class FinChantierImpossibleError extends Error {
  constructor(readonly motif: "devis_absent" | "devis_non_envoye" | "deja_facture") {
    super(motif);
    this.name = "FinChantierImpossibleError";
  }
}

/**
 * Déclare le chantier terminé et bâtit sa facture, en brouillon.
 *
 * Rien ne part ici : c'est précisément l'objet de l'arrêt 3 (docs/AGENT.md
 * §2.3). Le patron voit la facture avant qu'elle n'existe pour son client.
 *
 * Idempotente : rappuyer sur « Fin de chantier » redonne la facture déjà bâtie
 * plutôt que d'en créer une seconde. Un double appui est le geste le plus banal
 * qui soit sur un téléphone, et deux factures pour un chantier doubleraient la
 * TVA collectée.
 */
export async function terminerChantier(ctx: Ctx, chantierId: string, maintenant: Date = new Date()) {
  return withEntreprise(ctx.utilisateurId, ctx.entrepriseId, async (tx) => {
    const [existante] = await tx
      .select()
      .from(factures)
      .where(eq(factures.chantierId, chantierId))
      .limit(1);
    if (existante) {
      if (existante.statut === "emise") throw new FinChantierImpossibleError("deja_facture");
      return existante;
    }

    const [chantier] = await tx
      .select()
      .from(chantiers)
      .where(and(eq(chantiers.id, chantierId), eq(chantiers.entrepriseId, ctx.entrepriseId)))
      .limit(1);
    if (!chantier) throw new FinChantierImpossibleError("devis_absent");

    // **La dernière version ENVOYÉE, et non la dernière version.** Facturer sur
    // un brouillon reviendrait à facturer un prix que le client n'a jamais vu ;
    // mais prendre la dernière *quelle qu'elle soit* faisait refuser un chantier
    // dont la v1 était bel et bien partie, au motif — faux — qu'aucun devis
    // n'avait été envoyé. Voir `lireDevisQuiFaitFoi`.
    const [devisSource] = await lireDevisQuiFaitFoi(tx, chantierId);
    if (!devisSource) {
      // **Les deux refus n'appellent pas le même geste**, et le patron doit
      // savoir lequel : écrire le devis, ou l'envoyer.
      const [unDevisQuelconque] = await tx
        .select({ id: devis.id })
        .from(devis)
        .where(eq(devis.chantierId, chantierId))
        .limit(1);
      throw new FinChantierImpossibleError(unDevisQuelconque ? "devis_non_envoye" : "devis_absent");
    }

    const lignes = await tx
      .select()
      .from(lignesDevis)
      .where(eq(lignesDevis.devisId, devisSource.id))
      .orderBy(asc(lignesDevis.ordre));

    const facture = await poserLaFactureBrouillon(tx, ctx, {
      chantierId,
      // Du devis : le client et les prix — ce qu'il a accepté.
      instantane: instantaneDuDevis(devisSource),
      maintenant,
    });

    if (lignes.length > 0) {
      await tx.insert(lignesFacture).values(lignesRecopiees(ctx.entrepriseId, facture.id, lignes));
    }

    return facture;
  });
}

/**
 * CE QUE TOUTE FACTURE POSE, D'OÙ QU'ELLE VIENNE.
 *
 * **Écrit une fois, appelé deux fois** — par `terminerChantier`, qui la bâtit
 * depuis un devis, et par `creerFactureSansDevis`, qui la bâtit depuis la fiche
 * du client. Ce sont les deux seules portes, et ce qu'elles ont en commun est
 * exactement ce qui ne doit pas diverger : le numéro consommé, l'identité de
 * l'émetteur figée à cet instant, l'échéance déduite de son délai réglé, et le
 * chantier passé en terminé.
 *
 * **Deux listes de champs auraient divergé au premier ajout**, et le champ
 * oublié aurait été un IBAN ou un SIRET absent des seules factures directes —
 * c'est-à-dire une facture sans mention légale, invisible tant qu'on ne facture
 * qu'avec devis (`CLAUDE.md` §3).
 *
 * Ce qui reste au dehors, et c'est voulu : les LIGNES. Elles sont recopiées du
 * devis d'un côté, saisies à la main de l'autre — il n'y a rien à mettre en
 * commun.
 */
async function poserLaFactureBrouillon(
  tx: DbOrTx,
  ctx: Ctx,
  {
    chantierId,
    instantane,
    maintenant,
  }: {
    chantierId: string;
    /** Le client et les prix — du devis, ou de la fiche client. */
    instantane: OrigineDeLaFacture;
    maintenant: Date;
  }
) {
  // **TOUTE l'identité de l'émetteur se lit MAINTENANT**, pour être figée dans
  // la facture — une pièce comptable garde ce qu'elle portait le jour de son
  // émission. Le régime de TVA le faisait déjà seul depuis la migration 0039 ;
  // le nom, l'adresse, le SIRET et surtout l'IBAN venaient encore du devis, et
  // pouvaient dater de plusieurs mois (migration 0076, `identiteDeLEmetteur`).
  //
  // Le délai de paiement se lit du même coup : c'est lui qui PROPOSE
  // l'échéance par défaut, plutôt qu'un « 30 » écrit en dur qui contredisait
  // la mention « Paiement à X jours » qu'il avait réglée.
  const [entrepriseCourante] = await tx
    .select({ ...COLONNES_EMETTEUR, delaiPaiementJours: entreprises.delaiPaiementJours })
    .from(entreprises)
    .where(eq(entreprises.id, ctx.entrepriseId))
    .limit(1);

  const numeroCommercial = await attribuerNumeroFacture(tx, ctx.entrepriseId);
  // Son délai réglé quand il en a posé un (0 = comptant), 30 jours à défaut.
  const echeance = echeanceFacture(
    maintenant,
    entrepriseCourante?.delaiPaiementJours ?? DELAI_PAIEMENT_JOURS
  );

  const [facture] = await tx
    .insert(factures)
    .values({
      entrepriseId: ctx.entrepriseId,
      chantierId,
      numeroCommercial,
      ...instantane,
      // De l'entreprise, à cet instant : l'émetteur et ses modalités de
      // paiement. L'ordre compte peu ici (les deux ne partagent aucune clé),
      // mais il se lit dans le sens de la règle.
      ...identiteDeLEmetteur(entrepriseCourante),
      dateEmission: jourIso(maintenant),
      dateEcheance: jourIso(echeance),
      createdBy: ctx.utilisateurId,
    })
    .returning();

  await tx
    .update(chantiers)
    .set({
      termineAt: sql`COALESCE(termine_at, now())`,
      updatedBy: ctx.utilisateurId,
      updatedAt: maintenant,
    })
    .where(eq(chantiers.id, chantierId));

  return facture;
}

/** Ce qui bloque une facture directe, et le geste que chaque refus appelle. */
export class FactureDirecteImpossibleError extends Error {
  constructor(readonly motif: "chantier_absent" | "deja_facture" | "chantier_avec_devis") {
    super(motif);
    this.name = "FactureDirecteImpossibleError";
  }
}

/**
 * FACTURER SANS PASSER PAR LA CASE DEVIS — sa demande du 10 septembre 2026.
 *
 * *« Il faut que l'on puisse facturer sans avoir besoin de passer par la case
 * devis. »* Un dépannage fait dans la journée et réglé sur place : il n'y a
 * jamais eu de devis, et il n'y en aura pas.
 *
 * **La facture naît VIDE**, et c'est tout l'écart avec `terminerChantier`. Là,
 * les lignes viennent du devis — ce que le client a accepté. Ici, il n'y a rien
 * à reprendre : il les saisit lui-même sur l'écran d'après, chacune avec sa TVA
 * (`ajouterLigneDeFacture`). Poser une ligne d'exemple « pour l'aider » serait
 * une prestation inventée sur une pièce comptable (`CLAUDE.md` §4).
 *
 * ─── LE CLIENT SE LIT SUR SA FICHE, ET IL S'Y FIGE ─────────────────────────
 *
 * Même règle que le devis : une facture dit comment on s'adressait à son
 * destinataire LE JOUR où elle a été établie (migration 0038). Corriger la
 * fiche du client six mois plus tard ne doit pas réécrire une facture partie.
 *
 * ─── CE QUI EST REFUSÉ, ET POURQUOI CHAQUE REFUS ─────────────────────────
 *
 *   · `deja_facture` — une facture par chantier, c'est la contrainte
 *     `factures_chantier_uk`. On le dit ici pour que le refus arrive à l'écran
 *     plutôt que sous forme de panne ;
 *   · `chantier_avec_devis` — **sa décision, portée sur la planche :** « on ne
 *     touche pas aux chantiers existants ; un chantier ouvert sans devis
 *     continuera de refuser la facture ». Un chantier QUI A un devis se facture
 *     par la porte ordinaire, sans quoi le prix que le client a accepté ne
 *     serait repris nulle part. Les deux portes ne doivent jamais mener au même
 *     chantier.
 *
 * **Le numéro de facture est consommé ici**, comme partout : une facture
 * abandonnée laisse un trou dans la suite, et c'est le comportement voulu — une
 * numérotation qui se rebouche est une numérotation qu'un contrôle refuse.
 */
export async function creerFactureSansDevis(
  ctx: Ctx,
  chantierId: string,
  maintenant: Date = new Date()
) {
  return withEntreprise(ctx.utilisateurId, ctx.entrepriseId, async (tx) => {
    const [chantier] = await tx
      .select()
      .from(chantiers)
      .where(and(eq(chantiers.id, chantierId), eq(chantiers.entrepriseId, ctx.entrepriseId)))
      .limit(1);
    if (!chantier) throw new FactureDirecteImpossibleError("chantier_absent");

    const [dejaFacture] = await tx
      .select({ id: factures.id })
      .from(factures)
      .where(eq(factures.chantierId, chantierId))
      .limit(1);
    if (dejaFacture) throw new FactureDirecteImpossibleError("deja_facture");

    const [unDevis] = await tx
      .select({ id: devis.id })
      .from(devis)
      .where(eq(devis.chantierId, chantierId))
      .limit(1);
    if (unDevis) throw new FactureDirecteImpossibleError("chantier_avec_devis");

    const [client] = chantier.clientId
      ? await tx.select().from(clients).where(eq(clients.id, chantier.clientId)).limit(1)
      : [];

    // Le taux du DOCUMENT — celui qu'il a réglé pour ses chiffrages, jamais un
    // « 20 » écrit en dur qui contredirait son réglage. Il ne sert qu'aux lignes
    // qui ne portent pas le leur : chacune porte sa TVA (migration 0073), et
    // c'est ce que la planche montre.
    const [parametres] = await tx
      .select({ taux: parametresChiffrage.tauxTvaDefaut })
      .from(parametresChiffrage)
      .where(eq(parametresChiffrage.entrepriseId, ctx.entrepriseId))
      .limit(1);

    return poserLaFactureBrouillon(tx, ctx, {
      chantierId,
      instantane: {
        // **NUL, et c'est le fait qu'il n'y a pas eu de devis** (migration
        // 0085) — pas une donnée manquante qu'on comblerait plus tard.
        devisId: null,
        // Aucune remise : il n'y a pas de prix accepté d'avance sur lequel en
        // consentir une. Ce qu'il facture EST le prix qu'il vient de saisir.
        reductionPourcent: null,
        reductionMontant: null,
        conditionsPaiement: null,
        clientNom: client?.nom ?? null,
        clientCivilite: client?.civilite ?? null,
        clientAdresse: client?.adresse ?? null,
        clientTelephone: client?.telephone ?? null,
        clientEmail: client?.email ?? null,
        adresseChantier: chantier.adresseChantier,
        tauxTva: parametres?.taux ?? TAUX_TVA_PAR_DEFAUT,
        // **Zéro parce qu'elle est VIDE**, et non parce qu'on ignore le
        // montant. Les trois totaux se recalculent depuis les lignes à chaque
        // affichage comme à l'émission (`totauxAvecReduction`) : ces colonnes
        // ne sont qu'un point de départ, jamais ce qui fait foi.
        totalHt: "0.00",
        totalTva: "0.00",
        totalTtc: "0.00",
      },
      maintenant,
    });
  });
}

export async function getFacturePourChantier(ctx: Ctx, chantierId: string) {
  return withEntreprise(ctx.utilisateurId, ctx.entrepriseId, async (tx) => {
    const [facture] = await tx
      .select()
      .from(factures)
      .where(eq(factures.chantierId, chantierId))
      .limit(1);
    if (!facture) return null;
    const lignes = await tx
      .select()
      .from(lignesFacture)
      .where(eq(lignesFacture.factureId, facture.id))
      .orderBy(asc(lignesFacture.ordre));
    // **De QUEL devis ces lignes viennent, et l'écran doit le dire.** Le PDF
    // l'écrit depuis toujours — « Établie à partir du devis n° … » —, l'écran du
    // patron non : il montrait « Reprise du devis » sans jamais nommer lequel.
    // C'est précisément l'information qui manquait pour voir qu'une v2 envoyée
    // depuis n'avait pas atteint la facture.
    //
    // **Une facture directe n'en a pas, et on ne va pas le chercher** (migration
    // 0085). Interroger la table sur un identifiant nul ne rendrait rien de toute
    // façon — mais une requête qu'on sait vide est une requête qu'on n'écrit pas.
    const [devisRepris] = facture.devisId
      ? await tx
          .select({ numero: devis.numeroCommercial, version: devis.numeroVersion })
          .from(devis)
          .where(eq(devis.id, facture.devisId))
          .limit(1)
      : [];
    return {
      facture,
      lignes,
      numeroDevis: devisRepris?.numero ?? null,
      versionDevis: devisRepris?.version ?? null,
    };
  });
}

/**
 * REPREND LE DEVIS QUI FAIT FOI SUR UNE FACTURE ENCORE EN BROUILLON.
 *
 * **Le défaut qu'elle referme, et c'était de l'argent perdu.** `terminerChantier`
 * est idempotente : rappuyer sur « Créer la facture » redonne la facture déjà
 * bâtie plutôt que d'en créer une seconde — c'est juste, un double appui est le
 * geste le plus banal sur un téléphone. Mais cela voulait dire aussi qu'un devis
 * corrigé et renvoyé APRÈS la fin de chantier n'atteignait **jamais** la
 * facture : elle gardait les lignes et les montants d'avant, et le second arrêt
 * du parcours se franchissait sur l'ancien prix, sans qu'un seul écran le dise.
 *
 * **Elle ne s'appelle JAMAIS toute seule**, et c'est le point. Réécrire ses
 * montants dans son dos les ferait changer entre le moment où il ouvre l'écran
 * et celui où il appuie — sur le seul écran qui engage son argent. La règle
 * (`src/lib/facture-face-au-devis.ts`) dit, l'écran montre, il reprend
 * (`CLAUDE.md` §4 : rien n'est validé sans un geste du patron).
 *
 * **Le refus se rend en valeur, jamais en exception** (`AGENTS.md`) : le message
 * d'une exception d'action serveur n'arrive pas jusqu'à lui.
 *
 * **Le numéro, la date et l'échéance ne bougent pas.** Un numéro de facture est
 * consommé, et sa date est celle de la facture — pas celle du devis.
 */
export async function reprendreLeDevisSurLaFacture(
  ctx: Ctx,
  factureId: string
): Promise<{ ok: true; numeroDevis: string } | { ok: false; raison: string }> {
  return withEntreprise(ctx.utilisateurId, ctx.entrepriseId, async (tx) => {
    const [f] = await tx.select().from(factures).where(eq(factures.id, factureId)).limit(1);
    // `withEntreprise` borne déjà à son entreprise : une facture d'à côté n'est
    // pas « refusée », elle n'existe tout simplement pas pour cette requête.
    if (!f) return { ok: false, raison: "Cette facture est introuvable." };
    if (f.statut !== "brouillon") {
      return { ok: false, raison: "La facture est déjà arrêtée : elle ne se réécrit plus." };
    }
    // **Une facture directe n'a aucun devis à reprendre** (migration 0086), et
    // ce refus n'est pas une formalité : sans lui, un devis écrit APRÈS coup sur
    // le même chantier effacerait les lignes qu'il vient de saisir — le WHERE de
    // la reprise ne garde que les suppléments, et une facture directe n'en a
    // aucun. Il perdrait sa facture entière en appuyant sur « Reprendre ».
    if (factureNeeSansDevis(f)) {
      return { ok: false, raison: "Cette facture a été faite sans devis : il n'y a rien à reprendre." };
    }

    const [d] = await lireDevisQuiFaitFoi(tx, f.chantierId);
    if (!d) return { ok: false, raison: "Ce chantier n'a aucun devis envoyé à reprendre." };

    const etat = repriseDuDevis(
      { devisId: f.devisId, statut: "brouillon" },
      { id: d.id, numeroCommercial: d.numeroCommercial, numeroVersion: d.numeroVersion }
    );
    if (etat.aJour) return { ok: false, raison: "Cette facture reprend déjà le dernier devis envoyé." };

    const lignes = await tx
      .select()
      .from(lignesDevis)
      .where(eq(lignesDevis.devisId, d.id))
      .orderBy(asc(lignesDevis.ordre));

    // Les anciennes lignes partent d'abord : les garder ferait une facture qui
    // additionne deux versions du même chantier.
    //
    // **SAUF LES TRAVAUX SUPPLÉMENTAIRES — migration 0082.** Ils ne viennent
    // pas du devis : les effacer ici ferait disparaître en silence le travail
    // qu'il a ajouté, au moment même où il croit ne remettre à jour que les
    // prix. Le supplément survit à toutes les reprises, par construction.
    await tx
      .delete(lignesFacture)
      .where(and(eq(lignesFacture.factureId, f.id), eq(lignesFacture.supplement, false)));
    if (lignes.length > 0) {
      await tx.insert(lignesFacture).values(lignesRecopiees(ctx.entrepriseId, f.id, lignes));
    }
    // **L'identité se rafraîchit aussi, et seulement parce que la facture est
    // encore un BROUILLON** (garde ci-dessus). Rien n'est parti chez le client :
    // reprendre le dernier devis sans reprendre l'IBAN du jour laisserait une
    // facture à moitié à jour — des prix de juin et des coordonnées de janvier.
    const [entrepriseCourante] = await tx
      .select(COLONNES_EMETTEUR)
      .from(entreprises)
      .where(eq(entreprises.id, ctx.entrepriseId))
      .limit(1);
    await tx
      .update(factures)
      .set({ ...instantaneDuDevis(d), ...identiteDeLEmetteur(entrepriseCourante) })
      .where(eq(factures.id, f.id));

    return { ok: true, numeroDevis: d.numeroCommercial };
  });
}

/**
 * Corrige l'échéance d'une facture ENCORE EN BROUILLON — sa demande du 25 août.
 *
 * **Le refus se rend en valeur, jamais en exception** (`AGENTS.md`) : le message
 * d'une exception d'action serveur n'arrive pas jusqu'au patron.
 *
 * **Une facture ARRÊTÉE ne bouge plus.** Une fois émise, elle est partie chez le
 * client et inscrite au relevé : changer sa date la ferait mentir. On refuse, et
 * l'écran ne montre le champ que tant qu'elle est brouillon — la vérification
 * ici est le vrai garde-fou, l'écran n'est qu'une politesse.
 *
 * **Elle rend la date RELUE en base**, jamais la saisie : une valeur hors bornes
 * est retombée, et l'écran doit afficher ce qui s'imprimera.
 */
// ═══════════════════════════════════════════════════════════════════════════
// LES LIGNES QU'IL SAISIT LUI-MÊME — 31 août, tranchées le 9, élargies le 10
// ═══════════════════════════════════════════════════════════════════════════
//
// **Elles s'appelaient « travaux supplémentaires », et ce nom est devenu faux
// le 10 septembre 2026.** Il l'était pour une raison précise : sur une facture
// née d'un devis, la seule chose qu'il puisse saisir EST un supplément. Sa
// demande de facturer sans devis a ajouté un cas où ces mêmes trois gestes
// posent des lignes ordinaires — et une fonction dont le nom annonce autre
// chose que ce qu'elle fait est exactement ce qui coûte une heure de lecture au
// développeur qu'il appellera un jour (`CLAUDE.md` §4 sexies).
//
// Le geste, lui, n'a pas changé : ajouter, corriger, retirer une ligne que le
// client n'a pas déjà acceptée. C'est `ligneSeCorrige` qui dit lesquelles, et
// l'écran des travaux en plus continue d'écrire « travaux supplémentaires » là
// où c'en sont — le mot vit à l'écran, plus dans le nom du dépôt.
//
// *« Si on effectue des travaux en plus chez un client, on n'a aucun moyen de
// rajouter les TS sur la facture. »* Puis, le 9 septembre : *« à la place de la
// phrase "rien n'a changé depuis le devis ?", je veux un bouton "ajouter des
// travaux supplémentaires" ; ça ouvre la vraie page du devis, et une catégorie
// se crée direct comme pour l'ajout d'une TVA »* — et **une seule facture**.
//
// ─── CE QUI N'A PAS EU BESOIN D'ÊTRE ÉCRIT, ET POURQUOI ────────────────────
//
// Ni les totaux, ni la TVA par taux, ni le PDF, ni le relevé. `emettreFacture`
// recalcule déjà tout depuis `lignes_facture` par `totauxAvecReduction`, qui
// sait grouper par taux depuis le devis à plusieurs TVA. **Une ligne de
// supplément est une ligne de facture** ; seule sa PROVENANCE est nouvelle.
//
// ─── LES DEUX REFUS, ET ILS NE SE NÉGOCIENT PAS ────────────────────────────
//
//   1. **une facture ARRÊTÉE ne bouge plus** — elle est partie chez le client et
//      inscrite au relevé de TVA. Le trigger PostgreSQL le refuserait de toute
//      façon ; on le dit ici en clair, pour que le refus arrive à l'écran plutôt
//      que sous la forme d'une panne ;
//   2. **le devis ne se réécrit jamais** — sa règle du 9 septembre :
//      *« seulement la case travaux supplémentaires, le reste impossible de les
//      modifier »*. Ces fonctions ne touchent que les lignes que
//      `ligneSeCorrige` désigne, et c'est vérifié à chaque écriture, pas
//      seulement à l'affichage. Sur une facture SANS devis, elles les désignent
//      toutes — non par relâchement, mais parce qu'il n'y a alors aucun prix
//      accepté à protéger.

/** Une ligne que le patron saisit lui-même, telle que l'écran la manipule. */
export type LigneSupplementaire = {
  id: string;
  libelle: string;
  quantite: string;
  prixUnitaire: string;
  montant: string;
  tauxTva: string | null;
  ordre: number;
  /**
   * **DANS QUEL BLOC ELLE TOMBE, dit par le SERVEUR** (migration 0086).
   *
   * Il manquait, et son absence obligeait l'écran à le recalculer de son côté
   * pour poser la ligne neuve dans sa liste — deux réponses à une seule
   * question, dont la seconde se serait trompée le jour où la première change.
   * C'est le serveur qui range la ligne : c'est à lui de dire où.
   */
  supplement: boolean;
};

/** Le refus se rend en VALEUR : le message d'une exception n'arrive pas à lui. */
type Refus = { ok: false; raison: string };

/**
 * La facture est-elle encore ouverte à l'écriture ? Et de quel devis vient-elle ?
 *
 * **Un seul endroit pour ces deux questions**, appelé par les trois gestes :
 * trois copies de la même garde finissent par diverger, et c'est celle qu'on
 * aurait oublié de corriger qui laisserait retoucher une facture partie.
 *
 * **Le `devisId` sort d'ici, et il n'est pas décoratif** (migration 0086) : il
 * décide, par `ligneSeCorrige`, quelles lignes les trois gestes ont le droit de
 * toucher. Le lire dans la même requête que le statut évite un second aller à
 * la base, et surtout évite qu'il soit lu ailleurs, autrement.
 */
async function factureEncoreEnBrouillon(
  tx: DbOrTx,
  factureId: string
): Promise<{ ok: true; devisId: string | null } | Refus> {
  const [f] = await tx
    .select({ statut: factures.statut, devisId: factures.devisId })
    .from(factures)
    .where(eq(factures.id, factureId))
    .limit(1);
  // `withEntreprise` borne déjà à son entreprise : une facture d'à côté n'est
  // pas « refusée », elle n'existe tout simplement pas pour cette requête.
  if (!f) return { ok: false, raison: "Cette facture est introuvable." };
  if (f.statut !== "brouillon") {
    return { ok: false, raison: "La facture est déjà arrêtée : elle ne se réécrit plus." };
  }
  return { ok: true, devisId: f.devisId };
}

/**
 * LES LIGNES QUE CES GESTES ONT LE DROIT DE TOUCHER, en condition SQL.
 *
 * Sur une facture née d'un devis : les suppléments seuls. Sur une facture
 * directe : toutes, puisqu'aucune n'a été acceptée d'avance.
 *
 * **La décision n'est pas prise ici** — elle vient de `factureNeeSansDevis`,
 * la même fonction que l'écran appelle pour savoir s'il dessine un champ ou du
 * texte. Ce qui est écrit ici n'est que sa traduction en `WHERE`.
 */
function seulesLesLignesCorrigeables(facture: { devisId: string | null }) {
  return factureNeeSansDevis(facture) ? [] : [eq(lignesFacture.supplement, true)];
}

/** Ce que la ligne pèse — la même règle que le devis, appelée et non réécrite. */
function montantDeLaLigne(quantite: string, prixUnitaire: string): string {
  return new Decimal(quantite || "0").times(prixUnitaire || "0").toFixed(2);
}

/**
 * Ajoute une ligne vide, que le patron remplit sur place.
 *
 * **Vide, et non « à remplir plus tard »** : c'est le geste du devis, où
 * « + Ajouter une ligne » pose une ligne qu'on remplit sur place. Le montant
 * suit la saisie ; tant qu'il n'y a pas de prix, l'écran écrit « à chiffrer »
 * plutôt que « 0,00 € » — un zéro se lit « gratuit » (sa correction du 26 août).
 */
export async function ajouterLigneDeFacture(
  ctx: Ctx,
  factureId: string,
  taux?: string | null
): Promise<{ ok: true; ligne: LigneSupplementaire } | Refus> {
  return withEntreprise(ctx.utilisateurId, ctx.entrepriseId, async (tx) => {
    const garde = await factureEncoreEnBrouillon(tx, factureId);
    if (!garde.ok) return garde;

    // Le rang se prend APRÈS la dernière ligne de la facture, suppléments
    // compris : deux lignes au même rang se rendraient dans un ordre que la
    // base choisit, et il changerait d'un affichage à l'autre.
    const [dernier] = await tx
      .select({ ordre: lignesFacture.ordre })
      .from(lignesFacture)
      .where(eq(lignesFacture.factureId, factureId))
      .orderBy(desc(lignesFacture.ordre))
      .limit(1);

    const [ligne] = await tx
      .insert(lignesFacture)
      .values({
        entrepriseId: ctx.entrepriseId,
        factureId,
        libelle: "",
        quantite: "1",
        prixUnitaire: "0",
        montant: "0",
        tauxTva: taux ?? null,
        ordre: (dernier?.ordre ?? 0) + 1,
        // **Sur une facture directe, c'est une ligne ORDINAIRE** (migration
        // 0085). La marquer « supplément » ferait imprimer au client le titre
        // « TRAVAUX SUPPLÉMENTAIRES » au-dessus de la seule chose qu'on lui
        // facture — supplémentaire à quoi ? La règle est celle de l'écran,
        // appelée et non redite ici.
        supplement: !factureNeeSansDevis(garde),
      })
      .returning();

    return { ok: true, ligne };
  });
}

/**
 * Corrige une ligne — libellé, quantité, prix, ou son taux.
 *
 * **La règle est dans le WHERE, pas dans une vérification.** Une garde qui
 * lirait la ligne puis écrirait laisserait passer ce qui se glisse entre les
 * deux ; ici, une ligne que la règle refuse ne correspond simplement à aucune
 * ligne à écrire, et l'écriture ne touche rien.
 */
export async function majLigneDeFacture(
  ctx: Ctx,
  factureId: string,
  ligneId: string,
  champs: { libelle?: string; quantite?: string; prixUnitaire?: string; tauxTva?: string | null }
): Promise<{ ok: true; montant: string } | Refus> {
  return withEntreprise(ctx.utilisateurId, ctx.entrepriseId, async (tx) => {
    const garde = await factureEncoreEnBrouillon(tx, factureId);
    if (!garde.ok) return garde;

    const [avant] = await tx
      .select()
      .from(lignesFacture)
      .where(
        and(
          eq(lignesFacture.id, ligneId),
          eq(lignesFacture.factureId, factureId),
          ...seulesLesLignesCorrigeables(garde)
        )
      )
      .limit(1);
    if (!avant) {
      return {
        ok: false,
        raison: "Cette ligne ne fait pas partie des travaux supplémentaires : elle vient du devis.",
      };
    }

    const quantite = champs.quantite ?? avant.quantite;
    const prixUnitaire = champs.prixUnitaire ?? avant.prixUnitaire;
    const montant = montantDeLaLigne(quantite, prixUnitaire);

    await tx
      .update(lignesFacture)
      .set({
        libelle: champs.libelle ?? avant.libelle,
        quantite,
        prixUnitaire,
        montant,
        // `undefined` : on ne touche pas au taux. `null` : on le RETIRE, et la
        // ligne retombe sur celui de la facture. Les confondre effacerait le
        // taux à chaque correction de libellé.
        ...(champs.tauxTva !== undefined ? { tauxTva: champs.tauxTva } : {}),
      })
      .where(eq(lignesFacture.id, ligneId));

    return { ok: true, montant };
  });
}

/**
 * Retire une ligne — ou toutes celles qu'il a le droit de retirer, quand il
 * referme la catégorie.
 *
 * **Rien de ce qui vient du devis ne peut partir par ici**, et c'est le WHERE
 * qui le garantit : sa règle du 9 septembre — *« le reste, impossible de les
 * modifier »* — ne dépend d'aucune vigilance à l'appel. Sur une facture directe
 * il n'y a aucun devis, donc aucune ligne à protéger : le WHERE s'ouvre.
 */
export async function retirerLignesDeFacture(
  ctx: Ctx,
  factureId: string,
  ligneId?: string
): Promise<{ ok: true; retirees: number } | Refus> {
  return withEntreprise(ctx.utilisateurId, ctx.entrepriseId, async (tx) => {
    const garde = await factureEncoreEnBrouillon(tx, factureId);
    if (!garde.ok) return garde;

    const retirees = await tx
      .delete(lignesFacture)
      .where(
        and(
          eq(lignesFacture.factureId, factureId),
          ...seulesLesLignesCorrigeables(garde),
          ...(ligneId ? [eq(lignesFacture.id, ligneId)] : [])
        )
      )
      .returning({ id: lignesFacture.id });

    return { ok: true, retirees: retirees.length };
  });
}

export async function majEcheanceFacture(
  ctx: Ctx,
  factureId: string,
  dateEcheanceIso: string
): Promise<{ ok: true; dateEcheance: string } | { ok: false; raison: string }> {
  return withEntreprise(ctx.utilisateurId, ctx.entrepriseId, async (tx) => {
    const [f] = await tx
      .select({ dateEmission: factures.dateEmission, statut: factures.statut })
      .from(factures)
      .where(eq(factures.id, factureId))
      .limit(1);
    // `withEntreprise` borne déjà à son entreprise : une facture d'à côté n'est
    // pas « refusée », elle n'existe tout simplement pas pour cette requête.
    if (!f) return { ok: false, raison: "Cette facture est introuvable." };
    if (f.statut !== "brouillon") {
      return { ok: false, raison: "La facture est déjà arrêtée : son échéance ne change plus." };
    }
    const v = validerEcheance(f.dateEmission, dateEcheanceIso);
    if (!v.ok) return v;
    await tx.update(factures).set({ dateEcheance: v.iso }).where(eq(factures.id, factureId));
    return { ok: true, dateEcheance: v.iso };
  });
}

export class FactureDejaEmiseError extends Error {
  constructor() {
    super("Cette facture a déjà été émise.");
    this.name = "FactureDejaEmiseError";
  }
}

/**
 * Fige la facture sur les montants confirmés — l'arrêt 3 franchi.
 *
 * Les montants sont recalculés depuis les lignes plutôt que repris tels quels :
 * le patron a pu corriger une ligne à l'écran de confirmation, et un total qui
 * ne correspondrait pas à son détail est le genre d'erreur qu'on ne rattrape
 * que par un avoir.
 */
/**
 * Rassemble ce que la facture imprime.
 *
 * Une seule construction pour l'aperçu et pour l'émission : deux finiraient par
 * ne plus décrire la même pièce, et l'écart n'apparaîtrait que chez le client.
 */
/**
 * Ce qui part sur le papier — et **les totaux s'y CALCULENT**, ils ne s'y
 * recopient plus.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * **LE DÉFAUT DU 10 SEPTEMBRE 2026, et il est parti chez un client.** Le patron
 * ajoute un travail supplémentaire de 2 700 € ; son PDF liste bien les trois
 * lignes (4 450 €), écrit **Total HT 1 750 €**, **TVA 890 €** et **Total TTC
 * 2 100 €**. Trois chiffres, trois bases — et aucun ne tombe juste.
 *
 * **La cause était une DUPLICATION**, pas un calcul faux : cette fonction
 * recopiait `f.totalHt` et `f.totalTtc` des colonnes de la facture, pendant que
 * le bloc de totaux du PDF **recalculait la TVA depuis les lignes**
 * (`document-commun.ts`, `totauxAvecReduction`). Les colonnes datant d'avant
 * l'ajout, elles décrivaient une facture qui n'existait plus. C'est très
 * exactement ce que `CLAUDE.md` §3 interdit — *jamais de règle dupliquée entre
 * l'affichage et la vérification* —, et le §4 bis le redit pour l'arrosage :
 * *un récapitulatif se RECALCULE, il ne se recopie pas*.
 *
 * **Une seule source, donc : les lignes.** La même fonction qu'à l'émission,
 * appelée ici — et `emettreFacture` a cessé de passer ses trois totaux par
 * dessus, puisqu'ils se retrouvent identiques.
 *
 * **Ce que cela ne change PAS pour une facture émise.** Elle est immuable
 * (trigger PostgreSQL), ses lignes ne bougent plus : recalculer depuis elles
 * rend exactement ce que ses colonnes portent. Et son PDF, lui, est figé à
 * l'émission et jamais régénéré.
 */
function donneesFacture(
  f: typeof factures.$inferSelect,
  lignes: (typeof lignesFacture.$inferSelect)[],
  numeroDevis: string | null
): FacturePdfData {
  const modalites = modalitesDeLaFacture(f);
  const totaux = totauxAvecReduction(lignes, f.tauxTva, f.reductionPourcent);
  return {
    numeroCommercial: f.numeroCommercial,
    statut: f.statut as "brouillon" | "emise",
    dateEmission: f.dateEmission,
    dateEcheance: f.dateEcheance,
    numeroDevis,
    entrepriseNom: f.entrepriseNom,
    regimeTva: f.entrepriseRegimeTva,
    entrepriseAdresse: f.entrepriseAdresse,
    entrepriseSiret: f.entrepriseSiret,
    entrepriseTelephone: f.entrepriseTelephone,
    entrepriseEmail: f.entrepriseEmail,
    // **LES MÊMES FONCTIONS QUE LA PAGE DU CLIENT** (`modalites-paiement.ts`) :
    // l'IBAN groupé par quatre, l'ordre du chèque, la consigne du libellé. Le
    // client reçoit deux pièces — cette page et ce PDF — et deux rédactions
    // séparées finiraient par lui donner deux consignes différentes pour le même
    // règlement (`CLAUDE.md` §3).
    entrepriseIban: modalites.ibanLisible,
    consignePaiement: consigneDuLibelle(f.numeroCommercial),
    ordreDuCheque: modalites.ordreDuCheque,
    entrepriseFormeJuridique: f.entrepriseFormeJuridique,
    entrepriseCapitalSocial: f.entrepriseCapitalSocial,
    entrepriseVilleRcs: f.entrepriseVilleRcs,
    entrepriseMentionsLegalesPosition: f.entrepriseMentionsLegalesPosition,
    clientNom: f.clientNom,
    clientCivilite: f.clientCivilite,
    clientAdresse: f.clientAdresse,
    clientTelephone: f.clientTelephone,
    adresseChantier: f.adresseChantier,
    conditionsPaiement: f.conditionsPaiement,
    devise: f.devise,
    tauxTva: f.tauxTva,
    totalHt: totaux.totalHt,
    totalTva: totaux.totalTva,
    totalTtc: totaux.totalTtc,
    reductionPourcent: f.reductionPourcent,
    // **Le montant retiré suit les totaux, jamais la colonne.** Un montant resté
    // sur l'ancien HT donnerait un « Total HT après remise » qui ne serait la
    // différence de rien — le raisonnement était déjà écrit à l'émission.
    reductionMontant: totaux.reductionMontant,
    lignes: lignes
      .slice()
      .sort((a, b) => a.ordre - b.ordre)
      .map((l) => ({
        libelle: l.libelle,
        quantite: l.quantite,
        prixUnitaire: l.prixUnitaire,
        montant: l.montant,
        // Le taux de sa catégorie voyage jusqu'au papier : sans lui, la facture
        // ventilerait tout sur le taux du document (migration 0073).
        tauxTva: l.tauxTva,
        // **Et son bloc avec lui (migration 0082).** Sans cette ligne, le titre
        // « TRAVAUX SUPPLÉMENTAIRES » du PDF ne s'affichait JAMAIS : les lignes
        // arrivaient sans la colonne, et tout retombait dans le bloc du devis.
        supplement: l.supplement,
      })),
  };
}

/**
 * Le PDF d'une facture non encore émise, à la demande et jamais conservé.
 *
 * Comme pour le devis : seule la pièce réellement émise est archivée, et c'est
 * celle-là qui fait foi. Un brouillon régénéré à chaque ouverture ne peut pas
 * être pris pour la facture officielle.
 */
export async function genererPdfFacturePourApercu(ctx: Ctx, factureId: string): Promise<Uint8Array> {
  return withEntreprise(ctx.utilisateurId, ctx.entrepriseId, async (tx) => {
    const [f] = await tx.select().from(factures).where(eq(factures.id, factureId)).limit(1);
    if (!f) throw new Error("Facture introuvable");
    const lignes = await tx
      .select()
      .from(lignesFacture)
      .where(eq(lignesFacture.factureId, factureId));
    // Nul sur une facture directe (migration 0086) : le PDF sait déjà se taire
    // — la mention « Établie à partir du devis n° … » n'est écrite que s'il y a
    // un numéro à écrire (`facture-pdf.ts`).
    const [d] = f.devisId
      ? await tx
          .select({ numero: devis.numeroCommercial })
          .from(devis)
          .where(eq(devis.id, f.devisId))
          .limit(1)
      : [];
    const habillage = await allureDesDocuments(tx, ctx.entrepriseId);
    return genererPdfFacture(donneesFacture(f, lignes, d?.numero ?? null), habillage);
  });
}

export async function emettreFacture(ctx: Ctx, factureId: string, maintenant: Date = new Date()) {
  return withEntreprise(ctx.utilisateurId, ctx.entrepriseId, async (tx) => {
    const [avant] = await tx.select().from(factures).where(eq(factures.id, factureId)).limit(1);
    if (!avant) throw new Error("Facture introuvable");
    if (avant.statut === "emise") throw new FactureDejaEmiseError();

    const lignes = await tx
      .select()
      .from(lignesFacture)
      .where(eq(lignesFacture.factureId, factureId));

    // **La même règle que le devis, appelée et non réécrite.** Le patron a
    // choisi l'arrangement B : la réduction n'est pas une ligne, donc ce
    // recalcul-ci l'oublierait s'il additionnait seulement les lignes — et la
    // facture émise, immuable, partirait au prix plein.
    const t = totauxAvecReduction(lignes, avant.tauxTva, avant.reductionPourcent);
    const totalHt = new Decimal(t.totalHt);
    const totalTva = new Decimal(t.totalTva);
    const totalTtc = new Decimal(t.totalTtc);

    // La pièce est figée au moment de l'émission, jamais régénérée ensuite :
    // une facture émise est immuable (trigger PostgreSQL), et un PDF reconstruit
    // depuis les données du jour ne serait plus celui que le client a reçu.
    const [d] = avant.devisId
      ? await tx
          .select({ numero: devis.numeroCommercial })
          .from(devis)
          .where(eq(devis.id, avant.devisId))
          .limit(1)
      : [];

    const habillage2 = await allureDesDocuments(tx, ctx.entrepriseId);
    // **Les quatre totaux ne se repassent plus ici — 10 septembre 2026.**
    // `donneesFacture` les calcule elle-même depuis ces mêmes lignes, avec cette
    // même fonction. Les lui imposer était la moitié d'une duplication dont
    // l'autre moitié — le PDF brouillon, qui recopiait les colonnes — a sorti
    // une facture aux totaux faux. Seul le STATUT reste forcé : la pièce
    // archivée doit dire « émise » alors que la ligne ne le sera qu'après.
    const pdfBytes = await genererPdfFacture(
      donneesFacture({ ...avant, statut: "emise" }, lignes, d?.numero ?? null),
      habillage2
    );

    const objet = await enregistrerObjet(
      `chantiers/${avant.chantierId}/factures`,
      Buffer.from(pdfBytes),
      ".pdf"
    );

    // **L'ALLURE PART AVEC LA PIÈCE, et c'est la même valeur que le PDF.**
    // `habillage2` vient d'être lu pour composer le document archivé : l'écrire
    // ici, c'est garantir que la page du client et son PDF montrent la même
    // chose — pas deux lectures à deux instants, qui divergeraient au premier
    // changement de réglage (migration 0074).
    //
    // **Le défaut s'écrit EN CLAIR**, jamais nul : les trois colonnes nulles
    // signifient « facture antérieure à 0074 », et confondre les deux ferait
    // repeindre après coup une facture partie sans allure.
    const allureFigee = habillage2.allure ?? ALLURE_PAR_DEFAUT;

    const [facture] = await tx
      .update(factures)
      .set({
        statut: "emise",
        emiseLe: maintenant,
        docTypographie: allureFigee.typographie,
        docFond: allureFigee.fond,
        docAccent: allureFigee.accent,
        totalHt: totalHt.toFixed(2),
        totalTva: totalTva.toFixed(2),
        totalTtc: totalTtc.toFixed(2),
        reductionMontant: t.reductionMontant,
        pdfStorageKey: objet.storageKey,
        pdfChecksum: objet.checksum,
      })
      .where(eq(factures.id, factureId))
      .returning();

    await tx
      .update(chantiers)
      .set({ factureEnvoyeeAt: sql`COALESCE(facture_envoyee_at, now())` })
      .where(eq(chantiers.id, facture.chantierId));

    return facture;
  });
}

// --- Onglet « Chantiers terminés » -----------------------------------------

export type ChantierTermine = {
  id: string;
  nom: string;
  clientNom: string | null;
  clientCivilite: "mr" | "mme" | null;
  datePlanifiee: string | null;
  termineAt: Date | null;
  factureEnvoyeeAt: Date | null;
  factureId: string | null;
  factureStatut: "brouillon" | "emise" | null;
  factureNumero: string | null;
  totalTtc: string | null;
};

/**
 * Les chantiers rangés dans l'onglet « Terminés ».
 *
 * Deux populations dans une seule liste, et c'est voulu : ceux qui restent à
 * clôturer et ceux déjà facturés. Les séparer en deux écrans obligerait le
 * patron à savoir d'avance dans lequel chercher.
 *
 * **Le tri n'est pas fait ici : il vient de `ongletDepuisJalons`.** Cette
 * fonction recopiait la règle en SQL (`date_planifiee <= aujourd'hui`) là où
 * l'écran Chantiers l'appliquait en TypeScript avec un `<` strict. Un chantier
 * prévu AUJOURD'HUI tombait donc dans les deux onglets à la fois — le défaut
 * même que le patron avait signalé le 6 août 2026, revenu par la porte du
 * signe. Et un chantier clôturé AVANT sa date n'entrait dans aucun des trois :
 * sa facture en brouillon n'était plus joignable que par son adresse.
 *
 * Le SQL ne garde donc qu'un filtre de volume — un sur-ensemble sûr de ce que
 * la règle peut retenir. C'est la règle, et elle seule, qui tranche ensuite.
 */
export async function listerChantiersTermines(ctx: Ctx, aujourdHui: string = jourIso(new Date())) {
  const candidats = await withEntreprise(ctx.utilisateurId, ctx.entrepriseId, async (tx) =>
    tx
      .select({
        id: chantiers.id,
        nom: chantiers.nom,
        clientNom: clients.nom,
        clientCivilite: clients.civilite,
        datePlanifiee: chantiers.datePlanifiee,
        termineAt: chantiers.termineAt,
        factureEnvoyeeAt: chantiers.factureEnvoyeeAt,
        factureId: factures.id,
        factureStatut: factures.statut,
        factureNumero: factures.numeroCommercial,
        // **La date de la FACTURE, pas celle du chantier.** L'écran refait le
        // 22 août 2026 écrit « Facturé le 20 août » : le dire d'après
        // `datePlanifiee` affirmerait une date d'émission qu'on n'a pas — le
        // chantier a pu être fait le 20 et facturé le 30. Un écran qui invente
        // une date de facture est pire qu'un écran muet.
        factureDateEmission: factures.dateEmission,
        totalTtc: factures.totalTtc,
        // **Le montant PRÉVU au devis, pour ce qui n'est pas encore facturé.**
        // L'écran doit dire combien attend d'être facturé — c'est la seule
        // question qu'on lui pose. Il dira aussi d'où vient ce chiffre :
        // « Montants prévus aux devis », jamais « à encaisser ». Un devis n'est
        // pas une facture, et le montant peut encore bouger
        // (`docs/AGENT.md` §3).
        //
        // La dernière version envoyée fait foi : un devis corrigé puis renvoyé
        // porte plusieurs lignes, et retenir la première annoncerait un montant
        // que le client a refusé.
        devisNumero: sql<string | null>`(
          SELECT d."numero_commercial" FROM "devis" d
          WHERE d."chantier_id" = ${chantiers.id} AND d."statut" = 'envoye'
          ORDER BY d."numero_version" DESC LIMIT 1
        )`,
        devisTotalTtc: sql<string | null>`(
          SELECT d."total_ttc" FROM "devis" d
          WHERE d."chantier_id" = ${chantiers.id} AND d."statut" = 'envoye'
          ORDER BY d."numero_version" DESC LIMIT 1
        )`,
      })
      .from(chantiers)
      .leftJoin(clients, eq(chantiers.clientId, clients.id))
      .leftJoin(factures, eq(factures.chantierId, chantiers.id))
      .where(
        and(
          isNull(chantiers.deletedAt),
          // Sur-ensemble : un chantier sans date ET jamais clos ne peut pas être
          // rangé dans les terminés, quoi que dise la règle. Élargir ici est
          // sans danger ; restreindre serait reprendre la règle en SQL.
          or(
            isNotNull(chantiers.datePlanifiee),
            isNotNull(chantiers.termineAt),
            isNotNull(chantiers.factureEnvoyeeAt)
          )
        )
      )
      // Le plus récemment réalisé en tête : c'est celui que le patron vient
      // clôturer en rentrant du chantier.
      .orderBy(sql`${chantiers.datePlanifiee} DESC NULLS FIRST`)
  );

  return candidats.filter((c) => ongletDepuisJalons(c, aujourdHui) === "termines");
}

// --- Relevé de TVA collectée ------------------------------------------------

export type LigneReleveTva = {
  numeroCommercial: string;
  /**
   * **La date qui compte pour la période**, et non plus forcément l'émission.
   *
   * Aux encaissements, c'est celle du règlement : c'est lui qui rend la TVA
   * exigible (migration 0045). Le nom reste `dateEmission` parce qu'une
   * douzaine d'écrans et de suites le lisent ; `motif` dit laquelle des deux
   * c'est, pour que l'écran ne mente pas au patron.
   */
  dateEmission: string;
  clientNom: string | null;
  totalHt: string;
  tauxTva: string;
  totalTva: string;
  totalTtc: string;
  /** `paiement` : la ligne est un encaissement. `emission` : le régime des débits. */
  motif?: "emission" | "paiement";
};

export type ReleveTva = {
  debut: string;
  fin: string;
  lignes: LigneReleveTva[];
  totalHt: string;
  totalTva: string;
  totalTtc: string;
  /** Sous quel régime ce relevé a été calculé — l'écran doit pouvoir le dire. */
  regime: Exigibilite;
  /** Ce qui n'y est pas encore, et qui attend son paiement. Zéro aux débits. */
  enAttente: { nombre: number; ttc: string; tva: string };
};

/**
 * Le relevé de TVA collectée d'une période.
 *
 * Calculé à partir des factures émises, jamais stocké : une table de TVA
 * tenue en parallèle finirait par diverger de ce qui a été facturé, et c'est
 * exactement l'écart qu'un contrôle cherche. La stabilité du relevé tient à
 * l'immuabilité d'une facture émise (trigger, 0018_factures.sql), pas à une
 * copie.
 */
export async function releveTvaCollectee(ctx: Ctx, debut: string, fin: string): Promise<ReleveTva> {
  // **Le régime décide de la DATE qui compte** (migration 0045). Aux
  // encaissements — le défaut légal d'une prestation de services —, une facture
  // n'entre au relevé qu'à hauteur de ce qui a été reçu, à la date où il l'a
  // été. Aux débits, elle y entre entière le jour de son émission.
  const [regime, avecPaiements] = await Promise.all([exigibiliteDe(ctx), facturesAvecPaiements(ctx)]);
  return assemblerReleve(avecPaiements, debut, fin, regime);
}

/**
 * Le relevé sous les DEUX régimes, en une seule lecture des factures.
 *
 * **Sa question du 26 août 2026 :** *« lorsque je change entre les deux, rien
 * ne se passe, c'est normal ? »* — et c'était normal : quand toutes les
 * factures d'un mois ont été payées dans le mois, les deux régimes tombent sur
 * le même chiffre. Ce qui manquait n'était pas un calcul, c'était une phrase
 * qui le DISE : un écran qui ne bouge pas sans rien dire se lit comme une
 * panne.
 *
 * **Une seule lecture, deux assemblages.** Appeler `releveTvaCollectee` deux
 * fois relirait toutes les factures et tous les règlements pour rien. Et
 * recalculer le second total à la main dans l'écran serait une seconde
 * implémentation de la même règle — ce que `CLAUDE.md` §3 interdit, parce que
 * les deux finissent toujours par diverger.
 */
export async function relevesSousLesDeuxRegimes(
  ctx: Ctx,
  debut: string,
  fin: string
): Promise<{ retenu: ReleveTva; autre: ReleveTva }> {
  const [regime, avecPaiements] = await Promise.all([exigibiliteDe(ctx), facturesAvecPaiements(ctx)]);
  const oppose: Exigibilite = regime === "encaissements" ? "debits" : "encaissements";
  return {
    retenu: assemblerReleve(avecPaiements, debut, fin, regime),
    autre: assemblerReleve(avecPaiements, debut, fin, oppose),
  };
}

/** Ce que les factures déjà lues donnent, sous un régime donné. */
function assemblerReleve(
  avecPaiements: Awaited<ReturnType<typeof facturesAvecPaiements>>,
  debut: string,
  fin: string,
  regime: Exigibilite
): ReleveTva {
  const lignes: LigneReleveTva[] = [];
  for (const f of avecPaiements) {
    const entrees = entreesDuReleve(f, f.paiements, regime);
    for (const e of entrees) {
      if (!dansLaPeriode(e, debut, fin)) continue;
      lignes.push({
        numeroCommercial: f.numeroCommercial,
        dateEmission: e.date,
        clientNom: f.clientNom,
        totalHt: e.ht,
        // Le taux figé sur la facture : un acompte ne change pas le taux, il
        // n'en encaisse qu'une part.
        tauxTva: tauxDeLaFacture(f),
        totalTva: e.tva,
        totalTtc: e.ttc,
        motif: e.motif,
      });
    }
  }

  // L'ordre du relevé : la date qui compte, puis le numéro. C'est l'ordre du
  // formulaire, et celui où il recopie.
  lignes.sort((a, b) =>
    a.dateEmission === b.dateEmission
      ? a.numeroCommercial.localeCompare(b.numeroCommercial)
      : a.dateEmission < b.dateEmission
        ? -1
        : 1
  );

  const somme = (champ: "totalHt" | "totalTva" | "totalTtc") =>
    lignes.reduce((acc, l) => acc.plus(new Decimal(l[champ])), new Decimal(0)).toFixed(2);

  return {
    debut,
    fin,
    lignes,
    totalHt: somme("totalHt"),
    totalTva: somme("totalTva"),
    totalTtc: somme("totalTtc"),
    regime,
    enAttente: enAttenteDeReglement(
      avecPaiements.map((f) => ({ facture: f, paiements: f.paiements })),
      regime
    ),
  };
}

/**
 * Le taux d'une facture, tel qu'il a été figé.
 *
 * Recalculé depuis les totaux quand la colonne manque — une facture ancienne
 * peut l'avoir laissée vide, et le relevé doit rester lisible.
 */
function tauxDeLaFacture(f: { totalHt: string; totalTva: string }): string {
  const ht = new Decimal(f.totalHt || "0");
  if (ht.lessThanOrEqualTo(0)) return "0.00";
  return new Decimal(f.totalTva || "0").dividedBy(ht).times(100).toDecimalPlaces(2).toFixed(2);
}

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * LES FACTURES PARTIES AVEC UN AUTRE IBAN QUE CELUI D'AUJOURD'HUI.
 *
 * **Tranché par lui le 8 septembre 2026**, maquette à l'appui
 * (`appli/changer-d-iban.html`) : *« oui je le veux »*.
 *
 * Depuis la migration 0076, une facture prend l'IBAN de l'entreprise au jour où
 * elle naît. Celles déjà parties gardent l'ancien — et ce n'est pas un défaut :
 * leur PDF est le fichier ARCHIVÉ que le client a dans son téléphone, et le
 * réécrire ferait mentir la page. Reste un risque qui coûte de l'argent : un
 * virement sur un compte fermé.
 *
 * **Trois filtres, et chacun retire un faux positif :**
 *
 * | | |
 * |---|---|
 * | `facturesEnAttente` | seules celles **émises et non soldées** — une facture déjà payée n'a plus rien à corriger |
 * | `porteUnAutreIban` | l'IBAN figé diffère de celui d'aujourd'hui, comparé NU : une espace de saisie ne doit pas faire prévenir tous ses clients |
 * | l'IBAN d'aujourd'hui existe | sans nouveau compte, il n'y a rien à annoncer |
 *
 * **La liste vide n'est pas une erreur, c'est le cas ordinaire** : rien ne
 * s'affiche alors, ni « 0 facture » ni coche verte (`CLAUDE.md` §4 ter).
 * ═══════════════════════════════════════════════════════════════════════════
 */
export type FactureAPrevenir = {
  id: string;
  numeroCommercial: string;
  dateEmission: string;
  clientNom: string | null;
  clientCivilite: string | null;
  clientTelephone: string | null;
  clientEmail: string | null;
  /** Ce qui reste dû — c'est ce qu'on montre, pas le total de la facture. */
  reste: string;
  /** Le message tout écrit, prêt à partir. */
  message: string;
};

export async function facturesAvecAncienIban(ctx: Ctx): Promise<FactureAPrevenir[]> {
  const [enAttente, modalites] = await Promise.all([
    facturesEnAttente(ctx),
    withEntreprise(ctx.utilisateurId, ctx.entrepriseId, async (tx) => {
      const [e] = await tx
        .select({ nom: entreprises.nom, iban: entreprises.iban, titulaireCompte: entreprises.titulaireCompte })
        .from(entreprises)
        .where(eq(entreprises.id, ctx.entrepriseId))
        .limit(1);
      // **`null` plutôt qu'une entreprise vide** : une lecture qui a échoué
      // n'est pas « une entreprise sans IBAN », et prévenir sur cette base
      // enverrait un message sans compte dedans.
      return e ? modalitesDePaiement({ iban: e.iban, titulaireCompte: e.titulaireCompte, nomEntreprise: e.nom }) : null;
    }),
  ]);

  if (!modalites?.ibanLisible) return [];
  const ibanDuJour = modalites.ibanLisible;

  const nu = modalites.ibanACopier;
  return enAttente
    .filter((f) => porteUnAutreIban(f.entrepriseIban, nu))
    // **Ce dont le client a déjà été prévenu ne se redemande pas** (migration
    // 0078). Sans ce filtre, l'alerte réclamerait les mêmes trois clients
    // chaque jour jusqu'au paiement — et un avertissement qui parle à tort
    // s'apprend à être ignoré (`CLAUDE.md` §4 ter).
    .filter((f) => f.ibanSignale === null || f.ibanSignale !== nu)
    .map((f) => ({
      id: f.id,
      numeroCommercial: f.numeroCommercial,
      dateEmission: f.dateEmission,
      clientNom: f.clientNom,
      clientCivilite: f.clientCivilite,
      clientTelephone: f.clientTelephone,
      clientEmail: f.clientEmail,
      reste: f.reste,
      // **Le message est composé ICI, pas à l'écran.** Trois écrans le
      // proposent (les réglages, l'attente de paiement, et l'écran du premier
      // jour) : trois rédactions finiraient par envoyer trois consignes
      // différentes au même client (`CLAUDE.md` §3).
      message: messageNouvelIban({
        clientAvecCivilite: avecCivilite(f.clientNom ?? "", f.clientCivilite as CiviliteChoisie),
        numeroFacture: f.numeroCommercial,
        ibanLisible: ibanDuJour,
        entrepriseNom: f.entrepriseNom,
      }),
    }));
}

/**
 * NOTER QU'ON A PRÉVENU CE CLIENT — et de QUEL compte.
 *
 * **On range l'IBAN, pas un oui.** Un drapeau resterait levé au changement de
 * banque suivant, et ce client-là ne serait jamais averti du second compte
 * (migration 0078). En rangeant l'IBAN annoncé, la question se referme d'elle-
 * même : s'il ne vaut plus celui d'aujourd'hui, il reste à prévenir.
 *
 * **Rangé NU**, par la même fonction que partout ailleurs : « FR76 3000 » et
 * « fr763000 » sont le même compte, et deux façons de les écrire en feraient
 * deux.
 *
 * **Posé quand il OUVRE le message, pas quand le client répond.** Atlas ne voit
 * pas partir un SMS — il ouvre la messagerie de l'artisan, et la suite lui
 * appartient. Attendre une preuve qu'on n'aura jamais laisserait l'alerte
 * réclamer indéfiniment ; ce qu'on note, c'est le geste, et il est honnête de
 * ne pas prétendre davantage.
 */
export async function marquerIbanSignale(ctx: Ctx, factureId: string): Promise<void> {
  await withEntreprise(ctx.utilisateurId, ctx.entrepriseId, async (tx) => {
    const [e] = await tx
      .select({ iban: entreprises.iban })
      .from(entreprises)
      .where(eq(entreprises.id, ctx.entrepriseId))
      .limit(1);
    const nu = (e?.iban ?? "").trim();
    // Sans IBAN, il n'y a rien à annoncer : noter quoi que ce soit ferait taire
    // l'alerte pour un compte qui n'existe pas.
    if (nu === "") return;
    await tx
      .update(factures)
      .set({ ibanSignale: ibanSansEspace(nu) })
      .where(eq(factures.id, factureId));
  });
}
