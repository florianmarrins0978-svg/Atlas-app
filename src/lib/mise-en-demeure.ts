/**
 * LA MISE EN DEMEURE — sa planche du 24 septembre 2026
 * (`appli/mise-en-demeure.html`), validée : *« pour la mise en demeure on peut
 * la faire, c'est bien ! »*.
 *
 * Une lettre que le patron télécharge et envoie en recommandé avec accusé de
 * réception. Atlas la remplit seul depuis la facture FIGÉE : le client, le
 * numéro, la date, le montant, l'échéance.
 *
 * **Une seule fonction pour l'écran et pour le PDF** : il relit la lettre à
 * l'écran avant de la télécharger, et ce qu'il relit doit être ce qui part
 * (`CLAUDE.md` §3).
 *
 * **Deux points NON VÉRIFIÉS dans les textes, et ils le restent tant que
 * personne ne les a lus à la source** (`TODO.md`, « L'AVOIR ») :
 *   - le délai de huit jours : c'est l'usage, aucun texte ne le fixe à notre
 *     connaissance ;
 *   - les intérêts au taux légal à compter de la lettre : l'article 1231-6 du
 *     Code civil le dit pour un débiteur mis en demeure ; pour un client
 *     professionnel, les pénalités de retard courent dès l'échéance
 *     (L441-10 du Code de commerce), et la lettre n'en dit rien.
 *
 * **Le montant réclamé est le RESTE DÛ**, jamais le total de la facture : un
 * acompte reçu ou un avoir fait réclamer une somme déjà réglée, et c'est la
 * lettre entière qui devient contestable.
 */
import Decimal from "decimal.js";
import { jourDeLettre, jourLisible } from "./jour";
import { enEuros } from "./euros";
import { avecCivilite, detacherCivilite, porteDejaSonAppellation, type CiviliteChoisie } from "./civilite";

export type FacturePourMiseEnDemeure = {
  numero: string;
  /** « AAAA-MM-JJ » */
  dateEmission: string;
  dateEcheance: string | null;
  totalTtc: string;
  /** Ce qui reste à recevoir, avoirs et règlements retirés. */
  reste: string;
  clientNom: string | null;
  clientCivilite: CiviliteChoisie;
  clientAdresse: string | null;
  adresseChantier: string | null;
  entrepriseNom: string;
  entrepriseAdresse: string | null;
};

/** Un morceau de phrase ; `gras` pour ce que l'œil doit attraper sans lire. */
export type Segment = { texte: string; gras?: boolean };

export type LettreMiseEnDemeure = {
  /** « Nantes, le 27 octobre 2026 », ou « Le 27 octobre 2026 » sans ville lisible. */
  lieuEtDate: string;
  destinataire: string[];
  titre: string;
  reference: string;
  appellation: string;
  paragraphes: Segment[][];
  formule: string;
  signature: string;
};

/**
 * LA LETTRE ATTEND LE LENDEMAIN DE L'ÉCHÉANCE — défaut vu le 2 novembre 2026
 * en ouvrant le vrai écran, corrigé sur sa planche (`appli/soignee/facture.html`,
 * état « Pas encore échue ») : la lettre se téléchargeait le jour même de
 * l'envoi de la facture, et elle écrivait pourtant « À ce jour, cette somme
 * reste impayée ». Envoyée en recommandé, c'est une affirmation fausse sur une
 * pièce qu'on produit devant un juge.
 *
 * **Le lendemain, et pas le jour même** : c'est la règle des rappels d'impayé
 * (`RAPPELS_PAR_DEFAUT.factureImpayeeJours`, « un client en retard l'est dès le
 * premier jour »), et celle de L441-10 du Code de commerce, où les pénalités
 * courent le jour qui suit la date de règlement. Le jour de l'échéance, le
 * client peut encore payer sans être en faute.
 *
 * **Sans échéance, la date de la facture en tient lieu** : aucun délai, elle
 * est due à réception (`echeanceFacture`, `src/lib/rappels.ts`, et le moteur des
 * rappels qui relit la même chose).
 *
 * **Les deux jours sont ceux de l'atelier** (`jourIso`), jamais l'horloge du
 * téléphone ni l'UTC : entre minuit et deux heures, l'été, l'UTC croit encore
 * être la veille.
 *
 * L'écran s'en sert pour éteindre « Télécharger la lettre » et dire pourquoi ;
 * la route du PDF, pour refuser. Une seule règle, deux lecteurs (`CLAUDE.md` §3).
 */
export type QuandLaMiseEnDemeure = { possible: true } | { possible: false; echeance: string };

const JOUR = /^\d{4}-\d{2}-\d{2}$/;

export function quandLaMiseEnDemeure(
  f: Pick<FacturePourMiseEnDemeure, "dateEmission" | "dateEcheance">,
  aujourdHui: string
): QuandLaMiseEnDemeure {
  const echeance = f.dateEcheance ?? f.dateEmission;
  // Une date illisible ne conclut pas « échue » : ne pas savoir ne fait jamais
  // partir une mise en demeure. Deux jours bien formés se comparent en texte,
  // dans l'ordre du calendrier, sans passer par un instant et son fuseau.
  if (!JOUR.test(echeance) || !JOUR.test(aujourdHui)) return { possible: false, echeance };
  return aujourdHui > echeance ? { possible: true } : { possible: false, echeance };
}

/**
 * Ce que l'écran dit, et ce que la route répond, tant que la lettre attend.
 * Les mots de sa planche, à deux près : « Avant » devient « Jusque-là » et « ce
 * jour-là » devient « le lendemain », sans quoi le jour même de l'échéance la
 * phrase promettrait une lettre que le bouton refuse encore.
 */
export function phraseDeLAttente(echeance: string, aujourdHui: string): string {
  const jour = jourLisible(echeance, new Date(`${aujourdHui}T00:00:00Z`));
  return `L'échéance tombe le ${jour}. Jusque-là, la facture n'est pas impayée : la lettre attend le lendemain.`;
}

/**
 * La ville de l'entreprise, lue après son code postal — ou rien.
 *
 * **Rien plutôt qu'une ville devinée** : « Nantes, le… » sous l'adresse d'une
 * entreprise de Rezé serait une erreur sur une pièce qu'on produit devant un
 * juge. Sans code postal lisible, la lettre écrit « Le 27 octobre 2026 ».
 */
export function villeDeLAdresse(adresse: string | null): string | null {
  const m = adresse?.match(/\b\d{5}\s+([^,\n\d][^,\n]*)$/m);
  return m ? m[1]!.trim() : null;
}

/**
 * « Monsieur Martin, » / « Madame Roux, » — et « Madame, Monsieur, » quand on
 * ne sait pas : une société, ou un client sans civilité choisie.
 *
 * **Jamais la civilité par défaut des devis** (`CIVILITE_PAR_DEFAUT`) : sur un
 * devis, « Mr. » devant un nom de cliente se corrige d'un appui ; sur une mise
 * en demeure envoyée en recommandé, il ne se corrige plus.
 */
function appeler(nom: string | null, civilite: CiviliteChoisie): { appellation: string; dans: string } {
  const detache = detacherCivilite(nom);
  const choisie = civilite ?? detache.civilite;
  const patronyme = detache.nom;
  if (patronyme && (choisie === "mr" || choisie === "mme") && !porteDejaSonAppellation(patronyme)) {
    const mot = choisie === "mr" ? "Monsieur" : "Madame";
    return { appellation: `${mot} ${patronyme},`, dans: mot };
  }
  return { appellation: "Madame, Monsieur,", dans: "Madame, Monsieur" };
}

export function lettreDeMiseEnDemeure(f: FacturePourMiseEnDemeure, aujourdHui: string): LettreMiseEnDemeure {
  const ville = villeDeLAdresse(f.entrepriseAdresse);
  const jour = jourDeLettre(aujourdHui);
  const { appellation, dans } = appeler(f.clientNom, f.clientCivilite);
  const reste = new Decimal(f.reste);
  const toutReste = reste.eq(new Decimal(f.totalTtc));

  const travaux: Segment[] = [
    { texte: `Le ${jourDeLettre(f.dateEmission)}, je vous ai adressé la facture n° ${f.numero} pour les travaux réalisés` },
    { texte: f.adresseChantier?.trim() ? ` à l'adresse ${f.adresseChantier.trim()},` : "," },
    { texte: " d'un montant de " },
    { texte: `${enEuros(f.totalTtc)} TTC`, gras: true },
    { texte: f.dateEcheance ? `, payable avant le ${jourDeLettre(f.dateEcheance)}.` : "." },
  ];

  return {
    lieuEtDate: ville ? `${ville}, le ${jour}` : `Le ${jour}`,
    destinataire: [avecCivilite(f.clientNom, f.clientCivilite), f.clientAdresse?.trim() ?? ""].filter(Boolean),
    titre: "MISE EN DEMEURE",
    reference: `Facture n° ${f.numero}`,
    appellation,
    paragraphes: [
      travaux,
      toutReste
        ? [{ texte: "À ce jour, cette somme reste impayée." }]
        : [{ texte: "À ce jour, il reste à régler " }, { texte: enEuros(f.reste), gras: true }, { texte: "." }],
      [
        { texte: "Je vous mets en demeure de me régler la somme de " },
        { texte: enEuros(f.reste), gras: true },
        { texte: " dans un délai de " },
        { texte: "huit jours", gras: true },
        { texte: " à compter de la réception de ce courrier." },
      ],
      [
        {
          texte:
            "Sans paiement dans ce délai, je saisirai le tribunal compétent par une procédure " +
            "d'injonction de payer, sans autre avis. Les intérêts au taux légal courent à compter " +
            "de la présente lettre.",
        },
      ],
    ],
    formule: `Je vous prie d'agréer, ${dans}, mes salutations distinguées.`,
    signature: f.entrepriseNom,
  };
}
