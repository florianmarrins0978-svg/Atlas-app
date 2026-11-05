// LES MAQUETTES `/design/*` N'EXISTENT PAS EN PRODUCTION — constat F12.
//
// ═══════════════════════════════════════════════════════════════════════════
// **CE QUE CETTE SUITE PROUVE, ET COMMENT.**
//
// Elle ne relit pas le fichier : elle APPELLE la mise en page, une fois avec
// `NODE_ENV=production`, une fois sans. Un contrôle qui chercherait la chaîne
// « notFound » dans la source passerait au vert sur un `notFound` commenté.
//
// **Les deux moitiés comptent autant l'une que l'autre.** Refuser partout est
// facile ; ce qui est difficile, c'est de refuser en production SANS casser
// `next dev` — donc les captures d'écran (`scripts/screenshot-*.mjs`) et la
// batterie navigateur, qui démarre son serveur en mode développement.
//
// **Et la troisième, structurelle :** aucune page de `src/app/design/` ne doit
// pouvoir échapper à cette mise en page. Une sous-mise-en-page glissée entre
// les deux ne la contournerait pas (Next les emboîte), mais un écran de
// maquette posé AILLEURS que sous `src/app/design/`, si. C'est le contrôle qui
// parlera dans six mois, quand la treizième planche sera écrite.
// ═══════════════════════════════════════════════════════════════════════════

import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

const SONDE = "--sonde";

let echecs = 0;
function essai(nom: string, fn: () => void) {
  try {
    fn();
    console.log(`  ✓ ${nom}`);
  } catch (e) {
    echecs++;
    console.log(`  ✗ ${nom}`);
    console.log(`    ${(e as Error).message}`);
  }
}

const DOSSIER_DESIGN = join(__dirname, "..", "src", "app", "design");

/**
 * Joue la mise en page sous un `NODE_ENV` donné, et dit si elle a refusé.
 *
 * **Chaque verdict se rend dans SON processus.** La première version importait
 * le module avec un suffixe (`layout?production`) pour déjouer le cache : sous
 * tsx 4.23, un import suffixé ne transforme plus le `.tsx` et rend un module
 * vide, si bien que `mod.default` n'était plus une fonction et la suite rougit
 * sur une mise en page juste, depuis la CI de `main`. Un processus neuf n'a
 * aucun cache à déjouer, et il lit `NODE_ENV` au démarrage, comme le serveur :
 * une règle hissée hors de la fonction y serait jugée comme en production.
 */
function refuse(nodeEnv: string): boolean {
  const r = spawnSync(process.execPath, [...process.execArgv, __filename, SONDE], {
    env: { ...process.env, NODE_ENV: nodeEnv },
    encoding: "utf8",
  });
  const verdict = (r.stdout ?? "").trim().split("\n").pop() ?? "";
  if (verdict === "REFUSEE") return true;
  if (verdict === "SERVIE") return false;
  // Ni l'un ni l'autre : un import cassé, une erreur quelconque. Elle ne doit
  // pas passer pour un refus, sans quoi la suite serait verte sur un fichier
  // en ruine.
  throw new Error(
    `la mise en page n'a rendu aucun verdict sous NODE_ENV=${nodeEnv} : ${verdict || r.stderr || "rien"}`
  );
}

/** Le côté sonde : appelle la mise en page une fois, et dit ce qu'elle a fait. */
async function sonder() {
  try {
    const mod = (await import("../src/app/design/layout")) as {
      default: (p: { children: unknown }) => unknown;
    };
    mod.default({ children: null });
    console.log("SERVIE");
  } catch (e) {
    // `notFound()` lève une erreur repérée par son `digest` — c'est ainsi que
    // Next.js la distingue d'une vraie panne. On exige CE motif.
    const digest = String((e as { digest?: string }).digest ?? "");
    console.log(
      digest.startsWith("NEXT_HTTP_ERROR_FALLBACK") || digest.startsWith("NEXT_NOT_FOUND")
        ? "REFUSEE"
        : `AUTRE ${(e as Error).message}`
    );
  }
}

async function main() {
  console.log("Maquettes /design : servies en développement, absentes en production");

  const enProduction = refuse("production");
  essai("EN PRODUCTION : la page n'existe pas", () => {
    assert.ok(
      enProduction,
      "les maquettes gelées sont servies aux artisans : c'est la surface que F12 retire"
    );
  });

  const enDeveloppement = refuse("development");
  essai("EN DÉVELOPPEMENT : elle est servie — les captures d'écran vivent", () => {
    assert.equal(
      enDeveloppement,
      false,
      "la garde refuse aussi en développement : elle casserait scripts/screenshot-*.mjs et la batterie navigateur"
    );
  });

  essai("la mise en page couvre TOUTES les planches, sans exception", () => {
    const planches = readdirSync(DOSSIER_DESIGN, { withFileTypes: true })
      .filter((e) => e.isDirectory())
      .map((e) => e.name);
    // Une liste vide rendrait ce contrôle vert sans rien éprouver.
    assert.ok(planches.length >= 10, `seulement ${planches.length} planches trouvées`);
    for (const planche of planches) {
      const fichiers = readdirSync(join(DOSSIER_DESIGN, planche));
      assert.ok(
        fichiers.includes("page.tsx"),
        `design/${planche} n'a pas de page.tsx : la liste est-elle encore juste ?`
      );
    }
    // La mise en page est à la racine du dossier : Next l'emboîte donc
    // au-dessus de chacune, quoi qu'elles contiennent.
    const racine = readdirSync(DOSSIER_DESIGN);
    assert.ok(racine.includes("layout.tsx"), "la mise en page a disparu : plus rien ne garde les planches");
  });

  essai("aucune planche de maquette n'a été posée HORS de src/app/design", () => {
    // `mock-data.ts` est la marque : c'est le jeu inventé que seules les
    // maquettes emploient. Un écran du produit qui s'en servirait serait un
    // écran qui montre un chantier qui n'existe pas — un défaut en soi.
    const racineApp = join(__dirname, "..", "src", "app");
    const fautifs: string[] = [];
    const parcourir = (dossier: string) => {
      for (const entree of readdirSync(dossier, { withFileTypes: true })) {
        const chemin = join(dossier, entree.name);
        if (entree.isDirectory()) {
          if (chemin === DOSSIER_DESIGN) continue;
          parcourir(chemin);
        } else if (entree.name.endsWith(".tsx")) {
          if (readFileSync(chemin, "utf8").includes("@/lib/mock-data")) {
            fautifs.push(chemin.slice(racineApp.length + 1));
          }
        }
      }
    };
    parcourir(racineApp);
    assert.deepEqual(
      fautifs,
      [],
      "ces écrans montrent des données inventées et ne sont pas couverts par la garde des maquettes"
    );
  });

  console.log(`\n${echecs === 0 ? "✅" : "❌"} Maquettes hors production — ${echecs} échec(s).`);
  process.exit(echecs === 0 ? 0 : 1);
}

(process.argv.includes(SONDE) ? sonder() : main()).catch((e) => {
  console.error(e);
  process.exit(1);
});
