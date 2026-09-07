/**
 * « La porte, comme ta capture » — la planche se parcourt en entier, comme lui.
 *
 * **Pourquoi cette suite existe.** Trois fois, une adresse lui a été transmise
 * sans que personne ne l'ait ouverte, et c'est LUI qui a trouvé le défaut
 * (`AGENTS.md`). Une planche dont on attend un choix — ici A, B ou C — se
 * parcourt donc d'abord ici, dans un vrai navigateur, sur un téléphone.
 *
 * **Ce qu'elle garde par-dessus tout : les trois écrans TIENNENT.** Une porte
 * est le seul écran qu'on ne peut pas faire défiler du pouce avant d'être
 * entré ; un bouton « Entrer » repoussé hors du cadre ne se voit pas sur une
 * capture d'en haut, et se paie à l'essai. Chaque téléphone est donc mesuré :
 * son contenu doit tenir dans sa hauteur, dans les deux vues.
 *
 * **Elle sait échouer**, et sur autre chose que le vide : l'écran doit d'abord
 * avoir de la matière — un cadre de zéro pixel passerait tout au vert sans rien
 * prouver (`CLAUDE.md` §5, la panne du 15 août 2026). Vue rouge contre une
 * hauteur d'écran ramenée à 520 px (le bouton principal sortait du cadre) et
 * contre une bascule débranchée.
 *
 *   BASE_URL=http://127.0.0.1:8080 node tests/essai-porte-capture.mjs
 */
import { existsSync } from "node:fs";
import { chromium } from "playwright";

const BASE = process.env.BASE_URL || "http://127.0.0.1:8080";
let rouges = 0;
const dire = (ok, quoi) => {
  if (!ok) rouges++;
  console.log((ok ? "  ok    " : "  ROUGE ") + quoi);
};

const CHROME = process.env.CHROME_ATLAS ?? "/opt/pw-browsers/chromium";
const nav = await chromium.launch(existsSync(CHROME) ? { executablePath: CHROME } : {});
const page = await nav.newPage({ viewport: { width: 390, height: 844 } });
const erreurs = [];
page.on("pageerror", (e) => erreurs.push(String(e)));
page.on("requestfailed", (r) => erreurs.push("requête perdue : " + r.url()));
page.on("response", (r) => {
  if (r.status() >= 400 && !r.url().endsWith("/favicon.ico")) erreurs.push(r.status() + " sur " + r.url());
});

// `networkidle` et pas `domcontentloaded` : sans la mise en page appliquée,
// toutes les mesures ci-dessous vaudraient 0.
await page.goto(BASE + "/porte-comme-ta-capture.html", { waitUntil: "networkidle" });

console.log("\nLa planche s'ouvre");
const tels = page.locator("[data-tel]");
dire((await tels.count()) === 3, "trois téléphones : A, B et C");
dire(
  (await page.evaluate(() => document.documentElement.scrollWidth)) <= 390,
  "rien ne déborde en largeur sur un téléphone de 390 px",
);

for (const [rang, classe] of [["A", "a"], ["B", "b"], ["C", "c"]]) {
  const tel = page.locator(".tel." + classe);
  const cadre = await tel.locator(".ecran").boundingBox();
  console.log("\nProposition " + rang);

  // La matière d'abord : sans elle, tout ce qui suit serait un vert creux.
  dire(cadre !== null && cadre.width > 200 && cadre.height > 400, "l'écran a de la matière (" +
    (cadre ? Math.round(cadre.width) + "×" + Math.round(cadre.height) : "absent") + ")");

  for (const vue of ["connexion", "creation"]) {
    if (vue === "creation") await tel.locator("[data-bascule]").click();
    const deborde = await tel.locator(".ecran").evaluate((e) => e.scrollHeight > e.clientHeight + 1);
    dire(!deborde, "vue « " + vue + " » : tout tient dans le cadre");
    const bouton = tel.locator('[data-vue="' + vue + '"] .principal');
    dire(await bouton.isVisible(), "vue « " + vue + " » : le bouton principal se voit");
    for (const mot of ["Google", "Apple"]) {
      dire(await tel.locator('[data-vue="' + vue + '"] .duo button', { hasText: mot }).isVisible(),
        "vue « " + vue + " » : le bouton " + mot + " se voit");
    }
    for (const champ of ["Adresse", "Mot de passe"]) {
      dire(await tel.locator('[data-vue="' + vue + '"] input[placeholder="' + champ + '"]').isVisible(),
        "vue « " + vue + " » : le champ " + champ + " se voit");
    }
  }
  // La bascule revient : il doit pouvoir faire l'aller-retour sans recharger.
  await tel.locator("[data-bascule]").click();
  dire(await tel.locator('[data-vue="connexion"] .principal').isVisible(),
    "la bascule revient sur la connexion");

  // Face ID existe pour de bon depuis le 24 août : il garde sa place ici.
  dire(await tel.locator('[data-vue="connexion"] .visage').isVisible(),
    "« Ouvrir avec Face ID » est sur la porte");
}

console.log("\nLes règles du dépôt");
const texte = await page.evaluate(() => document.body.innerText);
dire(!/[→›]/.test(texte), "aucune flèche décorative (CLAUDE.md §3)");
dire(!/Pour créer un compte, /.test(texte), "aucune phrase qui explique les champs juste en dessous");
dire(erreurs.length === 0, "aucune erreur de page" + (erreurs.length ? " : " + erreurs[0] : ""));

await nav.close();
console.log(rouges === 0 ? "\nTout est vert." : "\n" + rouges + " ROUGE(S).");
process.exit(rouges === 0 ? 0 : 1);
