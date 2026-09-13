import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import {
  FORMULES,
  FORMULE_DE_LESSAI,
  JOURS_AVANT_ALERTE,
  JOURS_ESSAI,
  centimes,
  enLectureSeule,
  etatAffiche,
  etatDeLEssai,
  finDeLEssai,
  fonctionOuverte,
  formule,
  formuleChoisie,
  jourEnLettres,
  montantDu,
  phraseDeLaFermeture,
  placePourUnFabricant,
  roleFabrique,
  texteDuRuban,
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

const PLANCHE = path.join(__dirname, "..", "appli", "choisir-son-abonnement.html");

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
    // La planche écrit : { nom: "Artisan", prix: 29, an: 290, …
    const motif = new RegExp(`nom:\\s*"${f.nom}",\\s*prix:\\s*(\\d+),\\s*an:\\s*(\\d+)`);
    const trouve = texte.match(motif);
    assert.ok(trouve, `la formule « ${f.nom} » n'est pas dans la planche`);
    assert.equal(Number(trouve[1]), f.prixMensuel, `prix mensuel de ${f.nom}`);
    assert.equal(Number(trouve[2]), f.prixAnnuel, `prix annuel de ${f.nom}`);
  }
});

cas("l'année vaut dix mois — deux mois offerts, comme l'annonce la bascule", () => {
  for (const f of FORMULES) {
    assert.equal(f.prixAnnuel, f.prixMensuel * 10, `${f.nom} : l'annuel n'offre pas deux mois`);
  }
});

console.log("\n=== Ce qui part chez le prestataire ===\n");

cas("le montant s'envoie en centimes, exactement", () => {
  const artisan = formule("artisan");
  assert.ok(artisan);
  assert.equal(centimes(artisan, "mensuelle"), 2900);
  assert.equal(centimes(artisan, "annuelle"), 29000);
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

cas("Artisan : une seule personne aux devis et aux factures", () => {
  assert.equal(placePourUnFabricant("artisan", 0).ok, true);
  assert.equal(placePourUnFabricant("artisan", 1).ok, false);
});

cas("Entreprise : cinq, et la sixième est refusée", () => {
  assert.equal(placePourUnFabricant("entreprise", 4).ok, true);
  const refus = placePourUnFabricant("entreprise", 5);
  assert.equal(refus.ok, false);
  if (!refus.ok) {
    assert.equal(refus.refus.plafond, 5);
    assert.equal(refus.refus.nom, "Entreprise");
  }
});

cas("Illimité : aucun plafond, même à cent", () => {
  assert.equal(placePourUnFabricant("illimite", 100).ok, true);
});

cas("SANS ABONNEMENT, aucun plafond — rien ne se ferme aujourd'hui", () => {
  // C'est la règle qui empêche ce lot de couper l'application des artisans qui
  // s'en servent déjà, avant que la moindre offre existe.
  assert.equal(placePourUnFabricant(null, 50).ok, true);
  assert.equal(placePourUnFabricant(undefined, 50).ok, true);
});

cas("une formule inconnue en base n'invente pas de plafond", () => {
  assert.equal(placePourUnFabricant("premium", 999).ok, true);
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
};
const apres = (jours: number, heures = 0) => new Date(DEBUT.getTime() + (jours * 24 + heures) * 3600 * 1000);

cas("« essai gratuit 15 jours » — la durée est la sienne, et la fin tombe quinze jours pleins plus tard", () => {
  assert.equal(JOURS_ESSAI, 15);
  assert.equal((FIN.getTime() - DEBUT.getTime()) / 86_400_000, 15);
});

cas("pendant l'essai, on essaie TOUT : la formule est « Illimité », rien n'est fermé ni plafonné", () => {
  assert.equal(FORMULE_DE_LESSAI, "illimite");
  assert.ok(fonctionOuverte(FORMULE_DE_LESSAI, "absences"));
  assert.ok(fonctionOuverte(FORMULE_DE_LESSAI, "retours"));
  assert.deepEqual(placePourUnFabricant(FORMULE_DE_LESSAI, 100), { ok: true });
});

cas("jour 1 : quinze jours restants, ruban calme", () => {
  const e = etatDeLEssai(ESSAI, apres(0, 1));
  assert.ok(e && e.statut === "en-cours");
  assert.equal(e.joursRestants, 15);
  assert.equal(e.alerte, false);
  assert.equal(texteDuRuban(e), "Essai gratuit — 15 jours restants");
});

cas("les jours se comptent ENTAMÉS : à 14 h le dernier jour, il reste « dernier jour », pas zéro", () => {
  const e = etatDeLEssai(ESSAI, apres(14, 5));
  assert.ok(e && e.statut === "en-cours");
  assert.equal(e.joursRestants, 1);
  assert.equal(texteDuRuban(e), "Essai gratuit — dernier jour");
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
  assert.equal(texteDuRuban(apresLaFin), "Essai terminé — lecture seule");
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

cas("un essai sans date de fin ne referme rien — on ne devine pas une date", () => {
  assert.equal(enLectureSeule({ statut: "essai", periodeFin: null }, apres(40)), false);
});

cas("l'écran d'abonnement : pendant l'essai, aucune formule n'est « actuelle » — il s'abonne, il ne change pas", () => {
  assert.equal(formuleChoisie(ESSAI), null);
  assert.equal(formuleChoisie({ formule: "artisan", statut: "actif" }), "artisan");
  assert.equal(formuleChoisie({ formule: "artisan", statut: "resilie" }), null);
});

cas("l'écran dit l'essai : les jours, la date, aucune carte ; puis « terminé » en alerte", () => {
  const enCours = etatAffiche(ESSAI, apres(0, 1));
  assert.equal(enCours.titre, "Essai gratuit · 15 jours restants");
  assert.match(enCours.detail ?? "", /28 septembre 2026/);
  assert.match(enCours.detail ?? "", /Aucune carte/);
  assert.equal(enCours.ton, "calme");
  assert.equal(etatAffiche(ESSAI, apres(13)).ton, "attention");
  const fini = etatAffiche(ESSAI, apres(20));
  assert.equal(fini.titre, "Essai terminé");
  assert.equal(fini.ton, "attention");
});

console.log("\n=== Ce qui se ferme à « Artisan » — « oui bloqué pour l'abonnement artisan » ===\n");

cas("Artisan n'ouvre ni les absences ni les retours ; Entreprise et Illimité ouvrent les deux", () => {
  for (const f of ["absences", "retours"] as const) {
    assert.equal(fonctionOuverte("artisan", f), false, `Artisan ouvre ${f}`);
    assert.equal(fonctionOuverte("entreprise", f), true, `Entreprise ferme ${f}`);
    assert.equal(fonctionOuverte("illimite", f), true, `Illimité ferme ${f}`);
  }
});

cas("SANS ABONNEMENT, tout est ouvert — une fermeture est la conséquence d'une formule choisie", () => {
  assert.equal(fonctionOuverte(null, "absences"), true);
  assert.equal(fonctionOuverte(undefined, "retours"), true);
  assert.equal(fonctionOuverte("inconnue", "retours"), true);
});

cas("ce que la carte de la formule PROMET est ce que le code OUVRE — les deux listes ne divergent pas", () => {
  for (const f of FORMULES) {
    const promet = (mot: string) => f.compris.some((l) => l.texte.toLowerCase().includes(mot));
    assert.equal(f.fonctions.includes("absences"), promet("absences"), `${f.nom} : les absences`);
    assert.equal(f.fonctions.includes("retours"), promet("retours"), `${f.nom} : les retours`);
  }
});

cas("la phrase de la fermeture nomme la formule qui ouvre, pour les deux fonctions", () => {
  for (const f of ["absences", "retours"] as const) {
    const { titre, detail } = phraseDeLaFermeture(f);
    assert.match(titre, /« Entreprise »/);
    assert.ok(detail.length > 20);
  }
});

console.log(`\n${echecs === 0 ? "✅" : "❌"} ${echecs} échec(s)\n`);
process.exit(echecs === 0 ? 0 : 1);
