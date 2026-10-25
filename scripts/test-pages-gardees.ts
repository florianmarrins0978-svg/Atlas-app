// CHAQUE ÉCRAN JOUE SA GARDE DE RÔLE LUI-MÊME, ET EN PREMIER.
//
// **Audit du 25 octobre 2026, E8.** La garde vivait dans le gabarit racine,
// pour qu'aucun écran neuf ne puisse l'oublier. Mais un gabarit partagé ne se
// rejoue pas à la navigation interne : un commercial passé par `/chantiers`
// recevait Ma TVA (`test-garde-des-pages-e2e.ts`). Elle vit donc dans chaque
// page (`src/server/garde-page.ts`), et c'est CE contrôle qui tient l'oubli que
// le gabarit évitait.
//
// **En PREMIER, pas seulement présente** : une garde posée après une lecture a
// déjà laissé partir la requête, et un `redirect` levé après un rendu partiel
// ne retire rien de ce qui a été lu.
//
// **Aucune liste d'exceptions.** Un écran client (`"use client"`) ne peut pas
// appeler la garde ; il n'est admis que s'il s'atteint sans compte
// (`chemins-publics.ts`) ou s'il vit sous `/design`, que son gabarit refuse en
// production. Tout autre écran client rougit : il faut le servir par une page
// serveur qui se garde.

import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import ts from "typescript";
import { estCheminPublic } from "../src/lib/chemins-publics";

const APP = path.join(__dirname, "..", "src", "app");

function pages(dossier: string): string[] {
  return readdirSync(dossier).flatMap((nom) => {
    const chemin = path.join(dossier, nom);
    if (statSync(chemin).isDirectory()) return pages(chemin);
    return nom === "page.tsx" ? [chemin] : [];
  });
}

/** `/chantiers/[id]/devis` pour `src/app/chantiers/[id]/devis/page.tsx` ; les groupes `(x)` s'effacent. */
function adresseDe(fichier: string): string {
  const morceaux = path.relative(APP, path.dirname(fichier)).split(path.sep).filter((m) => m && !/^\(.*\)$/.test(m));
  return "/" + morceaux.join("/");
}

/** La garde est-elle la PREMIÈRE instruction de l'écran exporté par défaut ? */
export function gardeEnPremier(source: string): boolean {
  const sf = ts.createSourceFile("page.tsx", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  for (const n of sf.statements) {
    const parDefaut = ts.isFunctionDeclaration(n) && n.modifiers?.some((m) => m.kind === ts.SyntaxKind.DefaultKeyword);
    if (!parDefaut || !n.body) continue;
    const premiere = n.body.statements[0];
    return !!premiere && /^await garderLaPage\(\);$/.test(premiere.getText(sf).trim());
  }
  return false;
}

let echecs = 0;
function essai(nom: string, fn: () => void) {
  try {
    fn();
    console.log(`  ✓ ${nom}`);
  } catch (e) {
    echecs++;
    console.log(`  ✗ ${nom}\n    ${(e as Error).message}`);
  }
}

console.log("=== Chaque écran joue sa garde de rôle, en premier ===\n");

const toutes = pages(APP);

essai("des écrans ont été trouvés (sinon rien n'est mesuré)", () => {
  assert.ok(toutes.length > 50, `seulement ${toutes.length} écran(s) trouvé(s) : le parcours ne voit pas src/app`);
});

essai("le contrôle sait rougir : une garde absente, ou posée après une lecture", () => {
  assert.equal(gardeEnPremier(`export default async function P() { const x = await lire(); return x; }`), false);
  assert.equal(gardeEnPremier(`export default async function P() { const x = await lire(); await garderLaPage(); return x; }`), false);
  assert.equal(gardeEnPremier(`export default async function P() { await garderLaPage(); return null; }`), true);
});

essai("chaque écran serveur appelle garderLaPage() en première instruction", () => {
  const nues = toutes
    .filter((f) => !/^\s*["']use client["']/.test(readFileSync(f, "utf8")))
    .filter((f) => !gardeEnPremier(readFileSync(f, "utf8")))
    .map((f) => path.relative(path.join(APP, "..", ".."), f));
  assert.deepEqual(nues, [], `Ces écrans ne posent pas leur garde en premier :\n      ${nues.join("\n      ")}\n    Ajouter \`await garderLaPage();\` en tête (import depuis "@/server/garde-page").`);
});

essai("un écran client ne s'admet que public, ou sous /design (refusé en production)", () => {
  const clients = toutes.filter((f) => /^\s*["']use client["']/.test(readFileSync(f, "utf8")));
  const ouverts = clients
    .map(adresseDe)
    .filter((a) => !estCheminPublic(a) && !a.startsWith("/design/"));
  assert.deepEqual(ouverts, [], `Ces écrans clients ne peuvent pas se garder : ${ouverts.join(", ")}. Les servir par une page serveur qui appelle garderLaPage().`);
});

essai("le gabarit /design refuse bien la production (sinon l'exception ne vaut rien)", () => {
  const gabarit = readFileSync(path.join(APP, "design", "layout.tsx"), "utf8");
  assert.match(gabarit, /notFound\(\)/);
});

console.log(`\nLes écrans et leur garde — ${echecs} échec(s).`);
process.exit(echecs > 0 ? 1 : 0);
