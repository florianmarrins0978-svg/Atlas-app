import { enEuros } from "./euros";
import { jourEtMois } from "./jour";
import {
  enCentimes,
  facturesProposees,
  proposerFacture,
  type FactureARapprocher,
  type Proposition,
  type VirementRecu,
} from "./rapprochement-bancaire";

/**
 * UN VIREMENT REÇU, MIS EN MOTS — pour l'accueil ET pour Ma TVA.
 *
 * Ses choix du 23 octobre 2026 : la carte « Virement reçu » sur l'accueil, et
 * la même question sur la ligne de la facture dans Ma TVA (variante A,
 * `appli/banque-numero-et-termines.html`). **Une seule mise en mots pour les
 * deux** : deux phrases écrites à deux endroits finiraient par dire deux
 * choses différentes du même virement (`CLAUDE.md` §3).
 *
 * Ni point médian ni tiret dans ce qui s'affiche : des phrases (sa règle du
 * 22 septembre 2026).
 */

export type VirementAQuestionner = VirementRecu & { id: string; etat: "nouveau" | "confirme" | "ecarte" };

export type ChoixDeFacture = {
  factureId: string;
  numero: string;
  client: string | null;
  /** « 120,00 € » : ce qui reste dû sur la facture. */
  reste: string;
};

export type QuestionDeVirement = {
  virementId: string;
  /** Pour RANGER parmi les cartes de l'accueil, jamais pour écrire. */
  quand: number;
  /** Le payeur, ou « Sans nom » quand la banque ne le donne pas. */
  qui: string;
  montant: string;
  /** « Le 21 octobre, VIR M LALA F2026-000028. » */
  quandEtLibelle: string;
  /** Pourquoi cette facture : le numéro lu, le nom, ou le seul montant. */
  raison: string;
  question: string;
  /** « Oui », ou « Oui, une partie » pour un acompte. */
  oui: string;
  /** Une facture, ou plusieurs quand il doit choisir. */
  choix: ChoixDeFacture[];
  genre: Exclude<Proposition["genre"], "aucune">;
};

function versChoix(f: FactureARapprocher): ChoixDeFacture {
  return { factureId: f.id, numero: f.numero, client: f.clientNom, reste: enEuros(Number(f.reste)) };
}

function raisonDe(p: Exclude<Proposition, { genre: "aucune" }>): string {
  if (p.genre === "plusieurs") return "Pas de numéro de facture sur le virement.";
  if (p.indice === "numero") return "Le numéro de la facture est écrit sur le virement.";
  if (p.indice === "nom") return "Pas de numéro sur le virement, mais le montant et le nom correspondent.";
  return "Pas de numéro ni de nom sur le virement, seulement le montant.";
}

function questionDe(p: Exclude<Proposition, { genre: "aucune" }>, montantCentimes: number): string {
  if (p.genre === "plusieurs") return `${p.factures.length} factures font ${enEuros(montantCentimes / 100)}. Laquelle ?`;
  const f = p.facture;
  if (p.genre === "partie") return `Une partie de la facture ${f.numero}, qui attend ${enEuros(Number(f.reste))} ?`;
  if (p.genre === "trop") {
    return `C'est la facture ${f.numero} ? Elle attend ${enEuros(Number(f.reste))}, le virement fait ${enEuros(montantCentimes / 100)}.`;
  }
  return `C'est la facture ${f.numero} ?`;
}

/**
 * Les virements qui attendent sa réponse, chacun avec sa question.
 *
 * **Seulement ceux qui ont une proposition** : un salaire, une allocation, un
 * remboursement de la MSA arrivent aussi sur le compte, et une carte pour
 * chacun noierait les vrais paiements. Ils restent lisibles dans Ma banque.
 */
export function questionsDesVirements(
  virements: readonly VirementAQuestionner[],
  factures: readonly FactureARapprocher[]
): QuestionDeVirement[] {
  const questions: QuestionDeVirement[] = [];
  for (const v of virements) {
    if (v.etat !== "nouveau") continue;
    const p = proposerFacture(v, factures);
    const montant = enCentimes(v.montant);
    if (p.genre === "aucune" || montant === null) continue;
    questions.push({
      virementId: v.id,
      quand: new Date(`${v.date}T12:00:00Z`).getTime(),
      qui: v.payeur ?? "Sans nom",
      montant: enEuros(montant / 100),
      quandEtLibelle: v.libelle ? `Le ${jourEtMois(v.date)}, ${v.libelle}.` : `Le ${jourEtMois(v.date)}.`,
      raison: raisonDe(p),
      question: questionDe(p, montant),
      oui: p.genre === "partie" ? "Oui, une partie" : "Oui",
      choix: facturesProposees(p).map(versChoix),
      genre: p.genre,
    });
  }
  return questions;
}

/** Ce qui s'écrit sur la ligne de la facture, dans Ma TVA : ce que la banque a vu. */
export function vuSurLaBanque(q: QuestionDeVirement): string {
  const jour = q.quandEtLibelle.replace(/^Le /, "").replace(/\.$/, "");
  return `Vu sur votre banque le ${jour}, ${q.montant}.`;
}

/** La question posée sur la ligne d'UNE facture, dans Ma TVA (variante A). */
export type QuestionSurLaFacture = {
  virementId: string;
  /** « Vu sur votre banque le 21 octobre, VIR M LALA, 120,00 €. » */
  vu: string;
  raison: string;
  question: string;
  oui: string;
  choix: ChoixDeFacture;
};

/**
 * Les questions de virement, rangées par facture — pour Ma TVA.
 *
 * Sur la ligne d'une facture, la question parle de CETTE facture : « Ce
 * virement paie-t-il cette facture ? » plutôt que son numéro, déjà écrit
 * juste au-dessus. Quand deux virements désignent la même facture, le plus
 * récent l'emporte : l'autre reste une question sur l'accueil.
 */
export function questionsParFacture(questions: readonly QuestionDeVirement[]): Record<string, QuestionSurLaFacture> {
  const parFacture: Record<string, QuestionSurLaFacture> = {};
  const recentes = [...questions].sort((a, b) => b.quand - a.quand);
  for (const q of recentes) {
    for (const c of q.choix) {
      if (parFacture[c.factureId]) continue;
      const question =
        q.genre === "partie"
          ? "Une partie de cette facture ?"
          : q.genre === "trop"
            ? `Cette facture ? Le virement fait ${q.montant}, plus que ce qu'elle attend.`
            : "Ce virement paie-t-il cette facture ?";
      parFacture[c.factureId] = {
        virementId: q.virementId,
        vu: vuSurLaBanque(q),
        raison: q.raison,
        question,
        oui: q.oui,
        choix: c,
      };
    }
  }
  return parFacture;
}
