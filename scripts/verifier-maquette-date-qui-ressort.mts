// Parcourir la planche comme lui : toucher chaque lettre, en clair et en nuit.
import { chromium } from "playwright";
import { existsSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
function nav(): string | undefined {
  const r = process.env.PLAYWRIGHT_BROWSERS_PATH;
  if (!r || !existsSync(r)) return undefined;
  if (existsSync(`${r}/chromium`)) return `${r}/chromium`;
  const s = readdirSync(r).find((d) => /^chromium-\d+$/.test(d));
  return s && existsSync(`${r}/${s}/chrome-linux/chrome`) ? `${r}/${s}/chrome-linux/chrome` : undefined;
}
const echecs: string[] = [];
let temoinNomGauche = 0;
const b = await chromium.launch({ executablePath: nav() });
const p = await b.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
// **Le chemin est résolu ici, pas supposé absolu.** Branché sur
// `npm run verifier:maquette`, il arrive relatif au dépôt ; lancé à la main, il
// arrive absolu. Un contrôle qui n'ouvre pas la page rendrait un vert sur une
// page blanche — et un vert vide est pire qu'un rouge.
const chemin = resolve(process.argv[2]);
if (!existsSync(chemin)) { console.error(`Planche introuvable : ${chemin}`); process.exit(1); }
await p.goto("file://" + chemin, { waitUntil: "networkidle" });

const lire = async () => p.evaluate(() => {
  const d = document.querySelector("#tel .date") as HTMLElement;
  const visible = [...d.children].filter((e) => getComputedStyle(e).display !== "none");
  const st = getComputedStyle(d);
  const nom = document.querySelector("#tel .nom") as HTMLElement;
  return {
    vue: (document.getElementById("tel") as HTMLElement).dataset.vue,
    texte: visible.map((e) => (e as HTMLElement).innerText.trim()).join(" · "),
    couleur: getComputedStyle(visible[0] as Element).color,
    gauche: Math.round(d.getBoundingClientRect().left),
    hauteur: Math.round(d.getBoundingClientRect().height),
    nomGauche: Math.round(nom.getBoundingClientRect().left),
    cible: Math.round((document.querySelector('.choix button[data-vue="a"]') as HTMLElement).getBoundingClientRect().height),
    debordement: Math.max(0, document.documentElement.scrollWidth - window.innerWidth),
  };
});

for (const charte of ["clair", "nuit"]) {
  if (charte === "nuit") await p.click("#bascule-nuit");
  console.log(`\n=== ${charte} ===`);
  for (const vue of ["temoin", "a", "b", "c", "d"]) {
    await p.click(`.choix button[data-vue="${vue}"]`);
    await p.waitForTimeout(120);
    const e = await lire();
    console.log(`  ${vue.padEnd(6)} « ${e.texte} »  ${e.couleur}  h=${e.hauteur}  nom@${e.nomGauche}`);
    if (e.vue !== vue) echecs.push(`${charte}/${vue} : l'appui n'a pas changé la vue`);
    if (!e.texte) echecs.push(`${charte}/${vue} : la date ne montre aucun texte`);
    // Un contrôle qui mesure zéro ne mesure rien : une date haute de zéro pixel
    // ne se voit pas, quelle que soit sa couleur.
    if (e.hauteur < 8) echecs.push(`${charte}/${vue} : la date fait ${e.hauteur} px de haut`);
    if (e.debordement > 0) echecs.push(`${charte}/${vue} : déborde de ${e.debordement} px`);
    if (e.cible < 44) echecs.push(`la cible d'un bouton fait ${e.cible} px, il en faut 44`);
    // C décale les noms de 36 px : c'est SA promesse, et elle se mesure
    // CONTRE le témoin — un seuil écrit à la main (« plus de 60 px ») accuse
    // à tort dès que la marge de l'écran change.
    if (vue === "temoin") temoinNomGauche = e.nomGauche;
    if (vue === "c" && e.nomGauche - temoinNomGauche !== 36) {
      echecs.push(`C décale les noms de ${e.nomGauche - temoinNomGauche} px au lieu de 36`);
    }
  }
}
// Chaque proposition doit RENDRE UNE DATE DIFFÉRENTE du témoin, sinon elle ne
// propose rien.
await p.click("#bascule-nuit");
const empreintes = new Map<string, string>();
for (const vue of ["temoin", "a", "b", "c", "d"]) {
  await p.click(`.choix button[data-vue="${vue}"]`);
  await p.waitForTimeout(120);
  const e = await lire();
  empreintes.set(vue, `${e.couleur}|${e.hauteur}|${e.nomGauche}|${e.texte}`);
}
for (const vue of ["a", "b", "c", "d"]) {
  if (empreintes.get(vue) === empreintes.get("temoin")) {
    echecs.push(`${vue} rend exactement le même écran que le témoin : elle ne propose rien`);
  }
}
await b.close();
if (echecs.length) { console.log(`\n✗ ${echecs.length} défaut(s) :`); for (const e of echecs) console.log("   — " + e); process.exit(1); }
console.log("\n✅ La planche se manipule : cinq vues, deux chartes, rien ne déborde.");
