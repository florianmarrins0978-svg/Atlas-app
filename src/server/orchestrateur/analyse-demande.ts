// Segmente un texte libre (dictée, demande client, e-mail collé) en éléments
// exploitables.
//
// **Ce que cette fonction a détruit, et qu'elle ne doit plus détruire.** Le
// patron a écrit trois lignes :
//
//     Taille de haie laurier 20 m linéaires
//     Abattage chêne mort, couper le bois en 50 cm fendre laisser sur place
//     Estimation 2 jours 2 hommes broyeur plus camion plus fendeuse
//
// et l'écran lui a rendu UNE prestation — « Taille de haie laurier 20 m
// linéaires⏎Abattage chêne mort » — aucun matériel, aucune gestion de déchets.
// Deux fautes, toutes deux silencieuses :
//
// 1. le découpage ignorait les retours à la ligne, alors qu'une dictée met
//    naturellement un élément par ligne : deux prestations se retrouvaient
//    collées dans un même libellé ;
// 2. un segment contenant la durée ou l'équipe était **jeté en entier**. Sa
//    troisième ligne portait tout son matériel — broyeur, camion, fendeuse —
//    et il a disparu sans laisser de trace, pas même un « non détecté ».
//
// D'où la règle qui gouverne ce fichier : **rien de ce qui a été dicté ne
// disparaît**. Un mot qu'on ne sait pas classer ressort dans une prestation à
// vérifier, jamais dans le vide. `scripts/test-analyse-dictee.ts` l'éprouve mot
// à mot sur la dictée ci-dessus.
//
// La reconnaissance métier réelle reste le travail du catalogue
// (RechercherPrestation) et, à terme, d'un vrai modèle de langage — ces
// heuristiques ne comprennent rien, elles se contentent de ne rien perdre.

// Vocabulaire de matériel. Il était celui d'un plaquiste (plaque, rail, colle,
// enduit) dans une application faite pour un élagueur : « broyeur », « camion »
// et « fendeuse » n'y figuraient pas, et l'écran affichait « Rien de détecté
// dans la dictée » en face de trois machines nommées.
//
// Les unités (m², kg, litre) en ont été retirées : une unité n'est pas un
// matériel. « Taille de haie 20 m² » finissait classée en matériel.
export const MOTS_MATERIEL =
  /broyeur|camion|fendeuse|tron[çc]onneuse|nacelle|remorque|rogneuse|d[ée]broussailleuse|souffleur|taille[- ]haies?|[ée]lagueuse|perche|treuil|grue|mini[- ]?pelle|chargeuse|plateau|[ée]chelle|harnais|corde|plaque|sac|rail|montant|carrelage|colle|joint|enduit|vis|profil/i;

export const MOTS_AMBIGUS = /environ|peut[- ]être|je pense|sans doute|à confirmer/i;

const NOMBRE = "(?:\\d+|un|une|deux|trois|quatre|cinq|six|sept|huit|neuf|dix)";

// Les frontières de mot ne sont pas décoratives. Sans elles, `jours?` se
// déclenchait à l'intérieur de « journée » : « Une journée » était lu comme la
// durée « Une jour », et le segment amputé laissait une prestation nommée
// « née ». Trouvé par l'invariant de non-perte, pas à la relecture.
//
// « journée » et « semaine » sont des durées que le patron dicte réellement, et
// « journ[ée]e » passe avant « jour » : une alternative plus courte placée
// devant gagnerait la course et remettrait le défaut.
export const REGEX_DUREE = new RegExp(
  `\\b${NOMBRE}\\s*(?:à\\s*${NOMBRE}\\s*)?(?:demi[- ])?(?:journ[ée]es?|jours?|semaines?)\\b`,
  "i"
);
export const REGEX_EQUIPE = new RegExp(`\\b${NOMBRE}\\s*(?:hommes?|ouvriers?|gars|personnes?)\\b`, "i");

// Séparateurs de segments.
//
// Le retour à la ligne compte autant que la ponctuation : c'est la façon dont
// on écrit une liste sur un téléphone, et c'était le premier oubli.
//
// « plus » et « et » séparent aussi — « broyeur plus camion plus fendeuse » est
// une énumération dictée, pas un nom de machine.
//
// La virgule et le point ne coupent PAS entre deux chiffres : « 1,5 m » et
// « 1.5 m » restent entiers. Le découpage précédent en faisait « 1 » et « 5 m »,
// et la quantité se perdait.
const SEPARATEURS = /\r?\n|;|(?<!\d)[,.]|[,.](?!\d)|\s+(?:plus|et)\s+/i;

// Amorces de dictée qui n'appartiennent à aucune prestation : « Estimation 2
// jours 2 hommes… » commence par un mot qui annonce, pas par un travail.
const AMORCES = /^(?:estimation|estim[ée]e?|estime|pr[ée]voir|[àa] pr[ée]voir|pr[ée]vu[e]?|compter|il faut)\b\s*:?\s*/i;

// Ce qui, resté seul après nettoyage, ne constitue pas un élément : mots de
// liaison, articles, restes de ponctuation. Le seuil de longueur ne suffit pas
// — « des » et « sur » passeraient.
const RESIDU_SANS_CONTENU = /^(?:[\s'’\-–—:]*|(?:de|du|des|le|la|les|un|une|au|aux|en|et|plus|avec|pour|sur|dans|par|l['’])\s*)+$/i;

export type AnalyseDemande = {
  prestations: string[];
  materiel: string[];
  ambiguites: string[];
  dureeTexte: string | null;
  equipeTexte: string | null;
};

function nettoyer(texte: string): string {
  return texte.replace(/\s+/g, " ").trim();
}

export function analyserDemandeTexte(texte: string): AnalyseDemande {
  const segments = texte
    .split(SEPARATEURS)
    .map(nettoyer)
    .filter((s) => s.length > 0);

  const dureeMatch = texte.match(REGEX_DUREE);
  const equipeMatch = texte.match(REGEX_EQUIPE);

  const prestations: string[] = [];
  const materiel: string[] = [];
  const ambiguites: string[] = [];

  for (const segment of segments) {
    // L'ambiguïté se signale, elle ne fait plus disparaître le segment. « Environ
    // 20 m de haie » est une prestation — incertaine, donc à confirmer, mais une
    // prestation : la mettre uniquement dans les ambiguïtés la retirait de
    // l'écran, et le patron perdait la moitié de sa dictée en disant « environ ».
    if (MOTS_AMBIGUS.test(segment)) ambiguites.push(segment);

    // La durée et l'équipe sont retirées du segment, pas le segment de la liste.
    // C'est cette ligne qui a mangé « broyeur plus camion plus fendeuse ».
    let reste = segment;
    if (dureeMatch) reste = reste.replace(dureeMatch[0], " ");
    if (equipeMatch) reste = reste.replace(equipeMatch[0], " ");
    reste = nettoyer(nettoyer(reste).replace(AMORCES, ""));

    if (!reste || RESIDU_SANS_CONTENU.test(reste)) continue;

    if (MOTS_MATERIEL.test(reste)) materiel.push(reste);
    else prestations.push(reste);
  }

  return {
    prestations,
    materiel,
    ambiguites,
    dureeTexte: dureeMatch?.[0] ?? null,
    equipeTexte: equipeMatch?.[0] ?? null,
  };
}
