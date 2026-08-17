import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync, rmSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

// **« L'appli est vraiment très lente, mais vraiment. »** — le patron, le
// 16 août 2026 au soir.
//
// Sa fiche disait, comme toujours : « aucune version bâtie — le banc sert le
// mode développement ». C'était vrai. C'était aussi inutile, parce que cette
// phrase recouvrait TROIS états qui n'appellent pas du tout la même chose :
//
//   1. la construction tourne encore    → il suffit d'attendre deux minutes ;
//   2. elle a ÉCHOUÉ                    → le banc compilera chaque écran à
//      l'ouverture, POUR TOUJOURS, et rien ne se réparera tout seul ;
//   3. elle n'a jamais été lancée       → il manque un démarrage.
//
// Seul le deuxième explique « très lente ». Le message d'échec existait
// pourtant — il partait dans `/tmp/essai.log`, que personne ne lit et auquel
// l'agent n'a pas accès. Une soirée est passée à chercher un défaut de produit
// devant une machine qui connaissait la réponse.
//
// Ce que cette suite tient :
//
//   1. les trois états rendent trois phrases DIFFÉRENTES ;
//   2. l'échec nomme la lenteur et dit qu'elle ne se corrige pas seule — un
//      diagnostic qui décrit sans conclure se relit sans agir ;
//   3. le relevé du disque et de la mémoire est publié, parce que ce sont les
//      deux suspects d'une construction qui tombe sur une petite machine ;
//   4. **un échec ne survit pas à une réussite** — sans quoi la fiche
//      accuserait éternellement une construction déjà réparée.

const DIAGNOSTIC = path.join(__dirname, "diagnostiquer-espace.mjs");

let echecs = 0;
function verifier(intitule: string, fn: () => void) {
  try {
    fn();
    console.log(`✅ ${intitule}`);
  } catch (err) {
    echecs++;
    console.error(`❌ ${intitule}`);
    console.error(`   ${(err as Error).message}`);
  }
}

const dossier = mkdtempSync(path.join(tmpdir(), "atlas-lent-"));
const TEMOIN_ECHEC = path.join(dossier, "echec.txt");
// **Le témoin de version bâtie est détourné lui aussi, et il a fallu quatre
// rouges pour le comprendre.** La dernière étape de la batterie lance un vrai
// banc, qui bâtit et écrit `.next-batie/atlas-version-batie.txt` avec le commit
// courant. La suite lisait ce reste et voyait « Code SERVI : <commit> » là où
// elle attendait « en cours » — quatre cas rouges, aucun défaut de produit.
const TEMOIN_BATI = path.join(dossier, "version-batie.txt");

/**
 * Joue le diagnostic et rend sa sortie.
 *
 * **Il sort en erreur dès qu'il a trouvé un souci — et c'est voulu.** Sur cette
 * machine il en trouve toujours (pas de serveur sur le port 3000). On lit donc
 * ce qu'il ÉCRIT, jamais son code de sortie : c'est son texte qui est le
 * produit, et c'est ce texte que l'agent lira sur la fiche.
 */
function diagnostiquer(): string {
  try {
    return execFileSync("node", [DIAGNOSTIC], {
      encoding: "utf8",
      env: { ...process.env, ATLAS_TEMOIN_ECHEC: TEMOIN_ECHEC, ATLAS_TEMOIN_BATI: TEMOIN_BATI },
      stdio: ["ignore", "pipe", "ignore"],
    });
  } catch (err) {
    const sortie = (err as { stdout?: string }).stdout;
    assert.ok(sortie, "le diagnostic est mort sans rien écrire — il n'a plus aucune valeur");
    return sortie;
  }
}

function ligneCodeServi(sortie: string): string {
  const l = sortie.split("\n").find((x) => x.includes("Code SERVI"));
  assert.ok(l, "le diagnostic ne montre plus de ligne « Code SERVI »");
  return l;
}

// ── 1. Rien : ni version bâtie, ni échec ────────────────────────────────────
const sansRien = diagnostiquer();

verifier("sans version bâtie ni échec : on dit que c'est peut-être en cours", () => {
  const l = ligneCodeServi(sansRien);
  assert.match(l, /en cours, ou pas encore lanc/i);
  assert.doesNotMatch(l, /ÉCHOU/, "rien ne permet d'affirmer un échec à ce stade");
});

verifier("le disque et la mémoire sont publiés à chaque fois", () => {
  // Publiés TOUJOURS, et pas seulement en cas d'échec : quand la fiche est
  // enfin lue, la tentative est finie depuis longtemps et la mémoire est rendue.
  assert.match(sansRien, /Disque libre\s+:/);
  assert.match(sansRien, /Mémoire\s+:/);
});

// ── 2. La construction a échoué ─────────────────────────────────────────────
writeFileSync(
  TEMOIN_ECHEC,
  "quand: 2026-08-16T18:20:00.000Z\ncode: 1\ndisque: Avail | 0\nmemoire: Mem: 8G 7,9G 40M\n"
);
const apresEchec = diagnostiquer();

verifier("après un échec : la ligne le DIT, et dit que ça ne se répare pas seul", () => {
  const l = ligneCodeServi(apresEchec);
  assert.match(l, /ÉCHOU/);
  assert.match(l, /LENT/);
  assert.match(l, /2026-08-16T18:20/, "sans la date, on ne sait pas si l'échec est celui d'aujourd'hui");
});

verifier("l'échec devient un souci NOMMÉ, pas une ligne d'état de plus", () => {
  assert.match(apresEchec, /LA CONSTRUCTION A ÉCHOUÉ/);
  assert.match(apresEchec, /très lente/, "le diagnostic doit employer SES mots, sinon il ne se reconnaît pas dedans");
});

verifier("le relevé pris À L'INSTANT de l'échec est republié", () => {
  // Le disque au moment de la panne n'est pas celui d'une heure plus tard :
  // c'est précisément l'écart qui désigne le coupable.
  assert.match(apresEchec, /Au moment de l'échec de construction/);
  assert.match(apresEchec, /disque: Avail \| 0/);
});

verifier("les trois états rendent trois phrases différentes", () => {
  assert.notEqual(ligneCodeServi(sansRien), ligneCodeServi(apresEchec));
});

// ── 3. Une réussite efface l'échec ──────────────────────────────────────────
//
// Éprouvé sur `banc.mjs` lui-même plutôt que réécrit ici : deux implémentations
// de la même règle finissent toujours par diverger.
verifier("banc.mjs efface le témoin d'échec quand la construction réussit", () => {
  const source = execFileSync("node", ["-e", `process.stdout.write(require("fs").readFileSync(${JSON.stringify(path.join(__dirname, "banc.mjs"))}, "utf8"))`], { encoding: "utf8" });
  const bloc = source.slice(source.indexOf("if (code === 0)"), source.indexOf("if (code === 0)") + 600);
  assert.match(
    bloc,
    /rmSync\(TEMOIN_ECHEC/,
    "une construction réussie doit retirer le témoin d'échec, sinon la fiche accuse à tort pour toujours"
  );
});

// ── 4. Le diagnostic ne tombe jamais ────────────────────────────────────────
verifier("un témoin illisible ne fait pas tomber le diagnostic", () => {
  // Un fichier tronqué, sans la ligne « quand » : le cas d'une machine tuée en
  // pleine écriture. Le diagnostic doit rester lisible — c'est sa seule raison
  // d'être.
  writeFileSync(TEMOIN_ECHEC, "code: 137");
  const sortie = diagnostiquer();
  assert.match(ligneCodeServi(sortie), /ÉCHOU/);
  assert.match(ligneCodeServi(sortie), /\(\?\)/, "une date absente se dit « ? », elle ne s'invente pas");
});

rmSync(dossier, { recursive: true, force: true });
assert.ok(!existsSync(dossier));

console.log(`\n${echecs === 0 ? "✅" : "❌"} Le banc lent se dit — ${echecs} échec(s).`);
process.exit(echecs === 0 ? 0 : 1);
