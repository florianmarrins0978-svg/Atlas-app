// Reconnaître un client déjà connu — la règle, sans base.
//
// **Ce que cette suite protège.** Rapprocher à tort verse le chiffre d'affaires
// d'un homme sur la fiche d'un autre, et lui montre une dette qui n'est pas la
// sienne. Chaque cas ci-dessous est un mauvais rapprochement qu'on refuse, ou
// un bon qu'on exige — jamais un détail de forme.

import assert from "node:assert/strict";
import {
  nomRapproche,
  telephoneRapproche,
  rapprocherClient,
  complementsPourFiche,
  clientAPreremplir,
  type ClientExistant,
} from "../src/lib/rapprochement-client";

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

/** Un client en base, avec des valeurs par défaut qui ne gênent pas le cas. */
function client(p: Partial<ClientExistant> & { id: string; nom: string }): ClientExistant {
  return {
    telephone: null,
    email: null,
    adresse: null,
    creeLe: "2026-01-01T00:00:00.000Z",
    ...p,
  };
}

console.log("=== Reconnaître un client déjà connu ===\n");

essai("le nom se compare sans casse, sans accents, sans ponctuation", () => {
  assert.equal(nomRapproche("Rivière"), nomRapproche("RIVIERE"));
  assert.equal(nomRapproche("  Martins  "), "martins");
  assert.equal(nomRapproche("Le Goff-Martin"), "le goff martin");
});

essai("la civilité ne fait pas deux personnes", () => {
  assert.equal(nomRapproche("M. Martins"), nomRapproche("Martins"));
  assert.equal(nomRapproche("Mme Roux"), nomRapproche("roux"));
  assert.equal(nomRapproche("Monsieur Martins"), nomRapproche("Mr Martins"));
});

essai("un prénom qui commence comme une civilité n'est pas amputé", () => {
  // « Merlin » commence par « m », « Mathieu » aussi : les couper donnerait
  // deux clients vides qui se rapprocheraient entre eux.
  assert.equal(nomRapproche("Merlin"), "merlin");
  assert.equal(nomRapproche("Mathieu Dubois"), "mathieu dubois");
});

essai("un nom réduit à sa seule civilité n'est pas vidé", () => {
  // « M. » seul : l'amputer rendrait "" et rapprocherait tous les clients
  // sans nom entre eux.
  assert.equal(nomRapproche("M."), "m");
});

essai("le téléphone se compare sur ses chiffres, indicatif compris", () => {
  assert.equal(telephoneRapproche("06 12 34 56 78"), "0612345678");
  assert.equal(telephoneRapproche("06.12.34.56.78"), "0612345678");
  assert.equal(telephoneRapproche("+33 6 12 34 56 78"), "0612345678");
  assert.equal(telephoneRapproche(null), "");
});

essai("personne de ce nom : on crée", () => {
  const v = rapprocherClient({ nom: "Martins" }, [client({ id: "a", nom: "Bernard" })]);
  assert.deepEqual(v, { type: "creer", motif: "inconnu" });
});

essai("LE CAS DU PATRON : même nom, rien d'autre → on réutilise", () => {
  const v = rapprocherClient({ nom: "Martins" }, [client({ id: "a", nom: "M. Martins" })]);
  assert.deepEqual(v, { type: "reutiliser", id: "a", motif: "nom" });
});

essai("un téléphone qui concorde tranche, même parmi des homonymes", () => {
  const v = rapprocherClient({ nom: "Martins", telephone: "0612345678" }, [
    client({ id: "a", nom: "Martins", telephone: "0699887766" }),
    client({ id: "b", nom: "Martins", telephone: "06 12 34 56 78" }),
  ]);
  assert.deepEqual(v, { type: "reutiliser", id: "b", motif: "coordonnee" });
});

essai("un e-mail qui concorde tranche aussi", () => {
  const v = rapprocherClient({ nom: "Martins", email: "  M.Martins@Ex.Test " }, [
    client({ id: "a", nom: "Martins", email: "autre@ex.test" }),
    client({ id: "b", nom: "Martins", email: "m.martins@ex.test" }),
  ]);
  assert.deepEqual(v, { type: "reutiliser", id: "b", motif: "coordonnee" });
});

essai("DEUX MARTINS QUI NE SE CONNAISSENT PAS RESTENT SÉPARÉS", () => {
  // Le seul défaut grave possible ici : le père et le fils sur la même fiche.
  const v = rapprocherClient({ nom: "Martins", telephone: "0612345678" }, [
    client({ id: "a", nom: "Martins", telephone: "0699887766" }),
  ]);
  assert.deepEqual(v, { type: "creer", motif: "contradiction" });
});

essai("un e-mail différent sépare tout autant", () => {
  const v = rapprocherClient({ nom: "Martins", email: "fils@ex.test" }, [
    client({ id: "a", nom: "Martins", email: "pere@ex.test" }),
  ]);
  assert.deepEqual(v, { type: "creer", motif: "contradiction" });
});

essai("l'homonyme qui contredit est écarté SEUL, pas en bloc", () => {
  // Deux Martins en base, un seul contredit : le bon reste disponible. Écarter
  // en bloc aurait fabriqué un troisième Martins.
  const v = rapprocherClient({ nom: "Martins", telephone: "0612345678" }, [
    client({ id: "a", nom: "Martins", telephone: "0699887766" }),
    client({ id: "b", nom: "Martins" }),
  ]);
  assert.deepEqual(v, { type: "reutiliser", id: "b", motif: "nom" });
});

essai("une fiche sans téléphone ne contredit rien", () => {
  // Il a créé « Martins » à la volée, sans numéro ; il en donne un aujourd'hui.
  // C'est le même homme, et la fiche va se compléter.
  const v = rapprocherClient({ nom: "Martins", telephone: "0612345678" }, [
    client({ id: "a", nom: "Martins" }),
  ]);
  assert.deepEqual(v, { type: "reutiliser", id: "a", motif: "nom" });
});

essai("une saisie sans coordonnée ne contredit rien non plus", () => {
  const v = rapprocherClient({ nom: "Martins" }, [
    client({ id: "a", nom: "Martins", telephone: "0699887766" }),
  ]);
  assert.deepEqual(v, { type: "reutiliser", id: "a", motif: "nom" });
});

essai("deux homonymes indiscernables : le plus récent", () => {
  const v = rapprocherClient({ nom: "Martins" }, [
    client({ id: "vieux", nom: "Martins", creeLe: "2026-01-01T00:00:00.000Z" }),
    client({ id: "recent", nom: "Martins", creeLe: "2026-08-01T00:00:00.000Z" }),
  ]);
  assert.deepEqual(v, { type: "reutiliser", id: "recent", motif: "nom" });
});

essai("un nom vide ne rapproche personne", () => {
  const v = rapprocherClient({ nom: "   " }, [client({ id: "a", nom: "Martins" })]);
  assert.deepEqual(v, { type: "creer", motif: "inconnu" });
});

essai("les cases vides se complètent", () => {
  const c = complementsPourFiche(client({ id: "a", nom: "Martins" }), {
    nom: "Martins",
    telephone: "0612345678",
    adresse: "3 rue des Lilas",
  });
  assert.deepEqual(c, { telephone: "0612345678", adresse: "3 rue des Lilas" });
});

essai("UNE COORDONNÉE DÉJÀ CONNUE N'EST JAMAIS ÉCRASÉE", () => {
  // Il tape un portable là où il avait noté le fixe. Garder les deux est
  // impossible ; perdre le sien sans le lui dire est inacceptable.
  const c = complementsPourFiche(
    client({ id: "a", nom: "Martins", telephone: "0556000012", adresse: "3 rue des Lilas" }),
    { nom: "Martins", telephone: "0612345678", adresse: "Chemin du Bois" }
  );
  assert.deepEqual(c, {});
});

essai("une case blanche compte comme vide, pas comme remplie", () => {
  const c = complementsPourFiche(client({ id: "a", nom: "Martins", telephone: "   " }), {
    nom: "Martins",
    telephone: "0612345678",
  });
  assert.deepEqual(c, { telephone: "0612345678" });
});

// ═══════════════════════════════════════════════════════════════════════════
// CE QU'ATLAS OSE POSER SUR LA FICHE — proposition C, 9 septembre 2026.
//
// Chaque cas ci-dessous est un numéro qu'on refuse d'écrire sur la fiche d'un
// homme qui n'est pas le sien, ou un que le patron a le droit de ne pas
// retaper. Il n'y a pas de cas de forme ici.

essai("un seul homonyme, et le nom seul suffit : on reprend sa fiche", () => {
  const lui = client({ id: "a", nom: "Martins", telephone: "0612345678" });
  const trouve = clientAPreremplir({ nom: "Martins" }, [lui, client({ id: "b", nom: "Bernard" })]);
  assert.equal(trouve?.id, "a");
});

essai("QUATRE MARTINS ET RIEN D'AUTRE : ON NE POSE RIEN", () => {
  // Le cœur de la règle. `rapprocherClient` rendrait le plus récent — c'est
  // bon pour ranger un chantier, jamais pour ÉCRIRE un numéro à l'écran : il
  // ne le relira pas, et le devis partirait chez le mauvais.
  const quatre = [
    client({ id: "a", nom: "Martins", telephone: "0611111111", creeLe: "2026-01-01" }),
    client({ id: "b", nom: "Martins", telephone: "0622222222", creeLe: "2026-02-01" }),
    client({ id: "c", nom: "Martins", telephone: "0633333333", creeLe: "2026-03-01" }),
    client({ id: "d", nom: "Martins", telephone: "0644444444", creeLe: "2026-04-01" }),
  ];
  assert.equal(clientAPreremplir({ nom: "Martins" }, quatre), null);
});

essai("son numéro le désigne parmi les quatre : on reprend", () => {
  const quatre = [
    client({ id: "a", nom: "Martins", telephone: "0611111111" }),
    client({ id: "b", nom: "Martins", telephone: "0622222222" }),
    client({ id: "c", nom: "Martins", telephone: "0633333333" }),
    client({ id: "d", nom: "Martins", telephone: "0644444444" }),
  ];
  const trouve = clientAPreremplir({ nom: "Martins", telephone: "06 33 33 33 33" }, quatre);
  assert.equal(trouve?.id, "c");
});

essai("un nom inconnu ne pose rien", () => {
  assert.equal(clientAPreremplir({ nom: "Rivière" }, [client({ id: "a", nom: "Martins" })]), null);
});

essai("un nom vide ne pose rien — et ne fait pas tomber l'écran", () => {
  assert.equal(clientAPreremplir({ nom: "" }, [client({ id: "a", nom: "Martins" })]), null);
  assert.equal(clientAPreremplir({ nom: "   " }, [client({ id: "a", nom: "Martins" })]), null);
});

essai("un numéro qui CONTREDIT ne pose rien — c'est quelqu'un d'autre", () => {
  const lui = client({ id: "a", nom: "Martins", telephone: "0612345678" });
  assert.equal(clientAPreremplir({ nom: "Martins", telephone: "0799999999" }, [lui]), null);
});

essai("« Ce n'est pas lui » ferme la question, même sur un seul homonyme", () => {
  const lui = client({ id: "a", nom: "Martins", telephone: "0612345678" });
  assert.equal(clientAPreremplir({ nom: "Martins", refuseLeRapprochement: true }, [lui]), null);
});

essai("« Ce n'est pas lui » vaut jusqu'à l'ENREGISTREMENT, pas seulement à l'écran", () => {
  // Sans cette porte, le refus ne tenait pas : il vide les cases reprises, le
  // nom reste seul, et la règle du nom seul retrouvait le même homme.
  const lui = client({ id: "a", nom: "Martins" });
  assert.deepEqual(rapprocherClient({ nom: "Martins", refuseLeRapprochement: true }, [lui]), {
    type: "creer",
    motif: "refuse",
  });
});

essai("sans refus, le même nom retrouve bien le même homme — le contrôle sait rougir", () => {
  const lui = client({ id: "a", nom: "Martins" });
  assert.deepEqual(rapprocherClient({ nom: "Martins" }, [lui]), {
    type: "reutiliser",
    id: "a",
    motif: "nom",
  });
});

essai("la civilité tapée à la volée ne casse pas la reconnaissance", () => {
  const lui = client({ id: "a", nom: "Martins", telephone: "0612345678" });
  assert.equal(clientAPreremplir({ nom: "M. Martins" }, [lui])?.id, "a");
});

console.log(`\n${echecs === 0 ? "✅" : "❌"} Reconnaître un client — ${echecs} échec(s).`);
process.exit(echecs === 0 ? 0 : 1);
