import { formeADuCapital } from "./formes-juridiques";
import type { NatureAchat } from "./achat-tva";
import type { Categorie, Justification, Motif } from "./pour-mon-comptable";

/**
 * LES CATÉGORIES DU COMPTABLE, ET LEUR NUMÉRO DE COMPTE.
 *
 * Ses choix du 24 novembre 2026 (`appli/soignee/comptable-trois-fichiers.html`,
 * `TODO.md`) : chaque ligne de banque se range dans une catégorie, chaque
 * catégorie porte un numéro de compte proposé par Cause et modifiable dans
 * Réglages, et ce numéro est le même dans le PDF, l'Excel et le FEC. Deux
 * catégories de cotisations (sa réponse du même soir) : celles des salariés
 * (431) et les siennes (646).
 *
 * **Une seule liste pour tout** : le PDF, l'Excel, le FEC, l'écran des
 * Réglages et le choix d'une ligne la lisent ici. Deux listes finiraient par
 * diverger, et le comptable lirait deux numéros pour la même chose.
 *
 * **Les numéros, et leurs sources** : `docs/dossier-comptable-trois-fichiers.md`
 * (plan comptable 2025 de l'ANC, BOFiP). Ceux que les sources ne tranchent pas
 * se règlent : c'est son comptable qui décide, dans Réglages.
 *
 * **Ce qui ne se devine pas reste « À classer » (471)** : un virement à un
 * fournisseur ne dit pas s'il paie du gravier ou une location
 * (`docs/AGENT.md` §3). Le patron choisit, ou son comptable range.
 */

export const FAMILLES = ["chantier", "route", "bureau", "personnel", "etat", "argent", "entrees", "tiers", "tva"] as const;
export type Famille = (typeof FAMILLES)[number];

export const NOM_FAMILLE: Record<Famille, string> = {
  chantier: "Le chantier",
  route: "Le camion, la route",
  bureau: "L'entreprise",
  personnel: "Vos salariés",
  etat: "Les impôts",
  argent: "Prêt, argent perso, à classer",
  entrees: "Vos autres entrées",
  tiers: "Ventes, clients, fournisseurs, banque",
  tva: "La TVA",
};

/** La situation de l'entreprise qui change un numéro : lue dans Mon entreprise, jamais devinée. */
export type Situation = { societe: boolean };

export function situationDe(entreprise: { formeJuridique: string | null }): Situation {
  return { societe: formeADuCapital(entreprise.formeJuridique) };
}

type Definition = {
  nom: string;
  famille: Famille;
  propose: string | ((s: Situation) => string);
  /** Le compte de la TVA déduite sur cette dépense, s'il y en a une. */
  tva: "deductible" | "immobilisation" | null;
  /** La couleur du point, prise parmi celles du relevé (`couleurs-comptable.ts`). */
  couleur: Categorie;
  /** Une phrase, sous le numéro, dans la feuille du réglage. */
  pourquoi: string | ((s: Situation) => string);
};

const exploitantOuAssocie = (s: Situation) => (s.societe ? "4551" : "108");

/** L'ordre de cette liste est celui du PDF, de l'Excel et du réglage. */
export const CATEGORIES_COMPTABLES = {
  materiaux: { nom: "Matériaux et plants", famille: "chantier", propose: "601", tva: "deductible", couleur: "materiel", pourquoi: "Ce qui entre dans le chantier du client : terre, gravier, bordures, plants. Certains comptables prennent le 605, achats incorporés aux ouvrages." },
  outillage: { nom: "Petit outillage, petites fournitures", famille: "chantier", propose: "6063", tva: "deductible", couleur: "materiel", pourquoi: "Un outil de moins de 500 € hors taxe, les petites fournitures du chantier : petit équipement." },
  vetements: { nom: "Vêtements de travail, protection", famille: "chantier", propose: "6063", tva: "deductible", couleur: "materiel", pourquoi: "Gants, chaussures de sécurité, casque, pantalon anti coupure : petit équipement." },
  soustraitance: { nom: "Sous-traitance", famille: "chantier", propose: "604", tva: "deductible", couleur: "virement", pourquoi: "Un autre artisan fait une partie du chantier de votre client : sa prestation entre dans l'ouvrage. Le 611 sert à ce qui n'y entre pas." },
  location: { nom: "Location de matériel", famille: "chantier", propose: "6135", tva: "deductible", couleur: "materiel", pourquoi: "Une mini pelle, une nacelle, une benne louées pour un chantier : locations mobilières." },
  dechets: { nom: "Évacuation des déchets verts", famille: "chantier", propose: "6288", tva: "deductible", couleur: "autre", pourquoi: "La déchetterie ou la plateforme de compostage. Le 6288 est d'usage, il n'est pas dans le plan comptable : votre comptable a peut-être le sien." },
  investissement: { nom: "Matériel de plus de 500 €", famille: "chantier", propose: "2154", tva: "immobilisation", couleur: "materiel", pourquoi: "Au dessus de 500 € hors taxe, le matériel s'amortit. Une remorque ou un camion va au 2182, quel que soit son prix." },
  carburant: { nom: "Carburant", famille: "route", propose: "6061", tva: "deductible", couleur: "carburant", pourquoi: "Le carburant mis dans le réservoir ne se stocke pas : fournitures non stockables. Le 60622 de certains logiciels n'existe pas dans le plan comptable." },
  repas: { nom: "Repas", famille: "route", propose: "6256", tva: "deductible", couleur: "repas", pourquoi: "Le repas pris sur un chantier, loin du dépôt. Un repas avec un client va au 6257, réceptions." },
  hotel: { nom: "Hôtel", famille: "route", propose: "6256", tva: "deductible", couleur: "hotel", pourquoi: "Une nuit loin de chez vous pour un chantier, comme le repas : missions. Sa TVA ne se déduit pas." },
  transport: { nom: "Train, taxi, péage, parking", famille: "route", propose: "6251", tva: "deductible", couleur: "transport", pourquoi: "Vos déplacements autrement qu'en camion : voyages et déplacements." },
  entretien: { nom: "Entretien et réparations", famille: "route", propose: "6155", tva: "deductible", couleur: "carburant", pourquoi: "Le garage, les pneus, la révision du camion, la réparation de la tondeuse." },
  leasing: { nom: "Leasing du camion", famille: "route", propose: "6122", tva: "deductible", couleur: "carburant", pourquoi: "Crédit bail ou location avec option d'achat. Une location longue durée sans achat va au 6135." },
  loyer: { nom: "Loyer", famille: "bureau", propose: "6132", tva: "deductible", couleur: "virement", pourquoi: "Le loyer de votre dépôt ou de votre bureau." },
  assurances: { nom: "Assurances", famille: "bureau", propose: "616", tva: null, couleur: "virement", pourquoi: "Décennale, responsabilité civile, multirisque, flotte." },
  telephone: { nom: "Téléphone, internet, timbres", famille: "bureau", propose: "626", tva: "deductible", couleur: "autre", pourquoi: "Le forfait du téléphone, la box du bureau, les timbres." },
  energie: { nom: "Électricité, eau, gaz", famille: "bureau", propose: "6061", tva: "deductible", couleur: "autre", pourquoi: "Les compteurs du dépôt : fournitures non stockables, comme le carburant." },
  fournituresBureau: { nom: "Fournitures de bureau", famille: "bureau", propose: "6064", tva: "deductible", couleur: "autre", pourquoi: "Papier, encre, classeurs : fournitures administratives." },
  logiciels: { nom: "Logiciels et abonnements", famille: "bureau", propose: "6135", tva: "deductible", couleur: "autre", pourquoi: "Cause, votre logiciel, votre site : un abonnement se range en location. Les sources hésitent entre 613 et 6135, votre comptable tranche." },
  publicite: { nom: "Publicité", famille: "bureau", propose: "623", tva: "deductible", couleur: "autre", pourquoi: "Le flocage du camion, les cartes de visite, une annonce." },
  honoraires: { nom: "Honoraires", famille: "bureau", propose: "6226", tva: "deductible", couleur: "virement", pourquoi: "Votre comptable, votre avocat." },
  cotisationsPro: { nom: "Cotisations professionnelles", famille: "bureau", propose: "6281", tva: "deductible", couleur: "virement", pourquoi: "La chambre des métiers, votre syndicat professionnel." },
  formation: { nom: "Formation", famille: "bureau", propose: "6228", tva: "deductible", couleur: "autre", pourquoi: "Un CACES, un Certiphyto payés à l'organisme. La contribution obligatoire à l'OPCO va au 6333." },
  frais: { nom: "Frais de banque", famille: "bureau", propose: "627", tva: null, couleur: "autre", pourquoi: "Tenue de compte, carte, commissions : le relevé de banque en est la pièce. Les agios d'un découvert vont au 6615." },
  salaires: { nom: "Salaires", famille: "personnel", propose: "421", tva: null, couleur: "virement", pourquoi: "Le virement paie un salaire que votre cabinet a déjà passé au 641 depuis la fiche de paie. Le 421 évite de le compter deux fois." },
  cotisationsSalaries: { nom: "Cotisations des salariés", famille: "personnel", propose: "431", tva: null, couleur: "virement", pourquoi: "L'URSSAF de vos salariés, ou la MSA pour le paysage, que votre cabinet a calculée avec la paie." },
  cotisationsPatron: { nom: "Vos cotisations à vous", famille: "personnel", propose: "646", tva: null, couleur: "virement", pourquoi: "Vos propres cotisations sociales de chef d'entreprise." },
  organismes: { nom: "Retraite, prévoyance, mutuelle des salariés", famille: "personnel", propose: "437", tva: null, couleur: "virement", pourquoi: "La caisse de retraite complémentaire, la prévoyance, la mutuelle de vos salariés." },
  impotSalaires: { nom: "Impôt prélevé sur les salaires", famille: "personnel", propose: "4421", tva: null, couleur: "virement", pourquoi: "Le prélèvement à la source de vos salariés, que les impôts vous prélèvent chaque mois. Il vient de leur salaire, ce n'est pas une charge." },
  impots: { nom: "Impôts et taxes", famille: "etat", propose: "635", tva: null, couleur: "virement", pourquoi: "CFE, taxe foncière du dépôt, taxe sur les véhicules." },
  tvaVersee: { nom: "TVA versée", famille: "etat", propose: "44551", tva: null, couleur: "virement", pourquoi: "Le paiement de votre TVA aux impôts : il solde la TVA due, ce n'est pas une charge." },
  emprunt: { nom: "Emprunt", famille: "argent", propose: "164", tva: null, couleur: "virement", pourquoi: "L'échéance du prêt. La part d'intérêts (6611) se lit sur le tableau d'amortissement." },
  prelevement: { nom: "Prélèvement personnel", famille: "argent", propose: exploitantOuAssocie, tva: null, couleur: "virement", pourquoi: (s) => (s.societe ? "L'argent que vous prenez pour vous : votre compte courant d'associé." : "L'argent que vous prenez pour vous : compte de l'exploitant.") },
  aClasser: { nom: "À classer", famille: "argent", propose: "471", tva: null, couleur: "autre", pourquoi: "Compte d'attente : votre comptable range la ligne. Rien n'y reste à la clôture." },
  apport: { nom: "Apport personnel", famille: "entrees", propose: exploitantOuAssocie, tva: null, couleur: "recu", pourquoi: (s) => (s.societe ? "L'argent que vous prêtez à votre société." : "L'argent que vous remettez dans l'entreprise.") },
  pretRecu: { nom: "Prêt reçu", famille: "entrees", propose: "164", tva: null, couleur: "recu", pourquoi: "Le prêt versé par la banque." },
  aide: { nom: "Aide, subvention", famille: "entrees", propose: "741", tva: null, couleur: "recu", pourquoi: "Une aide à l'embauche, une subvention de la région." },
  entreComptes: { nom: "Entre mes comptes", famille: "entrees", propose: "580", tva: null, couleur: "recu", pourquoi: "De votre livret à votre compte courant : ni une vente, ni une dépense." },
  remboursement: { nom: "Remboursement", famille: "entrees", propose: "471", tva: null, couleur: "recu", pourquoi: "Un fournisseur ou une assurance vous rembourse : votre comptable le range." },
  ventes: { nom: "Ventes, travaux et prestations", famille: "tiers", propose: "706", tva: null, couleur: "recu", pourquoi: "Vos factures de travaux et d'entretien. Votre comptable peut préférer le 704, travaux, pour la création." },
  clients: { nom: "Clients", famille: "tiers", propose: "411", tva: null, couleur: "recu", pourquoi: "Ce que vos clients vous doivent." },
  fournisseurs: { nom: "Fournisseurs", famille: "tiers", propose: "401", tva: null, couleur: "virement", pourquoi: "Ce que vous devez à vos fournisseurs." },
  banque: { nom: "Banque", famille: "tiers", propose: "512", tva: null, couleur: "recu", pourquoi: "Votre compte en banque." },
  tvaCollectee: { nom: "TVA due", famille: "tva", propose: "44571", tva: null, couleur: "virement", pourquoi: "La TVA de vos ventes, due quand le client a payé." },
  tvaEnAttente: { nom: "TVA en attente du paiement", famille: "tva", propose: "44574", tva: null, couleur: "virement", pourquoi: "La TVA de vos travaux est due à l'encaissement : elle attend ici que le client paie. Le 44574 est d'usage, il n'est pas dans le plan comptable." },
  tvaDeductible: { nom: "TVA déductible", famille: "tva", propose: "44566", tva: null, couleur: "virement", pourquoi: "La TVA de vos achats." },
  tvaImmobilisations: { nom: "TVA sur le matériel de plus de 500 €", famille: "tva", propose: "44562", tva: null, couleur: "virement", pourquoi: "La TVA d'un matériel qui s'amortit se range à part." },
} as const satisfies Record<string, Definition>;

export type CleCompta = keyof typeof CATEGORIES_COMPTABLES;
export const CLES_COMPTA = Object.keys(CATEGORIES_COMPTABLES) as CleCompta[];

const DEF: Record<CleCompta, Definition> = CATEGORIES_COMPTABLES;

export function estCleCompta(v: unknown): v is CleCompta {
  return typeof v === "string" && Object.prototype.hasOwnProperty.call(CATEGORIES_COMPTABLES, v);
}

export function nomCategorie(cle: CleCompta): string {
  return DEF[cle].nom;
}
export function familleDe(cle: CleCompta): Famille {
  return DEF[cle].famille;
}
export function couleurDe(cle: CleCompta): Categorie {
  return DEF[cle].couleur;
}
export function tvaDe(cle: CleCompta): "deductible" | "immobilisation" | null {
  return DEF[cle].tva;
}
export function compteSuggere(cle: CleCompta, s: Situation): string {
  const p = DEF[cle].propose;
  return typeof p === "function" ? p(s) : p;
}
export function raisonDu(cle: CleCompta, s: Situation): string {
  const r = DEF[cle].pourquoi;
  return typeof r === "function" ? r(s) : r;
}

/** Les catégories que choisit une ligne de banque, selon son sens. */
export const FAMILLES_DES_SORTIES: readonly Famille[] = ["chantier", "route", "bureau", "personnel", "etat", "argent"];
export function categoriesDuSens(sens: "entree" | "sortie"): CleCompta[] {
  const familles: readonly Famille[] = sens === "sortie" ? FAMILLES_DES_SORTIES : ["entrees"];
  return CLES_COMPTA.filter((c) => familles.includes(familleDe(c)));
}

/** Les numéros qu'il a changés, gardés tels quels sur l'entreprise (migration 0198). */
export type NumerosChoisis = Partial<Record<CleCompta, string>>;

/** Le numéro qui part dans les trois fichiers : le sien s'il l'a changé, sinon celui de Cause. */
export function numeroDuCompte(cle: CleCompta, s: Situation, choisis: NumerosChoisis): string {
  return choisis[cle] ?? compteSuggere(cle, s);
}

/** Ne garde que des clés connues et des numéros lisibles : la base ne décide pas à la place de la règle. */
export function lireNumerosChoisis(brut: unknown): NumerosChoisis {
  const sortie: NumerosChoisis = {};
  if (!brut || typeof brut !== "object") return sortie;
  for (const [cle, valeur] of Object.entries(brut as Record<string, unknown>)) {
    if (!estCleCompta(cle)) continue;
    const lu = lireNumeroDeCompte(valeur);
    if (lu.ok) sortie[cle] = lu.numero;
  }
  return sortie;
}

/**
 * Un numéro de compte tapé : des chiffres seulement, de trois à dix. Le FEC
 * exige que ses trois premiers caractères soient ceux du plan comptable
 * (BOI-CF-IOR-60-40-20), et un logiciel comptable n'en lit pas davantage.
 */
export function lireNumeroDeCompte(v: unknown): { ok: true; numero: string } | { ok: false; raison: string } {
  const net = typeof v === "string" ? v.replace(/\s/g, "") : "";
  if (!/^\d+$/.test(net)) return { ok: false, raison: "Un numéro de compte ne s'écrit qu'avec des chiffres." };
  if (net.length < 3) return { ok: false, raison: "Un numéro de compte a au moins trois chiffres." };
  if (net.length > 10) return { ok: false, raison: "Un numéro de compte a dix chiffres au plus." };
  return { ok: true, numero: net };
}

/**
 * Un numéro dont la classe n'est pas celle que Cause proposait se signale,
 * sans se refuser : un comptable a le droit d'avoir un plan à lui.
 */
export function avisSurLeNumero(cle: CleCompta, numero: string, s: Situation): string | null {
  const attendu = compteSuggere(cle, s).charAt(0);
  if (numero.charAt(0) === attendu) return null;
  return `Cause proposait un compte de classe ${attendu} : vérifiez avec votre comptable.`;
}

/**
 * LA CATÉGORIE QU'UNE LIGNE PREND D'ELLE-MÊME, avant tout choix du patron.
 *
 * Ce que la ligne DIT : la nature de son ticket, le motif posé par le patron,
 * une facture d'Atlas pour un client. Rien d'autre ne se devine : un virement à
 * un fournisseur, une facture reçue, un ticket perdu vont « À classer », et le
 * patron les range d'un appui.
 */
export function categorieProposee(l: {
  sens: "entree" | "sortie";
  justification: Justification | null;
  motif: Motif | null;
  natureDuTicket: NatureAchat | null;
  factureEmise: boolean;
}): CleCompta {
  if (l.sens === "entree") {
    if (l.factureEmise) return "clients";
    switch (l.motif) {
      case "perso":
        return "apport";
      case "pret":
        return "pretRecu";
      case "aide":
        return "aide";
      case "entre_comptes":
        return "entreComptes";
      case "remboursement":
        return "remboursement";
      default:
        return "remboursement";
    }
  }
  if (l.justification === "ticket") {
    switch (l.natureDuTicket) {
      case "carburant":
        return "carburant";
      case "repas":
        return "repas";
      case "hotel":
        return "hotel";
      case "transport":
        return "transport";
      case "materiel":
        return "materiaux";
      default:
        return "aClasser";
    }
  }
  if (l.justification === "motif") {
    switch (l.motif) {
      case "salaire":
        return "salaires";
      case "loyer":
        return "loyer";
      case "impots":
        return "impots";
      case "pret":
        return "emprunt";
      case "perso":
        return "prelevement";
      default:
        return "aClasser";
    }
  }
  return "aClasser";
}

/**
 * La catégorie qui compte : celle qu'il a choisie, sinon celle que la ligne
 * prend d'elle-même. Une entrée payée par un client reste toujours au client :
 * c'est sa facture qui la range.
 */
export function categorieDeLaLigneComptable(
  l: Parameters<typeof categorieProposee>[0] & { choisie: CleCompta | null }
): CleCompta {
  const proposee = categorieProposee(l);
  if (proposee === "clients") return "clients";
  if (l.choisie && categoriesDuSens(l.sens).includes(l.choisie)) return l.choisie;
  return proposee;
}

/** Les intitulés du plan comptable des numéros que Cause propose, pour la feuille du réglage et le FEC. */
export const INTITULES_PCG: Readonly<Record<string, string>> = {
  "108": "Compte de l'exploitant",
  "164": "Emprunts auprès des établissements de crédit",
  "2154": "Matériels industriels",
  "2155": "Outillages industriels",
  "2182": "Matériel de transport",
  "401": "Fournisseurs",
  "411": "Clients",
  "421": "Personnel, rémunérations dues",
  "431": "Sécurité sociale",
  "437": "Autres organismes sociaux",
  "4421": "Prélèvements à la source, impôt sur le revenu",
  "44551": "TVA à décaisser",
  "44562": "TVA sur immobilisations",
  "44566": "TVA sur autres biens et services",
  "44571": "TVA collectée",
  "44574": "TVA sur encaissements, en attente",
  "455": "Associés, comptes courants",
  "4551": "Associés, comptes courants, principal",
  "471": "Compte d'attente",
  "512": "Banques",
  "580": "Virements internes",
  "601": "Achats stockés, matières premières et fournitures",
  "604": "Achats d'études et prestations de services",
  "605": "Achats de matériel, équipements et travaux",
  "6061": "Fournitures non stockables, eau, énergie",
  "6063": "Fournitures d'entretien et de petit équipement",
  "6064": "Fournitures administratives",
  "607": "Achats de marchandises",
  "611": "Sous-traitance générale",
  "6122": "Crédit bail mobilier",
  "6132": "Locations immobilières",
  "6135": "Locations mobilières",
  "6155": "Entretien et réparations sur biens mobiliers",
  "616": "Primes d'assurances",
  "6226": "Honoraires",
  "6228": "Rémunérations d'intermédiaires et honoraires, divers",
  "623": "Publicité, publications, relations publiques",
  "6251": "Voyages et déplacements",
  "6256": "Missions",
  "6257": "Réceptions",
  "626": "Frais postaux et de télécommunications",
  "627": "Services bancaires et assimilés",
  "6281": "Concours divers, cotisations",
  "6288": "Autres services extérieurs, divers",
  "6333": "Participation des employeurs à la formation professionnelle continue",
  "635": "Autres impôts, taxes et versements assimilés",
  "641": "Rémunérations du personnel",
  "646": "Cotisations sociales personnelles de l'exploitant",
  "6611": "Intérêts des emprunts et dettes",
  "6615": "Intérêts des comptes courants et des dépôts créditeurs",
  "704": "Travaux",
  "706": "Prestations de services",
  "707": "Ventes de marchandises",
  "741": "Subventions d'exploitation",
};

export function intituleDuCompte(numero: string): string | null {
  return INTITULES_PCG[numero] ?? null;
}
