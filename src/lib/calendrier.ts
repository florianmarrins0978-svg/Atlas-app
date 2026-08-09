import { jourIso } from "./jour";

/**
 * Une date au format `AAAA-MM-JJ`.
 *
 * Le même alias qu'en `src/server/disponibilites.ts`, redéclaré ici plutôt
 * qu'importé : ce fichier est chargé par la page PUBLIQUE du client, et tirer
 * un module serveur dans son paquet y ferait voyager du code qui n'a rien à y
 * faire. C'est un alias de `string`, sans comportement — le dupliquer ne
 * duplique aucune règle.
 */
export type JourIso = string;

// **Un vrai calendrier, des deux côtés — sa demande du 8 août 2026.**
//
// *« Passe au calendrier pour le choix des dates à proposer au client, mais
// également qu'il ait accès au calendrier pour pouvoir proposer une date, avec
// un système pour qu'il n'ait pas accès aux dates déjà prises par un autre
// client. »*
//
// **Ce qui existait, et pourquoi ça ne suffisait pas.** Les deux écrans
// utilisaient le sélecteur de date du téléphone (`<input type="date">`). Il
// accepte `min` et `max` — donc une fenêtre — mais **il ne sait pas griser des
// jours au milieu**. Le client pouvait donc choisir un mardi déjà pris, et ne
// l'apprenait qu'après coup, par un message d'erreur. C'est exactement ce que le
// patron veut supprimer : un client qui bute sur un refus rappelle, ou renonce.
//
// D'où une grille de mois écrite ici. Ce fichier ne connaît ni React, ni la
// base : **les règles se jouent sans navigateur** (`CLAUDE.md` §3), et l'écran
// n'affiche que le résultat.

/** Le premier jour de la semaine, en France. Lundi = 1 dans `getUTCDay` décalé. */
const LUNDI = 1;

export type CaseCalendrier = {
  jour: JourIso;
  /** Le jour appartient-il au mois affiché, ou déborde-t-il d'à côté ? */
  duMois: boolean;
};

/**
 * Les semaines d'un mois, du lundi au dimanche, cases de débordement comprises.
 *
 * **Pourquoi montrer les jours des mois voisins plutôt que des trous.** Une
 * grille trouée se lit mal : l'œil cherche la colonne, pas la case. Les jours
 * d'à côté sont affichés en retrait et ne se choisissent pas — c'est ce que fait
 * n'importe quel calendrier, et s'en écarter n'apporterait rien.
 *
 * @param annee  Année pleine, ex. 2026.
 * @param mois   1 pour janvier, 12 pour décembre — jamais l'index 0 de
 *               JavaScript, qui a déjà produit des décalages d'un mois dans ce
 *               projet.
 */
export function grilleDuMois(annee: number, mois: number): CaseCalendrier[][] {
  const premier = new Date(Date.UTC(annee, mois - 1, 1));
  // `getUTCDay` rend 0 pour dimanche : on le ramène à 7 pour que lundi = 1.
  const jourDeSemaine = premier.getUTCDay() === 0 ? 7 : premier.getUTCDay();
  const depart = new Date(premier);
  depart.setUTCDate(depart.getUTCDate() - (jourDeSemaine - LUNDI));

  const semaines: CaseCalendrier[][] = [];
  const curseur = new Date(depart);
  // Six semaines couvrent tous les cas — un mois de 31 jours commençant un
  // dimanche en occupe six. Une grille de hauteur fixe évite aussi que l'écran
  // saute en changeant de mois.
  for (let s = 0; s < 6; s++) {
    const semaine: CaseCalendrier[] = [];
    for (let j = 0; j < 7; j++) {
      semaine.push({
        jour: jourIso(curseur),
        duMois: curseur.getUTCMonth() === mois - 1 && curseur.getUTCFullYear() === annee,
      });
      curseur.setUTCDate(curseur.getUTCDate() + 1);
    }
    semaines.push(semaine);
  }
  return semaines;
}

export type MoisAffiche = { annee: number; mois: number };

export function moisDuJour(jour: JourIso): MoisAffiche {
  const [annee, mois] = jour.split("-").map(Number);
  return { annee, mois };
}

export function moisSuivant(m: MoisAffiche): MoisAffiche {
  return m.mois === 12 ? { annee: m.annee + 1, mois: 1 } : { annee: m.annee, mois: m.mois + 1 };
}

export function moisPrecedent(m: MoisAffiche): MoisAffiche {
  return m.mois === 1 ? { annee: m.annee - 1, mois: 12 } : { annee: m.annee, mois: m.mois - 1 };
}

/** « août 2026 ». L'année est toujours écrite : on navigue à dix-huit mois. */
export function libelleMois(m: MoisAffiche): string {
  return new Date(Date.UTC(m.annee, m.mois - 1, 1)).toLocaleDateString("fr-FR", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

/** Le mois est-il compris entre celui de `debut` et celui de `fin` ? */
export function moisDansFenetre(m: MoisAffiche, debut: JourIso, fin: JourIso): boolean {
  const rang = m.annee * 12 + m.mois;
  const rangDe = (j: JourIso) => {
    const { annee, mois } = moisDuJour(j);
    return annee * 12 + mois;
  };
  return rang >= rangDe(debut) && rang <= rangDe(fin);
}

export type EtatJour = "choisissable" | "retenu" | "occupe" | "hors_fenetre";

/**
 * Ce qu'une case peut être, et l'ordre dans lequel les raisons se lisent.
 *
 * **L'ordre n'est pas indifférent.** Un jour hors fenêtre ET occupé se dit
 * « hors fenêtre » : dire au client qu'un jour de l'an prochain est « déjà
 * pris » lui apprendrait quelque chose sur le planning du patron, et c'est
 * précisément ce que la page du client ne doit jamais laisser filtrer
 * (`docs/AGENT.md` §2.2 bis — *des dates, rien d'autre*).
 *
 * Un jour déjà retenu se dit « retenu » avant d'être dit « occupé » : c'est le
 * chantier en cours qui l'occupe, et le montrer barré donnerait à croire qu'on
 * ne peut plus le choisir.
 */
export function etatDuJour(
  jour: JourIso,
  options: {
    debut: JourIso;
    fin: JourIso;
    /** Les jours pris par d'autres chantiers. Jamais leurs noms. */
    occupes: readonly JourIso[];
    /** Ce qui est déjà coché sur cet écran. */
    retenus: readonly JourIso[];
  }
): EtatJour {
  if (jour < options.debut || jour > options.fin) return "hors_fenetre";
  if (options.retenus.includes(jour)) return "retenu";
  if (options.occupes.includes(jour)) return "occupe";
  return "choisissable";
}

/**
 * Ajoute ou retire un jour d'une sélection bornée.
 *
 * **Pourquoi une fonction pure plutôt que trois lignes dans l'écran.** La règle
 * « une ou deux dates, jamais plus » vient du patron (`docs/AGENT.md` §2.2) et
 * elle est déjà vérifiée par le serveur au moment de l'envoi. Écrite deux fois,
 * elle finirait par diverger — et l'écart se verrait chez le client, pas ici.
 *
 * Au-delà du maximum, **le plus ancien choix cède la place** plutôt que de
 * refuser en silence : un bouton qui ne répond pas se lit comme une panne.
 */
export function basculerJour(retenus: readonly JourIso[], jour: JourIso, maximum: number): JourIso[] {
  if (retenus.includes(jour)) return retenus.filter((j) => j !== jour);
  if (maximum < 1) return [...retenus];
  const suivants = [...retenus, jour];
  return suivants.slice(Math.max(0, suivants.length - maximum));
}
