import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, utimesSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import {
  empreinteDesSources,
  fichiersRemues,
  phraseDuRefus,
  phraseDuVerdictCaduc,
  restesDeBatterie,
  saPropreLignee,
} from "./_batterie-solitaire";

/**
 * LA BATTERIE EST UNE MACHINE À UN SEUL OCCUPANT — les deux garde-fous.
 *
 * **Les lignes de processus ci-dessous sont RELEVÉES**, pas inventées : ce sont
 * celles du soir du 8 septembre 2026, quand un moteur de suites a survécu à
 * l'arrêt de sa batterie et a vidé la base sous la suivante. Un garde-fou
 * éprouvé sur des cas imaginés se trompe précisément le jour où il sert.
 *
 * **Elle sait échouer**, et chaque cas le vérifie dans les deux sens : autant
 * de lignes à LAISSER PASSER que de lignes à refuser. Un garde-fou qui parle à
 * tort s'apprend à être ignoré, et l'on perd alors la protection sans s'en
 * apercevoir (`CLAUDE.md` §1 bis).
 */

let passed = 0;
let failed = 0;
function test(nom: string, fn: () => void) {
  try {
    fn();
    console.log(`✅ ${nom}`);
    passed++;
  } catch (err) {
    console.error(`❌ ${nom}`);
    console.error(`   ${err instanceof Error ? err.message : err}`);
    failed++;
  }
}

// Relevé à `ps -eo pid=,args=` le 8 septembre 2026 à 21:34, pendant la panne.
const CE_SOIR_LA = [
  { pid: 19960, pere: 1, commande: "node /home/user/Atlas-app/node_modules/.bin/tsx scripts/run-e2e-tests.ts" },
  { pid: 21751, pere: 1, commande: "node /home/user/Atlas-app/node_modules/.bin/tsx scripts/verifier-avant-livraison.ts" },
  { pid: 28567, pere: 21751, commande: "sh -c tsx scripts/run-all-tests.ts" },
];

// Ce qui tourne sur cette machine sans être une batterie — à laisser passer.
const INNOCENTS = [
  { pid: 1, pere: 1, commande: "/sbin/init" },
  { pid: 400, pere: 1, commande: "postgres: atlas_app atlas_test [local] idle" },
  { pid: 401, pere: 1, commande: "redis-server *:6379" },
  { pid: 900, pere: 1, commande: "node /home/user/Atlas-app/node_modules/.bin/next dev -p 3007" },
  { pid: 901, pere: 1, commande: "npx tsx scripts/capture-porte.mts /tmp/captures" },
  { pid: 902, pere: 1, commande: "node /home/user/Atlas-app/node_modules/.bin/tsx scripts/test-creation-compte.ts" },
];

test("les restes du soir de la panne sont TOUS vus", () => {
  const vus = restesDeBatterie([...INNOCENTS, ...CE_SOIR_LA]).map((r) => r.pid).sort();
  assert.deepEqual(vus, [19960, 21751, 28567]);
});

test("ce qui n'est pas une batterie passe — y compris une capture ou une suite seule", () => {
  assert.deepEqual(restesDeBatterie(INNOCENTS), []);
});

test("une batterie ne se voit pas ELLE-MÊME", () => {
  // Sans cela elle refuserait de démarrer à tous les coups : le pire des
  // garde-fous, celui qui parle toujours et qu'on apprend à contourner.
  const soi = { pid: 5000, pere: 4999, commande: "node .../tsx scripts/verifier-avant-livraison.ts" };
  const pere = { pid: 4999, pere: 1, commande: "sh -c tsx scripts/verifier-avant-livraison.ts" };
  assert.deepEqual(restesDeBatterie([soi, pere], [5000, 4999]), []);
  // …mais une TROISIÈME, elle, est bien vue.
  assert.equal(restesDeBatterie([soi, pere, CE_SOIR_LA[0]], [5000, 4999]).length, 1);
});

test("le refus NOMME les processus et dit quoi faire", () => {
  const phrase = phraseDuRefus(restesDeBatterie(CE_SOIR_LA));
  for (const pid of [19960, 21751, 28567]) {
    assert.ok(phrase.includes(String(pid)), `le refus ne nomme pas ${pid}`);
  }
  assert.match(phrase, /kill 19960 21751 28567/, "le refus ne donne pas la commande qui débloque");
  // Et il dit l'autre possibilité, sinon on tue la batterie du voisin.
  assert.match(phrase, /autre session/i);
});

test("une batterie n'accuse pas TOUTE SA LIGNÉE — le défaut de la première minute", () => {
  // **Relevé pendant l'essai du garde-fou, le 8 septembre 2026.** Entre le
  // terminal et le `node` qui exécute la batterie, CINQ processus portent son
  // nom. Écarter le père et soi n'en retirait que deux : le refus partait à
  // tous les coups, et plus aucune batterie n'aurait démarré.
  const chaine = [
    { pid: 2878, pere: 2870, commande: "/bin/bash -c ... npx tsx scripts/verifier-avant-livraison.ts" },
    { pid: 2927, pere: 2878, commande: "timeout 60 npx tsx scripts/verifier-avant-livraison.ts" },
    { pid: 2929, pere: 2927, commande: "npm exec tsx scripts/verifier-avant-livraison.ts" },
    { pid: 2941, pere: 2929, commande: "sh -c tsx scripts/verifier-avant-livraison.ts" },
    { pid: 2942, pere: 2941, commande: "node .../tsx scripts/verifier-avant-livraison.ts" },
  ];
  const sienne = saPropreLignee(chaine, 2942);
  // 2870 est le terminal, hors table : la lignée s'y arrête, en l'incluant —
  // c'est ce qu'on veut, il ne faut jamais s'accuser de son propre terminal.
  assert.deepEqual(sienne, [2942, 2941, 2929, 2927, 2878, 2870], "la lignée n'est pas remontée en entier");
  assert.deepEqual(restesDeBatterie(chaine, sienne), [], "elle se dénonce elle-même");

  // Et le vrai reste, lui, est toujours vu au milieu de sa propre lignée.
  const avecUnReste = [...chaine, CE_SOIR_LA[0]];
  assert.deepEqual(
    restesDeBatterie(avecUnReste, saPropreLignee(avecUnReste, 2942)).map((r) => r.pid),
    [19960]
  );
});

test("une table de processus qui ment ne fait pas tourner en rond", () => {
  // Vu sur certains conteneurs : un processus qui se déclare son propre père.
  const menteuse = [{ pid: 7, pere: 7, commande: "sh -c tsx scripts/run-all-tests.ts" }];
  assert.deepEqual(saPropreLignee(menteuse, 7), [7]);
});

// ─── LE SECOND GARDE-FOU : l'arbre a-t-il bougé pendant la mesure ? ─────────

function atelierJetable(): string {
  const racine = mkdtempSync(path.join(tmpdir(), "atlas-empreinte-"));
  mkdirSync(path.join(racine, "src", "lib"), { recursive: true });
  mkdirSync(path.join(racine, "scripts"), { recursive: true });
  writeFileSync(path.join(racine, "src", "lib", "regle.ts"), "export const a = 1;\n");
  writeFileSync(path.join(racine, "scripts", "test-quelque-chose.ts"), "// rien\n");
  writeFileSync(path.join(racine, "src", "lisez-moi.md"), "pas du code\n");
  return racine;
}

test("un arbre qui n'a pas bougé ne dit rien", () => {
  const racine = atelierJetable();
  try {
    const avant = empreinteDesSources(racine);
    assert.ok(avant.size >= 2, `seulement ${avant.size} fichier(s) relevé(s) : la lecture a échoué`);
    assert.deepEqual(fichiersRemues(avant, empreinteDesSources(racine)), []);
  } finally {
    rmSync(racine, { recursive: true, force: true });
  }
});

test("un fichier RÉÉCRIT pendant la mesure est vu", () => {
  const racine = atelierJetable();
  try {
    const avant = empreinteDesSources(racine);
    const touche = path.join(racine, "src", "lib", "regle.ts");
    writeFileSync(touche, "export const a = 2;\n");
    // Les horloges de fichiers ont parfois une seconde de résolution : on pose
    // la date à la main plutôt que d'attendre, et le contrôle reste instantané.
    const plusTard = new Date(Date.now() + 5000);
    utimesSync(touche, plusTard, plusTard);
    assert.deepEqual(fichiersRemues(avant, empreinteDesSources(racine)), ["src/lib/regle.ts"]);
  } finally {
    rmSync(racine, { recursive: true, force: true });
  }
});

test("un fichier AJOUTÉ ou SUPPRIMÉ pendant la mesure est vu aussi", () => {
  const racine = atelierJetable();
  try {
    const avant = empreinteDesSources(racine);
    writeFileSync(path.join(racine, "src", "lib", "neuf.ts"), "export const b = 1;\n");
    rmSync(path.join(racine, "scripts", "test-quelque-chose.ts"));
    assert.deepEqual(fichiersRemues(avant, empreinteDesSources(racine)), [
      "scripts/test-quelque-chose.ts",
      "src/lib/neuf.ts",
    ]);
  } finally {
    rmSync(racine, { recursive: true, force: true });
  }
});

test("ce qui n'est pas du code ne fait pas rougir un verdict", () => {
  // Une note écrite dans un `.md` pendant qu'elle tourne ne change rien à ce
  // qu'elle mesure. La faire rougir dessus, c'est la rendre inutilisable.
  const racine = atelierJetable();
  try {
    const avant = empreinteDesSources(racine);
    writeFileSync(path.join(racine, "src", "lisez-moi.md"), "toujours pas du code\n");
    assert.deepEqual(fichiersRemues(avant, empreinteDesSources(racine)), []);
  } finally {
    rmSync(racine, { recursive: true, force: true });
  }
});

test("le verdict caduc NOMME les fichiers, et compte le reste", () => {
  const phrase = phraseDuVerdictCaduc(["a.ts", "b.ts", "c.ts", "d.ts", "e.ts"]);
  assert.match(phrase, /NE PORTE SUR RIEN/);
  assert.match(phrase, /a\.ts/);
  assert.match(phrase, /2 autre\(s\)/);
});

console.log(`\n${passed} réussis, ${failed} échoués`);
if (failed > 0) process.exit(1);
