import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { signatureLecon } from "../src/lib/lecons-prix";
import { lignesVendables } from "../src/lib/lignes-vendables";
import { extraire } from "../src/server/ai/services/extraction-service";
import type { FournisseurLLM } from "../src/server/ai/providers/llm/interface";

// **Ce que la chaîne dictée → devis doit tenir, et qu'elle ne tient pas encore.**
//
// Cette suite est écrite AVANT la correction, et elle est ROUGE : c'est le
// but. Le patron l'a demandé mot pour mot — *« écrire les tests de régression
// AVANT les corrections »*, *« ne change pas le code pour rendre les tests
// verts »*. Chaque cas porte la lettre de son brief (A à H).
//
// **Elle ne doit pas atteindre `main` avant que P0 à P3 soient faits.** Une
// suite rouge sur `main` rend la batterie rouge pour les cinq autres sessions,
// et une batterie rouge cesse d'être lue. Elle vit sur la branche du lot.
//
// **Aucune clé n'est nécessaire, et c'est délibéré** (`CLAUDE.md` §1 ter) : le
// seul appel de modèle est fait avec un fournisseur injecté, fabriqué ici.
// Ce qui dépend d'une vraie clé n'a rien à faire dans une suite.

let echecs = 0;
let reussites = 0;
function cas(nom: string, verifier: () => void): void {
  try {
    verifier();
    console.log(`✅ ${nom}`);
    reussites++;
  } catch (e) {
    echecs++;
    console.error(`❌ ${nom}\n   ${(e as Error).message}`);
  }
}

async function casAsync(nom: string, verifier: () => Promise<void>): Promise<void> {
  try {
    await verifier();
    console.log(`✅ ${nom}`);
    reussites++;
  } catch (e) {
    echecs++;
    console.error(`❌ ${nom}\n   ${(e as Error).message}`);
  }
}

// Les libellés exacts que le patron a lus sur son devis le 26 août 2026.
const TONTE = "Tonte de la pelouse (1200 m²)";
const ERABLE = "Érable — démontage en rétention";
const HAIE_800 = "Haie (tout genre) (800 ml)";
const HAIE_50 = "Haie de laurier (50 ml)";

console.log("\n=== B — deux travaux dictés restent deux identités métier ===\n");

cas("une tonte et un démontage ne se fondent pas dans un seul libellé", () => {
  const { lignes } = lignesVendables([TONTE, ERABLE]);
  // Ce qui est refusé n'est PAS le regroupement commercial — le patron le veut
  // (« l'abattage, le broyage et l'évacuation, c'est sur une ligne »). Ce qui
  // est refusé, c'est que le regroupement DÉTRUISE l'identité des prestations :
  // deux travaux sans rapport n'ont plus, ensuite, aucune existence séparée.
  const fondues = lignes.filter((l) => l.membres.length > 1);
  assert.equal(
    fondues.length,
    0,
    `« ${TONTE} » et « ${ERABLE} » sont réunis dans une même identité : ` +
      fondues.map((l) => JSON.stringify(l.libelle)).join(" · ")
  );
});

cas("la tonte n'hérite pas de la nature du démontage", () => {
  const { lignes } = lignesVendables([TONTE, ERABLE]);
  const porteLaTonte = lignes.find((l) => l.membres.some((m) => m === TONTE));
  assert.ok(porteLaTonte, "la tonte a disparu du découpage");
  assert.equal(
    porteLaTonte.membres.length,
    1,
    "la tonte partage sa ligne avec un travail d'une autre nature — son prix et " +
      "son apprentissage seront attribués à cette autre nature"
  );
});

console.log("\n=== E — un faux comparable est pire qu'un comparable absent ===\n");

cas("50 ml et 800 ml de haie ne sont pas le même chantier", () => {
  const petite = signatureLecon(HAIE_50);
  const grande = signatureLecon(HAIE_800);
  assert.ok(petite && grande, "l'une des deux haies n'a produit aucune signature");
  assert.notEqual(
    petite.cle,
    grande.cle,
    `50 ml et 800 ml partagent la clé « ${petite.cle} » : seize fois la longueur, ` +
      "et le rappel présente le prix de l'une comme l'expérience de l'autre"
  );
});

cas("deux haies de longueur voisine restent, elles, comparables", () => {
  // **Le contrôle doit couper dans les DEUX sens.** Une correction qui rendrait
  // toutes les haies incomparables passerait le test précédent et détruirait la
  // mémoire du patron. Sa règle : un rappel manquant est acceptable, un rappel
  // faux ne l'est pas — mais « aucun rappel jamais » n'est pas la réponse.
  const a = signatureLecon("Haie de laurier (50 ml)");
  const b = signatureLecon("Haie de thuyas (55 ml)");
  assert.ok(a && b, "signature absente");
  assert.equal(a.cle, b.cle, "deux haies de 50 et 55 ml ne se rapprochent plus : la mémoire ne sert plus à rien");
});

cas("une espèce différente ne se rapproche pas quand elle change le prix", () => {
  // Un buis de 5 ml et un laurier de 5 ml ne se taillent ni au même rythme ni
  // avec le même matériel. Aujourd'hui les deux valent « haie », tout court.
  const buis = signatureLecon("Taille de haie de buis (5 ml)");
  const laurier = signatureLecon("Taille de haie de laurier (5 ml)");
  assert.ok(buis && laurier, "signature absente");
  assert.notEqual(buis.cle, laurier.cle, "l'espèce n'entre pas dans la clé : buis et laurier sont confondus");
});

console.log("\n=== F — un lot de plusieurs natures n'est l'expérience d'aucune ===\n");

cas("« tonte + démontage » ne produit pas la signature d'un abattage", () => {
  const fusionne = `${TONTE}\n${ERABLE}`;
  const s = signatureLecon(fusionne);
  assert.equal(
    s,
    null,
    `un libellé portant deux natures a produit « ${s?.cle} » : le prix du lot entier ` +
      "sera retenu comme le prix d'un démontage en rétention"
  );
});

cas("un seul travail, lui, garde bien sa signature", () => {
  // L'autre sens du contrôle : refuser les lots ne doit pas faire taire les
  // rapprochements légitimes.
  const s = signatureLecon("Abattage d'un chêne — démontage avec rétention, ⌀ 70 cm");
  assert.equal(s?.cle, "abattage|retention|d70");
});

console.log("\n=== G — les signatures déjà stockées ne doivent pas devenir muettes ===\n");

// **Ce cas-ci est VERT aujourd'hui, et c'est sa raison d'être.** Il fige les
// clés V1 telles qu'elles existent en production dans `lecons_prix.signature`.
// La migration de P2 devra les conserver : une clé réécrite orphelinerait toute
// la mémoire de prix du patron, sans un mot et sans erreur.
const CLES_V1: readonly [string, string][] = [
  ["Abattage d'un chêne mort — démontage avec rétention, ⌀ 70 cm", "abattage|retention|d70"],
  ["Abattage d'un chêne mort — abattage au pied, ⌀ 70 cm", "abattage|au_pied|d70"],
  ["Abattage d'un chêne mort — démontage, ⌀ 70 cm", "abattage|demontage|d70"],
  ["Abattage — démontage avec rétention", "abattage|retention"],
  ["Taille de haie de laurier", "haie"],
  ["Taille du tilleul", "elagage"],
  ["Dessouchage de la souche", "dessouchage"],
  ["Fendage du bois", "fendage"],
  ["Broyage des branches", "broyage"],
];

cas("les clés V1 restent lisibles à l'identique", () => {
  for (const [libelle, attendue] of CLES_V1) {
    const s = signatureLecon(libelle);
    assert.equal(
      s?.cle,
      attendue,
      `la clé de « ${libelle} » a changé : ${s?.cle} au lieu de ${attendue}. ` +
        "Les leçons déjà enregistrées sous l'ancienne clé ne se retrouveront plus."
    );
  }
});

console.log("\n=== H — une réponse tronquée est invalide, jamais une lecture muette ===\n");

/** Un fournisseur dont la réponse est coupée en plein JSON, comme à `max_tokens`. */
function fournisseurTronque(): FournisseurLLM {
  return {
    nom: "tronque-pour-le-test",
    async genererTexte() {
      return {
        succes: true as const,
        texte:
          '{"prestations":[{"libelle":"Tonte de la pelouse","description":null,"quantite":"1200",' +
          '"unite":"m²","aConfirmer":false},{"libelle":"Taille de la haie","description":null,' +
          '"quantite":"800","unite":"ml","aConfirmer":false},{"libelle":"Démontage d\'un ér',
      };
    },
  };
}

/** Le même service, mais réellement en panne — pour prouver qu'on distingue les deux. */
function fournisseurEnPanne(): FournisseurLLM {
  return {
    nom: "en-panne-pour-le-test",
    async genererTexte() {
      return {
        succes: false as const,
        erreur: { type: "fournisseur_indisponible" as const, message: "Le fournisseur est momentanément indisponible." },
      };
    },
  };
}

const DICTEE = "Je tonds la pelouse de mille deux cents mètres carrés, je taille huit cents mètres de haie, et je démonte un érable en rétention.";

async function suiteAsync() {
  await casAsync("une réponse coupée ne devient pas une lecture mot à mot indiscernable d'une panne", async () => {
    const tronquee = await extraire(DICTEE, fournisseurTronque());
    const panne = await extraire(DICTEE, fournisseurEnPanne());

  assert.ok(tronquee.succes, "le cas tronqué n'a rien rendu du tout");
  assert.ok(panne.succes, "le cas panne n'a rien rendu du tout");

  // **Ce que ce contrôle demande, et ce qu'il ne demande PAS.** Le brief dit
  // « réponse tronquée → réponse invalide ». Il ne demande pas de supprimer le
  // filet : une dictée qui ne se lit plus du tout laisserait le patron devant
  // un écran mort, et c'est le défaut du 4 août 2026 qu'on a payé.
  //
  // Ce qui est exigé, c'est que la CAUSE soit distinguable. Aujourd'hui les
  // deux cas rendent le même repli, sans que rien ne dise lequel s'est produit
  // — donc sans qu'on puisse ni le mesurer, ni le corriger, ni le dire au
  // patron. C'est exactement le défaut muet d'`AGENTS.md`.
  assert.notEqual(
    tronquee.motifRepli,
    panne.motifRepli,
    `troncature et panne rendent le même motif (« ${tronquee.motifRepli} ») : ` +
      "rien ne permet de savoir laquelle des deux s'est produite"
  );
  assert.match(
    String(tronquee.motifRepli),
    /tronqu/i,
    `le motif ne nomme pas la troncature : « ${tronquee.motifRepli} »`
  );
  });
}

cas("le fournisseur Anthropic lit `stop_reason` — sans quoi rien ne peut détecter la coupure", () => {
  // **Contrôle sur la source, comme `test-prix-reserves-proprietaire-db.ts`.**
  // Le fournisseur ne peut pas être joué ici : il n'y a pas de clé, et un appel
  // réseau n'a rien à faire dans une suite. Mais on peut vérifier ce qu'il
  // regarde dans la réponse.
  //
  // L'API renvoie `stop_reason: "max_tokens"` quand elle a coupé. Le
  // fournisseur ne lit aujourd'hui que `content` : l'information existe, arrive
  // jusqu'ici, et est jetée. Aucun correctif en aval ne peut la retrouver.
  const source = readFileSync(path.join(__dirname, "..", "src/server/ai/providers/llm/anthropic.ts"), "utf8");
  assert.match(
    source,
    /stop_reason/,
    "le fournisseur Anthropic ignore `stop_reason` : la troncature est perdue à la frontière du fournisseur"
  );
});

suiteAsync().then(() => {
  console.log(`\n${reussites} réussite(s), ${echecs} échec(s).`);
  if (echecs > 0) process.exitCode = 1;
});
