import assert from "node:assert/strict";
import {
  lireCoordonneesEvidentes,
  nettoyerChamp,
  assemblerCoordonnees,
  coordonneesVides,
} from "../src/lib/coordonnees-dictees";

// **Remplir la fiche du client à la voix, sans jamais rien inventer.**
//
// Le patron, le 7 août 2026 : « je veux une petite touche discrète, juste le
// signe de la note vocale, pour appuyer dessus et parler pour remplir les infos
// du client si j'ai pas envie de les écrire ».
//
// Le risque n'est pas de mal comprendre : c'est de **compléter**. Un numéro
// deviné envoie le devis chez quelqu'un d'autre ; une adresse complétée « au
// plus probable » envoie l'artisan à la mauvaise rue. `docs/AGENT.md` §3 est
// explicite : un champ sans source fiable reste vide.
//
// Ce que cette suite tient, et qu'aucune autre ne voit :
//   1. ce qui a une FORME (téléphone, e-mail) est recopié, jamais approché ;
//   2. les non-réponses d'un modèle (« inconnu », « non précisé ») ne
//      deviennent jamais des données ;
//   3. en cas de désaccord sur un numéro, c'est le texte dicté qui gagne.

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

console.log("=== Ce qui a une forme : recopié, jamais approché ===");

cas("un numéro dicté est rendu sans espaces — sinon la messagerie s'ouvre vide", () => {
  // Le défaut du 5 août 2026 : un numéro espacé dans un lien `sms:` n'est pas
  // reconnu comme destinataire, et le patron ouvrait un message vide.
  for (const dictee of [
    "Monsieur Martin, 06 52 88 97 51",
    "son numéro c'est 06.52.88.97.51",
    "06-52-88-97-51",
    "vous pouvez le joindre au +33 6 52 88 97 51",
  ]) {
    const r = lireCoordonneesEvidentes(dictee);
    assert.ok(r.telephone && !/[\s.\-]/.test(r.telephone), `« ${dictee} » → « ${r.telephone} » : espaces ou ponctuation restants.`);
    assert.ok(r.telephone.endsWith("652889751"), `« ${dictee} » → « ${r.telephone} » : le numéro n'est pas celui qui a été dicté.`);
  }
});

cas("une adresse e-mail épelée à voix haute est reconstituée", () => {
  // Un service de transcription rend « arobase » et « point » en toutes
  // lettres, ou pose des espaces autour du @ : sans cela, aucune adresse dictée
  // ne serait jamais reconnue.
  for (const dictee of [
    "son mail c'est martin@exemple.fr",
    "martin arobase exemple point fr",
    "martin @ exemple.fr",
  ]) {
    assert.equal(lireCoordonneesEvidentes(dictee).email, "martin@exemple.fr", `« ${dictee} » mal lu.`);
  }
});

cas("une dictée sans numéro ne produit pas de numéro", () => {
  const r = lireCoordonneesEvidentes("Chez monsieur Martin, taille d'un charme, il rappellera plus tard");
  assert.equal(r.telephone, null, "Un numéro est apparu là où personne n'en a dicté.");
  assert.equal(r.email, null);
});

cas("une suite de chiffres qui n'est pas un téléphone est ignorée", () => {
  // Le piège réel : le patron dicte des quantités et des prix. « 8 mètres, 850
  // euros » ne doit pas devenir un numéro.
  const r = lireCoordonneesEvidentes("taille de 8 mètres, 850 euros, 2 arbres");
  assert.equal(r.telephone, null, `Un prix a été pris pour un téléphone : « ${r.telephone} ».`);
});

console.log("\n=== Les non-réponses d'un modèle ne deviennent pas des données ===");

for (const nonReponse of ["", "   ", "inconnu", "Non précisé", "non renseignée", "N/A", "aucune", "null"]) {
  cas(`« ${nonReponse || "(vide)"} » reste un champ vide`, () => {
    assert.equal(
      nettoyerChamp(nonReponse),
      null,
      "Cette réponse finirait telle quelle dans la fiche du client, puis sur le devis."
    );
  });
}

cas("un vrai nom passe, nettoyé de ses espaces en trop", () => {
  assert.equal(nettoyerChamp("  Monsieur   Martin "), "Monsieur Martin");
});

cas("ce qui n'est pas du texte ne devient pas du texte", () => {
  assert.equal(nettoyerChamp(42), null);
  assert.equal(nettoyerChamp(null), null);
  assert.equal(nettoyerChamp(undefined), null);
  assert.equal(nettoyerChamp({ nom: "Martin" }), null);
});

console.log("\n=== En cas de désaccord, le texte dicté fait foi ===");

cas("un numéro approché par le modèle ne remplace pas celui qui a été dicté", () => {
  // Un modèle relit la même phrase et peut avaler un chiffre. La forme, elle,
  // recopie. C'est la règle la plus importante de ce fichier.
  const r = assemblerCoordonnees("Monsieur Martin, 06 52 88 97 51, 12 rue des Lilas", {
    nom: "Monsieur Martin",
    telephone: "06 52 88 97 5",
    adresse: "12 rue des Lilas",
  });
  assert.equal(r.telephone, "0652889751", "Le numéro du modèle a écrasé celui qui était écrit noir sur blanc.");
  assert.equal(r.nom, "Monsieur Martin");
  assert.equal(r.adresse, "12 rue des Lilas");
});

cas("le modèle complète ce que la forme ne sait pas voir", () => {
  const r = assemblerCoordonnees("Chez madame Aubry, deux route de Vertou", {
    nom: "Madame Aubry",
    adresse: "2 route de Vertou",
    telephone: "inconnu",
    email: "non précisé",
  });
  assert.equal(r.nom, "Madame Aubry");
  assert.equal(r.adresse, "2 route de Vertou");
  assert.equal(r.telephone, null, "« inconnu » est devenu un numéro de téléphone.");
  assert.equal(r.email, null);
});

cas("une dictée qui ne dit rien d'exploitable se reconnaît", () => {
  const r = assemblerCoordonnees("euh… voilà, c'est tout", {});
  assert.ok(coordonneesVides(r), "L'écran croirait avoir rempli quelque chose.");
});

cas("un modèle muet ne fait pas perdre ce que la phrase disait", () => {
  // Le fournisseur peut être en panne, ou répondre n'importe quoi : le
  // téléphone et l'e-mail doivent survivre à sa défaillance.
  const r = assemblerCoordonnees("06 52 88 97 51, martin@exemple.fr", {});
  assert.equal(r.telephone, "0652889751");
  assert.equal(r.email, "martin@exemple.fr");
});

console.log(`\n${echecs === 0 ? "✅" : "❌"} Coordonnées dictées — ${echecs} échec(s).`);
if (echecs > 0) process.exit(1);
