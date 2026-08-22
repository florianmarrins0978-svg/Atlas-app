/**
 * Retrouver un client déjà connu au moment de créer un chantier.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * **D'OÙ ÇA VIENT.** Le patron, le 17 août 2026, après avoir vu sa toute
 * nouvelle fiche client annoncer « 1 chantier » chez quelqu'un qu'il connaît
 * depuis des mois : *« si je crée un nouveau chantier, mais que c'est monsieur
 * Martins et qu'on a déjà une fiche client monsieur Martins, [il faut que] le
 * devis, la facture s'ajoute à la fiche client de monsieur Martins qui est déjà
 * créé. »*
 *
 * Jusque-là, `creerClient` insérait **toujours**. Deux chantiers pour le même
 * homme faisaient deux clients, et sa fiche ne pouvait, par construction, rien
 * apprendre : elle comptait un chantier de plus qu'elle n'en avait jamais.
 *
 * **Il a explicitement écarté qu'on lui propose une liste de correspondances**
 * (« non justement, il ne faut pas ») : le rapprochement est automatique, sans
 * geste de sa part.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * **CE QUI EST EN JEU, ET POURQUOI LES RÈGLES CI-DESSOUS SONT PRUDENTES.**
 *
 * Rapprocher à tort, c'est verser le chiffre d'affaires d'un homme sur la fiche
 * d'un autre — et, si son fils s'appelle aussi Martins, lui montrer une dette
 * qui n'est pas la sienne. C'est le seul risque de cette fonctionnalité, et il
 * ne se répare pas d'un clic.
 *
 * Donc : **une coordonnée qui CONTREDIT interdit le rapprochement.** Deux
 * « Martins » dont les téléphones diffèrent sont deux hommes, et la fiche
 * reste séparée. C'est le contraire d'un rapprochement « au plus proche » :
 * ici, le doute crée une fiche neuve plutôt que d'en salir une bonne.
 *
 * Ce qui n'est **jamais** fait : écraser une coordonnée déjà connue. Ce qu'il
 * tape à la volée sur un chantier complète les cases vides de la fiche, il
 * n'efface pas le numéro qu'il avait pris le temps de noter (`CLAUDE.md` §4).
 */

import { aDejaUneCivilite } from "./civilite";

/** Un client déjà en base, réduit à ce qui sert à le reconnaître. */
export type ClientExistant = {
  id: string;
  nom: string;
  telephone: string | null;
  email: string | null;
  adresse: string | null;
  /** Pour départager deux homonymes que rien d'autre ne sépare. */
  creeLe: Date | string;
};

/** Ce que le patron vient de taper dans l'écran de création. */
export type SaisieClient = {
  nom: string;
  telephone?: string | null;
  email?: string | null;
  adresse?: string | null;
};

export type Rapprochement =
  | {
      type: "reutiliser";
      id: string;
      /** `coordonnee` : le téléphone ou l'e-mail concordent. `nom` : le nom seul. */
      motif: "coordonnee" | "nom";
    }
  | {
      type: "creer";
      /** `inconnu` : personne de ce nom. `contradiction` : ce nom existe, mais
       *  avec d'autres coordonnées — c'est quelqu'un d'autre. */
      motif: "inconnu" | "contradiction";
    };

/** Sans accents ni casse : « Rivière » et « RIVIERE » sont le même homme. */
function aplati(texte: string): string {
  // Les signes combinants en échappement, jamais en clair : posés avec de vrais
  // accents, ils ne se relisent pas et se cassent au premier outil qui
  // normalise le fichier (même règle que `src/lib/civilite.ts`).
  return texte.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

/**
 * Le nom tel qu'on le compare : sans civilité, sans casse, sans accents, sans
 * ponctuation, espaces réduits.
 *
 * **La civilité saute, et ce n'est pas cosmétique.** Elle vit dans sa propre
 * colonne depuis la migration 0038, mais les clients d'avant la portent dans
 * leur nom (« M. Bernard »), et il lui arrive encore de la taper. Comparer les
 * chaînes brutes ferait de « Martins » et « M. Martins » deux personnes — soit
 * exactement le défaut qu'on répare.
 */
export function nomRapproche(nom: string): string {
  let mots = aplati(nom.trim()).split(/[^0-9a-z]+/).filter(Boolean);
  // `aDejaUneCivilite` porte la liste des graphies, et une seule liste doit
  // exister (`CLAUDE.md` §3) : deux copies finiraient par diverger sur « Me ».
  if (mots.length > 1 && aDejaUneCivilite(nom)) mots = mots.slice(1);
  return mots.join(" ");
}

/**
 * Le téléphone tel qu'on le compare : ses chiffres, et rien d'autre.
 *
 * « 06 12 34 56 78 », « 06.12.34.56.78 » et « +33 6 12 34 56 78 » sont le même
 * numéro. L'indicatif français est ramené au zéro initial — sans quoi le même
 * homme, noté deux fois de deux façons, passerait pour une contradiction et
 * fabriquerait la fiche en double qu'on cherche à éviter.
 */
export function telephoneRapproche(telephone: string | null | undefined): string {
  const chiffres = (telephone ?? "").replace(/\D/g, "");
  if (!chiffres) return "";
  if (chiffres.startsWith("33") && chiffres.length === 11) return `0${chiffres.slice(2)}`;
  return chiffres;
}

/** L'e-mail tel qu'on le compare : sans casse ni espaces autour. */
export function emailRapproche(email: string | null | undefined): string {
  return (email ?? "").trim().toLowerCase();
}

function plusRecent(a: ClientExistant, b: ClientExistant): ClientExistant {
  return new Date(b.creeLe).getTime() > new Date(a.creeLe).getTime() ? b : a;
}

/**
 * Faut-il réutiliser une fiche existante, et laquelle ?
 *
 * L'ordre des règles est le raisonnement lui-même :
 *
 *   1. **personne de ce nom** → on crée, il n'y a rien à discuter ;
 *   2. **une coordonnée concorde** → c'est lui, sans le moindre doute ;
 *   3. **une coordonnée contredit** → ce n'est pas lui ; les homonymes qui se
 *      contredisent sont écartés un par un, pas en bloc : deux « Martins » en
 *      base, dont un seul porte un autre numéro, laissent le bon disponible ;
 *   4. **le nom seul, sans rien qui contredise** → c'est lui. C'est le cas
 *      courant : il tape un nom, rien d'autre, et attend qu'on s'en souvienne ;
 *   5. **plusieurs homonymes indiscernables** → le plus récent. Aucun choix
 *      n'est meilleur qu'un autre, et en créer un troisième serait le seul
 *      choix sûrement mauvais.
 */
export function rapprocherClient(
  saisie: SaisieClient,
  existants: readonly ClientExistant[]
): Rapprochement {
  const nom = nomRapproche(saisie.nom);
  if (!nom) return { type: "creer", motif: "inconnu" };

  const homonymes = existants.filter((c) => nomRapproche(c.nom) === nom);
  if (homonymes.length === 0) return { type: "creer", motif: "inconnu" };

  const tel = telephoneRapproche(saisie.telephone);
  const mail = emailRapproche(saisie.email);

  // 2. Une coordonnée qui concorde tranche tout le reste.
  const concordants = homonymes.filter(
    (c) =>
      (tel && telephoneRapproche(c.telephone) === tel) ||
      (mail && emailRapproche(c.email) === mail)
  );
  if (concordants.length > 0) {
    return { type: "reutiliser", id: concordants.reduce(plusRecent).id, motif: "coordonnee" };
  }

  // 3. Ceux qui portent une AUTRE coordonnée sont quelqu'un d'autre.
  const compatibles = homonymes.filter((c) => {
    const sonTel = telephoneRapproche(c.telephone);
    if (tel && sonTel && sonTel !== tel) return false;
    const sonMail = emailRapproche(c.email);
    if (mail && sonMail && sonMail !== mail) return false;
    return true;
  });
  if (compatibles.length === 0) return { type: "creer", motif: "contradiction" };

  return { type: "reutiliser", id: compatibles.reduce(plusRecent).id, motif: "nom" };
}

/**
 * Ce qu'il faut écrire sur la fiche retrouvée — les cases VIDES, et elles
 * seules.
 *
 * **Rien n'est jamais écrasé.** Il crée un chantier à la volée entre deux
 * clients, tape un portable au lieu du fixe qu'il avait noté : garder les deux
 * est impossible, choisir le nouveau lui ferait perdre l'ancien sans le lui
 * dire. Une fiche existante est sa donnée ; ce chantier-ci n'a pas autorité
 * dessus.
 *
 * Rend un objet vide quand il n'y a rien à compléter — l'appelant peut alors
 * ne rien écrire du tout plutôt que de toucher `updated_at` pour rien.
 */
export function complementsPourFiche(
  existant: ClientExistant,
  saisie: SaisieClient
): { telephone?: string; email?: string; adresse?: string } {
  const complements: { telephone?: string; email?: string; adresse?: string } = {};
  const tel = saisie.telephone?.trim();
  const mail = saisie.email?.trim();
  const adresse = saisie.adresse?.trim();
  if (tel && !existant.telephone?.trim()) complements.telephone = tel;
  if (mail && !existant.email?.trim()) complements.email = mail;
  if (adresse && !existant.adresse?.trim()) complements.adresse = adresse;
  return complements;
}
