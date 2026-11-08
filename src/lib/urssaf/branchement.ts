import Decimal from "decimal.js";
import { avecCivilite, estUnePersonne, type CiviliteChoisie } from "../civilite";
import { dureeLisible } from "../heures-d-intervention";
import { enEuros } from "../euros";
import { jourDeLettre, jourEtMois } from "../jour";
import { pourcentValide, tauxDeLaLigne, totauxAvecReduction } from "../reduction-devis";
import { caseRetenue, creditDImpot, laCaseExiste, type SituationDeLaCase } from "../services-a-la-personne";
import {
  particulierPourUrssaf,
  type EtapeDemande,
  type LigneAtlas,
  type Manque,
  type ParticulierAtlas,
} from "./avance-immediate";

/**
 * LE BRANCHEMENT DE L'AVANCE IMMÉDIATE : ce que les écrans et le serveur
 * décident ensemble (lot 3, sa planche `appli/soignee/credit-d-impot.html`).
 *
 * `avance-immediate.ts` dit ce que l'Urssaf accepte ; ce fichier-ci dit ce
 * qu'Atlas en fait : quels codes se gardent, quand la rubrique paraît, ce que
 * la feuille d'inscription réclame, comment une facture devient une demande,
 * ce que le suivi écrit. **Chaque règle sert l'écran ET le serveur**
 * (`CLAUDE.md` §3) : ce que la feuille compte comme manquant est ce que le
 * serveur refuse, et l'addition de l'écran est celle de la feuille d'envoi.
 *
 * Aucune base, aucun réseau : tout s'éprouve dans `test-urssaf-branchement.ts`.
 */

// ─── Les codes de la liaison ─────────────────────────────────────────────────

/** Ce que l'Urssaf remet à l'artisan, et qu'il recopie dans Mon entreprise. */
export type CodesUrssaf = {
  clientId: string;
  clientSecret: string;
  /** « Identifiant SI Home+ » de l'entreprise, porté par chaque demande de paiement. */
  idTiersFacturation: string;
  /**
   * Le code « nature » de ses prestations. **La nomenclature n'est pas dans la
   * description officielle** (`ARCHITECTURE.md` §574) : il le recopie de ce que
   * l'Urssaf lui remet, et aucun défaut n'est posé. Un jardinage déclaré sous
   * une mauvaise nature priverait son client du crédit, sans que rien ne le dise.
   */
  codeNature: string;
};

/** Au-delà, ce n'est plus un code recopié : c'est un collage qui a débordé. */
const LONGUEUR_MAX_CODE = 500;

/**
 * Les quatre cases de « Relier l'Urssaf », relues. Rien n'est cru sur parole :
 * une action serveur se tape, et une case qui reçoit autre chose qu'un texte se
 * refuse. Les blancs du bout partent (un collage depuis un e-mail en porte),
 * ceux du milieu restent : un code ne se corrige pas à sa place.
 */
export function codesSaisisLus(
  saisie: Partial<Record<keyof CodesUrssaf, unknown>>
): { ok: true; codes: CodesUrssaf } | { ok: false; raison: string } {
  const lus: Partial<CodesUrssaf> = {};
  for (const cle of ["clientId", "clientSecret", "idTiersFacturation", "codeNature"] as const) {
    const v = saisie[cle];
    if (typeof v !== "string" || v.trim() === "") return { ok: false, raison: "Remplissez les quatre cases." };
    if (v.trim().length > LONGUEUR_MAX_CODE) return { ok: false, raison: "Un de ces codes est trop long. Recopiez-le à nouveau." };
    lus[cle] = v.trim();
  }
  return { ok: true, codes: lus as CodesUrssaf };
}

// ─── Les refus de l'Urssaf, dits en clair ────────────────────────────────────

/** La forme d'un refus de l'échange (`RefusUrssaf`), sans le reste du serveur. */
export type RefusALire =
  | { raison: "codes-refuses" }
  | { raison: "injoignable" }
  | { raison: "illisible" }
  | { raison: "refuse"; erreurs: { code?: string; message?: string; description?: string }[] };

/**
 * La phrase que l'écran montre. « Ces codes ne sont pas acceptés par
 * l'Urssaf. » est le refus de Relier tel que la planche le dit ; un refus
 * motivé rend le motif de l'Urssaf, qui seul sait pourquoi.
 */
export function phraseDuRefus(r: RefusALire): string {
  switch (r.raison) {
    case "codes-refuses":
      return "Ces codes ne sont pas acceptés par l'Urssaf.";
    case "injoignable":
      return "L'Urssaf ne répond pas. Réessayez dans un instant.";
    case "illisible":
      return "La réponse de l'Urssaf ne se lit pas. Réessayez plus tard.";
    case "refuse": {
      const e = r.erreurs.find((x) => (x.description ?? x.message ?? "").trim() !== "");
      const motif = (e?.description ?? e?.message ?? "").trim();
      if (!motif) return "L'Urssaf refuse, sans dire pourquoi.";
      const court = motif.length > 200 ? `${motif.slice(0, 199)}…` : motif;
      return `L'Urssaf refuse : ${court}`;
    }
  }
}

// ─── Quand la rubrique paraît ────────────────────────────────────────────────

/**
 * La rubrique « Avance immédiate » d'une fiche client : une entreprise
 * déclarée, reliée à l'Urssaf, et un client PARTICULIER. **La règle du lot 1
 * pour le particulier** (`laCaseExiste`), pas une seconde : une entreprise ou
 * une mairie n'a pas de crédit d'impôt, donc rien à avancer.
 */
export function rubriqueDuClient(s: SituationDeLaCase & { reliee: boolean }): boolean {
  return s.reliee && laCaseExiste(s);
}

/** Inscrit, ou en attente qu'il accepte chez l'Urssaf : les deux seuls états gardés. */
export type EtatInscription = "en-attente" | "inscrit";

/**
 * L'acompte d'un devis disparaît pour un client inscrit (sa planche, écran « Le
 * devis ») : **un acompte encaissé puis déclaré à l'Urssaf oblige à une
 * garantie financière dès le premier euro**, et l'Urssaf refuse une facture
 * déjà en partie réglée (`demandePaiementPourUrssaf`). La case qui compte est
 * celle du lot 1 (`caseRetenue`), jamais une seconde lecture. Un client en
 * attente compte déjà : son devis part avant qu'il accepte, sa facture après.
 */
export function sansAcompteAuDevis(
  s: SituationDeLaCase & { coche: boolean; reliee: boolean; inscription: EtatInscription | null }
): boolean {
  return s.reliee && s.inscription !== null && caseRetenue(s.coche, s);
}

/**
 * La facture part-elle à l'Urssaf ? La rubrique, un client INSCRIT (un client
 * en attente n'a pas encore accepté : l'Urssaf refuserait), et la case
 * retenue. Sinon, l'envoi ordinaire, et l'attestation de janvier.
 */
export function factureVersLUrssaf(
  s: SituationDeLaCase & { coche: boolean; reliee: boolean; inscription: EtatInscription | null }
): boolean {
  return rubriqueDuClient(s) && s.inscription === "inscrit" && caseRetenue(s.coche, s);
}

// ─── Ce que la fiche du client dit ───────────────────────────────────────────

/**
 * Le délai que l'Urssaf laisse au client pour accepter, d'après l'aide
 * d'Evoliz (« il a 7 jours »), pas d'après l'Urssaf, dont le site ne répond pas
 * d'ici. Il sert à DIRE le délai et à rouvrir l'inscription une fois passé ;
 * rien n'est effacé à son terme.
 */
export const JOURS_POUR_ACCEPTER = 7;

/** Les 48 heures du client pour valider ou contester une demande (`TODO.md`, fiche de l'Urssaf). */
export const JOURS_POUR_VALIDER = 2;

function jourPlus(jour: string, n: number): string {
  const [a, m, j] = jour.split("-").map(Number);
  return new Date(Date.UTC(a, m - 1, j + n)).toISOString().slice(0, 10);
}

export type CeQueLaFicheDit =
  | { etat: "pas-inscrit" }
  | { etat: "en-attente"; ecritLe: string; jusquAu: string; delaiPasse: boolean }
  | { etat: "inscrit"; depuis: string };

/** L'état de l'inscription tel que la rubrique le montre, au jour que le serveur compte. */
export function ceQueLaFicheDit(
  inscription: { etat: EtatInscription; demandeeLe: string; etatLe: string } | null,
  aujourdHui: string
): CeQueLaFicheDit {
  if (!inscription) return { etat: "pas-inscrit" };
  if (inscription.etat === "inscrit") return { etat: "inscrit", depuis: inscription.etatLe };
  const jusquAu = jourPlus(inscription.demandeeLe, JOURS_POUR_ACCEPTER);
  return { etat: "en-attente", ecritLe: inscription.demandeeLe, jusquAu, delaiPasse: aujourdHui > jusquAu };
}

/**
 * L'état du client relu chez l'Urssaf (`statutParticulier`).
 *
 * **La forme de la réponse n'est pas dans la description 1.29.1** : la route
 * est employée par deux intégrations publiques, sans schéma (`ARCHITECTURE.md`
 * §574). On lit donc le premier texte qu'elle porte (un statut, son libellé,
 * un état), et l'on ne conclut que sur des mots sans ambiguïté. Le reste est
 * « inconnu », et l'état gardé ne bouge pas : un client qu'on croirait
 * inscrit à tort verrait sa facture refusée par l'Urssaf, jamais payée deux
 * fois, mais on ne le devine pas pour autant.
 */
export function etatDuParticulier(reponse: unknown): EtatInscription | "inconnu" {
  const textes: string[] = [];
  const cueillir = (v: unknown, profondeur: number) => {
    if (typeof v === "string") textes.push(v);
    else if (Array.isArray(v) && profondeur < 2) v.forEach((x) => cueillir(x, profondeur + 1));
    else if (v && typeof v === "object" && profondeur < 2) {
      const o = v as Record<string, unknown>;
      for (const cle of ["statut", "libelle", "etat", "code", "statutParticulier", "statutCompte"]) {
        if (cle in o) cueillir(o[cle], profondeur + 1);
      }
    }
  };
  cueillir(reponse, 0);
  for (const brut of textes) {
    // « EN_ATTENTE_ACTIVATION » : un code écrit en majuscules soulignées se lit en mots.
    const t = brut.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().replace(/[_-]+/g, " ").trim();
    if (!t) continue;
    // Le négatif d'abord : « inactif » contient « actif ».
    if (/\b(inacti|non acti|non valid|attente|en cours)/.test(t)) return "en-attente";
    if (/\b(actif|active|activee?|validee?|inscrite?)\b/.test(t)) return "inscrit";
  }
  return "inconnu";
}

// ─── Le lieu de naissance ────────────────────────────────────────────────────

/**
 * Le département tel qu'il le tape : « 44 », « 044 », « 2A », « 971 ». Rendu
 * sur trois caractères, la forme que l'Urssaf attend (« 044 », « 02A »), ou
 * `null` quand ce n'est pas un département.
 */
export function departementSaisi(saisie: string): string | null {
  const s = saisie.trim().toUpperCase();
  if (/^(0[1-9]|[1-8]\d|9[0-5])$/.test(s)) return `0${s}`;
  if (/^0(0[1-9]|[1-8]\d|9[0-5])$/.test(s)) return s;
  if (/^0?2[AB]$/.test(s)) return s.length === 2 ? `0${s}` : s;
  if (/^97[1-6]$/.test(s)) return s;
  return null;
}

/**
 * Le département et la commune de naissance tirés du code INSEE d'une commune
 * (« 44109 » : « 044 » et « 109 »). Les trois derniers caractères pour la
 * commune, les deux premiers précédés d'un zéro pour le département ; outre-mer,
 * les trois premiers (« 97105 » : « 971 » et « 105 »). **Ce dernier découpage
 * est le seul que la description ne montre pas** : à confirmer sur le bac à
 * sable, où un mauvais découpage se lirait en refus, jamais en paiement.
 */
export function naissanceDuCodeInsee(code: string): { departement: string; codeCommune: string } | null {
  const c = code.trim().toUpperCase();
  if (/^97[1-6]\d{2}$/.test(c)) return { departement: c.slice(0, 3), codeCommune: c.slice(2) };
  if (/^(\d{2}|2[AB])\d{3}$/.test(c)) return { departement: `0${c.slice(0, 2)}`, codeCommune: c.slice(2) };
  return null;
}

/** Une commune rendue par le découpage administratif de l'État (geo.api.gouv.fr). */
export type CommuneTrouvee = { code: string; nom: string; departement: string };

/** Les communes d'une réponse, celles qui portent un code, un nom et un département. Ne jette jamais. */
export function communesDeLaReponse(reponse: unknown): CommuneTrouvee[] {
  if (!Array.isArray(reponse)) return [];
  const trouvees: CommuneTrouvee[] = [];
  for (const r of reponse) {
    const o = r as Record<string, unknown> | null;
    if (!o || typeof o.code !== "string" || typeof o.nom !== "string" || typeof o.codeDepartement !== "string") continue;
    trouvees.push({ code: o.code, nom: o.nom, departement: o.codeDepartement });
  }
  return trouvees;
}

function aplatir(s: string): string {
  return s.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

/**
 * LA commune qu'il a tapée, parmi celles que l'État connaît dans ce
 * département : le nom exact, accents, tirets et « Saint » ou « St » à part.
 * Deux candidates ou aucune : `null`, et la feuille le dit. Une commune
 * devinée ferait refuser l'inscription, ou inscrire le mauvais client.
 */
export function communeDeNaissance(trouvees: readonly CommuneTrouvee[], nom: string, departement: string): CommuneTrouvee | null {
  const voulu = aplatir(nom).replace(/^st /, "saint ").replace(/ st /g, " saint ");
  const dep = departement.replace(/^0(?=\d{2}$|2[AB]$)/, "");
  const justes = trouvees.filter((c) => c.departement.toUpperCase() === dep && aplatir(c.nom) === voulu);
  return justes.length === 1 ? justes[0] : null;
}

// ─── L'adresse du client, lue dans la Base Adresse Nationale ────────────────

/** En dessous, la base n'a pas reconnu l'adresse : elle en propose une autre, et l'on se tait. */
const SCORE_MIN_ADRESSE = 0.5;
const LIBELLE_VOIE_MAX = 28;

/** « 12 », « 12bis », « 12 B » : le numéro et son indice (B, T, Q, ou la lettre). */
function numeroEtIndice(brut: string): { numeroVoie: string; lettreVoie: string | null } | null {
  const m = /^(\d{1,20})\s*(bis|ter|quater|[a-z])?$/i.exec(brut.trim());
  if (!m) return null;
  const suffixe = m[2]?.toLowerCase();
  const lettre = !suffixe ? null : suffixe === "bis" ? "B" : suffixe === "ter" ? "T" : suffixe === "quater" ? "Q" : suffixe.toUpperCase();
  return { numeroVoie: m[1], lettreVoie: lettre };
}

/**
 * Le nom de la voie sur vingt-huit caractères, la place que l'Urssaf lui
 * donne : coupé au dernier mot entier. **C'est la seule retouche de
 * l'adresse**, et elle ne touche ni la commune ni le code postal, qui
 * désignent le client ; la voie ne sert qu'au courrier.
 */
function voieCourte(voie: string): string {
  const v = voie.trim();
  if (v.length <= LIBELLE_VOIE_MAX) return v;
  const coupe = v.slice(0, LIBELLE_VOIE_MAX + 1).lastIndexOf(" ");
  return v.slice(0, coupe > 0 ? coupe : LIBELLE_VOIE_MAX).trim();
}

/**
 * L'adresse postale de la fiche, découpée comme l'Urssaf l'attend, d'après la
 * première réponse de la Base Adresse Nationale : la commune par son code
 * INSEE, le code postal, la voie et son numéro. `null` quand la base ne la
 * reconnaît pas assez : l'inscription s'arrête alors, et la feuille envoie
 * corriger l'adresse de la fiche. **Jamais une commune devinée.**
 */
export function adressePostaleDeLaBan(reponse: unknown): NonNullable<ParticulierAtlas["adresse"]> | null {
  const features = (reponse as { features?: unknown } | null)?.features;
  if (!Array.isArray(features) || features.length === 0) return null;
  const p = (features[0] as { properties?: Record<string, unknown> } | null)?.properties;
  if (!p) return null;
  const texte = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);
  const score = typeof p.score === "number" ? p.score : 0;
  const codeCommune = texte(p.citycode);
  const codePostal = texte(p.postcode);
  const libelleCommune = texte(p.city);
  if (score < SCORE_MIN_ADRESSE || !codeCommune || !codePostal || !libelleCommune) return null;
  const type = texte(p.type);
  const adresse: NonNullable<ParticulierAtlas["adresse"]> = { codeCommune, codePostal, libelleCommune };
  if (type === "housenumber" || type === "street") {
    const voie = texte(p.street) ?? (type === "street" ? texte(p.name) : null);
    if (voie) adresse.libelleVoie = voieCourte(voie);
    const numero = texte(p.housenumber);
    const lu = numero ? numeroEtIndice(numero) : null;
    if (lu) {
      adresse.numeroVoie = lu.numeroVoie;
      if (lu.lettreVoie) adresse.lettreVoie = lu.lettreVoie;
    }
  } else if (type === "locality") {
    const lieu = texte(p.name);
    if (lieu) adresse.lieuDit = lieu.slice(0, 38);
  }
  return adresse;
}

// ─── La feuille « L'inscrire à l'Urssaf » ────────────────────────────────────

/**
 * Ce que la feuille porte. Atlas y recopie ce qu'il sait déjà (le nom, la
 * civilité, le portable, l'e-mail) ; le reste se tape. **L'adresse n'y est
 * pas** : c'est celle de la fiche, lue dans la Base Adresse Nationale au
 * moment d'inscrire.
 */
export type SaisieInscription = {
  civilite: "M" | "Mme" | null;
  nomNaissance: string;
  prenoms: string;
  /** `AAAA-MM-JJ`, la valeur d'un champ de date. */
  dateNaissance: string;
  neEnFrance: boolean;
  departementNaissance: string;
  communeNaissance: string;
  /** Le code INSEE de son pays, cinq chiffres, quand il est né ailleurs. */
  paysNaissance: string;
  portable: string;
  email: string;
  iban: string;
  bic: string;
  titulaire: string;
};

/** Ce que le serveur résout avant d'envoyer : la commune de naissance par son code, l'adresse par la BAN. */
export type ResolutionInscription = {
  communeNaissance: { departement: string; codeCommune: string; libelle: string } | null;
  adresse: ParticulierAtlas["adresse"];
};

/** Ce qu'Atlas sait du client, pour préremplir la feuille. */
export type ClientAPreremplir = {
  nom: string;
  civilite: CiviliteChoisie;
  telephone: string | null;
  email: string | null;
};

/**
 * La feuille préremplie. Le portable n'est repris que s'il en est un (un fixe
 * ferait refuser l'inscription), et le titulaire est son nom : l'IBAN est le
 * sien dans le cas courant, et la case se corrige.
 */
export function feuillePreremplie(c: ClientAPreremplir): SaisieInscription {
  const portable = (c.telephone ?? "").replace(/[\s.]/g, "");
  return {
    civilite: c.civilite === "mme" ? "Mme" : c.civilite === "mr" ? "M" : null,
    nomNaissance: c.nom.trim(),
    prenoms: "",
    dateNaissance: "",
    neEnFrance: true,
    departementNaissance: "",
    communeNaissance: "",
    paysNaissance: "",
    portable: /^(0|\+33)[67]\d{8}$/.test(portable) ? (c.telephone ?? "").trim() : "",
    email: (c.email ?? "").trim(),
    iban: "",
    bic: "",
    titulaire: avecCivilite(c.nom, estUnePersonne(c.civilite) ? c.civilite : null).trim(),
  };
}

/**
 * Ce que l'action reçoit, relu champ par champ : une action serveur se tape, et
 * ce qui n'a pas la forme de la feuille se refuse au lieu d'être deviné.
 */
export function saisieInscriptionLue(brut: unknown): SaisieInscription | null {
  if (!brut || typeof brut !== "object") return null;
  const o = brut as Record<string, unknown>;
  const textes = [
    "nomNaissance", "prenoms", "dateNaissance", "departementNaissance", "communeNaissance",
    "paysNaissance", "portable", "email", "iban", "bic", "titulaire",
  ] as const;
  for (const cle of textes) if (typeof o[cle] !== "string" || (o[cle] as string).length > 200) return null;
  if (o.civilite !== null && o.civilite !== "M" && o.civilite !== "Mme") return null;
  if (typeof o.neEnFrance !== "boolean") return null;
  const lue = { civilite: o.civilite, neEnFrance: o.neEnFrance } as Pick<SaisieInscription, "civilite" | "neEnFrance">;
  return { ...lue, ...Object.fromEntries(textes.map((c) => [c, o[c] as string])) } as SaisieInscription;
}

/** Les champs que seul le serveur sait remplir : la feuille ne les compte pas. */
const RESOLUS_PAR_LE_SERVEUR = new Set(["adresse", "codePostal", "codeCommune", "libelleCommune", "numeroVoie", "lettreVoie", "libelleVoie", "complement", "lieuDit"]);

/**
 * Le particulier qu'Atlas enverra, bâti de la feuille et de ce que le serveur a
 * résolu. Sans résolution (l'écran), la commune tapée tient lieu de son code :
 * c'est le serveur qui la cherchera.
 */
export function particulierDeLaSaisie(s: SaisieInscription, r: ResolutionInscription | null): ParticulierAtlas {
  const departement = departementSaisi(s.departementNaissance) ?? (s.departementNaissance.trim() || null);
  const naissance: ParticulierAtlas["naissance"] = s.neEnFrance
    ? r
      ? { enFrance: true, departement: r.communeNaissance?.departement ?? departement, codeCommune: r.communeNaissance?.codeCommune ?? null, libelleCommune: r.communeNaissance?.libelle ?? null }
      : // L'écran n'a que le nom : « 000 » dit seulement qu'une commune est tapée.
        { enFrance: true, departement, codeCommune: s.communeNaissance.trim() ? "000" : null }
    : { enFrance: false, codePays: s.paysNaissance.trim() || null };
  return {
    civilite: s.civilite,
    nomNaissance: s.nomNaissance,
    prenoms: s.prenoms,
    dateNaissance: s.dateNaissance.trim() || null,
    naissance,
    portable: s.portable,
    email: s.email,
    adresse: r ? r.adresse : null,
    banque: { iban: s.iban, bic: s.bic, titulaire: s.titulaire },
  };
}

/**
 * Ce qui manque à la feuille, par la règle même de l'envoi
 * (`particulierPourUrssaf`), moins ce que seul le serveur résout. « Il manque
 * 3 cases » se compte ici, et le serveur refuse les mêmes.
 */
export function manquesDeLaFeuille(s: SaisieInscription): Manque[] {
  const v = particulierPourUrssaf(particulierDeLaSaisie(s, null));
  if (v.ok) return [];
  return v.manques.filter((m) => !RESOLUS_PAR_LE_SERVEUR.has(m.champ));
}

/** « Il manque 3 cases », « Il manque 1 case ». Rien quand rien ne manque. */
export function phraseDesCasesQuiManquent(n: number): string | null {
  if (n <= 0) return null;
  return `Il manque ${n} case${n > 1 ? "s" : ""}`;
}

/** Une date de naissance plausible : passée, et lisible. Le reste, l'Urssaf le vérifie. */
export function refusDeLaDateDeNaissance(jour: string, aujourdHui: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(jour)) return null;
  if (jour >= aujourdHui) return "Une date de naissance est dans le passé.";
  if (jour < "1900-01-01") return "Cette date de naissance ne se lit pas.";
  return null;
}

// ─── La facture, devenue une demande ─────────────────────────────────────────

/** Une ligne de facture telle que la base la porte. */
export type LigneDeFacture = {
  montant: string;
  quantite: string;
  prixUnitaire: string;
  unite: string | null;
  tauxTva: string | null;
  supplement: boolean;
};

const UNITES_HEURE = new Set(["h", "heure", "heures", "hr", "hrs"]);

function centimes(montant: string | Decimal): number {
  return new Decimal(montant).times(100).toDecimalPlaces(0, Decimal.ROUND_HALF_UP).toNumber();
}

/**
 * Les prestations d'une facture, telles que l'Urssaf les lira.
 *
 * **Les totaux sont ceux de la facture, par la même fonction** (`totauxAvecReduction`) :
 * la demande doit valoir au centime près ce que le client lit, sinon l'Urssaf
 * verse un autre montant que celui de la pièce.
 *
 * **Une ligne par ligne de la facture, quand rien ne s'interpose** : la TVA de
 * chaque taux se répartit sur ses lignes au prorata de leur HT, le centime
 * résiduel sur la plus grosse (la règle de la remise). **Une ligne d'heures
 * garde sa quantité et l'unité HEURE quand le compte tombe juste au centime** ;
 * toute autre ligne part en FORFAIT de quantité 1, à son montant : l'Urssaf ne
 * connaît que les heures et les forfaits, et « 40 forfaits » pour quarante
 * mètres de haie se lirait faux chez le client.
 *
 * **Avec une remise sur la facture, ou une ligne négative, une ligne par taux**
 * en FORFAIT : la remise n'appartient à aucune ligne, et la recomposer ligne à
 * ligne inventerait des montants que la facture n'écrit pas.
 *
 * `complement1` (la date et la durée) se pose sur la première ligne seulement :
 * il dit l'intervention, pas chaque travail.
 */
export function lignesPourLUrssaf(p: {
  lignes: readonly LigneDeFacture[];
  tauxTva: string;
  reductionPourcent: string | null;
  codeNature: string | null;
  complement1: string | null;
}): LigneAtlas[] {
  const utiles = p.lignes.filter((l) => !new Decimal(l.montant).isZero());
  const totaux = totauxAvecReduction(utiles, p.tauxTva, p.reductionPourcent);
  const parCategorie = pourcentValide(p.reductionPourcent) !== null || utiles.some((l) => new Decimal(l.montant).isNegative());
  const forfait = (htC: number, tvaC: number): LigneAtlas => ({
    codeNature: p.codeNature,
    quantite: 1,
    unite: "FORFAIT",
    unitaireTTCCentimes: htC + tvaC,
    htCentimes: htC,
    tvaCentimes: tvaC,
    ttcCentimes: htC + tvaC,
  });

  let sortie: LigneAtlas[];
  if (parCategorie) {
    sortie = totaux.parTaux
      .filter((c) => !new Decimal(c.baseHt).isZero())
      .map((c) => forfait(centimes(c.baseHt), centimes(c.tva)));
  } else {
    sortie = [];
    for (const cat of totaux.parTaux) {
      const siennes = utiles.filter((l) => tauxDeLaLigne(l, p.tauxTva) === cat.taux);
      if (!siennes.length) continue;
      const tvaCat = centimes(cat.tva);
      const htCat = siennes.reduce((s, l) => s + centimes(l.montant), 0);
      let plusGrosse = 0;
      siennes.forEach((l, i) => {
        if (centimes(l.montant) > centimes(siennes[plusGrosse].montant)) plusGrosse = i;
      });
      const tvas = siennes.map((l) => (htCat === 0 ? 0 : Math.floor((centimes(l.montant) * tvaCat) / htCat)));
      tvas[plusGrosse] += tvaCat - tvas.reduce((s, t) => s + t, 0);
      siennes.forEach((l, i) => {
        const htC = centimes(l.montant);
        const ttcC = htC + tvas[i];
        const q = new Decimal(l.quantite);
        const enHeures = UNITES_HEURE.has((l.unite ?? "").trim().toLowerCase()) && q.isPositive();
        const unitaireC = centimes(new Decimal(l.prixUnitaire).times(new Decimal(cat.taux).dividedBy(100).plus(1)));
        if (enHeures && Math.round(q.toNumber() * unitaireC) === ttcC) {
          sortie.push({
            codeNature: p.codeNature,
            quantite: q.toNumber(),
            unite: "HEURE",
            unitaireTTCCentimes: unitaireC,
            htCentimes: htC,
            tvaCentimes: tvas[i],
            ttcCentimes: ttcC,
          });
        } else {
          sortie.push(forfait(htC, tvas[i]));
        }
      });
    }
  }
  if (sortie.length && p.complement1) sortie[0] = { ...sortie[0], complement1: p.complement1 };
  return sortie;
}

/**
 * La période d'emploi : les jours d'intervention du retour du jour (lot 2),
 * sinon la date des travaux de la facture. **Jamais devinée** : sans l'une ni
 * l'autre, elle manque, et la demande ne part pas.
 */
export function periodeDeLaFacture(jours: readonly string[], dateTravaux: string | null): { debut: string | null; fin: string | null } {
  const tries = [...jours].filter((j) => /^\d{4}-\d{2}-\d{2}$/.test(j)).sort();
  if (tries.length) return { debut: tries[0], fin: tries[tries.length - 1] };
  return { debut: dateTravaux, fin: dateTravaux };
}

/**
 * « Le 5 novembre 2026, 5 h 30 », ou « 3 passages du 5 au 26 novembre 2026,
 * 12 h 30 en tout » : la date et la durée que le client lira chez l'Urssaf,
 * tous intervenants comptés. `null` sans heures : rien ne s'invente.
 */
export function complementDesHeures(heures: readonly { jour: string; minutes: number }[]): string | null {
  const parJour = new Map<string, number>();
  for (const h of heures) if (h.minutes > 0) parJour.set(h.jour, (parJour.get(h.jour) ?? 0) + h.minutes);
  if (!parJour.size) return null;
  const jours = [...parJour.keys()].sort();
  const total = [...parJour.values()].reduce((s, m) => s + m, 0);
  if (jours.length === 1) return `Le ${jourDeLettre(jours[0])}, ${dureeLisible(total)}`;
  return `${jours.length} passages du ${jourEtMois(jours[0])} au ${jourDeLettre(jours[jours.length - 1])}, ${dureeLisible(total)} en tout`;
}

// ─── L'addition de la planche ────────────────────────────────────────────────

/**
 * « Payé par Mr. Lambert, son crédit d'impôt, L'Urssaf vous verse » : l'Urssaf
 * verse TOUTE la facture (sa remarque du 8 novembre 2026, « il n'y a pas un
 * problème dans le calcul ? »). Le crédit est celui du lot 1, arrondi au
 * centime inférieur (`creditDImpot`) ; ce que le client paie est le reste.
 */
export function additionDeLAvanceImmediate(totalTtc: string): { payeParLeClient: string; creditDImpot: string; verse: string } {
  const total = new Decimal(totalTtc);
  const credit = creditDImpot(totalTtc);
  return { payeParLeClient: total.minus(credit).toFixed(2), creditDImpot: credit, verse: total.toFixed(2) };
}

// ─── Le suivi de la demande ──────────────────────────────────────────────────

/** Les étapes après lesquelles rien ne change plus : on cesse de demander. */
export const ETAPES_FINALES = ["versee", "refusee", "annulee", "recouvree"] as const satisfies readonly EtapeDemande[];

/** Une demande se relit au plus une fois par ces minutes : l'Urssaf limite les appels, et l'écran attend. */
export const MINUTES_ENTRE_DEUX_RELEVES = 5;

export function aRelire(lueLe: Date | null, maintenant: Date): boolean {
  return !lueLe || maintenant.getTime() - lueLe.getTime() >= MINUTES_ENTRE_DEUX_RELEVES * 60_000;
}

/** Une étape franchit-elle la validation du client ? Il faut alors en garder la date. */
export function etapeValidee(e: EtapeDemande): boolean {
  return e === "validee" || e === "prelevee" || e === "versee" || e === "impayee";
}

/**
 * Le jour du versement : celui que l'Urssaf écrit, sinon le jour de la relève.
 * Jamais avant la facture : un règlement daté d'avant son émission serait
 * refusé, et le refus parlerait d'une date qu'il n'a jamais vue.
 */
export function jourDuVersement(dateVirement: string | null | undefined, aujourdHui: string, dateEmission: string): string {
  const lu = typeof dateVirement === "string" && /^\d{4}-\d{2}-\d{2}/.test(dateVirement) ? dateVirement.slice(0, 10) : aujourdHui;
  return lu < dateEmission ? dateEmission : lu;
}

export type PasDuSuivi = {
  ton: "vert" | "ambre" | "rouge" | "gris";
  icone: "coche" | "horloge-sable" | "euro" | "croix";
  titre: string;
  sous: string | null;
};

/**
 * Les pas du suivi, tels que la planche les dessine : envoyée, validée par le
 * client, versée ; ou refusée. Une étape que l'Urssaf nomme autrement que les
 * neuf connues se montre sous SON libellé, sans rien en conclure.
 */
export function suiviDeLaDemande(p: {
  etape: EtapeDemande;
  libelleUrssaf: string | null;
  envoyeeLe: string;
  valideeLe: string | null;
  etapeLe: string;
  versement: { montant: string; le: string } | null;
  totalTtc: string;
  clientNom: string | null;
  clientCivilite: CiviliteChoisie;
}): PasDuSuivi[] {
  const qui = avecCivilite(p.clientNom, p.clientCivilite) || "Votre client";
  const envoyee: PasDuSuivi = { ton: "vert", icone: "coche", titre: "Envoyée à l'Urssaf", sous: `Le ${jourEtMois(p.envoyeeLe)}` };
  const validee: PasDuSuivi = { ton: "vert", icone: "coche", titre: `Validée par ${qui}`, sous: p.valideeLe ? `Le ${jourEtMois(p.valideeLe)}` : null };
  const aVerser: PasDuSuivi = { ton: "gris", icone: "euro", titre: `L'Urssaf vous verse ${enEuros(p.totalTtc)}`, sous: null };
  switch (p.etape) {
    case "integree":
    case "en-attente-du-client":
      return [
        envoyee,
        { ton: "ambre", icone: "horloge-sable", titre: `${qui} la valide`, sous: `Il a jusqu'au ${jourEtMois(jourPlus(p.envoyeeLe, JOURS_POUR_VALIDER))}` },
        aVerser,
      ];
    case "validee":
    case "prelevee":
      return [envoyee, validee, aVerser];
    case "versee": {
      const montant = p.versement?.montant ?? p.totalTtc;
      const le = p.versement?.le ?? p.etapeLe;
      return [envoyee, validee, { ton: "vert", icone: "coche", titre: `Versée, ${enEuros(montant)}`, sous: `Le ${jourEtMois(le)}, sur votre compte` }];
    }
    case "refusee":
      return [envoyee, { ton: "rouge", icone: "croix", titre: `Refusée par ${qui}`, sous: `Le ${jourEtMois(p.etapeLe)}` }];
    case "impayee":
      return [envoyee, validee, { ton: "rouge", icone: "croix", titre: `Le prélèvement de ${qui} a échoué`, sous: `Le ${jourEtMois(p.etapeLe)}` }];
    case "annulee":
      return [envoyee, { ton: "rouge", icone: "croix", titre: "Annulée", sous: `Le ${jourEtMois(p.etapeLe)}` }];
    case "recouvree":
      return [envoyee, validee, { ton: "rouge", icone: "croix", titre: "Reprise par l'Urssaf", sous: `Le ${jourEtMois(p.etapeLe)}` }];
    case "inconnue":
      return [envoyee, { ton: "gris", icone: "horloge-sable", titre: p.libelleUrssaf?.trim() || "En cours à l'Urssaf", sous: null }];
  }
}

/**
 * La pastille de la facture partie à l'Urssaf, comme la planche : « Chez
 * l'Urssaf », « Acquittée le 14 novembre », « Refusée par Mr. Lambert ». Elle
 * prend la place de « Pas encore envoyée », qui serait faux : la facture est
 * partie, par l'Urssaf.
 */
export function pastilleDeLaDemande(
  d: { etape: EtapeDemande; etapeLe: string; versement: { le: string } | null },
  clientNom: string | null,
  clientCivilite: CiviliteChoisie
): { ton: "ambre" | "rouge" | "vert"; texte: string } {
  if (d.etape === "versee") return { ton: "vert", texte: `Acquittée le ${jourEtMois(d.versement?.le ?? d.etapeLe)}` };
  if (d.etape === "refusee") return { ton: "rouge", texte: `Refusée par ${avecCivilite(clientNom, clientCivilite) || "votre client"}` };
  if (d.etape === "impayee" || d.etape === "annulee" || d.etape === "recouvree") return { ton: "rouge", texte: "Pas payée par l'Urssaf" };
  return { ton: "ambre", texte: "Chez l'Urssaf" };
}

/** La facture retourne-t-elle à l'envoi ordinaire ? Refusée par le client, ou annulée : elle part par SMS, comme aujourd'hui. */
export function envoiOrdinaireApres(etape: EtapeDemande): boolean {
  return etape === "refusee" || etape === "annulee";
}
