import assert from "node:assert/strict";
import {
  adresseDeLaPropriete,
  corpsEvenements,
  desechapperXml,
  echapperXml,
  lireAgendas,
  lireDonneesIcs,
} from "../src/lib/caldav";
import { adresseEvenement } from "../src/server/agenda/apple";
import { lireEvenementsIcs } from "../src/lib/ics";

// **Ce que cette suite tient à la place d'un compte iCloud.**
//
// Le raccordement à Apple ne peut pas être éprouvé ici : le mandataire réseau
// de cet environnement refuse `caldav.icloud.com`. Ce qui est éprouvable, c'est
// la LECTURE de ce qu'un serveur CalDAV répond — et c'est là que vivent les
// décisions : quel agenda est le sien, lequel n'est qu'un abonnement, lequel
// accepte qu'on y écrive.
//
// Les réponses ci-dessous reproduisent la forme réelle du protocole, y compris
// ses pièges : préfixes d'espaces de noms variables d'un serveur à l'autre, et
// blocs `propstat` en 404 mêlés aux 200.

let echecs = 0;
function cas(nom: string, verifier: () => void) {
  try {
    verifier();
    console.log(`  ✓ ${nom}`);
  } catch (e) {
    echecs++;
    console.error(`  ✗ ${nom}\n    ${(e as Error).message}`);
  }
}

console.log("=== Lire ce qu'un serveur CalDAV répond ===\n");

// ─── Les trois pas de la découverte ────────────────────────────────────────

const PRINCIPAL = `<?xml version="1.0" encoding="UTF-8"?>
<multistatus xmlns="DAV:">
  <response>
    <href>/</href>
    <propstat>
      <prop><current-user-principal><href>/1234567890/principal/</href></current-user-principal></prop>
      <status>HTTP/1.1 200 OK</status>
    </propstat>
  </response>
</multistatus>`;

cas("le compte se trouve, sans préfixe d'espace de noms", () => {
  assert.equal(adresseDeLaPropriete(PRINCIPAL, "current-user-principal"), "/1234567890/principal/");
});

cas("le compte se trouve aussi quand le serveur préfixe TOUT", () => {
  // Chaque serveur préfixe à sa façon — `D:`, `d:`, `a:`. Un lecteur qui
  // n'accepterait qu'une forme marcherait chez l'un et pas chez l'autre, et le
  // message d'erreur accuserait le mot de passe.
  const prefixe = PRINCIPAL.replace(/<(\/?)(multistatus|response|propstat|prop|status|current-user-principal|href)/g, "<$1D:$2");
  assert.equal(adresseDeLaPropriete(prefixe, "current-user-principal"), "/1234567890/principal/");
});

cas("un propstat en 404 ne se lit pas comme une réponse vide", () => {
  // Le serveur range dans un bloc séparé ce qu'il ne connaît pas. Prendre le
  // premier bloc venu ferait passer une propriété absente pour vide.
  const mele = `<multistatus xmlns="DAV:">
    <response>
      <href>/</href>
      <propstat><prop><displayname/></prop><status>HTTP/1.1 404 Not Found</status></propstat>
      <propstat>
        <prop><current-user-principal><href>/42/principal/</href></current-user-principal></prop>
        <status>HTTP/1.1 200 OK</status>
      </propstat>
    </response>
  </multistatus>`;
  assert.equal(adresseDeLaPropriete(mele, "current-user-principal"), "/42/principal/");
});

cas("une propriété absente rend null, jamais une chaîne vide", () => {
  assert.equal(adresseDeLaPropriete("<multistatus/>", "calendar-home-set"), null);
});

// ─── La liste des agendas : c'est là que sont les décisions ────────────────

const AGENDAS = `<?xml version="1.0" encoding="UTF-8"?>
<D:multistatus xmlns:D="DAV:" xmlns:C="urn:ietf:params:xml:ns:caldav" xmlns:CS="http://calendarserver.org/ns/">
  <D:response>
    <D:href>/42/calendars/</D:href>
    <D:propstat>
      <D:prop>
        <D:displayname>Accueil</D:displayname>
        <D:resourcetype><D:collection/></D:resourcetype>
      </D:prop>
      <D:status>HTTP/1.1 200 OK</D:status>
    </D:propstat>
  </D:response>
  <D:response>
    <D:href>/42/calendars/perso/</D:href>
    <D:propstat>
      <D:prop>
        <D:displayname>Perso &amp; famille</D:displayname>
        <D:resourcetype><D:collection/><C:calendar/></D:resourcetype>
        <D:current-user-privilege-set><D:privilege><D:read/></D:privilege><D:privilege><D:write/></D:privilege></D:current-user-privilege-set>
        <C:supported-calendar-component-set><C:comp name="VEVENT"/></C:supported-calendar-component-set>
      </D:prop>
      <D:status>HTTP/1.1 200 OK</D:status>
    </D:propstat>
  </D:response>
  <D:response>
    <D:href>/42/calendars/taches/</D:href>
    <D:propstat>
      <D:prop>
        <D:displayname>Rappels</D:displayname>
        <D:resourcetype><D:collection/><C:calendar/></D:resourcetype>
        <C:supported-calendar-component-set><C:comp name="VTODO"/></C:supported-calendar-component-set>
      </D:prop>
      <D:status>HTTP/1.1 200 OK</D:status>
    </D:propstat>
  </D:response>
  <D:response>
    <D:href>/42/calendars/feries/</D:href>
    <D:propstat>
      <D:prop>
        <D:displayname>Jours fériés en France</D:displayname>
        <D:resourcetype><D:collection/><C:calendar/><CS:subscribed/></D:resourcetype>
        <C:supported-calendar-component-set><C:comp name="VEVENT"/></C:supported-calendar-component-set>
      </D:prop>
      <D:status>HTTP/1.1 200 OK</D:status>
    </D:propstat>
  </D:response>
  <D:response>
    <D:href>/42/calendars/club/</D:href>
    <D:propstat>
      <D:prop>
        <D:displayname>Club de foot</D:displayname>
        <D:resourcetype><D:collection/><C:calendar/></D:resourcetype>
        <D:current-user-privilege-set><D:privilege><D:read/></D:privilege></D:current-user-privilege-set>
        <C:supported-calendar-component-set><C:comp name="VEVENT"/></C:supported-calendar-component-set>
      </D:prop>
      <D:status>HTTP/1.1 200 OK</D:status>
    </D:propstat>
  </D:response>
</D:multistatus>`;

cas("la collection racine n'est pas un agenda", () => {
  assert.equal(
    lireAgendas(AGENDAS).some((a) => a.href === "/42/calendars/"),
    false
  );
});

cas("un agenda porte son nom, entités comprises", () => {
  const perso = lireAgendas(AGENDAS).find((a) => a.href === "/42/calendars/perso/");
  // Sans le déséchappement, il choisirait dans une liste qui n'est pas la
  // sienne : « Perso &amp; famille ».
  assert.equal(perso?.nom, "Perso & famille");
});

cas("une liste de tâches ne porte pas de rendez-vous", () => {
  const taches = lireAgendas(AGENDAS).find((a) => a.href === "/42/calendars/taches/");
  assert.equal(taches?.porteDesEvenements, false);
});

cas("un agenda auquel il est ABONNÉ est reconnu comme tel", () => {
  // Les jours fériés barreraient des journées entières qu'il travaille : un
  // raccordement censé éviter les doublons finirait par lui interdire décembre.
  const feries = lireAgendas(AGENDAS).find((a) => a.href === "/42/calendars/feries/");
  assert.equal(feries?.abonne, true);
});

cas("un agenda en lecture seule le dit, plutôt que d'échouer au dépôt", () => {
  const club = lireAgendas(AGENDAS).find((a) => a.href === "/42/calendars/club/");
  assert.equal(club?.inscriptible, false);
  assert.equal(club?.porteDesEvenements, true, "il reste LISIBLE : il occupe bien ses créneaux");
});

cas("sans privilèges annoncés, on suppose inscriptible et le dépôt tranchera", () => {
  // Supposer l'inverse cacherait l'agenda que l'artisan voulait justement
  // choisir, sans lui dire pourquoi.
  const sans = `<multistatus xmlns="DAV:" xmlns:C="urn:ietf:params:xml:ns:caldav">
    <response><href>/c/</href><propstat><prop>
      <displayname>Travail</displayname>
      <resourcetype><collection/><C:calendar/></resourcetype>
    </prop><status>HTTP/1.1 200 OK</status></propstat></response>
  </multistatus>`;
  const [a] = lireAgendas(sans);
  assert.equal(a.inscriptible, true);
  assert.equal(a.porteDesEvenements, true, "sans composants déclarés, la norme dit « tout »");
});

cas("un agenda sans nom en reçoit un plutôt qu'un blanc", () => {
  const anonyme = `<multistatus xmlns="DAV:" xmlns:C="urn:ietf:params:xml:ns:caldav">
    <response><href>/c/</href><propstat><prop>
      <resourcetype><collection/><C:calendar/></resourcetype>
    </prop><status>HTTP/1.1 200 OK</status></propstat></response>
  </multistatus>`;
  assert.equal(lireAgendas(anonyme)[0].nom, "Agenda sans nom");
});

// ─── Les événements rendus par un `calendar-query` ─────────────────────────

cas("la requête demande au SERVEUR de déplier les séries", () => {
  // Sans `expand`, une réunion hebdomadaire ne rendrait qu'une occurrence :
  // toutes les autres semaines paraîtraient libres, donc proposables.
  const corps = corpsEvenements(new Date("2026-08-12T00:00:00Z"), new Date("2026-09-12T00:00:00Z"));
  assert.match(corps, /<c:expand start="20260812T000000Z" end="20260912T000000Z"\/>/);
  assert.match(corps, /<c:time-range start="20260812T000000Z" end="20260912T000000Z"\/>/);
  assert.match(corps, /comp-filter name="VEVENT"/);
});

cas("les blocs iCalendar se relisent jusqu'aux périodes", () => {
  const reponse = `<multistatus xmlns="DAV:" xmlns:C="urn:ietf:params:xml:ns:caldav">
    <response>
      <href>/42/calendars/perso/abc.ics</href>
      <propstat><prop><C:calendar-data>BEGIN:VCALENDAR
BEGIN:VEVENT
SUMMARY:Élagage chez Mme Roux
DTSTART:20260812T070000Z
DTEND:20260812T083000Z
END:VEVENT
END:VCALENDAR</C:calendar-data></prop><status>HTTP/1.1 200 OK</status></propstat>
    </response>
  </multistatus>`;
  const blocs = lireDonneesIcs(reponse);
  assert.equal(blocs.length, 1);
  const [p] = lireEvenementsIcs(blocs[0]);
  assert.equal(p.intitule, "Élagage chez Mme Roux");
  assert.equal(p.debut.toISOString(), "2026-08-12T07:00:00.000Z");
});

cas("un bloc échappé en XML se relit sans perdre son contenu", () => {
  const reponse = `<multistatus xmlns="DAV:" xmlns:C="urn:ietf:params:xml:ns:caldav">
    <response><href>/c/x.ics</href><propstat><prop><C:calendar-data>BEGIN:VEVENT
SUMMARY:Devis &amp; facture
DTSTART:20260812T070000Z
DTEND:20260812T080000Z
END:VEVENT</C:calendar-data></prop><status>HTTP/1.1 200 OK</status></propstat></response>
  </multistatus>`;
  assert.equal(lireEvenementsIcs(lireDonneesIcs(reponse)[0])[0].intitule, "Devis & facture");
});

cas("une réponse vide ne rend rien, et ne jette pas", () => {
  assert.deepEqual(lireDonneesIcs("<multistatus xmlns=\"DAV:\"/>"), []);
  assert.deepEqual(lireAgendas(""), []);
});

// ─── Les échappements, dans les deux sens ──────────────────────────────────

cas("l'échappement XML fait l'aller-retour", () => {
  const brut = `Perso & "famille" <chez moi>`;
  assert.equal(desechapperXml(echapperXml(brut)), brut);
});

cas("&amp;lt; ne devient pas < — l'ordre du déséchappement compte", () => {
  assert.equal(desechapperXml("&amp;lt;"), "&lt;");
});

// ─── L'adresse d'un événement ──────────────────────────────────────────────

cas("l'adresse d'un événement se pose sous l'agenda, avec ou sans barre finale", () => {
  assert.equal(
    adresseEvenement("https://p1.icloud.com/42/calendars/perso", "atlas-abc"),
    "https://p1.icloud.com/42/calendars/perso/atlas-abc.ics"
  );
  assert.equal(
    adresseEvenement("https://p1.icloud.com/42/calendars/perso/", "atlas-abc"),
    "https://p1.icloud.com/42/calendars/perso/atlas-abc.ics"
  );
});

console.log(
  echecs === 0 ? "\n✅ CalDAV — 0 échec(s).\n" : `\n❌ CalDAV — ${echecs} échec(s).\n`
);
process.exit(echecs === 0 ? 0 : 1);
