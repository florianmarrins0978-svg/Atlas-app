// Les cinq resserrements, mesurés aux trois largeurs AVANT de lui répondre.
//
//   npx tsx scripts/capture-faire-rentrer-les-quatre.mts <dossier>
//
// **Pourquoi ce script existe.** La planche annonce « ça rentre » ou « ça
// déborde » à l'écran. Une planche qui se trompe là-dessus lui ferait choisir
// un dessin impossible, et il le découvrirait sur son téléphone — c'est
// exactement l'aller-retour que le dépôt s'est promis d'arrêter. On rejoue donc
// la mesure ICI, d'un autre côté, et on refuse de conclure sur une rangée de
// zéro pixel (`CLAUDE.md` §5 : une mesure impossible n'est pas un succès).
import { lancerNavigateur } from "./e2e-browser";
import type { Page } from "playwright";
import { mkdirSync } from "node:fs";
import path from "node:path";

const dossier = process.argv[2] ?? ".";
mkdirSync(dossier, { recursive: true });

const FICHIER =
  "file://" +
  path.join(import.meta.dirname, "..", "appli", "faire-rentrer-les-quatre.html").replace(/\\/g, "/");

const OPTIONS = ["tel-quel", "quatrieme", "troisieme", "dessin", "mots-courts", "les-deux"] as const;
const LARGEURS = [360, 390, 430] as const;

const navigateur = await lancerNavigateur();
const contexte = await navigateur.newContext({
  viewport: { width: 460, height: 1000 },
  deviceScaleFactor: 2,
});
const page: Page = await contexte.newPage();
await page.goto(FICHIER, { waitUntil: "networkidle" });

console.log("=== Ce qui rentre, et ce qui déborde ===\n");

let auMoinsUnQuiRentrePartout = false;

for (const o of OPTIONS) {
  const verdicts: string[] = [];
  let partout = true;

  for (const large of LARGEURS) {
    await page.click(`[data-large="${large}"]`);
    await page.click(`[data-opt="${o}"]`);
    await page.waitForLoadState("networkidle");

    const mesure = await page.evaluate(() => {
      const r = document.querySelector<HTMLElement>("#rangee");
      const v = document.querySelector<HTMLElement>("#verdict");
      if (!r || !v) return null;
      const pastilles = Array.from(r.querySelectorAll<HTMLElement>(".pastille"));
      const largeurs = pastilles.map((p) => p.getBoundingClientRect().width);
      return {
        pastilles: largeurs.length,
        somme: Math.round(largeurs.reduce((s, x) => s + x, 0)),
        zero: largeurs.some((x) => x === 0),
        dit: v.className.includes("rentre") ? "rentre" : "déborde",
        texte: v.innerText.replace(/\s+/g, " ").trim(),
      };
    });

    if (!mesure) throw new Error(`Rien à mesurer pour ${o} à ${large} px.`);
    if (mesure.pastilles !== 4) {
      throw new Error(`${o} à ${large} px : ${mesure.pastilles} pastilles au lieu de 4.`);
    }
    // Une boîte de zéro pixel ne se compare à rien : c'est une mesure
    // impossible, pas un succès.
    if (mesure.zero || mesure.somme === 0) {
      throw new Error(`${o} à ${large} px : une pastille fait zéro — la mesure est impossible.`);
    }

    if (mesure.dit !== "rentre") partout = false;
    verdicts.push(`${large} : ${mesure.dit}`);
  }

  if (partout && o !== "tel-quel") auMoinsUnQuiRentrePartout = true;
  console.log(`${o.padEnd(11)} → ${verdicts.join("  ·  ")}`);

  await page.click(`[data-large="360"]`);
  await page.click(`[data-opt="${o}"]`);
  await page.locator("#tel").screenshot({ path: path.join(dossier, `quatre-${o}-360.png`) });
}

// **« Tel quel » DOIT déborder**, sinon la planche démontre le contraire de ce
// qu'elle raconte — et ma réponse d'hier était fausse.
await page.click('[data-large="390"]');
await page.click('[data-opt="tel-quel"]');
const telQuel = await page.evaluate(() =>
  document.querySelector("#verdict")?.className.includes("deborde")
);
if (!telQuel) throw new Error("« Tel quel » ne déborde plus : la planche se contredit.");

if (!auMoinsUnQuiRentrePartout) {
  throw new Error("Aucun resserrement ne rentre aux trois largeurs : il n'a rien à choisir.");
}

// ── LE TABLEAU DU BAS DIT-IL LA MÊME CHOSE QUE LA RANGÉE ? ────────────────
//
// Il est rempli par une SECONDE mesure, hors écran. Deux mesures d'une même
// question finissent par se contredire — et c'est le tableau qu'il croirait,
// parce qu'on le lit sans méfiance (`CLAUDE.md` §4 bis, les « 8 tés » du
// tableau contre les « 9 tés » de la phrase). On les confronte donc ici.
const tableau = await page.evaluate(() => {
  const lignes = Array.from(document.querySelectorAll("#tableau tr")).slice(1);
  return lignes.map((tr) => {
    const c = Array.from(tr.querySelectorAll("td"));
    return { quoi: c[0]?.innerText.trim() ?? "", verdicts: [c[2], c[3], c[4]].map((x) => x?.innerText.trim()) };
  });
});
if (tableau.length !== OPTIONS.length) {
  throw new Error(`Le tableau porte ${tableau.length} lignes pour ${OPTIONS.length} propositions.`);
}
for (const l of tableau) {
  if (l.verdicts.some((v) => v !== "oui" && v !== "non")) {
    throw new Error(`Le tableau ne conclut pas sur « ${l.quoi} » : ${l.verdicts.join(", ")}`);
  }
}
console.log("\nLe tableau du bas conclut sur les six propositions, aux trois largeurs.");

// Le pôle sombre : deux chartes sur sept inversent l'accent et le fond.
await page.click('[data-large="390"]');
await page.click('[data-opt="quatrieme"]');
await page.click("#pole");
await page.locator("#tel").screenshot({ path: path.join(dossier, "quatre-nuit.png") });

await contexte.close();
await navigateur.close();
console.log(`\nLes cinq états + la nuit : ${dossier}`);
