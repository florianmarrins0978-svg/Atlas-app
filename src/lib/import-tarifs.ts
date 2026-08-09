// Reprendre une liste de prix que l'artisan a déjà, plutôt que la lui faire
// retaper.
//
// **Sa demande, le 8 août 2026 :** *« si l'utilisateur a déjà un fichier Excel
// ou un PDF avec ces lignes de prix, il doit pouvoir le rentrer dans la
// catégorie réglages via une touche, et que les prix s'ajoutent
// automatiquement. »*
//
// **Ce que ce module ne fait JAMAIS : écrire.** Il lit un tableau et rend ce
// qu'il y a compris, avec ce qu'il a laissé de côté et pourquoi. La décision
// d'enregistrer appartient au patron, écran en main — c'est la règle du produit
// (`docs/AGENT.md` §2), et elle vaut ici plus qu'ailleurs : un tarif faux
// importé en silence se retrouve sur le devis d'un client sans que personne
// l'ait jamais lu.
//
// **Et il ne devine pas un prix.** Une ligne sans montant lisible est écartée
// et signalée, jamais complétée par zéro : un tarif à 0 € se proposerait ensuite
// avec l'autorité de sa grille.

export type LigneImportee = {
  intitule: string;
  /** Montant HT, normalisé « 400.00 ». */
  prix: string;
  unite: string | null;
};

export type LigneEcartee = {
  /** La ligne du fichier, telle quelle — pour qu'il la reconnaisse. */
  contenu: string;
  raison: string;
};

export type LectureTableau = {
  retenues: LigneImportee[];
  ecartees: LigneEcartee[];
};

// --- Reconnaître les colonnes ---------------------------------------------
//
// Les artisans n'ont pas tous la même feuille. On reconnaît donc les en-têtes
// qu'ils écrivent réellement, et on se rabat sur la FORME des cellules quand il
// n'y a pas d'en-tête du tout — ce qui est fréquent : beaucoup de listes
// commencent directement par « Abattage ; 600 ».

const ENTETE_INTITULE = /^(intitul|d[ée]signation|libell|prestation|description|poste|article|nom)/i;
const ENTETE_PRIX = /^(prix|tarif|montant|pu\b|p\.u|co[ûu]t|€)/i;
const ENTETE_UNITE = /^(unit|par\b|u\.|mesure)/i;

/**
 * Un montant, tel qu'un tableur français l'écrit.
 *
 * « 400,00 », « 400.00 », « 1 200,50 », « 400 € », « 400,00 €HT ». L'espace
 * insécable des milliers vient d'Excel, la virgule vient du français, et les
 * deux ensemble sont le cas le plus courant.
 *
 * Rend `null` sur tout le reste — « sur devis », « à voir », une cellule vide.
 * C'est une réponse, pas un échec : la ligne sera écartée et signalée.
 */
export function montantLu(brut: string): string | null {
  const nettoye = brut
    .replace(/[\s  ]/g, "")
    .replace(/€|EUR|HT|TTC/gi, "")
    .replace(",", ".");
  // Un nombre, et rien qui traîne autour : « 12/03 » ou « 400-500 » ne sont pas
  // des prix, et les accepter en prenant le premier nombre ferait entrer un
  // montant que personne n'a écrit.
  if (!/^-?\d+(\.\d+)?$/.test(nettoye)) return null;
  const valeur = Number(nettoye);
  if (!Number.isFinite(valeur) || valeur <= 0) return null;
  return valeur.toFixed(2);
}

/** Une unité plausible : courte, sans chiffre. « jour/homme », « ml », « m² ». */
function uniteLue(brut: string): string | null {
  const u = brut.trim();
  if (!u || u.length > 24) return null;
  if (montantLu(u) !== null) return null;
  return u;
}

type Colonnes = { intitule: number; prix: number; unite: number | null };

/** Les colonnes désignées par une ligne d'en-tête, si c'en est une. */
function colonnesDepuisEntete(ligne: readonly string[]): Colonnes | null {
  const intitule = ligne.findIndex((c) => ENTETE_INTITULE.test(c.trim()));
  const prix = ligne.findIndex((c) => ENTETE_PRIX.test(c.trim()));
  if (intitule === -1 || prix === -1) return null;
  const unite = ligne.findIndex((c) => ENTETE_UNITE.test(c.trim()));
  return { intitule, prix, unite: unite === -1 ? null : unite };
}

/**
 * Les colonnes déduites de la FORME des lignes, faute d'en-tête.
 *
 * **Le piège évité :** prendre « la première colonne » pour l'intitulé et « la
 * deuxième » pour le prix. Une feuille sur deux commence par une colonne de
 * numéros, ou d'unités. On cherche donc la colonne qui contient le plus de
 * montants lisibles — c'est celle des prix — et, à sa gauche, la plus remplie
 * de texte.
 */
function colonnesDeduites(lignes: readonly (readonly string[])[]): Colonnes | null {
  const largeur = Math.max(0, ...lignes.map((l) => l.length));
  if (largeur < 2) return null;

  const montants = new Array(largeur).fill(0);
  const textes = new Array(largeur).fill(0);
  for (const ligne of lignes) {
    for (let c = 0; c < largeur; c++) {
      const cellule = (ligne[c] ?? "").trim();
      if (!cellule) continue;
      if (montantLu(cellule) !== null) montants[c]++;
      else textes[c]++;
    }
  }

  // **La DERNIÈRE colonne qui compte le plus de montants**, et pas la première.
  // Une feuille sur trois commence par une colonne de numéros d'article : « 1,
  // 2, 3 » sont d'excellents montants, et à égalité de compte c'est elle qui
  // gagnait — l'import créait alors des tarifs nommés « 1 » et « 2 ». Le prix
  // vient après la désignation dans à peu près toutes les listes de prix ; le
  // numéro, lui, vient avant.
  const prix = montants.lastIndexOf(Math.max(...montants));
  if (montants[prix] === 0) return null;

  let intitule = -1;
  for (let c = 0; c < largeur; c++) {
    if (c === prix) continue;
    if (intitule === -1 || textes[c] > textes[intitule]) intitule = c;
  }
  if (intitule === -1 || textes[intitule] === 0) return null;

  // L'unité : une autre colonne de texte, après le prix de préférence — c'est
  // l'ordre habituel « désignation, prix, unité ».
  let unite: number | null = null;
  for (let c = 0; c < largeur; c++) {
    if (c === prix || c === intitule) continue;
    if (textes[c] > 0) {
      unite = c;
      if (c > prix) break;
    }
  }
  return { intitule, prix, unite };
}

/**
 * Lit un tableau de cellules et en tire des tarifs.
 *
 * Fonction pure : ni base, ni réseau, ni fichier. Le décodage du CSV ou du
 * classeur vit ailleurs ; ici on ne raisonne que sur des cellules, ce qui rend
 * la règle éprouvable sur les vraies feuilles des artisans.
 */
export function lireTableau(lignes: readonly (readonly string[])[]): LectureTableau {
  const utiles = lignes.filter((l) => l.some((c) => c.trim() !== ""));
  if (utiles.length === 0) return { retenues: [], ecartees: [] };

  const parEntete = colonnesDepuisEntete(utiles[0]);
  const colonnes = parEntete ?? colonnesDeduites(utiles);
  if (!colonnes) {
    return {
      retenues: [],
      ecartees: [
        {
          contenu: utiles[0].join(" | "),
          raison:
            "Aucune colonne de prix reconnue. Il faut au moins une colonne de désignations et une de montants.",
        },
      ],
    };
  }

  const corps = parEntete ? utiles.slice(1) : utiles;
  const retenues: LigneImportee[] = [];
  const ecartees: LigneEcartee[] = [];
  const vus = new Set<string>();

  for (const ligne of corps) {
    const contenu = ligne.map((c) => c.trim()).filter(Boolean).join(" | ");
    if (!contenu) continue;

    const intitule = (ligne[colonnes.intitule] ?? "").trim();
    const prix = montantLu((ligne[colonnes.prix] ?? "").trim());

    if (!intitule) {
      ecartees.push({ contenu, raison: "Pas de désignation sur cette ligne." });
      continue;
    }
    if (prix === null) {
      // Le cas le plus fréquent, et de loin : une ligne de titre (« ABATTAGE »),
      // un sous-total, un « sur devis ». On le dit sans en faire un drame.
      ecartees.push({ contenu, raison: "Pas de montant lisible." });
      continue;
    }
    // Un même intitulé deux fois, c'est deux tarifs qui se contrediront au
    // moment de chiffrer : on garde le premier et on signale le second.
    const cle = intitule.toLowerCase();
    if (vus.has(cle)) {
      ecartees.push({ contenu, raison: `« ${intitule} » figure déjà plus haut dans le fichier.` });
      continue;
    }
    vus.add(cle);

    retenues.push({
      intitule,
      prix,
      unite: colonnes.unite === null ? null : uniteLue(ligne[colonnes.unite] ?? ""),
    });
  }

  return { retenues, ecartees };
}

// --- Confronter à ce qui existe déjà ---------------------------------------

export type TarifExistant = { id: string; intitule: string; prix: string; unite: string | null };

export type Rapprochement = {
  /** Tarifs absents de ses réglages : à créer. */
  aCreer: LigneImportee[];
  /** Tarifs déjà présents, mais dont le prix ou l'unité change. */
  aMettreAJour: { id: string; avant: TarifExistant; apres: LigneImportee }[];
  /** Déjà là, à l'identique — rien à faire, mais il doit le savoir. */
  inchangees: LigneImportee[];
};

/**
 * Ce que l'import changerait, sans rien changer.
 *
 * **Le rapprochement se fait sur l'intitulé**, insensible à la casse et aux
 * espaces. Créer un second « Main d'œuvre » à côté du premier serait le pire
 * résultat possible : le chiffrage trouverait deux tarifs concurrents et
 * s'arrêterait en demandant lequel appliquer, à chaque chantier.
 *
 * **Rien n'est écrasé sans qu'il le voie.** Un prix qui change est présenté
 * avec l'ancien à côté du nouveau : c'est ce qu'il relira avant de trancher.
 */
export function rapprocher(
  existants: readonly TarifExistant[],
  importees: readonly LigneImportee[]
): Rapprochement {
  const parIntitule = new Map(existants.map((t) => [t.intitule.trim().toLowerCase(), t]));
  const aCreer: LigneImportee[] = [];
  const aMettreAJour: Rapprochement["aMettreAJour"] = [];
  const inchangees: LigneImportee[] = [];

  for (const ligne of importees) {
    const existant = parIntitule.get(ligne.intitule.trim().toLowerCase());
    if (!existant) {
      aCreer.push(ligne);
      continue;
    }
    const memePrix = Number(existant.prix) === Number(ligne.prix);
    const memeUnite = (existant.unite ?? "").trim() === (ligne.unite ?? "").trim();
    if (memePrix && memeUnite) inchangees.push(ligne);
    else aMettreAJour.push({ id: existant.id, avant: existant, apres: ligne });
  }

  return { aCreer, aMettreAJour, inchangees };
}
