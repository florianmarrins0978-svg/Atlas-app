import type { ParametresPlan } from "./consignes";

/**
 * LE Ø25 OU LE Ø32, CHOISI SUR L'ÉCRAN — « la C », sa réponse du 20 octobre
 * 2026 (`appli/arrosage-choix-du-diametre.html`).
 *
 * *« Il fait le calcul en diamètre 25 ; si le 25 ne passe pas, il rajoute un
 * réseau. »* Le Ø32 se choisit sur l'amenée et réseau par réseau, et l'écran
 * dit aussitôt ce que ça change : *« pouvoir choisir Ø25 ou Ø32 et voir tout de
 * suite ce que ça change, et l'inverse : refuser le Ø32 proposé »*.
 *
 * Deux règles pures : poser le choix sur les paramètres (le calcul refait le
 * plan, comme pour toute autre consigne), et écrire la phrase qui compare le
 * plan d'avant au plan d'après. Aucun second calcul : la phrase lit ce que le
 * même calcul a rendu, avant et après.
 */

/** L'amenée, ou un réseau par son numéro (à partir de 0). */
export type OuLeTuyau = "amenee" | number;

/** Ce qu'il faut d'un plan pour dire ce qu'un tuyau a changé. */
export type Releve = { reseaux: number; tetes: number[] };

/**
 * Les paramètres, le tuyau posé dessus. Une COPIE, comme `appliquer` : les
 * paramètres d'origine sont ceux que l'écran montre encore.
 *
 * **Au robinet, le départ suit** : le départ choisi à la main (`robinet.depart`)
 * passerait devant le diamètre que le calcul retient, et l'écran montrerait un
 * tuyau que le calcul n'a pas compté. On le rend au choix de l'outil, qui est
 * désormais le sien.
 */
export function poserLeTuyau(parametres: ParametresPlan, ou: OuLeTuyau, diametre: 25 | 32): ParametresPlan {
  const avant = parametres.diametres ?? {};
  if (ou === "amenee") {
    return {
      ...parametres,
      diametres: { ...avant, amenee: diametre },
      ...(parametres.robinet ? { robinet: { ...parametres.robinet, depart: null } } : {}),
    };
  }
  return { ...parametres, diametres: { ...avant, reseaux: { ...(avant.reseaux ?? {}), [ou]: diametre } } };
}

/**
 * La phrase sous les cases, une fois le tuyau changé : ce que le jardin y a
 * gagné ou perdu, et rien quand rien n'a bougé.
 *
 * **« Rien ne change » se dit aussi.** Taire ce cas laisserait croire que le
 * calcul n'a pas tourné, et il rebasculerait pour voir.
 */
export function ceQueLeTuyauChange(avant: Releve, apres: Releve, ou: OuLeTuyau, diametre: 25 | 32): string {
  const morceaux: string[] = [];
  if (typeof ou === "number") {
    const a = avant.tetes[ou], b = apres.tetes[ou];
    if (a !== undefined && b !== undefined && a !== b) {
      morceaux.push(`${b} arroseur${b > 1 ? "s" : ""} sur ce réseau au lieu de ${a}`);
    }
  }
  // **Le jardin entier, quand le tuyau a fait changer de buse** : sur une
  // pelouse de 20 x 12, le Ø32 fait passer de 12 têtes sur deux réseaux à 6
  // têtes plus puissantes sur un seul. Ne dire que « un réseau de moins »
  // taisait la moitié du changement.
  const total = (r: Releve) => r.tetes.reduce((t, n) => t + n, 0);
  if (total(avant) !== total(apres)) {
    morceaux.push(`${total(apres)} arroseur${total(apres) > 1 ? "s" : ""} au lieu de ${total(avant)} sur le jardin`);
  }
  const ecart = apres.reseaux - avant.reseaux;
  if (ecart !== 0) {
    const n = Math.abs(ecart);
    morceaux.push(`${n === 1 ? "un" : n} réseau${n > 1 ? "x" : ""} de ${ecart > 0 ? "plus" : "moins"}`);
  }
  return morceaux.length
    ? `En Ø${diametre} : ${morceaux.join(", ")}.`
    : `En Ø${diametre} : rien ne change sur ce jardin.`;
}
