// **À qui appartient le montant d'une ligne de devis ?**
//
// Une ligne de devis peut porter plusieurs travaux. Son montant, lui, est un
// seul nombre. Deux mécanismes du produit s'en servent pour APPRENDRE :
// `apprendrePrixGrille` range ce montant dans une case de la grille du patron,
// et `retenirLecon` le retient comme le prix d'un genre de chantier.
//
// Les deux ont besoin de la même certitude : **ce montant est-il celui du
// travail auquel on s'apprête à l'attribuer, et de lui seul ?**
//
// ─── Ce que ça a coûté de ne pas le demander ────────────────────────────────
//
// Le 26 août 2026, le patron dicte depuis son iPhone : une tonte de 1 200 m² et
// le démontage d'un érable en rétention. Le découpage les réunit sur une seule
// ligne (`lignes-vendables.ts` : tout ce qui n'a pas de grille tombe dans
// `principal`). Il pose un prix sur cette ligne, et le classement se fait au
// premier mot reconnu — « démont » répond.
//
// Sa case d'abattage passe alors de 800 € à 1 500 €, **tonte comprise**. Le
// chiffre revient ensuite tout seul sur chaque démontage suivant, avec
// l'autorité de sa grille, et rien ne le dit à l'écran. Mesuré, pas supposé :
// `scripts/test-dictee-devis-identite-db.ts`.
//
// ─── Ce que ce module N'EST PAS ─────────────────────────────────────────────
//
// Ce n'est pas le découpage du devis, et il ne le remplace pas. La vraie
// correction — une nature par prestation, et un lien entre la ligne commerciale
// et les prestations qu'elle porte — vient après. Ici on ferme seulement la
// porte par laquelle un montant faux entre dans une mémoire qui ne s'efface
// pas.
//
// ─── Et surtout : il ne doit RIEN casser de ce qui marche ───────────────────
//
// Le devis que le patron a écrit lui-même le 5 août compte une ligne
// « abattage, broyage, évacuation » à 600 €. **Ces 600 € SONT son prix
// d'abattage** — c'est sa règle, écrite dans `lignes-vendables.ts` : *« l'abattage,
// le broyage et l'évacuation, c'est sur une ligne »*. Un garde-fou qui refuserait
// cette ligne-là arrêterait l'apprentissage sur son cas le plus courant, et
// dégraderait l'application au lieu de la réparer.
//
// D'où la distinction ci-dessous entre un travail qui **se vend seul** et un
// travail qui **accompagne** — elle n'est pas inventée : elle est reprise mot
// pour mot de ses décisions des 7 et 8 août 2026.

/**
 * Les travaux qui portent un prix à eux, et pour lesquels le produit sait
 * ranger ou rappeler quelque chose.
 *
 * **L'union des deux vocabulaires existants, et ce n'est pas un choix de
 * confort.** `apprendre-grille.ts` connaît {fendage, haie, dessouchage, grumes,
 * abattage} ; `lecons-prix.ts` connaît {abattage, haie, élagage, dessouchage,
 * fendage, broyage}. Un garde-fou qui n'en connaîtrait qu'un des deux
 * déclarerait « travail inconnu » ce que l'autre sait parfaitement chiffrer —
 * et refuserait un apprentissage sain. C'est exactement la régression qu'on
 * cherche à éviter.
 *
 * Les motifs sont recopiés des deux modules plutôt que réécrits : deux lectures
 * différentes du même mot rangeraient un prix dans une case que le chiffrage
 * n'irait pas chercher (`CLAUDE.md` §3).
 */
const VENDABLES: { cle: string; motif: RegExp }[] = [
  { cle: "abattage", motif: /\b(abattage|abattre|abatt|d[ée]mont)/i },
  { cle: "haie", motif: /\bhaie/i },
  { cle: "fendage", motif: /\b(fend|fente)/i },
  { cle: "dessouchage", motif: /\b(dessouch|d[ée]souch|souche|rognage)/i },
  { cle: "grumes", motif: /\bgrume/i },
  { cle: "elagage", motif: /\b(élagage|elagage|élaguer|taille\s+d[eu]\s+(?!haie))/i },
  { cle: "broyage", motif: /\bbroy/i },
];

/**
 * Les travaux qui ACCOMPAGNENT, et qui ne se facturent pas à part.
 *
 * **Sa règle du 7 août 2026, mot pour mot :** *« l'abattage, le broyage et
 * l'évacuation, c'est sur une ligne, et la fente, ça doit être séparé. »* Et le
 * billonnage — « on le coupe en 50 » — est absorbé par l'abattage depuis le
 * 5 août : *« le devis compte trois lignes, pas quatre »*.
 *
 * **Un accessoire ne dégrade pas la certitude.** Le prix d'une ligne
 * « abattage + broyage + évacuation » est bien le prix de l'abattage, parce que
 * c'est ainsi que le patron le vend. Le prix d'une ligne « tonte + abattage »
 * ne l'est pas : la tonte se vend seule, elle n'accompagne rien.
 *
 * **Un accessoire SEUL redevient le chantier.** Broyer du bois déjà à terre est
 * un vrai travail, et le déclarer « accessoire de rien » ferait disparaître le
 * seul apprentissage possible de cette ligne — c'est le même piège que le
 * billonnage sans abattage (`lignes-vendables.ts`).
 */
const ACCESSOIRES: RegExp[] = [
  /\bbroy/i,
  /[ée]vacuation|[ée]vacuer/i,
  /\b(billonn|coup[eé]\w*\s+en\s+\d|d[ée]bit\w*\s+en\s+\d|tron[çc]onn\w*\s+en\s+\d)/i,
];

export type Attribution =
  /** Le montant appartient à ce travail, et à lui seul. */
  | { attribuable: true; nature: string }
  /** Il ne lui appartient pas — et le motif dit pourquoi, pour le journal. */
  | { attribuable: false; motif: string };

/**
 * Le montant de cette ligne peut-il être attribué à un seul travail ?
 *
 * Fonction pure : ni base, ni réseau, ni date. Éprouvée sur ses vraies lignes
 * dans `scripts/test-prix-attribuable.ts`.
 *
 * **Le doute refuse.** Un travail qu'on ne reconnaît pas, posé à côté d'un
 * travail qu'on reconnaît, suffit à rendre le montant inattribuable : on ne
 * sait pas quelle part lui revient, et supposer que c'est zéro serait inventer.
 * Sa règle vaut ici comme ailleurs — une leçon absente coûte moins cher qu'une
 * leçon fausse, parce que la fausse se présente avec l'autorité de
 * l'expérience.
 *
 * @param libelle Le libellé de la ligne de devis, tel qu'il est en base. Les
 *   travaux réunis y sont séparés par des retours à la ligne — c'est le
 *   séparateur qu'a choisi le patron le 8 août, et `lignes-vendables.ts` l'écrit.
 */
export function prixAttribuable(libelle: string): Attribution {
  const membres = libelle
    .split("\n")
    .map((m) => m.trim())
    .filter(Boolean);

  if (membres.length === 0) {
    return { attribuable: false, motif: "Ligne sans libellé." };
  }

  const lus = membres.map((texte) => ({
    texte,
    // **Un membre qui porte DEUX travaux vendables à lui seul est déjà un
    // doute.** « Abattage et dessouchage » écrit sur une même ligne de texte ne
    // dit pas quelle part revient à quoi, et le premier motif qui répond
    // gagnerait — c'est le défaut qu'on répare, sous un autre visage. On les
    // relève donc TOUS, jamais le premier.
    vendables: VENDABLES.filter((v) => v.motif.test(texte)).map((v) => v.cle),
    accessoire: ACCESSOIRES.some((a) => a.test(texte)),
  }));

  const toutesLesNatures = new Set(lus.flatMap((m) => m.vendables));

  // Un accessoire n'est un accessoire que s'il accompagne quelqu'un. Seul, il
  // EST le chantier — et son apprentissage doit continuer.
  const naturesPortantes = [...toutesLesNatures].filter(
    (cle) => !(estAccessoirePur(cle) && toutesLesNatures.size > 1)
  );

  if (naturesPortantes.length === 0) {
    return {
      attribuable: false,
      motif: `Aucun travail chiffrable reconnu dans « ${resume(libelle)} ».`,
    };
  }

  if (naturesPortantes.length > 1) {
    return {
      attribuable: false,
      motif:
        `La ligne porte ${naturesPortantes.length} travaux qui se vendent séparément ` +
        `(${naturesPortantes.join(", ")}) : son montant n'appartient à aucun d'eux en propre.`,
    };
  }

  const nature = naturesPortantes[0];

  // **Un travail non reconnu à côté d'un travail reconnu suffit à refuser.**
  // C'est exactement le cas du 26 août : « Tonte de la pelouse (1200 m²) » n'est
  // reconnue par aucun vocabulaire du produit, et elle voyage sur la ligne du
  // démontage. Le montant couvre les deux ; l'attribuer au démontage seul, c'est
  // écrire la tonte dans le prix d'abattage.
  const inconnus = lus.filter((m) => m.vendables.length === 0 && !m.accessoire);
  if (inconnus.length > 0) {
    return {
      attribuable: false,
      motif:
        `La ligne porte un travail que le produit ne sait pas chiffrer ` +
        `(« ${resume(inconnus[0].texte)} ») à côté d'un ${nature} : ` +
        "on ne sait pas quelle part du montant revient à chacun.",
    };
  }

  return { attribuable: true, nature };
}

/** Broyage : le seul travail qui soit à la fois vendable seul et accessoire. */
function estAccessoirePur(cle: string): boolean {
  return cle === "broyage";
}

function resume(texte: string, max = 60): string {
  const propre = texte.trim().replace(/\s+/g, " ");
  return propre.length <= max ? propre : `${propre.slice(0, max - 1)}…`;
}
