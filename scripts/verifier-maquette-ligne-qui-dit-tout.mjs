#!/usr/bin/env node
/*
  Éprouve la maquette 55, JAVASCRIPT COUPÉ.

  **Ce qu'elle promet, et qui doit être mesuré plutôt que cru :** la ligne du
  planning porte désormais TROIS choses — la date, le moment (matin,
  après-midi, journée) et le nombre de jours. C'est plus long qu'avant, et à
  390 px la place est comptée : c'est exactement ainsi qu'un nom de chantier
  s'est retrouvé coupé le 12 août.

  Les contrôles :

    1. l'écran existe SANS SCRIPT, et porte ses CINQ cas — la journée pleine,
       les deux demi-journées, le chantier long, et celui qui part l'après-midi.
       Quatre lignes suffiraient à faire joli et cacheraient un cas ;
    2. les trois mots qu'il a demandés sont présents : **matin, après-midi,
       journée** — et un nombre de jours sur chaque ligne où il doit être ;

    2 bis. **le vocabulaire des durées est celui du dépôt, mot pour mot.**
       `src/lib/durees-chantier.ts` dit « ½ journée », « 1 journée », puis
       « 3 jours » — et le dit depuis le 4 août 2026, sur une correction du
       patron. La planche a écrit « ½ jour » quand même, et il a dû la reprendre
       une seconde fois : *« 1/2 journée pas jour ! »*. Le contrôle lit donc la
       liste réelle et refuse tout libellé qui n'en vient pas. Une règle déjà
       écrite dans le dépôt et enfreinte deux fois n'est pas une règle : c'est
       un contrôle qui manque ;
    3. **rien ne déborde** : ni le nom du chantier, ni la phrase. Les deux sont
       en `nowrap` avec des points de suspension, donc un dépassement se lit en
       pixels et se dit en pixels, pas en « ça a l'air juste » ;
    4. la phrase tient sur **une seule ligne** dans les quatre combinaisons de
       réglages ;
    5. **« matin » ne se retrouve JAMAIS seul** sur une ligne de plus d'une
       demi-journée. C'est le défaut qu'il a signalé le 13 août, et ce contrôle
       existe pour qu'un allègement futur ne le rouvre pas sans le dire ;
    6. l'or suit le réglage : sur toute la phrase, ou sur le seul nombre.

  Il sait échouer, et chaque échec nomme le bon coupable : allonger un nom rend
  le 3 rouge en disant de combien ; retirer « · 3 jours » de la ligne longue rend
  le 5 rouge en citant la ligne ; casser le sélecteur de l'or rend le 6 rouge en
  donnant la couleur trouvée.

  Usage : node scripts/verifier-maquette-ligne-qui-dit-tout.mjs [chemin.html]
*/

import { chromium } from "playwright";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { existsSync, readFileSync } from "node:fs";

const RACINE = join(dirname(fileURLToPath(import.meta.url)), "..");
const CIBLE = resolve(
  process.argv[2] ?? join(RACINE, "docs", "maquettes", "55-la-ligne-qui-dit-tout.html"),
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

const OR = "rgb(185, 139, 71)"; // --e-or:#B98B47, en clair
const GRIS = "rgb(138, 133, 120)"; // --e-gris:#8a8578

/**
 * Les libellés de durée, LUS DANS LE DÉPÔT plutôt que recopiés ici.
 *
 * Recopiés, ils auraient dérivé le jour où la liste change — et le contrôle
 * aurait alors défendu un vocabulaire mort contre le vrai. On lit donc la
 * source : « ½ journée » vient de la première entrée, « 1 journée » et
 * « N jours » de la boucle. Si `durees-chantier.ts` est introuvable, le contrôle
 * le DIT au lieu de passer au vert en silence — un contrôle qui s'éteint tout
 * seul est pire que pas de contrôle.
 */
function libellesDeDuree() {
  const source = join(RACINE, "src", "lib", "durees-chantier.ts");
  if (!existsSync(source)) return null;
  const texte = readFileSync(source, "utf8");
  const demi = texte.match(/demiJournees:\s*1,\s*libelle:\s*"([^"]+)"/)?.[1];
  const une = texte.match(/libelle:\s*i === 0 \? "([^"]+)"/)?.[1];
  const plusieurs = texte.match(/: `\$\{i \+ 1\} ([^`]+)`/)?.[1];
  if (!demi || !une || !plusieurs) return null;
  return { demi, une, plusieurs: plusieurs.trim() };
}

const contexte = await navigateur.newContext({
  viewport: { width: 1400, height: 1400 },
  javaScriptEnabled: false,
});
const page = await contexte.newPage();
await page.goto(`file://${CIBLE}`, { waitUntil: "load" });

/** Ce que l'écran montre RÉELLEMENT, réglages en l'état. */
const lire = () =>
  page.evaluate(() =>
    [...document.querySelectorAll(".ecran .ligne")].map((l) => {
      const nom = l.querySelector(".nom");
      const quand = l.querySelector(".quand");
      const nb = quand.querySelector(".nb");
      const visible = (e) => e && getComputedStyle(e).display !== "none" &&
        e.getBoundingClientRect().width > 0;
      /**
       * Le texte RÉELLEMENT LU par l'œil, et non `textContent`.
       *
       * `textContent` rend aussi ce qui est éteint : la première version de ce
       * contrôle lisait « 14 août · journéematin · 1 journée » et accusait la
       * planche d'un défaut qu'elle n'avait pas. Un contrôle qui mesure autre
       * chose que l'écran ne prouve rien, et il coûte le temps de comprendre
       * qu'il a tort.
       */
      const lu = (n) =>
        [...n.childNodes]
          .map((e) =>
            e.nodeType === 3 ? e.data : visible(e) ? lu(e) : "",
          )
          .join("");
      return {
        nom: nom.textContent.trim(),
        // Un texte coupé est toujours ENTIER dans le DOM : c'est la boîte qui
        // le rogne. Seul l'écart des deux largeurs le dit.
        debordNom: nom.scrollWidth - nom.clientWidth,
        texte: lu(quand).trim().replace(/\s+/g, " "),
        debordQuand: quand.scrollWidth - quand.clientWidth,
        hauteur: Math.round(quand.getBoundingClientRect().height),
        teinteQuand: getComputedStyle(quand).color,
        teinteNombre: nb && visible(nb) ? getComputedStyle(nb).color : null,
        nombreVisible: nb ? visible(nb) : false,
      };
    }),
  );

// 1. Les cinq cas.
{
  const lignes = await lire();
  dire(lignes.length === 5, `${lignes.length} ligne(s) de chantier SANS SCRIPT — cinq attendues`);

  // 2. Les trois mots qu'il a demandés, et le nombre.
  const tout = lignes.map((l) => l.texte).join(" | ");
  for (const mot of ["matin", "après-midi", "journée"]) {
    dire(tout.includes(mot), `« ${mot} » est présent sur la liste`);
  }
  // 2 bis. Le vocabulaire des durées, celui du dépôt et pas un autre.
  const mots = libellesDeDuree();
  if (!mots) {
    dire(false, "impossible de lire les libellés de durée dans src/lib/durees-chantier.ts — " +
      "le contrôle du vocabulaire ne peut PAS se prononcer (il ne passe pas au vert pour autant)");
  } else {
    // « ½ journée », « 1 journée », « 3 jours » : rien d'autre n'est admis.
    const admis = new RegExp(
      `^(${mots.demi.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}|${mots.une}|\\d+ ${mots.plusieurs})$`,
    );
    const durees = await page.evaluate(() =>
      [...document.querySelectorAll(".ecran .nb")].map((n) => n.textContent.trim()),
    );
    const etrangers = durees.filter((d) => !admis.test(d));
    dire(
      etrangers.length === 0,
      etrangers.length === 0
        ? `les durées écrites viennent de DUREES (« ${mots.demi} », « ${mots.une} », « N ${mots.plusieurs} »)`
        : `${etrangers.length} durée(s) hors du vocabulaire du dépôt : ` +
            etrangers.map((d) => `« ${d} »`).join(", ") +
            ` — DUREES dit « ${mots.demi} », « ${mots.une} », « N ${mots.plusieurs} »`,
    );
  }
}

const COMBINAISONS = [
  { pleine: "j-deux", teinte: "o-tout", dit: "« journée » seule, tout en or" },
  { pleine: "j-deux", teinte: "o-nombre", dit: "« journée » seule, le nombre seul en or" },
  { pleine: "j-un", teinte: "o-tout", dit: "« matin · 1 journée », tout en or" },
  { pleine: "j-un", teinte: "o-nombre", dit: "« matin · 1 journée », le nombre seul en or" },
];

for (const { pleine, teinte, dit } of COMBINAISONS) {
  await page.locator(`label[for="${pleine}"]`).click();
  await page.locator(`label[for="${teinte}"]`).click();
  const lignes = await lire();

  // 3. Rien ne déborde — le nom d'abord, c'est lui qui dit de quel chantier
  //    il s'agit, et c'est lui qui payait la place les fois précédentes.
  const nomsCoupes = lignes.filter((l) => l.debordNom > 0);
  const phrasesCoupees = lignes.filter((l) => l.debordQuand > 0);
  dire(
    nomsCoupes.length === 0,
    nomsCoupes.length === 0
      ? `${dit} — aucun nom de chantier coupé à 390 px`
      : `${dit} — ${nomsCoupes.length} nom(s) coupé(s) : ` +
          nomsCoupes.map((l) => `« ${l.nom} » déborde de ${l.debordNom} px`).join(" ; "),
  );
  dire(
    phrasesCoupees.length === 0,
    phrasesCoupees.length === 0
      ? `${dit} — aucune phrase coupée à 390 px`
      : `${dit} — ${phrasesCoupees.length} phrase(s) coupée(s) : ` +
          phrasesCoupees.map((l) => `« ${l.texte} » déborde de ${l.debordQuand} px`).join(" ; "),
  );

  // 4. Une seule ligne de texte.
  const haute = lignes.filter((l) => l.hauteur > 20);
  dire(
    haute.length === 0,
    haute.length === 0
      ? `${dit} — la phrase tient sur une ligne`
      : `${dit} — ${haute.length} phrase(s) sur deux lignes : ` +
          haute.map((l) => `« ${l.texte} » fait ${l.hauteur} px`).join(" ; "),
  );

  // 5. « matin » jamais seul au-delà d'une demi-journée.
  //
  //    Le contrôle qui garde sa plainte du 13 août. Une ligne qui commence par
  //    un moment DOIT porter un nombre : sans lui, « matin » redit que seule la
  //    matinée est bloquée — et personne ne s'en apercevrait avant sa capture.
  //    On interroge la PRÉSENCE du nombre, pas le texte : « journée » contient
  //    déjà « jour », et un contrôle qui cherche cette chaîne se déclarerait
  //    satisfait par une ligne qui n'a aucune durée.
  const trompeuses = lignes.filter(
    (l) => /(matin|après-midi)/.test(l.texte) && !l.nombreVisible,
  );
  dire(
    trompeuses.length === 0,
    trompeuses.length === 0
      ? `${dit} — aucun moment n'est écrit sans son nombre de jours`
      : `${dit} — ${trompeuses.length} ligne(s) écrivent un moment tout seul, ` +
          `le défaut du 13 août : ` + trompeuses.map((l) => `« ${l.texte} »`).join(" ; "),
  );

  // 6. L'or suit le réglage — la couleur calculée, jamais le nom d'une classe.
  if (teinte === "o-tout") {
    const fautives = lignes.filter((l) => l.teinteQuand !== OR);
    dire(
      fautives.length === 0,
      fautives.length === 0
        ? `${dit} — toute la phrase est dans l'or de l'écran`
        : `${dit} — ${fautives.length} phrase(s) hors de l'or : ` +
            fautives.map((l) => `« ${l.texte} » porte ${l.teinteQuand}`).join(" ; "),
    );
  } else {
    const fautives = lignes.filter(
      (l) => l.teinteQuand !== GRIS || (l.nombreVisible && l.teinteNombre !== OR),
    );
    dire(
      fautives.length === 0,
      fautives.length === 0
        ? `${dit} — la phrase est grise, le seul nombre est en or`
        : `${dit} — ${fautives.length} ligne(s) mal teintées : ` +
            fautives
              .map(
                (l) =>
                  `« ${l.texte} » → phrase ${l.teinteQuand}, nombre ${l.teinteNombre ?? "absent"}`,
              )
              .join(" ; "),
    );
  }
}

await navigateur.close();

if (plaintes.length) {
  console.log(`\n✗ ${plaintes.length} défaut(s) sur la planche.`);
  process.exit(1);
}
console.log("\n✓ La planche se manipule sans script, et dit ce qu'elle prétend dire.");
