/**
 * LES RETOUCHES DU PATRON SUR SON PLAN — ce qu'il change, supprime ou ajoute,
 * et rien d'autre : le plan lui-même ne bouge pas, c'est le calcul qui le fait.
 *
 * *« Il faut que l'utilisateur puisse modifier ou supprimer toutes les pièces
 * qu'on lui propose »* (18 octobre 2026). Une pièce supprimée RESTE à l'écran,
 * grisée et barrée (17 octobre) ; une pièce changée montre sa remplaçante ; une
 * pièce ajoutée entre dans la liste à sa place. Et quand une pièce est en
 * plusieurs exemplaires, il choisit COMBIEN il en touche, par un bandeau
 * déroulant « Combien » puis le geste, « la A » de sa planche du 18 octobre.
 *
 * **Tout est une valeur, et chaque geste rend une nouvelle valeur.** Rien ici
 * ne touche l'écran ni la base : la même table se relit pour dessiner, pour
 * compter la liste et pour écrire le message au fournisseur, et une suite
 * l'éprouve sans navigateur. Les clés sont celles des postes
 * (`postes.ts`) : `r0:t3:corps`, `nr:union`, `am:pe`, `plus:<n>`.
 */

export type PieceChoisie = { ref: string; nom: string };

export type Ajoutee = {
  /** Un identifiant qui ne se répète pas : il vient de l'appelant, pour rester pur. */
  n: number;
  /** Où elle entre : `amenee`, `r2`, ou `liste:<titre du groupe>`. */
  ou: string;
  ref: string;
  nom: string;
  q: number;
  /** La pièce de nourrice qu'elle remplace, quand elle en remplace une (« Remettre » la ressort). */
  de: string | null;
};

export type Retouches = {
  retirees: Record<string, true>;
  remplacees: Record<string, PieceChoisie>;
  ajoutees: Ajoutee[];
  /** Une ligne de la liste : combien de pièces en sont sorties (`<titre>|<ref>`). */
  listeRetirees: Record<string, number>;
  /** Une pièce de nourrice en plusieurs exemplaires : combien sont sorties du compte. */
  nrUne: Record<string, number>;
  sonde: boolean;
  grillage: boolean;
  teflon: boolean;
  /** La couronne de tube goutte-à-goutte que vend son fournisseur : 50 m par défaut, 100 au choix. */
  couronne: 50 | 100;
  /** Une seule ligne, ou deux en circuit fermé, pour le goutte-à-goutte. */
  sortie: "ligne" | "boucle";
};

export const RETOUCHES_VIERGES: Retouches = {
  retirees: {},
  remplacees: {},
  ajoutees: [],
  listeRetirees: {},
  nrUne: {},
  sonde: false,
  grillage: false,
  teflon: false,
  couronne: 50,
  sortie: "boucle",
};

/**
 * Les clés des pièces du départ au robinet : changer de montage les rend à la
 * proposition (une double sortie supprimée dans un montage ne doit pas rester
 * barrée dans l'autre, où elle n'est pas la même pile).
 */
export function oublierLeDepart(r: Retouches): Retouches {
  const duDepart = (cle: string) => cle.startsWith("am:");
  const retirees: Record<string, true> = {}, remplacees: Record<string, PieceChoisie> = {};
  for (const [k, v] of Object.entries(r.retirees)) if (!duDepart(k)) retirees[k] = v;
  for (const [k, v] of Object.entries(r.remplacees)) if (!duDepart(k)) remplacees[k] = v;
  return { ...r, retirees, remplacees };
}

const sans = <T>(table: Record<string, T>, cle: string): Record<string, T> => {
  const copie = { ...table };
  delete copie[cle];
  return copie;
};

// ── Une pièce, par sa clé ────────────────────────────────────────────────────

/** Supprimer : une pièce ajoutée disparaît, une pièce proposée reste barrée. */
export function supprimer(r: Retouches, cle: string): Retouches {
  if (cle.startsWith("plus:")) return { ...r, ajoutees: r.ajoutees.filter((a) => `plus:${a.n}` !== cle) };
  return { ...r, retirees: { ...r.retirees, [cle]: true } };
}
export function remettre(r: Retouches, cle: string): Retouches {
  return { ...r, retirees: sans(r.retirees, cle) };
}
/** Changer : la remplaçante prend la place, et une pièce barrée revient. */
export function remplacer(r: Retouches, cle: string, piece: PieceChoisie): Retouches {
  return { ...r, remplacees: { ...r.remplacees, [cle]: piece }, retirees: sans(r.retirees, cle) };
}
export function revenir(r: Retouches, cle: string): Retouches {
  return { ...r, remplacees: sans(r.remplacees, cle) };
}
export function ajouter(r: Retouches, ou: string, piece: PieceChoisie, n: number, q = 1, de: string | null = null): Retouches {
  return { ...r, ajoutees: [...r.ajoutees, { n, ou, ref: piece.ref, nom: piece.nom, q, de }] };
}

// ── La nourrice : ses pièces se touchent par leur numéro ─────────────────────
//
// Une pièce en plusieurs exemplaires (« il y a 4 pièces numéro 6, mais j'ai
// envie d'en changer qu'une ») : `n` sortent du compte, et la remplaçante
// entre dans la liste de la nourrice au même nombre.

export function nourriceSupprimer(r: Retouches, ref: string, n: number): Retouches {
  return { ...r, nrUne: { ...r.nrUne, [ref]: (r.nrUne[ref] ?? 0) + n } };
}
export function nourriceRemplacer(r: Retouches, ref: string, n: number, piece: PieceChoisie, titreNourrice: string, id: number): Retouches {
  return ajouter(nourriceSupprimer(r, ref, n), `liste:${titreNourrice}`, piece, id, n, ref);
}
/** Remettre rend aussi les remplaçantes entrées à leur place dans la liste. */
export function nourriceRemettre(r: Retouches, ref: string): Retouches {
  return { ...r, nrUne: sans(r.nrUne, ref), ajoutees: r.ajoutees.filter((a) => a.de !== ref) };
}

// ── La chaîne d'une tête : la même pièce sur les têtes d'un réseau ───────────
//
// Les clés sont celles de chaque tête ; les `n` premières encore entières sont
// touchées, les autres restent. Changer reprend d'abord les têtes non changées.

const vivantes = (r: Retouches, cles: string[]) => cles.filter((c) => !r.retirees[c]);

export function chaineSupprimer(r: Retouches, cles: string[], n: number): Retouches {
  const retirees = { ...r.retirees };
  for (const c of vivantes(r, cles).slice(0, n)) retirees[c] = true;
  return { ...r, retirees };
}
export function chaineRemettre(r: Retouches, cles: string[]): Retouches {
  const retirees = { ...r.retirees };
  for (const c of cles) delete retirees[c];
  return { ...r, retirees };
}
export function chaineRevenir(r: Retouches, cles: string[]): Retouches {
  const remplacees = { ...r.remplacees };
  for (const c of cles) delete remplacees[c];
  return { ...r, remplacees };
}
/** Les clés que « Changer n » vise : les têtes entières, celles pas encore changées d'abord. */
export function clesAChanger(r: Retouches, cles: string[], n: number): string[] {
  const v = vivantes(r, cles);
  return [...v.filter((c) => !r.remplacees[c]), ...v.filter((c) => r.remplacees[c])].slice(0, n);
}
export function chaineRemplacer(r: Retouches, cles: string[], piece: PieceChoisie): Retouches {
  const remplacees = { ...r.remplacees }, retirees = { ...r.retirees };
  for (const c of cles) { remplacees[c] = piece; delete retirees[c]; }
  return { ...r, remplacees, retirees };
}

// ── Les lignes de la liste, en mode « Modifier ma liste » ────────────────────

export function ligneSupprimer(r: Retouches, cle: string, n: number): Retouches {
  return { ...r, listeRetirees: { ...r.listeRetirees, [cle]: (r.listeRetirees[cle] ?? 0) + n } };
}
export function ligneRemettre(r: Retouches, cle: string): Retouches {
  return { ...r, listeRetirees: sans(r.listeRetirees, cle) };
}

/** Combien de gestes à la main portent sur le plan : ce que la liste n'est plus celle du calcul. */
export function nombreDeRetouches(r: Retouches): number {
  return Object.keys(r.retirees).length + Object.keys(r.remplacees).length + r.ajoutees.length + Object.keys(r.listeRetirees).length + Object.keys(r.nrUne).length;
}
