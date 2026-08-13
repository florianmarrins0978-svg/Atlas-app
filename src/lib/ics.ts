/**
 * Le format iCalendar : le lire, et l'écrire.
 *
 * **Pourquoi Atlas en a besoin.** Le patron tient son agenda dans le Calendrier
 * d'Apple, sur un compte iCloud (sa réponse du 12 août 2026), et il veut les
 * deux sens : qu'Atlas lise ses rendez-vous pour ne plus proposer une
 * demi-journée déjà prise, et qu'il y écrive ses chantiers. iCloud ne parle ni
 * JSON ni OAuth : il parle CalDAV, et CalDAV transporte de l'iCalendar.
 *
 * **Ce module ne parle à personne**, exactement comme `agenda-externe.ts` : il
 * reçoit du texte et rend des périodes, il reçoit un chantier et rend du texte.
 * C'est ce qui permet de l'éprouver **entièrement ici** alors que le réseau de
 * cet environnement refuse `caldav.icloud.com` — tout ce qui interprète quelque
 * chose vit de ce côté-ci de la frontière, et rien ne l'interprète deux fois.
 *
 * **Ce qu'il ne conserve pas :** les participants, les descriptions, les
 * pièces jointes, les alarmes. Atlas a besoin de savoir *quand* l'artisan est
 * pris, et de son intitulé pour SON écran (sa demande du 9 août). Le reste
 * n'entre pas — ce qui n'est pas lu ne peut pas fuir.
 */
import type { PeriodeOccupee } from "./agenda-externe";
import { instantDepuisLocal } from "./fuseau";

/**
 * Le fuseau supposé quand un agenda n'en donne aucun.
 *
 * L'iCalendar autorise les heures « flottantes » — sans `Z` ni `TZID` —, qui
 * signifient « l'heure qu'il est là où on regarde ». Pour Atlas, « là où on
 * regarde » est le fuseau de l'artisan : c'est le seul choix qui ne décale pas
 * ses matinées.
 */
export const FUSEAU_PAR_DEFAUT = "Europe/Paris";

/**
 * Déplie les lignes repliées.
 *
 * L'iCalendar coupe ses lignes à 75 octets et marque la suite par une espace
 * ou une tabulation en tête (RFC 5545 §3.1). **Ne pas déplier ne casse pas
 * bruyamment** : cela produit une propriété tronquée et une ligne parasite —
 * un intitulé coupé au milieu d'un mot, et personne pour s'en plaindre. C'est
 * la première chose à faire, avant toute lecture.
 */
export function deplierIcs(texte: string): string[] {
  // Les fins de ligne varient d'un serveur à l'autre : CRLF est la norme, LF
  // est ce que rendent la moitié des implémentations, CR seul existe encore.
  const brutes = texte.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");
  const lignes: string[] = [];
  for (const ligne of brutes) {
    if ((ligne.startsWith(" ") || ligne.startsWith("\t")) && lignes.length > 0) {
      lignes[lignes.length - 1] += ligne.slice(1);
    } else {
      lignes.push(ligne);
    }
  }
  return lignes;
}

type Propriete = { nom: string; parametres: Record<string, string>; valeur: string };

/**
 * Découpe une ligne `NOM;PARAM=valeur:contenu`.
 *
 * **Le deux-points qui compte est le premier hors guillemets**, et c'est la
 * subtilité du format : un paramètre peut contenir un deux-points s'il est
 * entre guillemets (`TZID="Europe/Paris"`, ou une adresse dans `ALTREP`).
 * Couper au premier deux-points venu tronquerait la valeur.
 */
function lirePropriete(ligne: string): Propriete | null {
  let dansGuillemets = false;
  let coupure = -1;
  for (let i = 0; i < ligne.length; i++) {
    const c = ligne[i];
    if (c === '"') dansGuillemets = !dansGuillemets;
    else if (c === ":" && !dansGuillemets) {
      coupure = i;
      break;
    }
  }
  if (coupure < 0) return null;

  const entete = ligne.slice(0, coupure);
  const valeur = ligne.slice(coupure + 1);
  const morceaux = decouperHorsGuillemets(entete, ";");
  const nom = (morceaux.shift() ?? "").trim().toUpperCase();
  if (!nom) return null;

  const parametres: Record<string, string> = {};
  for (const m of morceaux) {
    const egal = m.indexOf("=");
    if (egal <= 0) continue;
    parametres[m.slice(0, egal).trim().toUpperCase()] = m
      .slice(egal + 1)
      .trim()
      .replace(/^"|"$/g, "");
  }
  return { nom, parametres, valeur };
}

function decouperHorsGuillemets(texte: string, separateur: string): string[] {
  const morceaux: string[] = [];
  let courant = "";
  let dansGuillemets = false;
  for (const c of texte) {
    if (c === '"') dansGuillemets = !dansGuillemets;
    if (c === separateur && !dansGuillemets) {
      morceaux.push(courant);
      courant = "";
    } else {
      courant += c;
    }
  }
  morceaux.push(courant);
  return morceaux;
}

/** Rend un texte échappé à l'iCalendar (`\,` `\;` `\n` `\\`) tel qu'il se lit. */
export function desechapper(valeur: string): string {
  return valeur.replace(/\\([\\;,nN])/g, (_, c: string) =>
    c === "n" || c === "N" ? "\n" : c
  );
}

/** Et l'inverse, pour ce qu'Atlas écrit. */
export function echapper(valeur: string): string {
  return valeur
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");
}

/**
 * Lit une valeur de date iCalendar : `20260812`, `20260812T090000`,
 * `20260812T070000Z`.
 *
 * Rend `null` sur tout ce qui n'est pas une date lisible. **Ignorer vaut mieux
 * que deviner** : une donnée mal formée doit produire MOINS d'occupation, pas
 * une occupation inventée — même règle que pour la lecture de Google. Un
 * rendez-vous perdu coûte un créneau proposé en trop ; une date inventée barre
 * une journée que l'artisan aurait vendue.
 */
export function lireDateIcs(
  valeur: string,
  parametres: Record<string, string> = {},
  fuseauParDefaut = FUSEAU_PAR_DEFAUT
): { instant: Date; journeeEntiere: boolean } | null {
  const brut = valeur.trim();

  const jourSeul = /^(\d{4})(\d{2})(\d{2})$/.exec(brut);
  if (jourSeul) {
    const [, a, m, j] = jourSeul;
    if (!dateCivileValide(+a, +m, +j)) return null;
    // Une date sans heure est une date CIVILE : elle se lit dans le fuseau de
    // l'artisan, pas en UTC. Lue en UTC, un congé du 14 commencerait le 13 à
    // 22 h en été et occuperait une soirée qui n'existe pas.
    const instant = instantDepuisLocal(
      { annee: +a, mois: +m, jour: +j },
      parametres.TZID || fuseauParDefaut
    );
    return Number.isNaN(instant.getTime()) ? null : { instant, journeeEntiere: true };
  }

  const horaire = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})(Z?)$/.exec(brut);
  if (!horaire) return null;
  const [, a, m, j, h, mi, s, zoulou] = horaire;
  if (!dateCivileValide(+a, +m, +j)) return null;
  // 24:00:00 existe dans certains formats, jamais en iCalendar. Et une heure
  // hors bornes ne se corrige pas : elle se refuse.
  if (+h > 23 || +mi > 59 || +s > 60) return null;

  const instant =
    zoulou === "Z"
      ? new Date(Date.UTC(+a, +m - 1, +j, +h, +mi, +s))
      : instantDepuisLocal(
          { annee: +a, mois: +m, jour: +j, heure: +h, minute: +mi, seconde: +s },
          parametres.TZID || fuseauParDefaut
        );

  return Number.isNaN(instant.getTime()) ? null : { instant, journeeEntiere: false };
}

/**
 * Cette date civile existe-t-elle vraiment ?
 *
 * **Attrapé par le contrôle, pas à la lecture (12 août 2026).** `Date.UTC` ne
 * refuse rien : il reporte. `20261332` — mois treize, jour trente-deux —
 * devenait le 1er février 2027, en silence, et Atlas barrait une journée que
 * l'artisan travaillait, un an plus tard, sans que rien ne l'explique. Une
 * donnée mal formée doit produire MOINS d'occupation, jamais une occupation
 * inventée : c'est toute la règle de ce module, et elle fuyait par là.
 *
 * Le contrôle du report attrape du même coup le 31 février et le 29 février
 * d'une année ordinaire.
 */
function dateCivileValide(annee: number, mois: number, jour: number): boolean {
  if (mois < 1 || mois > 12 || jour < 1 || jour > 31) return false;
  const d = new Date(Date.UTC(annee, mois - 1, jour));
  return (
    d.getUTCFullYear() === annee && d.getUTCMonth() === mois - 1 && d.getUTCDate() === jour
  );
}

/**
 * Lit une durée iCalendar (`PT2H`, `P1D`, `P1DT4H30M`), en millisecondes.
 *
 * Sert de repli quand un événement porte `DURATION` au lieu de `DTEND` — le
 * format autorise l'un ou l'autre, et les agendas d'Apple emploient les deux.
 * Sans ce repli, ces événements-là n'occuperaient rien : invisibles, donc
 * proposables au client.
 */
export function lireDureeIcs(valeur: string): number | null {
  const m = /^([+-])?P(?:(\d+)W)?(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/.exec(
    valeur.trim()
  );
  if (!m) return null;
  const [, signe, semaines, jours, heures, minutes, secondes] = m;
  const total =
    (+(semaines ?? 0) * 7 * 86400 +
      +(jours ?? 0) * 86400 +
      +(heures ?? 0) * 3600 +
      +(minutes ?? 0) * 60 +
      +(secondes ?? 0)) *
    1000;
  if (total === 0) return null;
  return signe === "-" ? -total : total;
}

/**
 * Les périodes occupées que porte un texte iCalendar.
 *
 * **Ce qui n'occupe rien, et pourquoi :**
 *
 * - `STATUS:CANCELLED` — un rendez-vous annulé barrerait une journée que
 *   l'artisan vient justement de libérer ;
 * - `TRANSP:TRANSPARENT` — c'est le mot par lequel un agenda dit « ceci ne
 *   m'occupe pas » : un anniversaire, un pense-bête. L'artisan l'a décidé
 *   lui-même, on ne le contredit pas ;
 * - tout ce dont les bornes ne se lisent pas.
 *
 * **Les séries récurrentes ne sont PAS dépliées ici**, et c'est délibéré : la
 * requête CalDAV les fait déplier par le serveur (`<C:expand>`), qui connaît
 * les exceptions, les décalages et les suppressions d'occurrence bien mieux
 * qu'une réimplémentation de `RRULE`. Ce qui arrive ici est donc déjà une suite
 * d'occurrences. Une série non dépliée n'occupe que sa première occurrence —
 * moins que la vérité, jamais plus.
 */
export function lireEvenementsIcs(
  texte: string,
  fuseauParDefaut = FUSEAU_PAR_DEFAUT
): PeriodeOccupee[] {
  const periodes: PeriodeOccupee[] = [];
  let dans = false;
  let courant: Record<string, Propriete> = {};

  for (const ligne of deplierIcs(texte)) {
    const nu = ligne.trim();
    if (nu.toUpperCase() === "BEGIN:VEVENT") {
      dans = true;
      courant = {};
      continue;
    }
    if (nu.toUpperCase() === "END:VEVENT") {
      if (dans) {
        const periode = periodeDe(courant, fuseauParDefaut);
        if (periode) periodes.push(periode);
      }
      dans = false;
      courant = {};
      continue;
    }
    if (!dans) continue;

    const propriete = lirePropriete(ligne);
    // Première occurrence retenue : un `VEVENT` bien formé n'a qu'un `DTSTART`,
    // et devant un fichier abîmé, prendre la première valeur est stable là où
    // prendre la dernière dépend de l'ordre d'écriture du serveur.
    if (propriete && !(propriete.nom in courant)) courant[propriete.nom] = propriete;
  }

  return periodes;
}

function periodeDe(
  proprietes: Record<string, Propriete>,
  fuseauParDefaut: string
): PeriodeOccupee | null {
  const statut = (proprietes.STATUS?.valeur ?? "").trim().toUpperCase();
  if (statut === "CANCELLED") return null;
  const transparence = (proprietes.TRANSP?.valeur ?? "").trim().toUpperCase();
  if (transparence === "TRANSPARENT") return null;

  const debutProp = proprietes.DTSTART;
  if (!debutProp) return null;
  const debut = lireDateIcs(debutProp.valeur, debutProp.parametres, fuseauParDefaut);
  if (!debut) return null;

  let fin: Date | null = null;
  const finProp = proprietes.DTEND;
  if (finProp) {
    const lue = lireDateIcs(finProp.valeur, finProp.parametres, fuseauParDefaut);
    if (lue) {
      // **La fin d'un événement « toute la journée » est EXCLUSIVE** : un congé
      // du 14 au 14 s'écrit `DTSTART:20260814` / `DTEND:20260815`. Reculer d'une
      // seconde garde le dernier jour réellement occupé sans mordre sur le
      // suivant — la même correction que pour Google, et le même piège.
      fin = lue.journeeEntiere ? new Date(lue.instant.getTime() - 1000) : lue.instant;
    }
  } else if (proprietes.DURATION) {
    const duree = lireDureeIcs(proprietes.DURATION.valeur);
    if (duree !== null && duree > 0) fin = new Date(debut.instant.getTime() + duree);
  }

  if (!fin) {
    // Ni fin ni durée : le format dit qu'un événement daté occupe la journée,
    // et qu'un événement horaire est ponctuel. Un instant ponctuel n'occupe
    // rien de mesurable — mais il occupe bien la demi-journée où il tombe, et
    // c'est ce que veut l'artisan : une minute suffit à le dire.
    fin = debut.journeeEntiere
      ? new Date(debut.instant.getTime() + 86400_000 - 1000)
      : new Date(debut.instant.getTime() + 60_000);
  }

  if (fin.getTime() <= debut.instant.getTime()) return null;

  const intitule = proprietes.SUMMARY ? desechapper(proprietes.SUMMARY.valeur).trim() : "";
  return {
    debut: debut.instant,
    fin,
    intitule: intitule || null,
    journeeEntiere: debut.journeeEntiere,
  };
}

/**
 * L'identifiant que porte l'événement d'un chantier dans l'agenda.
 *
 * **Déterministe, et c'est ce qui rend l'écriture sûre.** Le même chantier
 * réécrit donne le même `UID` : le serveur remplace au lieu d'ajouter. Sans
 * cela, replanifier trois fois poserait trois rendez-vous, et l'artisan
 * découvrirait son agenda constellé de doublons qu'Atlas serait incapable de
 * retrouver.
 *
 * **Le préfixe `atlas-` n'est pas décoratif** : c'est à lui qu'on reconnaît ce
 * qu'Atlas a posé, donc ce qu'il a le droit d'effacer. Tout le reste de
 * l'agenda lui est étranger et le demeure.
 */
export function identifiantEvenement(chantierId: string): string {
  return `atlas-${chantierId}`;
}

/** Un identifiant désigne-t-il un événement posé par Atlas ? */
export function estEvenementAtlas(uid: string): boolean {
  return uid.trim().startsWith("atlas-");
}

function horodatageUtc(d: Date): string {
  return `${d.toISOString().slice(0, 19).replace(/[-:]/g, "")}Z`;
}

/**
 * Replie une ligne à 75 octets, comme le format l'exige.
 *
 * Un intitulé de chantier avec le nom et l'adresse du client dépasse vite. Les
 * serveurs tolérants acceptent une ligne longue ; les autres refusent le dépôt
 * entier avec une erreur qui ne nomme pas la ligne fautive.
 */
function replier(ligne: string): string {
  const octets = Buffer.from(ligne, "utf8");
  if (octets.length <= 75) return ligne;

  const morceaux: string[] = [];
  let debut = 0;
  while (debut < octets.length) {
    // 74 pour la première ligne, 73 pour les suivantes (l'espace de repli
    // compte dans la limite). On recule jusqu'à une frontière de caractère :
    // couper un caractère accentué en deux produit un octet illégal, et le
    // serveur rejette sans dire pourquoi.
    const large = morceaux.length === 0 ? 74 : 73;
    let fin = Math.min(debut + large, octets.length);
    while (fin > debut && (octets[fin] & 0b1100_0000) === 0b1000_0000) fin--;
    morceaux.push(octets.subarray(debut, fin).toString("utf8"));
    debut = fin;
  }
  return morceaux.join("\r\n ");
}

export type EvenementAEcrire = {
  uid: string;
  debut: Date;
  fin: Date;
  intitule: string;
  /** L'adresse du chantier, si elle est connue — jamais inventée. */
  lieu?: string | null;
  /** Ce qui explique d'où vient ce rendez-vous, dans son agenda à lui. */
  description?: string | null;
  /** L'instant de l'écriture. Passé en paramètre pour rester éprouvable. */
  ecritLe: Date;
};

/**
 * Le fichier iCalendar d'un chantier, prêt à déposer.
 *
 * **Toutes les heures en UTC (`Z`), sans `VTIMEZONE`.** Un fichier qui porte
 * ses propres définitions de fuseau est plus riche et beaucoup plus facile à
 * écrire de travers ; l'UTC est compris de tout le monde et ne peut pas se
 * contredire. Le Calendrier d'Apple affichera l'heure locale de l'artisan.
 *
 * **`X-ATLAS-CHANTIER` accompagne l'`UID`**, pour que ce qui vient d'Atlas se
 * reconnaisse même si quelqu'un renomme le rendez-vous.
 */
export function construireVevenement(e: EvenementAEcrire): string {
  const lignes = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Atlas//Agenda//FR",
    "CALSCALE:GREGORIAN",
    "BEGIN:VEVENT",
    `UID:${e.uid}`,
    `DTSTAMP:${horodatageUtc(e.ecritLe)}`,
    `DTSTART:${horodatageUtc(e.debut)}`,
    `DTEND:${horodatageUtc(e.fin)}`,
    `SUMMARY:${echapper(e.intitule)}`,
    ...(e.lieu ? [`LOCATION:${echapper(e.lieu)}`] : []),
    ...(e.description ? [`DESCRIPTION:${echapper(e.description)}`] : []),
    // `OPAQUE` : ce rendez-vous OCCUPE. C'est la valeur par défaut du format,
    // écrite quand même — un chantier qui remonterait « disponible » chez un
    // autre logiciel serait exactement le doublon qu'on cherche à empêcher.
    "TRANSP:OPAQUE",
    "X-ATLAS-CHANTIER:1",
    "END:VEVENT",
    "END:VCALENDAR",
  ];
  // CRLF, et une ligne vide finale : la norme l'exige, et certains serveurs
  // refusent un dépôt qui s'en écarte.
  return lignes.map(replier).join("\r\n") + "\r\n";
}
