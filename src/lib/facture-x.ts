import Decimal from "decimal.js";
import { echapperXml } from "./caldav";
import { totauxAvecReduction, tauxDeLaLigne } from "./reduction-devis";
import { mentionFranchise, sousFranchise } from "./franchise-tva";
import { MENTION_AUTOLIQUIDATION } from "./autoliquidation";
import { uniteAdmise } from "./unite-de-ligne";

/**
 * LE FICHIER XML D'UNE FACTURE-X, écrit depuis la facture d'Atlas.
 *
 * **Sa décision du 5 novembre 2026** (`ARCHITECTURE.md` §555, choix 1 A) :
 * Atlas fabrique la facture électronique, la plateforme agréée de l'artisan la
 * contrôle et la transmet. Une Factur-X est un PDF qui porte, cousu dedans, ce
 * fichier : les mêmes chiffres, dans la langue que lisent les logiciels
 * (syntaxe CII D16B, profil EN 16931, `urn:cen.eu:en16931:2017`).
 *
 * **Règle pure, sans base ni PDF.** Elle prend la même donnée que le papier
 * (`FacturePdfData` en est un sur-ensemble) et calcule ses totaux avec la même
 * fonction que lui, `totauxAvecReduction` : le XML et le PDF ne peuvent pas
 * dire deux montants différents, et s'ils le faisaient (une facture d'avant
 * une correction de calcul), la règle refuse au lieu de choisir.
 *
 * **Ce qu'elle refuse, elle le dit, et rien ne s'invente** (`docs/AGENT.md`
 * §3) : un numéro de TVA absent, une adresse sans code postal, une TVA à 0 %
 * sans motif. Le refus porte la phrase qu'on montrera au patron.
 *
 * **Ce qu'elle ne vérifie PAS, et il faut le dire** : les règles propres à la
 * France que la norme XP Z12-012 ajoute à l'EN 16931 (SIREN du client exigé,
 * adresse électronique, catégorie de l'opération). Elles ne sont pas
 * publiques ici ; la plateforme les contrôlera, et un refus reviendra avec sa
 * raison. Les règles européennes, elles, sont jouées par
 * `scripts/test-facture-x.ts` avec les fichiers officiels.
 */

export type LigneFactureX = {
  libelle: string;
  quantite: string;
  prixUnitaire: string;
  montant: string;
  unite?: string | null;
  tauxTva?: string | null;
  supplement?: boolean | null;
};

export type FacturePourFactureX = {
  numeroCommercial: string;
  /** `AAAA-MM-JJ`. */
  dateEmission: string;
  dateEcheance?: string | null;
  dateTravaux?: string | null;
  numeroDevis?: string | null;
  devise: string;
  tauxTva: string;
  reductionPourcent?: string | null;
  lignes: readonly LigneFactureX[];
  regimeTva?: "assujettie" | "franchise" | null;
  autoliquidation?: boolean;
  reglements?: readonly { montant: string }[] | null;
  /** Les totaux imprimés : le XML doit retomber exactement dessus. */
  totalHt: string;
  totalTva: string;
  totalTtc: string;
  entrepriseNom: string;
  entrepriseAdresse?: string | null;
  entrepriseSiret?: string | null;
  entrepriseNumeroTva?: string | null;
  entrepriseEmail?: string | null;
  /** Groupé par quatre sur le papier : les espaces partent ici. */
  entrepriseIban?: string | null;
  clientNom?: string | null;
  clientAdresse?: string | null;
  clientSiret?: string | null;
  clientNumeroTva?: string | null;
  clientCodeService?: string | null;
  clientNumeroEngagement?: string | null;
  adresseChantier?: string | null;
  conditionsPaiement?: string | null;
};

export type ResultatFactureX = { ok: true; xml: string } | { ok: false; raison: string };

/** Le profil que porte le fichier, et que la plateforme lit en premier. */
export const PROFIL_EN16931 = "urn:cen.eu:en16931:2017";

/**
 * L'unité d'une ligne, en code de la recommandation 20 de l'UNECE.
 *
 * **Une ligne n'a que sept unités** (`UNITES_USUELLES`, sa règle du
 * 29 septembre 2026), plus le jour de main d'œuvre : la table est donc
 * fermée. Ce que `uniteAdmise` ne reconnaît pas s'imprime « u » sur le
 * papier, et part donc « une unité » (C62) ici aussi : les deux pièces disent
 * la même chose.
 */
const CODES_UNITE: Record<string, string> = {
  u: "C62",
  ml: "MTR",
  "m²": "MTK",
  "m³": "MTQ",
  kg: "KGM",
  h: "HUR",
  forfait: "LS",
  jour: "DAY",
  "jour/homme": "DAY",
};

export function codeUnite(unite: string | null | undefined): string {
  return CODES_UNITE[uniteAdmise(unite) ?? "u"] ?? "C62";
}

/**
 * Une adresse écrite d'un trait, rendue en parties : ce qui précède le code
 * postal, le code, la ville.
 *
 * **Les adresses d'Atlas sont du texte libre**, souvent sorties de la Base
 * Adresse Nationale (« 12 rue des Lilas 33000 Bordeaux »). Le format européen
 * veut la ville et le code à part. Sans code postal à cinq chiffres, la règle
 * rend `null` : couper au hasard enverrait une ville fausse.
 */
export function adresseEnParties(
  texte: string | null | undefined
): { ligne: string; codePostal: string; ville: string } | null {
  const propre = (texte ?? "").replace(/\s+/g, " ").trim();
  const m = propre.match(/^(.*?)[,\s]*\b(\d{5})\s+([^,\d][^,]*?)\s*(?:,\s*france)?$/i);
  if (!m) return null;
  const ligne = m[1].replace(/[,\s]+$/, "").trim();
  const ville = m[3].trim();
  if (!ville) return null;
  return { ligne, codePostal: m[2], ville };
}

/** Le SIREN, les neuf premiers chiffres du SIRET. */
export function sirenDe(siret: string | null | undefined): string | null {
  const chiffres = (siret ?? "").replace(/\D/g, "");
  return chiffres.length >= 9 ? chiffres.slice(0, 9) : null;
}

const jour102 = (iso: string) => iso.slice(0, 10).replace(/-/g, "");
const montant = (d: Decimal) => d.toFixed(2);
/** Une quantité ou un prix, sans exposant ni zéros de queue. */
const nombre = (texte: string) => new Decimal(String(texte).replace(",", ".")).toFixed();
const x = (texte: string) => echapperXml(texte);

type Categorie = { code: "S" | "AE" | "E"; motif: string | null };

function categorieDe(f: FacturePourFactureX, taux: string): Categorie | null {
  if (f.autoliquidation) return { code: "AE", motif: MENTION_AUTOLIQUIDATION };
  // La phrase du jour de la facture, la même que son PDF (`mentionFranchise`) :
  // une Factur-X de 2027 qui citerait encore le CGI dirait autre chose que son
  // propre papier.
  if (sousFranchise(f.regimeTva ?? null, taux)) return { code: "E", motif: mentionFranchise(f.dateEmission.slice(0, 10)) };
  if (new Decimal(taux).greaterThan(0)) return { code: "S", motif: null };
  return null;
}

function blocTaxe(cat: Categorie, taux: string, extra: { base?: string; tva?: string } = {}): string {
  // L'ordre des éléments est celui du schéma CII D16B, et il est vérifié.
  return (
    "<ram:ApplicableTradeTax>" +
    (extra.tva !== undefined ? `<ram:CalculatedAmount>${extra.tva}</ram:CalculatedAmount>` : "") +
    "<ram:TypeCode>VAT</ram:TypeCode>" +
    (extra.base !== undefined && cat.motif ? `<ram:ExemptionReason>${x(cat.motif)}</ram:ExemptionReason>` : "") +
    (extra.base !== undefined ? `<ram:BasisAmount>${extra.base}</ram:BasisAmount>` : "") +
    `<ram:CategoryCode>${cat.code}</ram:CategoryCode>` +
    `<ram:RateApplicablePercent>${cat.code === "S" ? nombre(taux) : "0"}</ram:RateApplicablePercent>` +
    "</ram:ApplicableTradeTax>"
  );
}

function adresseXml(a: { ligne: string; codePostal: string; ville: string }): string {
  return (
    "<ram:PostalTradeAddress>" +
    `<ram:PostcodeCode>${a.codePostal}</ram:PostcodeCode>` +
    (a.ligne ? `<ram:LineOne>${x(a.ligne)}</ram:LineOne>` : "") +
    `<ram:CityName>${x(a.ville)}</ram:CityName>` +
    "<ram:CountryID>FR</ram:CountryID>" +
    "</ram:PostalTradeAddress>"
  );
}

export function xmlFactureX(f: FacturePourFactureX, mentionLegale: string): ResultatFactureX {
  const refus = (raison: string): ResultatFactureX => ({ ok: false, raison });

  if (!f.lignes.length) return refus("La facture n'a aucune ligne.");
  const vendeur = adresseEnParties(f.entrepriseAdresse);
  if (!vendeur) return refus("Votre adresse n'a pas de code postal lisible.");
  const acheteur = adresseEnParties(f.clientAdresse);
  if (!acheteur) return refus("L'adresse du client n'a pas de code postal lisible.");
  const siren = sirenDe(f.entrepriseSiret);
  const tvaVendeur = (f.entrepriseNumeroTva ?? "").replace(/\s+/g, "").toUpperCase() || null;
  // Le format européen veut un identifiant fiscal du vendeur pour toute
  // catégorie de TVA (BR-S-02, BR-AE-02, BR-E-02). Une entreprise en franchise
  // n'a souvent pas de numéro de TVA : la règle refuse plutôt que d'en poser un.
  if (!tvaVendeur) return refus("Votre numéro de TVA intracommunautaire manque.");
  const devise = f.devise.trim().toUpperCase();
  if (!/^[A-Z]{3}$/.test(devise)) return refus("La devise de la facture est illisible.");

  const totaux = totauxAvecReduction(f.lignes, f.tauxTva, f.reductionPourcent ?? null);
  const memes =
    new Decimal(totaux.totalHt).equals(new Decimal(f.totalHt)) &&
    new Decimal(totaux.totalTva).equals(new Decimal(f.totalTva)) &&
    new Decimal(totaux.totalTtc).equals(new Decimal(f.totalTtc));
  if (!memes) return refus("Les totaux de la facture ne retombent pas sur ses lignes.");

  const categories = new Map<string, Categorie>();
  for (const c of totaux.parTaux) {
    const cat = categorieDe(f, c.taux);
    if (!cat) return refus(`Une TVA à ${nombre(c.taux)} % sans motif d'exonération.`);
    categories.set(c.taux, cat);
  }
  if (f.autoliquidation && !sirenDe(f.clientSiret) && !(f.clientNumeroTva ?? "").trim()) {
    return refus("En sous-traitance, il faut le numéro de TVA ou le SIRET du client.");
  }

  const prepaye = (f.reglements ?? []).reduce((s, r) => s.plus(new Decimal(r.montant)), new Decimal(0));
  const ttc = new Decimal(totaux.totalTtc);
  const du = ttc.minus(prepaye);
  if (du.isNegative()) return refus("Les règlements reçus dépassent le total de la facture.");
  const echeance = f.dateEcheance ? jour102(f.dateEcheance) : null;
  const conditions = (f.conditionsPaiement ?? "").trim();
  // BR-CO-25 : un montant dû demande une échéance ou des conditions écrites.
  if (du.greaterThan(0) && !echeance && !conditions) return refus("La facture n'a ni échéance ni conditions de paiement.");

  const lignesXml: string[] = [];
  for (const [i, l] of f.lignes.entries()) {
    const libelle = l.libelle.replace(/\s+/g, " ").trim();
    if (!libelle) return refus(`La ligne ${i + 1} n'a pas de libellé.`);
    const taux = tauxDeLaLigne(l, f.tauxTva);
    let quantite = new Decimal(String(l.quantite).replace(",", "."));
    let prix = new Decimal(String(l.prixUnitaire).replace(",", "."));
    // Le prix net d'une ligne ne peut pas être négatif (BR-27) : une
    // déduction se dit par la quantité, et le produit reste le même.
    if (prix.isNegative()) {
      prix = prix.negated();
      quantite = quantite.negated();
    }
    lignesXml.push(
      "<ram:IncludedSupplyChainTradeLineItem>" +
        `<ram:AssociatedDocumentLineDocument><ram:LineID>${i + 1}</ram:LineID></ram:AssociatedDocumentLineDocument>` +
        `<ram:SpecifiedTradeProduct><ram:Name>${x(libelle)}</ram:Name></ram:SpecifiedTradeProduct>` +
        "<ram:SpecifiedLineTradeAgreement><ram:NetPriceProductTradePrice>" +
        `<ram:ChargeAmount>${prix.toFixed()}</ram:ChargeAmount>` +
        "</ram:NetPriceProductTradePrice></ram:SpecifiedLineTradeAgreement>" +
        `<ram:SpecifiedLineTradeDelivery><ram:BilledQuantity unitCode="${codeUnite(l.unite)}">${quantite.toFixed()}</ram:BilledQuantity></ram:SpecifiedLineTradeDelivery>` +
        "<ram:SpecifiedLineTradeSettlement>" +
        blocTaxe(categories.get(taux)!, taux) +
        `<ram:SpecifiedTradeSettlementLineMonetarySummation><ram:LineTotalAmount>${montant(new Decimal(l.montant))}</ram:LineTotalAmount></ram:SpecifiedTradeSettlementLineMonetarySummation>` +
        "</ram:SpecifiedLineTradeSettlement>" +
        "</ram:IncludedSupplyChainTradeLineItem>"
    );
  }

  if (!(f.clientNom ?? "").trim()) return refus("La facture n'a pas le nom du client.");
  const sirenClient = sirenDe(f.clientSiret);
  const tvaClient = (f.clientNumeroTva ?? "").replace(/\s+/g, "").toUpperCase();
  const vendeurXml =
    "<ram:SellerTradeParty>" +
    `<ram:Name>${x(f.entrepriseNom)}</ram:Name>` +
    (siren ? `<ram:SpecifiedLegalOrganization><ram:ID schemeID="0002">${siren}</ram:ID></ram:SpecifiedLegalOrganization>` : "") +
    adresseXml(vendeur) +
    (f.entrepriseEmail ? `<ram:URIUniversalCommunication><ram:URIID schemeID="EM">${x(f.entrepriseEmail.trim())}</ram:URIID></ram:URIUniversalCommunication>` : "") +
    `<ram:SpecifiedTaxRegistration><ram:ID schemeID="VA">${x(tvaVendeur)}</ram:ID></ram:SpecifiedTaxRegistration>` +
    "</ram:SellerTradeParty>";
  const acheteurXml =
    "<ram:BuyerTradeParty>" +
    `<ram:Name>${x(f.clientNom!.trim())}</ram:Name>` +
    (sirenClient ? `<ram:SpecifiedLegalOrganization><ram:ID schemeID="0002">${sirenClient}</ram:ID></ram:SpecifiedLegalOrganization>` : "") +
    adresseXml(acheteur) +
    (tvaClient ? `<ram:SpecifiedTaxRegistration><ram:ID schemeID="VA">${x(tvaClient)}</ram:ID></ram:SpecifiedTaxRegistration>` : "") +
    "</ram:BuyerTradeParty>";
  const chantier = adresseEnParties(f.adresseChantier);
  const livraison =
    "<ram:ApplicableHeaderTradeDelivery>" +
    (chantier ? `<ram:ShipToTradeParty>${adresseXml(chantier)}</ram:ShipToTradeParty>` : "") +
    (f.dateTravaux
      ? `<ram:ActualDeliverySupplyChainEvent><ram:OccurrenceDateTime><udt:DateTimeString format="102">${jour102(f.dateTravaux)}</udt:DateTimeString></ram:OccurrenceDateTime></ram:ActualDeliverySupplyChainEvent>`
      : "") +
    "</ram:ApplicableHeaderTradeDelivery>";

  const iban = (f.entrepriseIban ?? "").replace(/\s+/g, "").toUpperCase();
  const taxes = totaux.parTaux
    .map((c) => blocTaxe(categories.get(c.taux)!, c.taux, { base: c.baseHt, tva: c.tva }))
    .join("");
  const remises = totaux.parTaux
    .filter((c) => c.reductionMontant !== null && new Decimal(c.reductionMontant).greaterThan(0))
    .map(
      (c) =>
        "<ram:SpecifiedTradeAllowanceCharge>" +
        "<ram:ChargeIndicator><udt:Indicator>false</udt:Indicator></ram:ChargeIndicator>" +
        `<ram:ActualAmount>${c.reductionMontant}</ram:ActualAmount>` +
        "<ram:Reason>Remise</ram:Reason>" +
        `<ram:CategoryTradeTax><ram:TypeCode>VAT</ram:TypeCode><ram:CategoryCode>${categories.get(c.taux)!.code}</ram:CategoryCode>` +
        `<ram:RateApplicablePercent>${categories.get(c.taux)!.code === "S" ? nombre(c.taux) : "0"}</ram:RateApplicablePercent></ram:CategoryTradeTax>` +
        "</ram:SpecifiedTradeAllowanceCharge>"
    )
    .join("");
  const conditionsXml =
    echeance || conditions
      ? "<ram:SpecifiedTradePaymentTerms>" +
        (conditions ? `<ram:Description>${x(conditions)}</ram:Description>` : "") +
        (echeance ? `<ram:DueDateDateTime><udt:DateTimeString format="102">${echeance}</udt:DateTimeString></ram:DueDateDateTime>` : "") +
        "</ram:SpecifiedTradePaymentTerms>"
      : "";
  const reduction = totaux.reductionMontant !== null ? new Decimal(totaux.reductionMontant) : null;

  const reglement =
    "<ram:ApplicableHeaderTradeSettlement>" +
    `<ram:PaymentReference>${x(f.numeroCommercial)}</ram:PaymentReference>` +
    `<ram:InvoiceCurrencyCode>${devise}</ram:InvoiceCurrencyCode>` +
    (iban
      ? `<ram:SpecifiedTradeSettlementPaymentMeans><ram:TypeCode>58</ram:TypeCode><ram:PayeePartyCreditorFinancialAccount><ram:IBANID>${x(iban)}</ram:IBANID></ram:PayeePartyCreditorFinancialAccount></ram:SpecifiedTradeSettlementPaymentMeans>`
      : "") +
    taxes +
    remises +
    conditionsXml +
    "<ram:SpecifiedTradeSettlementHeaderMonetarySummation>" +
    `<ram:LineTotalAmount>${totaux.brutHt}</ram:LineTotalAmount>` +
    (reduction && reduction.greaterThan(0) ? `<ram:AllowanceTotalAmount>${montant(reduction)}</ram:AllowanceTotalAmount>` : "") +
    `<ram:TaxBasisTotalAmount>${totaux.totalHt}</ram:TaxBasisTotalAmount>` +
    `<ram:TaxTotalAmount currencyID="${devise}">${totaux.totalTva}</ram:TaxTotalAmount>` +
    `<ram:GrandTotalAmount>${totaux.totalTtc}</ram:GrandTotalAmount>` +
    (prepaye.greaterThan(0) ? `<ram:TotalPrepaidAmount>${montant(prepaye)}</ram:TotalPrepaidAmount>` : "") +
    `<ram:DuePayableAmount>${montant(du)}</ram:DuePayableAmount>` +
    "</ram:SpecifiedTradeSettlementHeaderMonetarySummation>" +
    "</ram:ApplicableHeaderTradeSettlement>";

  const accord =
    "<ram:ApplicableHeaderTradeAgreement>" +
    ((f.clientCodeService ?? "").trim() ? `<ram:BuyerReference>${x(f.clientCodeService!.trim())}</ram:BuyerReference>` : "") +
    vendeurXml +
    acheteurXml +
    ((f.clientNumeroEngagement ?? "").trim()
      ? `<ram:BuyerOrderReferencedDocument><ram:IssuerAssignedID>${x(f.clientNumeroEngagement!.trim())}</ram:IssuerAssignedID></ram:BuyerOrderReferencedDocument>`
      : "") +
    // Le devis accepté est le contrat de la vente (BT-12).
    ((f.numeroDevis ?? "").trim()
      ? `<ram:ContractReferencedDocument><ram:IssuerAssignedID>${x(f.numeroDevis!.trim())}</ram:IssuerAssignedID></ram:ContractReferencedDocument>`
      : "") +
    "</ram:ApplicableHeaderTradeAgreement>";

  const mention = mentionLegale.replace(/\s+/g, " ").trim();
  const xml =
    '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<rsm:CrossIndustryInvoice xmlns:rsm="urn:un:unece:uncefact:data:standard:CrossIndustryInvoice:100"' +
    ' xmlns:ram="urn:un:unece:uncefact:data:standard:ReusableAggregateBusinessInformationEntity:100"' +
    ' xmlns:qdt="urn:un:unece:uncefact:data:standard:QualifiedDataType:100"' +
    ' xmlns:udt="urn:un:unece:uncefact:data:standard:UnqualifiedDataType:100">' +
    "<rsm:ExchangedDocumentContext>" +
    `<ram:GuidelineSpecifiedDocumentContextParameter><ram:ID>${PROFIL_EN16931}</ram:ID></ram:GuidelineSpecifiedDocumentContextParameter>` +
    "</rsm:ExchangedDocumentContext>" +
    "<rsm:ExchangedDocument>" +
    `<ram:ID>${x(f.numeroCommercial)}</ram:ID>` +
    "<ram:TypeCode>380</ram:TypeCode>" +
    `<ram:IssueDateTime><udt:DateTimeString format="102">${jour102(f.dateEmission)}</udt:DateTimeString></ram:IssueDateTime>` +
    (mention ? `<ram:IncludedNote><ram:Content>${x(mention)}</ram:Content></ram:IncludedNote>` : "") +
    "</rsm:ExchangedDocument>" +
    "<rsm:SupplyChainTradeTransaction>" +
    lignesXml.join("") +
    accord +
    livraison +
    reglement +
    "</rsm:SupplyChainTradeTransaction>" +
    "</rsm:CrossIndustryInvoice>\n";
  return { ok: true, xml };
}
