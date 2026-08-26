import assert from "node:assert";
import { pool } from "../src/server/db/client";
import * as entreprisesRepo from "../src/server/repositories/entreprises";
import * as chantiersRepo from "../src/server/repositories/chantiers";
import * as clientsRepo from "../src/server/repositories/clients";
import { poserQuestion } from "../src/server/ai/services/assistant-service";
import { getOutil } from "../src/server/ai/tools/registre";
import { _reinitialiserFabriqueLLM } from "../src/server/ai/providers/llm/fabrique";
import type { FournisseurLLM } from "../src/server/ai/providers/llm/interface";
import { fermerLimiteur } from "../src/server/rate-limit";
import { nettoyerBase } from "./_test-db";

/**
 * UN OUTIL MAL APPELÉ N'EST PAS UNE PANNE — l'assistant se reprend.
 *
 * **Sa capture du 26 août 2026 au soir**, trois fois de suite : *« Peux-tu me
 * sortir le devis de Lucie »*, *« Sors-moi le dernier devis de Bernard »*,
 * *« Je veux le dernier devis de Bernard »* → **« L'assistant a mal formé sa
 * demande à un outil interne. Reformulez votre question. »** Sa réaction :
 * *« il comprend rien »*.
 *
 * **Reformuler n'y pouvait rien.** Sa phrase était parfaite ; c'est le nom d'un
 * paramètre qui n'allait pas, côté modèle — et l'écran lui demandait de réparer
 * une chose qu'il ne voyait pas. Le pire des messages : il accuse celui qui
 * n'y est pour rien.
 *
 * **Deux défauts derrière, et cette suite tient les deux :**
 *
 * 1. la boucle s'ARRÊTAIT au premier écart, là où une boucle d'outils doit
 *    rendre l'erreur au modèle et le laisser rappeler ;
 * 2. le registre nommait `nom`, `motCle` et `question` la même idée — une
 *    invitation à se tromper, et la faute est du côté du dépôt.
 */

let passed = 0;
let failed = 0;
async function test(nom: string, fn: () => Promise<void>) {
  try {
    await fn();
    console.log(`✅ ${nom}`);
    passed++;
  } catch (err) {
    console.error(`❌ ${nom}`);
    console.error(`   ${err instanceof Error ? err.message : err}`);
    failed++;
  }
}

/**
 * Un fournisseur qui se trompe d'abord, exactement comme le vrai l'a fait :
 * il appelle le bon outil avec le nom de champ d'un outil voisin.
 */
function fournisseurQuiSeTrompe(champFautif: string, outilVise: string): FournisseurLLM {
  let appels = 0;
  return {
    nom: "essai",
    async genererTexte() {
      return { succes: true, texte: "" };
    },
    async genererAvecOutils(_systeme, historique) {
      appels++;
      const dernier = historique[historique.length - 1];
      if (dernier?.role === "outil") {
        // On lui a rendu quelque chose : soit le refus, soit le résultat.
        const r = dernier.resultat as { erreur?: string; aFaire?: string };
        if (r?.erreur && appels <= 3) {
          // **Il se reprend** — et c'est tout ce qu'on éprouve ici : le refus
          // lui est PARVENU, et il porte de quoi rappeler juste.
          return { succes: true, type: "appel_outil", outil: outilVise, parametres: { nom: "Lucie" } };
        }
        return { succes: true, type: "texte", texte: `Voici ce que j'ai trouvé : ${JSON.stringify(dernier.resultat)}` };
      }
      return { succes: true, type: "appel_outil", outil: outilVise, parametres: { [champFautif]: "Lucie" } };
    },
  };
}

async function main() {
  await nettoyerBase();

  const { entreprise, utilisateurId } = await entreprisesRepo.creerEntreprise(
    { nom: "Entreprise Correction" },
    { email: "correction@test.local", nom: "Patron" }
  );
  const A = { entrepriseId: entreprise.id, utilisateurId };

  const lucie = await clientsRepo.creerClient(A, { nom: "Madame Lucie" });
  await chantiersRepo.creerChantier(A, { nom: "Jardin Lucie", clientId: lucie.id });

  // --- Ce qui a cassé chez lui : les noms de champs ------------------------

  await test("SA CAPTURE : « motCle » est accepté là où le champ s'appelle « nom »", async () => {
    // C'est l'erreur exacte du vrai modèle : le champ des outils voisins.
    const outil = getOutil("RechercherChantier")!;
    const r = (await outil.executer({ ctx: A, chantierId: null }, { motCle: "Lucie" })) as {
      trouves: { chantierNom: string }[];
    };
    assert.equal(r.trouves.length, 1, "l'outil ne trouve rien avec « motCle »");
  });

  await test("« nom » est accepté là où le champ s'appelle « motCle »", async () => {
    const outil = getOutil("LireClients")!;
    const r = (await outil.executer({ ctx: A, chantierId: null }, { nom: "Lucie" })) as { trouve: boolean };
    assert.equal(r.trouve, true);
  });

  await test("Le mode d'emploi répond aussi à « motCle »", async () => {
    const outil = getOutil("RechercherModeEmploi")!;
    const r = (await outil.executer({ ctx: A, chantierId: null }, { motCle: "comment je supprime un chantier" })) as {
      trouve: boolean;
    };
    assert.equal(r.trouve, true);
  });

  await test("Un appel VRAIMENT vide est toujours refusé — on n'accepte pas n'importe quoi", async () => {
    const outil = getOutil("RechercherChantier")!;
    assert.equal(outil.schema.safeParse({}).success, false);
    assert.equal(outil.schema.safeParse({ nom: "   " }).success, false);
  });

  // --- Et surtout : la boucle se reprend ----------------------------------

  await test("UN OUTIL MAL APPELÉ NE TUE PLUS LA RÉPONSE — il se corrige et répond", async () => {
    try {
      _reinitialiserFabriqueLLM(fournisseurQuiSeTrompe("nImporteQuoi", "RechercherChantier"));
      const reponse = await poserQuestion(A, null, [], "Peux-tu me sortir le devis de Lucie ?");
      assert.equal(reponse.succes, true, !reponse.succes ? reponse.erreur : "");
      if (!reponse.succes) return;
      assert.ok(
        !/mal formé sa demande/i.test(reponse.texte),
        "l'ancien message est revenu : il accuse le patron d'une faute qui n'est pas la sienne"
      );
      assert.match(reponse.texte, /Lucie/i, "il n'est pas allé au bout de sa recherche");
    } finally {
      _reinitialiserFabriqueLLM(null);
    }
  });

  await test("Un modèle qui s'entête finit par rendre la main, en français", async () => {
    try {
      // Celui-ci ne se reprend jamais : la boucle doit s'arrêter proprement.
      _reinitialiserFabriqueLLM({
        nom: "entete",
        async genererTexte() {
          return { succes: true, texte: "" };
        },
        async genererAvecOutils() {
          return { succes: true, type: "appel_outil", outil: "RechercherChantier", parametres: { zzz: "x" } };
        },
      });
      const reponse = await poserQuestion(A, null, [], "Sors-moi le dernier devis de Bernard");
      assert.equal(reponse.succes, false);
      if (reponse.succes) return;
      assert.ok(!/outil interne|schéma|paramètre/i.test(reponse.erreur), "le message parle technique au patron");
      assert.match(reponse.erreur, /nom du client ou du chantier/i, "il ne dit pas quoi faire");
    } finally {
      _reinitialiserFabriqueLLM(null);
    }
  });

  // --- Ce que seule la capture avait vu -----------------------------------

  await test("JAMAIS de JSON à l'écran — sa capture en montrait deux, accolades comprises", async () => {
    // Le message `{"erreur":"Aucun chantier visé. Employez RechercherChantier…"}`
    // est adressé AU MODÈLE. Recopié à l'écran, il se lit comme une panne.
    for (const question of [
      "Peux tu me sortir le devis de Lucie",
      "Sort moi le dernier devis de Bernard",
      "Quelles sont les prestations ?",
    ]) {
      const reponse = await poserQuestion(A, null, [], question);
      assert.equal(reponse.succes, true, !reponse.succes ? reponse.erreur : "");
      if (!reponse.succes) continue;
      assert.ok(
        !/[{}]|"[a-zA-Z]+":/.test(reponse.texte),
        `du JSON est arrivé à l'écran pour « ${question} » : ${reponse.texte.slice(0, 90)}`
      );
    }
  });

  await test("UN « NON » SE DIT — « pas encore de devis », pas « rien à signaler »", async () => {
    // Vu à la capture : un chantier sans devis rendait « Rien à signaler du côté
    // de LireDevis ». Ce n'est pas rien à signaler — c'est la réponse.
    const reponse = await poserQuestion(A, null, [], "Sort moi le dernier devis de Lucie");
    assert.equal(reponse.succes, true);
    if (!reponse.succes) return;
    assert.ok(!/rien à signaler/i.test(reponse.texte), `il escamote la réponse : ${reponse.texte}`);
  });

  await test("Il va CHERCHER le chantier au lieu de renvoyer le patron l'ouvrir", async () => {
    const reponse = await poserQuestion(A, null, [], "Peux tu me sortir le devis de Lucie");
    assert.equal(reponse.succes, true);
    if (!reponse.succes) return;
    assert.ok(reponse.sources.includes("RechercherChantier"), "il n'a pas cherché le chantier tout seul");
    assert.ok(
      !/ouvrez|ouvrir une fiche|allez sur/i.test(reponse.texte),
      "il renvoie le patron faire le travail à sa place"
    );
  });

  console.log(`\n${passed} test(s) réussi(s), ${failed} échec(s)`);
  await fermerLimiteur();
  await pool.end();
  if (failed > 0) process.exit(1);
}

main();
