import type { NatureAchat } from "./achat-tva";
import { enCentimes } from "./rapprochement-bancaire";

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
 *     loyer, des cotisations…), dont il a dit la nature.
 *
 * Une entrée n'en a pas besoin ici : elle se justifie par la facture d'Atlas
 * qu'il a confirmée sur l'accueil (`virements_recus`).
 */
export type Justification = "ticket" | "facture" | "ticket_perdu" | "motif";

/** Les natures d'un virement qui n'appelle pas de facture — ses mots, sur la planche. */
export const MOTIFS_VIREMENT = ["fournisseur", "salaire", "loyer", "impots", "pret", "perso"] as const;
export type MotifVirement = (typeof MOTIFS_VIREMENT)[number];

export const LIBELLE_MOTIF: Record<MotifVirement, string> = {
  fournisseur: "Un fournisseur",
  salaire: "Un salaire",
  loyer: "Un loyer",
  impots: "Impôts, cotisations",
  pret: "Un prêt",
  perso: "Pour moi",
};

export function estMotifVirement(v: unknown): v is MotifVirement {
  return typeof v === "string" && (MOTIFS_VIREMENT as readonly string[]).includes(v);
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
  sens: "entree" | "sortie";
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

/**
 * La période du dossier en cours : du 1ᵉʳ janvier de l'année jusqu'à
 * aujourd'hui. Le lot 3 la fera partir du lendemain du dernier dossier
 * arrêté, à la date qu'il choisit (`TODO.md`, « Arrêter le dossier »).
 */
export function periodeDuDossierEnCours(maintenant: Date): { du: string; au: string } {
  const au = maintenant.toISOString().slice(0, 10);
  return { du: `${au.slice(0, 4)}-01-01`, au };
}
