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
  surtitreReglages,
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

essai("le patron voit les deux ensembles, l'entreprise d'abord", () => {
  const titres = rubriquesReglages("proprietaire").map((e) => e.titre);
  assert.deepEqual(titres, ["L'entreprise", "Moi"]);
});

essai("les dix rubriques de sa planche du 14 août sont toutes là", () => {
  const noms = toutes("proprietaire").map((r) => r.nom);
  for (const attendue of [
    "Mon entreprise",
    "Équipe",
    "Tarifs & catalogue",
    "Devis & factures",
    "Planning",
    "Atlas IA",
    "Notifications",
    "Intégrations",
    "Abonnement",
    "Sécurité & données",
  ]) {
    assert.ok(noms.includes(attendue), `« ${attendue} » a disparu du sommaire`);
  }
});

essai("ses quatre priorités ouvrent l'ensemble de l'entreprise", () => {
  const entreprise = rubriquesReglages("proprietaire")[0].rubriques.map((r) => r.nom);
  assert.deepEqual(entreprise.slice(0, 5), [
    "Mon entreprise",
    "Équipe",
    "Tarifs & catalogue",
    "Devis & factures",
    "Planning",
  ]);
});

// LE CONTRÔLE QUI COMPTE. Il ne regarde pas si une rubrique est grisée : il
// vérifie qu'elle n'est PAS DANS LA LISTE. Ajouter « Tarifs & catalogue » à
// l'ensemble d'un membre le fait rougir, même si l'écran la cachait ensuite.
essai("un membre ne reçoit AUCUNE rubrique de l'entreprise", () => {
  const noms = toutes("membre").map((r) => r.nom);
  for (const interdite of [
    "Mon entreprise",
    "Équipe",
    "Tarifs & catalogue",
    "Devis & factures",
    "Planning",
    "Atlas IA",
    "Intégrations",
    "Abonnement",
    "Sécurité & données",
  ]) {
    assert.ok(!noms.includes(interdite), `« ${interdite} » est sortie du serveur pour un membre`);
  }
});

essai("et aucune adresse de l'entreprise ne lui est ouverte", () => {
  const siennes = adressesAutorisees("membre");
  assert.deepEqual(siennes, [], `un membre peut ouvrir : ${siennes.join(", ")}`);
});

// Un rôle inconnu — compte retiré de l'entreprise, session survivante — ne doit
// pas retomber sur les droits du patron par défaut. `getRole` rend `null` dans
// ce cas, et c'est un cas ordinaire, pas une anomalie.
essai("un rôle inconnu est traité comme un membre, jamais comme le patron", () => {
  assert.deepEqual(rubriquesReglages(null), rubriquesReglages("membre"));
});

essai("un membre reçoit ses quatre réglages personnels, et le même ensemble", () => {
  const ensembles = rubriquesReglages("membre");
  assert.equal(ensembles.length, 1);
  assert.equal(ensembles[0].titre, "Moi");
  assert.deepEqual(
    ensembles[0].rubriques.map((r) => r.nom),
    ["Mon compte", "Notifications", "Connexion", "Apparence"]
  );
});

// L'ensemble « Moi » doit être IDENTIQUE d'un rôle à l'autre : deux définitions
// divergentes finiraient par donner au salarié un réglage que le patron n'a
// pas, ou l'inverse — et personne ne s'en apercevrait avant lui.
essai("l'ensemble « Moi » est le même pour tous", () => {
  const duPatron = rubriquesReglages("proprietaire").find((e) => e.titre === "Moi");
  const duMembre = rubriquesReglages("membre").find((e) => e.titre === "Moi");
  assert.deepEqual(duPatron, duMembre);
});

essai("l'entreprise ne s'annonce pas à qui elle n'appartient pas", () => {
  assert.equal(surtitreReglages("proprietaire"), "Mon entreprise");
  assert.equal(surtitreReglages("membre"), "Mon compte");
  assert.equal(surtitreReglages(null), "Mon compte");
});

// Une rubrique sans explication oblige à l'ouvrir pour savoir si c'est la
// bonne : c'est un aller-retour par rubrique, sur un téléphone.
essai("chaque rubrique dit ce qu'on y trouve, et porte une icône", () => {
  for (const r of toutes("proprietaire")) {
    assert.ok(r.dit.trim().length > 4, `« ${r.nom} » n'explique rien`);
    assert.ok(r.icone.trim().length > 0, `« ${r.nom} » n'a pas d'icône`);
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
