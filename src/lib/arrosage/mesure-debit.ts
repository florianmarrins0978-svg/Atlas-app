/**
 * D'où vient le débit disponible, et ce qu'on en sait vraiment.
 *
 * **Sa correction du 20 août 2026 au soir**, sur capture : *« quand je choisis
 * le piquage, qu'il se fait après le compteur d'eau, rien ne doit s'afficher.
 * […] Or, quand je choisis piquage après robinet, là un encart doit s'ouvrir en
 * me demandant de remplir un seau de dix litres et de noter le nombre de
 * secondes que ça prend, ou de mesurer la pression dynamique à l'aide d'un
 * manomètre. »*
 *
 * ─────────────────────────────────────────────────────────────────────────
 * TROIS SITUATIONS, ET ELLES NE SE VALENT PAS.
 *
 * | D'où part l'eau | Ce qu'on sait | Ce qu'on fait |
 * |---|---|---|
 * | Le compteur, en Ø25 | **au moins 3 bar**, en dynamique comme en statique | on calcule, et on ne demande RIEN |
 * | Ailleurs, seau chronométré | le débit, MESURÉ | on s'en sert tel quel |
 * | Ailleurs, manomètre seul | la pression, rien sur le débit | on ESTIME, et on l'écrit |
 *
 * **La pression qui compte est la DYNAMIQUE, relevée avec une buse taille 5** —
 * sa précision du 20 août au soir. Robinet fermé, un manomètre lit la pression
 * statique, toujours flatteuse : c'est en débit, à travers une buse calibrée,
 * que le chiffre dit ce qui arrivera vraiment aux arroseurs. L'étiquette de
 * l'écran le porte, faute de quoi il mesurerait la bonne grandeur au mauvais
 * moment.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * POURQUOI LE COMPTEUR NE SE MESURE PAS, ET C'EST SON MÉTIER QUI LE DIT.
 *
 * *Le 20 août 2026 au soir :* « si on se repique directement après le compteur
 * d'eau en diamètre vingt-cinq, on aura au moins trois bars de pression
 * dynamique, et pareil en pression statique — donc on sera très bien pour faire
 * l'arrosage. C'est pour ça que si la personne décide de se repiquer après le
 * compteur, tu n'as pas besoin de lui demander les calculs : tu sais d'office
 * que tu es bien. Tu peux faire tes calculs comme si tu avais trois bars. »
 *
 * **Aucune réserve n'est donc écrite dans ce cas** — et c'est une correction de
 * ma part. La première version avertissait « débit estimé, à vérifier au seau
 * sur place » : un avertissement inutile s'apprend à être ignoré, et celui-là
 * aurait fait douter de la seule situation où il n'y a rien à vérifier.
 *
 * **La pression ne donne pas le débit**, et c'est le piège de cet écran. Deux
 * robinets à 3 bar peuvent délivrer l'un 1 m³/h, l'autre 3, selon le diamètre
 * et la longueur de ce qui les alimente. Un plan bâti sur une pression prise
 * pour un débit met trop d'arroseurs sur un réseau — et c'est le paysagiste qui
 * revient en poser un de moins, après que le client a vu son gazon jaunir d'un
 * côté.
 *
 * **Une estimation s'écrit, elle ne se cache pas** (`CLAUDE.md` §4). Chaque
 * retour porte sa `reserve` : elle remonte jusque sous le plan, en rouge.
 */

/** Le seau du maçon : dix litres. Il l'a dit, et le demander serait une case de plus. */
export const SEAU_LITRES = 10;

/**
 * Le débit retenu pour un piquage au compteur, en m³/h.
 *
 * **Ce n'est pas un chiffre de catalogue : c'est SA mesure.** Sur sa capture du
 * 20 août — seau de 10 L rempli en 20 s — l'outil affichait 1,80 m³/h, sur son
 * propre branchement. C'est la seule mesure relevée sur un vrai compteur dont ce
 * dépôt dispose ; le jour où il en fait d'autres, elle se corrige ici, à un seul
 * endroit.
 */
export const DEBIT_COMPTEUR = 1.8;

/**
 * La pression retenue au compteur, en bar.
 *
 * **Trois bars, en dynamique comme en statique**, sur un piquage en Ø25 — c'est
 * son métier qui le dit, et il l'a dit en toutes lettres. Le calcul s'appuie
 * dessus sans rien demander.
 */
export const PRESSION_COMPTEUR = 3;

/**
 * Le seuil sous lequel les arroseurs ne se lèvent pas, en bar.
 *
 * **Sa règle du 20 août 2026 au soir :** *« si il y a 2,5 bar, 3 bar en
 * dynamique, alors c'est parfait, c'est ce qu'il faut pour que les arroseurs se
 * lèvent correctement — tu peux faire tes calculs. »*
 *
 * En dessous, une turbine sort mal de son fourreau, tourne au ralenti ou ne
 * tourne pas : le gazon fait des taches jaunes en arc de cercle, et le
 * paysagiste revient. Le plan se calcule quand même — c'est son métier de
 * décider — mais l'écran le DIT.
 */
export const BAR_MINIMUM_DYNAMIQUE = 2.5;

/**
 * La pression retenue quand SEUL le seau a été mesuré, en bar.
 *
 * **Sa règle du 21 août 2026 :** *« au seau, une fois que tu as dix-huit, vingt
 * secondes, on va dire que ce n'est pas trop mal : tu peux faire le calcul
 * comme si tu avais deux bars cinq en dynamique. »*
 *
 * **Ce n'est pas la même valeur qu'au compteur, et c'est tout le sujet.** Au
 * compteur, le Ø25 garantit ses 3 bar : la conduite est connue. À un robinet de
 * jardin, on ne sait rien de ce qui l'alimente — on retient donc le MINIMUM
 * viable plutôt que le confortable. Se tromper vers le bas met un arroseur de
 * moins par réseau ; se tromper vers le haut en met un de trop, et c'est le
 * gazon qui jaunit en bout de ligne.
 */
export const BAR_SUPPOSE_AU_SEAU = 2.5;

export type MesureSaisie = {
  piquage: string;
  /** Secondes pour remplir le seau de 10 L. `null` : non mesuré. */
  secondes: number | null;
  /**
   * Pression **statique**, robinet fermé, au kit buse 5. `null` : non mesurée.
   *
   * Elle ne sert pas au calcul : elle sert à voir la CHUTE. Un écart important
   * entre statique et dynamique dit que la conduite qui alimente le robinet est
   * trop petite ou trop longue — et c'est une information qu'aucun des deux
   * chiffres ne donne seul.
   */
  barStatique: number | null;
  /** Pression **dynamique**, en débit, au kit buse 5. C'est celle qui compte. */
  barDynamique: number | null;
};

export type DebitRetenu =
  | { ok: true; debit: number; pression: number; mesure: "compteur" | "seau" | "estime"; reserve: string | null }
  | { ok: false; raison: string };

/**
 * Ce qu'on retient du débit, et d'où on le tient.
 *
 * Rend `ok: false` quand rien ne permet de conclure — plutôt que de poser un
 * chiffre plausible. Un plan calculé sur un débit inventé a toutes les
 * apparences d'un plan juste.
 */
export function debitRetenu(saisie: MesureSaisie): DebitRetenu {
  if (saisie.piquage === "compteur") {
    // **Rien à demander, rien à signaler.** En Ø25 après compteur, on a au
    // moins 3 bar : c'est la situation où l'on est sûr d'être bien, et un
    // avertissement y ferait douter pour rien.
    return {
      ok: true,
      debit: DEBIT_COMPTEUR,
      pression: PRESSION_COMPTEUR,
      mesure: "compteur",
      reserve: null,
    };
  }

  const dyn = saisie.barDynamique !== null && saisie.barDynamique > 0 ? saisie.barDynamique : null;
  const stat = saisie.barStatique !== null && saisie.barStatique > 0 ? saisie.barStatique : null;

  // **Les réserves s'empilent, elles ne se remplacent pas.** Un débit estimé ET
  // une pression trop faible sont deux problèmes distincts : n'en dire qu'un
  // laisserait l'autre se découvrir sur le chantier.
  const reserves: string[] = [];

  if (dyn !== null && dyn < BAR_MINIMUM_DYNAMIQUE) {
    reserves.push(
      `${dyn.toString().replace(".", ",")} bar en dynamique : sous ` +
        `${BAR_MINIMUM_DYNAMIQUE.toString().replace(".", ",")} bar, les arroseurs risquent de ne pas se lever`
    );
  }
  // **La chute entre statique et dynamique accuse la CONDUITE**, pas le réseau.
  // Plus d'un bar et demi de perte veut dire que ce qui alimente le robinet est
  // trop étroit ou trop long — un piquage plus en amont réglerait tout.
  if (stat !== null && dyn !== null && stat - dyn > 1.5) {
    reserves.push(
      `${(stat - dyn).toFixed(1).replace(".", ",")} bar de chute entre statique et dynamique : ` +
        "la conduite qui alimente ce robinet est étroite ou longue"
    );
  }

  // **Le seau d'abord : c'est la seule mesure du débit.** S'il l'a fait, elle
  // prime sur toute estimation, même quand les pressions sont relevées.
  if (saisie.secondes !== null && saisie.secondes > 0) {
    const debit = (SEAU_LITRES / saisie.secondes) * 3.6;
    if (dyn === null) {
      reserves.push(
        `pression non relevée : calcul mené à ${BAR_SUPPOSE_AU_SEAU.toString().replace(".", ",")} bar`
      );
    }
    return {
      ok: true,
      debit: Math.round(debit * 100) / 100,
      // **La DYNAMIQUE, jamais la statique.** C'est elle qui décide de la portée
      // des arroseurs ; la statique, robinet fermé, est toujours flatteuse.
      //
      // **Et sans manomètre : 2,5 bar, pas 3.** À un robinet, rien ne garantit
      // le Ø25 du compteur — on retient le minimum viable (sa règle du 21 août).
      pression: dyn ?? BAR_SUPPOSE_AU_SEAU,
      mesure: "seau",
      reserve: reserves.length > 0 ? reserves.join(" · ") : null,
    };
  }

  if (dyn !== null) {
    reserves.push(
      "la pression ne donne pas le débit : il est ESTIMÉ à " +
        `${DEBIT_COMPTEUR.toFixed(2).replace(".", ",")} m³/h — chronométrez un seau de ` +
        `${SEAU_LITRES} L pour le mesurer`
    );
    return {
      ok: true,
      debit: DEBIT_COMPTEUR,
      pression: dyn,
      mesure: "estime",
      reserve: reserves.join(" · "),
    };
  }

  return {
    ok: false,
    raison:
      `Aucune mesure : chronométrez un seau de ${SEAU_LITRES} L, ` +
      "ou relevez la pression dynamique au kit buse 5.",
  };
}
