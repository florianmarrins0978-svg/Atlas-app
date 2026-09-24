/**
 * Le mode d'emploi d'Atlas, écran par écran — ce que l'assistant récite.
 *
 * **Sa demande du 25 août 2026 :** *« j'aimerais que l'assistant qui se trouve
 * dans l'application puisse expliquer chaque fonctionnalité de l'appli. Si
 * l'utilisateur lui demande par exemple : comment je fais pour supprimer un
 * client en attente de rédaction de son devis sur la page chantier, qu'il soit
 * en mesure de lui répondre : slide de droite à gauche puis appuie sur
 * retire. »*
 *
 * **Pourquoi une liste écrite, et pas un modèle qui devine.** Un modèle de
 * langage qui n'a pas l'écran sous les yeux invente un geste plausible — « allez
 * dans les réglages, puis Supprimer » —, et l'artisan le cherche pendant cinq
 * minutes avant de conclure que l'application est cassée. Un geste faux coûte
 * plus cher qu'un « je ne sais pas » : c'est la même règle que les prix
 * (`CLAUDE.md` §4). Ici, l'assistant ne récite QUE ce qui est écrit dans ce
 * fichier, et refuse quand il n'y trouve rien.
 *
 * **Et une fiche se PROUVE contre le code.** Chacune porte son fichier source et
 * des `preuves` : des morceaux de texte qui doivent s'y trouver. Le jour où le
 * bouton « Retirer » change de nom ou disparaît, `scripts/test-mode-emploi.ts`
 * rougit — plutôt que de laisser l'assistant enseigner un geste qui n'existe
 * plus. Une documentation périmée est pire qu'absente : on s'y fie encore
 * (`CLAUDE.md` §1).
 *
 * **Ce qui n'entre pas ici :** les données d'un chantier (les outils de lecture
 * s'en chargent), et nos raisons de conception — l'écran n'a pas besoin de
 * savoir pourquoi le glissement a remplacé la corbeille rouge.
 */

import { FICHES_LIEUX } from "./fiches-mode-emploi/lieux";
import { FICHES_CHANTIER } from "./fiches-mode-emploi/chantier";
import { FICHES_DEVIS } from "./fiches-mode-emploi/devis";
import { FICHES_FACTURE } from "./fiches-mode-emploi/facture";
import { FICHES_PLANNING } from "./fiches-mode-emploi/planning";
import { FICHES_PAYSAGE } from "./fiches-mode-emploi/paysage";
import { FICHES_REGLAGES } from "./fiches-mode-emploi/reglages";

export type FicheModeEmploi = {
  /** Stable : il sert au diagnostic et aux suites. */
  id: string;
  /** L'écran, dit comme il s'appelle à l'écran : « Chantiers », « Planning ». */
  ecran: string;
  /** Où l'on est, en une ligne — de quoi s'y rendre sans chercher. */
  ou: string;
  /** Ce qu'on cherche à faire : « Retirer un chantier de la liste ». */
  intitule: string;
  /**
   * Les mots par lesquels il le demandera — les siens, pas les nôtres.
   * « supprimer » et « enlever » valent « retirer » : c'est ce qu'il tape.
   */
  motsCles: string[];
  /** LE GESTE, à l'impératif, sans un mot de trop. C'est la réponse. */
  geste: string;
  /** Ce que le geste refuse, quand il refuse. Vide sinon. */
  reserve?: string;
  /** Le fichier qui porte ce geste — c'est lui qui fait foi. */
  source: string;
  /** Ce qui doit se trouver dans `source` pour que la fiche reste vraie. */
  preuves: string[];
  /**
   * Les autres fichiers que le geste traverse. « Chantiers, Vos clients, son
   * nom, onglet Factures » passe par trois écrans : chacun doit tenir sa part,
   * sinon le chemin se casse à l'étape que personne ne regarde.
   */
  ailleurs?: { source: string; preuves: string[] }[];
  /**
   * Ce qui ne doit se trouver NULLE PART dans `src/`. Sert aux fiches qui
   * disent « Atlas ne le fait pas encore » : le jour où l'écran arrive, le
   * contrôle rougit, et la fiche se récrit au lieu de mentir.
   */
  absences?: string[];
  /**
   * La fiche dit OÙ se trouve une chose, pas comment la faire. Une question en
   * « où » la préfère : « où sont mes factures » attend l'endroit où elles
   * sont rangées, pas le geste qui en crée une.
   */
  lieu?: true;
};

/**
 * Toutes les fiches, une zone par fichier : un écran se retrouve dans le
 * fichier qui porte son nom, et deux sessions qui touchent deux zones ne se
 * marchent plus dessus.
 */
export const FICHES_MODE_EMPLOI: FicheModeEmploi[] = [
  ...FICHES_LIEUX,
  ...FICHES_CHANTIER,
  ...FICHES_DEVIS,
  ...FICHES_FACTURE,
  ...FICHES_PLANNING,
  ...FICHES_PAYSAGE,
  ...FICHES_REGLAGES,
];

// --- La recherche ---------------------------------------------------------

/**
 * Les mots qui ne discriminent rien.
 *
 * **Sans eux, tout ressort.** « comment je fais pour supprimer un client » —
 * « pour », « un », « je » sont dans la moitié des fiches, et le classement se
 * décide alors sur du bruit plutôt que sur « supprimer » et « client ».
 */
//
// **« sans » n'y est plus** (24 septembre 2026) : « une facture sans devis »,
// « la feuille sans les prix » — il porte la moitié de la question.
const MOTS_VIDES = new Set([
  "je", "j", "tu", "il", "on", "me", "moi", "mon", "ma", "mes", "le", "la", "les", "l", "un", "une", "des", "du", "de",
  "d", "et", "ou", "a", "au", "aux", "en", "y", "que", "qui", "quoi", "est", "ce", "cet", "cette", "ces", "se", "sur",
  "dans", "pour", "avec", "par", "pas", "plus", "faire", "fais", "fait", "peux", "puis", "veux", "vais",
  "comment", "où", "quand", "pourquoi", "est-ce", "s", "si", "son", "sa", "ses", "leur", "nous", "vous", "ils",
  "app", "appli", "application", "atlas", "page", "ecran",
]);

/** Sans accents, sans ponctuation, en minuscules — il tape comme il parle. */
export function normaliser(texte: string): string {
  return texte
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function motsUtiles(texte: string): string[] {
  return normaliser(texte)
    .split(" ")
    .filter((m) => m.length > 1 && !MOTS_VIDES.has(m));
}

/**
 * Un mot de la question est-il dans cet ensemble ?
 *
 * **Par PRÉFIXE au-delà de quatre lettres**, et c'est ce qui rend la recherche
 * utilisable : il tape « facture » là où la fiche dit « facturer », « supprimer »
 * là où elle dit « supprime ». Sans cela, la bonne fiche existait et ne sortait
 * pas. Quatre lettres, parce qu'en dessous les faux voisins abondent (« mot » et
 * « moteur »).
 */
function contient(ensemble: Set<string>, mot: string): boolean {
  if (ensemble.has(mot)) return true;
  if (mot.length < 4) return false;
  for (const candidat of ensemble) {
    if (candidat.length >= 4 && (candidat.startsWith(mot) || mot.startsWith(candidat))) return true;
    if (memeRacine(candidat, mot)) return true;
  }
  return false;
}

/**
 * Deux formes d'un même verbe : « transmets » et « transmettre », « envoyées »
 * et « envoyer ». Le préfixe seul ne les voyait pas (aucun n'est le début de
 * l'autre), et « comment je transmets la fiche » ne trouvait pas la fiche qui
 * transmet. Il faut au moins cinq lettres communes, et que seule la fin
 * diffère (deux lettres de plus que le plus court, au plus) : « planning » et
 * « planifier » ne partagent que « plan », et restent deux mots.
 */
function memeRacine(a: string, b: string): boolean {
  const court = Math.min(a.length, b.length);
  if (court < 6) return false;
  let commun = 0;
  while (commun < court && a[commun] === b[commun]) commun++;
  return commun >= Math.max(5, court - 2);
}

/**
 * Le score d'une fiche pour une question.
 *
 * **Les mots-clés pèsent plus que le geste**, et c'est délibéré : ils sont
 * choisis pour être ce qu'il tape, tandis que le geste contient des mots de
 * liaison qui apparaissent partout (« appuyez », « écran »).
 *
 * **Les trois sources s'AJOUTENT.** Elles s'excluaient, et deux fiches
 * concurrentes tombaient alors à égalité sur leur seul mot-clé commun — le
 * départage se faisait par ordre alphabétique, c'est-à-dire au hasard :
 * « comment on fait une facture » sortait la fiche des clients avant celle qui
 * facture. Un mot qui est à la fois dans les mots-clés ET dans l'intitulé
 * désigne une fiche plus précisément qu'un mot qui n'est que dans l'un des deux.
 */
function score(
  fiche: FicheModeEmploi,
  mots: string[]
): { points: number; poids: number; motsTrouves: number } {
  const cles = new Set(fiche.motsCles.flatMap((m) => motsUtiles(m)));
  const titre = new Set(motsUtiles(`${fiche.intitule} ${fiche.ecran}`));
  const corps = new Set(motsUtiles(`${fiche.geste} ${fiche.ou} ${fiche.reserve ?? ""}`));

  let points = 0;
  let poids = 0;
  let motsTrouves = 0;
  for (const mot of new Set(mots)) {
    let gain = 0;
    let exact = 0;
    if (contient(cles, mot)) {
      gain += 3;
      if (cles.has(mot)) exact += 3;
    }
    if (contient(titre, mot)) {
      gain += 2;
      if (titre.has(mot)) exact += 2;
    }
    if (contient(corps, mot)) gain += 1;
    if (gain > 0) {
      points += gain;
      // **Le mot exact passe devant sa forme voisine** : à « comment on fait
      // une facture », la fiche qui porte « facture » répond mieux que celle
      // qui ne porte que « facturer ». Sans cela, l'égalité se tranchait par
      // ordre alphabétique, c'est-à-dire au hasard.
      poids += (gain + exact * 0.25) * rarete(mot);
      motsTrouves++;
    }
  }
  return { points, poids, motsTrouves };
}

/**
 * Ce que vaut un mot pour DÉPARTAGER : un mot rare désigne, un mot courant ne
 * fait que confirmer.
 *
 * **Payé le 24 septembre 2026**, en passant de quatre-vingts fiches à plus de
 * trois cents. « Client », « devis », « facture » sont dans les mots-clés de
 * dizaines de fiches ; « comment je note un acompte sur la facture » sortait
 * alors la fiche qui avait le plus de mots COURANTS, pas celle qui porte
 * « acompte ». Un mot présent dans une fiche sur trois ne dit presque rien de
 * la question ; un mot présent dans deux fiches la désigne.
 *
 * Le poids ne sert qu'au CLASSEMENT. Le seuil (au moins trois points, deux
 * mots communs) reste compté sans lui : ce qui ne répondait pas ne se met pas
 * à répondre, et le refus garde sa valeur.
 */
function rarete(mot: string): number {
  const presence = FREQUENCES.get(mot) ?? frequence(mot);
  return 1 / (1 + Math.log2(1 + presence / 3));
}

const FREQUENCES = new Map<string, number>();
function frequence(mot: string): number {
  let n = 0;
  for (const fiche of FICHES_MODE_EMPLOI) {
    if (contient(new Set(fiche.motsCles.flatMap((m) => motsUtiles(m))), mot)) n++;
  }
  FREQUENCES.set(mot, n);
  return n;
}

/**
 * La question demande-t-elle un ENDROIT ?
 *
 * « où » est un mot vide pour le score (il est dans toutes les questions de
 * lieu, il ne départage rien entre elles) ; il dit pourtant CE QU'ON ATTEND.
 * Lu sur la question brute : sans accent, « ou » veut aussi dire « ou bien ».
 * « Je trouve pas le bouton pour envoyer » n'en est PAS une : il cherche un
 * geste, et « trouve » y faisait gagner l'endroit où dorment les devis.
 */
function chercheUnLieu(question: string): boolean {
  return /(^|[^a-zà-ÿ])où([^a-zà-ÿ]|$)|\brang[eé]/i.test(question);
}

/**
 * Les fiches qui répondent à une question, la meilleure d'abord.
 *
 * **Rend un tableau VIDE plutôt qu'une fiche au hasard.** C'est tout l'intérêt :
 * l'assistant doit pouvoir dire « je ne sais pas » (le service le lui impose),
 * et il ne le peut que si la recherche sait ne rien trouver.
 *
 * **DEUX mots communs, pas un.** « Quel temps fait-il ? » partageait « temps »
 * avec la fiche de la durée d'un chantier, et sortait donc une réponse à une
 * question qui n'en était pas une. Un seul mot commun ne fait pas une réponse —
 * et une réponse qui parle à tort s'apprend à être ignorée, ce qui coûte le
 * garde-fou entier. La règle se relâche pour les questions de deux mots
 * (« mode sombre ? »), où il n'y a rien de plus à partager.
 */
export function chercherFiches(question: string, maximum = 3): FicheModeEmploi[] {
  const mots = motsUtiles(question);
  if (mots.length === 0) return [];
  const exigeDeuxMots = mots.length >= 3;
  const lieu = chercheUnLieu(question);
  return FICHES_MODE_EMPLOI.map((fiche) => ({ fiche, ...score(fiche, mots) }))
    .filter((c) => c.points >= 3 && (!exigeDeuxMots || c.motsTrouves >= 2))
    // **Le bonus vient APRÈS le seuil** : il départage des fiches qui
    // répondent déjà, il ne fait jamais entrer une fiche qui ne répond pas.
    .map((c) => ({ ...c, poids: c.poids + (lieu && c.fiche.lieu ? 2 : 0) }))
    .sort((a, b) => b.poids - a.poids || a.fiche.id.localeCompare(b.fiche.id))
    .slice(0, maximum)
    .map((c) => c.fiche);
}

/**
 * Une fiche par son identifiant, ou rien.
 *
 * C'est la seconde porte de l'outil : quand les mots de la question ne
 * rencontrent aucun mot-clé (« la touche pour… », « c'est rangé où »), le
 * modèle lit le sommaire, reconnaît la fiche, et la redemande ici. Le geste
 * récité reste celui de la fiche ; seul le choix change de main.
 */
export function ficheParId(id: string): FicheModeEmploi | null {
  return FICHES_MODE_EMPLOI.find((f) => f.id === id) ?? null;
}
