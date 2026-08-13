import assert from "node:assert/strict";
import {
  construireVevenement,
  deplierIcs,
  desechapper,
  echapper,
  estEvenementAtlas,
  identifiantEvenement,
  lireDateIcs,
  lireDureeIcs,
  lireEvenementsIcs,
} from "../src/lib/ics";
import { creneauxOccupesPar } from "../src/lib/agenda-externe";
import { instantDepuisLocal, decalageMinutes } from "../src/lib/fuseau";

// **Ce que cette suite tient à la place d'un compte iCloud.**
//
// Le patron a demandé le 12 août 2026 de relier son agenda Apple, dans les deux
// sens. Le raccordement lui-même ne peut pas être éprouvé ici : le mandataire
// réseau de cet environnement refuse `caldav.icloud.com`. Tout ce qui
// *interprète* quelque chose a donc été mis dans `src/lib/ics.ts`, qui ne parle
// à personne — et c'est ce module que cette suite couvre entièrement.
//
// Autrement dit : ce qui reste non éprouvé chez Apple, ce sont trois appels
// HTTP. Pas une seule décision.

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

console.log("=== Lire et écrire l'iCalendar ===\n");

// ─── Le dépliage : la première chose à faire, et la plus discrète ──────────

cas("une ligne repliée se recolle, espace ou tabulation", () => {
  const lignes = deplierIcs("SUMMARY:Élagage chez\r\n  Mme Roux\r\nDTSTART:20260812");
  assert.equal(lignes[0], "SUMMARY:Élagage chez Mme Roux");
  assert.equal(lignes[1], "DTSTART:20260812");
});

cas("les trois fins de ligne du monde sont acceptées", () => {
  assert.deepEqual(deplierIcs("A:1\r\nB:2"), ["A:1", "B:2"]);
  assert.deepEqual(deplierIcs("A:1\nB:2"), ["A:1", "B:2"]);
  assert.deepEqual(deplierIcs("A:1\rB:2"), ["A:1", "B:2"]);
});

// ─── Les dates : l'endroit où une étourderie décale une journée ────────────

cas("une heure en UTC se lit telle quelle", () => {
  const lu = lireDateIcs("20260812T070000Z");
  assert.equal(lu?.instant.toISOString(), "2026-08-12T07:00:00.000Z");
  assert.equal(lu?.journeeEntiere, false);
});

cas("une heure locale de Paris en été vaut UTC+2", () => {
  // 9 h à Paris le 12 août 2026 = 07:00Z. Lu en UTC sans correction, ce
  // rendez-vous tomberait avant 8 h et n'occuperait RIEN : la matinée serait
  // proposée au client pendant que l'artisan est chez le médecin.
  const lu = lireDateIcs("20260812T090000", { TZID: "Europe/Paris" });
  assert.equal(lu?.instant.toISOString(), "2026-08-12T07:00:00.000Z");
});

cas("la même heure en hiver vaut UTC+1 — un décalage figé se tromperait", () => {
  const lu = lireDateIcs("20260112T090000", { TZID: "Europe/Paris" });
  assert.equal(lu?.instant.toISOString(), "2026-01-12T08:00:00.000Z");
});

cas("une heure sans fuseau est lue dans celui de l'artisan", () => {
  const lu = lireDateIcs("20260812T090000");
  assert.equal(lu?.instant.toISOString(), "2026-08-12T07:00:00.000Z");
});

cas("une date sans heure est civile, et le dit", () => {
  const lu = lireDateIcs("20260812");
  assert.equal(lu?.journeeEntiere, true);
  // Minuit à Paris, pas minuit UTC : lu en UTC, le congé du 12 commencerait le
  // 11 à 22 h et occuperait une soirée qui n'existe pas.
  assert.equal(lu?.instant.toISOString(), "2026-08-11T22:00:00.000Z");
});

cas("ce qui n'est pas une date n'est pas deviné", () => {
  // `20261332` — mois treize, jour trente-deux — était accepté et roulait en
  // silence jusqu'au 1er février 2027 : une journée barrée un an plus tard,
  // sans raison visible. Trouvé par ce contrôle le 12 août 2026.
  for (const brut of [
    "",
    "demain",
    "2026-08-12",
    "20260812T09",
    "20261332T090000Z",
    "20260231",
    "20260229",
    "20260812T250000Z",
    "20260812T096100Z",
  ]) {
    assert.equal(lireDateIcs(brut), null, `« ${brut} » a été accepté`);
  }
});

cas("un fuseau inconnu ne fait pas tomber la lecture entière", () => {
  const lu = lireDateIcs("20260812T090000", { TZID: "Terre/Milieu" });
  assert.ok(lu, "un TZID maison a fait perdre le rendez-vous");
});

cas("les durées se lisent, y compris composées", () => {
  assert.equal(lireDureeIcs("PT2H"), 2 * 3600_000);
  assert.equal(lireDureeIcs("P1D"), 86_400_000);
  assert.equal(lireDureeIcs("P1DT4H30M"), (86_400 + 4 * 3600 + 1800) * 1000);
  assert.equal(lireDureeIcs("P2W"), 14 * 86_400_000);
  assert.equal(lireDureeIcs("n'importe quoi"), null);
});

// ─── Les événements ────────────────────────────────────────────────────────

const AGENDA = [
  "BEGIN:VCALENDAR",
  "BEGIN:VEVENT",
  "UID:1",
  "SUMMARY:Élagage chez Mme Roux",
  "DTSTART;TZID=Europe/Paris:20260812T090000",
  "DTEND;TZID=Europe/Paris:20260812T103000",
  "END:VEVENT",
  "BEGIN:VEVENT",
  "UID:2",
  "SUMMARY:Rendez-vous annulé",
  "STATUS:CANCELLED",
  "DTSTART:20260813T080000Z",
  "DTEND:20260813T090000Z",
  "END:VEVENT",
  "BEGIN:VEVENT",
  "UID:3",
  "SUMMARY:Anniversaire",
  "TRANSP:TRANSPARENT",
  "DTSTART:20260814",
  "DTEND:20260815",
  "END:VEVENT",
  "BEGIN:VEVENT",
  "UID:4",
  "SUMMARY:Congés",
  "DTSTART:20260817",
  "DTEND:20260820",
  "END:VEVENT",
  "END:VCALENDAR",
].join("\r\n");

cas("un rendez-vous ordinaire donne ses deux bornes et son intitulé", () => {
  const [premier] = lireEvenementsIcs(AGENDA);
  assert.equal(premier.intitule, "Élagage chez Mme Roux");
  assert.equal(premier.debut.toISOString(), "2026-08-12T07:00:00.000Z");
  assert.equal(premier.fin.toISOString(), "2026-08-12T08:30:00.000Z");
});

cas("un rendez-vous annulé n'occupe rien — il vient de libérer la journée", () => {
  assert.equal(
    lireEvenementsIcs(AGENDA).some((p) => p.intitule === "Rendez-vous annulé"),
    false
  );
});

cas("« disponible » n'occupe rien : l'artisan l'a décidé lui-même", () => {
  assert.equal(
    lireEvenementsIcs(AGENDA).some((p) => p.intitule === "Anniversaire"),
    false
  );
});

cas("la fin d'un événement sur plusieurs jours est EXCLUSIVE", () => {
  const conges = lireEvenementsIcs(AGENDA).find((p) => p.intitule === "Congés");
  assert.ok(conges);
  // Du 17 au 19 inclus, pas jusqu'au 20 : sinon Atlas barre un jour de plus
  // que ce que l'artisan a posé, tous les congés de l'année.
  const jours = new Set(creneauxOccupesPar(conges).map((c) => c.jour));
  assert.deepEqual([...jours].sort(), ["2026-08-17", "2026-08-18", "2026-08-19"]);
});

cas("un événement à DURATION plutôt qu'à DTEND occupe quand même", () => {
  const texte = [
    "BEGIN:VEVENT",
    "SUMMARY:Formation",
    "DTSTART:20260812T080000Z",
    "DURATION:PT3H",
    "END:VEVENT",
  ].join("\r\n");
  const [p] = lireEvenementsIcs(texte);
  assert.equal(p.fin.toISOString(), "2026-08-12T11:00:00.000Z");
});

cas("un événement sans fin ni durée occupe tout de même sa demi-journée", () => {
  const texte = ["BEGIN:VEVENT", "SUMMARY:Passage", "DTSTART:20260812T080000Z", "END:VEVENT"].join("\r\n");
  const [p] = lireEvenementsIcs(texte);
  assert.ok(p, "un rendez-vous ponctuel a été perdu");
  assert.equal(creneauxOccupesPar(p).length, 1);
});

cas("un intitulé échappé se relit tel qu'il a été écrit", () => {
  const texte = [
    "BEGIN:VEVENT",
    "SUMMARY:Devis\\, taille de haie\\; M. Bernard",
    "DTSTART:20260812T080000Z",
    "DTEND:20260812T090000Z",
    "END:VEVENT",
  ].join("\r\n");
  assert.equal(lireEvenementsIcs(texte)[0].intitule, "Devis, taille de haie; M. Bernard");
});

cas("un événement sans titre rend null, jamais une chaîne vide", () => {
  const texte = ["BEGIN:VEVENT", "DTSTART:20260812T080000Z", "DTEND:20260812T090000Z", "END:VEVENT"].join("\r\n");
  assert.equal(lireEvenementsIcs(texte)[0].intitule, null);
});

cas("un TZID entre guillemets ne coupe pas la valeur", () => {
  const texte = [
    "BEGIN:VEVENT",
    'DTSTART;TZID="Europe/Paris":20260812T090000',
    "DTEND;TZID=\"Europe/Paris\":20260812T100000",
    "END:VEVENT",
  ].join("\r\n");
  assert.equal(lireEvenementsIcs(texte)[0].debut.toISOString(), "2026-08-12T07:00:00.000Z");
});

cas("un fichier abîmé donne MOINS d'occupation, jamais une occupation inventée", () => {
  const texte = ["BEGIN:VEVENT", "SUMMARY:Sans date", "END:VEVENT", "BEGIN:VEVENT", "DTSTART:pas une date", "END:VEVENT"].join("\r\n");
  assert.deepEqual(lireEvenementsIcs(texte), []);
});

cas("une fin antérieure à son début n'occupe rien", () => {
  const texte = [
    "BEGIN:VEVENT",
    "DTSTART:20260812T100000Z",
    "DTEND:20260812T090000Z",
    "END:VEVENT",
  ].join("\r\n");
  assert.deepEqual(lireEvenementsIcs(texte), []);
});

// ─── L'écriture ────────────────────────────────────────────────────────────

cas("l'identifiant d'un chantier est déterministe — réécrire ne double pas", () => {
  const id = "3f2a5b7c-1111-2222-3333-444455556666";
  assert.equal(identifiantEvenement(id), identifiantEvenement(id));
  assert.ok(estEvenementAtlas(identifiantEvenement(id)));
  assert.equal(estEvenementAtlas("39F6A1B2-un-rendez-vous-a-lui"), false);
});

const ECRIT = construireVevenement({
  uid: "atlas-abc",
  debut: new Date("2026-08-12T06:00:00Z"),
  fin: new Date("2026-08-12T11:00:00Z"),
  intitule: "Taille de haie — M. Bernard",
  lieu: "12, rue des Lilas, Angers",
  description: "Posé par Atlas.",
  ecritLe: new Date("2026-08-12T05:00:00Z"),
});

cas("ce qui est écrit se relit — et rend les mêmes bornes", () => {
  const [p] = lireEvenementsIcs(ECRIT);
  assert.equal(p.debut.toISOString(), "2026-08-12T06:00:00.000Z");
  assert.equal(p.fin.toISOString(), "2026-08-12T11:00:00.000Z");
  assert.equal(p.intitule, "Taille de haie — M. Bernard");
});

cas("le chantier écrit OCCUPE, il ne se déclare pas disponible", () => {
  // Sans `TRANSP:OPAQUE`, un autre logiciel pourrait le compter comme du temps
  // libre — c'est-à-dire fabriquer le doublon que ce lot supprime.
  assert.match(ECRIT, /TRANSP:OPAQUE/);
});

cas("les lignes longues sont repliées, et aucune ne dépasse 75 octets", () => {
  const long = construireVevenement({
    uid: "atlas-long",
    debut: new Date("2026-08-12T06:00:00Z"),
    fin: new Date("2026-08-12T11:00:00Z"),
    intitule: "Élagage de deux chênes têtards et évacuation des rémanents — Mme Roux-Delatouche",
    lieu: "148 bis, avenue du Général-de-Gaulle, 49000 Angers, portail vert au fond de l'impasse",
    ecritLe: new Date("2026-08-12T05:00:00Z"),
  });
  for (const ligne of long.split("\r\n")) {
    assert.ok(
      Buffer.from(ligne, "utf8").length <= 75,
      `ligne de ${Buffer.from(ligne, "utf8").length} octets : « ${ligne.slice(0, 40)}… »`
    );
  }
  // Et le repli ne doit pas abîmer le contenu : il se relit entier.
  assert.match(lireEvenementsIcs(long)[0].intitule ?? "", /^Élagage de deux chênes têtards/);
  assert.match(lireEvenementsIcs(long)[0].intitule ?? "", /Roux-Delatouche$/);
});

cas("un accent n'est jamais coupé en deux par le repli", () => {
  // Couper au milieu d'un caractère produit un octet illégal, et le serveur
  // rejette le dépôt entier sans dire quelle ligne il n'a pas comprise.
  const accents = construireVevenement({
    uid: "atlas-accents",
    debut: new Date("2026-08-12T06:00:00Z"),
    fin: new Date("2026-08-12T11:00:00Z"),
    intitule: "é".repeat(80),
    ecritLe: new Date("2026-08-12T05:00:00Z"),
  });
  assert.equal(lireEvenementsIcs(accents)[0].intitule, "é".repeat(80));
});

cas("les caractères réservés sont échappés puis relus à l'identique", () => {
  const brut = "Haie, taille; suite\\fin\net ligne 2";
  assert.equal(desechapper(echapper(brut)), brut);
});

// ─── Le fuseau, à part : c'est lui qui décale tout le reste ────────────────

cas("le décalage de Paris suit l'heure d'été", () => {
  assert.equal(decalageMinutes("Europe/Paris", new Date("2026-08-12T12:00:00Z")), 120);
  assert.equal(decalageMinutes("Europe/Paris", new Date("2026-01-12T12:00:00Z")), 60);
});

cas("une heure juste après le changement d'heure ne se trompe pas d'une heure", () => {
  // Le 29 mars 2026 à 2 h, Paris passe à 3 h. Une seule passe de correction
  // emploierait le décalage de la veille : soixante minutes d'écart, deux fois
  // par an, sur les seules dates où personne ne pense à regarder.
  const apres = instantDepuisLocal(
    { annee: 2026, mois: 3, jour: 29, heure: 4 },
    "Europe/Paris"
  );
  assert.equal(apres.toISOString(), "2026-03-29T02:00:00.000Z");
});

cas("une heure qui n'existe pas ne fait pas tomber la lecture", () => {
  // 2 h 30 le 29 mars 2026 n'existe pas à Paris. Aucun choix n'est juste ; ce
  // qui compte est de ne pas perdre l'agenda entier pour un rendez-vous.
  const saut = instantDepuisLocal({ annee: 2026, mois: 3, jour: 29, heure: 2, minute: 30 }, "Europe/Paris");
  assert.ok(!Number.isNaN(saut.getTime()));
});

console.log(
  echecs === 0
    ? "\n✅ iCalendar — 0 échec(s).\n"
    : `\n❌ iCalendar — ${echecs} échec(s).\n`
);
process.exit(echecs === 0 ? 0 : 1);
