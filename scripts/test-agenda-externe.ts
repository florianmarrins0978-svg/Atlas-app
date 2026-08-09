import assert from "node:assert/strict";
import {
  agendaPrisEnCompte,
  creneauxOccupesPar,
  fusionnerOccupationExterne,
  FUSEAU_ARTISAN,
  titreEtatAgenda,
  type EtatAffichableAgenda,
  type PeriodeOccupee,
} from "../src/lib/agenda-externe";
import {
  cleCreneau,
  compterOccupation,
  departPossible,
  fenetreProposition,
  jourRetenable,
} from "../src/server/disponibilites";

// **Ce que cette suite empêche, et c'est le seul endroit du parcours où Atlas
// peut engager l'artisan sur une information qu'il n'a pas.**
//
// Le patron, le 9 août 2026 : *« ce qui serait bien, c'est que l'utilisateur
// puisse, s'il le souhaite ou non, connecter son planning à son agenda
// Google. »* Sans cela, un rendez-vous noté ailleurs est invisible : Atlas
// propose ce jour-là, le client le choisit, et le doublon se découvre le matin
// même — devis parti, date acceptée, promesse faite.
//
// Le raccordement à Google, lui, ne peut pas être éprouvé ici (pas de compte,
// et le réseau de cet environnement refuse Google). Ce module a donc été écrit
// pour ne parler à personne : il reçoit des périodes et rend des créneaux. Tout
// ce qui décide de quelque chose est ici, et tout ce qui est ici est éprouvé.

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

/** Un instant, écrit à l'heure de Paris — comme l'artisan le lirait. */
function paris(jour: string, heure: string): Date {
  // Août : Paris est à UTC+2. Février : UTC+1. Les deux servent plus bas, et
  // c'est délibéré — un décalage codé en dur se trompe la moitié de l'année.
  const decalage = Number(jour.slice(5, 7)) >= 4 && Number(jour.slice(5, 7)) <= 10 ? 2 : 1;
  const [h, m] = heure.split(":").map(Number);
  return new Date(Date.UTC(
    Number(jour.slice(0, 4)),
    Number(jour.slice(5, 7)) - 1,
    Number(jour.slice(8, 10)),
    h - decalage,
    m ?? 0
  ));
}

const cles = (p: PeriodeOccupee) => creneauxOccupesPar(p).map(cleCreneau);

console.log("=== Quelles demi-journées un rendez-vous occupe ===");

cas("un rendez-vous du matin prend le matin, et lui seul", () => {
  assert.deepEqual(cles({ debut: paris("2026-08-12", "09:00"), fin: paris("2026-08-12", "11:00") }), [
    "2026-08-12:matin",
  ]);
});

cas("un rendez-vous de l'après-midi ne mange pas la matinée", () => {
  assert.deepEqual(cles({ debut: paris("2026-08-12", "14:00"), fin: paris("2026-08-12", "16:00") }), [
    "2026-08-12:apres_midi",
  ]);
});

cas("une demi-heure suffit à condamner la demi-journée", () => {
  // Choix assumé, pas une approximation : un rendez-vous à 10 h ne laisse pas
  // une matinée exploitable à un élagueur — charger, rouler, grimper. Bloquer
  // un peu trop coûte un créneau ; ne pas bloquer assez coûte une promesse.
  assert.deepEqual(cles({ debut: paris("2026-08-12", "10:00"), fin: paris("2026-08-12", "10:30") }), [
    "2026-08-12:matin",
  ]);
});

cas("une journée entière prend les deux moitiés", () => {
  assert.deepEqual(cles({ debut: paris("2026-08-12", "09:00"), fin: paris("2026-08-12", "17:00") }), [
    "2026-08-12:matin",
    "2026-08-12:apres_midi",
  ]);
});

cas("des vacances prennent tous les jours traversés, week-end compris", () => {
  // « Suis-je là ? » ne connaît pas les jours ouvrés. Le 15 et le 16 août 2026
  // sont un samedi et un dimanche : ils doivent y être.
  const c = cles({ debut: paris("2026-08-14", "00:00"), fin: paris("2026-08-17", "23:59") });
  assert.ok(c.includes("2026-08-15:matin"), `le samedi manque : ${c.join(", ")}`);
  assert.ok(c.includes("2026-08-16:apres_midi"), `le dimanche manque : ${c.join(", ")}`);
  assert.equal(c.length, 8, `quatre jours font huit demi-journées, reçu ${c.length}`);
});

console.log("\n=== Ce qui ne doit RIEN occuper ===");

cas("un dîner à 20 h ne condamne pas la journée", () => {
  // Atlas ne planifie pas de chantier à 20 h. Bloquer l'après-midi pour un
  // repas priverait l'artisan d'un créneau qu'il aurait accepté.
  assert.deepEqual(cles({ debut: paris("2026-08-12", "20:00"), fin: paris("2026-08-12", "22:00") }), []);
});

cas("un réveil à 6 h non plus", () => {
  assert.deepEqual(cles({ debut: paris("2026-08-12", "06:00"), fin: paris("2026-08-12", "07:00") }), []);
});

cas("une réunion qui finit à 13 h pile n'entame pas l'après-midi", () => {
  assert.deepEqual(cles({ debut: paris("2026-08-12", "11:00"), fin: paris("2026-08-12", "13:00") }), [
    "2026-08-12:matin",
  ]);
});

cas("une période vide, à l'envers, ou illisible n'occupe rien", () => {
  assert.deepEqual(cles({ debut: paris("2026-08-12", "10:00"), fin: paris("2026-08-12", "10:00") }), []);
  assert.deepEqual(cles({ debut: paris("2026-08-12", "16:00"), fin: paris("2026-08-12", "09:00") }), []);
  assert.deepEqual(cles({ debut: new Date("n'importe quoi"), fin: paris("2026-08-12", "09:00") }), []);
});

console.log("\n=== Le fuseau : le défaut d'une ligne qui rendrait tout inutile ===");

cas("un rendez-vous du matin à Paris ne se lit pas la veille au soir", () => {
  // 9 h à Paris en août s'écrit 07:00Z. Lu en UTC sans correction, il tomberait
  // avant le début de journée et n'occuperait RIEN : l'artisan verrait sa
  // matinée proposée au client alors qu'il est chez le médecin.
  assert.deepEqual(cles({ debut: paris("2026-08-12", "09:00"), fin: paris("2026-08-12", "10:00") }), [
    "2026-08-12:matin",
  ]);
});

cas("l'heure d'hiver est lue comme l'heure d'été", () => {
  // Février : Paris est à UTC+1, pas +2. Un décalage figé se tromperait ici.
  assert.deepEqual(cles({ debut: paris("2026-02-10", "09:00"), fin: paris("2026-02-10", "10:00") }), [
    "2026-02-10:matin",
  ]);
});

cas("un rendez-vous tard le soir ne déborde pas sur le lendemain", () => {
  // 23 h à Paris s'écrit 21:00Z le même jour ; mais 23 h à Paris en hiver
  // s'écrit 22:00Z. Dans les deux cas, rien ne doit tomber le 13.
  const c = cles({ debut: paris("2026-08-12", "23:00"), fin: paris("2026-08-12", "23:30") });
  assert.deepEqual(c, [], `un dîner tardif a condamné : ${c.join(", ")}`);
});

console.log("\n=== La fusion : une seule carte d'occupation, jamais deux ===");

cas("une journée entière d'agenda rend le jour improposable", () => {
  const occupation = compterOccupation([]);
  const fenetre = fenetreProposition(new Date("2026-08-01T09:00:00Z"), 90);
  assert.ok(
    jourRetenable("2026-08-12", 2, occupation, 1, fenetre),
    "le scénario ne prouve rien : le jour était déjà pris sans agenda"
  );

  const fusionnee = fusionnerOccupationExterne(
    occupation,
    [{ debut: paris("2026-08-12", "09:00"), fin: paris("2026-08-12", "17:00") }],
    1
  );
  assert.ok(
    !jourRetenable("2026-08-12", 2, fusionnee, 1, fenetre),
    "le rendez-vous n'a rien bloqué : c'est le doublon que tout ceci existe pour empêcher"
  );
});

cas("un rendez-vous du matin repousse le départ à l'après-midi", () => {
  // **Ce que ce cas corrige dans MA propre compréhension.** J'avais d'abord
  // écrit qu'un rendez-vous matinal rendait le jour improposable pour un
  // chantier d'une journée. C'est faux, et le code avait raison : ce chantier
  // peut démarrer l'après-midi et finir le lendemain matin. Le jour reste donc
  // proposable — c'est le DÉPART du matin qui disparaît, et lui seul.
  const fusionnee = fusionnerOccupationExterne(
    compterOccupation([]),
    [{ debut: paris("2026-08-12", "09:00"), fin: paris("2026-08-12", "11:00") }],
    1
  );
  assert.equal(
    departPossible("2026-08-12", 2, compterOccupation([]), 1),
    "matin",
    "le scénario ne prouve rien : le matin était déjà pris sans agenda"
  );
  assert.equal(
    departPossible("2026-08-12", 2, fusionnee, 1),
    "apres_midi",
    "le chantier part encore le matin alors que l'artisan est chez le médecin"
  );
});

cas("un rendez-vous bloque même quand l'artisan a plusieurs équipes", () => {
  // Le nombre d'équipes dit combien de chantiers tournent en parallèle, pas
  // combien de fois l'artisan peut être à deux endroits. Atlas ne sait pas si
  // une équipe part sans lui — le supposer reprendrait le pari qu'on supprime.
  const fusionnee = fusionnerOccupationExterne(
    compterOccupation([]),
    [{ debut: paris("2026-08-12", "09:00"), fin: paris("2026-08-12", "17:00") }],
    3
  );
  const fenetre = fenetreProposition(new Date("2026-08-01T09:00:00Z"), 90);
  assert.ok(
    !jourRetenable("2026-08-12", 2, fusionnee, 3, fenetre),
    "avec trois équipes, le rendez-vous personnel est passé à travers"
  );
});

cas("une demi-journée reste utilisable si l'agenda ne prend que l'autre", () => {
  const fusionnee = fusionnerOccupationExterne(
    compterOccupation([]),
    [{ debut: paris("2026-08-12", "09:00"), fin: paris("2026-08-12", "11:00") }],
    1
  );
  const fenetre = fenetreProposition(new Date("2026-08-01T09:00:00Z"), 90);
  assert.ok(
    jourRetenable("2026-08-12", 1, fusionnee, 1, fenetre),
    "l'après-midi a été perdu alors que seul le matin était pris"
  );
});

cas("sans agenda relié, l'occupation ne bouge pas d'un créneau", () => {
  // L'artisan qui ne relie rien garde exactement l'Atlas d'aujourd'hui — sa
  // décision du 9 août. Ce contrôle est ce qui la tient dans le code.
  const occupation = compterOccupation([
    { jour: "2026-08-12", moment: "matin", dureeDemiJournees: 2 },
  ]);
  const fusionnee = fusionnerOccupationExterne(occupation, [], 1);
  assert.deepEqual([...fusionnee.entries()].sort(), [...occupation.entries()].sort());
});

cas("la carte reçue n'est jamais modifiée", () => {
  // Une carte mutée à distance est un défaut qu'on ne retrouve qu'au troisième
  // écran : celle-ci sert aussi ailleurs, dans le même appel.
  const occupation = compterOccupation([]);
  const avant = occupation.size;
  fusionnerOccupationExterne(
    occupation,
    [{ debut: paris("2026-08-12", "09:00"), fin: paris("2026-08-12", "11:00") }],
    1
  );
  assert.equal(occupation.size, avant, "la carte d'origine a été modifiée sur place");
});

cas("deux rendez-vous le même matin ne comptent pas double", () => {
  const fusionnee = fusionnerOccupationExterne(
    compterOccupation([]),
    [
      { debut: paris("2026-08-12", "09:00"), fin: paris("2026-08-12", "10:00") },
      { debut: paris("2026-08-12", "11:00"), fin: paris("2026-08-12", "12:00") },
    ],
    2
  );
  assert.equal(fusionnee.get("2026-08-12:matin"), 2, "le comptage a dérivé au-delà du nombre d'équipes");
});

cas("un chantier déjà posé n'est pas effacé par un agenda plus permissif", () => {
  const occupation = compterOccupation([
    { jour: "2026-08-12", moment: "matin", dureeDemiJournees: 1 },
    { jour: "2026-08-12", moment: "matin", dureeDemiJournees: 1 },
  ]);
  assert.equal(occupation.get("2026-08-12:matin"), 2);
  const fusionnee = fusionnerOccupationExterne(
    occupation,
    [{ debut: paris("2026-08-12", "09:00"), fin: paris("2026-08-12", "10:00") }],
    1
  );
  assert.equal(
    fusionnee.get("2026-08-12:matin"),
    2,
    "deux chantiers comptés sont retombés à un : l'agenda a écrasé le planning au lieu de s'y ajouter"
  );
});

console.log("\n=== Ce que l'écran annonce en titre ===");

// **Ce bloc existe à cause d'une capture d'écran, pas d'un test rouge.**
//
// L'écran titrait « Atlas tient compte de votre agenda » et démentait trois
// lignes plus bas par « Atlas n'arrive plus à lire votre agenda » : la panne
// était traitée APRÈS le cas « relié et actif », donc jamais atteinte. Rien ne
// pouvait l'attraper — la phrase vivait dans le JSX. Elle est maintenant une
// fonction, et l'ordre des cas est une règle tenue ici.

const RELIE: EtatAffichableAgenda = { configure: true, relie: true, actif: true, derniereErreur: null };

cas("sans identifiants, le titre ne promet rien", () => {
  assert.match(titreEtatAgenda({ ...RELIE, configure: false }), /pas encore disponible/);
});

cas("rien de relié se dit tel quel", () => {
  assert.equal(titreEtatAgenda({ ...RELIE, relie: false }), "Aucun agenda relié");
});

cas("une panne PRIME sur « tout va bien »", () => {
  const enPanne = { ...RELIE, derniereErreur: "Google a refusé la lecture (401)" };
  assert.equal(
    titreEtatAgenda(enPanne),
    "Votre agenda n'est plus lu",
    "le titre annonce que l'agenda est pris en compte alors que la lecture échoue"
  );
  assert.equal(agendaPrisEnCompte(enPanne), false, "la phrase rassurante s'afficherait pendant une panne");
});

cas("une panne prime aussi sur la pause", () => {
  // L'ordre complet compte : panne, puis pause, puis nominal.
  assert.equal(
    titreEtatAgenda({ ...RELIE, actif: false, derniereErreur: "expiré" }),
    "Votre agenda n'est plus lu"
  );
});

cas("la pause se dit, et se distingue du débranchement", () => {
  assert.equal(titreEtatAgenda({ ...RELIE, actif: false }), "Agenda relié, mais en pause");
  assert.equal(agendaPrisEnCompte({ ...RELIE, actif: false }), false);
});

cas("tout en ordre : le titre le dit, et la promesse est tenable", () => {
  assert.equal(titreEtatAgenda(RELIE), "Atlas tient compte de votre agenda");
  assert.equal(agendaPrisEnCompte(RELIE), true);
});

console.log(`\n${echecs === 0 ? "✅" : "❌"} Agenda extérieur — ${echecs} échec(s).`);
if (echecs > 0) process.exit(1);
console.log(`   (fuseau de référence : ${FUSEAU_ARTISAN})`);
