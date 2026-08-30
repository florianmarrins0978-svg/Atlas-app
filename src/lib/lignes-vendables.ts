import Decimal from "decimal.js";
import { arrondirALaDizaine } from "./arrondi-prix";
import { libelleClient } from "./libelle-client";
import { nature, natureDuLibelle } from "./natures-prestation";

// **Comment une dictée devient des LIGNES de devis — au pluriel.**
//
// Le patron, le 7 août 2026, pour la troisième fois : *« l'agent ne comprend
// toujours pas qu'il faut séparer les tâches. Tout ce que je dicte arrive sur la
// même ligne du devis. »* Puis, très précisément : *« l'abattage, le broyage et
// l'évacuation, c'est sur une ligne, et la fente, ça doit être séparé. »* Et le
// lendemain : *« à chaque fois qu'il sépare les tâches, il met un point-virgule.
// Il faut le retirer. »*
//
// Le défaut tenait en une ligne de code — `prestations.join(" ; ")` — et il a
// survécu à un diagnostic : il avait été **expliqué** la veille au lieu d'être
// **corrigé**. C'est pourquoi la règle vit désormais ici, dans une fonction pure
// éprouvée sur ses propres dictées, et non enfouie dans un service.
//
// **Le POURQUOI, dans ses mots, et il ne se devine pas :** *« si le client ne
// veut pas la fente, il va trouver le reste cher ; et s'il fait faire le reste
// par un autre artisan et qu'il nous prend juste pour la fente, 100 € ce n'est
// pas assez cher. »* Une ligne de devis n'est pas une rubrique comptable : c'est
// une chose que le client peut accepter ou refuser **seule**. Ce qu'il ne peut
// pas détacher n'a aucune raison d'occuper sa propre ligne ; ce qu'il peut
// détacher doit porter son propre déplacement.
//
// Cette règle est aussi la première inscrite dans `termes_metier`
// (migration 0025) : les deux disent la même chose, l'une au modèle, l'autre au
// code. Elles se corrigent ensemble.

// **Le vocabulaire ne vit plus ici — il vit dans le référentiel.**
//
// Ce fichier portait six expressions régulières, recopiées de proche en proche
// dans cinq autres modules. Elles sont dans `natures-prestation.ts` désormais,
// avec ce que chaque nature implique : détachable ou non, accessoire ou non,
// chiffrable ou non, et sa place sur le devis. Ce module ne décide plus DE QUOI
// il s'agit — il décide seulement de ce qui se vend ensemble.
//
// **Ce qui a changé le 27 août 2026, et pourquoi.** La case `principal`
// ramassait tout ce qu'aucune de ces six expressions ne reconnaissait. Une tonte
// de 1 200 m² arrivait donc sur la ligne d'un démontage d'érable, et le montant
// de cette ligne partait dans la case d'abattage de sa grille. Le fourre-tout
// n'était pas un défaut de rangement : c'était la porte d'entrée de la
// corruption.

export type PrestationAGrouper = {
  /** L'identifiant en base, quand la prestation existe déjà. */
  id?: string;
  libelle: string;
  /**
   * Sa nature métier, telle qu'elle est **en colonne**.
   *
   * Absente, elle est relue depuis le libellé par le mécanisme historique
   * (`natureDuLibelle`). C'est ce qui permet aux prestations d'avant le
   * 27 août 2026 — qui n'ont pas de colonne — de continuer à se regrouper
   * exactement comme avant.
   */
  nature?: string | null;
  quantite?: string | null;
  unite?: string | null;
  caracteristiques?: unknown;
  corrigeParHumain?: boolean | null;
};

export type LigneVendable = {
  /**
   * La NATURE de ce que la ligne vend — ou `"autre"` quand le produit ne sait
   * pas la nommer.
   *
   * **Ce n'était pas ça avant, et c'est le cœur de la correction du 27 août.**
   * La clé valait `"principal"` : une case qui ramassait tout ce qu'aucune
   * expression régulière ne reconnaissait — la tonte, la plantation, le
   * désherbage — et les posait sur la ligne de l'abattage. Le montant de la
   * ligne partait ensuite dans la case d'abattage de sa grille.
   *
   * `"autre"` ne ramasse RIEN : chaque prestation inconnue fait sa propre
   * ligne. Ce qu'on ne sait pas nommer garde son identité.
   */
  cle: string;
  /** Ce que le client lit. Plusieurs travaux réunis : un par ligne. */
  libelle: string;
  /** Les libellés réunis, dans l'ordre de la dictée. */
  membres: string[];
  /** Les prestations réunies — avec leur identifiant quand elles en ont un. */
  prestations: PrestationAGrouper[];
  /** Le client peut-il refuser cette ligne sans annuler le chantier ? */
  detachable: boolean;
  /**
   * La ligne qui absorbe le reste quand un total global se répartit.
   *
   * **Un RÔLE, plus une identité.** C'est ce que `"principal"` mélangeait :
   * « la ligne qui reçoit le solde » et « la ligne des travaux qu'on ne sait
   * pas classer » étaient la même chose, donc tout travail inconnu héritait du
   * prix et de l'apprentissage de l'abattage.
   */
  principal: boolean;
};

export type Decoupage = {
  lignes: LigneVendable[];
  /**
   * Ce qui a été fondu dans une autre ligne plutôt que d'en faire une.
   * Signalé au patron : une prestation qui disparaît sans un mot est
   * exactement ce qui lui a fait perdre « on le coupe en 50, on le fend ».
   */
  absorbes: string[];
};

/** La clé des lignes que le produit ne sait pas nommer. Elle ne réunit jamais rien. */
export const CLE_AUTRE = "autre";

function normaliser(entree: string | PrestationAGrouper): PrestationAGrouper | null {
  const brut = typeof entree === "string" ? { libelle: entree } : entree;
  const libelle = brut.libelle?.trim() ?? "";
  if (!libelle) return null;
  // La colonne d'abord, le libellé ensuite : une prestation d'avant le lot B
  // n'a pas de colonne, et doit continuer à se regrouper comme avant.
  const cle = brut.nature?.trim() || natureDuLibelle(libelle);
  return { ...brut, libelle, nature: cle };
}

/**
 * Découpe des prestations dictées en lignes réellement vendables.
 *
 * Fonction pure : ni base, ni réseau, ni date. Elle se joue sur ses dictées
 * réelles dans `scripts/test-lignes-vendables.ts`.
 *
 * **Le séparateur est un retour à la ligne, pas un point-virgule.** Sa demande
 * du 8 août, et elle a une raison : un point-virgule fait une phrase, et une
 * phrase se lit comme une seule prestation. Empilés, les travaux se comptent
 * d'un coup d'œil sur le devis.
 *
 * **Trois règles, et pas une de plus :**
 *
 * 1. les accessoires — broyage, évacuation — rejoignent la ligne principale,
 *    parce que c'est ainsi qu'il les vend (sa règle du 7 août) ;
 * 2. le billonnage disparaît quand un abattage l'accompagne, et seulement
 *    alors (sa règle du 5 août) ;
 * 3. **tout le reste fait sa propre ligne**, y compris — et surtout — ce que le
 *    produit ne sait pas nommer.
 */
export function lignesVendables(entrees: readonly (string | PrestationAGrouper)[]): Decoupage {
  const propres = entrees.map(normaliser).filter((p): p is PrestationAGrouper => p !== null);
  if (propres.length === 0) return { lignes: [], absorbes: [] };

  const ilYAUnAbattage = propres.some((p) => p.nature === "abattage");
  const absorbes: string[] = [];

  type Groupe = { cle: string; ordre: number; membres: PrestationAGrouper[] };
  const groupes: Groupe[] = [];
  const parCle = new Map<string, Groupe>();

  function poser(cleGroupe: string, ordre: number, p: PrestationAGrouper, reunir: boolean): Groupe {
    if (reunir) {
      const deja = parCle.get(cleGroupe);
      if (deja) {
        deja.membres.push(p);
        return deja;
      }
    }
    const neuf: Groupe = { cle: cleGroupe, ordre, membres: [p] };
    groupes.push(neuf);
    if (reunir) parCle.set(cleGroupe, neuf);
    return neuf;
  }

  // --- Passe 1 : les travaux qui portent le chantier ------------------------
  //
  // Les accessoires attendent la seconde passe : on ne sait pas encore à quelle
  // ligne les rattacher tant qu'on n'a pas vu tout ce qui a été dicté.
  const enAttente: PrestationAGrouper[] = [];
  for (const p of propres) {
    const n = nature(p.nature);

    // Le billonnage est compris dans l'abattage — mais seulement s'il y en a un.
    if (n?.cle === "billonnage" && ilYAUnAbattage) {
      absorbes.push(p.libelle);
      continue;
    }
    if (n?.accessoire) {
      enAttente.push(p);
      continue;
    }
    // **Ce que le produit ne sait pas nommer ne se réunit avec RIEN** — pas
    // même avec un autre inconnu. Deux travaux qu'on ne comprend pas ne sont
    // pas pour autant le même travail.
    if (!n) {
      poser(CLE_AUTRE, 100, p, false);
      continue;
    }
    poser(n.cle, n.ordreDevis, p, true);
  }

  // --- Qui absorbe le solde, et qui accueille les accessoires ---------------
  //
  // L'abattage quand il y en a un — c'est le chantier, et c'est sa règle du
  // 7 août. Sinon le premier travail porteur de la dictée : sans cela, une
  // dictée d'élagage (« taille d'allégement, broyage, évacuation ») verrait son
  // broyage et son évacuation faire deux lignes séparées, que le client
  // pourrait refuser une à une. C'est le devis du 7 août, celui qui est sorti
  // vide.
  let principal: Groupe | null = parCle.get("abattage") ?? groupes[0] ?? null;

  // --- Passe 2 : les accessoires rejoignent la ligne principale -------------
  for (const p of enAttente) {
    const n = nature(p.nature)!;
    if (principal && principal.cle !== n.cle) {
      principal.membres.push(p);
      continue;
    }
    // Un accessoire SEUL redevient le chantier : broyer du bois déjà à terre
    // est un vrai travail, et le faire disparaître effacerait la seule
    // prestation dictée.
    const sien = poser(n.cle, n.ordreDevis, p, true);
    principal ??= sien;
  }

  // L'ordre de lecture du devis suit celui du chantier (`ordreDevis`), et ce
  // que le produit ne nomme pas ferme la marche, dans l'ordre de la dictée.
  const ordonnes = groupes
    .map((g, rang) => ({ g, rang }))
    .sort((a, b) => a.g.ordre - b.g.ordre || a.rang - b.rang)
    .map(({ g }) => g);

  const lignes: LigneVendable[] = ordonnes.map((g) => ({
    cle: g.cle,
    // **Le client lit le libellé nettoyé ; les moteurs relisent le brut.**
    // La distinction est écrite dans le type depuis le début et n'était pas
    // exploitée : `libelle` dit « ce que le client lit », `membres` « les
    // libellés réunis ». Nettoyer les DEUX casserait le chiffrage — le repli
    // par le texte de `mesuresResolues` y cherche encore les mesures.
    libelle: g.membres.map((m) => libelleClient(m)).join("\n"),
    membres: g.membres.map((m) => m.libelle),
    prestations: g.membres,
    // La ligne qui absorbe le solde ne peut pas être refusée : ce serait
    // proposer d'annuler le chantier.
    detachable: g === principal ? false : (nature(g.cle)?.detachable ?? true),
    principal: g === principal,
  }));

  return { lignes, absorbes };
}

export type Repartition = {
  /** Le montant de chaque ligne, dans l'ordre reçu. */
  montants: string[];
  /** Ce qu'on explique au patron sur l'écran Prix. */
  detail: string;
};

/**
 * Répartit un montant global entre la ligne principale et les détachables.
 *
 * **Le total ne bouge pas — c'est la répartition qui protège les deux cas.**
 * Le patron, expliquant pourquoi il écrit 850 + 250 là où le calcul donnerait
 * 1 000 + 100 : la fente doit porter son propre déplacement, sinon le client
 * qui la refuse trouve le reste cher, et celui qui ne prend qu'elle la paie
 * moins qu'elle ne coûte.
 *
 * Le montant de chaque ligne détachable vient de SA grille
 * (`grille-prix.ts`), jamais d'un pourcentage : un pourcentage serait une
 * invention de plus, et c'est précisément ce qu'il a demandé d'éviter — *« comme
 * ça il n'invente rien »*.
 *
 * @param prixDetachables  Le prix de grille de chaque ligne, `null` quand la
 *   case est vide. Une ligne sans prix reste à zéro : on ne devine pas.
 * @param indexPrincipale  La ligne qui absorbe le reste.
 *
 * Rend `null` quand la répartition ne tient pas debout : des détachables qui
 * valent le chantier entier, ou davantage, laisseraient la ligne principale à
 * zéro ou négative — un devis que le patron enverrait sans le voir.
 */
export function repartir(
  totalHt: string,
  prixDetachables: readonly (string | null)[],
  indexPrincipale: number
): Repartition | null {
  let total: Decimal;
  try {
    total = new Decimal(totalHt);
  } catch {
    return null;
  }
  if (!total.isFinite() || total.lessThanOrEqualTo(0)) return null;
  if (indexPrincipale < 0 || indexPrincipale >= prixDetachables.length) return null;

  let reste = total;
  const montants: string[] = prixDetachables.map(() => "0");

  for (let i = 0; i < prixDetachables.length; i++) {
    if (i === indexPrincipale) continue;
    const brut = prixDetachables[i];
    if (brut === null) continue;
    let part: Decimal;
    try {
      part = new Decimal(brut);
    } catch {
      continue;
    }
    if (!part.isFinite() || part.lessThanOrEqualTo(0) || part.greaterThanOrEqualTo(reste)) return null;
    montants[i] = part.toFixed(2);
    reste = reste.minus(part);
  }

  // **L'arrondi peut décaler le total de quelques euros, et on le dit.** Le
  // taire serait reprendre le défaut qu'on répare : un montant qui bouge sans
  // que rien ne l'explique. La règle des prix ronds (« 350, 400, 420, 560 »)
  // l'emporte sur l'exactitude à l'euro — mais elle ne se cache pas.
  const principal = arrondirALaDizaine(reste.toFixed(2)) ?? reste.toFixed(2);
  montants[indexPrincipale] = principal;

  const nouveauTotal = montants.reduce((somme, m) => somme.plus(m), new Decimal(0));
  const ecart = !nouveauTotal.equals(total);
  const detaches = montants.filter((_, i) => i !== indexPrincipale && Number(montants[i]) > 0);

  return {
    montants,
    detail:
      (detaches.length > 0
        ? `${detaches.join(" € et ")} € pour ${detaches.length > 1 ? "les lignes détachables" : "la ligne détachable"} — ` +
          "ce sont les prix de VOTRE grille, pas une part du total. "
        : "") +
      `${principal} € pour le reste, de façon qu'aucune ligne ne se vende à perte.` +
      (ecart
        ? ` Total : ${nouveauTotal.toFixed(2)} € au lieu de ${total.toFixed(2)} €, l'écart vient de l'arrondi à la dizaine.`
        : ` Le total ne change pas : ${total.toFixed(2)} €.`),
  };
}

/**
 * Les travaux qu'une ligne de devis réunit, relus depuis son libellé.
 *
 * **Le séparateur est un retour à la ligne, et il est nommé ICI plutôt que
 * recopié.** C'est sa demande du 8 août — un point-virgule fait une phrase, et
 * une phrase se lit comme une seule prestation. Trois modules avaient besoin de
 * refaire ce découpage ; qu'un seul le fasse évite qu'ils divergent le jour où
 * le séparateur change.
 */
export function membresDuLibelle(libelle: string): string[] {
  return libelle
    .split("\n")
    .map((m) => m.trim())
    .filter(Boolean);
}
