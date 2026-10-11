import assert from "node:assert";
import { saisieAEnregistrer, type SaisieFicheClient } from "../src/lib/saisie-fiche-client";

/**
 * La flèche de la fiche client enregistre-t-elle avant de sortir ?
 * Sa remarque du 22 septembre 2026 — voir `src/lib/saisie-fiche-client.ts`.
 *
 * Le parcours entier est tenu par `test-fiche-client-gardee-au-retour-e2e.ts` ;
 * celle-ci fixe la règle, sans navigateur : c'est l'ÉCART avec l'ouverture qui
 * compte, jamais un champ rempli.
 */
const vide: SaisieFicheClient = {
  nomClient: "",
  civilite: null,
  telephone: "",
  email: "",
  canal: null,
  adresseChantier: "",
  adresseClient: "",
  photosCochees: 0,
};

// Une feuille ouverte puis refermée : rien à enregistrer, donc aucun chantier vide.
assert.equal(saisieAEnregistrer(vide, vide), false, "une feuille intacte ne doit rien créer");

// Le cas de sa remarque : il tape le nom, il fait retour.
assert.equal(saisieAEnregistrer(vide, { ...vide, nomClient: "Martinez" }), true, "un nom tapé doit être gardé");
assert.equal(saisieAEnregistrer(vide, { ...vide, telephone: "06 12 34 56 78" }), true, "un numéro tapé doit être gardé");
assert.equal(saisieAEnregistrer(vide, { ...vide, adresseChantier: "3 rue des Lilas" }), true, "une adresse tapée doit être gardée");
assert.equal(saisieAEnregistrer(vide, { ...vide, civilite: "mme" }), true, "une civilité choisie doit être gardée");
assert.equal(saisieAEnregistrer(vide, { ...vide, photosCochees: 1 }), true, "une photo cochée doit être gardée");

// Venu de la fiche d'un client : tout est déjà posé, ressortir ne crée rien.
const depuisSaFiche: SaisieFicheClient = {
  ...vide,
  nomClient: "Martins",
  telephone: "0612345678",
  canal: "sms",
  adresseClient: "3 rue des Lilas",
};
assert.equal(saisieAEnregistrer(depuisSaFiche, depuisSaFiche), false, "une fiche préremplie intacte ne doit rien créer");
assert.equal(
  saisieAEnregistrer(depuisSaFiche, { ...depuisSaFiche, email: "m@exemple.fr" }),
  true,
  "ce qu'il ajoute sur une fiche préremplie doit être gardé"
);

// Un blanc n'est pas une saisie : l'enregistrement le retire de toute façon.
assert.equal(saisieAEnregistrer(vide, { ...vide, nomClient: "  " }), false, "des espaces seuls ne sont pas une saisie");

console.log("✅ La fiche client n'enregistre en sortant que ce qui a changé depuis son ouverture.");
