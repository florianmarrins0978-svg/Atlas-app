import type { PeriodeOccupee } from "../../lib/agenda-externe";
import {
  adresseDeLaPropriete,
  corpsEvenements,
  lireAgendas,
  lireDonneesIcs,
  CORPS_AGENDAS,
  CORPS_MAISON,
  CORPS_PRINCIPAL,
  type AgendaDistant,
} from "../../lib/caldav";
import { lireEvenementsIcs } from "../../lib/ics";

/**
 * Le raccordement à l'agenda iCloud, par CalDAV.
 *
 * **Sa demande du 12 août 2026**, capture du Calendrier d'Apple à l'appui :
 * *« je peux connecter ce calendrier à mon appli ? »* — puis, aux questions
 * posées : le compte derrière la vitrine est **iCloud**, et il veut **les deux
 * sens**, lire et écrire.
 *
 * **Pourquoi ce n'est pas le parcours de Google.** Chez Google, l'artisan
 * appuie sur un bouton, une page s'ouvre, il accepte. Apple n'offre **aucun**
 * équivalent pour l'agenda : « Se connecter avec Apple » ne donne qu'une
 * identité, jamais le calendrier. Le seul chemin praticable est CalDAV avec un
 * **mot de passe spécifique à l'app**, que l'artisan génère sur son compte
 * Apple et recopie ici.
 *
 * **Ce que ce mot de passe ouvre, et qui doit rester écrit noir sur blanc :
 * tout l'iCloud** — mail, contacts, fichiers —, pas seulement l'agenda. Apple
 * ne sait pas le restreindre à un service, à la différence des portées de
 * Google. Atlas le chiffre au repos (`secret-au-repos.ts`), mais le
 * chiffrement protège d'une sauvegarde recopiée, pas de l'étendue de ce que la
 * clé ouvre. C'est pour cela que l'écran prévient **avant** de faire taper.
 *
 * **Ce fichier n'a pas pu être éprouvé ici**, et il est écrit pour que ce soit
 * vrai le plus étroitement possible : le mandataire réseau de cet
 * environnement refuse `caldav.icloud.com`. Tout ce qui interprète quoi que ce
 * soit — les corps de requête, la lecture du XML, celle de l'iCalendar — vit
 * dans `src/lib/caldav.ts` et `src/lib/ics.ts`, ne parle à personne, et est
 * couvert par `scripts/test-caldav.ts` et `scripts/test-ics.ts`. Il ne reste
 * ici que des appels HTTP.
 */

/** L'entrée du service iCloud. Le serveur redirige ensuite vers le sien. */
export const HOTE_ICLOUD = "https://caldav.icloud.com";

/** Le chemin normalisé où un client CalDAV commence, faute d'en connaître un autre. */
const DEPART = "/.well-known/caldav";

export type IdentifiantsApple = {
  /** L'adresse iCloud de l'artisan — c'est son identifiant Apple. */
  compte: string;
  /** Le mot de passe spécifique à l'app, en clair (déchiffré par l'appelant). */
  motDePasse: string;
};

const DELAI_MS = 20_000;

/**
 * Ce qu'Apple a répondu, tel qu'il l'a écrit.
 *
 * **Reproduire le message du serveur plutôt que l'idée qu'on s'en fait** est
 * une règle du dépôt payée d'une demi-journée (`AGENTS.md`) : trois correctifs
 * d'affilée sont passés au vert en réparant une panne imaginée. Un 401 et un
 * 403 demandent deux gestes opposés — refaire son mot de passe, ou activer la
 * double authentification — et se ressemblent de loin.
 */
export class RefusApple extends Error {
  constructor(
    readonly statut: number,
    readonly detail: string
  ) {
    super(
      statut === 401
        ? `Apple a refusé l'identifiant ou le mot de passe (401). Le mot de passe pour les apps a peut-être été annulé, ou il a été recopié avec un espace en trop.`
        : statut === 403
          ? `Apple a refusé l'accès (403) : ${detail}`
          : `Apple a répondu ${statut} : ${detail}`
    );
    this.name = "RefusApple";
  }
}

function autorisation(id: IdentifiantsApple): string {
  return `Basic ${Buffer.from(`${id.compte}:${id.motDePasse}`, "utf8").toString("base64")}`;
}

/** Une adresse rendue par le serveur, ramenée à une URL complète. */
function absolue(base: string, chemin: string): string {
  try {
    return new URL(chemin, base).toString();
  } catch {
    return chemin;
  }
}

/**
 * Un appel CalDAV, redirections comprises.
 *
 * **Les redirections sont suivies à la main**, et ce n'est pas de la méfiance
 * de principe : iCloud répond `301` depuis `caldav.icloud.com` vers le serveur
 * qui héberge réellement le compte (`p42-caldav.icloud.com`), et le suivi
 * automatique de `fetch` peut retomber sur `GET` — un `PROPFIND` transformé en
 * `GET` rend une page, pas un `multistatus`, et l'erreur qui suit accuse le
 * mauvais coupable.
 */
async function appel(
  id: IdentifiantsApple,
  methode: string,
  url: string,
  options: { corps?: string; profondeur?: string; typeContenu?: string; siAbsent?: boolean } = {}
): Promise<{ statut: number; texte: string; url: string }> {
  let courante = url;

  for (let saut = 0; saut < 5; saut++) {
    const entetes: Record<string, string> = {
      authorization: autorisation(id),
      "user-agent": "Atlas/1.0",
    };
    if (options.corps !== undefined) {
      entetes["content-type"] = options.typeContenu ?? 'application/xml; charset="utf-8"';
    }
    if (options.profondeur !== undefined) entetes.depth = options.profondeur;

    const reponse = await fetch(courante, {
      method: methode,
      headers: entetes,
      body: options.corps,
      redirect: "manual",
      signal: AbortSignal.timeout(DELAI_MS),
    });

    if (reponse.status >= 300 && reponse.status < 400) {
      const suite = reponse.headers.get("location");
      if (!suite) break;
      courante = absolue(courante, suite);
      continue;
    }

    return { statut: reponse.status, texte: await reponse.text(), url: courante };
  }

  throw new Error("Apple renvoie d'une adresse à l'autre sans jamais répondre (cinq redirections).");
}

async function exiger(
  id: IdentifiantsApple,
  methode: string,
  url: string,
  options: Parameters<typeof appel>[3] = {}
): Promise<{ texte: string; url: string }> {
  const r = await appel(id, methode, url, options);
  // 207 « multi-status » est la réponse normale d'un PROPFIND réussi ; 200
  // arrive aussi. Tout le reste est un refus, y compris 404 : un chemin absent
  // n'est pas une réponse vide, c'est un raccordement qui ne tient plus.
  if (r.statut !== 207 && r.statut !== 200) {
    throw new RefusApple(r.statut, r.texte.slice(0, 300));
  }
  return { texte: r.texte, url: r.url };
}

/**
 * Les agendas du compte, tels qu'Apple les connaît.
 *
 * Trois pas, et aucun ne peut être sauté : le serveur nomme le compte, le
 * compte désigne la maison, la maison contient les agendas. Les adresses ne se
 * devinent pas — elles portent un identifiant numérique propre au compte.
 *
 * **Ce que la liste rendue exclut, et pourquoi.** Les listes de tâches (elles
 * ne portent pas de `VEVENT`) et les agendas **auxquels l'artisan est abonné**
 * — jours fériés, calendrier scolaire, agenda d'un club. Ceux-là barreraient
 * des journées entières qu'il travaille : un raccordement censé éviter les
 * doublons finirait par lui interdire décembre.
 */
export async function decouvrirAgendas(id: IdentifiantsApple): Promise<AgendaDistant[]> {
  const depart = await exiger(id, "PROPFIND", `${HOTE_ICLOUD}${DEPART}`, {
    corps: CORPS_PRINCIPAL,
    profondeur: "0",
  });

  const principal = adresseDeLaPropriete(depart.texte, "current-user-principal");
  if (!principal) {
    throw new Error(
      "Apple a répondu, mais sans dire à quel compte ce mot de passe donne accès. Le raccordement ne peut pas continuer."
    );
  }

  const maisonReponse = await exiger(id, "PROPFIND", absolue(depart.url, principal), {
    corps: CORPS_MAISON,
    profondeur: "0",
  });
  const maison = adresseDeLaPropriete(maisonReponse.texte, "calendar-home-set");
  if (!maison) {
    throw new Error("Apple n'a pas indiqué où se trouvent les agendas de ce compte.");
  }

  const maisonUrl = absolue(maisonReponse.url, maison);
  const liste = await exiger(id, "PROPFIND", maisonUrl, {
    corps: CORPS_AGENDAS,
    profondeur: "1",
  });

  return lireAgendas(liste.texte)
    .filter((a) => a.porteDesEvenements && !a.abonne)
    .map((a) => ({ ...a, href: absolue(maisonUrl, a.href) }));
}

/**
 * Les périodes occupées sur une fenêtre, tous agendas confondus.
 *
 * **Une panne sur un agenda ne fait pas taire les autres.** Un agenda partagé
 * dont l'accès a été retiré rendrait 403 ; abandonner la lecture entière
 * ramènerait Atlas au comportement qui produit des doublons, alors que les
 * quatre autres agendas répondaient. L'échec est remonté à l'appelant
 * **seulement** si aucun agenda n'a pu être lu — auquel cas il n'y a plus rien
 * à croire.
 */
export async function periodesOccupeesApple(
  id: IdentifiantsApple,
  agendas: readonly string[],
  debut: Date,
  fin: Date
): Promise<PeriodeOccupee[]> {
  if (agendas.length === 0) return [];

  const corps = corpsEvenements(debut, fin);
  const periodes: PeriodeOccupee[] = [];
  let dernierRefus: unknown = null;
  let lus = 0;

  for (const agenda of agendas) {
    try {
      const r = await exiger(id, "REPORT", agenda, { corps, profondeur: "1" });
      for (const ics of lireDonneesIcs(r.texte)) periodes.push(...lireEvenementsIcs(ics));
      lus++;
    } catch (e) {
      dernierRefus = e;
    }
  }

  if (lus === 0 && dernierRefus) throw dernierRefus;
  return periodes;
}

/** L'adresse du fichier d'un événement dans un agenda. */
export function adresseEvenement(agenda: string, uid: string): string {
  const base = agenda.endsWith("/") ? agenda : `${agenda}/`;
  return `${base}${encodeURIComponent(uid)}.ics`;
}

/**
 * Dépose — ou remplace — l'événement d'un chantier.
 *
 * **Le remplacement est voulu, et c'est ce qui rend l'écriture sûre.**
 * L'identifiant se déduit du chantier (`identifiantEvenement`) : replanifier
 * trois fois réécrit le même fichier au lieu d'en ajouter trois. Sans cela,
 * l'agenda de l'artisan se constellerait de doublons qu'Atlas serait incapable
 * de retrouver.
 */
export async function poserEvenement(
  id: IdentifiantsApple,
  agenda: string,
  uid: string,
  ics: string
): Promise<void> {
  const r = await appel(id, "PUT", adresseEvenement(agenda, uid), {
    corps: ics,
    typeContenu: "text/calendar; charset=utf-8",
  });
  // 201 créé, 204 remplacé, 200 accepté avec corps : les trois sont des succès.
  if (r.statut !== 201 && r.statut !== 204 && r.statut !== 200) {
    throw new RefusApple(r.statut, r.texte.slice(0, 300));
  }
}

/**
 * Retire l'événement d'un chantier.
 *
 * **Un événement déjà absent n'est pas une erreur** : l'artisan a pu le
 * supprimer lui-même depuis son téléphone, et se plaindre d'un ménage
 * qu'il a fait lui-même n'aiderait personne. Le 404 est donc un succès.
 */
export async function retirerEvenement(
  id: IdentifiantsApple,
  agenda: string,
  uid: string
): Promise<void> {
  const r = await appel(id, "DELETE", adresseEvenement(agenda, uid));
  if (r.statut !== 204 && r.statut !== 200 && r.statut !== 404) {
    throw new RefusApple(r.statut, r.texte.slice(0, 300));
  }
}
