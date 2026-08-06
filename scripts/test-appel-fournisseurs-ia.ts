import assert from "node:assert/strict";
import http from "node:http";
import { AddressInfo } from "node:net";
import { _reinitialiserEnvPourTests } from "../src/server/env";

// **Ce qui part réellement chez le fournisseur, et ce qu'on comprend de sa réponse.**
//
// Deux fournisseurs réels vivent dans ce dépôt, et aucune suite ne les avait
// jamais fait parler : les éprouver supposait une vraie clé, un vrai appel, et
// de le payer. Résultat, `openai.ts` a passé des semaines à répondre
// « non implémenté » sans que rien ne le signale, pendant que le patron
// croyait son IA branchée.
//
// La parade est un serveur local qui joue le fournisseur. Les adresses sont
// détournées par `ANTHROPIC_BASE_URL` / `OPENAI_BASE_URL` — surcharges qui
// n'existent que pour ça. Ce que cette suite éprouve vraiment :
//
//   1. la clé part dans le BON en-tête — `x-api-key` chez Anthropic,
//      `Authorization: Bearer` chez OpenAI. Les intervertir donne un 401 que
//      rien ne distingue d'une mauvaise clé ;
//   2. la réponse est comprise, y compris l'appel d'outil, dont la forme
//      diffère d'un fournisseur à l'autre (objet chez l'un, texte JSON chez
//      l'autre) ;
//   3. les pannes désignent le bon coupable — clé refusée, quota, réponse
//      illisible — au lieu d'un « fournisseur indisponible » passe-partout.
//
// Ce qu'elle NE prouve pas, et qu'il faut dire : qu'une vraie clé fonctionne
// chez le vrai fournisseur. Cela ne s'éprouve qu'avec une clé, par
// `npm run verifier:ia -- --reseau`.

let echecs = 0;
async function cas(nom: string, verifier: () => Promise<void>) {
  try {
    await verifier();
    console.log(`  ✓ ${nom}`);
  } catch (e) {
    echecs++;
    console.error(`  ✗ ${nom}\n    ${(e as Error).message}`);
  }
}

type Recue = { chemin: string; entetes: http.IncomingHttpHeaders; corps: string };

let prochaine: { statut: number; corps: unknown | string } = { statut: 200, corps: {} };
let derniere: Recue | null = null;

const serveur = http.createServer((req, res) => {
  const morceaux: Buffer[] = [];
  req.on("data", (c) => morceaux.push(c));
  req.on("end", () => {
    derniere = { chemin: req.url ?? "", entetes: req.headers, corps: Buffer.concat(morceaux).toString("utf8") };
    res.writeHead(prochaine.statut, { "Content-Type": "application/json" });
    res.end(typeof prochaine.corps === "string" ? prochaine.corps : JSON.stringify(prochaine.corps));
  });
});

async function main() {
  await new Promise<void>((resolve) => serveur.listen(0, "127.0.0.1", resolve));
  const port = (serveur.address() as AddressInfo).port;
  const adresse = `http://127.0.0.1:${port}`;

  process.env.DATABASE_URL ??= "postgresql://essai:essai@localhost:5432/essai";
  process.env.ANTHROPIC_API_KEY = "cle-anthropic-de-test";
  process.env.OPENAI_API_KEY = "cle-openai-de-test";
  process.env.ANTHROPIC_BASE_URL = adresse;
  process.env.OPENAI_BASE_URL = adresse;
  delete process.env.LLM_PROVIDER;
  delete process.env.TRANSCRIPTION_PROVIDER;
  _reinitialiserEnvPourTests();

  // Importés APRÈS l'environnement : ils lisent la configuration au premier
  // appel, et une importation trop tôt figerait les adresses officielles.
  const { fournisseurLLMAnthropic } = await import("../src/server/ai/providers/llm/anthropic");
  const { fournisseurLLMOpenAI } = await import("../src/server/ai/providers/llm/openai");
  const { fournisseurTranscriptionOpenAI } = await import("../src/server/ai/providers/transcription/openai");

  const OUTILS = [{ nom: "ProposerModifications", description: "Propose des modifications", schema: undefined as never }];

  console.log("=== Anthropic : ce qui part, et ce qui revient ===");

  await cas("la clé part dans x-api-key, avec la version d'API", async () => {
    prochaine = { statut: 200, corps: { content: [{ type: "text", text: "Bonjour" }] } };
    const r = await fournisseurLLMAnthropic.genererTexte("Tu es un assistant.", "Dis bonjour.");
    assert.ok(r.succes, "L'appel aurait dû réussir.");
    assert.equal(derniere?.chemin, "/v1/messages");
    assert.equal(derniere?.entetes["x-api-key"], "cle-anthropic-de-test");
    assert.equal(derniere?.entetes["anthropic-version"], "2023-06-01");
    // La clé ne doit PAS partir aussi ailleurs : deux en-têtes d'authentification
    // valent une fuite de plus, sans aucun bénéfice.
    assert.equal(derniere?.entetes["authorization"], undefined);
  });

  await cas("le texte dicté part bien dans le corps de la requête", async () => {
    prochaine = { statut: 200, corps: { content: [{ type: "text", text: "ok" }] } };
    await fournisseurLLMAnthropic.genererTexte("système", "Taille de haie de laurier, 20 mètres.");
    const corps = JSON.parse(derniere!.corps);
    assert.equal(corps.messages[0].content, "Taille de haie de laurier, 20 mètres.");
    assert.equal(corps.system, "système");
  });

  await cas("un appel d'outil est reconnu et ses paramètres lus", async () => {
    prochaine = {
      statut: 200,
      corps: { content: [{ type: "tool_use", id: "x", name: "ProposerModifications", input: { texteIntroduction: "Voici" } }] },
    };
    const r = await fournisseurLLMAnthropic.genererAvecOutils!("s", [{ role: "user", contenu: "vas-y" }], OUTILS);
    assert.ok(r.succes && r.type === "appel_outil", "Devrait être un appel d'outil.");
    assert.equal(r.outil, "ProposerModifications");
    assert.deepEqual(r.parametres, { texteIntroduction: "Voici" });
  });

  await cas("une clé refusée est nommée pour ce qu'elle est", async () => {
    prochaine = { statut: 401, corps: { error: { message: "invalid x-api-key" } } };
    const r = await fournisseurLLMAnthropic.genererTexte("s", "m");
    assert.ok(!r.succes);
    assert.equal(r.erreur.type, "cle_api_refusee");
    assert.match(r.erreur.message, /ANTHROPIC_API_KEY/, "Le message doit nommer la variable à corriger.");
  });

  await cas("un quota dépassé n'est pas confondu avec une panne", async () => {
    prochaine = { statut: 429, corps: {} };
    const r = await fournisseurLLMAnthropic.genererTexte("s", "m");
    assert.ok(!r.succes);
    assert.equal(r.erreur.type, "quota_depasse");
  });

  await cas("une réponse vide ne devient pas un devis vide", async () => {
    prochaine = { statut: 200, corps: { content: [] } };
    const r = await fournisseurLLMAnthropic.genererTexte("s", "m");
    assert.ok(!r.succes);
    assert.equal(r.erreur.type, "reponse_invalide");
  });

  console.log("\n=== OpenAI : le fournisseur qui n'était qu'une ébauche ===");

  await cas("il appelle pour de bon, avec la clé en Bearer", async () => {
    prochaine = { statut: 200, corps: { choices: [{ message: { content: "Bonjour" } }] } };
    const r = await fournisseurLLMOpenAI.genererTexte("s", "Dis bonjour.");
    assert.ok(r.succes, `Devrait réussir — l'ébauche répondait « non implémenté ». Reçu : ${JSON.stringify(r)}`);
    assert.equal(r.texte, "Bonjour");
    assert.equal(derniere?.chemin, "/v1/chat/completions");
    assert.equal(derniere?.entetes["authorization"], "Bearer cle-openai-de-test");
    assert.equal(derniere?.entetes["x-api-key"], undefined);
  });

  await cas("les paramètres d'outil, qui arrivent en TEXTE, sont relus en objet", async () => {
    prochaine = {
      statut: 200,
      corps: {
        choices: [
          {
            message: {
              tool_calls: [{ id: "1", function: { name: "ProposerModifications", arguments: '{"texteIntroduction":"Voici"}' } }],
            },
          },
        ],
      },
    };
    const r = await fournisseurLLMOpenAI.genererAvecOutils!("s", [{ role: "user", contenu: "vas-y" }], OUTILS);
    assert.ok(r.succes && r.type === "appel_outil", `Devrait être un appel d'outil : ${JSON.stringify(r)}`);
    assert.deepEqual(r.parametres, { texteIntroduction: "Voici" });
  });

  await cas("des paramètres illisibles renvoient une erreur, jamais une exception", async () => {
    // C'est LE point de rupture propre à OpenAI : le JSON arrive en texte, et
    // un `JSON.parse` nu ferait remonter une pile d'exécution jusqu'à l'écran.
    prochaine = {
      statut: 200,
      corps: { choices: [{ message: { tool_calls: [{ id: "1", function: { name: "X", arguments: "{ceci n'est pas du JSON" } }] } }] },
    };
    const r = await fournisseurLLMOpenAI.genererAvecOutils!("s", [{ role: "user", contenu: "x" }], OUTILS);
    assert.ok(!r.succes);
    assert.equal(r.erreur.type, "reponse_invalide");
  });

  await cas("une clé OpenAI refusée nomme OPENAI_API_KEY", async () => {
    prochaine = { statut: 401, corps: {} };
    const r = await fournisseurLLMOpenAI.genererTexte("s", "m");
    assert.ok(!r.succes);
    assert.equal(r.erreur.type, "cle_api_refusee");
    assert.match(r.erreur.message, /OPENAI_API_KEY/);
  });

  console.log("\n=== La dictée, envoyée pour être transcrite ===");

  await cas("l'audio part vraiment, en français, à Whisper", async () => {
    prochaine = { statut: 200, corps: { text: "Taille de haie de laurier, 20 mètres linéaires." } };
    const r = await fournisseurTranscriptionOpenAI.transcrire(Buffer.from("des-octets-audio"), "audio/webm");
    assert.ok(r.succes, `La transcription aurait dû réussir : ${JSON.stringify(r)}`);
    assert.equal(r.texte, "Taille de haie de laurier, 20 mètres linéaires.");
    assert.equal(derniere?.chemin, "/v1/audio/transcriptions");
    assert.match(derniere!.corps, /whisper-1/);
    assert.match(derniere!.corps, /name="language"[\s\S]*?fr/);
    assert.match(derniere!.corps, /des-octets-audio/, "Les octets de la dictée ne sont pas partis.");
  });

  await cas("une transcription vide n'est jamais présentée comme un texte", async () => {
    prochaine = { statut: 200, corps: {} };
    const r = await fournisseurTranscriptionOpenAI.transcrire(Buffer.from("x"), "audio/webm");
    assert.ok(!r.succes);
    assert.equal(r.erreur.type, "reponse_invalide");
  });

  console.log("\n=== La chaîne entière : une clé posée, une dictée COMPRISE ===");

  // C'est le maillon qui manquait, et la question même du patron : est-ce que
  // brancher un fournisseur change quelque chose à ce qu'il obtient ? Les
  // suites précédentes éprouvent l'appel ; celle-ci éprouve la CONSÉQUENCE —
  // la dictée cesse d'être recopiée mot à mot, et le brouillon porte
  // `lecture = "modele"`.
  const { extraire } = await import("../src/server/ai/services/extraction-service");
  const DICTEE = "Taille de haie de laurier, 20 mètres linéaires, un chêne mort à abattre, deux jours, deux hommes.";

  await cas("le fournisseur configuré est réellement celui qu'on appelle", async () => {
    prochaine = {
      statut: 200,
      corps: {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              prestations: [
                { libelle: "Taille de haie de laurier", quantite: "20", unite: "m" },
                { libelle: "Abattage d'un chêne mort" },
              ],
              materiel: [],
              dureePrevue: "2 jours",
              tailleEquipe: "2",
            }),
          },
        ],
      },
    };
    const r = await extraire(DICTEE);
    assert.ok(r.succes, "L'extraction aurait dû aboutir.");
    assert.equal(r.lecture, "modele", "La dictée est encore recopiée mot à mot alors qu'un modèle a répondu.");
    // La preuve que c'est bien le modèle qui a parlé : « abattage » n'apparaît
    // nulle part dans la dictée. Une recopie ne pourrait pas l'inventer — et
    // c'est précisément ce que le patron attend d'un modèle.
    assert.match(JSON.stringify(r.proposition), /Abattage/, "La proposition ne vient pas de la réponse du modèle.");
    assert.equal(r.proposition.prestations.length, 2);
  });

  await cas("un fournisseur en panne renvoie à la recopie, jamais à un écran mort", async () => {
    prochaine = { statut: 500, corps: {} };
    const r = await extraire(DICTEE);
    assert.ok(r.succes, "Une panne du fournisseur ne doit jamais bloquer le patron.");
    assert.equal(r.lecture, "litterale");
    assert.ok((r.proposition.prestations.length ?? 0) > 0, "La recopie doit tout de même produire des lignes.");
  });

  serveur.close();
  console.log(`\n${echecs === 0 ? "✅" : "❌"} Appels aux fournisseurs — ${echecs} échec(s).`);
  if (echecs > 0) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  serveur.close();
  process.exit(1);
});
