#!/usr/bin/env node
/*
  Éprouve la maquette 54, JAVASCRIPT COUPÉ.

  **Pourquoi un contrôle sur une planche qui ne fait que proposer.** Parce que
  trois fois cet été une maquette a été envoyée au patron avec une bascule
  morte : le sélecteur du frère visait un neveu, rien ne changeait sous le doigt,
  et il a dû écrire « rien ne s'ouvre quand je touche ». Aucune capture ne montre
  cela — il faut appuyer.

  Ce qui se mesure ici, et rien de plus :

    1. l'écran existe SANS SCRIPT, et porte ses quatre lignes ;
    2. chaque écriture (A, B, C, D) montre **une seule** phrase par ligne. Deux
       phrases visibles à la fois, c'est la bascule qui ne bascule pas — le
       défaut exact payé le 14 août ;
    3. **A et B ne portent aucun or sur cette phrase** — c'est le TÉMOIN, et il
       garde le contrôle honnête : c'est justement ce qui manque aujourd'hui, et
       si le témoin passait à l'or c'est le contrôle qui mentirait ;
    4. C et D, elles, écrivent le nombre de jours **dans l'or de l'écran** —
       la couleur calculée, pas le nom d'une classe ;
    5. la phrase tient sur **une seule ligne** dans les quatre. Une phrase de
       deux lignes déforme la ligne du chantier, et c'est arrivé le 14 août sur
       l'écran de dictée : trente et un caractères de trop et le titre se casse ;
    6. **aucun nom de chantier n'est coupé** à 390 px. C'est le piège que le code
       note depuis le 12 août — « Chez M. Bernard » devenu « Chez M. … » — et
       l'écriture D est la plus longue des quatre, donc la plus susceptible de
       le rouvrir.

  Il sait échouer : retirer `.doré` de l'écriture C rend le contrôle 4 rouge en
  nommant la couleur trouvée ; peindre la phrase de A en or rend le témoin rouge ;
  allonger un nom de chantier rend le contrôle 6 rouge en disant de combien de
  pixels il déborde.

  Usage : node scripts/verifier-maquette-nombre-de-jours.mjs [chemin.html]
*/

import { chromium } from "playwright";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { existsSync } from "node:fs";

const RACINE = join(dirname(fileURLToPath(import.meta.url)), "..");
const CIBLE = resolve(
  process.argv[2] ?? join(RACINE, "docs", "maquettes", "54-le-nombre-de-jours-en-or.html"),
);

if (!existsSync(CIBLE)) {
  console.error(`La maquette n'existe pas : ${CIBLE}`);
  process.exit(1);
}

const CHROME = process.env.CHROME_ATLAS ?? "/opt/pw-browsers/chromium";
const navigateur = await chromium.launch(existsSync(CHROME) ? { executablePath: CHROME } : {});

const plaintes = [];
const dire = (bon, quoi) => {
  console.log(`${bon ? "  ✓" : "  ✗"} ${quoi}`);
  if (!bon) plaintes.push(quoi);
};

/** L'or de l'écran, lu sur la variable plutôt que recopié : deux valeurs
 *  écrites à deux endroits finissent par diverger, et c'est alors le contrôle
 *  qui a raison contre la maquette. */
const OR_ATTENDU = "rgb(185, 139, 71)"; // --e-or:#B98B47, en clair

const contexte = await navigateur.newContext({
  viewport: { width: 1400, height: 1200 },
  javaScriptEnabled: false,
});
const page = await contexte.newPage();
await page.goto(`file://${CIBLE}`, { waitUntil: "load" });

// 1. L'écran existe, et ses lignes avec lui.
const lignes = page.locator(".ecran .ligne");
const nbLignes = await lignes.count();
dire(nbLignes === 4, `${nbLignes} ligne(s) de chantier SANS SCRIPT — quatre attendues`);

const ECRITURES = [
  { lettre: "A", classe: "v-a", or: false },
  { lettre: "B", classe: "v-b", or: false },
  { lettre: "C", classe: "v-c", or: true },
  { lettre: "D", classe: "v-d", or: true },
];

for (const { lettre, classe, or } of ECRITURES) {
  await page.locator(`label[for="v-${lettre.toLowerCase()}"]`).click();

  const mesure = await page.evaluate(
    ({ classe }) => {
      const or = getComputedStyle(document.querySelector(".ecran")).getPropertyValue("--e-or").trim();
      return {
        or,
        lignes: [...document.querySelectorAll(".ecran .ligne")].map((l) => {
          const quand = l.querySelector(".quand");
          // Les morceaux VISIBLES, tous confondus : c'est ainsi qu'on attrape
          // une bascule qui n'éteint pas l'écriture précédente.
          const visibles = [...quand.querySelectorAll(":scope > span")].filter(
            (s) => getComputedStyle(s).display !== "none",
          );
          const attendu = visibles.filter((s) => s.classList.contains(classe));
          const teintes = visibles.flatMap((s) => [
            ...[...s.querySelectorAll("*")].map((e) => getComputedStyle(e).color),
            getComputedStyle(s).color,
          ]);
          const nom = l.querySelector(".nom");
          return {
            nom: nom.textContent.trim(),
            // Un nom coupé se voit ici, et nulle part ailleurs : le texte est
            // toujours entier dans le DOM, c'est la BOÎTE qui le rogne.
            debord: nom.scrollWidth - nom.clientWidth,
            visibles: visibles.length,
            juste: attendu.length,
            texte: visibles.map((s) => s.textContent.trim()).join(" ⧸ "),
            hauteur: Math.round(quand.getBoundingClientRect().height),
            teintes,
          };
        }),
      };
    },
    { classe },
  );

  // 2. Une seule phrase à la fois, et c'est bien la sienne.
  const bavardes = mesure.lignes.filter((l) => l.visibles !== 1 || l.juste !== 1);
  dire(
    bavardes.length === 0,
    bavardes.length === 0
      ? `${lettre} — chaque ligne écrit une seule phrase, la sienne`
      : `${lettre} — ${bavardes.length} ligne(s) montrent autre chose que leur seule phrase : ` +
          bavardes.map((l) => `« ${l.nom} » → ${l.texte || "rien"}`).join(" ; "),
  );

  // 3 et 4. L'or, ou son absence — la couleur calculée, jamais le nom d'une classe.
  const dorees = mesure.lignes.filter((l) => l.teintes.some((t) => t === OR_ATTENDU));
  if (or) {
    dire(
      dorees.length === mesure.lignes.length,
      dorees.length === mesure.lignes.length
        ? `${lettre} — le nombre de jours est dans l'or de l'écran (${OR_ATTENDU})`
        : `${lettre} — ${mesure.lignes.length - dorees.length} ligne(s) n'ont aucun or : ` +
            mesure.lignes
              .filter((l) => !l.teintes.some((t) => t === OR_ATTENDU))
              .map((l) => `« ${l.nom} » porte ${[...new Set(l.teintes)].join(", ")}`)
              .join(" ; "),
    );
  } else {
    dire(
      dorees.length === 0,
      dorees.length === 0
        ? `${lettre} — aucun or sur la phrase (témoin : c'est l'état d'aujourd'hui)`
        : `${lettre} — ${dorees.length} ligne(s) portent de l'or alors que le témoin l'interdit : ` +
            dorees.map((l) => `« ${l.nom} »`).join(", "),
    );
  }

  // 5. Une seule ligne de texte. Un chiffre plutôt qu'un booléen : savoir de
  //    combien on dépasse dit s'il faut couper deux mots ou refaire la phrase.
  const hauteurUneLigne = Math.max(...mesure.lignes.map((l) => l.hauteur));
  dire(
    hauteurUneLigne <= 20,
    hauteurUneLigne <= 20
      ? `${lettre} — la phrase tient sur une ligne (${hauteurUneLigne} px)`
      : `${lettre} — la phrase fait ${hauteurUneLigne} px, soit deux lignes : ` +
          mesure.lignes
            .filter((l) => l.hauteur > 20)
            .map((l) => `« ${l.texte} »`)
            .join(" ; "),
  );

  // 6. Le nom, entier.
  const coupes = mesure.lignes.filter((l) => l.debord > 0);
  dire(
    coupes.length === 0,
    coupes.length === 0
      ? `${lettre} — aucun nom de chantier n'est coupé à 390 px`
      : `${lettre} — ${coupes.length} nom(s) coupé(s) : ` +
          coupes.map((l) => `« ${l.nom} » déborde de ${l.debord} px`).join(" ; "),
  );
}

await navigateur.close();

if (plaintes.length) {
  console.log(`\n✗ ${plaintes.length} défaut(s) sur la planche.`);
  process.exit(1);
}
console.log("\n✓ La planche se manipule sans script, et dit ce qu'elle prétend dire.");
