/**
 * CE QUI MANQUE POUR QU'UN DEVIS OU UNE FACTURE SOIT EN RÈGLE — son choix 1A
 * du 3 octobre 2026 : *« elle doit bloquer s'il manque un prix ou une info
 * obligatoire qui n'a pas été remplie »*.
 *
 * Jusque-là, rien ne vérifiait une mention avant l'envoi : un SIRET oublié dans
 * Réglages, une adresse de client vide, un médiateur jamais saisi partaient
 * sur la pièce sans un mot (`docs/lot-mentions-facture-devis.md`). Le prix,
 * lui, bloquait déjà (`lignesEnAttenteDePrix`) ; il ne change pas.
 *
 * **Une seule règle pour l'écran et pour le serveur** (`CLAUDE.md` §3) : la
 * fenêtre qui dit ce qui manque et le refus qui l'empêche de partir lisent ces
 * deux fonctions.
 *
 * | Mention | Devis | Facture | Le texte |
 * |---|---|---|---|
 * | nom, adresse, SIRET de l'entreprise | oui | oui | CGI ann. II, 242 nonies A ; Code de la consommation, L111-1 |
 * | forme juridique (pour « EI » ou la forme de la société) | oui | oui | Code de commerce, R526-27 et R123-237 |
 * | capital et ville du RCS d'une société | oui | oui | R123-237 |
 * | médiateur de la consommation | oui | non | L616-1 |
 * | téléphone et courriel de l'entreprise | oui, sauf sous-traitance | non | Code de la consommation, R111-1, 1° |
 * | décennale, quand ses conditions la citent | oui | non | Code des assurances, L243-2 |
 * | adresse de l'assureur et attestation, quand un assureur est nommé | oui | oui | loi 96-603, art. 22-2 ; L243-2 |
 * | numéro de TVA d'un assujetti | non | oui | 242 nonies A, I-4° |
 * | nom du client | oui | oui | |
 * | adresse du client (à défaut celle du chantier) | non | oui | 242 nonies A, I-2° |
 * | numéro de TVA du donneur d'ordre, en autoliquidation | non | oui | 242 nonies A, I-4° |
 *
 * **La décennale ne bloque que si SES conditions générales la citent encore
 * entre crochets.** Atlas ne sait pas si ses travaux y sont soumis (un
 * entretien de jardin ne l'est pas, une terrasse l'est) ; un crochet resté
 * vide, lui, partirait tel quel chez le client.
 */
import { formeADuCapital } from "./formes-juridiques";
import { CROCHET_DECENNALE } from "./conditions-generales";

/**
 * Où il complète : l'écran de son entreprise, la fiche du client, ou la pièce
 * elle-même (le numéro de TVA du donneur d'ordre se saisit sur la facture).
 */
export type OuCompleter = "entreprise" | "client" | "piece";

export type Manque = { cle: string; libelle: string; ou: OuCompleter };

export type EmetteurAVerifier = {
  nom: string | null | undefined;
  adresse: string | null | undefined;
  siret: string | null | undefined;
  formeJuridique: string | null | undefined;
  capitalSocial: string | number | null | undefined;
  villeRcs: string | null | undefined;
  mediateurNom: string | null | undefined;
  assureurDecennale: string | null | undefined;
  regimeTva: "assujettie" | "franchise" | null | undefined;
  numeroTva: string | null | undefined;
  telephone: string | null | undefined;
  email: string | null | undefined;
  adresseAssureurDecennale: string | null | undefined;
  /** Une attestation déposée ; ce qui compte ici, c'est qu'elle existe. */
  attestationDecennale: boolean;
};

export type ClientAVerifier = {
  nom: string | null | undefined;
  adresse: string | null | undefined;
  adresseChantier: string | null | undefined;
};

const vide = (v: string | number | null | undefined) => String(v ?? "").trim() === "";

/**
 * **Un assureur nommé dit que ses travaux y sont soumis**, et c'est le seul
 * signe qu'Atlas en ait. La loi veut alors, sur chaque devis et chaque facture,
 * les coordonnées de l'assureur (loi 96-603, art. 22-2) et l'attestation jointe
 * (C. ass. L243-2), sous-traitance comprise : ni l'une ni l'autre n'est du droit
 * de la consommation (`docs/check-up-legal-documents.md`, points 1 et 2).
 */
function manquesDeLAssurance(e: EmetteurAVerifier): Manque[] {
  if (vide(e.assureurDecennale)) return [];
  const m: Manque[] = [];
  if (vide(e.adresseAssureurDecennale)) {
    m.push({ cle: "decennale-adresse", libelle: "L'adresse de votre assureur décennal", ou: "entreprise" });
  }
  if (!e.attestationDecennale) {
    m.push({ cle: "decennale-attestation", libelle: "Votre attestation d'assurance décennale", ou: "entreprise" });
  }
  return m;
}

function manquesDeLEmetteur(e: EmetteurAVerifier): Manque[] {
  const m: Manque[] = [];
  if (vide(e.nom)) m.push({ cle: "nom", libelle: "Le nom de votre entreprise", ou: "entreprise" });
  if (vide(e.adresse)) m.push({ cle: "adresse", libelle: "L'adresse de votre entreprise", ou: "entreprise" });
  if (vide(e.siret)) m.push({ cle: "siret", libelle: "Votre SIRET", ou: "entreprise" });
  if (vide(e.formeJuridique)) {
    m.push({ cle: "forme", libelle: "Votre forme juridique (EI, SARL, SAS…)", ou: "entreprise" });
  } else if (formeADuCapital(e.formeJuridique)) {
    if (vide(e.capitalSocial)) m.push({ cle: "capital", libelle: "Le capital de votre société", ou: "entreprise" });
    if (vide(e.villeRcs)) m.push({ cle: "rcs", libelle: "La ville de votre RCS", ou: "entreprise" });
  }
  return [...m, ...manquesDeLAssurance(e)];
}

function manquesDuClient(c: ClientAVerifier, avecAdresse: boolean): Manque[] {
  const m: Manque[] = [];
  if (vide(c.nom)) m.push({ cle: "client-nom", libelle: "Le nom du client", ou: "client" });
  // **L'adresse n'est exigée que sur la FACTURE**, où le texte l'impose
  // (242 nonies A, I-2°). Sur un devis, aucun texte sûr ne l'exige : la
  // bloquer arrêterait un devis légitime, dicté sur place sans adresse.
  // L'adresse du chantier tient lieu d'adresse du client quand il n'en a pas
  // d'autre : c'est ce que le papier imprime (`adressesDuDocument`).
  if (avecAdresse && vide(c.adresse) && vide(c.adresseChantier)) {
    m.push({ cle: "client-adresse", libelle: "L'adresse du client", ou: "client" });
  }
  return m;
}

/** Ce qui manque à un devis pour partir. Vide : il part. */
export function manquesDuDevis(
  e: EmetteurAVerifier,
  client: ClientAVerifier,
  conditionsGenerales: string | null | undefined,
  sousTraitance = false
): Manque[] {
  const m = manquesDeLEmetteur(e);
  // **Le médiateur ne protège qu'un consommateur** (L616-1) : un devis en
  // sous-traitance va à une entreprise, il n'en a pas besoin.
  if (!sousTraitance && vide(e.mediateurNom)) {
    m.push({ cle: "mediateur", libelle: "Votre médiateur de la consommation", ou: "entreprise" });
  }
  // **Le particulier doit pouvoir le joindre avant de signer** (R111-1, 1° :
  // « son numéro de téléphone et son adresse électronique »). Le papier les
  // imprimait quand ils étaient remplis, mais rien ne les réclamait
  // (`docs/check-up-legal-documents.md`, point 7). Même borne que le
  // médiateur : le droit de la consommation ne suit pas la sous-traitance.
  if (!sousTraitance && vide(e.telephone)) {
    m.push({ cle: "telephone", libelle: "Votre numéro de téléphone", ou: "entreprise" });
  }
  if (!sousTraitance && vide(e.email)) {
    m.push({ cle: "email", libelle: "Votre adresse e-mail", ou: "entreprise" });
  }
  if (vide(e.assureurDecennale) && (conditionsGenerales ?? "").includes(CROCHET_DECENNALE)) {
    m.push({ cle: "decennale", libelle: "Votre assurance décennale", ou: "entreprise" });
  }
  return [...m, ...manquesDuClient(client, false)];
}

/** Ce qui manque à une facture pour partir. Vide : elle part. */
export function manquesDeLaFacture(
  e: EmetteurAVerifier,
  client: ClientAVerifier,
  autoliquidation: { active: boolean; numeroTvaClient: string | null | undefined }
): Manque[] {
  const m = manquesDeLEmetteur(e);
  if (e.regimeTva !== "franchise" && vide(e.numeroTva)) {
    m.push({ cle: "tva", libelle: "Votre numéro de TVA intracommunautaire", ou: "entreprise" });
  }
  const duClient = manquesDuClient(client, true);
  if (autoliquidation.active && vide(autoliquidation.numeroTvaClient)) {
    duClient.push({
      cle: "tva-client",
      libelle: `Le numéro de TVA de ${String(client.nom ?? "").trim() || "votre client"}`,
      ou: "piece",
    });
  }
  return [...m, ...duClient];
}

/** La phrase du refus côté serveur, quand l'écran a été contourné. */
export function phraseDesManques(manques: readonly Manque[]): string {
  // Seule la première lettre s'abaisse : « votre SIRET », pas « votre siret ».
  const liste = manques.map((x) => x.libelle.charAt(0).toLowerCase() + x.libelle.slice(1)).join(", ");
  return `Il manque une mention obligatoire : ${liste}.`;
}
