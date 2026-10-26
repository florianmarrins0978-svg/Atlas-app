import type { NatureAchat } from "./achat-tva";
import { enCentimes } from "./rapprochement-bancaire";
import { enEuros } from "./euros";
import { jourIso } from "./jour";

/**
 * POUR MON COMPTABLE — les règles pures du dossier : quelle pièce justifie
 * quelle ligne du relevé, de quelle couleur elle est, et ce qu'il manque.
 *
 * Sa demande du 23 octobre 2026, ses choix du 23 et du 24 sur
 * `appli/pour-mon-comptable.html` (`TODO.md`, « Pour mon comptable »).
 * Aucune base ici : les dépôts lisent, ces fonctions décident, les écrans
 * montrent (`CLAUDE.md` §3).
 */

// ─── Ce qui justifie une ligne ───────────────────────────────────────────────

/**
 * Comment une ligne du relevé est justifiée.
 *
 *   · `ticket` : un ticket photographié lui est relié ;
 *   · `facture` : une facture de fournisseur lui est reliée ;
 *   · `ticket_perdu` : le patron a validé la ligne sans pièce. Sa TVA ne se
 *     déduit pas, et l'écran l'a dit avant qu'il valide ;
 *   · `motif` : un virement qui n'appelle pas de facture (un salaire, un
 *     loyer, des cotisations, un remboursement reçu…), dont il a dit la nature ;
 *   · `facture_hors_atlas` : un virement reçu qui paie une facture faite hors
 *     d'Atlas, photographiée ou jointe en PDF (migration 0148).
 *
 * Une entrée se justifie aussi par la facture d'Atlas qu'il a confirmée
 * (`virements_recus`), sur l'accueil ou dans sa carte du dossier : celle-là
 * ne s'écrit pas ici, elle se lit dans le virement confirmé.
 */
export type Justification = "ticket" | "facture" | "ticket_perdu" | "motif" | "facture_hors_atlas";

export type Sens = "entree" | "sortie";

/** Les natures d'un virement ENVOYÉ qui n'appelle pas de facture — ses mots, sur la planche. */
export const MOTIFS_VIREMENT = ["fournisseur", "salaire", "loyer", "impots", "pret", "perso"] as const;
export type MotifVirement = (typeof MOTIFS_VIREMENT)[number];

/**
 * Les natures d'un virement REÇU qu'aucune facture d'Atlas n'explique. Ses
 * choix du 25 octobre 2026 sur `appli/soignee/termines-comptable.html` : sans
 * elles, l'accueil ne posait aucune question (`questionsDesVirements` ne garde
 * que les virements qu'une facture explique) et le dossier ne s'arrêtait plus.
 */
export const MOTIFS_RECUS = ["remboursement", "perso", "pret", "aide", "entre_comptes"] as const;
export type MotifRecu = (typeof MOTIFS_RECUS)[number];

export type Motif = MotifVirement | MotifRecu;

const LIBELLE_ENVOYE: Record<MotifVirement, string> = {
  fournisseur: "Un fournisseur",
  salaire: "Un salaire",
  loyer: "Un loyer",
  impots: "Impôts, cotisations",
  pret: "Un prêt",
  perso: "Pour moi",
};

const LIBELLE_RECU: Record<MotifRecu, string> = {
  remboursement: "Un remboursement",
  perso: "Mon argent perso",
  pret: "Un prêt",
  aide: "Une aide, une subvention",
  entre_comptes: "Entre mes comptes",
};

/** Les réponses qu'une ligne propose, selon qu'elle entre ou qu'elle sort. */
export function motifsDuSens(sens: Sens): readonly Motif[] {
  return sens === "entree" ? MOTIFS_RECUS : MOTIFS_VIREMENT;
}

/**
 * Le mot d'une réponse. `perso` se dit « Pour moi » sur ce qui sort et « Mon
 * argent perso » sur ce qui entre : la même valeur en base, deux gestes.
 */
export function libelleMotif(m: Motif, sens: Sens): string {
  if (sens === "entree") return (LIBELLE_RECU as Record<string, string>)[m] ?? m;
  return (LIBELLE_ENVOYE as Record<string, string>)[m] ?? m;
}

/** Une réponse permise pour ce sens. Un salaire ne s'écrit pas sur ce qui entre. */
export function estMotif(v: unknown, sens: Sens): v is Motif {
  return typeof v === "string" && (motifsDuSens(sens) as readonly string[]).includes(v);
}

// ─── Le montant de la pièce contre celui de la ligne ─────────────────────────

/**
 * Ce qu'une pièce dit du montant de sa ligne. **Au centime**, comme le Check
 * up : 62,04 € ne justifie pas 62,40 €.
 *
 * `inconnu` quand l'un des deux ne se lit pas (un ticket dont la lecture n'a
 * pas rendu de total) : ne pas savoir n'est pas un écart, et ne se signale pas
 * comme tel.
 */
export type Ecart = { genre: "juste" } | { genre: "inconnu" } | { genre: "ecart"; ligne: number; piece: number };

export function ecartDeMontant(ligne: string, piece: string | null): Ecart {
  const l = enCentimes(ligne);
  const p = piece === null ? null : enCentimes(piece);
  if (l === null || p === null) return { genre: "inconnu" };
  return l === p ? { genre: "juste" } : { genre: "ecart", ligne: l, piece: p };
}

const euros = (centimes: number) => enEuros(centimes / 100);

/**
 * L'écart en une phrase, sur la carte, avant qu'il joigne quand même. Sur ce
 * qui entre, une facture plus grande que le virement est presque toujours un
 * paiement en partie : la phrase le dit tel quel.
 */
export function ecartEnMots(e: { ligne: number; piece: number }, sens: Sens): string {
  const diff = Math.abs(e.piece - e.ligne);
  if (sens === "entree") {
    return e.piece > e.ligne ? `Ce virement en paie une partie, il restera ${euros(diff)}.` : `Le virement dépasse la facture de ${euros(diff)}.`;
  }
  return e.piece < e.ligne ? `Il manque une pièce de ${euros(diff)}.` : `La pièce dépasse la ligne de ${euros(diff)}.`;
}

/**
 * Ce qui suit le nom de la pièce, partout où elle s'écrit : le relevé, le
 * dossier et la page du comptable. Une pièce jointe malgré l'écart le porte
 * pour toujours, et c'est ce qui permet de la joindre quand même.
 */
export function suiteDeLaPiece(e: Ecart, sens: Sens): string {
  if (e.genre !== "ecart") return "";
  if (sens === "entree" && e.piece > e.ligne) return ", payée en partie";
  return ` de ${euros(e.piece)}, pas le montant`;
}

/** Les pièces du montant de la ligne d'abord : c'est presque toujours l'une d'elles. */
export function justesDAbord<T>(pieces: readonly T[], ligne: string, montantDe: (p: T) => string | null): T[] {
  const juste = (p: T) => ecartDeMontant(ligne, montantDe(p)).genre === "juste";
  return [...pieces.filter(juste), ...pieces.filter((p) => !juste(p))];
}

// ─── La couleur d'une ligne ──────────────────────────────────────────────────

/**
 * La catégorie qui donne sa couleur à une ligne. Les six natures d'un achat,
 * plus `virement` (un virement envoyé) et `recu` (un virement reçu).
 * Ses couleurs, gardées le 23 octobre, vivent avec les autres jetons de couleur.
 */
export type Categorie = NatureAchat | "virement" | "recu";

/**
 * Un virement ou un prélèvement, lu sur le libellé de la banque.
 *
 * **Ce n'est qu'une couleur et une phrase**, jamais une décision : une ligne
 * prise à tort pour un virement demande quand même sa pièce.
 */
export function ressembleAUnVirement(libelle: string): boolean {
  return /^\s*(VIR|VIREMENT|PRLV|PRELEVEMENT|PRÉLÈVEMENT)\b/i.test(libelle);
}

export type LignePourCategorie = {
  sens: Sens;
  libelle: string;
  /** La nature du ticket relié, s'il y en a un et qu'elle est connue. */
  natureDuTicket: NatureAchat | null;
  justification: Justification | null;
};

/**
 * La couleur vient de la PIÈCE, pas du libellé : un ticket de carburant fait
 * une ligne bleue, quoi que la banque écrive. Sans pièce, un virement se voit
 * comme tel, et le reste est « autre » jusqu'à ce qu'un ticket arrive :
 * aucune catégorie ne se devine (`docs/AGENT.md` §3).
 */
export function categorieDeLaLigne(l: LignePourCategorie): Categorie {
  if (l.sens === "entree") return "recu";
  if (l.justification === "ticket" && l.natureDuTicket) return l.natureDuTicket;
  if (l.justification === "facture" || l.justification === "motif") return "virement";
  if (ressembleAUnVirement(l.libelle)) return "virement";
  return "autre";
}

// ─── Le Check up ─────────────────────────────────────────────────────────────

/** Une sortie qui attend sa pièce. */
export type SortieAJustifier = { id: string; jour: string; montant: string };

/** Un ticket photographié qui n'est encore relié à aucune ligne. */
export type TicketLibre = { id: string; dateAchat: string; totalTtc: string | null };

/**
 * Ce que le Check up rend pour une ligne :
 *   · `relie` : un seul ticket tombe juste, Atlas le relie seul (défaisable) ;
 *   · `choix` : plusieurs tickets possibles, le patron choisit ;
 *   · `aucun` : rien ne correspond, le patron répond (photo, facture, perdu).
 */
export type Verdict = { genre: "relie"; ticketId: string } | { genre: "choix"; ticketIds: string[] } | { genre: "aucun" };

/**
 * Combien de jours un ticket peut précéder la ligne de la banque. Une carte
 * bancaire passe souvent deux ou trois jours après l'achat ; cinq laissent la
 * marge d'un week-end. Un ticket daté APRÈS la ligne ne la justifie jamais.
 */
export const JOURS_AVANT_LA_BANQUE = 5;

function joursEntre(avant: string, apres: string): number {
  const a = Date.UTC(+avant.slice(0, 4), +avant.slice(5, 7) - 1, +avant.slice(8, 10));
  const b = Date.UTC(+apres.slice(0, 4), +apres.slice(5, 7) - 1, +apres.slice(8, 10));
  return Math.round((b - a) / 86_400_000);
}

/**
 * Pour chaque sortie, le ticket qui la justifie.
 *
 * **Le montant au centime, et rien d'approchant** : 62,40 € ne justifie pas
 * 62,04 €. Un ticket sans total lu ne se relie jamais seul.
 *
 * **Un ticket que DEUX lignes pourraient prendre n'est relié à aucune seule** :
 * deux pleins du même montant la même semaine, et Atlas relierait au hasard.
 * Les deux lignes passent alors en `choix`, et c'est le patron qui tranche.
 * C'est sa réponse du 23 octobre : « un seul tombe juste, il relie ; deux, il
 * demande ; aucun, il prévient ».
 */
export function checkUp(sorties: readonly SortieAJustifier[], tickets: readonly TicketLibre[]): Map<string, Verdict> {
  const candidats = new Map<string, string[]>();
  const pretendants = new Map<string, number>();
  for (const s of sorties) {
    const c = enCentimes(s.montant);
    const ids = tickets
      .filter((t) => {
        if (c === null || t.totalTtc === null) return false;
        if (enCentimes(t.totalTtc) !== c) return false;
        const ecart = joursEntre(t.dateAchat, s.jour);
        return ecart >= 0 && ecart <= JOURS_AVANT_LA_BANQUE;
      })
      .map((t) => t.id);
    candidats.set(s.id, ids);
    for (const id of ids) pretendants.set(id, (pretendants.get(id) ?? 0) + 1);
  }
  const verdicts = new Map<string, Verdict>();
  for (const s of sorties) {
    const ids = candidats.get(s.id) ?? [];
    if (ids.length === 1 && pretendants.get(ids[0]) === 1) verdicts.set(s.id, { genre: "relie", ticketId: ids[0] });
    else if (ids.length > 0) verdicts.set(s.id, { genre: "choix", ticketIds: ids });
    else verdicts.set(s.id, { genre: "aucun" });
  }
  return verdicts;
}

// ─── Les périodes ────────────────────────────────────────────────────────────

export type LigneDuDossier = {
  jour: string;
  montant: string;
  sens: "entree" | "sortie";
  categorie: Categorie;
  /** Vrai quand la ligne attend encore sa pièce. */
  aJustifier: boolean;
  ticketPerdu: boolean;
};

export type ResumePeriode = {
  /** « 2026-10 », « 2026-T4 » ou « 2026 ». */
  cle: string;
  sorties: number;
  entrees: number;
  aJustifier: number;
  ticketsPerdus: number;
  /** Les sorties par catégorie, en centimes, pour la barre de couleurs. */
  parCategorie: Partial<Record<Categorie, number>>;
};

export type Decoupage = "mois" | "trimestre" | "annee";

/** La clé de la période d'un jour : « 2026-10 », « 2026-T4 », « 2026 ». */
export function clePeriode(jour: string, d: Decoupage): string {
  const annee = jour.slice(0, 4);
  if (d === "annee") return annee;
  if (d === "mois") return jour.slice(0, 7);
  return `${annee}-T${Math.floor((Number(jour.slice(5, 7)) - 1) / 3) + 1}`;
}

/**
 * Les totaux par période, la plus récente d'abord. **En centimes** : une
 * somme de « 62.40 » en nombres à virgule finit par écrire 4 862,3000001.
 */
export function resumerPeriodes(lignes: readonly LigneDuDossier[], d: Decoupage): ResumePeriode[] {
  const parCle = new Map<string, ResumePeriode>();
  for (const l of lignes) {
    const cle = clePeriode(l.jour, d);
    const r = parCle.get(cle) ?? { cle, sorties: 0, entrees: 0, aJustifier: 0, ticketsPerdus: 0, parCategorie: {} };
    const c = enCentimes(l.montant) ?? 0;
    if (l.sens === "entree") r.entrees += c;
    else {
      r.sorties += c;
      r.parCategorie[l.categorie] = (r.parCategorie[l.categorie] ?? 0) + c;
    }
    if (l.aJustifier) r.aJustifier += 1;
    if (l.ticketPerdu) r.ticketsPerdus += 1;
    parCle.set(cle, r);
  }
  return [...parCle.values()].sort((a, b) => b.cle.localeCompare(a.cle));
}

/** La phrase d'état d'une période, celle de la planche. */
export function etatDeLaPeriode(r: Pick<ResumePeriode, "aJustifier" | "ticketsPerdus">): string {
  if (r.aJustifier > 0) return `${r.aJustifier} sans ticket`;
  if (r.ticketsPerdus === 1) return "Tout est justifié, 1 ticket perdu";
  if (r.ticketsPerdus > 1) return `Tout est justifié, ${r.ticketsPerdus} tickets perdus`;
  return "Tout est justifié";
}

const MOIS = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];
const DERNIER_JOUR = (annee: number, mois: number) => new Date(Date.UTC(annee, mois, 0)).getUTCDate();
const deux = (n: number) => String(n).padStart(2, "0");

/**
 * Les deux jours compris d'une période, à partir de sa clé (« 2026-10 »,
 * « 2026-T4 », « 2026 »). `null` pour une clé qui ne se lit pas : une adresse
 * tapée à la main ne doit pas ouvrir un relevé au hasard.
 */
export function bornesDePeriode(cle: string): { du: string; au: string } | null {
  let m = /^(\d{4})-(\d{2})$/.exec(cle);
  if (m) {
    const a = Number(m[1]);
    const mo = Number(m[2]);
    if (mo < 1 || mo > 12) return null;
    return { du: `${a}-${deux(mo)}-01`, au: `${a}-${deux(mo)}-${deux(DERNIER_JOUR(a, mo))}` };
  }
  m = /^(\d{4})-T([1-4])$/.exec(cle);
  if (m) {
    const a = Number(m[1]);
    const debut = (Number(m[2]) - 1) * 3 + 1;
    return { du: `${a}-${deux(debut)}-01`, au: `${a}-${deux(debut + 2)}-${deux(DERNIER_JOUR(a, debut + 2))}` };
  }
  m = /^(\d{4})$/.exec(cle);
  if (m) return { du: `${m[1]}-01-01`, au: `${m[1]}-12-31` };
  return null;
}

/** « Octobre 2026 », « 4ᵉ trimestre 2026 », « 2026 ». */
export function libellePeriode(cle: string): string {
  let m = /^(\d{4})-(\d{2})$/.exec(cle);
  if (m) {
    const nom = MOIS[Number(m[2]) - 1] ?? "";
    return `${nom.charAt(0).toUpperCase()}${nom.slice(1)} ${m[1]}`;
  }
  m = /^(\d{4})-T([1-4])$/.exec(cle);
  if (m) return `${m[2] === "1" ? "1ᵉʳ" : `${m[2]}ᵉ`} trimestre ${m[1]}`;
  return cle;
}

/** Le jour en mots courts, comme sur la planche : « 14 octobre ». */
export function jourEnMots(jour: string): string {
  const j = Number(jour.slice(8, 10));
  return `${j === 1 ? "1ᵉʳ" : j} ${MOIS[Number(jour.slice(5, 7)) - 1] ?? ""}`;
}

// ─── Le dossier en cours, son arrêt, sa garde ────────────────────────────────

/** Le jour d'après, au format `AAAA-MM-JJ`. */
export function lendemain(jour: string): string {
  const d = new Date(`${jour}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

/**
 * La période du dossier en cours : du lendemain du dernier dossier arrêté
 * jusqu'à aujourd'hui. Sans dossier arrêté, du 1ᵉʳ janvier de l'année : c'est
 * la date que propose le premier arrêt, et il la change s'il veut.
 *
 * Sa règle du 24 octobre 2026 : *« l'utilisateur décide quand il veut
 * l'arrêter, avec une touche »*. Son exercice peut tomber à n'importe quelle
 * date ; le suivant commence le lendemain, tout seul.
 */
export function periodeDuDossierEnCours(maintenant: Date, dernierAu: string | null): { du: string; au: string } {
  // Le jour du PATRON, pas celui de Greenwich : à minuit et demi le 1er janvier,
  // le dossier en cours est déjà celui de la nouvelle année.
  const au = jourIso(maintenant);
  return { du: dernierAu ? lendemain(dernierAu) : `${au.slice(0, 4)}-01-01`, au };
}

/**
 * Pourquoi un arrêt est refusé, ou `null`. Les lignes qui attendent encore
 * leur pièce se comptent à part, sur la base : celle-ci ne regarde que les
 * dates.
 */
export function refusDArret(a: { du: string; au: string; aujourdhui: string }): string | null {
  const jour = /^\d{4}-\d{2}-\d{2}$/;
  if (!jour.test(a.du) || !jour.test(a.au)) return "La date n'est pas lisible.";
  if (a.au < a.du) return "La date d'arrêt est avant le début du dossier.";
  if (a.au > a.aujourdhui) return "Un dossier ne s'arrête pas à une date qui n'est pas encore passée.";
  return null;
}

/**
 * Jusqu'à quand le dossier est gardé : dix ans après la fin de l'exercice
 * (Code de commerce, art. L123-22). Un 29 février devient le 28.
 */
export function gardeJusquAu(au: string): string {
  const annee = Number(au.slice(0, 4)) + 10;
  const mmjj = au.slice(5) === "02-29" ? "02-28" : au.slice(5);
  return `${annee}-${mmjj}`;
}

/** Combien de jours avant son effacement un dossier est annoncé : trois mois. */
export const PREVENIR_JOURS_AVANT = 92;

/** Le dossier arrive-t-il au bout de ses dix ans ? Sa demande du 24 octobre : prévenir avant. */
export function echeanceProche(garde: string, aujourdhui: string): boolean {
  const ecart = (Date.UTC(+garde.slice(0, 4), +garde.slice(5, 7) - 1, +garde.slice(8, 10)) - Date.UTC(+aujourdhui.slice(0, 4), +aujourdhui.slice(5, 7) - 1, +aujourdhui.slice(8, 10))) / 86_400_000;
  return ecart >= 0 && ecart <= PREVENIR_JOURS_AVANT;
}

/**
 * La taille d'un fichier, lisible : « 0 Mo » pour un dossier de quarante
 * kilo-octets laisserait croire qu'il est vide.
 */
export function tailleLisible(octets: number): string {
  if (octets < 1_000_000) return `${Math.max(1, Math.round(octets / 1000))} Ko`;
  return `${(octets / 1_000_000).toLocaleString("fr-FR", { maximumFractionDigits: 1 })} Mo`;
}

/** « 1ᵉʳ janvier 2026 » : le jour avec son année, pour le nom d'un dossier. */
export function jourComplet(jour: string): string {
  return `${jourEnMots(jour)} ${jour.slice(0, 4)}`;
}

// ─── Lot 4 : le comptable vérifie, par un lien privé ─────────────────────────

/** Combien de temps vit le lien donné au comptable : le temps d'un bilan, large. */
export const VALIDITE_LIEN_COMPTABLE_JOURS = 365;

export type VerdictDuComptable = "valide" | "rejete";

/** Ce que la ligne montre au comptable, et au patron. */
export type EtatDeVerification =
  | { etat: "a_verifier" }
  | { etat: "valide" }
  | { etat: "rejete"; note: string | null; avaitValide: boolean }
  /** Rejetée, puis justifiée à nouveau par le patron : à revoir. */
  | { etat: "corrigee"; note: string | null };

/**
 * Le verdict qui TIENT. Il se rapporte à la justification de la ligne au
 * moment où il a été posé : si le patron l'a changée depuis (il a relié un
 * autre ticket après un rejet), la ligne revient au comptable. Un verdict
 * resté sur une pièce qui n'est plus la même dirait « validée » d'une pièce
 * que personne n'a regardée.
 */
export function etatDeVerification(
  verdict: { verdict: VerdictDuComptable; note: string | null; avaitValide: boolean; ligneJustifieeLe: Date | null } | null,
  ligneJustifieeLe: Date | null
): EtatDeVerification {
  if (!verdict) return { etat: "a_verifier" };
  const meme = (verdict.ligneJustifieeLe?.getTime() ?? null) === (ligneJustifieeLe?.getTime() ?? null);
  if (!meme) return verdict.verdict === "rejete" ? { etat: "corrigee", note: verdict.note } : { etat: "a_verifier" };
  return verdict.verdict === "valide" ? { etat: "valide" } : { etat: "rejete", note: verdict.note, avaitValide: verdict.avaitValide };
}

/** La raison d'un rejet, propre : rien d'écrit reste rien, jamais une chaîne vide. */
export function noteDuRejet(texte: string | null | undefined): string | null {
  const propre = (texte ?? "").replace(/\s+/g, " ").trim().slice(0, 1000);
  return propre === "" ? null : propre;
}

/** Combien de lignes sont vérifiées, et combien rejetées. */
export function avancementDeLaVerification(etats: EtatDeVerification[]): { verifiees: number; rejetees: number; total: number } {
  return {
    verifiees: etats.filter((e) => e.etat === "valide" || e.etat === "rejete").length,
    rejetees: etats.filter((e) => e.etat === "rejete").length,
    total: etats.length,
  };
}
