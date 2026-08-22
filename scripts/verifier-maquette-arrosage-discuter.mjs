/*
  DISCUTER LE PLAN — ce que cette maquette doit tenir.

  Sa demande du 21 août 2026 : *« si l'utilisateur a besoin de te demander une
  modification, qu'il puisse le faire — une petite interface pour discuter avec
  toi »*, avec ses exemples : « j'aurais préféré des 3500 », « pourquoi trois
  réseaux ? », « est-il possible de mettre de la VAN 15 ? ».

  CE QUE CE CONTRÔLE TIENT, ET C'EST UNE SEULE CHOSE :

  **Atlas ne dessine pas le plan, il pose un paramètre.** Toute valeur citée
  dans une réponse doit exister au catalogue. C'est la leçon de la journée :
  laissé libre, il a inventé « 5004 buse 3.0, portée 6 m » — qui n'existe pas —
  et le maillage entier en dépendait. Une conversation rend cette dérive plus
  facile, pas moins : on écrit une phrase plausible et personne ne la recompte.

  Il vérifie donc que **les portées et les débits cités sont ceux du catalogue**,
  au chiffre près, et qu'une demande change VRAIMENT le plan.

  Usage : node scripts/verifier-maquette-arrosage-discuter.mjs [chemin.html]
*/
import { chromium } from "playwright";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { existsSync, readFileSync } from "node:fs";

const RACINE = join(dirname(fileURLToPath(import.meta.url)), "..");
const CHEMIN = resolve(process.argv[2] ?? join(RACINE, "appli/arrosage-discuter.html"));
if (!existsSync(CHEMIN)) {
  console.error(`❌ Maquette introuvable : ${CHEMIN}`);
  process.exit(1);
}

let echecs = 0;
const cas = (nom, fn) => {
  try {
    fn();
    console.log(`  ✓ ${nom}`);
  } catch (e) {
    echecs++;
    console.error(`  ✗ ${nom}\n    ${e.message}`);
  }
};

const SANDBOX = "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
const nav = await chromium.launch(existsSync(SANDBOX) ? { executablePath: SANDBOX } : {});
const page = await (await nav.newContext({ viewport: { width: 390, height: 900 } })).newPage();
await page.goto(`file://${CHEMIN}`, { waitUntil: "load" });

console.log("\n=== Discuter le plan d'arrosage ===\n");

const source = readFileSync(CHEMIN, "utf8");
cas("aucun JavaScript : la page marche hors ligne, sur son téléphone", () => {
  if (/<script|onclick=|onchange=/i.test(source)) throw new Error("du script s'est glissé dans la maquette");
});

// ── Les valeurs citées sont CELLES DU CATALOGUE ─────────────────────────────
const catalogue = readFileSync(join(RACINE, "appli/arrosage-catalogue.js"), "utf8");
// **`textContent`, pas `innerText` — et c'est l'inverse du piège d'hier.** Un
// seul fil d'échange est affiché à la fois ; `innerText` ne rendrait que
// celui-là, et le contrôle accuserait la maquette de ne pas dire ce qu'elle dit
// dans les trois autres. Ici on veut TOUT le contenu, visible ou non.
const texte = await page.evaluate(() =>
  [...document.querySelectorAll(".fil")].map((f) => f.textContent).join(" ")
);

cas("AUCUNE portée citée n'est absente du catalogue", () => {
  // **Le contrôle qui aurait attrapé le défaut du jour.** Une première version
  // vérifiait qu'une BONNE valeur est présente — ce qui laisse passer une valeur
  // FAUSSE citée à côté. C'est exactement ainsi que « 5004 buse 3.0, portée
  // 6 m » a survécu : la page contenait d'autres chiffres justes.
  //
  // On prend donc le problème par l'autre bout : **toute portée écrite dans la
  // conversation doit se retrouver en `rayon:` au catalogue.** Aucune ne peut
  // être inventée, même plausible.
  const rayons = new Set([...catalogue.matchAll(/rayon:\s*([\d.]+)/g)].map((m) => m[1].replace(/0+$/, "").replace(/\.$/, "")));
  // Le « m » de « m³/h » n'est pas un mètre : sans cette précaution, le contrôle
  // prend un débit pour une portée et accuse un chiffre juste.
  const citees = [...texte.matchAll(/(\d+,\d+)\s*m(?![³²\w])/g)].map((m) => m[1].replace(",", "."));
  if (citees.length === 0) throw new Error("la conversation ne cite aucune portée : on ne sait pas ce qui est posé");
  for (const c of citees) {
    const propre = c.replace(/0+$/, "").replace(/\.$/, "");
    if (!rayons.has(propre)) {
      throw new Error(`« ${c.replace(".", ",")} m » est annoncé et n'existe nulle part au catalogue — une portée inventée fausse tout le maillage`);
    }
  }
});

cas("les débits cités existent au catalogue", () => {
  for (const [quoi, valeur] of [["3504 buse 0,75", "0.16"], ["5004 buse 1,0", "0.22"]]) {
    if (!new RegExp(`360:\\s*${valeur}\\b`).test(catalogue)) {
      throw new Error(`la maquette parle de ${quoi} à ${valeur} m³/h — introuvable au catalogue`);
    }
  }
  // Et les totaux annoncés se recomposent : 9 × 0,16 = 1,44 ; 2 bords + 2 coins.
  if (!texte.includes("1,44")) throw new Error("le débit des turbines (9 × 0,16 = 1,44) n'est pas annoncé");
  if (!texte.includes("1,80")) throw new Error("le débit du compteur n'est jamais rappelé : la contrainte devient invisible");
});

// ── Une demande change VRAIMENT le plan ─────────────────────────────────────
const rayonTuyeres = async () =>
  page.evaluate(() => {
    const g = [...document.querySelectorAll("g")].find((x) => getComputedStyle(x).display !== "none" && x.className.baseVal.startsWith("tuy"));
    return Number(g?.querySelector("circle")?.getAttribute("r"));
  });

cas("demander la 15-VAN redessine le plan, pas seulement le texte", async () => {});
const avant = await rayonTuyeres();
await page.click("label[for=q2]");
await page.waitForTimeout(200);
const apres = await rayonTuyeres();
cas("la portée dessinée passe de 3,6 à 4,5 m", () => {
  if (avant !== 3.6) throw new Error(`le plan part avec des tuyères à ${avant} m au lieu de 3,6`);
  if (apres !== 4.5) throw new Error(`après la demande, le plan montre ${apres} m au lieu de 4,5 — le texte a changé, pas le dessin`);
});

// ── Une réserve est DITE quand la demande a un défaut ───────────────────────
cas("passer en 15-VAN signale le débordement hors limite", () => {
  const t = texte;
  if (!/au-delà de la limite|hors limite|déborde/i.test(t)) {
    throw new Error("la 15-VAN porte 4,5 m sur une bande de 4 m et rien ne le dit : on arrose chez le voisin sans le savoir");
  }
});

cas("un refus s'explique et propose autre chose", async () => {});
await page.click("label[for=q3]");
await page.waitForTimeout(200);
const t3 = texte;
cas("la demande des 5004 est discutée, pas rejetée", () => {
  if (!/déconseille|je peux/i.test(t3)) throw new Error("la demande est refusée sans qu'on sache si elle est possible");
  if (!/1,98|troisième réseau/i.test(t3)) throw new Error("le refus ne chiffre pas ce qu'il coûterait");
  if (!/quand même/i.test(t3)) throw new Error("le dernier mot ne lui est pas rendu : un conseil n'est pas une décision");
});

// ── SANS CROQUIS COMPLET, AUCUN PLAN — sa règle du 21 août 2026 ───────────
//
// *« L'outil doit fonctionner avec un plan avec toutes les métrés, l'emplacement
// du piquage et l'endroit définitif de la nourrice. Sans ça il ne doit rien
// proposer. La discussion ne doit jamais créer un plan avec des réseaux — elle
// peut seulement modifier, ou recréer si un croquis avec tous les bons éléments
// aux bons endroits a été fourni. »*
//
// **La discussion ne remplace pas le croquis.** C'est la tentation exacte d'une
// conversation : on répond à une demande en comblant ce qui manque, parce qu'une
// phrase se complète plus facilement qu'un dessin. Un plan tracé sur une nourrice
// supposée fait creuser au mauvais endroit — et la tranchée ne se déplace pas.
//
// **On RETIRE le plan, on ne le grise pas.** Un plan affiché en pâle se
// photographie et se pose quand même.
cas("croquis incomplet : aucun plan n'est montré, et l'on dit ce qui manque", async () => {});
await page.click("label[for=q4]");
await page.waitForTimeout(200);
const incomplet = await page.evaluate(() => ({
  planVisible: [...document.querySelectorAll(".plan")].some((e) => getComputedStyle(e).display !== "none"),
  manque: document.querySelector(".manque")?.innerText ?? "",
}));
cas("le plan disparaît tant que le croquis n'est pas complet", () => {
  if (incomplet.planVisible) {
    throw new Error("le plan reste à l'écran alors que le croquis est incomplet : il se photographie et se pose quand même");
  }
});
cas("les trois éléments obligatoires sont nommés, et l'on voit lequel manque", () => {
  const t = incomplet.manque.toLowerCase();
  for (const [quoi, motif] of [["les métrés", /métré/], ["le piquage", /piquage/], ["la nourrice", /nourrice/]]) {
    if (!motif.test(t)) throw new Error(`l'écran ne dit pas si ${quoi} est là : il ne sait pas quoi renvoyer`);
  }
  if (!/où|placez|endroit/i.test(incomplet.manque)) {
    throw new Error("l'écran dit qu'il manque quelque chose sans dire quoi faire");
  }
});

cas("rien ne déborde sur 390 px", async () => {});
const deborde = await page.evaluate(() => document.documentElement.scrollWidth > 390);
cas("la page tient dans la largeur de son téléphone", () => {
  if (deborde) throw new Error("la page déborde : il devra la faire glisser pour lire");
});

await nav.close();
console.log(`\n${echecs === 0 ? "✅" : "❌"} La maquette « discuter le plan » — ${echecs} échec(s).`);
process.exit(echecs === 0 ? 0 : 1);
