// Les trois rappels : leurs règles, sans base ni navigateur.
//
// **Ce que cette suite protège.** L'écran de « Notifications » et l'action
// serveur emploient la même fonction pour borner et pour lire — deux
// implémentations divergeraient, et l'écart se verrait dans le pire sens : un
// nombre montré à l'écran, un autre appliqué au rappel (`CLAUDE.md` §3).
//
// **Le contrôle qui compte vraiment**, c'est la distinction entre « jamais
// réglé » et « éteint ». Les confondre rallumerait un rappel que le patron a
// délibérément coupé, et il le découvrirait par une alerte qu'il croyait morte.

import assert from "node:assert/strict";
import {
  RAPPELS_PAR_DEFAUT,
  BORNES_RAPPELS,
  lireRappels,
  normaliserRappels,
  seuilAncienneté,
  depuisCombien,
  joursEcoules,
  RYTHMES_RAPPEL,
  rythmeConnu,
  echeanceFacture,
  rappelFactureDu,
  rappelEncoreTu,
  silenceApresVuJours,
  estGenreAcquittable,
  GENRES_ACQUITTABLES,
} from "../src/lib/rappels";

let echecs = 0;
function essai(nom: string, fn: () => void) {
  try {
    fn();
    console.log(`  ✓ ${nom}`);
  } catch (e) {
    echecs++;
    console.log(`  ✗ ${nom}`);
    console.log(`    ${(e as Error).message}`);
  }
}

console.log("=== Les quatre rappels : ce qui s'allume, et ce qui reste éteint ===\n");

essai("jamais réglé : les quatre rappels sont allumés, aux délais du métier", () => {
  assert.deepEqual(lireRappels(undefined), RAPPELS_PAR_DEFAUT);
  assert.deepEqual(lireRappels({}), RAPPELS_PAR_DEFAUT);
});

// **LE CONTRÔLE CENTRAL.** `undefined` (colonne absente de la lecture) et `null`
// (réglé puis éteint) ne veulent pas dire la même chose. Les confondre
// rallumerait un rappel coupé exprès.
essai("éteint : une valeur nulle reste nulle, elle ne retombe pas sur le défaut", () => {
  const lu = lireRappels({ devisSansReponseJours: null, chantierNonFactureJours: null });
  assert.equal(lu.devisSansReponseJours, null);
  assert.equal(lu.chantierNonFactureJours, null);
});

essai("un rappel peut être allumé et l'autre éteint", () => {
  const lu = lireRappels({ devisSansReponseJours: 14, chantierNonFactureJours: null });
  assert.equal(lu.devisSansReponseJours, 14);
  assert.equal(lu.chantierNonFactureJours, null);
});

essai("une valeur hors bornes est RAMENÉE dans les bornes, pas refusée", () => {
  // Refuser laisserait le champ vide, donc le rappel éteint — l'inverse de ce
  // qu'il voulait en tapant un nombre.
  assert.equal(lireRappels({ devisSansReponseJours: 9999 }).devisSansReponseJours, BORNES_RAPPELS.devisSansReponseJours.max);
  assert.equal(lireRappels({ devisSansReponseJours: 0 }).devisSansReponseJours, BORNES_RAPPELS.devisSansReponseJours.min);
  assert.equal(lireRappels({ chantierNonFactureJours: -4 }).chantierNonFactureJours, BORNES_RAPPELS.chantierNonFactureJours.min);
});

essai("une saisie illisible éteint le rappel plutôt que d'inventer un délai", () => {
  assert.equal(lireRappels({ devisSansReponseJours: Number.NaN }).devisSansReponseJours, null);
});

essai("les jours sont entiers : un rappel « au bout de 3,5 jours » n'existe pas", () => {
  assert.equal(lireRappels({ devisSansReponseJours: 3.4 }).devisSansReponseJours, 3);
  assert.equal(lireRappels({ devisSansReponseJours: 3.6 }).devisSansReponseJours, 4);
});

// L'écriture emploie la MÊME fonction que la lecture : sans quoi l'écran
// montrerait un nombre et la base en garderait un autre.
essai("ce qui part en base est ce que l'écran a montré", () => {
  assert.deepEqual(normaliserRappels({ devisSansReponseJours: 9999, chantierNonFactureJours: 5 }), {
    // Non précisé = éteint, pas « inchangé » : l'écran envoie toujours les quatre.
    chantierSansDevisJours: null,
    devisSansReponseJours: BORNES_RAPPELS.devisSansReponseJours.max,
    chantierNonFactureJours: 5,
    factureImpayeeJours: null,
    // **Le rythme fait exception, et c'est délibéré** : il n'éteint rien, donc
    // une saisie qui ne le précise pas retombe sur le défaut plutôt que sur
    // « nul ». Un rythme absent ne doit pas se lire comme un rappel coupé.
    factureImpayeeRythmeJours: 7,
  });
});

essai("écrire sans rien préciser éteint les quatre, il ne les rallume pas", () => {
  // `normaliserRappels({})` est ce que rend un écran dont les quatre
  // interrupteurs sont coupés : il ne doit pas retomber sur le défaut.
  assert.deepEqual(normaliserRappels({}), {
    chantierSansDevisJours: null,
    devisSansReponseJours: null,
    chantierNonFactureJours: null,
    factureImpayeeJours: null,
    factureImpayeeRythmeJours: 7,
  });
});

console.log("");

essai("le seuil recule bien du nombre de jours demandé", () => {
  const maintenant = new Date("2026-08-14T12:00:00Z");
  assert.equal(seuilAncienneté(maintenant, 7).toISOString(), "2026-08-07T12:00:00.000Z");
  assert.equal(seuilAncienneté(maintenant, 1).toISOString(), "2026-08-13T12:00:00.000Z");
});

essai("l'ancienneté se dit en français, jamais en date brute", () => {
  const maintenant = new Date("2026-08-14T12:00:00Z");
  assert.equal(depuisCombien(maintenant, new Date("2026-08-14T09:00:00Z")), "aujourd'hui");
  assert.equal(depuisCombien(maintenant, new Date("2026-08-13T09:00:00Z")), "depuis hier");
  assert.equal(depuisCombien(maintenant, new Date("2026-08-06T12:00:00Z")), "depuis 8 jours");
});

// Un devis parti dans le futur n'existe pas, mais une horloge de travers, si.
// « depuis -2 jours » se lirait comme un défaut de l'application.
essai("une date à venir ne produit pas un nombre négatif", () => {
  const maintenant = new Date("2026-08-14T12:00:00Z");
  assert.equal(depuisCombien(maintenant, new Date("2026-08-16T12:00:00Z")), "aujourd'hui");
});

console.log("");
// ── Le troisième rappel : le devis jamais parti ─────────────────────────────
//
// **Quatre jours, et c'est SON chiffre**, donné le 16 août 2026 (« la B et 4 »)
// au milieu des « deux, trois, quatre, cinq, six » qu'il avait énumérés. Le
// figer ici plutôt que de le relire dans le code : une valeur par défaut qui
// change en silence, c'est un rappel qui se déclenche un autre jour sans que
// personne ne l'ait demandé.
essai("le devis jamais parti se rappelle au bout de 4 jours par défaut", () => {
  assert.equal(RAPPELS_PAR_DEFAUT.chantierSansDevisJours, 4);
  assert.equal(lireRappels(undefined).chantierSansDevisJours, 4);
});

essai("réglé puis éteint, il reste éteint — jamais réglé, il prend le défaut", () => {
  // La distinction qui compte : `null` est un choix, `undefined` une absence.
  assert.equal(lireRappels({ chantierSansDevisJours: null }).chantierSansDevisJours, null);
  assert.equal(lireRappels({}).chantierSansDevisJours, 4);
});

essai("un doigt qui glisse est ramené dans les bornes, jamais refusé", () => {
  assert.equal(lireRappels({ chantierSansDevisJours: 0 }).chantierSansDevisJours, BORNES_RAPPELS.chantierSansDevisJours.min);
  assert.equal(lireRappels({ chantierSansDevisJours: 900 }).chantierSansDevisJours, BORNES_RAPPELS.chantierSansDevisJours.max);
});

// **Le nombre montré et le nombre appliqué viennent du même calcul.** Sinon
// l'étiquette dirait « 14 jours » pendant que la phrase dit « depuis 13 jours »
// — deux vérités sur la même carte, et le patron chercherait laquelle est juste.
essai("l'étiquette et la phrase comptent les mêmes jours", () => {
  const maintenant = new Date("2026-08-16T12:00:00Z");
  const ouvertLe = new Date("2026-08-02T09:00:00Z");
  assert.equal(joursEcoules(maintenant, ouvertLe), 14);
  assert.equal(depuisCombien(maintenant, ouvertLe), "depuis 14 jours");
});

essai("un chantier ouvert à l'instant ne compte aucun jour", () => {
  const t = new Date("2026-08-16T12:00:00Z");
  assert.equal(joursEcoules(t, t), 0);
  assert.equal(depuisCombien(t, t), "aujourd'hui");
});

console.log("");
// ── Le quatrième rappel : la facture impayée ────────────────────────────────
//
// **« A plus B », sa réponse du 16 août 2026.** L'échéance quand elle existe —
// le délai de paiement réglé dans « Devis & factures » —, le jour de l'envoi
// sinon. Rendre `null` aurait été le troisième choix, écarté : un rappel qui se
// tait faute de réglage est un rappel qu'on croit allumé.
essai("A : avec un délai réglé, l'échéance court à partir de l'envoi", () => {
  const parti = new Date("2026-07-01T10:00:00Z");
  assert.equal(echeanceFacture(parti, 30).toISOString().slice(0, 10), "2026-07-31");
  assert.equal(echeanceFacture(parti, 0).toISOString().slice(0, 10), "2026-07-01");
});

essai("B : sans délai réglé, c'est le jour de l'envoi — jamais rien", () => {
  const parti = new Date("2026-07-01T10:00:00Z");
  assert.equal(echeanceFacture(parti, null).getTime(), parti.getTime());
});

essai("le rappel ne paraît pas avant son délai", () => {
  const e = new Date("2026-07-31T00:00:00Z");
  const commun = { echeance: e, apresJours: 1, rythmeJours: 7, repousseeLe: null };
  assert.equal(rappelFactureDu({ ...commun, maintenant: new Date("2026-07-31T12:00:00Z") }), false);
  assert.equal(rappelFactureDu({ ...commun, maintenant: new Date("2026-08-01T00:00:00Z") }), true);
});

// **LE CŒUR DE SA DEMANDE.** Sans rythme, la carte resterait chaque jour
// jusqu'au paiement — et au bout d'une semaine on ne la lit plus.
essai("repoussé, il se tait le temps du rythme, puis revient", () => {
  const e = new Date("2026-07-31T00:00:00Z");
  const commun = { echeance: e, apresJours: 1, rythmeJours: 7 };
  const repousse = new Date("2026-08-03T00:00:00Z");
  // Le lendemain du « Plus tard » : silence.
  assert.equal(
    rappelFactureDu({ ...commun, maintenant: new Date("2026-08-04T00:00:00Z"), repousseeLe: repousse }),
    false
  );
  // Six jours plus tard : toujours silence.
  assert.equal(
    rappelFactureDu({ ...commun, maintenant: new Date("2026-08-09T00:00:00Z"), repousseeLe: repousse }),
    false
  );
  // Au septième, il revient.
  assert.equal(
    rappelFactureDu({ ...commun, maintenant: new Date("2026-08-10T00:00:00Z"), repousseeLe: repousse }),
    true
  );
});

// **Tant qu'il n'a rien touché, la carte RESTE.** Une carte qui s'endormirait
// toute seule pourrait passer un jour où il n'ouvre pas l'application.
essai("jamais repoussé, le rappel ne s'endort pas de lui-même", () => {
  const e = new Date("2026-07-31T00:00:00Z");
  for (const j of ["2026-08-01", "2026-08-05", "2026-09-15"]) {
    assert.equal(
      rappelFactureDu({
        maintenant: new Date(`${j}T00:00:00Z`),
        echeance: e,
        apresJours: 1,
        rythmeJours: 7,
        repousseeLe: null,
      }),
      true,
      j
    );
  }
});

essai("« tous les 15 jours » se tait bien quinze jours", () => {
  const commun = { echeance: new Date("2026-07-31T00:00:00Z"), apresJours: 1, rythmeJours: 15 };
  const repousse = new Date("2026-08-03T00:00:00Z");
  assert.equal(rappelFactureDu({ ...commun, maintenant: new Date("2026-08-17T00:00:00Z"), repousseeLe: repousse }), false);
  assert.equal(rappelFactureDu({ ...commun, maintenant: new Date("2026-08-18T00:00:00Z"), repousseeLe: repousse }), true);
});

essai("les trois rythmes sont ceux de sa planche, et eux seuls", () => {
  assert.deepEqual(RYTHMES_RAPPEL.map((r) => r.jours), [1, 7, 15]);
  assert.deepEqual(RYTHMES_RAPPEL.map((r) => r.libelle), ["Chaque jour", "Chaque semaine", "Tous les 15 jours"]);
});

// **Le rythme n'est jamais nul : ce n'est pas un interrupteur.** On éteint le
// rappel par son délai, et deux façons de l'éteindre se contrediraient.
essai("un rythme inconnu retombe sur « chaque semaine », il n'éteint rien", () => {
  assert.equal(rythmeConnu(3), 7);
  assert.equal(rythmeConnu(null), 7);
  assert.equal(rythmeConnu("15"), 15);
  assert.equal(lireRappels({}).factureImpayeeRythmeJours, 7);
});

essai("le quatrième rappel s'éteint comme les autres, par son délai", () => {
  assert.equal(lireRappels({}).factureImpayeeJours, 1);
  assert.equal(lireRappels({ factureImpayeeJours: null }).factureImpayeeJours, null);
});

// ─────────────────────────────────────────────────────────────────────────────
// « J'AI VU » — sa demande du 30 août 2026, et ce qu'elle ne doit pas casser.
//
// *« Pour chaque notification je dois pouvoir cliquer sur vu pour les faire
// disparaître. »* Le geste fait taire ; il n'efface pas. Un rappel effacé pour
// toujours ferait exactement ce que ces rappels existent pour éviter — perdre
// un chantier de vue —, et ce contrôle est ce qui tient les deux bouts.
// ─────────────────────────────────────────────────────────────────────────────

essai("jamais acquitté : le rappel parle", () => {
  assert.equal(
    rappelEncoreTu({ maintenant: new Date("2026-08-30T12:00:00Z"), vuLe: null, silenceJours: 7 }),
    false,
    "l'absence d'acquittement se lit comme un acquittement"
  );
});

essai("acquitté : il se tait, puis il revient au bout de son délai", () => {
  const vuLe = new Date("2026-08-30T12:00:00Z");
  const veille = (j: number) => new Date(vuLe.getTime() + j * 24 * 3600 * 1000);
  assert.equal(rappelEncoreTu({ maintenant: veille(1), vuLe, silenceJours: 7 }), true, "il parle le lendemain");
  assert.equal(rappelEncoreTu({ maintenant: veille(6.9), vuLe, silenceJours: 7 }), true, "il parle avant l'heure");
  assert.equal(rappelEncoreTu({ maintenant: veille(7), vuLe, silenceJours: 7 }), false, "il ne revient jamais");
  assert.equal(rappelEncoreTu({ maintenant: veille(30), vuLe, silenceJours: 7 }), false);
});

// **Le silence est le délai QU'IL A RÉGLÉ**, pas un second nombre caché : un
// rappel qu'il a mis à quatorze jours se tait quatorze jours. Inventer ici une
// durée à nous, ce serait un réglage qu'il ne pourrait pas changer.
essai("le silence dure le délai réglé pour CE rappel", () => {
  const regles = lireRappels({ devisSansReponseJours: 14, chantierSansDevisJours: 2 });
  assert.equal(silenceApresVuJours("devis-sans-reponse", regles), 14);
  assert.equal(silenceApresVuJours("chantier-sans-devis", regles), 2);
  assert.equal(silenceApresVuJours("chantier-non-facture", regles), RAPPELS_PAR_DEFAUT.chantierNonFactureJours);
});

// Un rappel éteint est filtré bien avant d'arriver ici : la question ne se pose
// pas. On rend quand même un nombre plutôt qu'un cas à traiter — mais JAMAIS
// zéro, qui ferait revenir le rappel dans la seconde.
essai("éteint, le silence retombe sur le délai d'origine — jamais zéro", () => {
  const eteint = lireRappels({ devisSansReponseJours: null });
  assert.equal(silenceApresVuJours("devis-sans-reponse", eteint), RAPPELS_PAR_DEFAUT.devisSansReponseJours);
});

// **La facture impayée n'entre pas dans cette liste**, et c'est ce qui empêche
// deux mécaniques de silence de se contredire sur la même carte : la sienne
// vit depuis le 16 août sur `chantiers.rappel_facture_repousse_le`.
essai("l'impayé n'est pas acquittable : il garde son propre moteur", () => {
  assert.equal(estGenreAcquittable("facture-impayee"), false);
  assert.equal(estGenreAcquittable("devis-sans-reponse"), true);
  assert.equal(estGenreAcquittable("chantier-sans-devis"), true);
  assert.equal(estGenreAcquittable("chantier-non-facture"), true);
  assert.deepEqual([...GENRES_ACQUITTABLES], [
    "chantier-sans-devis",
    "devis-sans-reponse",
    "chantier-non-facture",
  ]);
});

// Une adresse d'action se tape : un genre inventé ferait une ligne
// d'acquittement qui ne correspond à aucun rappel, et que personne ne saurait
// rallumer.
essai("un genre inventé est refusé", () => {
  assert.equal(estGenreAcquittable("tout"), false);
  assert.equal(estGenreAcquittable(""), false);
  assert.equal(estGenreAcquittable(null), false);
  assert.equal(estGenreAcquittable(undefined), false);
  assert.equal(estGenreAcquittable(7), false);
});

if (echecs) {
  console.log(`${echecs} ÉCHEC(S).`);
  process.exit(1);
}
console.log("Les rappels — 0 échec(s).");
