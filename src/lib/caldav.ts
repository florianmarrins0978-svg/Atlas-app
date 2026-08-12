/**
 * CalDAV : composer les requêtes, lire les réponses.
 *
 * **Pourquoi ce module est séparé de celui qui parle au réseau.** Le
 * raccordement à iCloud ne peut pas être éprouvé ici — le mandataire de cet
 * environnement refuse `caldav.icloud.com`. Tout ce qui *interprète* quelque
 * chose vit donc de ce côté-ci : les corps de requête et la lecture des
 * réponses. `src/server/agenda/apple.ts` ne garde que les appels HTTP, la part
 * irréductible qui ne se vérifiera qu'avec un vrai compte.
 *
 * **Sur la lecture du XML par expressions régulières.** C'est un choix, pas une
 * paresse : CalDAV rend un `multistatus` dont chaque serveur préfixe les
 * espaces de noms à sa façon (`D:`, `d:`, `a:`, ou rien), et un analyseur
 * complet ajouterait une dépendance pour extraire six champs d'une structure
 * qu'on ne contrôle pas. Ce qui est lu ici est **volontairement peu de
 * choses** : des adresses, des noms d'agenda, des blocs iCalendar. Rien de ce
 * qui est extrait n'est exécuté, et ce qui ne se lit pas est ignoré plutôt que
 * deviné — une réponse mal comprise doit donner MOINS d'agendas, jamais un
 * agenda inventé.
 */

/** `<D:href>` comme `<href>` comme `<a:href>` : le préfixe est libre. */
function baliseQuelconque(nom: string): string {
  return `(?:[A-Za-z0-9_.-]+:)?${nom}`;
}

function contenusDe(xml: string, nom: string): string[] {
  const motif = new RegExp(`<${baliseQuelconque(nom)}(?:\\s[^>]*)?>([\\s\\S]*?)</${baliseQuelconque(nom)}>`, "gi");
  return [...xml.matchAll(motif)].map((m) => m[1]);
}

function presente(xml: string, nom: string): boolean {
  return new RegExp(`<${baliseQuelconque(nom)}(?:\\s[^>]*)?(?:/>|>)`, "i").test(xml);
}

/**
 * Rend les entités XML telles qu'elles se lisent.
 *
 * Un agenda nommé « Perso & famille » revient en `Perso &amp; famille` ; sans
 * cette étape, l'artisan choisirait dans une liste qui n'est pas la sienne.
 */
export function desechapperXml(texte: string): string {
  return texte
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n: string) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n: string) => String.fromCodePoint(parseInt(n, 16)))
    // `&amp;` en dernier, sans quoi `&amp;lt;` deviendrait `<`.
    .replace(/&amp;/g, "&");
}

/** Et l'inverse, pour ce qu'Atlas met dans une requête. */
export function echapperXml(texte: string): string {
  return texte
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Un bloc `<response>` de `multistatus`, découpé de ses voisins. */
function reponses(xml: string): string[] {
  return contenusDe(xml, "response");
}

/**
 * Ne garde que les `propstat` qui ont réussi.
 *
 * **Sans ce tri, on lit des propriétés absentes comme si elles étaient vides.**
 * Un serveur répond `404 Not Found` dans un `propstat` séparé pour ce qu'il ne
 * connaît pas ; prendre le premier bloc venu ferait passer un agenda pour
 * innommé, ou pour dépourvu du droit d'écriture qu'il a en réalité.
 */
function proprietesUtiles(reponse: string): string {
  const blocs = contenusDe(reponse, "propstat").filter((bloc) => {
    const statut = contenusDe(bloc, "status")[0] ?? "";
    // Pas de `status` du tout : certains serveurs l'omettent quand tout va
    // bien. On garde — refuser ici perdrait des agendas bien réels.
    return statut.trim() === "" || /\s2\d\d\s/.test(` ${statut} `);
  });
  return blocs.length > 0 ? blocs.join("\n") : reponse;
}

/** La première adresse portée par un bloc de réponse. */
function href(bloc: string): string | null {
  const brut = contenusDe(bloc, "href")[0];
  return brut === undefined ? null : desechapperXml(brut.trim());
}

// ─── Les corps de requête ──────────────────────────────────────────────────

/** Étape 1 : « qui suis-je ? » — l'adresse du compte, telle que le serveur la nomme. */
export const CORPS_PRINCIPAL = `<?xml version="1.0" encoding="UTF-8"?>
<d:propfind xmlns:d="DAV:">
  <d:prop><d:current-user-principal/></d:prop>
</d:propfind>`;

/** Étape 2 : « où sont mes agendas ? » */
export const CORPS_MAISON = `<?xml version="1.0" encoding="UTF-8"?>
<d:propfind xmlns:d="DAV:" xmlns:c="urn:ietf:params:xml:ns:caldav">
  <d:prop><c:calendar-home-set/></d:prop>
</d:propfind>`;

/** Étape 3 : « lesquels, comment s'appellent-ils, et qu'ai-je le droit d'y faire ? » */
export const CORPS_AGENDAS = `<?xml version="1.0" encoding="UTF-8"?>
<d:propfind xmlns:d="DAV:" xmlns:c="urn:ietf:params:xml:ns:caldav">
  <d:prop>
    <d:displayname/>
    <d:resourcetype/>
    <d:current-user-privilege-set/>
    <c:supported-calendar-component-set/>
  </d:prop>
</d:propfind>`;

function horodatageUtc(d: Date): string {
  return `${d.toISOString().slice(0, 19).replace(/[-:]/g, "")}Z`;
}

/**
 * La requête qui demande les événements d'une fenêtre.
 *
 * **`expand` fait déplier les séries PAR LE SERVEUR**, et c'est ce qui évite de
 * réimplémenter `RRULE` — avec ses exceptions, ses occurrences déplacées et ses
 * suppressions unitaires. Sans lui, une réunion hebdomadaire ne rendrait qu'une
 * occurrence : toutes les autres semaines paraîtraient libres, donc
 * proposables à un client.
 */
export function corpsEvenements(debut: Date, fin: Date): string {
  const d = horodatageUtc(debut);
  const f = horodatageUtc(fin);
  return `<?xml version="1.0" encoding="UTF-8"?>
<c:calendar-query xmlns:d="DAV:" xmlns:c="urn:ietf:params:xml:ns:caldav">
  <d:prop>
    <c:calendar-data>
      <c:expand start="${d}" end="${f}"/>
    </c:calendar-data>
  </d:prop>
  <c:filter>
    <c:comp-filter name="VCALENDAR">
      <c:comp-filter name="VEVENT">
        <c:time-range start="${d}" end="${f}"/>
      </c:comp-filter>
    </c:comp-filter>
  </c:filter>
</c:calendar-query>`;
}

// ─── La lecture des réponses ───────────────────────────────────────────────

/**
 * L'adresse portée par une propriété (`current-user-principal`,
 * `calendar-home-set`).
 *
 * Rend `null` plutôt qu'une chaîne vide : l'appelant doit pouvoir distinguer
 * « le serveur n'a pas répondu ce qu'on attendait » de « il a répondu une
 * adresse vide », deux pannes qui ne se corrigent pas pareil.
 */
export function adresseDeLaPropriete(xml: string, propriete: string): string | null {
  for (const bloc of reponses(xml)) {
    for (const contenu of contenusDe(proprietesUtiles(bloc), propriete)) {
      const adresse = href(contenu);
      if (adresse) return adresse;
    }
  }
  // Certains serveurs répondent hors `multistatus` sur une requête à la racine.
  for (const contenu of contenusDe(xml, propriete)) {
    const adresse = href(contenu);
    if (adresse) return adresse;
  }
  return null;
}

export type AgendaDistant = {
  /** Le chemin de la collection, tel que le serveur le donne. */
  href: string;
  /** Le nom que l'artisan voit dans son Calendrier. */
  nom: string;
  /** Accepte-t-il des rendez-vous — par opposition aux listes de tâches ? */
  porteDesEvenements: boolean;
  /**
   * Est-ce un agenda auquel il est ABONNÉ (jours fériés, calendrier d'une
   * équipe sportive) ? Ceux-là ne sont pas les siens : ils barrent des journées
   * entières qu'il travaille, et rien ne peut y être écrit.
   */
  abonne: boolean;
  /** Peut-on y déposer ? Un agenda partagé en lecture seule ne l'accepte pas. */
  inscriptible: boolean;
};

/**
 * Les agendas que porte la réponse à `CORPS_AGENDAS`.
 *
 * **La collection racine est écartée** : la réponse commence par la maison
 * elle-même, qui n'est pas un agenda. La reconnaître à l'absence de
 * `<calendar/>` dans son `resourcetype` est plus sûr que de comparer les
 * adresses, qui diffèrent d'une barre oblique selon les serveurs.
 */
export function lireAgendas(xml: string): AgendaDistant[] {
  const agendas: AgendaDistant[] = [];

  for (const bloc of reponses(xml)) {
    const adresse = href(bloc);
    if (!adresse) continue;

    const utiles = proprietesUtiles(bloc);
    const types = contenusDe(utiles, "resourcetype")[0] ?? "";
    if (!presente(types, "calendar")) continue;

    const composants = contenusDe(utiles, "supported-calendar-component-set")[0] ?? "";
    // Aucun `supported-calendar-component-set` déclaré : la norme dit qu'un
    // agenda accepte alors tout. Le refuser écarterait des agendas valides.
    const porteDesEvenements =
      composants.trim() === "" || /name\s*=\s*"VEVENT"/i.test(composants);

    const privileges = contenusDe(utiles, "current-user-privilege-set")[0] ?? "";
    // Pas de privilèges annoncés : on suppose inscriptible et le dépôt tranchera.
    // Supposer l'inverse cacherait à l'artisan l'agenda qu'il voulait justement
    // choisir, sans lui dire pourquoi.
    const inscriptible =
      privileges.trim() === "" || presente(privileges, "write") || presente(privileges, "write-content");

    const nomBrut = contenusDe(utiles, "displayname")[0] ?? "";
    agendas.push({
      href: adresse,
      nom: desechapperXml(nomBrut.trim()) || "Agenda sans nom",
      porteDesEvenements,
      abonne: presente(types, "subscribed"),
      inscriptible,
    });
  }

  return agendas;
}

/**
 * Les blocs iCalendar d'une réponse à `corpsEvenements`.
 *
 * Concaténés par l'appelant puis lus d'un coup : `lireEvenementsIcs` sait
 * traiter plusieurs `VEVENT` d'affilée, et cela évite un aller-retour de
 * découpage dont personne n'a besoin.
 */
export function lireDonneesIcs(xml: string): string[] {
  const blocs: string[] = [];
  for (const bloc of reponses(xml)) {
    for (const donnee of contenusDe(proprietesUtiles(bloc), "calendar-data")) {
      const texte = desechapperXml(donnee).trim();
      if (texte) blocs.push(texte);
    }
  }
  return blocs;
}
