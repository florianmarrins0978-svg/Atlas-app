import { ibanSansEspace } from "@/lib/modalites-paiement";

/**
 * L'AVANCE IMMÉDIATE DU CRÉDIT D'IMPÔT : ce qu'Atlas envoie à l'Urssaf, et
 * ce qu'il en relit. Aucune base, aucun réseau ici : seulement les règles.
 *
 * **La source, et elle seule.** La description officielle de l'API « Tiers de
 * prestation » (version 1.29.1, `swaggers/api-tiers-de-prestation.json` du
 * dépôt public `betagouv/api_gouv_swaggers`, lue le 8 novembre 2026). Les
 * motifs et les longueurs ci-dessous en sont recopiés : un champ refusé ici
 * l'aurait été par l'Urssaf, avec une erreur moins lisible et un aller-retour
 * de plus. Le portail technique de l'Urssaf ne répond pas depuis la session
 * de développement ; ce qui n'est pas dans cette description est signalé
 * comme tel, jamais deviné.
 *
 * **Ce qui n'est PAS ici, et pourquoi.** Le code « nature » d'une prestation
 * (l'exemple officiel vaut « ENF ») suit une nomenclature que la description
 * ne donne pas : il est demandé à l'appelant, jamais choisi par défaut. Un
 * jardinage déclaré sous la mauvaise nature priverait le client de son
 * crédit d'impôt, sans que rien ne le dise.
 */

/** La portée que l'Urssaf attend sur le jeton (description officielle). */
export const PORTEE_URSSAF = "homeplus.tiersprestations";

/** Le code INSEE de la France, pays de naissance ou de résidence. */
export const CODE_PAYS_FRANCE = "99100";

// ─── Ce que l'Urssaf attend, champ par champ ─────────────────────────────

export type ParticulierUrssaf = {
  civilite: "1" | "2";
  nomNaissance: string;
  nomUsage?: string;
  prenoms: string;
  dateNaissance: string;
  lieuNaissance: {
    codePaysNaissance: string;
    departementNaissance?: string;
    communeNaissance?: { codeCommune: string; libelleCommune?: string };
  };
  numeroTelephonePortable: string;
  adresseMail: string;
  adressePostale: {
    numeroVoie?: string;
    lettreVoie?: string;
    codeTypeVoie?: string;
    libelleVoie?: string;
    complement?: string;
    lieuDit?: string;
    libelleCommune: string;
    codeCommune: string;
    codePostal: string;
    codePays: string;
  };
  coordonneeBancaire: { bic: string; iban: string; titulaire: string };
};

export type PrestationUrssaf = {
  codeNature: string;
  codeActivite?: string;
  quantite: number;
  unite: "HEURE" | "FORFAIT";
  mntUnitaireTTC: number;
  mntPrestationTTC: number;
  mntPrestationHT: number;
  mntPrestationTVA: number;
  dateDebutEmploi?: string;
  dateFinEmploi?: string;
  complement1?: string;
  complement2?: string;
};

export type DemandePaiementUrssaf = {
  idTiersFacturation: string;
  idClient: string;
  dateNaissanceClient: string;
  numFactureTiers: string;
  dateFacture: string;
  dateDebutEmploi: string;
  dateFinEmploi: string;
  mntFactureTTC: number;
  mntFactureHT: number;
  inputPrestations: PrestationUrssaf[];
};

// ─── Ce qu'Atlas sait, et ce qu'il demande au patron ─────────────────────

/** Une date du calendrier, telle qu'Atlas la range : `AAAA-MM-JJ`. */
type Jour = string;

export type ParticulierAtlas = {
  civilite: "M" | "Mme" | null;
  nomNaissance: string | null;
  /** Seulement s'il diffère du nom de naissance. */
  nomUsage?: string | null;
  prenoms: string | null;
  dateNaissance: Jour | null;
  /**
   * Né en France : le département (« 069 », « 02B ») et le code de la commune
   * tels que l'Urssaf les découpe. Né ailleurs : le code INSEE du pays.
   */
  naissance:
    | { enFrance: true; departement: string | null; codeCommune: string | null; libelleCommune?: string | null }
    | { enFrance: false; codePays: string | null }
    | null;
  portable: string | null;
  email: string | null;
  adresse: {
    numeroVoie?: string | null;
    lettreVoie?: string | null;
    codeTypeVoie?: string | null;
    libelleVoie?: string | null;
    complement?: string | null;
    lieuDit?: string | null;
    codePostal: string | null;
    codeCommune: string | null;
    libelleCommune: string | null;
  } | null;
  banque: { iban: string | null; bic: string | null; titulaire: string | null } | null;
};

/** Ce qui manque ou ne passe pas, dit dans les mots de l'écran. */
export type Manque = { champ: string; libelle: string; raison: "absent" | "format" };

export type Verdict<T> = { ok: true; valeur: T } | { ok: false; manques: Manque[] };

// ─── Les motifs de la description officielle ─────────────────────────────

/** Lettres, apostrophe, tiret, espace ; commence et finit par une lettre. */
const NOM = /^\p{L}(?:[\p{L}'\- ]*\p{L})?$/u;
/** Des mots de lettres (apostrophe ou tiret DANS un mot), séparés d'un espace. */
const PRENOMS = /^\p{L}+(?:['-]*\p{L}+)*(?: \p{L}+(?:['-]*\p{L}+)*)*$/u;
const PORTABLE = /^(0|\+33)[6-7]([0-9]{2}){4}$/;
const COURRIEL = /^[-A-Za-z0-9_]+(\.[-A-Za-z0-9_]+)*@[A-Za-z0-9]+((-|\.)[A-Za-z0-9]+)*\.[A-Za-z]+$/;
const CODE_PAYS = /^[0-9]{5}$/;
const DEPARTEMENT = /^[09][0-9][0-9abAB]$/;
const COMMUNE_NAISSANCE = /^[0-9]{3}$/;
const CODE_COMMUNE = /^[0-9][0-9a-bA-B][0-9]{3}$/;
const CODE_POSTAL = /^[0-9]{5}$/;
const NUMERO_VOIE = /^(?!0$)[0-9]{0,20}$/;
const TYPE_VOIE = /^[0-9A-Za-z]{0,4}$/;
const BIC = /^[a-zA-Z]{6}[0-9a-zA-Z]{2}([0-9a-zA-Z]{3})?$/;
const IBAN = /^[a-zA-Z]{2}[0-9]{2}[a-zA-Z0-9]{4}[0-9]{7}([a-zA-Z0-9]?){0,16}$/;
const JOUR = /^\d{4}-\d{2}-\d{2}$/;
/**
 * Le numéro de l'organisme sur chaque prestation : « SAP » et neuf chiffres,
 * ou « SIR » et les quatorze du SIRET pour une coopérative. Demandé par
 * l'Urssaf depuis septembre 2023 (aide d'Evoliz, « Comment connecter l'Urssaf
 * à evoliz ») et porté par `complement2` dans une intégration publique.
 */
const NUMERO_ORGANISME = /^(SAP\d{9}|SIR\d{14})$/;

function vide(v: string | null | undefined): boolean {
  return v === null || v === undefined || v.trim() === "";
}

/** La clé de l'IBAN (ISO 13616) : une faute de frappe se voit avant l'envoi. */
export function ibanBienForme(iban: string): boolean {
  const nu = ibanSansEspace(iban);
  if (!IBAN.test(nu) || nu.length < 18 || nu.length > 38) return false;
  const tourne = nu.slice(4) + nu.slice(0, 4);
  let reste = 0;
  for (const c of tourne) {
    const n = c >= "A" && c <= "Z" ? String(c.charCodeAt(0) - 55) : c;
    for (const chiffre of n) reste = (reste * 10 + Number(chiffre)) % 97;
  }
  return reste === 1;
}

/** Une date à minuit UTC, la forme des exemples officiels. */
function dateUrssaf(jour: Jour): string {
  return `${jour}T00:00:00.000Z`;
}

/** Le portable sans ses espaces ni ses points, tel que le motif l'attend. */
function portableNu(portable: string): string {
  return portable.replace(/[\s.]/g, "");
}

// ─── L'inscription d'un client ───────────────────────────────────────────

/**
 * Ce qu'Atlas envoie pour inscrire un client. Rend la liste COMPLÈTE de ce
 * qui manque, pas la première case vide : le patron remplit tout d'un coup.
 */
export function particulierPourUrssaf(p: ParticulierAtlas): Verdict<ParticulierUrssaf> {
  const manques: Manque[] = [];
  const exiger = (champ: string, libelle: string, valeur: string | null | undefined, motif?: RegExp, max?: number) => {
    if (vide(valeur)) { manques.push({ champ, libelle, raison: "absent" }); return; }
    const v = (valeur as string).trim();
    if ((motif && !motif.test(v)) || (max !== undefined && v.length > max)) manques.push({ champ, libelle, raison: "format" });
  };

  if (!p.civilite) manques.push({ champ: "civilite", libelle: "Civilité", raison: "absent" });
  exiger("nomNaissance", "Nom de naissance", p.nomNaissance, NOM, 100);
  if (!vide(p.nomUsage)) exiger("nomUsage", "Nom d'usage", p.nomUsage, NOM, 100);
  exiger("prenoms", "Prénoms", p.prenoms, PRENOMS, 256);
  exiger("dateNaissance", "Date de naissance", p.dateNaissance, JOUR);

  if (!p.naissance) {
    manques.push({ champ: "lieuNaissance", libelle: "Lieu de naissance", raison: "absent" });
  } else if (p.naissance.enFrance) {
    exiger("departementNaissance", "Département de naissance", p.naissance.departement, DEPARTEMENT);
    exiger("communeNaissance", "Commune de naissance", p.naissance.codeCommune, COMMUNE_NAISSANCE);
  } else {
    exiger("paysNaissance", "Pays de naissance", p.naissance.codePays, CODE_PAYS);
  }

  if (vide(p.portable)) manques.push({ champ: "portable", libelle: "Portable", raison: "absent" });
  else if (!PORTABLE.test(portableNu(p.portable as string))) manques.push({ champ: "portable", libelle: "Portable", raison: "format" });
  exiger("email", "E-mail", p.email, COURRIEL);

  if (!p.adresse) {
    manques.push({ champ: "adresse", libelle: "Adresse", raison: "absent" });
  } else {
    exiger("codePostal", "Code postal", p.adresse.codePostal, CODE_POSTAL);
    exiger("codeCommune", "Code de la commune", p.adresse.codeCommune, CODE_COMMUNE);
    exiger("libelleCommune", "Commune", p.adresse.libelleCommune, undefined, 50);
    if (!vide(p.adresse.numeroVoie)) exiger("numeroVoie", "Numéro de voie", p.adresse.numeroVoie, NUMERO_VOIE);
    if (!vide(p.adresse.codeTypeVoie)) exiger("codeTypeVoie", "Type de voie", p.adresse.codeTypeVoie, TYPE_VOIE);
    if (!vide(p.adresse.libelleVoie)) exiger("libelleVoie", "Nom de la voie", p.adresse.libelleVoie, undefined, 28);
    if (!vide(p.adresse.complement)) exiger("complement", "Complément d'adresse", p.adresse.complement, undefined, 38);
    if (!vide(p.adresse.lieuDit)) exiger("lieuDit", "Lieu-dit", p.adresse.lieuDit, undefined, 38);
    if (!vide(p.adresse.lettreVoie)) exiger("lettreVoie", "Bis, ter", p.adresse.lettreVoie, /^[A-Za-z]$/);
  }

  if (!p.banque) {
    manques.push({ champ: "iban", libelle: "IBAN", raison: "absent" });
  } else {
    if (vide(p.banque.iban)) manques.push({ champ: "iban", libelle: "IBAN", raison: "absent" });
    else if (!ibanBienForme(p.banque.iban as string)) manques.push({ champ: "iban", libelle: "IBAN", raison: "format" });
    exiger("bic", "BIC", p.banque.bic ? p.banque.bic.replace(/\s+/g, "") : p.banque.bic, BIC);
    exiger("titulaire", "Titulaire du compte", p.banque.titulaire, undefined, 100);
  }

  if (manques.length) return { ok: false, manques };

  const t = (v: string | null | undefined) => (vide(v) ? undefined : (v as string).trim());
  const a = p.adresse!;
  const n = p.naissance!;
  const valeur: ParticulierUrssaf = {
    civilite: p.civilite === "Mme" ? "2" : "1",
    nomNaissance: p.nomNaissance!.trim(),
    ...(t(p.nomUsage) ? { nomUsage: t(p.nomUsage) } : {}),
    prenoms: p.prenoms!.trim(),
    dateNaissance: dateUrssaf(p.dateNaissance!),
    lieuNaissance: n.enFrance
      ? {
          codePaysNaissance: CODE_PAYS_FRANCE,
          departementNaissance: n.departement!.trim().toUpperCase(),
          communeNaissance: {
            codeCommune: n.codeCommune!.trim(),
            ...(t(n.libelleCommune) ? { libelleCommune: t(n.libelleCommune)!.slice(0, 50) } : {}),
          },
        }
      : { codePaysNaissance: n.codePays!.trim() },
    numeroTelephonePortable: portableNu(p.portable!),
    adresseMail: p.email!.trim(),
    adressePostale: {
      ...(t(a.numeroVoie) ? { numeroVoie: t(a.numeroVoie) } : {}),
      ...(t(a.lettreVoie) ? { lettreVoie: t(a.lettreVoie)!.toUpperCase() } : {}),
      ...(t(a.codeTypeVoie) ? { codeTypeVoie: t(a.codeTypeVoie) } : {}),
      ...(t(a.libelleVoie) ? { libelleVoie: t(a.libelleVoie) } : {}),
      ...(t(a.complement) ? { complement: t(a.complement) } : {}),
      ...(t(a.lieuDit) ? { lieuDit: t(a.lieuDit) } : {}),
      libelleCommune: a.libelleCommune!.trim(),
      codeCommune: a.codeCommune!.trim(),
      codePostal: a.codePostal!.trim(),
      codePays: CODE_PAYS_FRANCE,
    },
    coordonneeBancaire: {
      bic: p.banque!.bic!.replace(/\s+/g, "").toUpperCase(),
      iban: ibanSansEspace(p.banque!.iban!),
      titulaire: p.banque!.titulaire!.trim(),
    },
  };
  return { ok: true, valeur };
}

// ─── La demande de paiement d'une facture ────────────────────────────────

/** Une ligne de facture, en centimes : jamais d'arrondi caché. */
export type LigneAtlas = {
  codeNature: string | null;
  codeActivite?: string | null;
  quantite: number;
  unite: "HEURE" | "FORFAIT";
  unitaireTTCCentimes: number;
  htCentimes: number;
  tvaCentimes: number;
  ttcCentimes: number;
  /** La date et la durée d'une intervention, lisibles par le client. */
  complement1?: string | null;
};

export type FactureAtlas = {
  /** L'identifiant que l'Urssaf donne à l'artisan (« identifiant SI Home+ »). */
  idTiersFacturation: string | null;
  /** SAP et neuf chiffres, ou SIR et quatorze pour une coopérative. */
  numeroOrganisme: string | null;
  /** Rendu par l'Urssaf à l'inscription du client. */
  idClient: string | null;
  dateNaissanceClient: Jour | null;
  numero: string | null;
  dateFacture: Jour | null;
  debutEmploi: Jour | null;
  finEmploi: Jour | null;
  lignes: LigneAtlas[];
  /** Ce que le client a déjà réglé sur cette facture, acompte compris. */
  dejaRegleCentimes: number;
};

function euros(centimes: number): number {
  return Math.round(centimes) / 100;
}

/**
 * La demande de paiement d'UNE facture, vérifiée avant l'envoi.
 *
 * **Une période d'un seul mois du calendrier** : la fiche officielle de l'API
 * (data.gouv.fr) dit que la période d'emploi « ne peut excéder un mois
 * calendaire ». Lue ici au sens le plus sûr, le même mois : une facture qui
 * en chevauche deux se coupe, plutôt que d'être refusée par l'Urssaf.
 *
 * **Rien de déjà réglé.** Une facture qui porte un règlement ne part pas : un
 * acompte encaissé puis déclaré à l'Urssaf oblige à une garantie financière
 * dès le premier euro (aide d'Evoliz, 20 octobre 2026). La facture part
 * entière, ou elle part par le chemin ordinaire.
 *
 * **Des totaux qui se recomposent.** Chaque ligne vaut sa quantité fois son
 * prix TTC, son HT plus sa TVA ; la facture vaut la somme de ses lignes. Une
 * différence d'un centime est un refus ici, pas une surprise chez l'Urssaf.
 */
export function demandePaiementPourUrssaf(f: FactureAtlas): Verdict<DemandePaiementUrssaf> {
  const manques: Manque[] = [];
  const exiger = (champ: string, libelle: string, valeur: string | null, motif?: RegExp) => {
    if (vide(valeur)) manques.push({ champ, libelle, raison: "absent" });
    else if (motif && !motif.test((valeur as string).trim())) manques.push({ champ, libelle, raison: "format" });
  };
  exiger("idTiersFacturation", "Identifiant Urssaf de l'entreprise", f.idTiersFacturation);
  exiger("numeroOrganisme", "Numéro de déclaration", f.numeroOrganisme, NUMERO_ORGANISME);
  exiger("idClient", "Inscription du client à l'Urssaf", f.idClient);
  exiger("dateNaissanceClient", "Date de naissance du client", f.dateNaissanceClient, JOUR);
  exiger("numero", "Numéro de la facture", f.numero);
  exiger("dateFacture", "Date de la facture", f.dateFacture, JOUR);
  exiger("debutEmploi", "Début de la période", f.debutEmploi, JOUR);
  exiger("finEmploi", "Fin de la période", f.finEmploi, JOUR);

  if (!vide(f.debutEmploi) && !vide(f.finEmploi) && JOUR.test(f.debutEmploi!) && JOUR.test(f.finEmploi!)) {
    if (f.finEmploi! < f.debutEmploi!) manques.push({ champ: "periode", libelle: "La période finit avant de commencer", raison: "format" });
    else if (f.debutEmploi!.slice(0, 7) !== f.finEmploi!.slice(0, 7)) manques.push({ champ: "periode", libelle: "Une facture par mois du calendrier", raison: "format" });
  }
  if (f.dejaRegleCentimes > 0) manques.push({ champ: "reglements", libelle: "Facture déjà en partie réglée", raison: "format" });
  if (!f.lignes.length) manques.push({ champ: "lignes", libelle: "Aucune prestation", raison: "absent" });

  f.lignes.forEach((l, i) => {
    const qui = `Ligne ${i + 1}`;
    if (vide(l.codeNature)) manques.push({ champ: `lignes.${i}.codeNature`, libelle: `${qui} : nature de la prestation`, raison: "absent" });
    if (!(l.quantite > 0)) manques.push({ champ: `lignes.${i}.quantite`, libelle: `${qui} : quantité`, raison: "format" });
    if (l.htCentimes + l.tvaCentimes !== l.ttcCentimes) manques.push({ champ: `lignes.${i}.montants`, libelle: `${qui} : HT plus TVA ne fait pas le TTC`, raison: "format" });
    if (Math.round(l.quantite * l.unitaireTTCCentimes) !== l.ttcCentimes) manques.push({ champ: `lignes.${i}.unitaire`, libelle: `${qui} : quantité fois prix ne fait pas le TTC`, raison: "format" });
  });

  if (manques.length) return { ok: false, manques };

  const ht = f.lignes.reduce((s, l) => s + l.htCentimes, 0);
  const ttc = f.lignes.reduce((s, l) => s + l.ttcCentimes, 0);
  const sap = f.numeroOrganisme!.trim();
  return {
    ok: true,
    valeur: {
      idTiersFacturation: f.idTiersFacturation!.trim(),
      idClient: f.idClient!.trim(),
      dateNaissanceClient: dateUrssaf(f.dateNaissanceClient!),
      numFactureTiers: f.numero!.trim(),
      dateFacture: dateUrssaf(f.dateFacture!),
      dateDebutEmploi: dateUrssaf(f.debutEmploi!),
      dateFinEmploi: dateUrssaf(f.finEmploi!),
      mntFactureTTC: euros(ttc),
      mntFactureHT: euros(ht),
      inputPrestations: f.lignes.map((l) => ({
        codeNature: l.codeNature!.trim(),
        ...(vide(l.codeActivite) ? {} : { codeActivite: l.codeActivite!.trim() }),
        quantite: l.quantite,
        unite: l.unite,
        mntUnitaireTTC: euros(l.unitaireTTCCentimes),
        mntPrestationTTC: euros(l.ttcCentimes),
        mntPrestationHT: euros(l.htCentimes),
        mntPrestationTVA: euros(l.tvaCentimes),
        ...(vide(l.complement1) ? {} : { complement1: l.complement1!.trim() }),
        complement2: sap,
      })),
    },
  };
}

// ─── Ce que l'Urssaf répond sur une demande ──────────────────────────────

export type EtapeDemande =
  | "integree"
  | "en-attente-du-client"
  | "validee"
  | "refusee"
  | "prelevee"
  | "impayee"
  | "versee"
  | "annulee"
  | "recouvree"
  | "inconnue";

/**
 * L'étape d'une demande, lue sur le LIBELLÉ que l'Urssaf renvoie.
 *
 * **Pourquoi le libellé et pas le code.** La description officielle donne la
 * forme du statut (un code, un libellé) mais pas la liste des codes. Les neuf
 * étapes viennent de l'aide d'Evoliz (« bien comprendre les statuts »). Une
 * étape qu'on ne reconnaît pas reste « inconnue » et l'écran montre le
 * libellé de l'Urssaf tel quel : jamais une étape devinée.
 */
export function etapeDeLaDemande(statut: { code?: string | null; libelle?: string | null } | null | undefined): EtapeDemande {
  const l = (statut?.libelle ?? "")
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .trim();
  if (!l) return "inconnue";
  if (l.includes("refus de prelevement")) return "impayee";
  if (l.includes("attente")) return "en-attente-du-client";
  if (l.startsWith("integr")) return "integree";
  if (l.startsWith("valid")) return "validee";
  if (l.startsWith("refus")) return "refusee";
  if (l.startsWith("prelev")) return "prelevee";
  if (l.startsWith("pay")) return "versee";
  if (l.startsWith("annul")) return "annulee";
  if (l.startsWith("recouvr")) return "recouvree";
  return "inconnue";
}
