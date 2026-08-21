#!/usr/bin/env node
/*
  Éprouve la maquette du planning en semaines — dans un vrai navigateur.

  **Pourquoi elle ne se relit pas, elle se joue.** Il a demandé une maquette
  « dynamique que je puisse essayer » : ce qu'elle promet, ce sont des gestes —
  les flèches changent de semaine, les trois calendriers se comparent, et la
  liste montre la MÊME semaine que le calendrier. Une promesse de ce genre ne se
  vérifie pas à la lecture du fichier.

  **Et elle refuse de conclure sur du vide.** Une case de zéro pixel n'est pas
  « rien n'est pris » : c'est une mesure impossible, le faux vert du 15 août
  2026 où 0 − 0 = 0 certifiait « rien n'est coupé » sur un écran où trois noms
  l'étaient.

      node scripts/verifier-maquette-planning-simple.mjs
*/

import { chromium } from "playwright";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const RACINE = join(dirname(fileURLToPath(import.meta.url)), "..");
const FICHIER = join(RACINE, "appli", "planning-simple.html");
const CHEMIN_SANDBOX = "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";

const problemes = [];
function verifier(quoi, condition) {
  if (condition) console.log(`  ✓ ${quoi}`);
  else {
    console.error(`  ✗ ${quoi}`);
    problemes.push(quoi);
  }
}

const navigateur = await chromium.launch(
  existsSync(CHEMIN_SANDBOX) ? { executablePath: CHEMIN_SANDBOX } : {},
);
const page = await navigateur.newPage({ viewport: { width: 430, height: 1200 } });
const erreurs = [];
page.on("pageerror", (e) => erreurs.push(e.message));
await page.goto(pathToFileURL(FICHIER).href, { waitUntil: "networkidle" });

const titreMois = () => page.locator("#mois-titre").innerText();
const titreSemaine = () => page.locator("#sem-titre").innerText();

// **Le titre du jour est écrit « vendredi 21 août », mais la feuille de style
// le met en capitales.** `innerText` rend ce que l'ŒIL voit, pas ce que le HTML
// porte : un contrôle qui compare au texte source rougit sur une page juste.
// Payé ici le 19 août 2026.
const litPlanifies = async () => (await page.locator("#planifies").innerText()).toLowerCase();

verifier("la page se charge sans erreur de script", erreurs.length === 0);
if (erreurs.length) console.error("   ", erreurs[0]);

// ── LE CALENDRIER RESTE AU MOIS — sa correction du 21 août ────────────────
verifier(`le calendrier arrive sur le mois — lu : « ${await titreMois()} »`, /août 2026/i.test(await titreMois()));
verifier(
  "le mois ne porte QUE ses propres jours — août en a 31",
  (await page.locator("#mois [data-jour]").count()) === 31,
);
// **Compter les cases vides ne suffit pas** : il faut qu'elles soient VIDES.
// Un « 27 » lu dans la grille d'août peut être le 27 août — le contrôle qui
// cherchait ce chiffre accusait une page juste.
verifier(
  "les jours des autres mois sont des cases vides, pas des chiffres gris",
  (await page.locator("#mois .creux").count()) === 42 - 31 &&
    (await page.$$eval("#mois .creux", (n) => n.every((e) => e.textContent.trim() === ""))),
);

// **Le retour « Aujourd'hui » n'existe que si l'on s'est éloigné.** Sans lui on
// se perd à trois mois ; toujours présent, il se lirait comme une action à
// faire. Les deux états se jouent, ils ne se supposent pas.
verifier("sur le mois courant, aucun retour « Aujourd'hui »", await page.locator("#retour").isHidden());
await page.click("#mois-apres");
verifier("dès qu'on change de mois, le retour apparaît", await page.locator("#retour").isVisible());
await page.click("#retour");
verifier("et il ramène sur le mois du jour", /août 2026/i.test(await titreMois()));
await page.click("#mois-apres");
verifier(`la flèche du mois avance — « ${await titreMois()} »`, /septembre 2026/i.test(await titreMois()));
await page.click("#mois-avant");
verifier(`et revient — « ${await titreMois()} »`, /août 2026/i.test(await titreMois()));

// ── LA SEMAINE NE GOUVERNE QUE LES PLANIFIÉS ─────────────────────────────
const semaineDepart = await titreSemaine();
verifier(`la semaine arrive sur celle du 19 août — « ${semaineDepart} »`, /17\s*–\s*23 août/.test(semaineDepart));
verifier(
  "les deux Martins du vendredi 21 sont dans la liste, avec le jour NOMMÉ",
  (await litPlanifies()).includes("vendredi 21 août"),
);
await page.click("#sem-apres");
verifier(`la flèche de la semaine avance — « ${await titreSemaine()} »`, /24\s*–\s*30 août/.test(await titreSemaine()));
verifier(
  "l'abri de Pornic apparaît le mardi 25, avec sa demi-journée",
  (await litPlanifies()).includes("mardi 25 août") && (await litPlanifies()).includes("matin"),
);
verifier(
  "« ½ journée » ne s'écrit plus : « matin » le dit déjà",
  !(await litPlanifies()).includes("½ journée"),
);
verifier("la flèche de la semaine n'a PAS changé le mois", /août 2026/i.test(await titreMois()));
await page.click("#sem-avant");
verifier("la flèche gauche revient exactement où l'on était", (await titreSemaine()) === semaineDepart);

await page.click("#sem-avant");
await page.click("#sem-avant");
verifier("une semaine vide le dit en toutes lettres", (await litPlanifies()).includes("aucun chantier posé"));

// ── LE MOIS VISE, LA SEMAINE LIT ──────────────────────────────────────────
//
// Toucher un jour du mois doit amener la liste sur SA semaine. Sans ce lien,
// l'écran porterait deux navigations qui s'ignorent — exactement le genre de
// page qu'il trouve incompréhensible.
// Le 3 septembre ne s'atteint plus depuis la grille d'août : les jours des
// autres mois n'y sont plus écrits. C'est le prix du mois épuré, et il se paie
// d'un appui sur la flèche — pas d'un chiffre gris qu'on lit sans le vouloir.
await page.click("#mois-apres");
await page.click('[data-jour="2026-09-03"]');
verifier(
  `toucher le 3 septembre amène la liste sur sa semaine — « ${await titreSemaine()} »`,
  /31 août\s*–\s*6 septembre/.test(await titreSemaine()),
);
verifier(
  "et le jour touché se dit sous le calendrier",
  (await page.locator("#jour-ouvert").innerText()).toLowerCase().includes("jeudi 3 septembre"),
);
await page.click("#retour");
await page.click('[data-jour="2026-08-18"]');
verifier(
  "un jour libre le dit, au lieu de ne rien afficher",
  (await page.locator("#jour-ouvert").innerText()).toLowerCase().includes("libre"),
);

// ── La marque retenue se dessine, et aucune barre ne mesure zéro ────────
{
  const boites = await page.$$eval(".marqueA i", (n) => n.map((e) => e.getBoundingClientRect().height));
  verifier(
    `les deux barres du jour se dessinent (${boites.length} barres, aucune de zéro pixel)`,
    boites.length === 62 && boites.every((h) => h >= 1),
  );
}

/** Ce qu'une case peint : "complet", ou la part remplie de chaque barre. */
const barresDe = (jour) =>
  page.$$eval(`[data-jour="${jour}"] .marqueA i`, (n) =>
    n.map((e) => (e.classList.contains("plein") ? "complet" : e.firstElementChild?.style.width || "0%")));

// ── Ce que le calendrier peint doit être CE QUE LES DONNÉES DISENT ───────
//
// Le vendredi 21 porte deux chantiers à la journée : avec deux équipes, ses
// deux demi-journées sont complètes. Un calendrier joli mais faux passerait
// tous les contrôles ci-dessus.
verifier(
  `le vendredi 21 est complet matin ET après-midi (lu : ${JSON.stringify(await barresDe("2026-08-21"))})`,
  (await barresDe("2026-08-21")).every((b) => b === "complet"),
);
verifier(
  `le mercredi 19 est vide le matin, à moitié l'après-midi (lu : ${JSON.stringify(await barresDe("2026-08-19"))})`,
  JSON.stringify(await barresDe("2026-08-19")) === JSON.stringify(["0%", "50%"]),
);
verifier(
  `le mercredi 26 est complet l'après-midi sur un matin libre (lu : ${JSON.stringify(await barresDe("2026-08-26"))})`,
  JSON.stringify(await barresDe("2026-08-26")) === JSON.stringify(["0%", "complet"]),
);

// ── SA QUESTION DU 21 AOÛT : « et s'il y a dix équipes ? » ───────────────
//
// C'est le contrôle qui compte, parce que c'est le point où le dessin d'avant
// cassait : avec trois états, une équipe prise sur dix et neuf prises sur dix
// peignaient exactement la même chose.
await page.click('[data-equipes="10"]');
await page.waitForTimeout(150);
verifier(
  `à dix équipes, le vendredi 21 ne montre plus que deux dixièmes (lu : ${JSON.stringify(await barresDe("2026-08-21"))})`,
  JSON.stringify(await barresDe("2026-08-21")) === JSON.stringify(["20%", "20%"]),
);
verifier(
  `à dix équipes, le mercredi 19 tombe à un dixième (lu : ${JSON.stringify(await barresDe("2026-08-19"))})`,
  JSON.stringify(await barresDe("2026-08-19")) === JSON.stringify(["0%", "10%"]),
);
verifier(
  "à dix équipes, « complet » reste montrable — le 26 l'est toujours",
  (await barresDe("2026-08-26"))[1] === "complet",
);
await page.click('[data-equipes="2"]');
await page.waitForTimeout(150);
verifier(
  "revenir à deux équipes rend le calendrier d'avant",
  JSON.stringify(await barresDe("2026-08-21")) === JSON.stringify(["complet", "complet"]),
);

// ── La légende MONTRE la position, elle ne l'explique plus ──────────────
//
// Sa demande du 21 août : retirer « la barre du haut c'est le matin », mais
// qu'on le comprenne quand même. La légende porte donc deux marques dessinées,
// l'une remplie en haut, l'autre en bas.
{
  const dit = (await page.locator(".legende").innerText()).toLowerCase();
  verifier("la légende ne porte plus de phrase d'explication", !dit.includes("barre du haut"));
  verifier("elle dit matin, après-midi, complet", ["matin", "après-midi", "complet"].every((m) => dit.includes(m)));
  const minis = await page.$$eval(".legende .mini", (n) =>
    n.map((e) => [...e.children].map((i) => i.className)));
  verifier(
    `la première marque est remplie EN HAUT, la seconde EN BAS (lu : ${JSON.stringify(minis)})`,
    minis.length === 3 && minis[0][0] === "pris" && minis[0][1] === "" &&
      minis[1][0] === "" && minis[1][1] === "pris",
  );
}

// ── La fiche du jour dit l'ÉQUIPE, et le COMPTE ─────────────────────────
//
// Son second manque du 21 août : « il y a marqué le client, la journée ou la
// demi-journée, mais pas l'équipe qui est affiliée ».
await page.click('[data-jour="2026-08-26"]');
{
  const dit = (await page.locator("#jour-ouvert").innerText()).toLowerCase();
  verifier("la fiche du 26 dit que le matin est libre", /matin\s+libre/.test(dit));
  // Le compte a été retiré le 21 août : « juste complet et le nom des équipes ».
  verifier("elle dit « complet » l'après-midi, sans le compte", dit.includes("complet"));
  verifier("et elle ne dit plus « 2 équipes sur 2 »", !dit.includes("sur 2"));
  verifier("elle NOMME les deux équipes", dit.includes("julien") && dit.includes("paul"));
}
await page.click("[data-jour='2026-08-21']");
{
  const dit = (await page.locator("#jour-ouvert").innerText()).toLowerCase();
  verifier(
    "sur le 21, l'équipe qui manque se dit au lieu de rester muette",
    dit.includes("équipe à choisir") || dit.includes("équipe ?"),
  );
}

await navigateur.close();

if (problemes.length) {
  console.error(`\n  ${problemes.length} problème(s).\n`);
  process.exit(1);
}
console.log("\n  La maquette du planning tient ses gestes.\n");
