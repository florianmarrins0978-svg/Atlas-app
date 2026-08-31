import assert from "node:assert/strict";
import {
  ongletDuChantier,
  ongletDepuisJalons,
  estAuPlanning,
  estAuCalendrier,
  seuilMemoireCalendrier,
  MEMOIRE_CALENDRIER_JOURS,
} from "../src/lib/onglet-chantier";
import type { ChantierStatut } from "../src/lib/chantier-etat";

// **Un chantier n'apparaît que dans un seul onglet.**
//
// Le patron, le 6 août 2026, capture à l'appui : « une fois le chantier mis au
// planning il ne doit plus figurer dans la catégorie chantier mais seulement au
// planning, et une fois facturé ou leur date de planning passée il doit figurer
// seulement dans terminé ».
//
// Ce qu'il voyait : « Chez Martins », marqué FACTURÉ, dans la liste des
// chantiers — et le même, planifié le 12 août, dans le planning. Une liste qui
// empile tout ce qui a existé ne dit plus ce qui reste à faire.
//
// La règle est ici, et nulle part ailleurs : trois écrans l'appliquent, et
// recopiée trois fois elle rangerait à nouveau le même chantier à deux endroits.

const AUJ = "2026-08-06";

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

console.log("=== Où se range un chantier ===");

cas("un brouillon reste dans les chantiers", () => {
  assert.equal(ongletDuChantier({ statut: "brouillon" }, AUJ), "chantiers");
});

cas("un devis parti, une réponse attendue, un refus : toujours dans les chantiers", () => {
  for (const statut of ["devis_envoye", "en_attente_client", "a_relancer", "devis_retourne", "devis_caduc"] as const) {
    assert.equal(ongletDuChantier({ statut }, AUJ), "chantiers", statut);
  }
});

cas("planifié pour plus tard : au planning, et PLUS dans les chantiers", () => {
  assert.equal(ongletDuChantier({ statut: "planifie", datePlanifiee: "2026-08-12" }, AUJ), "planning");
});

cas("planifié pour aujourd'hui : encore au planning — la journée n'est pas finie", () => {
  assert.equal(ongletDuChantier({ statut: "planifie", datePlanifiee: AUJ }, AUJ), "planning");
});

cas("la date est passée : dans les terminés, même sans « Créer la facture »", () => {
  assert.equal(ongletDuChantier({ statut: "planifie", datePlanifiee: "2026-08-05" }, AUJ), "termines");
});

cas("facturé : dans les terminés, où qu'en soit la date", () => {
  assert.equal(ongletDuChantier({ statut: "facture", datePlanifiee: "2026-09-30" }, AUJ), "termines");
  assert.equal(ongletDuChantier({ statut: "facture" }, AUJ), "termines");
});

cas("déclaré terminé : dans les terminés", () => {
  assert.equal(ongletDuChantier({ statut: "termine", datePlanifiee: "2026-09-30" }, AUJ), "termines");
});

cas("clôturé AVANT sa date : dans les terminés, pas au planning", () => {
  // Le patron peut clôturer un chantier plus tôt que prévu depuis sa fiche, et
  // c'est délibéré (3 août 2026). Le rangement l'ignorait : le chantier restait
  // affiché au planning comme si rien ne s'était passé, et la facture qu'il
  // venait de préparer n'était plus joignable que par son adresse.
  assert.equal(
    ongletDepuisJalons({ datePlanifiee: "2026-08-12", termineAt: new Date("2026-08-06") }, AUJ),
    "termines"
  );
  assert.equal(
    estAuPlanning({ datePlanifiee: "2026-08-12", termineAt: new Date("2026-08-06"), devisEnvoyeAt: new Date() }, AUJ),
    false
  );
});

console.log("\n=== Les deux portes disent la même chose ===");

// **Le défaut du 8 août ne venait pas de la règle, mais de ses recopies.** Le
// planning comparait `datePlanifiee < aujourd'hui` en TypeScript, le dépôt des
// terminés `date_planifiee <= aujourd'hui` en SQL — un signe d'écart, et un
// chantier prévu AUJOURD'HUI dans les deux onglets.
//
// Il y a désormais deux portes, une par forme de donnée disponible : le statut
// affiché pour les écrans, les jalons datés pour les dépôts. Ce contrôle exige
// qu'elles ne puissent jamais diverger.

cas("statut et jalons rendent le MÊME onglet, sur toutes les combinaisons", () => {
  const dates = [null, "2026-08-01", AUJ, "2026-08-12"];
  const fins: { termineAt: Date | null; factureEnvoyeeAt: Date | null; statut: ChantierStatut }[] = [
    { termineAt: null, factureEnvoyeeAt: null, statut: "planifie" },
    { termineAt: new Date("2026-08-06"), factureEnvoyeeAt: null, statut: "termine" },
    { termineAt: new Date("2026-08-06"), factureEnvoyeeAt: new Date("2026-08-06"), statut: "facture" },
  ];
  for (const datePlanifiee of dates) {
    for (const fin of fins) {
      // Sans date ni fin, le statut « planifié » n'existe pas : le cas est
      // exclu plutôt que forcé, pour ne pas éprouver un état impossible.
      if (!datePlanifiee && fin.statut === "planifie") continue;
      const parJalons = ongletDepuisJalons({ datePlanifiee, ...fin }, AUJ);
      const parStatut = ongletDuChantier({ statut: fin.statut, datePlanifiee }, AUJ);
      assert.equal(
        parJalons,
        parStatut,
        `date=${datePlanifiee} fin=${fin.statut} : jalons → « ${parJalons} », statut → « ${parStatut} »`
      );
    }
  }
});

console.log("\n=== Aucun chantier dans deux onglets, ni dans zéro ===");

// **Le contrôle qui manquait, et son ancêtre inutile.** Celui d'avant vérifiait
// que l'onglet rendu figurait parmi trois chaînes — une tautologie, verte quoi
// qu'il arrive. Il n'a donc rien vu quand les écrans se sont mis à contredire
// la règle. Celui-ci compte les onglets qui retiennent le chantier : deux est
// le défaut du 6 août, zéro celui du 8.

cas("chaque état est retenu par exactement UN onglet, et par le BON", () => {
  // L'onglet attendu est écrit à la main, état par état. Sans lui, le contrôle
  // ne prouverait que la cohérence des fonctions entre elles — et trois
  // fonctions qui se trompent ensemble restent cohérentes. C'est ce qui rend ce
  // tableau utile : il dit ce que le patron doit voir, pas ce que le code fait.
  const etats: {
    nom: string;
    statut: ChantierStatut;
    datePlanifiee: string | null;
    termineAt: Date | null;
    factureEnvoyeeAt: Date | null;
    attendu: "chantiers" | "planning" | "termines";
  }[] = [
    { nom: "brouillon", statut: "brouillon", datePlanifiee: null, termineAt: null, factureEnvoyeeAt: null, attendu: "chantiers" },
    { nom: "en attente du client", statut: "en_attente_client", datePlanifiee: null, termineAt: null, factureEnvoyeeAt: null, attendu: "chantiers" },
    { nom: "planifié plus tard", statut: "planifie", datePlanifiee: "2026-08-12", termineAt: null, factureEnvoyeeAt: null, attendu: "planning" },
    { nom: "planifié AUJOURD'HUI", statut: "planifie", datePlanifiee: AUJ, termineAt: null, factureEnvoyeeAt: null, attendu: "planning" },
    { nom: "date passée", statut: "planifie", datePlanifiee: "2026-08-01", termineAt: null, factureEnvoyeeAt: null, attendu: "termines" },
    { nom: "clôturé avant sa date", statut: "termine", datePlanifiee: "2026-08-12", termineAt: new Date("2026-08-06"), factureEnvoyeeAt: null, attendu: "termines" },
    { nom: "facturé", statut: "facture", datePlanifiee: "2026-08-12", termineAt: new Date("2026-08-06"), factureEnvoyeeAt: new Date("2026-08-06"), attendu: "termines" },
  ];

  for (const e of etats) {
    // Chaque onglet est interrogé par la fonction que SON écran appelle.
    const dansChantiers = ongletDuChantier({ statut: e.statut, datePlanifiee: e.datePlanifiee }, AUJ) === "chantiers";
    const dansPlanning = estAuPlanning(
      { datePlanifiee: e.datePlanifiee, termineAt: e.termineAt, factureEnvoyeeAt: e.factureEnvoyeeAt, devisEnvoyeAt: new Date("2026-08-01") },
      AUJ
    );
    const dansTermines =
      ongletDepuisJalons({ datePlanifiee: e.datePlanifiee, termineAt: e.termineAt, factureEnvoyeeAt: e.factureEnvoyeeAt }, AUJ) ===
      "termines";

    const retenus = [
      dansChantiers ? "chantiers" : null,
      dansPlanning ? "planning" : null,
      dansTermines ? "termines" : null,
    ].filter(Boolean);

    assert.deepEqual(
      retenus,
      [e.attendu],
      `« ${e.nom} » attendu dans « ${e.attendu} », retenu par ${retenus.length === 0 ? "aucun onglet" : retenus.join(" et ")}`
    );
  }
});

console.log("\n=== La mémoire du calendrier — deux ans (31 août 2026) ===");

// **Sa question du 31 août 2026 :** « est-ce que le planning garde en mémoire
// les chantiers passés ? » — non, et son juillet était blanc. Il a choisi la
// proposition B de la planche 98, et deux ans de mémoire.
//
// Ce qui est éprouvé ici, c'est la SÉPARATION des deux questions : le
// calendrier peint un jour passé, et le chantier reste malgré tout dans
// « Terminés ». Les confondre remettrait un chantier dans deux onglets — le
// défaut du 6 août 2026, que ce fichier existe pour empêcher.

const DEVIS = { devisEnvoyeAt: new Date("2026-07-01") };
const FINI = { termineAt: new Date("2026-07-02"), factureEnvoyeeAt: new Date("2026-07-05") };

cas("un jour passé se peint de nouveau — c'est toute sa demande", () => {
  assert.equal(estAuCalendrier({ datePlanifiee: "2026-08-01", ...FINI, ...DEVIS }, AUJ), true);
  // …alors qu'il n'est PAS au planning, et ne doit pas y revenir.
  assert.equal(estAuPlanning({ datePlanifiee: "2026-08-01", ...FINI, ...DEVIS }, AUJ), false);
});

cas("et il reste rangé dans « Terminés », lui seul", () => {
  assert.equal(ongletDepuisJalons({ datePlanifiee: "2026-08-01", ...FINI }, AUJ), "termines");
});

cas("un chantier passé jamais clôturé se peint aussi", () => {
  // Le travail a eu lieu ; que la facture soit partie ou non ne change rien à
  // ce que le calendrier doit montrer.
  assert.equal(estAuCalendrier({ datePlanifiee: "2026-08-01", ...DEVIS }, AUJ), true);
});

cas("aujourd'hui et l'à-venir ne changent PAS d'un pouce", () => {
  for (const jour of [AUJ, "2026-08-12", "2027-01-04"]) {
    assert.equal(
      estAuCalendrier({ datePlanifiee: jour, ...DEVIS }, AUJ),
      estAuPlanning({ datePlanifiee: jour, ...DEVIS }, AUJ),
      `le ${jour} doit répondre comme avant`
    );
  }
});

cas("un chantier À VENIR clôturé d'avance libère toujours sa journée", () => {
  // Sa décision du 3 août 2026 : on clôture depuis la fiche, plus tôt que
  // prévu. La journée redevient libre — et ce lot ne doit pas la reprendre.
  assert.equal(estAuCalendrier({ datePlanifiee: "2026-08-12", ...FINI, ...DEVIS }, AUJ), false);
});

cas("sans date, rien à peindre", () => {
  assert.equal(estAuCalendrier({ datePlanifiee: null, ...DEVIS }, AUJ), false);
});

cas(`la mémoire s'arrête à ${MEMOIRE_CALENDRIER_JOURS} jours, bornes comprises`, () => {
  const seuil = seuilMemoireCalendrier(AUJ);
  // Deux ans jour pour jour depuis le 6 août 2026 — l'année bissextile 2024
  // comprise. La valeur est écrite en clair plutôt que recalculée : un contrôle
  // qui refait le calcul qu'il vérifie ne vérifie rien.
  assert.equal(seuil, "2024-08-06", `seuil lu : ${seuil}`);
  // Le jour du seuil est DEDANS…
  assert.equal(estAuCalendrier({ datePlanifiee: seuil, ...FINI, ...DEVIS }, AUJ), true);
  // …et la veille est dehors. Une borne qui glisse d'un jour, c'est le défaut
  // du 8 août 2026 (« < » contre « <= »), qui avait mis un chantier dans deux
  // onglets à la fois.
  assert.equal(estAuCalendrier({ datePlanifiee: "2024-08-05", ...FINI, ...DEVIS }, AUJ), false);
});

cas("la borne de l'écran et celle de la requête SQL sont la MÊME", () => {
  // `listerChantiersPourPlanning` borne sa requête avec `seuilMemoireCalendrier`
  // et l'écran tamise avec `estAuCalendrier`, qui l'appelle aussi. Deux valeurs
  // écrites séparément auraient fini par désigner deux jours différents : un
  // chantier chargé sans être peint, ou peint sans être chargé.
  const seuil = seuilMemoireCalendrier(AUJ);
  const veille = new Date(`${seuil}T12:00:00Z`);
  veille.setUTCDate(veille.getUTCDate() - 1);
  assert.equal(estAuCalendrier({ datePlanifiee: seuil, ...DEVIS }, AUJ), true);
  assert.equal(estAuCalendrier({ datePlanifiee: veille.toISOString().slice(0, 10), ...DEVIS }, AUJ), false);
});

console.log(`\n${echecs === 0 ? "✅" : "❌"} Rangement des chantiers — ${echecs} échec(s).`);
if (echecs > 0) process.exit(1);
