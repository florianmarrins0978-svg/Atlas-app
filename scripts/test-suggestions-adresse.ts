import assert from "node:assert/strict";
import { lireSuggestions, meriteUneRecherche, MAX_SUGGESTIONS } from "../src/lib/suggestions-adresse";

// **Ce qu'Atlas retient d'une réponse venue de l'extérieur.**
//
// Le patron, le 7 août 2026 : « on commence à taper l'adresse et il nous propose
// tout un tas de listes ». Cette liste vient d'un service qu'on ne maîtrise pas.
// Il peut changer de forme, répondre à moitié, ou ne rien vouloir dire le jour
// d'une panne — et ce jour-là, l'écran de création de chantier doit continuer de
// fonctionner comme avant, sans aide et sans message rouge.
//
// La règle qui prime sur toutes : **ne jamais inventer une adresse**. Un client
// se déplace à ce qui figure sur le devis ; une rue devinée envoie le patron
// ailleurs (`docs/AGENT.md` §3). Une entrée mal formée est donc écartée, jamais
// rafistolée.

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

/** La forme réellement rendue par la Base Adresse Nationale (GeoJSON). */
const REPONSE_REELLE = {
  type: "FeatureCollection",
  version: "draft",
  features: [
    {
      type: "Feature",
      geometry: { type: "Point", coordinates: [2.331, 48.869] },
      properties: {
        label: "20 Rue de la Paix 75002 Paris",
        score: 0.97,
        housenumber: "20",
        id: "75102_7100_00020",
        name: "20 Rue de la Paix",
        postcode: "75002",
        citycode: "75102",
        city: "Paris",
        context: "75, Paris, Île-de-France",
        type: "housenumber",
      },
    },
    {
      type: "Feature",
      geometry: { type: "Point", coordinates: [1.716, 48.99] },
      properties: {
        label: "20 Rue de la Paix 78200 Mantes-la-Jolie",
        score: 0.91,
        city: "Mantes-la-Jolie",
        postcode: "78200",
        context: "78, Yvelines, Île-de-France",
        type: "housenumber",
      },
    },
  ],
  attribution: "BAN",
  licence: "ODbL 1.0",
};

console.log("=== Ce qui est retenu d'une réponse ===");

cas("l'adresse entière est reprise telle quelle, avec son département", () => {
  const s = lireSuggestions(REPONSE_REELLE);
  assert.equal(s.length, 2);
  assert.equal(
    s[0].libelle,
    "20 Rue de la Paix 75002 Paris",
    "L'adresse doit arriver ENTIÈRE dans le champ : code postal et commune compris, sinon le patron doit les retaper."
  );
  assert.equal(
    s[1].contexte,
    "78, Yvelines, Île-de-France",
    "Sans le département, deux rues du même nom sont indiscernables — exactement le cas décrit par le patron (Paris et Mantes-la-Jolie)."
  );
});

cas("la même adresse deux fois n'apparaît qu'une", () => {
  const doublon = {
    features: [
      { properties: { label: "3 Rue Neuve 44000 Nantes" } },
      { properties: { label: "3 rue neuve 44000 NANTES" } },
      { properties: { label: "5 Rue Neuve 44000 Nantes" } },
    ],
  };
  const s = lireSuggestions(doublon);
  assert.equal(s.length, 2, "Une ligne répétée donne l'impression d'un défaut, et fait perdre une place dans la liste.");
});

cas("la liste ne dépasse jamais ce que tient un écran de téléphone", () => {
  const beaucoup = { features: Array.from({ length: 40 }, (_, i) => ({ properties: { label: `${i} Rue Longue 44000 Nantes` } })) };
  assert.equal(lireSuggestions(beaucoup).length, MAX_SUGGESTIONS);
});

console.log("\n=== Ce qui arrive quand la réponse n'est pas celle qu'on croit ===");

for (const [nom, entree] of [
  ["une réponse vide", {}],
  ["null", null],
  ["une chaîne de caractères", "service momentanément indisponible"],
  ["une page HTML d'erreur", "<html><body>502</body></html>"],
  ["features qui n'est pas une liste", { features: { label: "x" } }],
  ["une liste d'entrées vides", { features: [null, {}, { properties: {} }] }],
  ["un libellé qui n'est pas du texte", { features: [{ properties: { label: 42 } }] }],
  ["un libellé vide", { features: [{ properties: { label: "   " } }] }],
] as const) {
  cas(`${nom} : aucune suggestion, aucune exception`, () => {
    const s = lireSuggestions(entree);
    assert.deepEqual(s, [], "Une réponse illisible doit rendre une liste vide, jamais une adresse fabriquée.");
  });
}

cas("une entrée valide au milieu d'entrées cassées est conservée", () => {
  // Le cas qui compte vraiment : on n'abandonne pas tout parce qu'une ligne est
  // mauvaise, et on ne garde pas la mauvaise pour autant.
  const s = lireSuggestions({
    features: [null, { properties: { label: "" } }, { properties: { label: "7 Place du Bourg 44190 Clisson" } }, {}],
  });
  // **Sans coordonnées, la suggestion reste une suggestion.** Une adresse dont
  // le service ne rend pas la géométrie doit continuer d'être proposée : c'est
  // le champ d'adresse qui compte d'abord, l'appariement des demi-journées vient
  // après et sait dire qu'il n'a pas su situer ce chantier.
  assert.deepEqual(s, [
    { libelle: "7 Place du Bourg 44190 Clisson", contexte: null, latitude: null, longitude: null },
  ]);
});

console.log("\n=== Quand faut-il seulement interroger la base ? ===");

cas("moins de trois caractères : on n'appelle pas", () => {
  // En dessous, la base rend la France entière : la liste n'aide personne et
  // chaque lettre coûterait une requête.
  assert.equal(meriteUneRecherche(""), false);
  assert.equal(meriteUneRecherche("2"), false);
  assert.equal(meriteUneRecherche("20"), false);
  assert.equal(meriteUneRecherche("  20  "), false, "Les espaces ne comptent pas comme de la saisie.");
});

cas("dès trois caractères, espaces retirés, on appelle", () => {
  assert.equal(meriteUneRecherche(" rue "), true, "Trois caractères comptés APRÈS les espaces, pas avant.");
  assert.equal(meriteUneRecherche("20 rue de la paix"), true);
});

console.log(`\n${echecs === 0 ? "✅" : "❌"} Suggestions d'adresse — ${echecs} échec(s).`);
if (echecs > 0) process.exit(1);
