import { spawnSync } from "node:child_process";
import path from "node:path";

// **Les dépendances s'installent DEPUIS ZÉRO — 18 novembre 2026.**
//
// Face ID est passé à `@simplewebauthn` 13 (`ARCHITECTURE.md` §583) avec une
// batterie de niveau 3 verte, 217 suites sur 217. Et pourtant `npm ci` refusait
// d'installer `main`, sur une copie propre comme sur son espace :
//
//     ERESOLVE could not resolve
//     peerOptional @simplewebauthn/browser@"^9.0.1" from next-auth@5.0.0-beta.32
//
// **Aucune suite ne pouvait le voir** : la batterie se joue sur un
// `node_modules` DÉJÀ posé, et rien ne réinstalle. Le défaut n'apparaît qu'à
// l'installation suivante, c'est-à-dire chez lui, au prochain allumage de son
// espace (`.devcontainer/demarrer.sh` : `npm ci`, puis `npm install`, tous deux
// refusés), et dans la CI, qui commence par `npm ci`.
//
// Ce contrôle demande à npm de résoudre l'arbre ENTIER depuis `package.json` et
// le verrou, sans rien écrire (`--dry-run`) et sans réseau (`--offline`) : un
// arbre cohérent se résout depuis le verrou seul, en une seconde. C'est la même
// résolution que `npm ci`, donc le même refus.

const RACINE = path.join(__dirname, "..");
const NPM = process.platform === "win32" ? "npm.cmd" : "npm";
const OPTIONS = ["--package-lock-only", "--dry-run", "--ignore-scripts", "--no-audit", "--no-fund"];

function resoudre(horsLigne: boolean) {
  const r = spawnSync(NPM, ["install", ...OPTIONS, ...(horsLigne ? ["--offline"] : [])], {
    cwd: RACINE,
    encoding: "utf8",
    timeout: 120_000,
  });
  const sortie = `${r.stdout ?? ""}\n${r.stderr ?? ""}`;
  const code = /npm error code (\w+)/.exec(sortie)?.[1] ?? null;
  return { status: r.status, sortie, code };
}

let r = resoudre(true);

// **ENOTCACHED n'est pas une panne du cache** : un arbre cohérent n'a rien à
// chercher hors du verrou. Si npm a dû demander au registre, c'est qu'il
// cherchait une version que le verrou ne lui donnait pas, donc un conflit. On
// redemande en ligne pour pouvoir NOMMER ce conflit plutôt qu'accuser le cache.
if (r.status !== 0 && r.code === "ENOTCACHED") {
  const enLigne = resoudre(false);
  if (enLigne.code !== null && enLigne.code !== "ENOTCACHED") r = enLigne;
}

if (r.status === 0) {
  console.log("✅ package.json et le verrou s'installent depuis zéro (npm ci passera)");
  process.exit(0);
}

const conflit = r.sortie
  .split("\n")
  .filter((l) => /peerOptional|peer |Conflicting|Found:|While resolving/.test(l))
  .slice(0, 6)
  .map((l) => `     ${l.replace(/^npm error\s*/, "")}`)
  .join("\n");

console.error(`❌ npm refuse d'installer ce dépôt depuis zéro (${r.code ?? `code ${r.status}`})`);
if (r.code === "ERESOLVE") {
  console.error("   Une dépendance réclame une version qu'une autre ne veut pas :");
  console.error(conflit);
  console.error("   Son espace et la CI ne pourront plus installer. Corriger package.json");
  console.error("   (une montée de version, ou `overrides` si le paquet qui proteste n'emploie");
  console.error("   pas ce qu'il réclame), jamais `--legacy-peer-deps` : il tairait le suivant.");
} else if (r.code === "ENOTCACHED") {
  console.error("   Le verrou ne suffit pas à installer : npm a dû chercher hors de lui, et le");
  console.error("   registre n'est pas joignable d'ici. Jouer `npm install --package-lock-only`");
  console.error("   en ligne pour lire le conflit.");
} else {
  console.error(r.sortie.split("\n").filter((l) => l.startsWith("npm error")).slice(0, 8).join("\n"));
}
process.exit(1);
