import assert from "node:assert";
import { spawn, type ChildProcess } from "node:child_process";
import { writeFileSync, rmSync } from "node:fs";
import { lancerNavigateur } from "./e2e-browser";

/**
 * « Version rapide en construction » : il le voit sur son banc, et nulle part ailleurs.
 *
 * *Le patron, le 14 août 2026 : « La connexion est au ralenti sur l'appli. Les
 * nouvelles pages ne chargent mal ou pas du tout. » Puis : « Surtout la page
 * équipe. »* Retenu sur maquette (`docs/maquettes/46`, proposition A).
 *
 * **Deux affirmations, et la seconde est la plus coûteuse à rater.**
 *
 *   1. Sur son banc, pendant la construction, le bandeau paraît **et porte le
 *      compte** — c'est toute sa raison d'être : distinguer « ça bâtit » de
 *      « c'est en panne » sans ouvrir l'éditeur.
 *   2. **Partout ailleurs, il n'existe pas.** Un bandeau parlant de
 *      construction sur l'écran d'un vrai client détruirait la confiance qu'un
 *      devis est censé porter. Les règles pures le disent déjà
 *      (`test-etat-banc.ts`) ; ce contrôle-ci vérifie que l'ÉCRAN les applique
 *      — c'est exactement l'écart qui a coûté le plus cher dans ce dépôt
 *      (`HANDOVER.md`, piège 13 : « une règle juste que l'écran n'applique pas
 *      ne protège personne »).
 *
 * **Le serveur du banc est monté ici, sur son propre port.** Le profil
 * `ATLAS_PROFIL` est figé à la naissance du processus : aucun réglage, aucune
 * adresse ne peut le changer après coup. Le prouver demandait donc un second
 * serveur — la suite en paie le démarrage plutôt que de se contenter d'affirmer.
 */

const PORT_BANC = 3111;
const BANC = `http://localhost:${PORT_BANC}`;
/** Le serveur du parcours ordinaire, monté par `run-e2e-tests`. */
const ORDINAIRE = "http://localhost:3000";
const FICHIER_ETAT = "/tmp/atlas-prechauffage.json";
/** Son propre dossier de construction — voir plus bas pourquoi il en faut un. */
const DOSSIER_BANC = ".next-banc-essai";

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

const attendre = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function repond(base: string): Promise<boolean> {
  try {
    const r = await fetch(`${base}/api/health/live`, { signal: AbortSignal.timeout(4000) });
    return r.status === 200;
  } catch {
    return false;
  }
}

async function main() {
  // Un avancement en cours, déposé à la main : la suite éprouve l'ÉCRAN, pas le
  // préchauffage — qui a ses propres contrôles (`test-prechauffage.ts`).
  writeFileSync(
    FICHIER_ETAT,
    JSON.stringify({ faits: 12, total: 19, reussis: 12, echoues: 0, encours: "/reglages" })
  );

  let serveur: ChildProcess | null = null;
  try {
    // **`detached`, et tué par son GROUPE.** `npx next dev` est une pile
    // d'enveloppes : le processus qui écoute se renomme `next-server` et survit
    // à la mort de son père. Un orphelin resté sur ce port ferait échouer la
    // prochaine exécution sur un « port déjà pris » sans rapport avec la cause
    // (`scripts/banc.mjs`, et la soirée du 10 août 2026).
    //
    // **Et son propre dossier de construction.** Next.js 16 refuse net un
    // second serveur de développement dans le même dossier — « Another next dev
    // server is already running » — et celui du parcours ordinaire tourne déjà.
    // `ATLAS_DIST_DIR` lui donne le sien (voir `next.config.ts`), ce qui est
    // exactement le mécanisme dont le banc se sert pour servir pendant qu'il
    // bâtit. Constaté en le lançant, pas en le relisant.
    serveur = spawn("npx", ["next", "dev", "-p", String(PORT_BANC)], {
      env: { ...process.env, ATLAS_PROFIL: "banc", ATLAS_DIST_DIR: DOSSIER_BANC },
      stdio: "ignore",
      detached: true,
    });

    const limite = Date.now() + 180_000;
    while (!(await repond(BANC))) {
      if (Date.now() > limite) throw new Error("le serveur de banc n'a jamais répondu");
      await attendre(2000);
    }

    const navigateur = await lancerNavigateur();
    const contexte = await navigateur.newContext();
    const page = await contexte.newPage();

    await test("Sur le banc, l'écran de connexion porte le bandeau et son compte", async () => {
      // **L'écran de connexion, à dessein.** C'est le premier, celui qui compile
      // tout, et le seul où le patron n'a aucun autre repère.
      await page.goto(`${BANC}/login`, { waitUntil: "domcontentloaded", timeout: 180_000 });
      const bandeau = page.locator('[data-atlas="bandeau-banc"]');
      await bandeau.waitFor({ state: "visible", timeout: 30_000 });
      const texte = (await bandeau.textContent()) ?? "";
      assert.ok(/construction/i.test(texte), `le bandeau ne dit pas ce qui se passe : « ${texte} »`);
      assert.ok(
        texte.includes("12 écrans sur 19"),
        `le compte n'y est pas : « ${texte.replace(/\s+/g, " ").trim()} »`
      );
    });

    await test("Il ne recouvre rien : il pousse le contenu, il ne flotte pas dessus", async () => {
      // Trois défauts réels de ce dépôt viennent d'un élément flottant qui
      // cachait un geste. Un bandeau posé par-dessus serait le quatrième.
      const positionne = await page.evaluate(() => {
        const b = document.querySelector('[data-atlas="bandeau-banc"]');
        if (!b) return "absent";
        return getComputedStyle(b).position;
      });
      // **Le message doit désigner le bon coupable.** Il a dit une fois « il
      // flotte au-dessus du contenu » alors que le bandeau n'existait pas du
      // tout : une erreur qui envoie chercher au mauvais endroit coûte plus cher
      // que pas d'erreur (`AGENTS.md`).
      assert.notEqual(positionne, "absent", "le bandeau n'est pas dans la page — voir le cas précédent");
      assert.equal(positionne, "static", `le bandeau est en « ${positionne} » : il flotte au-dessus du contenu`);
    });

    await test("Le compte se rafraîchit tout seul, sans recharger la page", async () => {
      // Une disposition n'est pas refaite à chaque navigation : sans cet appel
      // périodique, le bandeau garderait « 12 sur 19 » jusqu'au rechargement.
      writeFileSync(
        FICHIER_ETAT,
        JSON.stringify({ faits: 17, total: 19, reussis: 17, echoues: 0, encours: "/termines" })
      );
      await page
        .locator('[data-atlas="bandeau-banc"]')
        .filter({ hasText: "17 écrans sur 19" })
        .waitFor({ state: "visible", timeout: 30_000 });
    });

    await test("Quand tout est prêt, le bandeau s'efface de lui-même", async () => {
      // Un bandeau qui reste après la fin du problème apprend à ne plus être lu.
      writeFileSync(FICHIER_ETAT, JSON.stringify({ faits: 19, total: 19, reussis: 19, termine: true }));
      await page
        .locator('[data-atlas="bandeau-banc"]')
        .waitFor({ state: "detached", timeout: 30_000 });
    });

    await test("Hors banc d'essai, l'écran ordinaire ne le montre jamais", async () => {
      writeFileSync(
        FICHIER_ETAT,
        JSON.stringify({ faits: 3, total: 19, reussis: 3, echoues: 0, encours: "/planning" })
      );
      // Le fichier d'avancement dit « en cours » : si l'écran ordinaire montrait
      // quoi que ce soit, ce serait ici.
      await page.goto(`${ORDINAIRE}/login`, { waitUntil: "domcontentloaded", timeout: 120_000 });
      await page.waitForTimeout(1500);
      assert.equal(
        await page.locator('[data-atlas="bandeau-banc"]').count(),
        0,
        "le bandeau du banc apparaît sur un serveur qui n'en est pas un"
      );
    });

    await test("Hors banc, l'adresse d'état ne rend rien du tout", async () => {
      const r = await fetch(`${ORDINAIRE}/api/health/banc/etat`);
      assert.equal(r.status, 200);
      assert.equal(await r.json(), null, "l'adresse d'état parle alors qu'il n'y a pas de banc");
    });

    await contexte.close();
    await navigateur.close();
  } finally {
    if (serveur?.pid) {
      try {
        process.kill(-serveur.pid, "SIGTERM");
      } catch {
        try {
          serveur.kill("SIGTERM");
        } catch {
          // Déjà parti.
        }
      }
    }
    // Ne pas laisser un avancement inventé derrière soi : `/api/health/banc`
    // le lirait et annoncerait un préchauffage qui n'a pas lieu.
    try {
      rmSync(FICHIER_ETAT);
    } catch {
      // Déjà absent.
    }
  }

  console.log(`\n${passed} réussis, ${failed} échoués`);
  if (failed > 0) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
