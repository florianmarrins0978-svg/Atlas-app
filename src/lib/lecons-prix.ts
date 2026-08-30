import { arrondirALaDizaine } from "./arrondi-prix";

// La mémoire des corrections du patron — ce qu'il a RETENU, pas ce qu'on lui a
// proposé.
//
// **Le manque que ça comble.** Jusqu'ici, rien ne retenait ses corrections :
// chaque devis repartait de zéro. Il l'a dit lui-même — *« si l'appli n'a
// aucune mémoire, comment l'IA va enregistrer et se souvenir ? Pour s'améliorer
// elle a besoin de mémoire. »* La table existait pourtant (`historique_prix`),
// lue par le chiffrage… et **jamais écrite par l'application**. Une mémoire que
// personne n'alimente n'est pas une mémoire.
//
// **Ce que ce module fait, et surtout ce qu'il ne fait pas.** Il reconnaît que
// deux chantiers sont comparables, et rappelle le prix pratiqué la dernière
// fois. Il ne calcule aucun prix : `docs/EXEMPLE-DICTEE.md` §9c est explicite —
// *« l'agent propose alors le dernier prix comparable, présenté comme un
// RAPPEL, jamais comme un calcul »*. La nuance porte tout : un rappel dit d'où
// il vient et se vérifie d'un coup d'œil ; un calcul non sourcé demande qu'on
// lui fasse confiance.

/** Ce qui distingue deux chantiers du même genre — et qui fait leur prix. */
export type SignatureLecon = {
  /** Clé de rapprochement, stable et comparable : `abattage|demontage_retention|d70`. */
  cle: string;
  /** De quoi il s'agit, en clair, pour l'écrire dans le rappel. */
  description: string;
};

// Le vocabulaire du métier, repris de `questions-chiffrage.ts` — les mêmes mots
// décident de la question posée et du rapprochement fait ensuite. Deux
// vocabulaires finiraient par diverger, et l'agent rapprocherait alors des
// chantiers qu'il avait jugés différents une heure plus tôt.
const NATURES: { cle: string; libelle: string; motif: RegExp }[] = [
  { cle: "abattage", libelle: "un abattage", motif: /\b(abattage|abattre|abatt|démont|demont)/i },
  { cle: "haie", libelle: "une taille de haie", motif: /\bhaie/i },
  { cle: "elagage", libelle: "un élagage", motif: /\b(élagage|elagage|élaguer|taille\s+d[eu]\s+(?!haie))/i },
  { cle: "dessouchage", libelle: "un dessouchage", motif: /\bdessouch/i },
  { cle: "fendage", libelle: "un fendage", motif: /\bfend/i },
  { cle: "broyage", libelle: "un broyage", motif: /\bbroy/i },
];

const TECHNIQUES: { cle: string; libelle: string; motif: RegExp }[] = [
  // L'ordre compte : « démontage avec rétention » contient « démontage ». Le
  // cas le plus précis d'abord, sans quoi un chantier à 1 400 € serait rapproché
  // d'un chantier à 1 000 €.
  { cle: "retention", libelle: "démontage avec rétention", motif: /rétention|retention/i },
  { cle: "demontage", libelle: "démontage", motif: /\bdémont|\bdemont/i },
  { cle: "au_pied", libelle: "au pied", motif: /\bau\s+pied\b/i },
];

/**
 * La technique lue dans un libellé — **mécanisme historique**.
 *
 * Exportée le 27 août 2026 pour que la comparabilité V2 sache relire les leçons
 * déjà enregistrées, dont le libellé est tout ce qu'elles portent. Une seule
 * lecture de ces mots, ici : deux auraient fini par diverger, et la V2 aurait
 * cessé de retrouver ce que la V1 avait rangé (`CLAUDE.md` §3).
 */
export function techniqueDuLibelle(libelle: string): string | null {
  return TECHNIQUES.find((t) => t.motif.test(libelle))?.cle ?? null;
}

/**
 * Regroupe les diamètres par tranche de 10 cm, **au plus proche**.
 *
 * **Sans tranche, la mémoire ne servirait jamais.** Un chêne de 68 cm et un de
 * 70 cm sont le même travail ; exiger l'égalité exacte ferait que deux chantiers
 * ne se rapprocheraient pour ainsi dire jamais, et le rappel ne s'afficherait
 * qu'au hasard. Dix centimètres est la maille la plus grossière qui n'écrase pas
 * l'écart de prix — le patron chiffre au diamètre, pas au centimètre.
 *
 * **Au plus proche, et non en tronquant.** Tronquer mettait 68 cm et 70 cm dans
 * deux tranches distinctes, alors que ce sont manifestement les mêmes arbres :
 * la frontière tombait pile entre deux valeurs voisines et courantes.
 *
 * **Ce qu'une tranche peut promettre, et ce qu'elle ne peut pas.** Une frontière
 * subsiste — 64 et 66 cm restent séparés. C'est assumé, parce que l'erreur est
 * dans le bon sens : une frontière fait **manquer** un rappel, elle n'en fabrique
 * jamais un faux. Un rappel manquant laisse le patron chiffrer comme
 * aujourd'hui ; un rappel faux se présente avec l'autorité de l'expérience.
 */
export function trancheDiametre(cm: number): string {
  return `d${Math.round(cm / 10) * 10}`;
}

const DIAMETRE_LU = /(?:⌀|Ø|diam[èe]tre)\s*(\d{1,3})/i;

/**
 * La signature d'une prestation, à partir de son libellé.
 *
 * Rend `null` quand rien de reconnaissable ne s'y trouve : mieux vaut aucun
 * rappel qu'un rappel tiré d'un rapprochement fantaisiste. Une leçon fausse
 * coûte plus cher qu'une leçon absente — elle se présente avec l'autorité de
 * l'expérience.
 */
export function signatureLecon(libelle: string): SignatureLecon | null {
  const texte = libelle.trim();
  if (!texte) return null;

  const nature = NATURES.find((n) => n.motif.test(texte));
  if (!nature) return null;

  const morceaux = [nature.cle];
  const enClair = [nature.libelle];

  const technique = TECHNIQUES.find((t) => t.motif.test(texte));
  if (technique) {
    morceaux.push(technique.cle);
    enClair.push(technique.libelle);
  }

  const diametre = DIAMETRE_LU.exec(texte);
  if (diametre) {
    const cm = Number(diametre[1]);
    morceaux.push(trancheDiametre(cm));
    enClair.push(`⌀ ${cm} cm`);
  }

  return { cle: morceaux.join("|"), description: enClair.join(", ") };
}

export type LeconObservee = {
  /** Prix HT réellement retenu par le patron, en euros. */
  prix: string;
  /** Quand il l'a retenu — le plus récent fait le rappel. */
  constateLe: Date;
  /** Le libellé tel qu'il l'a écrit, pour que le rappel lui parle. */
  libelle: string;
};

export type RappelDePrix = {
  /** Le prix rappelé, arrondi à la dizaine d'euros HT (§9b). */
  prix: string;
  /** Phrase à afficher, qui dit d'où vient le chiffre. */
  phrase: string;
  /** Combien d'observations le soutiennent — une seule fois n'est pas une règle. */
  observations: number;
};

/**
 * Le rappel à présenter, à partir des leçons rapprochées.
 *
 * **Le dernier prix, pas la moyenne.** Un artisan qui a monté ses tarifs en
 * juin ne veut pas qu'on lui rappelle la moyenne de l'année : il veut son prix
 * d'aujourd'hui. La moyenne servira aux rapports entre techniques (§9a), pas au
 * rappel.
 *
 * Rend `null` sur une liste vide : l'absence de rappel se dit en n'affichant
 * rien, jamais en proposant zéro.
 */
export function rappelDePrix(lecons: readonly LeconObservee[]): RappelDePrix | null {
  if (lecons.length === 0) return null;

  const triees = [...lecons].sort((a, b) => b.constateLe.getTime() - a.constateLe.getTime());
  const derniere = triees[0]!;
  const prix = arrondirALaDizaine(derniere.prix);
  if (prix === null) return null;

  const quand = derniere.constateLe.toLocaleDateString("fr-FR", { day: "numeric", month: "long" });
  const phrase =
    lecons.length === 1
      ? `La dernière fois — « ${derniere.libelle} », le ${quand} — vous aviez retenu ${prix} € HT.`
      : `La dernière fois — « ${derniere.libelle} », le ${quand} — vous aviez retenu ${prix} € HT ` +
        `(${lecons.length} chantiers comparables).`;

  return { prix, phrase, observations: lecons.length };
}
