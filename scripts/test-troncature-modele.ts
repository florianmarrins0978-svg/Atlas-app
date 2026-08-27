import assert from "node:assert/strict";
import { estJsonTronque } from "../src/lib/json-du-modele";
import { extraire } from "../src/server/ai/services/extraction-service";
import type { FournisseurLLM } from "../src/server/ai/providers/llm/interface";

// **Une réponse coupée n'est pas une réponse.**
//
// Le fournisseur Anthropic borne la génération ; au-delà, l'API coupe en plein
// milieu et le dit (`stop_reason: "max_tokens"`). Cette information arrivait
// jusqu'au fournisseur et y était jetée : une troncature devenait indiscernable
// d'un modèle qui répond à côté, et les deux tombaient dans le même repli
// silencieux. C'est le défaut muet d'`AGENTS.md` — impossible à mesurer, à
// corriger, ou à dire au patron.
//
// **Deux lectures, et il faut les deux.** L'enveloppe fait foi quand elle
// existe ; la forme sert de filet pour les fournisseurs qui ne disent rien.
// Aucune ne demande de clé : tout est joué avec des fournisseurs fabriqués ici.

let reussites = 0;
let echecs = 0;
function cas(nom: string, verifier: () => void): void {
  try {
    verifier();
    console.log(`  ✓ ${nom}`);
    reussites++;
  } catch (e) {
    echecs++;
    console.error(`  ✗ ${nom}\n    ${(e as Error).message}`);
  }
}
async function casAsync(nom: string, verifier: () => Promise<void>): Promise<void> {
  try {
    await verifier();
    console.log(`  ✓ ${nom}`);
    reussites++;
  } catch (e) {
    echecs++;
    console.error(`  ✗ ${nom}\n    ${(e as Error).message}`);
  }
}

console.log("\n=== Reconnaître un JSON coupé, sans rien réparer ===\n");

cas("un objet qui s'ouvre et ne se referme jamais est tronqué", () => {
  assert.equal(estJsonTronque('{"prestations":[{"libelle":"Démontage d\'un ér'), true);
});

cas("un objet complet ne l'est pas, même noyé dans de la prose", () => {
  assert.equal(estJsonTronque('Voici le résultat : {"prestations":[]} — voilà.'), false);
  assert.equal(estJsonTronque('```json\n{"prestations":[]}\n```'), false);
});

cas("un texte qui n'est PAS du JSON n'est pas une troncature", () => {
  // La distinction porte tout : un modèle qui répond à côté et un modèle coupé
  // ne se réparent pas de la même façon.
  assert.equal(estJsonTronque("Je ne peux pas répondre à cette demande."), false);
  assert.equal(estJsonTronque(""), false);
  assert.equal(estJsonTronque(null), false);
});

cas("une accolade DANS une chaîne ne fait pas croire à un objet complet", () => {
  // Compter les accolades ne suffit pas — c'est déjà la raison d'être de
  // `premierObjetEquilibre`, et ce contrôle-ci le tient de ce côté aussi.
  assert.equal(estJsonTronque('{"libelle":"Taille { de haie","quantite":"8'), true);
});

console.log("\n=== Ce que le service fait d'une coupure ===\n");

const DICTEE = "Je taille huit cents mètres de haie et je démonte un érable en rétention.";

function fournisseur(reponse: Partial<{ texte: string; fin: "complet" | "tronque" }>): FournisseurLLM {
  return {
    nom: "fabrique-pour-le-test",
    async genererTexte() {
      return { succes: true as const, texte: reponse.texte ?? "", fin: reponse.fin };
    },
  };
}

async function suite() {
  await casAsync("l'enveloppe du fournisseur suffit, même sur un JSON PARFAIT", async () => {
    // **Le cas que la seule lecture de forme ne verrait pas.** Le modèle a pu
    // être coupé après avoir refermé un objet valide mais incomplet — trois
    // prestations sur cinq. Le JSON se parse, le schéma l'accepte, et deux
    // travaux ont disparu du devis sans un mot.
    const r = await extraire(DICTEE, fournisseur({ texte: '{"prestations":[]}', fin: "tronque" }));
    assert.ok(r.succes);
    assert.equal(r.lecture, "litterale", "une réponse coupée a été acceptée comme une lecture du modèle");
    assert.match(String(r.motifRepli), /tronqu/i);
  });

  await casAsync("une réponse complète est acceptée, elle", async () => {
    // L'autre sens : le filet ne doit pas se déclencher sur ce qui va bien.
    const r = await extraire(
      DICTEE,
      fournisseur({
        texte: '{"prestations":[{"libelle":"Taille de haie","quantite":"800","unite":"ml"}]}',
        fin: "complet",
      })
    );
    assert.ok(r.succes);
    assert.equal(r.lecture, "modele");
    assert.equal(r.motifRepli, undefined);
  });

  await casAsync("un fournisseur MUET sur la fin reste rattrapé par la forme", async () => {
    // Tous ne renseignent pas `stop_reason` : sans ce second filet, la coupure
    // repasserait pour un « JSON illisible ».
    const r = await extraire(DICTEE, fournisseur({ texte: '{"prestations":[{"libelle":"Démont' }));
    assert.ok(r.succes);
    assert.match(String(r.motifRepli), /tronqu/i);
  });

  await casAsync("le repli reste : un écran mort n'est jamais la réponse", async () => {
    // Le défaut du 4 août 2026, et il ne doit pas revenir : le patron dicte, et
    // il obtient un brouillon perfectible plutôt que rien du tout.
    const r = await extraire(DICTEE, fournisseur({ texte: '{"prest', fin: "tronque" }));
    assert.ok(r.succes, "la dictée n'a rien rendu du tout");
    assert.ok(r.proposition.prestations.length > 0, "la dictée n'a même pas été recopiée");
  });

  console.log(`\n${reussites} réussite(s), ${echecs} échec(s).`);
  if (echecs > 0) process.exitCode = 1;
}

suite();
