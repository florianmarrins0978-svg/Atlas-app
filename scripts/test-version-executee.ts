import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { versionExecutee } from "../src/server/version-executee";
import { _reinitialiserEnvPourTests } from "../src/server/env";

// **L'écran Réglages doit toujours pouvoir répondre à « est-ce que j'ai les
// corrections ? ».**
//
// C'est la seule question que le patron sache poser depuis un téléphone, et
// elle a coûté trois soirées : il essaie des correctifs livrés la veille, ne
// voit rien changer, et conclut que rien n'a été corrigé.
//
// Le 7 août 2026, sur un espace de travail tout neuf, la ligne Version affichait
// « inconnue — cette installation n'annonce pas sa version ». L'écran ne pouvait
// donc plus répondre du tout. La cause : la version venait d'une variable posée
// par le script de démarrage, et une variable est figée à la naissance du
// processus — absente dès que le serveur a démarré autrement, et **périmée**
// après le bouton « Chercher les dernières corrections », qui tire du code neuf
// sans redémarrer.
//
// Cette suite tient les deux : la version vient du DÉPÔT SERVI sur le banc
// d'essai, et la variable ne peut plus la contredire.

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

/** Le commit réellement présent sous le dossier de travail — la vérité. */
const COURT = execFileSync("git", ["log", "-1", "--format=%h"], { encoding: "utf8" }).trim();

async function avec(variables: Record<string, string | undefined>, fn: () => Promise<void>) {
  const avant: Record<string, string | undefined> = {};
  for (const [nom, valeur] of Object.entries(variables)) {
    avant[nom] = process.env[nom];
    if (valeur === undefined) delete process.env[nom];
    else process.env[nom] = valeur;
  }
  _reinitialiserEnvPourTests();
  try {
    await fn();
  } finally {
    for (const [nom, valeur] of Object.entries(avant)) {
      if (valeur === undefined) delete process.env[nom];
      else process.env[nom] = valeur;
    }
    _reinitialiserEnvPourTests();
  }
}

async function main() {
  console.log("=== La version que l'écran affiche ===");

  await cas("sur le banc, sans aucune variable : la version vient quand même", async () => {
    await avec({ ATLAS_BANC_ESSAI: "1", ATLAS_VERSION: undefined, RELEASE_VERSION: undefined }, async () => {
      const v = await versionExecutee();
      assert.ok(
        v,
        "Aucune version : l'écran affiche « inconnue » et ne peut plus dire au patron s'il a les corrections. C'est le défaut du 7 août 2026."
      );
      assert.ok(
        v.includes(COURT),
        `La version affichée « ${v} » ne nomme pas le commit servi (${COURT}) : elle ne permet donc pas de le comparer à ce qui a été livré.`
      );
    });
  });

  // **Le manque qui a coûté la matinée du 12 août 2026.** Le patron regardait un
  // écran de la veille : son espace suivait une autre branche que celle où le
  // travail avait été livré, et la mise à jour répondait « à jour » — en toute
  // honnêteté. Le commit seul ne dit rien : « a1b2c3d » ne prévient personne
  // qu'il vient du mauvais endroit. La branche, si.
  await cas("la branche suivie est affichée, pas seulement le commit", async () => {
    await avec({ ATLAS_BANC_ESSAI: "1", ATLAS_VERSION: undefined, RELEASE_VERSION: undefined }, async () => {
      const v = await versionExecutee();
      const branche = execFileSync("git", ["rev-parse", "--abbrev-ref", "HEAD"], { encoding: "utf8" }).trim();
      assert.ok(
        v?.includes(branche),
        `La version affichée « ${v} » ne nomme pas la branche servie (${branche}). Une capture de l'écran Réglages ne peut donc pas répondre à « suis-je au bon endroit ? » — la question qui a coûté la matinée du 12 août 2026.`
      );
    });
  });

  await cas("une variable périmée ne peut plus contredire le dépôt", async () => {
    // Exactement l'état laissé par « Chercher les dernières corrections » : la
    // variable date du démarrage, le code servi est plus récent.
    await avec({ ATLAS_BANC_ESSAI: "1", ATLAS_VERSION: "01/01/2020 00:00 · 0000000" }, async () => {
      const v = await versionExecutee();
      assert.ok(
        v?.includes(COURT),
        `L'écran annonce « ${v} » alors que le code servi est ${COURT}. Le patron conclurait que le bouton de mise à jour n'a rien fait.`
      );
    });
  });

  await cas("hors banc d'essai, la chaîne de livraison reste seule maîtresse", async () => {
    // Une application déployée n'a pas de dépôt sous la main : y aller chercher
    // une version serait au mieux inutile, au pire une commande lancée sur un
    // serveur de production.
    await avec({ ATLAS_BANC_ESSAI: undefined, ATLAS_VERSION: "v1.4.2" }, async () => {
      assert.equal(await versionExecutee(), "v1.4.2");
    });
  });

  await cas("hors banc et sans rien à annoncer : on le dit, on n'invente pas", async () => {
    await avec({ ATLAS_BANC_ESSAI: undefined, ATLAS_VERSION: undefined, RELEASE_VERSION: undefined }, async () => {
      assert.equal(await versionExecutee(), null);
    });
  });

  await cas("git muet ne fait pas tomber l'écran", async () => {
    // Un conteneur où le dossier appartient à un autre compte, un dépôt absent :
    // la version manque, mais l'écran Réglages s'affiche. Une page de réglages
    // qui plante pour une ligne décorative serait un remède pire que le mal.
    const ancien = process.cwd();
    process.chdir("/tmp");
    try {
      await avec({ ATLAS_BANC_ESSAI: "1", ATLAS_VERSION: "v9.9.9" }, async () => {
        assert.equal(await versionExecutee(), "v9.9.9", "Sans réponse de git, on retombe sur la variable.");
      });
    } finally {
      process.chdir(ancien);
    }
  });

  console.log(`\n${echecs === 0 ? "✅" : "❌"} Version exécutée — ${echecs} échec(s).`);
  if (echecs > 0) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
