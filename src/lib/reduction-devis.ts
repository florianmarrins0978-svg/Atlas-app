import Decimal from "decimal.js";

/**
 * Le prix accordé au client — la règle, en un seul endroit.
 *
 * Le patron, le 16 août 2026 : *« si jamais un client me demande une réduction,
 * [pouvoir] lui demander "fais cinq pour cent sur le montant du devis" et il
 * ajoute une petite ligne réduction ou prix accordé au client — cinq pour cent,
 * ou dix, ou quinze. C'est moi qui choisis le nombre de pourcentage. »*
 *
 * Puis, sur `docs/maquettes/61-la-reduction-au-client.html` : **« Sous le total
 * et prix accordé au client »** — l'arrangement B, et son libellé.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * CE QUE B COÛTE, ET POURQUOI CE FICHIER EXISTE.
 *
 * Il lui a été dit avant qu'il choisisse : B n'est pas une ligne du tableau,
 * donc la réduction ne voyage pas toute seule. Il faut la porter dans le devis,
 * dans la facture, dans le PDF des deux, à l'écran, et dans tout ce qui recopie
 * un total. **Chaque endroit oublié est un montant faux.** Il a choisi en
 * connaissance de cause.
 *
 * La parade est ce fichier : **un seul calcul, que tout le monde appelle.**
 * Le jour où quelqu'un recalcule un total à la main quelque part, il se
 * trompera — pas parce qu'il est distrait, mais parce que l'ordre des
 * opérations est piégeux.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * L'ORDRE DES OPÉRATIONS N'EST PAS NÉGOCIABLE.
 *
 * La réduction s'applique sur le **HT**, et la TVA se calcule **après**.
 * L'appliquer sur le TTC rendrait une TVA fausse sur un document qui finit dans
 * une déclaration : ce n'est pas une préférence de présentation, c'est la seule
 * façon juste, et elle lui a été annoncée comme non soumise à son choix.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * `Decimal` PARTOUT, ET JAMAIS `number`. C'est de l'argent : 870 × 0,15 vaut
 * 130.49999999999997 en virgule flottante, et un devis à 739,50 € deviendrait
 * un devis à 739,51 €. Le reste du dépôt suit déjà cette règle
 * (`factures.ts`, `devis.ts`) ; ce fichier ne fait pas exception.
 */

/** Les bornes du pourcentage. **Elles servent à l'écran ET au serveur** : une seule règle. */
export const BORNES_REDUCTION = { min: 0, max: 100 } as const;

/**
 * Une catégorie de TVA du document : son taux, ce qu'elle porte, ce qu'elle doit.
 *
 * **Sa demande du 1er septembre 2026** : *« lorsque j'ai plusieurs choses à
 * rajouter ou une seule en TVA à 10, j'appuie sur ajouter une TVA, une
 * catégorie s'ajoute, et là je mets toutes mes lignes qui seront en TVA à 10 »*
 * — la main d'œuvre à 20 %, les plantes à 10 %, sur le même devis.
 *
 * **Le taux ne se pose pas ligne par ligne, et c'est LUI qui l'a tranché.** Une
 * première proposition mettait une colonne TVA sur chaque ligne ; il a répondu
 * qu'il voulait une catégorie. Il a raison : sur un téléphone, poser le même
 * taux sur huit lignes fait huit gestes et huit occasions de se tromper d'un
 * chiffre — et un taux faux ne se voit pas sur le devis, il se voit à la
 * déclaration de TVA.
 */
export type CategorieTva = {
  /** « 20.00 », « 10.00 » — deux décimales, comme la colonne en base. */
  taux: string;
  /** Ce que portent ses lignes, avant le prix accordé. */
  brutHt: string;
  /** Sa part du prix accordé, au prorata. `null` quand il n'y en a pas. */
  reductionMontant: string | null;
  /** Ce sur quoi SA TVA se calcule — brut moins sa part de réduction. */
  baseHt: string;
  /** Ce qu'elle doit. */
  tva: string;
};

export type TotauxDevis = {
  /** Ce que valent les lignes, avant tout geste commercial. */
  brutHt: string;
  /** `null` : aucun prix accordé — le document n'écrit alors rien du tout. */
  reductionPourcent: string | null;
  /** Ce qui est retiré, en euros. `null` quand il n'y a pas de réduction. */
  reductionMontant: string | null;
  /** Ce sur quoi la TVA se calcule, et ce que la comptabilité doit voir. */
  totalHt: string;
  totalTva: string;
  totalTtc: string;
  /**
   * La ventilation par taux, dans l'ordre où ses catégories apparaissent.
   *
   * **Toujours renseignée, même à un seul taux** — une case à un élément. Un
   * appelant qui n'en veut pas lit `totalTva` comme avant ; celui qui imprime
   * le document déroule cette liste. Deux chemins selon le nombre de taux
   * auraient fait deux calculs, donc deux résultats (`CLAUDE.md` §3).
   */
  parTaux: CategorieTva[];
};

/**
 * Un taux de TVA tel qu'il a pu être saisi au doigt, ramené à une valeur sûre.
 *
 * **Cette règle existait déjà, écrite en dur dans le dépôt du devis** — un
 * `Math.min(100, Math.max(0, Number(…)))` que l'écran ne partageait pas. Elle
 * vit ici depuis que les catégories l'appellent aussi : trois validations du
 * même chiffre auraient fini par accepter trois choses différentes
 * (`CLAUDE.md` §3), et c'est un taux de TVA — il finit dans une déclaration.
 *
 * **On borne au lieu de refuser**, comme le prix accordé au client : « 200 »
 * vient d'un doigt qui a glissé, et un écran qui refuse sans rien dire fait
 * recommencer. `null` quand il n'y a rien à lire — l'appelant décide alors.
 */
export function tauxTvaValide(valeur: unknown): string | null {
  if (valeur === null || valeur === undefined || String(valeur).trim() === "") return null;
  const brut = String(valeur).replace(",", ".").trim();
  if (!/^\d+(\.\d+)?$/.test(brut)) return null;
  const n = new Decimal(brut);
  if (n.greaterThan(100)) return "100.00";
  return n.toDecimalPlaces(2).toFixed(2);
}

/** Le taux d'une ligne, ou celui du document quand elle n'en porte pas. */
export function tauxDeLaLigne(
  ligne: { tauxTva?: string | null },
  tauxDuDocument: string
): string {
  const brut = ligne.tauxTva;
  if (brut === null || brut === undefined || String(brut).trim() === "") {
    return new Decimal(tauxDuDocument).toFixed(2);
  }
  return new Decimal(String(brut).replace(",", ".")).toFixed(2);
}

/**
 * Un pourcentage tel qu'il a pu être dicté ou saisi, ramené à une valeur sûre.
 *
 * **Hors bornes, on borne au lieu de refuser** — même choix que les conditions
 * de document (`conditions-documents.ts`) : une saisie à 150 % vient d'un doigt
 * qui a glissé, et un écran qui refuse sans rien dire fait recommencer.
 *
 * **Zéro vaut « aucune réduction »**, pas « une réduction de zéro » : une ligne
 * « Prix accordé au client 0 % — 0,00 € » sur un devis n'apprend rien à
 * personne et fait douter du reste.
 */
export function pourcentValide(valeur: unknown): string | null {
  if (valeur === null || valeur === undefined || valeur === "") return null;
  const brut = typeof valeur === "number" ? String(valeur) : String(valeur).replace(",", ".").trim();
  if (!/^-?\d+(\.\d+)?$/.test(brut)) return null;
  const n = new Decimal(brut);
  if (n.lessThanOrEqualTo(BORNES_REDUCTION.min)) return null;
  if (n.greaterThan(BORNES_REDUCTION.max)) return String(BORNES_REDUCTION.max);
  // Deux décimales : la colonne en base est `numeric(5,2)`, et laisser passer
  // « 7,333 » ferait diverger l'écran de ce qui est enregistré.
  return n.toDecimalPlaces(2).toString();
}

/**
 * Les totaux d'un devis ou d'une facture, réduction comprise.
 *
 * **`totalHt` est le montant APRÈS réduction**, et c'est le choix qui fait tenir
 * le reste. Tout ce qui existe déjà — le relevé de TVA, l'export comptable, le
 * suivi des paiements — lit `totalHt` en croyant lire ce qui est dû. Y laisser
 * le prix plein aurait fait déclarer une TVA sur de l'argent que le client ne
 * paie pas, et il aurait fallu corriger chacun de ces endroits sans en oublier.
 * Le prix plein reste lisible dans `brutHt`, pour le document.
 */
export function totauxAvecReduction(
  lignes: readonly { montant: string; tauxTva?: string | null }[],
  tauxTva: string,
  reductionPourcent?: string | number | null,
): TotauxDevis {
  const brut = lignes.reduce((acc, l) => acc.plus(new Decimal(l.montant)), new Decimal(0));
  const pourcent = pourcentValide(reductionPourcent);

  // **Arrondi ici, une fois pour toutes.** Un montant retiré qu'on garderait à
  // pleine précision donnerait un net dont les deux décimales ne correspondent
  // plus à la soustraction écrite sur le papier — et le client refait le calcul.
  const montant = pourcent === null
    ? null
    : brut.times(new Decimal(pourcent)).dividedBy(100).toDecimalPlaces(2);

  const net = montant === null ? brut : brut.minus(montant);

  // ─── Le brut de chaque catégorie, dans l'ordre où ses lignes arrivent ─────
  //
  // **L'ordre est celui du tableau, pas celui des taux.** Sa première catégorie
  // est celle où il a commencé à écrire ; classer par taux décroissant lui
  // ferait relire un document réordonné à chaque ajout de ligne.
  const ordre: string[] = [];
  const brutParTaux = new Map<string, Decimal>();
  for (const ligne of lignes) {
    const taux = tauxDeLaLigne(ligne, tauxTva);
    const dejaVu = brutParTaux.get(taux);
    if (dejaVu === undefined) ordre.push(taux);
    brutParTaux.set(taux, (dejaVu ?? new Decimal(0)).plus(new Decimal(ligne.montant)));
  }
  // Un devis vide garde sa catégorie : l'écran doit pouvoir montrer « TVA 20 % »
  // avant qu'une seule ligne soit écrite, sinon le bloc des totaux clignote.
  if (ordre.length === 0) {
    const taux = new Decimal(tauxTva).toFixed(2);
    ordre.push(taux);
    brutParTaux.set(taux, new Decimal(0));
  }

  // ─── Le prix accordé se répartit AU PRORATA, et le centime résiduel se pose ─
  //
  // **C'est le piège de tout ce lot, et il ne se voit pas à l'œil.** Une remise
  // retirée du seul total laisserait chaque catégorie calculer sa TVA sur son
  // brut : le client paierait alors une TVA sur de l'argent qu'il ne verse pas,
  // et l'écart part dans une déclaration. La remise appartient donc à chaque
  // catégorie, en proportion de ce qu'elle porte.
  //
  // **Le résidu va à la plus grosse base, jamais à la dernière rencontrée.**
  // Trois catégories et une remise de 100,00 € peuvent rendre 33,33 + 33,33 +
  // 33,33 = 99,99 : il manque un centime, et le total ne retomberait pas sur la
  // soustraction imprimée juste au-dessus. On le pose là où il pèse le moins.
  const partReduction = new Map<string, Decimal>();
  if (montant !== null && brut.greaterThan(0)) {
    let reste = montant;
    let plusGrosse = ordre[0]!;
    for (const taux of ordre) {
      if (brutParTaux.get(taux)!.greaterThan(brutParTaux.get(plusGrosse)!)) plusGrosse = taux;
    }
    for (const taux of ordre) {
      if (taux === plusGrosse) continue;
      const part = montant.times(brutParTaux.get(taux)!).dividedBy(brut).toDecimalPlaces(2);
      partReduction.set(taux, part);
      reste = reste.minus(part);
    }
    partReduction.set(plusGrosse, reste);
  }

  // ─── Chaque catégorie arrondit SA TVA, et le total en est la somme ─────────
  //
  // Arrondir chaque taux puis sommer, plutôt que l'inverse : ce sont ces
  // lignes-là que le client lit et additionne. Un total qui ne vaudrait pas la
  // somme de ce qui est imprimé au-dessus fait douter de toute la feuille.
  const parTaux: CategorieTva[] = ordre.map((taux) => {
    const brutCat = brutParTaux.get(taux)!;
    const partCat = partReduction.get(taux) ?? null;
    const baseCat = partCat === null ? brutCat : brutCat.minus(partCat);
    return {
      taux,
      brutHt: brutCat.toFixed(2),
      reductionMontant: partCat === null ? null : partCat.toFixed(2),
      baseHt: baseCat.toFixed(2),
      tva: baseCat.times(new Decimal(taux)).dividedBy(100).toDecimalPlaces(2).toFixed(2),
    };
  });

  const tva = parTaux.reduce((acc, c) => acc.plus(new Decimal(c.tva)), new Decimal(0));

  return {
    brutHt: brut.toFixed(2),
    reductionPourcent: pourcent,
    reductionMontant: montant === null ? null : montant.toFixed(2),
    totalHt: net.toFixed(2),
    totalTva: tva.toFixed(2),
    totalTtc: net.plus(tva).toFixed(2),
    parTaux,
  };
}

/**
 * Les taux ouverts sur un document, dans l'ordre d'apparition de ses lignes.
 *
 * L'écran s'en sert pour dessiner ses catégories — y compris celle qui ne
 * porte encore aucune ligne, juste après « Ajouter une TVA ».
 */
export function tauxOuverts(
  lignes: readonly { tauxTva?: string | null }[],
  tauxDuDocument: string
): string[] {
  const vus: string[] = [];
  for (const ligne of lignes) {
    const taux = tauxDeLaLigne(ligne, tauxDuDocument);
    if (!vus.includes(taux)) vus.push(taux);
  }
  if (vus.length === 0) vus.push(new Decimal(tauxDuDocument).toFixed(2));
  return vus;
}

/** « 20 » plutôt que « 20.00 » — personne n'écrit deux décimales sur un taux rond. */
export function tauxLisible(taux: string): string {
  return new Decimal(taux).toDecimalPlaces(2).toString().replace(".", ",");
}

/**
 * Les lignes rangées sous leur catégorie — l'ordre du tableau, à l'écran comme
 * sur le papier.
 *
 * **Pourquoi regrouper plutôt que laisser l'ordre de saisie.** Sa demande est
 * une CATÉGORIE : « une catégorie s'ajoute et là je mets toutes mes lignes qui
 * seront en TVA à 10 ». Des lignes à 10 % éparpillées entre des lignes à 20 %
 * sous un même titre de catégorie ne seraient plus une catégorie du tout — et
 * le client, lui, ne pourrait pas vérifier le sous-total qu'il lit en face.
 *
 * **Une seule fonction pour les deux surfaces.** L'écran groupe et le PDF
 * groupe ; deux tris écrits séparément auraient fini par ranger différemment,
 * et il aurait relu un document qui ne ressemble plus à son écran.
 */
export function lignesParCategorie<T extends { tauxTva?: string | null }>(
  lignes: readonly T[],
  tauxDuDocument: string
): { taux: string; lignes: T[] }[] {
  const groupes: { taux: string; lignes: T[] }[] = [];
  for (const ligne of lignes) {
    const taux = tauxDeLaLigne(ligne, tauxDuDocument);
    const groupe = groupes.find((g) => g.taux === taux);
    if (groupe) groupe.lignes.push(ligne);
    else groupes.push({ taux, lignes: [ligne] });
  }
  // ═══════════════════════════════════════════════════════════════════════
  // **UN DEVIS VIDE GARDE SA CATÉGORIE — et l'oublier a cassé l'écran.**
  //
  // Rendre une liste vide était mathématiquement juste et pratiquement
  // désastreux : l'écran du devis dessine ses lignes ET son bouton « Ajouter
  // une ligne » à l'intérieur de chaque catégorie. Sans catégorie, plus de
  // bouton — **sur un devis neuf, c'est-à-dire au moment précis où il commence
  // à écrire**, il n'y avait plus rien pour ajouter la première ligne.
  //
  // Aucun type ne le voyait, et aucune suite base non plus : le calcul reste
  // juste sur zéro ligne. C'est la suite qui entre PAR LE BOUTON qui l'a
  // attrapé (`CLAUDE.md` §5 quater), au premier `page.click`.
  //
  // `totauxAvecReduction` tient déjà la même règle pour `parTaux` ; les deux
  // devaient s'accorder, sinon l'écran aurait dessiné une catégorie que les
  // totaux ignoraient.
  // ═══════════════════════════════════════════════════════════════════════
  if (groupes.length === 0) {
    groupes.push({ taux: new Decimal(tauxDuDocument).toFixed(2), lignes: [] });
  }
  return groupes;
}

/**
 * Ce que le document écrit sous le total — l'arrangement B, tel qu'il l'a choisi.
 *
 * Écrit ici et pas dans l'écran : la même phrase doit sortir à l'identique sur
 * l'écran du devis, sur son PDF, sur la facture et sur le PDF de la facture.
 * Quatre rédactions du même prix accordé finiraient par se contredire, et c'est
 * le client qui verrait la différence.
 *
 * **« Prix accordé au client », et pas « Réduction ».** C'est le mot qu'il a
 * désigné le 16 août, contre l'autre qu'il proposait lui-même.
 */
export const LIBELLE_REDUCTION = "Prix accordé au client";

/** « Prix accordé au client 15 % », ou `null` s'il n'y en a pas. */
export function libelleReduction(pourcent: string | null): string | null {
  if (pourcent === null) return null;
  // « 15 » plutôt que « 15.00 » : personne n'écrit deux décimales sur un
  // pourcentage rond, et le document est celui que son client lit.
  const lisible = new Decimal(pourcent).toDecimalPlaces(2).toString().replace(".", ",");
  return `${LIBELLE_REDUCTION} ${lisible} %`;
}
