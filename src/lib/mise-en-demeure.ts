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
import { jourDeLettre } from "./jour";
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
