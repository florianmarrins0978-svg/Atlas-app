// La seconde rangée, regardée et mesurée AVANT de lui donner l'adresse.
//
//   npx tsx scripts/capture-creer-une-facture-sous-les-onglets.mts <dossier>
//
// **Ce que ce contrôle doit prouver, et pas seulement montrer :**
//
//   1. la rangée d'onglets ne déborde plus à AUCUNE largeur — c'est tout
//      l'objet de la seconde rangée, et l'affirmer sans le relever serait
//      l'aller-retour qu'on veut arrêter ;
//   2. le bouton est bien COLLÉ À DROITE — son bord droit tombe sur la marge
//      de 26 px, comme les onglets à gauche. « À droite » se vérifie au pixel,
//      pas à l'œil ;
//   3. les deux noms restent ENTIERS — c'est ce que cette disposition achète,
//      et un libellé coupé par un `text-overflow` le rendrait faux sans que
//      rien ne rougisse ;
//   4. le bouton garde ses 44 px de haut — la mesure d'un pouce ganté.
//
// On refuse de conclure sur une boîte de zéro pixel (`CLAUDE.md` §5).
import { lancerNavigateur } from "./e2e-browser";
import type { Page } from "playwright";
import { mkdirSync } from "node:fs";
import path from "node:path";

const dossier = process.argv[2] ?? ".";
mkdirSync(dossier, { recursive: true });

const FICHIER =
  "file://" +
  path
    .join(import.meta.dirname, "..", "appli", "creer-une-facture-sous-les-onglets.html")
    .replace(/\\/g, "/");

const LARGEURS = [360, 390, 430] as const;
const MARGE = 26;

const navigateur = await lancerNavigateur();
const contexte = await navigateur.newContext({
  viewport: { width: 470, height: 1000 },
  deviceScaleFactor: 2,
});
const page: Page = await contexte.newPage();
await page.goto(FICHIER, { waitUntil: "networkidle" });

console.log("=== La seconde rangée, aux trois largeurs ===\n");

for (const large of LARGEURS) {
  await page.click(`[data-large="${large}"]`);
  await page.click('[data-etat="sans"]');
  await page.waitForLoadState("networkidle");
  const sans = await page.evaluate(() => {
    const m = document.querySelector<HTMLElement>("#mois");
    const t = document.querySelector<HTMLElement>("#tel");
    if (!m || !t) return null;
    return Math.round(m.getBoundingClientRect().top - t.getBoundingClientRect().top);
  });

  await page.click('[data-etat="avec"]');
  await page.waitForLoadState("networkidle");

  const m = await page.evaluate(() => {
    const tel = document.querySelector<HTMLElement>("#tel");
    const onglets = document.querySelector<HTMLElement>("#onglets");
    const bouton = document.querySelector<HTMLElement>("#bouton-facture");
    const mois = document.querySelector<HTMLElement>("#mois");
    if (!tel || !onglets || !bouton || !mois) return null;

    const cadre = tel.getBoundingClientRect();
    // **Le cheveu du CADRE n'existe que dans la maquette.** Le téléphone dessiné
    // porte un bord d'1 px pour se détacher de la page ; l'écran réel n'en a
    // pas. Mesurer « collé à droite » contre le bord extérieur rendait donc
    // 27 px là où la marge en vaut 26 — un faux défaut, qui aurait fait
    // corriger une mise en page juste. On vise le bord INTÉRIEUR, et on lit son
    // épaisseur plutôt que de la supposer.
    const bord = parseFloat(getComputedStyle(tel).borderRightWidth) || 0;
    const droiteInterieure = cadre.right - bord;
    const pastilles = Array.from(onglets.querySelectorAll<HTMLElement>(".pastille"));
    const largeurs = pastilles.map((p) => p.getBoundingClientRect().width);
    const b = bouton.getBoundingClientRect();

    return {
      pastilles: largeurs.length,
      zero: largeurs.some((x) => x === 0),
      prise: Math.round(largeurs.reduce((s, x) => s + x, 0) + 4 * (largeurs.length - 1)),
      dispo: Math.round(cadre.width - bord * 2 - 26 * 2),
      // La distance entre le bord DROIT du bouton et le bord droit du cadre.
      aDroite: Math.round(droiteInterieure - b.right),
      hauteurBouton: Math.round(b.height),
      largeurBouton: Math.round(b.width),
      libelleBouton: bouton.innerText.trim(),
      // Un libellé rogné par le navigateur : la largeur du texte dépasse celle
      // de sa boîte. C'est ce qui rendrait « nom entier » faux en silence.
      rogne:
        bouton.scrollWidth > bouton.clientWidth + 1 ||
        pastilles.some((p) => p.scrollWidth > p.clientWidth + 1),
      troisieme: pastilles[2]?.innerText.trim() ?? "",
      hautDuMois: Math.round(mois.getBoundingClientRect().top - cadre.top),
    };
  });

  if (!m) throw new Error(`Rien à mesurer à ${large} px.`);
  if (m.pastilles !== 3) throw new Error(`${large} px : ${m.pastilles} onglets au lieu de 3.`);
  if (m.zero || m.prise === 0) {
    throw new Error(`${large} px : un onglet fait zéro — la mesure est impossible.`);
  }
  if (m.prise > m.dispo) {
    throw new Error(`${large} px : les onglets débordent encore (${m.prise} pour ${m.dispo}).`);
  }
  if (m.aDroite !== MARGE) {
    throw new Error(
      `${large} px : le bouton n'est pas collé à droite — ${m.aDroite} px du bord au lieu de ${MARGE}.`
    );
  }
  if (m.hauteurBouton !== 44) {
    throw new Error(`${large} px : le bouton fait ${m.hauteurBouton} px de haut au lieu de 44.`);
  }
  if (m.rogne) throw new Error(`${large} px : un libellé est rogné — les noms ne sont plus entiers.`);
  if (m.libelleBouton !== "Créer une facture") {
    throw new Error(`${large} px : le bouton dit « ${m.libelleBouton} ».`);
  }
  if (!m.troisieme.startsWith("Retours d")) {
    throw new Error(`${large} px : le 3ᵉ onglet dit « ${m.troisieme} » — il a perdu son nom entier.`);
  }

  const pousse = sans !== null ? m.hautDuMois - sans : 0;
  console.log(
    `${large} px · onglets ${m.prise}/${m.dispo} · bouton ${m.largeurBouton} px, ` +
      `à ${m.aDroite} px du bord · la liste descend de ${pousse} px`
  );

  await page.locator("#tel").screenshot({ path: path.join(dossier, `sous-onglets-${large}.png`) });
}

// Le pôle sombre : deux chartes sur sept inversent l'accent et le fond, et l'or
// posé sur un fond clair n'y dit pas la même chose.
await page.click('[data-large="390"]');
await page.click('[data-etat="avec"]');
await page.click("#pole");
await page.locator("#tel").screenshot({ path: path.join(dossier, "sous-onglets-nuit.png") });

await contexte.close();
await navigateur.close();
console.log(`\nLes trois largeurs + la nuit : ${dossier}`);
