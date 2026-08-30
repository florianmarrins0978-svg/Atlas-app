// LA DICTÉE, LES RÈGLES ET LES EXEMPLES NE PARTAGENT PAS LE MÊME EMPLACEMENT.
//
// ═══════════════════════════════════════════════════════════════════════════
// **DEUX DÉFAUTS, ET LE SECOND EST LE MIEN** — lot de clôture, 29 août 2026.
//
// 1. Le contenu appris — dictées passées, libellés de devis — entrait dans la
//    CONSIGNE SYSTÈME, la position de plus haute autorité. Un libellé rédigé
//    comme un ordre y devenait une règle, pour toutes les extractions suivantes
//    de l'entreprise. Injection persistante.
//
// 2. **Mon premier correctif l'a préfixé à la DICTÉE**, et trois suites
//    navigateur l'ont attrapé. `lireLitteralement` analyse ce message mot à mot
//    pour en tirer des prestations : il lisait les exemples à la place de ce
//    que l'artisan avait dit. Et ce repli sert AUSSI quand un vrai fournisseur
//    répond à côté — le défaut aurait atteint la production, pas seulement les
//    tests.
//
// D'où trois emplacements DÉCLARÉS, et cette suite les tient :
//
//   systeme   → les RÈGLES, écrites par nous
//   message   → la DONNÉE à traiter — la dictée, et rien d'autre
//   contexte  → les EXEMPLES appris, écrits par des humains
//
// Ni base, ni réseau : un fournisseur d'essai qui note ce qu'il reçoit.

import assert from "node:assert/strict";
import { extraire } from "../src/server/ai/services/extraction-service";
import type { FournisseurLLM, ResultatLLM } from "../src/server/ai/providers/llm/interface";

let echecs = 0;
async function essai(nom: string, fn: () => Promise<void>) {
  try {
    await fn();
    console.log(`  ✓ ${nom}`);
  } catch (e) {
    echecs++;
    console.log(`  ✗ ${nom}`);
    console.log(`    ${(e as Error).message}`);
  }
}

/** Un fournisseur qui ne répond rien, et note ce qu'on lui a donné. */
function mouchard() {
  const vu: { systeme: string; message: string; contexte?: string } = {
    systeme: "",
    message: "",
    contexte: undefined,
  };
  const f: FournisseurLLM = {
    nom: "dev",
    async genererTexte(systeme: string, message: string, contexte?: string): Promise<ResultatLLM> {
      vu.systeme = systeme;
      vu.message = message;
      vu.contexte = contexte;
      // On force le repli : ce qui nous intéresse est ce qui est ENVOYÉ.
      return { succes: false, erreur: { code: "reponse_invalide", message: "essai" } as never };
    },
  };
  return { f, vu };
}

const APPRIS = "- Dicté : « tonte » | Retenu par lui : Tonte du gazon 45 €";

async function main() {
  console.log("=== Les trois emplacements de l'invite ===\n");

  await essai("LA DICTÉE EST SEULE DANS SON EMPLACEMENT — le défaut de mon premier jet", async () => {
    const { f, vu } = mouchard();
    await extraire("élagage du chêne devant la maison", f, APPRIS);
    assert.equal(
      vu.message,
      "élagage du chêne devant la maison",
      "le message ne porte pas exactement la dictée : la lecture littérale lira de travers"
    );
    assert.doesNotMatch(vu.message, /exemples_passes|Retenu par lui/, "les exemples sont mêlés à la dictée");
  });

  await essai("LES EXEMPLES NE SONT PAS DANS LA CONSIGNE SYSTÈME — le défaut d'origine", async () => {
    const { f, vu } = mouchard();
    await extraire("élagage du chêne", f, APPRIS);
    assert.doesNotMatch(
      vu.systeme,
      /Retenu par lui|Tonte du gazon/,
      "du contenu appris est dans la consigne système : il y a l'autorité d'une règle"
    );
  });

  await essai("les exemples voyagent bien, dans leur propre emplacement", async () => {
    // Sans cette moitié, on passerait au vert en ayant simplement CESSÉ
    // d'apprendre — la sécurité par la perte de fonctionnalité.
    const { f, vu } = mouchard();
    await extraire("élagage du chêne", f, APPRIS);
    assert.ok(vu.contexte, "les exemples appris ne sont pas transmis du tout");
    assert.match(vu.contexte!, /Retenu par lui/, "le contexte ne porte pas les exemples");
    assert.match(vu.contexte!, /<exemples_passes>/, "le bloc n'est pas délimité");
  });

  await essai("sans rien d'appris, aucun emplacement de contexte n'est ouvert", async () => {
    const { f, vu } = mouchard();
    await extraire("élagage du chêne", f);
    assert.equal(vu.contexte, undefined, "un bloc vide est envoyé pour rien");
  });

  console.log("");
  console.log(`${echecs === 0 ? "✅" : "❌"} Emplacements de l'invite — ${echecs} échec(s).`);
  process.exit(echecs > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
