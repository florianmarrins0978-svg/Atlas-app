#!/usr/bin/env node
/**
 * LES SUITES NAVIGATEUR, PAR GROUPES — un serveur neuf par groupe.
 *
 * ───────────────────────────────────────────────────────────────────────────
 * **Pourquoi ce script existe, et pourquoi il est COMMITÉ.**
 *
 * La batterie ne tient plus d'une traite dans le conteneur, et cela a été
 * mesuré le 30 août 2026 en échantillonnant `next-server` :
 *
 *   | serveur démarré            | 0,6 Go  |
 *   | les 33 écrans préchauffés  | 8,9 Go  |
 *   | une suite plus tard        | 12,7 Go → abattu par le conteneur |
 *
 * Ce n'est aucune suite en particulier : c'est l'application entière compilée
 * par Turbopack, dont la mémoire vit hors du tas de V8 et que rien ne borne.
 * Le serveur meurt, et les cent seize suites suivantes ne sont pas jouées —
 * un rouge qui n'accuse personne.
 *
 * **Trois sessions ont déjà écrit ce pilote et l'ont jeté** (27, 29 et 30 août),
 * chacune en le redécouvrant. C'est ce qui le fait entrer dans le dépôt : un
 * outil qu'on réécrit trois fois n'est pas un bricolage de circonstance.
 *
 * ── DEUX PIÈGES QU'IL ÉVITE, ET QUI ONT COÛTÉ CHER ─────────────────────────
 *
 * 1. **Un seul amorçage, au premier groupe.** Les suites ne sont pas
 *    indépendantes et ne l'ont jamais été : d'une traite, la base est amorcée
 *    UNE fois puis chacune travaille sur ce que les précédentes ont laissé.
 *    `test-aucun-texte-coupe` cherche un devis encore modifiable, qu'aucun
 *    amorçage ne pose et qu'une suite d'avant a créé. Ré-amorcer entre deux
 *    groupes le lui retire : un rouge **fabriqué par la découpe**.
 *
 * 2. **Un seul pilote à la fois.** Payé le 30 août : un pilote signalé
 *    « échoué » par l'outillage tournait encore ; un second lancé dessus a
 *    partagé le port 3000 et rendu quatorze faux rouges d'affilée. C'est
 *    `CLAUDE.md` §5 à la lettre — la batterie est une machine à un seul
 *    occupant —, et cela vaut aussi pour ce qui la découpe. Ce script refuse
 *    donc de démarrer si quelqu'un écoute déjà.
 *
 * **Il ne remplace pas la batterie.** `npm run verifier:avant-livraison` reste
 * ce qui autorise une livraison ; ce script sert à obtenir le même verdict sur
 * les suites navigateur quand la machine ne les laisse pas tourner d'un bloc.
 *
 *   node scripts/jouer-suites-par-groupes.mjs [journal] [taille-du-groupe]
 */
import { spawn, spawnSync } from "node:child_process";
import { appendFileSync, writeFileSync } from "node:fs";

const JOURNAL = process.argv[2] ?? "/tmp/atlas-groupes.log";
const PAR_GROUPE = Number(process.argv[3] ?? 6);

// **Le port d'abord.** Un serveur déjà là, et tout ce qui suit ne veut rien
// dire : les suites interrogeraient le code de quelqu'un d'autre.
const occupe = spawnSync("bash", ["-c", "ss -ltn 2>/dev/null | grep -q ':3000 '"], {});
if (occupe.status === 0) {
  console.error(
    "❌ Quelque chose écoute déjà sur le port 3000.\n" +
      "   Refus de démarrer : deux pilotes qui se partagent le port rendent des faux rouges.\n" +
      "     ps aux | grep 'test:e2e'   puis   pkill -f 'next dev'"
  );
  process.exit(1);
}

writeFileSync(JOURNAL, "");

const liste = spawnSync("npx", ["tsx", "scripts/run-e2e-tests.ts", "--list"], {
  encoding: "utf8",
  env: process.env,
});
const suites = liste.stdout
  .split("\n")
  .map((l) => l.trim())
  .filter((l) => l.startsWith("test-") && l.endsWith(".ts"));

// **Une mesure impossible n'est pas un succès** (`CLAUDE.md` §5) : sans liste,
// ce script rendrait « 0/0, tout va bien ».
if (suites.length < 100) {
  console.error(`❌ Seulement ${suites.length} suites listées — le pilote refuse de conclure.`);
  process.exit(1);
}
console.log(`${suites.length} suites, par groupes de ${PAR_GROUPE}. Journal : ${JOURNAL}`);

const groupes = [];
for (let i = 0; i < suites.length; i += PAR_GROUPE) groupes.push(suites.slice(i, i + PAR_GROUPE));

const bilan = [];
let joues = 0;
let reussis = 0;
for (const [rang, groupe] of groupes.entries()) {
  process.stdout.write(`\n──── groupe ${rang + 1}/${groupes.length} (${groupe.length}) ────\n`);
  const args = ["run", "test:e2e", "--", "--seulement", groupe.join(",")];
  if (rang > 0) args.push("--sans-seed");
  const sortie = await new Promise((ok) => {
    let texte = "";
    const p = spawn("npm", args, { stdio: ["ignore", "pipe", "pipe"], env: process.env });
    const ecrire = (d) => {
      texte += d;
      appendFileSync(JOURNAL, d);
    };
    p.stdout.on("data", ecrire);
    p.stderr.on("data", ecrire);
    p.on("close", (code) => ok({ code, texte }));
  });
  const compte = /(\d+)\/(\d+) suites réussies/.exec(sortie.texte);
  if (compte) {
    reussis += Number(compte[1]);
    joues += Number(compte[2]);
  }
  const ligne =
    `groupe ${rang + 1} → ${sortie.code === 0 ? "OK" : "ÉCHEC"} ` +
    (compte ? compte[0] : "(compte illisible — le serveur est peut-être mort)");
  bilan.push(ligne);
  process.stdout.write(ligne + "\n");
}

console.log(`\n=== BILAN ===\n${bilan.join("\n")}`);
console.log(`\nTOTAL : ${reussis}/${joues} suites réussies, sur ${suites.length} découvertes.`);

// **Ce qui n'a pas été JOUÉ est un échec, pas un silence.** Un groupe dont le
// serveur est mort ne rend aucun compte : sans cette dernière comparaison, le
// total tomberait juste sur les groupes survivants.
if (joues !== suites.length) {
  console.error(`❌ ${suites.length - joues} suite(s) n'ont pas été jouées du tout.`);
}
process.exit(reussis === suites.length ? 0 : 1);
