/**
 * LES VÉHICULES DE L'ENTREPRISE — sa planche du 14 octobre 2026, la troisième
 * (`appli/vehicules-plus-simple.html`), et sa demande : *« les rappels au bon
 * moment pour les choses importantes »*.
 *
 * Les règles vivent ici, sans base et sans écran : la liste des véhicules, la
 * fiche et l'accueil les lisent toutes les trois, et deux écrans qui
 * calculeraient chacun leur seuil finiraient par ne plus dire la même chose
 * (`CLAUDE.md` §3). Éprouvées par `scripts/test-vehicules.ts`.
 *
 * **Ce qui a été vérifié avec lui avant de dessiner, et qui borne tout le
 * reste.** Au contrôle routier, la carte grise se montre en ORIGINAL (la copie
 * ne vaut que pour une location ou un véhicule de PLUS de 3,5 t, ses camions
 * font 3,5 t pile) ; l'assurance ne se montre plus depuis le 1er avril 2024.
 * Cette rubrique sert donc au constat, à la copie de secours et aux rappels
 * des contrôles, pas à remplacer les papiers de la boîte à gants.
 */

import { jourEtMois } from "./jour";

export type NatureDocumentVehicule = "carte_grise" | "assurance" | "controle_technique";

export const NATURES_DOCUMENT_VEHICULE: readonly NatureDocumentVehicule[] = [
  "carte_grise",
  "assurance",
  "controle_technique",
];

export const NOM_DOCUMENT_VEHICULE: Record<NatureDocumentVehicule, string> = {
  carte_grise: "Carte grise",
  assurance: "Assurance",
  controle_technique: "Contrôle technique",
};

/** Ce qu'on dit d'une case lue : « d'après la carte grise ». */
const D_APRES: Record<NatureDocumentVehicule, string> = {
  carte_grise: "d’après la carte grise",
  assurance: "d’après l’assurance",
  controle_technique: "d’après le procès‑verbal",
};

export function dApres(nature: NatureDocumentVehicule): string {
  return D_APRES[nature];
}

/** « À ajouter : la carte grise, l'assurance. » — l'article se lit, il ne se devine pas. */
const AVEC_ARTICLE: Record<NatureDocumentVehicule, string> = {
  carte_grise: "la carte grise",
  assurance: "l’assurance",
  controle_technique: "le contrôle technique",
};

/** Les cases d'une fiche que le patron peut remplir ou corriger. */
export type ChampVehicule =
  | "nom"
  | "plaque"
  | "modele"
  | "ptacKg"
  | "genre"
  | "assureur"
  | "numeroContrat"
  | "assistance"
  | "controleTechniqueAvant"
  | "pollutionAvant"
  | "contreVisiteAvant";

export const CHAMPS_VEHICULE: readonly ChampVehicule[] = [
  "nom",
  "plaque",
  "modele",
  "ptacKg",
  "genre",
  "assureur",
  "numeroContrat",
  "assistance",
  "controleTechniqueAvant",
  "pollutionAvant",
  "contreVisiteAvant",
];

export const LIBELLE_CHAMP: Record<ChampVehicule, string> = {
  nom: "Nom",
  plaque: "Plaque",
  modele: "Marque et modèle",
  ptacKg: "Poids total (case F.2)",
  genre: "Genre (case J.1)",
  assureur: "Assureur",
  numeroContrat: "Numéro de contrat",
  assistance: "Assistance",
  controleTechniqueAvant: "Contrôle technique",
  pollutionAvant: "Contrôle pollution",
  contreVisiteAvant: "Contre‑visite",
};

export const CHAMPS_DATE: readonly ChampVehicule[] = ["controleTechniqueAvant", "pollutionAvant", "contreVisiteAvant"];

/**
 * D'où vient chaque case : le document qui l'a remplie.
 *
 * **Une case touchée à la main perd sa source** — c'est alors SA valeur qui
 * compte, et la mention « d'après la carte grise » mentirait.
 */
export type SourcesVehicule = Partial<Record<ChampVehicule, NatureDocumentVehicule>>;

export type ValeursVehicule = {
  nom: string;
  plaque: string | null;
  modele: string | null;
  ptacKg: number | null;
  genre: string | null;
  assureur: string | null;
  numeroContrat: string | null;
  assistance: string | null;
  controleTechniqueAvant: string | null;
  pollutionAvant: string | null;
  contreVisiteAvant: string | null;
};

// ─── LA PLAQUE ──────────────────────────────────────────────────────────────

/**
 * « gh 412pk » devient « GH-412-PK ». Une plaque d'avant 2009 (« 123 ABC 75 »)
 * reste telle qu'elle est écrite, en capitales : on ne la réécrit pas dans un
 * format qu'elle n'a pas.
 */
export function normaliserPlaque(brute: string): string {
  const serree = brute.toUpperCase().replace(/[^A-Z0-9]/g, "");
  const siv = /^([A-Z]{2})(\d{3})([A-Z]{2})$/.exec(serree);
  if (siv) return `${siv[1]}-${siv[2]}-${siv[3]}`;
  return brute.toUpperCase().replace(/\s+/g, " ").trim();
}

/**
 * Une plaque française, en SIV (« EH-467-GL ») ou d'avant 2009
 * (« 123 ABC 75 », « 4521 AB 2A », « 12 ABC 974 »). Le verso d'une carte
 * grise imprime son numéro de formule (« 2025EJ72653 ») juste au-dessus de
 * « (A) Numéro d'immatriculation » : pris pour une plaque, il faisait refuser
 * le papier comme celui d'un autre véhicule (20 octobre 2026).
 */
export function aLaFormeDUnePlaque(brute: string): boolean {
  const serree = brute.toUpperCase().replace(/[^A-Z0-9]/g, "");
  return /^[A-Z]{2}\d{3}[A-Z]{2}$/.test(serree) || /^\d{1,4}[A-Z]{1,3}(\d{2}|2A|2B|97\d)$/.test(serree);
}

/** Deux écritures de la même plaque se reconnaissent : tirets et espaces ne comptent pas. */
export function memePlaque(a: string, b: string): boolean {
  const serre = (s: string) => s.toUpperCase().replace(/[^A-Z0-9]/g, "");
  return serre(a) !== "" && serre(a) === serre(b);
}

// ─── UNE CASE CORRIGÉE À LA MAIN ────────────────────────────────────────────

/** Un jour qui existe : « 2026-02-31 » a la forme, il n'existe pas. */
export function estJourReel(iso: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(iso) && new Date(`${iso}T00:00:00Z`).toISOString().slice(0, 10) === iso;
}

/**
 * Ce qu'une case tapée à la main devient, ou pourquoi elle se refuse.
 *
 * **La même fonction sert à l'écran et au serveur** : le serveur revalide ce
 * que l'écran renvoie, avec la même règle (`CLAUDE.md` §3). Une case vidée vaut
 * `null` (le nom, lui, ne se vide pas : une liste de véhicules sans nom ne se
 * lit plus).
 */
export function valeurDuChamp(
  champ: ChampVehicule,
  brut: string
): { ok: true; valeur: string | number | null } | { ok: false; raison: string } {
  const texte = brut.replace(/\s+/g, " ").trim();
  if (champ === "nom") {
    if (texte === "") return { ok: false, raison: "Donnez un nom au véhicule, par exemple « Camion benne »." };
    return { ok: true, valeur: texte.slice(0, 60) };
  }
  if (texte === "") return { ok: true, valeur: null };
  if ((CHAMPS_DATE as readonly string[]).includes(champ)) {
    return estJourReel(texte) ? { ok: true, valeur: texte } : { ok: false, raison: "Cette date n’existe pas." };
  }
  if (champ === "ptacKg") {
    const kg = Number(texte.replace(/[^\d]/g, ""));
    // Un utilitaire léger pèse au moins 500 kg ; au-delà de 44 t, ce n'est plus
    // un véhicule qu'un paysagiste conduit. Hors de là, une frappe s'est glissée.
    if (!Number.isInteger(kg) || kg < 500 || kg > 44000) return { ok: false, raison: "Écrivez le poids en kilos, par exemple 3500." };
    return { ok: true, valeur: kg };
  }
  if (champ === "plaque") return { ok: true, valeur: normaliserPlaque(texte).slice(0, 20) };
  if (champ === "assistance") {
    if (!/^[+\d][\d\s.]{5,20}$/.test(texte)) return { ok: false, raison: "Écrivez un numéro de téléphone." };
    return { ok: true, valeur: texte };
  }
  return { ok: true, valeur: texte.slice(0, 120) };
}

/** Ce qu'une case montre : « 3 500 kg » plutôt que 3500, rien plutôt que null. */
export function valeurAffichee(champ: ChampVehicule, valeur: string | number | null): string {
  if (valeur === null) return "";
  if (champ === "ptacKg") return `${String(valeur).replace(/\B(?=(\d{3})+(?!\d))/g, " ")} kg`;
  return String(valeur);
}

// ─── CE QU'UN DOCUMENT LU REMPLIT ───────────────────────────────────────────

/** Ce que l'IA a lu sur un document (`document-vehicule-lu.ts`). */
export type LectureDocumentVehicule = {
  nature: NatureDocumentVehicule | null;
  plaque: string | null;
  modele: string | null;
  ptacKg: number | null;
  genre: string | null;
  assureur: string | null;
  numeroContrat: string | null;
  assistance: string | null;
  controleTechniqueAvant: string | null;
  pollutionAvant: string | null;
  contreVisiteAvant: string | null;
};

const CHAMPS_DE_LA_NATURE: Record<NatureDocumentVehicule, readonly ChampVehicule[]> = {
  // Les dates : case X.1 du recto, et vignettes du verso. Jamais la
  // contre-visite : une vignette barrée ne se distingue pas sûrement d'une
  // vignette en cours, et c'est le procès-verbal qui la porte.
  carte_grise: ["plaque", "modele", "ptacKg", "genre", "controleTechniqueAvant", "pollutionAvant"],
  assurance: ["assureur", "numeroContrat", "assistance"],
  controle_technique: ["controleTechniqueAvant", "pollutionAvant", "contreVisiteAvant"],
};

export type RangementDeLecture =
  /** Atlas ne sait pas ce qu'est ce papier : on le demande, on ne le devine pas. */
  | { statut: "inconnu" }
  /** Le papier porte une AUTRE plaque : rien ne se range. */
  | { statut: "autre-vehicule"; plaqueLue: string }
  | {
      statut: "range";
      nature: NatureDocumentVehicule;
      champs: Partial<Record<ChampVehicule, string | number | null>>;
    };

/**
 * Ce qu'une lecture remplit sur la fiche.
 *
 * **Un document d'une autre plaque ne se range JAMAIS** : un numéro de contrat
 * faux sur un constat coûte plus cher qu'une case vide. La plaque n'est
 * comparée que quand les deux sont connues — une carte grise lue sur un
 * véhicule neuf, c'est elle qui DONNE la plaque.
 *
 * **Seul ce qui a été lu s'écrit** : une case que le document ne porte pas
 * garde ce qu'elle avait. Une exception, et elle est voulue : un procès-verbal
 * sans contre-visite EFFACE la contre-visite d'avant — c'est qu'elle a été
 * passée, et son rappel ne doit pas survivre au papier qui la clôt.
 *
 * **Une carte grise ne recule jamais une échéance** déjà plus tardive.
 */
export function rangerLecture(
  connu: Pick<ValeursVehicule, "plaque" | "controleTechniqueAvant" | "pollutionAvant"> | null,
  lue: LectureDocumentVehicule | null
): RangementDeLecture {
  if (!lue || !lue.nature) return { statut: "inconnu" };
  const plaqueDuVehicule = connu?.plaque ?? null;
  if (plaqueDuVehicule && lue.plaque && !memePlaque(plaqueDuVehicule, lue.plaque)) {
    return { statut: "autre-vehicule", plaqueLue: normaliserPlaque(lue.plaque) };
  }
  const champs: Partial<Record<ChampVehicule, string | number | null>> = {};
  for (const champ of CHAMPS_DE_LA_NATURE[lue.nature]) {
    const v = lue[champ as keyof LectureDocumentVehicule];
    if (v !== null && v !== undefined) champs[champ] = champ === "plaque" ? normaliserPlaque(String(v)) : v;
  }
  if (lue.nature === "controle_technique" && (lue.controleTechniqueAvant || lue.pollutionAvant) && !lue.contreVisiteAvant) {
    champs.contreVisiteAvant = null;
  }
  if (lue.nature === "carte_grise" && !plaqueDuVehicule && lue.plaque) champs.plaque = normaliserPlaque(lue.plaque);
  // Une carte grise mêle des dates de plusieurs âges : le recto imprime celle
  // de son édition, les vignettes collées depuis la repoussent. Une échéance
  // de contrôle ne fait qu'avancer avec le temps : la plus tardive est la
  // plus récente, quel que soit l'ordre des photos.
  if (lue.nature === "carte_grise" && connu) {
    for (const champ of ["controleTechniqueAvant", "pollutionAvant"] as const) {
      const avant = connu[champ];
      const lu = champs[champ];
      if (avant && typeof lu === "string" && lu <= avant) delete champs[champ];
    }
  }
  return { statut: "range", nature: lue.nature, champs };
}

/** « Carte grise lue. 4 informations remplies, en doré. » */
export function phraseDeLecture(nature: NatureDocumentVehicule, remplies: number): string {
  const lu = { carte_grise: "Carte grise lue", assurance: "Assurance lue", controle_technique: "Contrôle technique lu" }[nature];
  if (remplies === 0) return `${lu}, mais aucune information ne s’y lit. Remplissez les cases à la main.`;
  return `${lu}. ${remplies} information${remplies > 1 ? "s" : ""} remplie${remplies > 1 ? "s" : ""}, en doré. Une erreur ? Touchez la case.`;
}

// ─── LES RAPPELS ────────────────────────────────────────────────────────────

/**
 * **Deux mois avant** : c'est la fenêtre où le passer ne fait perdre aucun
 * jour (le contrôle technique et le contrôle pollution des utilitaires, art.
 * R323-22). **Quinze jours avant**, le rappel passe en doré.
 */
export const RAPPEL_AVANT_JOURS = 60;
export const PROCHE_AVANT_JOURS = 15;

export type ControleVehicule = "controle_technique" | "pollution" | "contre_visite";

const CHAMP_DU_CONTROLE: Record<ControleVehicule, ChampVehicule> = {
  contre_visite: "contreVisiteAvant",
  controle_technique: "controleTechniqueAvant",
  pollution: "pollutionAvant",
};

export const NOM_CONTROLE: Record<ControleVehicule, string> = {
  controle_technique: "Contrôle technique",
  pollution: "Contrôle pollution",
  contre_visite: "Contre‑visite",
};

export type Echeance = { ton: "calme" | "proche" | "depasse"; texte: string; joursRestants: number };

function joursEntre(de: string, a: string): number {
  return Math.round((Date.parse(`${a}T00:00:00Z`) - Date.parse(`${de}T00:00:00Z`)) / 86_400_000);
}

/**
 * Où en est une date limite, ou `null` s'il est trop tôt pour en parler.
 *
 * **Une contre-visite se montre tout de suite** : elle n'a que deux mois, et le
 * procès-verbal qui la pose vient d'arriver.
 */
export function echeance(dateLimite: string | null, jour: string, toujours = false): Echeance | null {
  if (!dateLimite || !estJourReel(dateLimite)) return null;
  const reste = joursEntre(jour, dateLimite);
  if (reste > RAPPEL_AVANT_JOURS && !toujours) return null;
  if (reste < 0) {
    return { ton: "depasse", texte: `Dépassé depuis ${-reste} jour${-reste > 1 ? "s" : ""}`, joursRestants: reste };
  }
  if (reste <= PROCHE_AVANT_JOURS) {
    return {
      ton: "proche",
      texte: reste === 0 ? "Dernier jour aujourd’hui" : `Plus que ${reste} jour${reste > 1 ? "s" : ""}`,
      joursRestants: reste,
    };
  }
  return { ton: "calme", texte: "À passer dès maintenant", joursRestants: reste };
}

export type RappelVehicule = {
  vehiculeId: string;
  vehiculeNom: string;
  controle: ControleVehicule;
  avant: string;
  echeance: Echeance;
};

/** Les rappels de tous les véhicules, le plus pressé en haut. */
export function rappelsDesVehicules(
  vehicules: readonly ({ id: string } & Pick<ValeursVehicule, "nom" | ChampVehiculeDate>)[],
  jour: string
): RappelVehicule[] {
  const rappels: RappelVehicule[] = [];
  for (const v of vehicules) {
    for (const controle of ["contre_visite", "controle_technique", "pollution"] as const) {
      const avant = v[CHAMP_DU_CONTROLE[controle] as ChampVehiculeDate];
      const e = echeance(avant, jour, controle === "contre_visite");
      if (e && avant) rappels.push({ vehiculeId: v.id, vehiculeNom: v.nom, controle, avant, echeance: e });
    }
  }
  return rappels.sort((a, b) => a.avant.localeCompare(b.avant));
}

type ChampVehiculeDate = "controleTechniqueAvant" | "pollutionAvant" | "contreVisiteAvant";

/** « Avant le 30 novembre. À passer dès maintenant. » — sous un titre qui nomme déjà le contrôle. */
export function phraseDeLEcheance(r: Pick<RappelVehicule, "avant" | "echeance">): string {
  return `Avant le ${jourEtMois(r.avant)}. ${r.echeance.texte}.`;
}

/** Les papiers qui manquent encore à la fiche, dans l'ordre où on les ajoute. */
export function documentsManquants(presents: readonly NatureDocumentVehicule[]): string[] {
  return NATURES_DOCUMENT_VEHICULE.filter((n) => !presents.includes(n)).map((n) => AVEC_ARTICLE[n]);
}

// ─── LE FICHIER DÉPOSÉ ──────────────────────────────────────────────────────

/**
 * PDF, JPEG ou PNG. **Une photo de la photothèque d'iPhone arrive en JPEG** :
 * le navigateur la convertit quand l'écran ne demande que ces trois formats.
 */
export const FORMATS_DOCUMENT_VEHICULE = ["application/pdf", "image/jpeg", "image/png"] as const;
export const DOCUMENT_VEHICULE_MAX_OCTETS = 8 * 1024 * 1024;

/**
 * Le type d'un papier rangé, lu sur l'EXTENSION de sa clé — que le serveur a
 * posée —, jamais sur ce qu'un navigateur a déclaré. C'est la leçon de la
 * route des fichiers (audit du 23 août 2026, constat M1) : un type annoncé par
 * le client faisait servir un SVG porteur de script depuis notre domaine.
 * `null` : cette clé n'est pas un papier de véhicule.
 */
export function typeDuDocument(cle: string): (typeof FORMATS_DOCUMENT_VEHICULE)[number] | null {
  const ext = cle.toLowerCase().split(".").pop();
  if (ext === "pdf") return "application/pdf";
  if (ext === "jpg" || ext === "jpeg") return "image/jpeg";
  if (ext === "png") return "image/png";
  return null;
}

export function refusDuDocumentVehicule(mime: string, octets: number): string | null {
  if (!(FORMATS_DOCUMENT_VEHICULE as readonly string[]).includes(mime)) {
    return "Ce format ne se lit pas. Choisissez un PDF, ou une photo.";
  }
  if (octets === 0) return "Ce fichier est vide.";
  if (octets > DOCUMENT_VEHICULE_MAX_OCTETS) return "Ce fichier est trop lourd. Prenez-en un de moins de 8 Mo.";
  return null;
}
