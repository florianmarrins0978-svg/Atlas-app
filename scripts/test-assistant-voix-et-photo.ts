// LUI PARLER, ET LUI MONTRER UNE PHOTO.
//
// **Sa demande du 27 août 2026 : « fais la 1 et la 4 ».** La 1 était *lui
// parler* ; la 4, *qu'il regarde une photo*.
//
// **CE QUI S'ÉPROUVE ICI, ET CE QUI NE S'ÉPROUVE PAS.** Ce poste n'a aucune clé
// d'IA (`CLAUDE.md` §1 ter) : la vision d'un VRAI fournisseur ne peut pas être
// jouée ici, et le prétendre serait un vert qui ne mesure rien. On pose donc un
// fournisseur d'essai par la couture prévue (`_reinitialiserFabriqueLLM`), et
// l'on éprouve ce qui nous appartient : le refus propre quand la vision manque,
// la place de la lecture dans la conversation, et le périmètre qui tient.
//
// La chaîne complète avec une vraie photo se vérifie **sur son espace**.

import assert from "node:assert/strict";
import { regarderPhoto } from "../src/server/ai/services/regarder-photo";
import { _reinitialiserFabriqueLLM } from "../src/server/ai/providers/llm/fabrique";
import { getFournisseurTranscription } from "../src/server/ai/providers/transcription/fabrique";
import type { FournisseurLLM } from "../src/server/ai/providers/llm/interface";
import { erreurIA } from "../src/server/ai/errors";

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

/** Un fournisseur d'essai qui SAIT lire une image, et dit ce qu'on lui souffle. */
function fournisseurQuiVoit(texte: string): FournisseurLLM {
  return {
    nom: "essai-vision",
    async genererTexte() {
      return { succes: true, texte: "" };
    },
    async lireImage() {
      return { succes: true, texte };
    },
  };
}

/** Un fournisseur SANS vision — c'est l'état de ce poste, et de `dev`. */
const fournisseurAveugle: FournisseurLLM = {
  nom: "essai-aveugle",
  async genererTexte() {
    return { succes: true, texte: "" };
  },
};

async function main() {
  console.log("=== Lui parler, et lui montrer une photo ===\n");

  await test("SANS VISION, on refuse proprement — et on le DIT", async () => {
    _reinitialiserFabriqueLLM(fournisseurAveugle);
    const r = await regarderPhoto("AAAA", "image/jpeg");
    assert.equal(r.ok, false);
    if (r.ok) return;
    // **Un refus qui parle du produit, jamais du fournisseur.** « lireImage
    // n'existe pas » enverrait chercher au mauvais endroit.
    assert.match(r.raison, /photo/i);
    assert.doesNotMatch(r.raison, /lireImage|fournisseur|undefined/i);
  });

  await test("AVEC vision, la lecture revient telle quelle", async () => {
    _reinitialiserFabriqueLLM(fournisseurQuiVoit("Devis Aqua Plus — Taille de haie 12 ml à 18 €/ml"));
    const r = await regarderPhoto("AAAA", "image/jpeg");
    assert.equal(r.ok, true);
    if (!r.ok) return;
    // Les CHIFFRES doivent survivre : c'est tout l'intérêt d'une photo de devis.
    assert.match(r.lecture, /12 ml/);
    assert.match(r.lecture, /18 €\/ml/);
  });

  await test("Une lecture VIDE n'est pas un succès", async () => {
    // **Une mesure impossible n'est pas une réussite** (`CLAUDE.md` §5). Rendre
    // « ok » sur une chaîne vide ferait poser une observation muette dans la
    // conversation, et le modèle répondrait à propos d'une photo qu'il n'a pas.
    _reinitialiserFabriqueLLM(fournisseurQuiVoit("   \n  "));
    const r = await regarderPhoto("AAAA", "image/jpeg");
    assert.equal(r.ok, false);
  });

  await test("Une panne du fournisseur remonte SA raison, pas une phrase générique", async () => {
    _reinitialiserFabriqueLLM({
      nom: "essai-panne",
      async genererTexte() {
        return { succes: true, texte: "" };
      },
      async lireImage() {
        return { succes: false, erreur: erreurIA("quota_depasse", "Quota de vision dépassé.") };
      },
    });
    const r = await regarderPhoto("AAAA", "image/jpeg");
    assert.equal(r.ok, false);
    if (r.ok) return;
    // « Clé refusée » et « quota dépassé » ne se réparent pas de la même façon.
    assert.match(r.raison, /Quota/i);
  });

  await test("LA DICTÉE, elle, s'éprouve ICI de bout en bout", async () => {
    // Le fournisseur `dev` transcrit sans réseau ni clé : c'est la seule moitié
    // de ce lot qui soit vérifiable sur ce poste, et il faut le dire.
    const r = await getFournisseurTranscription().transcrire(Buffer.from("des octets"), "audio/webm");
    assert.equal(r.succes, true);
  });

  await test("Un enregistrement VIDE est refusé, jamais transcrit en silence", async () => {
    const r = await getFournisseurTranscription().transcrire(Buffer.alloc(0), "audio/webm");
    assert.equal(r.succes, false);
  });

  _reinitialiserFabriqueLLM(null);
  console.log(`\n${passed} test(s) réussi(s), ${failed} échec(s)`);
  if (failed > 0) process.exit(1);
}

main();
