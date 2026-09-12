import assert from "node:assert/strict";
import { fileDEcritures } from "../src/lib/file-d-ecritures";

/**
 * DEUX ÉCRITURES DE LA MÊME DONNÉE NE SE DOUBLENT PAS.
 *
 * **Le défaut, mesuré le 11 septembre 2026 :** effacer le prix accordé au
 * client puis le reposer aussitôt laissait la base à `null` une fois sur trois
 * — deux écritures parties ensemble, dont l'ordre d'arrivée dépendait du
 * réseau. `test-reduction-devis-e2e.ts` le rendait visible ; il fallait aussi
 * l'éprouver ICI, sans navigateur, pour que la règle tienne toute seule.
 *
 * **La règle est PURE, et c'est ce qui la rend éprouvable ici** : monter un
 * rendu React pour mesurer une mise en file aurait mesuré React. Le hook qui la
 * tient pour un composant (`useEcrituresALaSuite`) n'est qu'un support — et sa
 * première version, qui portait la règle, ne pouvait pas être jouée hors d'un
 * écran.
 */

let reussis = 0;
let echecs = 0;
async function essai(nom: string, fn: () => Promise<void>) {
  try {
    await fn();
    console.log(`  ✓ ${nom}`);
    reussis++;
  } catch (err) {
    console.error(`  ✗ ${nom}`);
    console.error(`    ${err instanceof Error ? err.message : err}`);
    echecs++;
  }
}

const attendre = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function main() {
  console.log("=== Les écritures d'une même donnée se suivent ===\n");

  await essai("la LENTE partie en premier finit avant la rapide", async () => {
    const aLaSuite = fileDEcritures();
    const arrivees: string[] = [];
    const lente = aLaSuite(async () => {
      await attendre(60);
      arrivees.push("null");
    });
    const rapide = aLaSuite(async () => {
      await attendre(1);
      arrivees.push("5 %");
    });
    await Promise.all([lente, rapide]);
    // **C'est exactement le défaut** : sans file, « null » arrivait APRÈS
    // « 5 % » et effaçait la remise que le patron venait de reposer.
    assert.deepEqual(arrivees, ["null", "5 %"], "le dernier geste n'a pas le dernier mot");
  });

  await essai("le TÉMOIN — sans file, la lente double la rapide", async () => {
    // Un contrôle qui n'a jamais échoué ne prouve rien (`AGENTS.md`) : voilà ce
    // que faisait le code d'avant, avec les mêmes durées.
    const arrivees: string[] = [];
    const lente = (async () => {
      await attendre(60);
      arrivees.push("null");
    })();
    const rapide = (async () => {
      await attendre(1);
      arrivees.push("5 %");
    })();
    await Promise.all([lente, rapide]);
    assert.deepEqual(arrivees, ["5 %", "null"], "le décor du témoin ne reproduit plus le défaut");
  });

  await essai("un refus ne bloque pas les écritures suivantes", async () => {
    const aLaSuite = fileDEcritures();
    const tombee = aLaSuite(async () => {
      throw new Error("le serveur a refusé");
    });
    await assert.rejects(tombee, /refusé/, "l'appelant ne voit plus son propre refus");

    const apres = await aLaSuite(async () => "5 %");
    assert.equal(apres, "5 %", "une écriture refusée a bloqué la file");
  });

  await essai("trois gestes rapides gardent leur ordre", async () => {
    const aLaSuite = fileDEcritures();
    const arrivees: number[] = [];
    const tous = [30, 20, 10].map((duree, i) =>
      aLaSuite(async () => {
        await attendre(duree);
        arrivees.push(i);
      })
    );
    await Promise.all(tous);
    assert.deepEqual(arrivees, [0, 1, 2]);
  });

  console.log(`\n${reussis} réussi(s), ${echecs} échec(s)`);
  if (echecs > 0) process.exit(1);
}

main();
