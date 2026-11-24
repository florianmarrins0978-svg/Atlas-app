import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import {
  FORMULES,
  FORMULE_DE_LESSAI,
  JOURS_AVANT_ALERTE,
  JOURS_ESSAI,
  MODULES,
  RETOUCHES_DU_PLAN_OFFERT_MS,
  accesALaFonction,
  carteDeLaFormule,
  centimes,
  enLectureSeule,
  etatDeLAcces,
  phraseLectureSeule,
  etatAffiche,
  etatDeLEssai,
  equipeTientDansLaFormule,
  etiquetteDeLOutil,
  finDeLEssai,
  fonctionOuverte,
  formule,
  formuleChoisie,
  jourEnLettres,
  lignesDeLaFormule,
  modulesChoisis,
  montantDu,
  phraseDeLaFermeture,
  placePourUnAcces,
  prixALAnnee,
  retoucheDuPlanOfferte,
  roleFabrique,
  texteDuRuban,
  type FonctionReservee,
} from "../src/lib/abonnements";
import { ROLES } from "../src/lib/acces-roles";

// LES TROIS FORMULES — la règle pure, éprouvée sans base ni clé.
//
// **Le contrôle le plus important de ce fichier est le premier** : il confronte
// les prix du code à ceux de la PLANCHE qu'il a validée. Un tarif affiché qui
// ne serait pas le tarif débité est le pire défaut que cet écran puisse
// produire, et c'est aussi celui qui ne se voit pas — personne ne relit une
// planche en modifiant un fichier TypeScript.

let echecs = 0;
function cas(nom: string, f: () => void) {
  try {
    f();
    console.log(`  ✓ ${nom}`);
  } catch (e) {
    echecs++;
    console.error(`  ✗ ${nom}\n    ${(e as Error).message}`);
  }
}

// La planche du 24 septembre 2026, qui remplace celle du 9 : 39, 59 et 159 €,
// et ce qui manque barré.
const PLANCHE = path.join(__dirname, "..", "appli", "abonnements-ce-qui-manque.html");

const FONCTIONS: readonly FonctionReservee[] = ["arrosage", "diagnostic", "fiche-chantier", "absences", "retours"];

console.log("=== Les prix du code sont ceux de sa planche ===\n");

cas("la planche existe encore — sans elle, ce contrôle ne mesurerait rien", () => {
  const texte = readFileSync(PLANCHE, "utf8");
  // Un contrôle qui mesure ZÉRO ne mesure rien (`CLAUDE.md` §5) : si la planche
  // était vidée ou déplacée, les assertions suivantes passeraient à vide.
  assert.ok(texte.includes("var FORMULES"), "la planche ne porte plus sa liste de formules");
});

cas("les trois formules et leurs deux prix correspondent à la planche", () => {
  const texte = readFileSync(PLANCHE, "utf8");
  for (const f of FORMULES) {
    // La planche écrit : { nom: "Artisan", prix: 39, an: 390, …
    const motif = new RegExp(`nom:\\s*"${f.nom}",\\s*prix:\\s*(\\d+),\\s*an:\\s*(\\d+)`);
    const trouve = texte.match(motif);
    assert.ok(trouve, `la formule « ${f.nom} » n'est pas dans la planche`);
    assert.equal(Number(trouve[1]), f.prixMensuel, `prix mensuel de ${f.nom}`);
    assert.equal(Number(trouve[2]), f.prixAnnuel, `prix annuel de ${f.nom}`);
  }
});

// **La planche du module, choisie le 19 novembre 2026 (A, trois lignes, en
// doré)** : chaque ligne et chaque introduction des cartes y est écrite telle
// que le code la rend, et le prix des outils aussi. La planche du 24 septembre
// reste juge des trois prix ; ses lignes ne le sont plus, puisqu'elle portait
// encore les outils de paysage dans Entreprise.
const PLANCHE_DU_MODULE = path.join(__dirname, "..", "appli", "soignee", "abonnement-module-paysage.html");

cas("les cartes et le bloc des outils sont ceux de sa planche du 19 novembre", () => {
  const texte = readFileSync(PLANCHE_DU_MODULE, "utf8");
  assert.ok(texte.includes("Ajoutez les outils de paysage"), "la planche ne porte plus le bloc des outils");
  for (const f of FORMULES) {
    const carte = carteDeLaFormule(f);
    if (carte.introduction) assert.ok(texte.includes(carte.introduction), `introduction de ${f.nom}`);
    for (const l of carte.lignes) assert.ok(texte.includes(l.texte), `« ${l.texte} » (${f.nom}) absente de la planche`);
  }
  const outils = MODULES[0];
  assert.ok(texte.includes(`Ajouter pour ${outils.prixMensuel} € par mois`), "le bouton de la planche ne dit pas le prix du code");
  for (const o of outils.outils) assert.ok(texte.includes(o.titre) && texte.includes(o.phrase), `outil « ${o.titre} »`);
});

cas("l'année vaut dix mois — deux mois offerts, comme l'annonce la bascule", () => {
  for (const f of FORMULES) {
    assert.equal(f.prixAnnuel, f.prixMensuel * 10, `${f.nom} : l'annuel n'offre pas deux mois`);
  }
});

// **Sa demande du 26 octobre 2026**, sur la planche des Réglages soignés : à
// l'année, le prix de douze mois barré au-dessus du prix de dix, et ce qu'on
// gagne en euros. Les trois chiffres se CALCULENT sur `prixMensuel` et
// `prixAnnuel` : écrits en dur dans l'écran, ils mentiraient au premier prix
// qui bouge, et c'est le pire défaut de cet écran (en tête de ce fichier).
cas("à l'année : douze mois barrés, le prix payé, et ce qu'on gagne en euros", () => {
  const attendu: Record<string, { douzeMois: number; annuel: number; gain: number }> = {
    artisan: { douzeMois: 468, annuel: 390, gain: 78 },
    entreprise: { douzeMois: 708, annuel: 590, gain: 118 },
    illimite: { douzeMois: 1908, annuel: 1590, gain: 318 },
  };
  for (const f of FORMULES) {
    assert.deepEqual(prixALAnnee(f), attendu[f.code], `${f.nom}`);
  }
});

cas("le gain annoncé vaut les deux mois offerts que promet la bascule", () => {
  for (const f of FORMULES) {
    assert.equal(prixALAnnee(f).gain, f.prixMensuel * 2, `${f.nom} : le gain ne vaut pas deux mois`);
  }
});

// **Artisan porte ce qu'il contient** — sa remarque du 19 novembre 2026 :
// « Dans les trois formules » se lisait au-dessus, et la carte d'Artisan ne
// montrait plus que des lignes barrées. Les deux autres disent « Tout ce
// qu'offre la précédente, et : », puis leur seule différence.
cas("Artisan : ses quatre lignes cochées, puis ce qui lui manque, barré", () => {
  const carte = carteDeLaFormule(formule("artisan")!);
  assert.equal(carte.introduction, null);
  assert.deepEqual(
    carte.lignes.map((l) => [l.texte, l.manque]),
    [
      ["Devis et factures illimités", false],
      ["Vos dictées transcrites et chiffrées", false],
      ["Le planning de vos chantiers", false],
      ["Votre relevé de TVA, tenu tout seul", false],
      ["Vos salariés ont accès au planning", true],
      ["Les absences de vos équipes", true],
      ["Les retours d’intervention de vos salariés", true],
      ["Jusqu’à 5 personnes aux devis et aux factures", true],
    ]
  );
});

cas("Entreprise : « Tout ce qu'offre Artisan, et : », puis ce qu'elle ajoute", () => {
  const carte = carteDeLaFormule(formule("entreprise")!);
  assert.equal(carte.introduction, "Tout ce qu’offre Artisan, et :");
  assert.deepEqual(
    carte.lignes.map((l) => [l.texte, l.manque]),
    [
      ["Vos salariés ont accès au planning", false],
      ["Les absences de vos équipes", false],
      ["Les retours d’intervention de vos salariés", false],
      ["Jusqu’à 5 personnes aux devis et aux factures", false],
      ["Autant de personnes que vous voulez aux devis et aux factures", true],
    ]
  );
});

cas("Illimité : « Tout ce qu'offre Entreprise, et : », et sa seule différence", () => {
  const carte = carteDeLaFormule(formule("illimite")!);
  assert.equal(carte.introduction, "Tout ce qu’offre Entreprise, et :");
  assert.deepEqual(carte.lignes.map((l) => [l.texte, l.manque]), [["Autant de personnes que vous voulez aux devis et aux factures", false]]);
});

cas("rien ne se perd : une carte et celles d'avant redisent tout ce que la formule ouvre", () => {
  FORMULES.forEach((f, i) => {
    const ouvre = lignesDeLaFormule(f).filter((l) => !l.manque).map((l) => l.texte).sort();
    const dit = FORMULES.slice(0, i + 1)
      .flatMap((g) => carteDeLaFormule(g).lignes.filter((l) => !l.manque).map((l) => l.texte))
      .filter((t) => ouvre.includes(t));
    assert.deepEqual([...new Set(dit)].sort(), ouvre, `${f.nom}`);
  });
});

cas("aucune carte ne parle plus des outils de paysage : ils se règlent au-dessus, une fois", () => {
  for (const f of FORMULES) {
    for (const l of lignesDeLaFormule(f)) assert.ok(!/arrosage|diagnostic|fiches de chantier/i.test(l.texte), `${f.nom} : ${l.texte}`);
  }
});

console.log("\n=== Les outils de paysage — ses décisions du 18 et du 19 novembre 2026 ===\n");

cas("6 € HT par mois, 60 € à l'année, pour les trois outils de la page Paysage", () => {
  assert.equal(MODULES.length, 1);
  const outils = MODULES[0];
  assert.equal(outils.code, "paysage");
  assert.equal(outils.prixMensuel, 6);
  assert.equal(outils.prixAnnuel, 60);
  assert.equal(outils.prixAnnuel, outils.prixMensuel * 10, "l'année des outils n'offre pas deux mois");
  assert.deepEqual([...outils.fonctions].sort(), ["arrosage", "diagnostic", "fiche-chantier"]);
});

cas("le même prix pour les trois formules : chaque total prend 6 €, ou 60 € à l'année", () => {
  for (const f of FORMULES) {
    assert.equal(montantDu(f, "mensuelle", ["paysage"]), f.prixMensuel + 6, f.nom);
    assert.equal(montantDu(f, "annuelle", ["paysage"]), f.prixAnnuel + 60, f.nom);
  }
  assert.equal(centimes(formule("artisan")!, "mensuelle", ["paysage"]), 4500);
  assert.equal(centimes(formule("artisan")!, "annuelle", ["paysage"]), 45000);
});

cas("à l'année avec les outils : 540 € barrés, 450 €, « Vous gagnez 90 € » (sa planche)", () => {
  assert.deepEqual(prixALAnnee(formule("artisan")!, ["paysage"]), { douzeMois: 540, annuel: 450, gain: 90 });
  assert.deepEqual(prixALAnnee(formule("entreprise")!, ["paysage"]), { douzeMois: 780, annuel: 650, gain: 130 });
});

cas("Entreprise et Illimité ne comprennent plus les outils ; avec eux, toute formule les ouvre", () => {
  const PAYSAGE: FonctionReservee[] = ["arrosage", "diagnostic", "fiche-chantier"];
  for (const f of FORMULES) {
    for (const fn of PAYSAGE) {
      assert.equal(fonctionOuverte({ formule: f.code, statut: "actif", modules: [] }, fn), false, `${f.nom} ouvre ${fn} sans les outils`);
      assert.equal(fonctionOuverte({ formule: f.code, statut: "actif", modules: ["paysage"] }, fn), true, `${f.nom} ferme ${fn} avec les outils`);
    }
  }
});

console.log("\n=== Ce qui part chez le prestataire ===\n");

cas("le montant s'envoie en centimes, exactement", () => {
  const artisan = formule("artisan");
  assert.ok(artisan);
  assert.equal(centimes(artisan, "mensuelle"), 3900);
  assert.equal(centimes(artisan, "annuelle"), 39000);
});

cas("montantDu suit la périodicité", () => {
  const entreprise = formule("entreprise");
  assert.ok(entreprise);
  assert.equal(montantDu(entreprise, "mensuelle"), 59);
  assert.equal(montantDu(entreprise, "annuelle"), 590);
});

cas("une formule inconnue rend null — jamais une formule par défaut", () => {
  assert.equal(formule("premium"), null);
  assert.equal(formule(null), null);
  assert.equal(formule(""), null);
});

console.log("\n=== Qui compte dans le plafond — sa correction du 9 septembre ===\n");

cas("le salarié ne compte JAMAIS", () => {
  assert.equal(roleFabrique("salarie"), false);
});

cas("le patron, la facturation et le commercial comptent", () => {
  assert.equal(roleFabrique("proprietaire"), true);
  assert.equal(roleFabrique("facturation"), true);
  assert.equal(roleFabrique("commercial"), true);
});

cas("tous les rôles du dépôt sont tranchés — aucun n'échappe à la règle", () => {
  // Si un cinquième rôle naissait sans passer par `roleFabrique`, il tomberait
  // en silence du bon côté du plafond, et personne ne le verrait.
  for (const r of ROLES) assert.equal(typeof roleFabrique(r), "boolean", `rôle ${r}`);
});

console.log("\n=== Le plafond de chaque formule ===\n");

// **Artisan, c'est lui seul** — sa règle du 18 novembre 2026 : *« avec la
// formule artisan, il doit avoir qu'un seul accès »*. Le salarié n'y entre pas
// non plus. Ailleurs, la correction du 9 septembre tient : on compte qui
// FABRIQUE, jamais les salariés.
const EQUIPE = (comptes: number, fabricants: number, salaries = comptes - fabricants) => ({ comptes, fabricants, salaries });

cas("Artisan : un seul accès, le sien ; un salarié est refusé comme un commercial", () => {
  const salarie = placePourUnAcces("artisan", EQUIPE(1, 1), "salarie");
  assert.equal(salarie.ok, false);
  if (!salarie.ok) assert.deepEqual(salarie.refus, { genre: "seul", nom: "Artisan" });
  assert.equal(placePourUnAcces("artisan", EQUIPE(1, 1), "commercial").ok, false);
  assert.equal(placePourUnAcces("artisan", EQUIPE(0, 0), "proprietaire").ok, true);
});

cas("Entreprise : cinq aux devis et aux factures, la sixième est refusée, les salariés passent", () => {
  assert.equal(placePourUnAcces("entreprise", EQUIPE(9, 4), "commercial").ok, true);
  const refus = placePourUnAcces("entreprise", EQUIPE(9, 5), "facturation");
  assert.equal(refus.ok, false);
  if (!refus.ok) assert.deepEqual(refus.refus, { genre: "fabricants", plafond: 5, nom: "Entreprise" });
  assert.equal(placePourUnAcces("entreprise", EQUIPE(30, 5), "salarie").ok, true);
});

cas("Illimité : aucun plafond, même à cent", () => {
  assert.equal(placePourUnAcces("illimite", EQUIPE(100, 100), "commercial").ok, true);
});

cas("SANS ABONNEMENT, aucun plafond — rien ne se ferme aujourd'hui", () => {
  // C'est la règle qui empêche ce lot de couper l'application des artisans qui
  // s'en servent déjà, avant que la moindre offre existe.
  assert.equal(placePourUnAcces(null, EQUIPE(50, 50), "commercial").ok, true);
  assert.equal(placePourUnAcces(undefined, EQUIPE(50, 50), "salarie").ok, true);
});

cas("une formule inconnue en base n'invente pas de plafond", () => {
  assert.equal(placePourUnAcces("premium", EQUIPE(999, 999), "commercial").ok, true);
});

// **Choisir Artisan avec des salariés déjà invités est refusé** — sa réponse
// du 18 novembre 2026, et c'est l'article 14.6 des conditions générales. Le
// même refus ferme l'écart trouvé le même jour : passer d'Entreprise à Artisan
// avec trois personnes qui facturent n'était refusé nulle part.
cas("passer à une formule trop petite pour l'équipe : refusé, et la phrase dit qui retirer", () => {
  assert.equal(equipeTientDansLaFormule("artisan", EQUIPE(1, 1)), null);
  assert.equal(
    equipeTientDansLaFormule("artisan", EQUIPE(3, 1)),
    "Vous avez 2 salariés. Retirez-les d’abord dans Équipe."
  );
  assert.equal(
    equipeTientDansLaFormule("artisan", EQUIPE(2, 1)),
    "Vous avez 1 salarié. Retirez-le d’abord dans Équipe."
  );
  assert.equal(
    equipeTientDansLaFormule("artisan", EQUIPE(3, 2, 1)),
    "Artisan est pour vous seul. Retirez d’abord les 2 autres accès dans Équipe."
  );
  assert.equal(
    equipeTientDansLaFormule("entreprise", EQUIPE(10, 7)),
    "Entreprise comprend 5 personnes aux devis et aux factures. Retirez-en d’abord 2 dans Équipe."
  );
  assert.equal(equipeTientDansLaFormule("entreprise", EQUIPE(40, 5)), null);
  assert.equal(equipeTientDansLaFormule("illimite", EQUIPE(400, 400)), null);
  assert.equal(equipeTientDansLaFormule("premium", EQUIPE(400, 400)), null);
});

console.log("\n=== Ce que l'écran affiche ===\n");

const LE_9 = new Date("2026-09-09T10:00:00Z");
const LE_9_OCTOBRE = new Date("2026-10-09T10:00:00Z");

cas("sans abonnement : Atlas ne facture rien, et le dit", () => {
  const e = etatAffiche(null, LE_9);
  assert.equal(e.titre, "Aucun abonnement");
  assert.equal(e.ton, "calme");
});

cas("actif : la formule, le prix et la date du prochain paiement", () => {
  const e = etatAffiche(
    {
      formule: "entreprise",
      periodicite: "mensuelle",
      statut: "actif",
      periodeFin: LE_9_OCTOBRE,
      annulationDemandee: false,
    },
    LE_9
  );
  assert.equal(e.titre, "Entreprise");
  assert.match(e.detail ?? "", /59 € HT par mois/);
  assert.match(e.detail ?? "", /9 octobre 2026/);
  assert.equal(e.ton, "calme");
  assert.deepEqual(e.signe, { genre: "formule" });
});

// **Ni point médian ni tiret : des phrases** (`CLAUDE.md` §3, sa règle du
// 22 septembre 2026). Le prix et le prochain paiement se collaient d'un « · ».
cas("actif : le prix et le prochain paiement se disent en deux phrases, sans point médian", () => {
  const e = etatAffiche(
    { formule: "entreprise", periodicite: "mensuelle", statut: "actif", periodeFin: LE_9_OCTOBRE, annulationDemandee: false },
    LE_9
  );
  assert.equal(e.detail, "59 € HT par mois. Prochain paiement le 9 octobre 2026.");
  const sansDate = etatAffiche(
    { formule: "entreprise", periodicite: "annuelle", statut: "actif", periodeFin: null, annulationDemandee: false },
    LE_9
  );
  assert.equal(sansDate.detail, "590 € HT par an.");
});

// **L'état se lit d'un coup d'œil** (planche du 26 octobre 2026) : les jours
// d'essai dans un carré, l'échéance d'un arrêt aussi, une pastille sinon. La
// fonction DIT ce qui se montre : l'écran ne refait pas la distinction entre
// un arrêt demandé et un abonnement qui court, qui n'appartient qu'à elle.
cas("ce qui se lit d'un coup d'œil suit l'état, sans que l'écran le redécide", () => {
  assert.deepEqual(etatAffiche(null, LE_9).signe, { genre: "aucun" });
  const arret = etatAffiche(
    { formule: "entreprise", periodicite: "mensuelle", statut: "actif", periodeFin: new Date("2026-11-09T10:00:00Z"), annulationDemandee: true },
    LE_9
  );
  assert.deepEqual(arret.signe, { genre: "echeance", jour: 9, mois: "nov." });
  assert.deepEqual(
    etatAffiche({ formule: "artisan", periodicite: "mensuelle", statut: "impaye", periodeFin: null, annulationDemandee: false }, LE_9).signe,
    { genre: "paiement" }
  );
  assert.deepEqual(
    etatAffiche({ formule: "artisan", periodicite: "mensuelle", statut: "resilie", periodeFin: null, annulationDemandee: false }, LE_9).signe,
    { genre: "aucun" }
  );
});

cas("impayé : le ton alerte, et la phrase dit quoi faire", () => {
  const e = etatAffiche(
    { formule: "artisan", periodicite: "mensuelle", statut: "impaye", periodeFin: null, annulationDemandee: false },
    LE_9
  );
  assert.equal(e.ton, "attention");
  assert.match(e.detail ?? "", /carte/i);
});

cas("résiliation demandée : la date de fin, et ce qu'il garde jusque-là", () => {
  const e = etatAffiche(
    {
      formule: "artisan",
      periodicite: "mensuelle",
      statut: "actif",
      periodeFin: LE_9_OCTOBRE,
      annulationDemandee: true,
    },
    LE_9
  );
  assert.match(e.titre, /s’arrête le 9 octobre 2026/);
  assert.equal(e.ton, "attention");
});

cas("résilié : on peut reprendre, et l'écran ne dramatise pas", () => {
  const e = etatAffiche(
    { formule: "artisan", periodicite: "mensuelle", statut: "resilie", periodeFin: null, annulationDemandee: false },
    LE_9
  );
  assert.equal(e.ton, "calme");
});

cas("la date s'écrit en français, sans dépendre du fuseau de la machine", () => {
  assert.equal(jourEnLettres(new Date("2026-01-01T23:30:00Z")), "1 janvier 2026");
  assert.equal(jourEnLettres(new Date("2026-12-31T00:00:00Z")), "31 décembre 2026");
});

console.log("\n=== L'essai de quinze jours — ses trois décisions du 10 septembre 2026 ===\n");

const DEBUT = new Date("2026-09-13T09:00:00Z");
const FIN = finDeLEssai(DEBUT);
const ESSAI = {
  formule: FORMULE_DE_LESSAI,
  periodicite: "mensuelle" as const,
  statut: "essai" as const,
  periodeFin: FIN,
  annulationDemandee: false,
  modules: [] as const,
};
const apres = (jours: number, heures = 0) => new Date(DEBUT.getTime() + (jours * 24 + heures) * 3600 * 1000);

cas("« essai gratuit 15 jours » — la durée est la sienne, et la fin tombe quinze jours pleins plus tard", () => {
  assert.equal(JOURS_ESSAI, 15);
  assert.equal((FIN.getTime() - DEBUT.getTime()) / 86_400_000, 15);
});

cas("pendant l'essai, tout s'essaie : l'équipe sans plafond, les fiches de chantier ouvertes", () => {
  assert.equal(FORMULE_DE_LESSAI, "illimite");
  for (const f of ["absences", "retours", "fiche-chantier"] as const) {
    assert.equal(accesALaFonction(ESSAI, f, false), "ouverte", f);
  }
  assert.deepEqual(placePourUnAcces(FORMULE_DE_LESSAI, EQUIPE(100, 100), "commercial"), { ok: true });
});

// **Un plan d'arrosage et un diagnostic offerts, une seule fois par
// entreprise, essai compris** — ses réponses du 19 novembre 2026. Sans cela,
// un paysagiste ferait tous ses plans pendant les quinze jours.
cas("l'arrosage et le diagnostic : offerts une fois, essai compris, puis fermés", () => {
  for (const f of ["arrosage", "diagnostic"] as const) {
    assert.equal(accesALaFonction(ESSAI, f, false), "offerte", `${f} pendant l'essai`);
    assert.equal(accesALaFonction(ESSAI, f, true), "fermee", `${f} une fois offert`);
    const artisan = { formule: "artisan" as const, statut: "actif" as const, modules: [] };
    assert.equal(accesALaFonction(artisan, f, false), "offerte", `${f} sur Artisan`);
    assert.equal(accesALaFonction(artisan, f, true), "fermee");
    assert.equal(accesALaFonction({ ...artisan, modules: ["paysage"] }, f, true), "ouverte", `${f} avec les outils`);
  }
});

cas("les fiches de chantier n'ont pas d'offre : fermées sans les outils, hors essai", () => {
  const artisan = { formule: "artisan" as const, statut: "actif" as const, modules: [] };
  assert.equal(accesALaFonction(artisan, "fiche-chantier", false), "fermee");
  assert.equal(accesALaFonction({ ...artisan, formule: "illimite" }, "fiche-chantier", false), "fermee");
});

cas("sans abonnement, rien ne se compte : tout est ouvert, rien n'est « offert »", () => {
  for (const f of FONCTIONS) assert.equal(accesALaFonction(null, f, true), "ouverte", f);
});

cas("le plan offert se retouche pendant 24 heures, avec son jeton, et pas au-delà", () => {
  const utiliseeLe = new Date("2026-11-19T10:00:00Z");
  const offre = { jeton: "a1b2", utiliseeLe };
  const plus = (ms: number) => new Date(utiliseeLe.getTime() + ms);
  assert.equal(RETOUCHES_DU_PLAN_OFFERT_MS, 24 * 3600 * 1000);
  assert.equal(retoucheDuPlanOfferte(offre, "a1b2", plus(3600 * 1000)), true);
  assert.equal(retoucheDuPlanOfferte(offre, "a1b2", plus(RETOUCHES_DU_PLAN_OFFERT_MS)), false);
  assert.equal(retoucheDuPlanOfferte(offre, "autre", plus(60_000)), false);
  assert.equal(retoucheDuPlanOfferte(offre, null, plus(60_000)), false);
  assert.equal(retoucheDuPlanOfferte(null, "a1b2", plus(60_000)), false);
});

cas("la page Paysage dit « 1 offert » ou « En option », et rien quand l'outil est ouvert", () => {
  assert.equal(etiquetteDeLOutil("offerte"), "1 offert");
  assert.equal(etiquetteDeLOutil("fermee"), "En option");
  assert.equal(etiquetteDeLOutil("ouverte"), null);
});

cas("jour 1 : quinze jours restants, ruban calme", () => {
  const e = etatDeLEssai(ESSAI, apres(0, 1));
  assert.ok(e && e.statut === "en-cours");
  assert.equal(e.joursRestants, 15);
  assert.equal(e.alerte, false);
  assert.equal(texteDuRuban(e), "Essai gratuit, 15 jours restants");
});

cas("les jours se comptent ENTAMÉS : à 14 h le dernier jour, il reste « dernier jour », pas zéro", () => {
  const e = etatDeLEssai(ESSAI, apres(14, 5));
  assert.ok(e && e.statut === "en-cours");
  assert.equal(e.joursRestants, 1);
  assert.equal(texteDuRuban(e), "Essai gratuit, dernier jour");
});

cas("à trois jours de la fin, le ruban passe au rouge — pas avant", () => {
  assert.equal(JOURS_AVANT_ALERTE, 3);
  const calme = etatDeLEssai(ESSAI, apres(11, 1));
  const chaud = etatDeLEssai(ESSAI, apres(12, 1));
  assert.ok(calme && calme.statut === "en-cours" && calme.joursRestants === 4 && !calme.alerte);
  assert.ok(chaud && chaud.statut === "en-cours" && chaud.joursRestants === 3 && chaud.alerte);
});

cas("jour 16 : terminé, lecture seule — et pas une minute avant", () => {
  const avant = etatDeLEssai(ESSAI, new Date(FIN.getTime() - 1));
  const apresLaFin = etatDeLEssai(ESSAI, FIN);
  assert.ok(avant && avant.statut === "en-cours");
  assert.ok(apresLaFin && apresLaFin.statut === "termine");
  assert.equal(enLectureSeule(ESSAI, new Date(FIN.getTime() - 1)), false);
  assert.equal(enLectureSeule(ESSAI, FIN), true);
  assert.equal(texteDuRuban(apresLaFin), "Essai terminé, lecture seule");
});

cas("SON Atlas à lui n'est pas en essai : sans ligne d'abonnement, ni ruban ni lecture seule", () => {
  assert.equal(etatDeLEssai(null, apres(40)), null);
  assert.equal(enLectureSeule(null, apres(40)), false);
  assert.equal(enLectureSeule(undefined, apres(40)), false);
});

cas("un abonnement payé n'est jamais en lecture seule, même périmé — c'est « impayé » qui parle", () => {
  const actif = { ...ESSAI, statut: "actif" as const, formule: "artisan" as const, periodeFin: apres(-10) };
  assert.equal(etatDeLEssai(actif, apres(0)), null);
  assert.equal(enLectureSeule(actif, apres(0)), false);
  assert.equal(enLectureSeule({ ...actif, statut: "impaye" }, apres(0)), false);
});

cas("RÉSILIÉ : lecture seule, comme l'essai terminé — sinon Atlas devient gratuit (18 octobre 2026)", () => {
  const resilie = { statut: "resilie" as const, periodeFin: apres(-1) };
  assert.equal(enLectureSeule(resilie, apres(0)), true);
  const acces = etatDeLAcces(resilie, apres(0));
  assert.ok(acces && acces.statut === "resilie");
  assert.equal(texteDuRuban(acces), "Abonnement terminé, lecture seule");
  assert.equal(phraseLectureSeule(acces), "Votre abonnement est terminé. Choisissez une formule pour créer de nouveau.");
});

cas("résiliation DEMANDÉE mais période payée en cours : tout reste ouvert jusqu'à l'échéance", () => {
  // Stripe garde l'abonnement « actif » jusqu'à la date ; il ne passe à
  // « resilie » qu'à l'échéance. Il a payé l'année : il garde tout.
  const enCours = { statut: "actif" as const, periodeFin: apres(200) };
  assert.equal(enLectureSeule(enCours, apres(0)), false);
  assert.equal(etatDeLAcces(enCours, apres(0)), null);
});

cas("l'essai terminé garde sa phrase, et rien n'est dit quand tout est ouvert", () => {
  assert.equal(phraseLectureSeule(etatDeLAcces(ESSAI, FIN)), "Votre essai est terminé. Choisissez une formule pour créer de nouveau.");
  assert.equal(phraseLectureSeule(etatDeLAcces(ESSAI, new Date(FIN.getTime() - 1))), null);
  assert.equal(phraseLectureSeule(null), null);
});

cas("un essai sans date de fin ne referme rien — on ne devine pas une date", () => {
  assert.equal(enLectureSeule({ statut: "essai", periodeFin: null }, apres(40)), false);
});

cas("l'écran d'abonnement : pendant l'essai, aucune formule n'est « actuelle » — il s'abonne, il ne change pas", () => {
  assert.equal(formuleChoisie(ESSAI), null);
  assert.equal(formuleChoisie({ formule: "artisan", statut: "actif" }), "artisan");
  assert.equal(formuleChoisie({ formule: "artisan", statut: "resilie" }), null);
  assert.deepEqual(modulesChoisis({ ...ESSAI, modules: ["paysage"] }), []);
  assert.deepEqual(modulesChoisis({ formule: "artisan", statut: "actif", modules: ["paysage"] }), ["paysage"]);
  assert.deepEqual(modulesChoisis(null), []);
});

cas("l'écran dit l'essai : les jours, la date, aucune carte ; puis « terminé » en alerte", () => {
  const enCours = etatAffiche(ESSAI, apres(0, 1));
  assert.equal(enCours.titre, "Essai gratuit, 15 jours restants");
  assert.match(enCours.detail ?? "", /28 septembre 2026/);
  assert.match(enCours.detail ?? "", /Aucune carte/);
  assert.equal(enCours.ton, "calme");
  assert.deepEqual(enCours.signe, { genre: "jours", nombre: 15 });
  assert.equal(etatAffiche(ESSAI, apres(13)).ton, "attention");
  assert.deepEqual(etatAffiche(ESSAI, apres(13)).signe, { genre: "jours", nombre: 2 });
  const fini = etatAffiche(ESSAI, apres(20));
  assert.equal(fini.titre, "Essai terminé");
  assert.equal(fini.ton, "attention");
  assert.deepEqual(fini.signe, { genre: "ferme" });
});

console.log("\n=== Ce qui se ferme — « oui bloqué pour l'abonnement artisan », et les outils à part ===\n");

cas("Artisan n'ouvre ni les absences ni les retours ; Entreprise et Illimité les ouvrent", () => {
  for (const f of ["absences", "retours"] as const) {
    assert.equal(fonctionOuverte({ formule: "artisan", statut: "actif", modules: ["paysage"] }, f), false, `Artisan ouvre ${f}`);
    assert.equal(fonctionOuverte({ formule: "entreprise", statut: "actif", modules: [] }, f), true, `Entreprise ferme ${f}`);
    assert.equal(fonctionOuverte({ formule: "illimite", statut: "actif", modules: [] }, f), true, `Illimité ferme ${f}`);
  }
});

cas("SANS ABONNEMENT, tout est ouvert — une fermeture est la conséquence d'une formule choisie", () => {
  assert.equal(fonctionOuverte(null, "absences"), true);
  assert.equal(fonctionOuverte(undefined, "arrosage"), true);
  assert.equal(fonctionOuverte({ formule: "inconnue", statut: "actif", modules: [] }, "retours"), true);
});

cas("ce qui est barré est exactement ce que la formule n'ouvre pas", () => {
  const barre = (code: string) =>
    lignesDeLaFormule(formule(code)!).filter((l) => l.manque).map((l) => l.texte);
  assert.deepEqual(barre("artisan"), [
    "Vos salariés ont accès au planning",
    "Les absences de vos équipes",
    "Les retours d’intervention de vos salariés",
    "Jusqu’à 5 personnes aux devis et aux factures",
  ]);
  assert.deepEqual(barre("entreprise"), ["Autant de personnes que vous voulez aux devis et aux factures"]);
  assert.deepEqual(barre("illimite"), []);
});

cas("un plafond ne se barre qu'une fois : Artisan ne barre pas aussi « autant que vous voulez »", () => {
  const artisan = lignesDeLaFormule(formule("artisan")!).map((l) => l.texte);
  assert.ok(!artisan.some((t) => t.startsWith("Autant de personnes")));
  const illimite = lignesDeLaFormule(formule("illimite")!).map((l) => l.texte);
  assert.ok(!illimite.some((t) => t.startsWith("Jusqu’à 5")), "Illimité affiche « jusqu'à 5 » : ce serait lui reprocher d'avoir plus");
});

cas("l'écran fermé : les absences et les retours renvoient à Entreprise, les outils à leur ajout", () => {
  for (const f of ["absences", "retours"] as const) {
    const p = phraseDeLaFermeture(f);
    // L'espace est INSÉCABLE dans le titre : le « » ne doit jamais partir seul à la ligne.
    assert.match(p.titre, /« Entreprise »/);
    assert.equal(p.bouton, "Voir la formule Entreprise");
    assert.equal(p.adresse, "/reglages/abonnement");
  }
  assert.equal(phraseDeLaFermeture("arrosage").titre, "Votre plan offert est fait");
  assert.equal(phraseDeLaFermeture("diagnostic").titre, "Votre diagnostic offert est fait");
  assert.equal(phraseDeLaFermeture("fiche-chantier").titre, "Les fiches de chantier sont en option");
  for (const f of ["arrosage", "diagnostic", "fiche-chantier"] as const) {
    const p = phraseDeLaFermeture(f);
    assert.equal(p.bouton, "Ajouter les outils");
    assert.equal(p.adresse, "/reglages/abonnement?outils=paysage");
    assert.ok(p.detail.length > 20);
  }
  // Le prix de la phrase est celui du code, jamais écrit à côté.
  assert.match(phraseDeLaFermeture("arrosage").detail, new RegExp(`${MODULES[0].prixMensuel}\u00a0€ HT par mois`));
});

cas("l'abonnement en cours dit ses outils, et son prix les compte", () => {
  const e = etatAffiche(
    { formule: "entreprise", periodicite: "mensuelle", statut: "actif", periodeFin: new Date("2026-12-09T10:00:00Z"), annulationDemandee: false, modules: ["paysage"] },
    new Date("2026-11-19T10:00:00Z")
  );
  assert.equal(e.titre, "Entreprise, avec les outils de paysage");
  assert.match(e.detail ?? "", /65 € HT par mois/);
});

console.log(`\n${echecs === 0 ? "✅" : "❌"} ${echecs} échec(s)\n`);
process.exit(echecs === 0 ? 0 : 1);
