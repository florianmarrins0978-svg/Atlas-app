import { nomRapproche, rapprocherClient, type ClientExistant } from "./rapprochement-client";

/**
 * IMPORTER UN TABLEAU DE DEVIS ET FACTURES : les règles, sans base ni réseau.
 *
 * **Ses demandes du 28 octobre 2026**, planche `appli/soignee/clients-importer.html` :
 * *« il faut qu'elle importe du CSV, qu'on puisse importer une année de
 * clients et qu'elle les range en créant des fiches clients »*, puis *« faut
 * pouvoir importer des devis ou factures en CSV, récupérer les infos des devis
 * et factures pour créer les fiches clients et les ranger par date »*. Le
 * tableau est donc un export, **une ligne par pièce**.
 *
 * **SA RÈGLE, ET TOUT CE FICHIER LA SERT : « il faut zéro erreur ! Faut pas se
 * tromper sur une adresse »**, et *« lorsque Atlas hésite, il faut qu'il nous
 * ressorte les libellés modifiables, seulement quand il hésite »*. Donc :
 *
 *   - une colonne qui se reconnaît se prend ; deux qui se disputent un champ,
 *     ou un champ qu'il faut et qu'aucune ne porte, se DEMANDENT ;
 *   - une date qui se lit « 3 avril » ou « 4 mars » se demande ;
 *   - deux vraies adresses pour un nom, ou une adresse qui n'est pas celle de sa
 *     fiche, se demandent ; une adresse écrite autrement reste la même ;
 *   - une seconde adresse n'est jamais effacée : elle reste sur la pièce, comme
 *     adresse du chantier (sa remarque du même soir) ;
 *   - rien ne s'invente : ce que le tableau ne dit pas reste vide.
 *
 * **La même fonction sert l'écran et le serveur** : l'écran montre ce que le
 * serveur rangera, ligne pour ligne (`CLAUDE.md` §3).
 */

/** Les champs qu'Atlas lit dans un tableau, dans l'ordre de la planche. */
export const CHAMPS_DU_TABLEAU = [
  "Client",
  "Type",
  "Numéro",
  "Objet",
  "Date",
  "Adresse",
  "Code postal",
  "Ville",
  "Adresse du chantier",
  "Téléphone",
  "Montant TTC",
] as const;
export type ChampDuTableau = (typeof CHAMPS_DU_TABLEAU)[number];
export type Colonnes = Partial<Record<ChampDuTableau, number>>;

/**
 * **Vingt mille lignes au plus**, soit une quinzaine d'années de pièces d'un
 * artisan actif (la planche en range 5 120 sur dix ans). Au-delà, le tableau se
 * coupe en deux ; c'est aussi ce qui borne la mémoire du serveur qui le lit.
 */
export const LIGNES_MAX = 20_000;
/** Au-delà, ce n'est plus un export de pièces : une feuille de calcul entière. */
const COLONNES_MAX = 80;

// ─── Lire un CSV ────────────────────────────────────────────────────────────

/**
 * Le texte d'un fichier : UTF-8 d'abord ; un vieil Excel français écrit en
 * Windows-1252, et « Élagage » sortirait « �lagage » si l'on s'entêtait.
 */
export function decoderTexte(octets: Uint8Array): string {
  if (octets[0] === 0xff && octets[1] === 0xfe) return new TextDecoder("utf-16le").decode(octets.subarray(2));
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(octets);
  } catch {
    return new TextDecoder("windows-1252").decode(octets);
  }
}

/** Le séparateur de la première ligne : un export français en met des « ; ». */
function separateurDe(texte: string): string {
  const compte: Record<string, number> = { ";": 0, ",": 0, "\t": 0 };
  let entreGuillemets = false;
  for (const c of texte) {
    if (c === '"') entreGuillemets = !entreGuillemets;
    else if (!entreGuillemets && (c === "\n" || c === "\r")) break;
    else if (!entreGuillemets && c in compte) compte[c]++;
  }
  // À égalité, le point-virgule : la virgule est aussi la décimale d'un montant.
  return [";", "\t", ","].reduce((a, b) => (compte[b] > compte[a] ? b : a));
}

/**
 * Les cellules d'un CSV, ligne par ligne, lignes vides écartées.
 *
 * Les guillemets suivent la norme : une case peut porter le séparateur, un
 * retour à la ligne, et « "" » pour un guillemet. Au-delà de `LIGNES_MAX`, la
 * lecture s'arrête une ligne plus loin : l'appelant voit qu'il y en a trop.
 */
export function lireCsv(octets: Uint8Array): string[][] {
  const texte = decoderTexte(octets).replace(/^﻿/, "");
  const sep = separateurDe(texte);
  const lignes: string[][] = [];
  let ligne: string[] = [];
  let case_ = "";
  let entreGuillemets = false;
  const finirLigne = () => {
    ligne.push(case_);
    case_ = "";
    const propre = ligne.slice(0, COLONNES_MAX).map((c) => c.trim());
    if (propre.some(Boolean)) lignes.push(propre);
    ligne = [];
  };
  for (let i = 0; i < texte.length && lignes.length <= LIGNES_MAX + 1; i++) {
    const c = texte[i];
    if (entreGuillemets) {
      if (c === '"' && texte[i + 1] === '"') {
        case_ += '"';
        i++;
      } else if (c === '"') entreGuillemets = false;
      else case_ += c;
    } else if (c === '"' && case_.trim() === "") {
      case_ = "";
      entreGuillemets = true;
    } else if (c === sep) {
      ligne.push(case_);
      case_ = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && texte[i + 1] === "\n") i++;
      finirLigne();
    } else case_ += c;
  }
  if (case_ !== "" || ligne.length > 0) finirLigne();
  return lignes;
}

// ─── Reconnaître les colonnes ───────────────────────────────────────────────

/** Un en-tête tel qu'on le compare : « N° » devient « n », « Tél. » « tel ». */
function aplatir(texte: string): string {
  return texte
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

type Regle = {
  /** Les en-têtes qui ne laissent aucun doute. */
  exacts: string[];
  /** Ceux qui s'y rattachent par un mot, quand aucun exact ne sort. */
  mots?: (mots: Set<string>) => boolean;
};

const un = (m: Set<string>, ...l: string[]) => l.some((x) => m.has(x));

/**
 * **L'ordre compte** : un champ précis passe avant un champ large, et une
 * colonne prise ne se donne pas deux fois. Sans cela, « Adresse du chantier »
 * aurait été prise pour l'adresse du client, et « Adresse client » pour son nom.
 */
const REGLES: [ChampDuTableau, Regle][] = [
  [
    "Adresse du chantier",
    {
      exacts: [
        "adresse du chantier", "adresse chantier", "lieu du chantier", "lieu intervention", "lieu d intervention",
        "lieu de l intervention", "adresse intervention", "adresse d intervention", "adresse de l intervention",
        "lieu des travaux", "adresse des travaux", "adresse travaux",
      ],
      mots: (m) => un(m, "adresse", "lieu") && un(m, "chantier", "intervention", "travaux"),
    },
  ],
  ["Code postal", { exacts: ["cp", "c p", "code postal", "codepostal", "code postal client"], mots: (m) => m.has("postal") }],
  [
    "Téléphone",
    {
      exacts: ["tel", "telephone", "portable", "mobile", "gsm", "tel portable", "tel mobile", "telephone portable", "telephone mobile", "tel client", "telephone client"],
      mots: (m) => un(m, "tel", "telephone", "portable", "mobile", "gsm") && !m.has("fax"),
    },
  ],
  [
    "Montant TTC",
    {
      exacts: ["total ttc", "montant ttc", "ttc", "net a payer", "total ttc eur", "montant ttc eur", "total ttc euros", "prix ttc", "montant total ttc"],
      mots: (m) => m.has("ttc") && !un(m, "ht", "tva", "remise", "acompte"),
    },
  ],
  [
    "Numéro",
    {
      exacts: [
        "n", "no", "num", "numero", "n piece", "numero piece", "numero de piece", "n de piece", "reference", "ref",
        "n document", "numero document", "numero de document", "n facture", "numero facture", "n devis", "numero devis",
      ],
      mots: (m) =>
        un(m, "n", "no", "num", "numero", "ref", "reference") &&
        !un(m, "client", "tel", "telephone", "siret", "tva", "postal", "compte", "commande", "rue"),
    },
  ],
  [
    "Date",
    {
      exacts: [
        "date", "date document", "date du document", "date de document", "date emission", "date d emission",
        "date de la piece", "date piece", "date facture", "date devis", "date de creation", "date creation", "emis le",
      ],
      mots: (m) =>
        m.has("date") &&
        !un(m, "echeance", "validite", "paiement", "reglement", "livraison", "naissance", "modification", "relance", "intervention"),
    },
  ],
  [
    "Type",
    {
      exacts: ["type", "type de document", "type document", "document", "nature", "genre", "type de piece", "type piece"],
      mots: (m) => m.has("type") && !un(m, "client", "paiement", "reglement", "tva"),
    },
  ],
  ["Ville", { exacts: ["ville", "commune", "localite", "ville client"], mots: (m) => un(m, "ville", "commune") }],
  [
    "Objet",
    {
      exacts: ["objet", "titre", "intitule", "libelle", "description", "sujet", "designation", "objet du devis", "objet de la facture"],
      mots: (m) => un(m, "objet", "intitule", "titre"),
    },
  ],
  [
    "Adresse",
    {
      exacts: ["adresse", "adresse client", "adresse du client", "rue", "adresse 1", "adresse1", "adresse de facturation", "adresse facturation", "adresse postale"],
      mots: (m) => un(m, "adresse", "rue") && !un(m, "mail", "email", "electronique", "livraison", "2", "complement", "ip"),
    },
  ],
  [
    "Client",
    {
      exacts: ["client", "nom", "nom client", "nom du client", "raison sociale", "destinataire", "tiers", "societe", "nom prenom", "nom et prenom"],
      mots: (m) =>
        un(m, "client", "nom") &&
        !un(m, "adresse", "rue", "ville", "cp", "code", "postal", "tel", "telephone", "portable", "mobile", "mail", "email", "siret", "tva", "n", "no", "num", "numero", "ref", "reference"),
    },
  ],
];

/** Un « Total » ou un « Montant » sans précision : peut-être HT, donc demandé. */
const MONTANTS_SANS_PRECISION = new Set(["total", "montant", "montant total", "prix", "total eur", "montant eur", "total euros"]);

export type OrdreDate = "jma" | "mja" | "amj";

export type Reconnaissance = {
  colonnes: Colonnes;
  /** Les champs sur lesquels Atlas hésite : rien ne se range avant sa réponse. */
  hesite: ChampDuTableau[];
  /** Les colonnes entre lesquelles il hésite, champ par champ. */
  candidats: Partial<Record<ChampDuTableau, number[]>>;
  /** Comment se lisent les dates de la colonne retenue. */
  ordreDate: OrdreDate | "doute" | null;
};

/**
 * Ce qu'Atlas reconnaît d'un tableau, et ce sur quoi il hésite.
 *
 * **Deux champs sont demandés s'ils manquent**, parce que sans eux rien ne se
 * range : le client (à qui ?) et le type (devis ou facture ?). Un tableau de
 * factures seules n'a souvent pas de colonne Type : la question se pose, une
 * fois, plutôt que de supposer.
 */
export function reconnaitreColonnes(entetes: readonly string[], lignes: readonly (readonly string[])[]): Reconnaissance {
  const aplatis = entetes.map((e) => aplatir(e ?? ""));
  const prises = new Set<number>();
  const colonnes: Colonnes = {};
  const hesite: ChampDuTableau[] = [];
  const candidats: Partial<Record<ChampDuTableau, number[]>> = {};
  const libres = () => aplatis.map((_, i) => i).filter((i) => !prises.has(i) && aplatis[i]);

  for (const [champ, regle] of REGLES) {
    let trouves = libres().filter((i) => regle.exacts.includes(aplatis[i]));
    if (trouves.length === 0 && regle.mots) trouves = libres().filter((i) => regle.mots!(new Set(aplatis[i].split(" "))));
    if (trouves.length === 0 && champ === "Montant TTC") {
      const larges = libres().filter((i) => MONTANTS_SANS_PRECISION.has(aplatis[i]));
      if (larges.length > 0) {
        hesite.push(champ);
        candidats[champ] = larges;
      }
      continue;
    }
    if (trouves.length === 0 && champ === "Type") {
      // Une colonne sans titre clair, mais dont les cases disent « Devis » ou
      // « Facture » : c'est elle.
      trouves = libres().filter((i) => {
        const valeurs = lignes.map((l) => l[i] ?? "").filter(Boolean);
        return valeurs.length > 0 && valeurs.filter((v) => genreDuTableau(v) !== null).length >= valeurs.length * 0.8;
      });
    }
    if (trouves.length === 1) {
      colonnes[champ] = trouves[0];
      prises.add(trouves[0]);
    } else if (trouves.length > 1 || champ === "Client" || champ === "Type") {
      hesite.push(champ);
      candidats[champ] = trouves;
    }
  }

  const colDate = colonnes["Date"];
  const ordreDate = colDate === undefined ? null : ordreDesDates(lignes.map((l) => l[colDate] ?? ""));
  return { colonnes, hesite: CHAMPS_DU_TABLEAU.filter((c) => hesite.includes(c)), candidats, ordreDate };
}

// ─── Lire une case ──────────────────────────────────────────────────────────

/** Une date d'Excel est un nombre de jours depuis le 30 décembre 1899. */
function jourExcel(brut: string): string | null {
  if (!/^\d{5}(\.\d+)?$/.test(brut)) return null;
  const n = Math.floor(Number(brut));
  if (n < 20_000 || n > 80_000) return null;
  return new Date(Date.UTC(1899, 11, 30) + n * 86_400_000).toISOString().slice(0, 10);
}

function jourValide(a: number, m: number, j: number): string | null {
  if (a < 100) a += 2000;
  if (a < 1990 || a > 2100 || m < 1 || m > 12 || j < 1 || j > 31) return null;
  const d = new Date(Date.UTC(a, m - 1, j));
  if (d.getUTCDate() !== j) return null;
  return `${a}-${String(m).padStart(2, "0")}-${String(j).padStart(2, "0")}`;
}

/**
 * Le jour d'une case. Une date AAAA-MM-JJ ou un nombre d'Excel se lisent
 * toujours ; « 03/04/2025 » ne se lit qu'avec l'ordre de la colonne
 * (`ordreDesDates`). Sans ordre, `null` : on ne devine pas.
 */
export function jourDuTableau(brut: string, ordre: OrdreDate | null): string | null {
  const t = (brut ?? "").trim().replace(/\s.*$/, "");
  if (!t) return null;
  const excel = jourExcel(t);
  if (excel) return excel;
  const iso = /^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/.exec(t);
  if (iso) return jourValide(Number(iso[1]), Number(iso[2]), Number(iso[3]));
  const fr = /^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2}|\d{4})$/.exec(t);
  if (!fr || !ordre || ordre === "amj") return null;
  const [a, b, annee] = [Number(fr[1]), Number(fr[2]), Number(fr[3])];
  return ordre === "jma" ? jourValide(annee, b, a) : jourValide(annee, a, b);
}

/**
 * Comment se lisent les dates d'une colonne, déduit de la colonne entière :
 * un « 28 » ne peut être qu'un jour. **Si rien ne tranche, « doute »** :
 * « 03/04 » se lit 3 avril en France et 4 mars ailleurs, et c'est à lui de le
 * dire. `null` : aucune date dans la colonne.
 */
export function ordreDesDates(valeurs: readonly string[]): OrdreDate | "doute" | null {
  let jourDabord = false;
  let moisDabord = false;
  let ambigues = 0;
  let sures = 0;
  for (const v of valeurs) {
    const t = (v ?? "").trim().replace(/\s.*$/, "");
    if (!t) continue;
    if (jourExcel(t) || /^\d{4}[-/.]\d{1,2}[-/.]\d{1,2}$/.test(t)) {
      sures++;
      continue;
    }
    const fr = /^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2}|\d{4})$/.exec(t);
    if (!fr) continue;
    const [a, b] = [Number(fr[1]), Number(fr[2])];
    if (a > 12 && b <= 12) jourDabord = true;
    else if (b > 12 && a <= 12) moisDabord = true;
    else ambigues++;
  }
  if (jourDabord && moisDabord) return "doute";
  if (jourDabord) return "jma";
  if (moisDabord) return "mja";
  if (ambigues > 0) return "doute";
  return sures > 0 ? "amj" : null;
}

/**
 * Un montant de tableau : « 1 250,00 », « 1.250,00 », « 1250.5 », « 1250 ».
 * **Négatif, il n'est pas repris** : c'est un avoir, ni un devis ni une facture.
 */
export function montantDuTableau(brut: string): string | null {
  let t = (brut ?? "").replace(/[\s  €]|eur(os)?/gi, "");
  if (!t || t.startsWith("-") || t.startsWith("(")) return null;
  const virgule = t.lastIndexOf(",");
  const point = t.lastIndexOf(".");
  // La DERNIÈRE marque est la décimale ; l'autre sépare les milliers.
  if (virgule > point) t = t.replace(/\./g, "").replace(",", ".");
  else if (point > virgule && virgule >= 0) t = t.replace(/,/g, "");
  else if (point >= 0 && /^\d{1,3}(\.\d{3})+$/.test(t)) t = t.replace(/\./g, "");
  if (!/^\d{1,9}(\.\d{1,2})?$/.test(t)) return null;
  return Number(t).toFixed(2);
}

/** Devis ou facture, lu dans le mot. Un avoir n'est ni l'un ni l'autre. */
export function genreDuTableau(brut: string): "devis" | "facture" | null {
  const t = aplatir(brut ?? "");
  if (!t || t.includes("avoir")) return null;
  if (t.startsWith("fact") || t === "fa" || t === "f") return "facture";
  if (t.startsWith("devis") || t.startsWith("dev") || t === "d" || t.startsWith("proposition") || t.startsWith("estimation")) return "devis";
  return null;
}

/**
 * **La même adresse écrite autrement reste la même** : virgule, tiret,
 * capitales, accents, « bd » pour « boulevard ». Au-delà, on ne devine pas :
 * deux adresses qui diffèrent d'un numéro sont deux adresses.
 */
export function normaliserAdresse(adresse: string): string {
  const ABREGES: Record<string, string> = {
    bd: "boulevard", bld: "boulevard", bvd: "boulevard", boul: "boulevard", av: "avenue", ave: "avenue",
    pl: "place", imp: "impasse", r: "rue", ch: "chemin", che: "chemin", rte: "route", all: "allee",
    st: "saint", ste: "sainte", sq: "square", fbg: "faubourg", res: "residence", lot: "lotissement",
  };
  return aplatir(adresse)
    .split(" ")
    .filter(Boolean)
    .map((m) => ABREGES[m] ?? m)
    .join(" ");
}

/** « 1000 » sorti d'Excel était « 01000 » : un code postal français a cinq chiffres. */
function codePostal(brut: string): string {
  const t = brut.trim();
  return /^\d{4}$/.test(t) ? `0${t}` : t;
}

// ─── Les lignes ─────────────────────────────────────────────────────────────

export type LigneLue = {
  /** Le rang de la ligne dans le fichier (l'en-tête est la ligne 0). */
  rang: number;
  genre: "devis" | "facture";
  numero: string | null;
  objet: string | null;
  /** AAAA-MM-JJ, ou `null` : sans date. */
  jour: string | null;
  /** « 1250.00 », ou `null` : sans montant. */
  montant: string | null;
  nom: string | null;
  /** L'adresse du client telle que le tableau l'écrit, rue, code postal et ville. */
  adresse: string | null;
  telephone: string | null;
  /** La colonne de l'adresse du chantier, quand le tableau en a une. */
  chantier: string | null;
};

export type Reglages = {
  colonnes: Colonnes;
  ordreDate: OrdreDate | null;
  /** Un tableau sans colonne Type : il a dit ce qu'il contient. */
  genreFixe?: "devis" | "facture" | null;
};

export type Lecture = {
  lignes: LigneLue[];
  /** Le même numéro deux fois : rangé une fois. */
  doubles: number;
  /** Ni devis ni facture : un avoir, une ligne de total, un mot inconnu. */
  ignorees: number;
  devis: number;
  factures: number;
};

const borne = (t: string, n: number) => (t ? t.replace(/\s+/g, " ").trim().slice(0, n) : "") || null;

/** Ce qui fait d'une pièce un doublon : son numéro, sinon tout ce qu'elle dit. */
export function cleDeLaPiece(l: Pick<LigneLue, "genre" | "numero" | "nom" | "jour" | "montant" | "objet">): string {
  if (l.numero) return `${l.genre}|${l.numero.replace(/\s+/g, "").toUpperCase()}`;
  return [l.genre, nomRapproche(l.nom ?? ""), l.jour ?? "", l.montant ?? "", (l.objet ?? "").toLowerCase()].join("|");
}

export function lireLignes(grille: readonly (readonly string[])[], reglages: Reglages): Lecture {
  const { colonnes, ordreDate } = reglages;
  const lecture: Lecture = { lignes: [], doubles: 0, ignorees: 0, devis: 0, factures: 0 };
  const vues = new Set<string>();
  for (let rang = 1; rang < grille.length && rang <= LIGNES_MAX; rang++) {
    const ligne = grille[rang];
    const champ = (c: ChampDuTableau) => {
      const i = colonnes[c];
      return i === undefined ? "" : String(ligne[i] ?? "").trim();
    };
    const genre = reglages.genreFixe ?? genreDuTableau(champ("Type"));
    if (!genre) {
      if (ligne.some((c) => String(c ?? "").trim())) lecture.ignorees++;
      continue;
    }
    const cp = codePostal(champ("Code postal"));
    const villeCp = [cp, champ("Ville")].filter(Boolean).join(" ");
    const lue: LigneLue = {
      rang,
      genre,
      numero: borne(champ("Numéro"), 60),
      objet: borne(champ("Objet"), 200),
      jour: jourDuTableau(champ("Date"), ordreDate),
      montant: montantDuTableau(champ("Montant TTC")),
      nom: borne(champ("Client"), 120),
      adresse: borne([champ("Adresse"), villeCp].filter(Boolean).join(", "), 300),
      telephone: borne(champ("Téléphone"), 40),
      chantier: borne(champ("Adresse du chantier"), 300),
    };
    const cle = cleDeLaPiece(lue);
    if (vues.has(cle)) {
      lecture.doubles++;
      continue;
    }
    vues.add(cle);
    lecture.lignes.push(lue);
    if (genre === "devis") lecture.devis++;
    else lecture.factures++;
  }
  return lecture;
}

// ─── Par client ─────────────────────────────────────────────────────────────

export type ClientConnu = ClientExistant;

/**
 * Sa réponse pour un client qui attend : le rang de l'adresse qui est la
 * sienne, « deux » (ce sont deux clients), « meme » ou « autre » (devant une
 * fiche qui dit une autre adresse).
 */
export type ChoixAdresse = number | "deux" | "meme" | "autre";

export type AdresseDuGroupe = {
  /** Telle qu'elle apparaît la première fois dans le fichier. */
  lieu: string;
  norme: string;
  rangs: number[];
};

export type Groupe = {
  /** Le nom tel qu'on le compare (`nomRapproche`) : la clé des réponses. */
  cle: string;
  /** Le nom tel qu'il apparaît la première fois. */
  nom: string;
  /** Ses pièces, la plus récente d'abord. */
  lignes: LigneLue[];
  adresses: AdresseDuGroupe[];
  /** La fiche qu'il a déjà, retrouvée par la règle de toute l'appli. */
  deja: ClientConnu | null;
  /** `deux` : deux vraies adresses ; `fiche` : une autre que celle de sa fiche. */
  conflit: "deux" | "fiche" | null;
  choix: ChoixAdresse | undefined;
};

const parJourDecroissant = (a: LigneLue, b: LigneLue) => (b.jour ?? "").localeCompare(a.jour ?? "") || a.rang - b.rang;

/**
 * Les pièces groupées par client. **Ce qui demande une réponse passe en tête,
 * et y reste une fois répondu** : un client qui glissait à sa lettre après
 * l'appui emportait la réponse hors de vue (vu sur la planche, 28 octobre).
 *
 * Le client déjà dans Atlas se retrouve par `rapprocherClient`, la règle de
 * toute l'appli : un même nom avec un autre téléphone est quelqu'un d'autre.
 */
export function grouperParClient(
  lignes: readonly LigneLue[],
  connus: readonly ClientConnu[],
  choix: Readonly<Record<string, ChoixAdresse>>
): { groupes: Groupe[]; sansNom: LigneLue[] } {
  const parCle = new Map<string, Groupe>();
  const sansNom: LigneLue[] = [];
  for (const l of lignes) {
    if (!l.nom) {
      sansNom.push(l);
      continue;
    }
    const cle = nomRapproche(l.nom) || l.nom.toLowerCase();
    let g = parCle.get(cle);
    if (!g) {
      g = { cle, nom: l.nom, lignes: [], adresses: [], deja: null, conflit: null, choix: undefined };
      parCle.set(cle, g);
    }
    g.lignes.push(l);
    if (!l.adresse) continue;
    const norme = normaliserAdresse(l.adresse);
    const a = g.adresses.find((x) => x.norme === norme);
    if (a) a.rangs.push(l.rang);
    else g.adresses.push({ lieu: l.adresse, norme, rangs: [l.rang] });
  }

  const groupes = [...parCle.values()];
  for (const g of groupes) {
    g.lignes.sort(parJourDecroissant);
    const telephone = g.lignes.find((l) => l.telephone)?.telephone ?? null;
    const verdict = rapprocherClient({ nom: g.nom, telephone }, connus);
    g.deja = verdict.type === "reutiliser" ? (connus.find((c) => c.id === verdict.id) ?? null) : null;
    const ficheDit = g.deja?.adresse?.trim();
    if (g.adresses.length > 1) g.conflit = "deux";
    else if (ficheDit && g.adresses.length === 1 && normaliserAdresse(ficheDit) !== g.adresses[0].norme) g.conflit = "fiche";
    const c = choix[g.cle];
    if (g.conflit === "deux" && (c === "deux" || (typeof c === "number" && c >= 0 && c < g.adresses.length))) g.choix = c;
    if (g.conflit === "fiche" && (c === "meme" || c === "autre")) g.choix = c;
  }
  groupes.sort((a, b) => (a.conflit ? 0 : 1) - (b.conflit ? 0 : 1) || a.cle.localeCompare(b.cle, "fr"));
  return { groupes, sansNom };
}

// ─── Ce que le rangement écrira ─────────────────────────────────────────────

export type PieceAPoser = {
  genre: "devis" | "facture";
  numero: string | null;
  objet: string | null;
  jour: string | null;
  montant: string | null;
  /** Le nom tel que le tableau l'écrit : il reste sur la pièce. */
  nom: string;
  /** L'adresse de son chantier, quand elle n'est pas celle du client. */
  chantier: string | null;
  /** Ce qui empêche de la ranger deux fois (`cleDeLaPiece`). */
  cle: string;
};

export type ClientAPoser = {
  /** La fiche qu'il a déjà, ou `null` : une fiche se crée. */
  existant: string | null;
  nom: string;
  /**
   * Pour une fiche neuve, son adresse ; pour une fiche existante, ce qui
   * COMPLÈTE une case vide, et seulement une case vide (sa réponse du
   * 28 octobre, `complementsPourFiche` au serveur).
   */
  adresse: string | null;
  telephone: string | null;
  pieces: PieceAPoser[];
};

export type Plan =
  | { ok: true; clients: ClientAPoser[]; sansNom: number; aPart: number }
  | { ok: false; adresses: number };

/**
 * Ce que chaque fiche recevra. **Rien ne se range tant qu'une adresse attend
 * sa réponse** : zéro erreur, sa règle.
 *
 * Une pièce dont l'adresse n'est pas celle de son client garde la sienne,
 * comme adresse du chantier. **Un nom tapé** à la main range sa pièce chez le
 * client de ce nom, celui du tableau d'abord, sinon celui d'Atlas, sinon une
 * fiche neuve ; il ne soulève pas de question nouvelle : son adresse, si elle
 * diffère, reste sur la pièce.
 *
 * `aPart` : les pièces SANS adresse d'un nom qu'il a dit être deux clients.
 * Personne ne sait à laquelle des deux fiches elles vont : elles ne se rangent
 * pas, et l'écran le dit.
 */
export function planDeRangement(
  lignes: readonly LigneLue[],
  connus: readonly ClientConnu[],
  choix: Readonly<Record<string, ChoixAdresse>>,
  tapes: Readonly<Record<number, string>>
): Plan {
  const { groupes, sansNom } = grouperParClient(lignes, connus, choix);
  const attendent = groupes.filter((g) => g.conflit && g.choix === undefined).length;
  if (attendent > 0) return { ok: false, adresses: attendent };

  const clients: ClientAPoser[] = [];
  /** L'adresse que chaque fiche portera : c'est contre elle qu'un chantier se reconnaît. */
  const adresseRetenue = new Map<ClientAPoser, string | null>();
  const poser = (l: LigneLue, nom: string, client: ClientAPoser) => {
    const sienne = adresseRetenue.get(client) ?? null;
    const ailleurs = l.adresse && sienne && normaliserAdresse(l.adresse) !== normaliserAdresse(sienne) ? l.adresse : null;
    client.pieces.push({
      genre: l.genre,
      numero: l.numero,
      objet: l.objet,
      jour: l.jour,
      montant: l.montant,
      nom,
      chantier: l.chantier ?? ailleurs,
      cle: cleDeLaPiece(l),
    });
  };
  const ouvrir = (existant: ClientConnu | null, nom: string, adresse: string | null, telephone: string | null) => {
    const c: ClientAPoser = { existant: existant?.id ?? null, nom: existant?.nom ?? nom, adresse, telephone, pieces: [] };
    adresseRetenue.set(c, existant?.adresse?.trim() || adresse);
    clients.push(c);
    return c;
  };

  let aPart = 0;
  for (const g of groupes) {
    const telDe = (ls: LigneLue[]) => ls.find((l) => l.telephone)?.telephone ?? null;
    if (g.choix === "deux") {
      for (const a of g.adresses) {
        const siennes = g.lignes.filter((l) => l.adresse && normaliserAdresse(l.adresse) === a.norme);
        const estLaFiche = g.deja?.adresse?.trim() && normaliserAdresse(g.deja.adresse) === a.norme;
        const c = estLaFiche ? ouvrir(g.deja, g.nom, null, telDe(siennes)) : ouvrir(null, g.nom, a.lieu, telDe(siennes));
        for (const l of siennes) poser(l, l.nom ?? g.nom, c);
      }
      aPart += g.lignes.filter((l) => !l.adresse).length;
      continue;
    }
    const choisie = typeof g.choix === "number" ? g.adresses[g.choix].lieu : (g.adresses[0]?.lieu ?? null);
    const garde = g.deja && g.choix !== "autre";
    // Devant « Sa fiche dit… », il a dit « le même » : la fiche garde la sienne,
    // rien ne la complète.
    const c = garde ? ouvrir(g.deja, g.nom, g.conflit === "fiche" ? null : choisie, telDe(g.lignes)) : ouvrir(null, g.nom, choisie, telDe(g.lignes));
    for (const l of g.lignes) poser(l, l.nom ?? g.nom, c);
  }

  let restent = 0;
  for (const l of sansNom) {
    const nom = (tapes[l.rang] ?? "").replace(/\s+/g, " ").trim().slice(0, 120);
    if (!nom) {
      restent++;
      continue;
    }
    const cle = nomRapproche(nom) || nom.toLowerCase();
    const memes = clients.filter((c) => (nomRapproche(c.nom) || c.nom.toLowerCase()) === cle);
    let cible = memes.length === 1 ? memes[0] : memes.find((c) => l.adresse && adresseRetenue.get(c) && normaliserAdresse(adresseRetenue.get(c)!) === normaliserAdresse(l.adresse));
    if (!cible && memes.length > 1) {
      aPart++;
      continue;
    }
    if (!cible) {
      const verdict = rapprocherClient({ nom, telephone: l.telephone }, connus);
      const deja = verdict.type === "reutiliser" ? (connus.find((c) => c.id === verdict.id) ?? null) : null;
      cible = ouvrir(deja, nom, l.adresse, l.telephone);
    }
    poser(l, nom, cible);
  }

  for (const c of clients) c.pieces.sort((a, b) => (b.jour ?? "").localeCompare(a.jour ?? ""));
  return { ok: true, clients, sansNom: restent, aPart };
}
