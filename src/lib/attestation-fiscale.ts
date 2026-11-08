/**
 * L'ATTESTATION FISCALE DE SES CLIENTS : le crédit d'impôt, lot 2.
 *
 * Sa planche du 8 novembre 2026 (`appli/soignee/credit-d-impot.html`, écran
 * « L'attestation ») : en janvier, Terminés prépare l'attestation de l'année
 * de chaque client, et elles partent **une par une** (*« on va pas toutes les
 * envoyer d'un coup ; le mieux, c'est une par une »*).
 *
 * **Ce que la loi demande** (servicesalapersonne.gouv.fr, « Les obligations
 * réglementaires », lue le 8 novembre 2026) : avant le 31 mars de l'année
 * suivante, le nom et l'adresse de l'organisme, le numéro et la date de sa
 * déclaration, le nom et l'adresse du client, la nature des services, le
 * récapitulatif des interventions (nom et numéro de chaque intervenant, date
 * et durée), et le montant **effectivement acquitté**.
 *
 * **Une seule règle pour l'écran, la route et le papier** (`CLAUDE.md` §3) :
 * ce que la liste annonce, ce que la feuille montre et ce que le PDF imprime
 * sortent de ces fonctions-ci, et rien d'autre ne compte un montant.
 *
 * **Ce qui ne se devine pas, et qui reste donc écrit à l'écran comme manquant :**
 *
 * | | |
 * |---|---|
 * | une facture sans aucune heure enregistrée | ses interventions ne se recopient pas avec une durée inventée : l'attestation est « À compléter » |
 * | un intervenant sans nom écrit | « Salarié 3 » est un repli d'écran, pas un nom : « À compléter » |
 * | une adresse, un numéro, une date de déclaration absents | la loi les demande : « À compléter » |
 * | le Cesu préfinancé, l'APA, la PCH, l'avance immédiate | Atlas n'a pas de moyen de règlement qui les dise : rien n'est déduit, et `ARCHITECTURE.md` §571 le dit |
 */
import Decimal from "decimal.js";
import { estUnePersonne, avecCivilite, type CiviliteChoisie } from "./civilite";
import type { MoyenDePaiement } from "./acomptes-facture";
import { enEuros } from "./euros";
import { apresAvoirs, type FacturePourTva } from "./exigibilite-tva";
import { dureeLisible } from "./heures-d-intervention";
import { jourDeLettre, jourEtMois } from "./jour";
import { villeDeLAdresse } from "./mise-en-demeure";
import { libelleNumeroIntervenant, NUMERO_DU_PATRON, numeroSapValide, referenceDeLaDeclaration } from "./services-a-la-personne";

/**
 * La nature des services, telle que l'attestation l'écrit. Atlas sert des
 * jardiniers et des paysagistes : parmi les vingt-six activités, le petit
 * jardinage est la leur. Une entreprise qui déclarerait aussi autre chose
 * attendra un réglage (`TODO.md`).
 */
export const NATURE_DES_SERVICES = "petits travaux de jardinage";

// ─── Quand ───────────────────────────────────────────────────────────────────

/**
 * L'année dont les attestations se font, ou `null` hors de leur saison : du
 * 1er janvier au 31 mars inclus, celles de l'année d'avant. Le reste de
 * l'année, la ligne de Terminés n'existe pas (sa planche).
 */
export function anneeDesAttestations(aujourdHui: string): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(aujourdHui);
  if (!m) return null;
  const mois = Number(m[2]);
  return mois >= 1 && mois <= 3 ? Number(m[1]) - 1 : null;
}

// ─── Le montant ──────────────────────────────────────────────────────────────

export type ReglementAttestable = { date: string; montant: string; moyen: MoyenDePaiement | null };

/** Une facture ARRÊTÉE qui porte la case, avec ses avoirs et ses règlements. */
export type FactureAttestable = FacturePourTva & {
  id: string;
  numero: string;
  chantierId: string;
  reglements: readonly ReglementAttestable[];
};

function d(x: string): Decimal {
  const v = new Decimal(String(x ?? "0").replace(",", ".") || "0");
  return v.isFinite() ? v : new Decimal(0);
}

/**
 * Ce que le client a payé sur cette facture PENDANT l'année : ses règlements
 * datés de l'année, jamais plus que ce que la facture vaut une fois ses avoirs
 * retirés et ce qui était déjà réglé avant.
 *
 * **L'année du règlement, pas celle de la facture** : le crédit d'impôt d'une
 * année est celui des dépenses PAYÉES cette année-là. Une facture de décembre
 * réglée en janvier compte en janvier, et un acompte de décembre compte en
 * décembre, sur l'attestation de son année.
 *
 * **Le plafond de la facture** : un avoir fait après coup, ou un règlement
 * saisi deux fois, ne doit pas faire attester plus que ce que le client doit.
 * Atlas ne note pas les remboursements ; le plafond tient leur place, au plus
 * juste de ce qu'il sait.
 */
export function acquitteDansLAnnee(f: FactureAttestable, annee: number): string {
  const du = `${annee}-01-01`;
  const au = `${annee + 1}-01-01`;
  const net = Decimal.max(0, d(apresAvoirs(f).totalTtc));
  let avant = new Decimal(0);
  let pendant = new Decimal(0);
  for (const r of f.reglements) {
    const m = d(r.montant);
    if (!m.isPositive()) continue;
    if (r.date < du) avant = avant.plus(m);
    else if (r.date < au) pendant = pendant.plus(m);
  }
  const reste = Decimal.max(0, net.minus(avant));
  return Decimal.min(pendant, reste).toFixed(2);
}

// ─── Les interventions ───────────────────────────────────────────────────────

/** Une ligne de `heures_d_intervention` : le nom est celui écrit CE jour-là, ou `null`. */
export type HeureEnregistree = { chantierId: string; jour: string; minutes: number; numero: number; nom: string | null };

/** Une ligne du tableau : le nom est résolu, ou `null` s'il manque encore. */
export type InterventionAttestee = { jour: string; minutes: number; numero: number; nom: string | null };

/** Un moyen que la phrase sait écrire ; « autre » ne dit rien de ce qu'il était. */
export type MoyenConnu = Exclude<MoyenDePaiement, "autre">;

export type AttestationCalculee = {
  annee: number;
  /** Décimal, « 1008.00 ». */
  montant: string;
  /** Les moyens de l'année, dans l'ordre de la phrase ; `null` si l'un est inconnu. */
  moyens: MoyenConnu[] | null;
  interventions: InterventionAttestee[];
  /** Les numéros des factures comptées dont le chantier n'a aucune heure. */
  facturesSansHeures: string[];
};

const ORDRE_DES_MOYENS: readonly MoyenConnu[] = ["virement", "cheque", "carte", "especes"];

/**
 * L'attestation d'un client, pour une année : le montant, ses moyens, et ses
 * interventions, chacune sur sa ligne (date, durée, intervenant).
 *
 * **Les interventions sont celles des chantiers payés dans l'année**, à leurs
 * dates : un entretien de décembre réglé en janvier figure sur l'attestation
 * qui porte son paiement. Jamais de regroupement par mois : la page officielle
 * ne le permet que pour des prestations quotidiennes ou périodiques, et Atlas
 * ne sait pas le dire.
 *
 * **Le nom de chaque intervenant** est celui écrit le jour de l'intervention ;
 * à défaut, celui écrit aujourd'hui sous le même numéro (`nomsActuels`, un
 * numéro ne se redonne jamais) ; à défaut, `null`, et l'attestation reste à
 * compléter.
 */
export function calculerLAttestation(p: {
  annee: number;
  factures: readonly FactureAttestable[];
  heures: readonly HeureEnregistree[];
  nomsActuels: ReadonlyMap<number, string>;
}): AttestationCalculee {
  let montant = new Decimal(0);
  const moyens = new Set<MoyenConnu>();
  let inconnu = false;
  const comptees: FactureAttestable[] = [];
  const du = `${p.annee}-01-01`;
  const au = `${p.annee + 1}-01-01`;
  for (const f of p.factures) {
    const part = d(acquitteDansLAnnee(f, p.annee));
    if (!part.isPositive()) continue;
    comptees.push(f);
    montant = montant.plus(part);
    for (const r of f.reglements) {
      if (r.date < du || r.date >= au || !d(r.montant).isPositive()) continue;
      if (r.moyen && r.moyen !== "autre") moyens.add(r.moyen);
      else inconnu = true;
    }
  }
  const chantiers = new Set(comptees.map((f) => f.chantierId));
  const interventions = p.heures
    .filter((h) => chantiers.has(h.chantierId) && h.minutes > 0)
    .map((h) => ({ jour: h.jour, minutes: h.minutes, numero: h.numero, nom: h.nom?.trim() || p.nomsActuels.get(h.numero)?.trim() || null }))
    .sort((a, b) => (a.jour === b.jour ? a.numero - b.numero : a.jour < b.jour ? -1 : 1));
  const avecHeures = new Set(p.heures.filter((h) => h.minutes > 0).map((h) => h.chantierId));
  return {
    annee: p.annee,
    montant: montant.toFixed(2),
    moyens: inconnu ? null : ORDRE_DES_MOYENS.filter((m) => moyens.has(m)),
    interventions,
    facturesSansHeures: comptees.filter((f) => !avecHeures.has(f.chantierId)).map((f) => f.numero),
  };
}

// ─── Ce qui manque, et l'état ────────────────────────────────────────────────

/** L'organisme : ce que Mon entreprise porte, et le patron qui signe. */
export type Organisme = {
  nom: string;
  adresse: string | null;
  numero: string | null;
  declareeLe: string | null;
  /** Le patron (le premier compte propriétaire), son nom écrit, ou `null`. */
  signataire: { nom: string; civilite: "mr" | "mme" | null } | null;
};

export type ClientAttestation = { nom: string; civilite: CiviliteChoisie; adresse: string | null };

/**
 * Ce qui empêche l'attestation de partir, en phrases pour l'écran. Rien de
 * tout cela ne s'imprime : le papier part complet, ou ne part pas.
 */
export function ceQuiManqueALAttestation(o: Organisme, c: ClientAttestation, a: AttestationCalculee): string[] {
  const manques: string[] = [];
  if (!o.adresse?.trim()) manques.push("L'adresse de l'entreprise manque, dans Mon entreprise.");
  if (!numeroSapValide(o.numero)) manques.push("Le numéro de déclaration manque, dans Mon entreprise.");
  if (!o.declareeLe) manques.push("La date de la déclaration manque, dans Mon entreprise.");
  if (!c.adresse?.trim()) manques.push(`L'adresse de ${nomDuClient(c)} manque, sur sa fiche.`);
  for (const numero of [...new Set(a.interventions.filter((i) => i.nom === null).map((i) => i.numero))]) {
    manques.push(
      numero === NUMERO_DU_PATRON
        ? "Votre nom manque, dans Mon compte."
        : `Le nom de l'intervenant ${libelleNumeroIntervenant(numero)} manque, dans Équipe.`
    );
  }
  for (const numero of a.facturesSansHeures) manques.push(`Aucune heure enregistrée pour la facture ${numero}.`);
  return manques;
}

export type EtatAttestation = "a_envoyer" | "envoyee" | "a_renvoyer" | "a_completer";

export const LIBELLES_ETAT: Record<EtatAttestation, string> = {
  a_envoyer: "À envoyer",
  envoyee: "Envoyée",
  a_renvoyer: "À renvoyer",
  a_completer: "À compléter",
};

/**
 * Où en est l'attestation. **Envoyée** veut dire : partie, ET pareille à ce
 * qui est parti. Un règlement arrivé après, une adresse corrigée, et elle
 * redevient « À renvoyer » : le client tient un papier qui ne dit plus vrai.
 */
export function etatDeLAttestation(manques: readonly string[], empreinte: string, empreinteEnvoyee: string | null): EtatAttestation {
  if (empreinteEnvoyee !== null && empreinteEnvoyee === empreinte) return "envoyee";
  if (manques.length > 0) return "a_completer";
  return empreinteEnvoyee === null ? "a_envoyer" : "a_renvoyer";
}

/** Le texte de la ligne de Terminés, et son ton : ambre tant qu'il en reste, vert ensuite. */
export function phraseDeLaLigne(etats: readonly EtatAttestation[]): { texte: string; ton: "ambre" | "vert" } {
  const reste = etats.filter((e) => e !== "envoyee").length;
  return reste === 0 ? { texte: "Toutes envoyées", ton: "vert" } : { texte: `${reste} à envoyer, avant le 31 mars`, ton: "ambre" };
}

/** « 4 interventions, 1 008,00 € » : la ligne d'un client dans la liste. */
export function resumeDuClient(a: AttestationCalculee): string {
  const n = a.interventions.length;
  return `${n} intervention${n > 1 ? "s" : ""}, ${enEuros(a.montant)}`;
}

// ─── L'empreinte de ce qui part ──────────────────────────────────────────────

/**
 * Une empreinte courte de tout ce que le papier affirme, sa date de rédaction
 * mise à part : c'est elle qui dit si ce qui est parti est encore vrai.
 * FNV-1a sur 32 bits, en clair : pure, sans module de chiffrement, et une
 * collision ne ferait que manquer un « À renvoyer », jamais en inventer un.
 */
export function empreinteDeLAttestation(o: Organisme, c: ClientAttestation, a: AttestationCalculee): string {
  const texte = [
    o.nom,
    o.adresse ?? "",
    o.numero ?? "",
    o.declareeLe ?? "",
    o.signataire?.nom ?? "",
    nomDuClient(c),
    c.adresse ?? "",
    a.annee,
    a.montant,
    (a.moyens ?? ["?"]).join(","),
    ...a.interventions.map((i) => `${i.jour}:${i.minutes}:${i.numero}:${i.nom ?? ""}`),
  ].join("|");
  let h = 0x811c9dc5;
  for (const octet of new TextEncoder().encode(texte)) {
    h ^= octet;
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, "0");
}

// ─── Le papier ───────────────────────────────────────────────────────────────

export type ContenuAttestationFiscale = {
  /** Le nom de l'organisme, puis son adresse et sa déclaration. */
  entete: { nom: string; lignes: string[] };
  titre: string;
  phrase: string;
  lignes: { date: string; duree: string; nom: string; numero: string }[];
  total: { libelle: string; montant: string };
  lieuEtDate: string;
};

/**
 * Le client tel que le papier le nomme : sa civilité s'il l'a dite, son nom
 * seul sinon. Jamais le « Mr. » par défaut des devis : sur une attestation
 * fiscale, il ne se corrige plus (la règle de la mise en demeure).
 */
function nomDuClient(c: ClientAttestation): string {
  return estUnePersonne(c.civilite) ? avecCivilite(c.nom, c.civilite) : c.nom.trim();
}

const PAR_MOYEN: Record<MoyenConnu, string> = {
  virement: "par virement",
  cheque: "par chèque",
  carte: "par carte",
  especes: "en espèces",
};

function enListe(mots: readonly string[]): string {
  if (mots.length <= 1) return mots.join("");
  return `${mots.slice(0, -1).join(", ")} et ${mots[mots.length - 1]}`;
}

/**
 * La phrase du haut. **La qualité du signataire n'est écrite nulle part dans
 * Atlas** (gérant, président, entrepreneur) : la deviner d'après la forme
 * juridique mettrait un titre peut-être faux sur un papier fiscal. Elle dit
 * donc « pour <entreprise> » ; sans nom de patron, l'entreprise certifie seule.
 */
function phraseDeCertification(o: Organisme, c: ClientAttestation): string {
  const adresse = c.adresse?.trim();
  const client = adresse ? `${nomDuClient(c)}, ${adresse}` : nomDuClient(c);
  const fin = `certifie que ${client}, a bénéficié à son domicile de ${NATURE_DES_SERVICES}.`;
  if (!o.signataire?.nom.trim()) return `${o.nom} ${fin}`;
  const soussigne = o.signataire.civilite === "mme" ? "soussignée" : "soussigné";
  return `Je ${soussigne} ${o.signataire.nom.trim()}, pour ${o.nom}, ${fin}`;
}

/**
 * Tout le texte du papier, dans l'ordre de la planche : l'en-tête, le titre,
 * la phrase, le tableau, le montant, le lieu et la date. Le PDF et la feuille
 * de l'écran le lisent tous deux : ce qui se relit est ce qui part.
 *
 * Une date de l'année attestée s'écrit « 12 mars » ; une autre (un entretien
 * de décembre réglé en janvier) porte son année.
 */
export function contenuDeLAttestationFiscale(
  o: Organisme,
  c: ClientAttestation,
  a: AttestationCalculee,
  aujourdHui: string
): ContenuAttestationFiscale {
  // La même référence que la mention du devis et de la facture (lot 1).
  const declaration = numeroSapValide(o.numero) ? referenceDeLaDeclaration(o.numero, o.declareeLe) : null;
  const ville = villeDeLAdresse(o.adresse);
  const jour = jourDeLettre(aujourdHui);
  const moyens = a.moyens && a.moyens.length > 0 ? `, ${enListe(a.moyens.map((m) => PAR_MOYEN[m]))}` : "";
  return {
    entete: { nom: o.nom, lignes: [o.adresse?.trim() ?? "", declaration ?? ""].filter(Boolean) },
    titre: `Attestation fiscale ${a.annee}`,
    phrase: phraseDeCertification(o, c),
    lignes: a.interventions.map((i) => ({
      date: i.jour.startsWith(`${a.annee}-`) ? jourEtMois(i.jour) : jourDeLettre(i.jour),
      duree: dureeLisible(i.minutes),
      nom: i.nom ?? "",
      numero: libelleNumeroIntervenant(i.numero),
    })),
    total: { libelle: `Payé en ${a.annee}${moyens}`, montant: enEuros(a.montant) },
    lieuEtDate: ville ? `${ville}, le ${jour}` : `Le ${jour}`,
  };
}
