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

/** Joue la mise en page sous un `NODE_ENV` donné, et dit si elle a refusé. */
async function refuse(nodeEnv: string): Promise<boolean> {
  const avant = process.env.NODE_ENV;
  // `NODE_ENV` est en lecture seule dans les types de Node : on passe par
  // l'objet, comme le font déjà les suites qui manipulent `AUTH_TEST_*`.
  (process.env as Record<string, string>).NODE_ENV = nodeEnv;
  try {
    // Import à chaud à chaque appel : le module lit `NODE_ENV` à l'exécution,
    // mais un cache de module figerait tout de même le premier verdict si la
    // règle venait à être hissée hors de la fonction.
    const chemin = `../src/app/design/layout?${nodeEnv}`;
    const mod = (await import(chemin)) as { default: (p: { children: unknown }) => unknown };
    mod.default({ children: null });
    return false;
  } catch (e) {
    // `notFound()` lève une erreur repérée par son `digest` — c'est ainsi que
    // Next.js la distingue d'une vraie panne. On exige CE motif : une erreur
    // quelconque (un import cassé, par exemple) ne doit pas passer pour un
    // refus, sans quoi la suite serait verte sur un fichier en ruine.
    const digest = (e as { digest?: string }).digest ?? "";
    assert.ok(
      String(digest).startsWith("NEXT_HTTP_ERROR_FALLBACK") || String(digest).startsWith("NEXT_NOT_FOUND"),
      `la mise en page a levé autre chose qu'un « page introuvable » : ${(e as Error).message}`
    );
    return true;
  } finally {
    (process.env as Record<string, string>).NODE_ENV = avant ?? "test";
  }
}

async function main() {
  console.log("Maquettes /design : servies en développement, absentes en production");

  const enProduction = await refuse("production");
  essai("EN PRODUCTION : la page n'existe pas", () => {
    assert.ok(
      enProduction,
      "les maquettes gelées sont servies aux artisans : c'est la surface que F12 retire"
    );
  });

  const enDeveloppement = await refuse("development");
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

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
