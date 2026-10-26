// Le sommaire des réglages : ce qu'il contient, et surtout CE QU'IL NE SORT PAS.
//
// **La règle vient du patron, le 13 août 2026 :** *« un salarié peut changer ses
// notifications ou son mot de passe, mais il ne doit évidemment pas pouvoir
// modifier les tarifs ou les coordonnées bancaires. »* Et `docs/QUESTIONS.md`
// §10 va plus loin : ce qu'un rôle n'a pas le droit de voir ne doit pas SORTIR
// DU SERVEUR — masquer à l'écran ne protège rien.
//
// **Cette suite éprouve la LISTE, pas l'écran.** C'est délibéré : la liste est
// l'unique source (`src/lib/rubriques-reglages.ts`), le sommaire la dessine et
// les pages s'y adossent. Éprouver l'écran laisserait passer une rubrique
// rendue puis cachée par une feuille de style — exactement ce qui est interdit.

import assert from "node:assert/strict";
import {
  rubriquesReglages,
  adressesAutorisees,
} from "../src/lib/rubriques-reglages";

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

const toutes = (role: Parameters<typeof rubriquesReglages>[0]) =>
  rubriquesReglages(role).flatMap((e) => e.rubriques);

// **En paquets depuis sa planche du 25 octobre 2026** : la carte de
// l'entreprise (sans titre), trois paquets de l'entreprise, puis « Moi ».
essai("le patron voit la carte, les trois paquets de l'entreprise, puis Moi", () => {
  const titres = rubriquesReglages("proprietaire").map((e) => e.titre);
  assert.deepEqual(titres, ["", "L'entreprise", "Pour les devis", "L'application", "Moi"]);
  assert.equal(rubriquesReglages("proprietaire")[0].carte, true);
});

/**
 * **PAR ADRESSE ET NON PAR LIBELLÉ — corrigé le 5 septembre 2026.**
 *
 * Ce contrôle listait les neuf NOMS de sa planche. Il a rougi le jour où quatre
 * d'entre eux ont été renommés à sa demande, sur du code juste — et pour un
 * retrait qu'il avait exigé. C'est la faute nommée au `CLAUDE.md` §5 bis : ce
 * qu'une suite doit fixer, c'est la règle, pas la façon dont un écran l'écrit.
 *
 * **Et l'adresse est le meilleur contrôle des deux**, pas seulement le plus
 * robuste : ce qui compte est qu'aucune PORTE ne se ferme par accident. Un
 * libellé qui change se voit à la capture ; une rubrique qui disparaît du
 * sommaire, non — elle laisse un écran vivant que plus rien n'ouvre.
 */
essai("les rubriques de sa planche du 14 août ouvrent toujours leur écran", () => {
  const adresses = toutes("proprietaire").map((r) => r.href);
  for (const attendue of [
    "/reglages/identite",
    "/reglages/equipe",
    "/reglages/tarifs",
    "/reglages/documents",
    "/reglages/ia",
    "/reglages/notifications",
    "/reglages/agenda",
    "/reglages/abonnement",
    "/reglages/donnees",
  ]) {
    assert.ok(adresses.includes(attendue), `plus aucune rubrique ne mène à ${attendue}`);
  }
});

essai("ses priorités ouvrent l'entreprise, dans l'ordre de sa planche du 25 octobre", () => {
  const entreprise = rubriquesReglages("proprietaire")
    .filter((e) => e.cote === "entreprise")
    .flatMap((e) => e.rubriques)
    .map((r) => r.href);
  // **Ses QUATRE priorités, et elles n'ont pas bougé.** Le contrôle porte sur
  // les quatre premières — celles qu'il a nommées — et sur ce qui vient juste
  // après, pour qu'une rubrique nouvelle ne s'insère pas au milieu d'elles.
  //
  // La cinquième ligne a changé deux fois : « Planning », supprimée le 16 août
  // faute d'avoir quoi que ce soit à elle ; puis « Fiche d'entretien », partie
  // dans Paysage le 26 août à sa demande.
  //
  // **Par adresse depuis le 5 septembre 2026**, pour la raison écrite plus haut :
  // c'est l'ORDRE qu'il a fixé qu'on défend, pas l'orthographe des libellés.
  //
  // **Sa planche du 25 octobre 2026 les a rangées en paquets** : l'entreprise
  // et l'équipe restent en tête ; les véhicules et l'organigramme rejoignent
  // l'équipe, les fournisseurs rejoignent les tarifs. C'est cet ordre-là, le
  // sien, que le contrôle défend désormais, en entier.
  assert.deepEqual(entreprise, [
    "/reglages/identite",
    "/reglages/equipe",
    "/reglages/vehicules",
    "/reglages/organigramme",
    "/reglages/tarifs",
    "/reglages/documents",
    "/reglages/fournisseurs",
    "/reglages/ia",
    "/reglages/agenda",
    "/reglages/abonnement",
    "/reglages/donnees",
  ]);
});

// **ELLE NE DOIT PAS REVENIR**, et c'est le seul contrôle qui le tienne.
//
// Sa demande du 26 août 2026 : *« comme ça on ne la voit plus dans la catégorie
// Réglages »*. Le motif d'origine — sa propre demande du 16 août, « dans les
// réglages, un endroit où l'utilisateur pourra créer cette fiche » — reste vrai
// dans l'historique : une session qui le relirait sans connaître la suite
// remettrait la rubrique de bonne foi. C'est exactement la faute du trait gris
// (`ARCHITECTURE.md` §172), et elle se prévient ici.
essai("« Fiche d'entretien » a quitté les Réglages, et n'y revient pas", () => {
  for (const role of ["proprietaire", "salarie"] as const) {
    const noms = toutes(role).map((r) => r.nom);
    assert.ok(
      !noms.some((n) => /fiche d.entretien/i.test(n)),
      `« Fiche d'entretien » est revenue dans les réglages (${role}) : elle vit dans Paysage depuis le 26 août 2026`
    );
  }
});

// LE CONTRÔLE QUI COMPTE. Il ne regarde pas si une rubrique est grisée : il
// vérifie qu'elle n'est PAS DANS LA LISTE. Ajouter « Tarifs & catalogue » à
// l'ensemble d'un membre le fait rougir, même si l'écran la cachait ensuite.
//
// **PAR ADRESSE depuis le 5 septembre 2026, et ici cela protège pour de bon.**
// Écrit sur les libellés, ce contrôle se serait DÉSARMÉ TOUT SEUL au premier
// renommage : « Intégrations » devenue « Mon agenda » ne figurait plus dans la
// liste des interdits, et la rubrique aurait pu sortir chez un salarié sans
// que rien ne rougisse. Une adresse, elle, ne se renomme pas pour faire joli.
essai("un membre ne reçoit AUCUNE rubrique de l'entreprise", () => {
  const adresses = toutes("salarie").map((r) => r.href);
  for (const interdite of [
    "/reglages/identite",
    "/reglages/equipe",
    "/reglages/tarifs",
    "/reglages/documents",
    "/reglages/ia",
    "/reglages/agenda",
    "/reglages/abonnement",
    "/reglages/donnees",
  ]) {
    assert.ok(!adresses.includes(interdite), `${interdite} est sortie du serveur pour un membre`);
  }
});

// **Ce contrôle attendait une liste VIDE, et il avait raison jusqu'au 14 août
// 2026** — tout l'ensemble « Moi » était encore marqué « Bientôt ». Depuis que
// « Mon compte » et « Connexion » sont codés, un membre a bel et bien deux
// adresses ouvertes, et c'est exactement ce que le patron a demandé le 13 août :
// *« un salarié peut changer ses notifications ou son mot de passe »*.
//
// **Ce qu'il ne faut donc PAS faire : remplacer le vide par « n'importe quoi ».**
// Une liste comparée à elle-même ne dirait plus rien. Ce qui compte est que les
// adresses ouvertes à un membre soient EXACTEMENT celles de l'ensemble « Moi »,
// et aucune de celles de l'entreprise.
essai("un membre n'ouvre QUE ses réglages personnels", () => {
  const siennes = adressesAutorisees("salarie");
  const personnelles = rubriquesReglages("salarie")
    .flatMap((e) => e.rubriques)
    .map((r) => r.href)
    .filter((h): h is string => h !== null);
  assert.deepEqual(siennes, personnelles);
  // Sa règle du 13 août : le mot de passe fait partie de ce qu'un salarié garde.
  assert.ok(siennes.includes("/reglages/connexion"), "un salarié ne peut plus changer son mot de passe");
});

essai("et AUCUNE adresse de l'entreprise ne lui est ouverte", () => {
  const siennes = adressesAutorisees("salarie");
  // **L'ensemble se désigne PAR SON CÔTÉ, jamais par soustraction.** Écrit
  // « les adresses du patron moins celles du membre », le contrôle ne voyait
  // plus rien dès qu'une rubrique d'entreprise était DÉPLACÉE dans « Moi » :
  // elle sortait des deux côtés à la fois. Éprouvé en la déplaçant pour de bon,
  // le 14 août 2026 — le contrôle est resté vert sur une vraie fuite. Et par
  // le côté plutôt que par le titre depuis le 25 octobre 2026 : l'entreprise
  // tient en quatre paquets, et le seul titre « L'entreprise » en laissait
  // trois hors de vue.
  const delEntreprise = rubriquesReglages("proprietaire")
    .filter((e) => e.cote === "entreprise")
    .flatMap((e) => e.rubriques)
    .map((r) => r.href)
    .filter((h): h is string => h !== null);
  // Et l'on vérifie que cet ensemble existe : le jour où le titre changerait,
  // le contrôle passerait au vert en n'ayant rien regardé du tout.
  assert.ok(delEntreprise.length >= 10, `l'entreprise n'ouvre que ${delEntreprise.length} adresse(s)`);
  // **Une seule exception, et elle est la sienne** (27 septembre 2026) :
  // *« L'organigramme doit être visible par tout le monde ! »*. Toute autre
  // adresse de l'entreprise ouverte au membre est une fuite.
  // **Et les véhicules, 14 octobre 2026** : le salarié y lit l'assurance de
  // son camion pour le constat ; il n'y écrit rien.
  const fuites = delEntreprise.filter(
    (a) => siennes.includes(a) && a !== "/reglages/organigramme" && a !== "/reglages/vehicules"
  );
  assert.deepEqual(fuites, [], `un membre peut ouvrir : ${fuites.join(", ")}`);
});

// Un rôle inconnu — compte retiré de l'entreprise, session survivante — ne doit
// pas retomber sur les droits du patron par défaut. `getRole` rend `null` dans
// ce cas, et c'est un cas ordinaire, pas une anomalie.
// **Depuis le 27 septembre 2026, le membre lit aussi l'organigramme** ; un rôle
// inconnu, lui, n'en reçoit rien : la garde lui refuserait l'écran.
essai("un rôle inconnu est traité comme un membre, jamais comme le patron", () => {
  const moiDuMembre = rubriquesReglages("salarie").find((e) => e.titre === "Moi");
  assert.deepEqual(rubriquesReglages(null), [moiDuMembre]);
});

essai("un membre reçoit ses cinq réglages personnels, et le même ensemble", () => {
  const ensembles = rubriquesReglages("salarie");
  assert.deepEqual(ensembles.map((e) => e.titre), ["L'entreprise", "Moi"]);
  assert.deepEqual(ensembles[0].rubriques.map((r) => r.href), ["/reglages/vehicules", "/reglages/organigramme"]);
  assert.deepEqual(
    ensembles[1].rubriques.map((r) => r.href),
    [
      "/reglages/compte",
      "/reglages/notifications",
      "/reglages/connexion",
      // La double vérification, 7 octobre 2026 : elle appartient à la personne.
      "/reglages/connexion/double-verification",
      "/reglages/apparence",
    ]
  );
});

// L'ensemble « Moi » doit être IDENTIQUE d'un rôle à l'autre : deux définitions
// divergentes finiraient par donner au salarié un réglage que le patron n'a
// pas, ou l'inverse — et personne ne s'en apercevrait avant lui.
essai("l'ensemble « Moi » est le même pour tous", () => {
  const duPatron = rubriquesReglages("proprietaire").find((e) => e.titre === "Moi");
  const duMembre = rubriquesReglages("salarie").find((e) => e.titre === "Moi");
  assert.deepEqual(duPatron, duMembre);
});

// **La carte de l'entreprise ne s'ouvre qu'au patron.** Elle remplace, le
// 25 octobre 2026, le surtitre « Mon entreprise » / « Mon compte » : c'est
// désormais elle qui annonce l'entreprise, et à lui seul.
essai("l'entreprise ne s'annonce pas à qui elle n'appartient pas", () => {
  assert.ok(rubriquesReglages("proprietaire").some((e) => e.carte));
  for (const role of ["salarie", "commercial", "facturation", null] as const) {
    assert.ok(!rubriquesReglages(role).some((e) => e.carte), `la carte de l'entreprise sort pour ${role}`);
  }
});

essai("aucun paquet vide ne sort", () => {
  for (const role of ["proprietaire", "salarie", "commercial", "facturation", null] as const) {
    for (const e of rubriquesReglages(role)) {
      assert.ok(e.rubriques.length > 0, `« ${e.titre} » sort vide pour ${role}`);
    }
  }
});

essai("chaque rubrique porte une icône", () => {
  for (const r of toutes("proprietaire")) {
    assert.ok(r.icone.trim().length > 0, `« ${r.nom} » n'a pas d'icône`);
  }
});

/**
 * **CE CONTRÔLE EXIGEAIT L'INVERSE, ET IL A ÉTÉ RETOURNÉ LE 5 SEPTEMBRE 2026.**
 *
 * Il s'appelait « chaque rubrique dit ce qu'on y trouve » et vérifiait que la
 * ligne d'explication faisait plus de quatre lettres. C'était la règle d'avant.
 * Le patron a fait retirer les douze — et **une suite qui réclame ce qu'il a
 * fait enlever rend son écran impossible à changer** (`CLAUDE.md` §5 bis).
 *
 * **Ce qui le remplace défend la règle NEUVE : un titre se suffit.** On ne sait
 * pas mesurer « ça se comprend ». On sait en revanche refuser les quatre mots
 * dont on vient de payer le retrait — et c'est le vrai risque, parce qu'ils
 * reviendraient de bonne foi : chacun avait sa raison le jour où il a été
 * écrit, et « Intégrations » a tenu trois semaines en promettant une
 * comptabilité qui n'existe pas.
 */
essai("aucune rubrique ne reprend un mot retiré le 5 septembre 2026", () => {
  const retires = ["Intégrations", "Sécurité & données", "Connexion", "Apparence"];
  const noms = toutes("proprietaire").map((r) => r.nom);
  for (const mot of retires) {
    assert.ok(
      !noms.includes(mot),
      `« ${mot} » est revenu dans le sommaire : il en a été retiré le 5 septembre 2026, ` +
        `et son remplaçant est dans src/lib/rubriques-reglages.ts`
    );
  }
});

// DEUX RUBRIQUES QUI PARTAGENT UNE ICÔNE, c'est une liste qu'on ne parcourt
// plus : le pictogramme est précisément ce qui permet de retrouver « Tarifs »
// sans lire. Le défaut passerait tous les autres contrôles.
essai("aucune icône n'est le doublon d'une autre", () => {
  const icones = toutes("proprietaire").map((r) => r.icone);
  assert.equal(new Set(icones).size, icones.length, `icônes : ${icones.join(", ")}`);
});

// Une adresse écrite deux fois enverrait deux rubriques au même écran — et le
// patron croirait avoir ouvert l'autre.
essai("deux rubriques ne mènent jamais au même écran", () => {
  const adresses = adressesAutorisees("proprietaire");
  assert.equal(new Set(adresses).size, adresses.length, adresses.join(", "));
});

essai("toutes les adresses restent dans les réglages ou le catalogue", () => {
  for (const a of adressesAutorisees("proprietaire")) {
    assert.match(a, /^\/(reglages|catalogue)\b/, `« ${a} » sort des réglages`);
  }
});

console.log(`\n${echecs === 0 ? "✅" : "❌"} Rubriques des réglages — ${echecs} échec(s).`);
process.exit(echecs === 0 ? 0 : 1);
