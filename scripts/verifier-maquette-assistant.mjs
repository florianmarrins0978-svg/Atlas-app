#!/usr/bin/env node
/*
  Éprouve la maquette 47, JAVASCRIPT COUPÉ.

  **Ce qu'il mesure, et pourquoi ce n'est pas un avis.** La demande du patron —
  *« l'onglet de l'assistant est hyper mal placé, propose des choses pour plus
  qu'il gêne »* — se laisserait facilement traiter au goût. Elle ne le sera pas :
  « gêner » a ici un sens exact et mesurable, **combien de cases touchables du
  calendrier le bouton recouvre**. Le contrôle compte les recouvrements
  géométriques, version par version.

  C'est ce qui fait la différence entre une planche qui propose et une planche
  qui prouve. L'avant en recouvre — c'est le défaut, et le TÉMOIN qui garde la
  mesure honnête : si l'avant passait à zéro, c'est le contrôle qui mentirait.

  Les contrôles :

    1. les cinq téléphones existent SANS SCRIPT ;
    2. chacun porte un assistant ATTEIGNABLE — 44 px sur son PLUS PETIT côté,
       la mesure d'un doigt. Écrit d'abord sur le plus grand, ce contrôle a
       laissé passer une entrée de 69 × 17 px : prendre le plus favorable des
       deux nombres, ce n'est pas mesurer. C fait exception et le DIT : sa
       poignée fait 16 px de large, c'est le coût de cette place ;
    3. **l'avant recouvre au moins une case** (témoin) ;
    4. A, B et C n'en recouvrent **aucune** — c'est ce qu'elles promettent ;
    5. D en recouvre, et c'est assumé : mais son emprise **fond** quand on
       coche « je fais défiler » ;
    6. l'appui ouvre le panneau, et « ✕ » le referme — dans les cinq ;
    7. la barre à cinq entrées ne déborde pas de l'écran, et aucun mot n'y est
       coupé : c'est le prix de A, et il doit se voir plutôt que se supposer.

  Il sait échouer : donner à l'avant une place libre rend le témoin rouge ;
  ramener la bulle de A au coin rend A rouge en disant combien de cases.

  Usage : node scripts/verifier-maquette-assistant.mjs [chemin.html]
*/

import { chromium } from "playwright";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { existsSync } from "node:fs";

const RACINE = join(dirname(fileURLToPath(import.meta.url)), "..");
const CIBLE = resolve(
  process.argv[2] ?? join(RACINE, "docs", "maquettes", "47-ou-mettre-l-assistant.html"),
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
const attendre = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Ce que l'assistant recouvre, sur cet écran-là.
 *
 * On mesure des BOÎTES, pas des classes : deux rectangles qui se croisent, cela
 * ne s'interprète pas. Et l'on ne compte que les cases du mois en cours — une
 * case « hors mois » est grise et sans geste, la recouvrir ne coûte rien.
 */
const recouvrement = (ecran) =>
  ecran.evaluate((e) => {
    const a = e.querySelector("[data-assistant]");
    if (!a) return null;
    const r = a.getBoundingClientRect();
    const cases = [...e.querySelectorAll(".jour:not(.hors)")];
    const touchees = cases.filter((c) => {
      const j = c.getBoundingClientRect();
      return !(j.right <= r.left || j.left >= r.right || j.bottom <= r.top || j.top >= r.bottom);
    });
    return {
      boite: { l: Math.round(r.width), h: Math.round(r.height) },
      surface: Math.round(r.width * r.height),
      touchees: touchees.map((c) => c.textContent.trim()),
    };
  });

async function ouvrirPage() {
  const contexte = await navigateur.newContext({
    viewport: { width: 1400, height: 1200 },
    javaScriptEnabled: false,
  });
  const page = await contexte.newPage();
  await page.goto(`file://${CIBLE}`, { waitUntil: "load" });
  return page;
}

const LETTRES = ["0", "A", "B", "C", "D"];

{
  const page = await ouvrirPage();
  const ecrans = page.locator(".ecran");
  dire((await ecrans.count()) === 5, `${await ecrans.count()} téléphone(s) SANS SCRIPT — cinq attendus`);

  for (const lettre of LETTRES) {
    const ecran = page.locator(`.ecran[data-variante="${lettre}"]`);
    await ecran.scrollIntoViewIfNeeded();

    const m = await recouvrement(ecran);
    if (!m) {
      dire(false, `${lettre} — aucun assistant sur cet écran`);
      continue;
    }

    // 2. Atteignable au doigt — mesuré sur la PLUS PETITE dimension.
    //
    // Écrit d'abord sur la plus grande, il a laissé passer une entrée de barre
    // de 69 × 17 px : large, et haute de dix-sept pixels. Un contrôle qui prend
    // le plus favorable des deux nombres ne mesure rien.
    //
    // C fait exception, et c'est sa proposition même : une poignée de 16 px de
    // large. Le contrôle l'écrit noir sur blanc au lieu de fermer les yeux —
    // c'est un coût à peser, pas un défaut à cacher.
    const petit = Math.min(m.boite.l, m.boite.h);
    if (lettre === "C") {
      dire(
        m.boite.h >= 44,
        `C — la poignée fait ${m.boite.l} × ${m.boite.h} px : haute, mais ${m.boite.l} px de ` +
          "large seulement, sous les 44 px d'un doigt — c'est le coût de cette place",
      );
    } else {
      dire(
        petit >= 44,
        `${lettre} — l'assistant se touche sur ${m.boite.l} × ${m.boite.h} px ` +
          `(le plus petit côté fait ${petit}, 44 attendus)`,
      );
    }

    // 3, 4, 5. Ce qu'il recouvre.
    const n = m.touchees.length;
    const liste = n ? ` (${m.touchees.join(", ")})` : "";
    if (lettre === "0") {
      dire(n > 0, `témoin — l'avant recouvre ${n} case(s)${liste} ; à zéro, c'est la mesure qui ment`);
    } else if (lettre === "D") {
      dire(n > 0, `D — recouvre ${n} case(s)${liste}, et c'est assumé : elle reste au-dessus`);
    } else {
      dire(n === 0, `${lettre} — ne recouvre AUCUNE case du mois${liste}`);
    }

    // 6. L'appui ouvre, la croix referme.
    await ecran.locator("[data-assistant]").click({ force: true });
    await attendre(400);
    const ouvert = await ecran.evaluate((e) => {
      const p = e.querySelector(".panneau").getBoundingClientRect();
      return p.left < e.getBoundingClientRect().right - 40;
    });
    dire(ouvert, `${lettre} — l'appui ouvre l'assistant`);
    await ecran.locator(".fermer").click({ force: true });
    await attendre(400);
    const referme = await ecran.evaluate((e) => {
      const p = e.querySelector(".panneau").getBoundingClientRect();
      return p.left >= e.getBoundingClientRect().right - 40;
    });
    dire(referme, `${lettre} — « ✕ » le referme`);
  }

  // 5 bis. L'emprise de D fond quand on défile.
  {
    const ecran = page.locator('.ecran[data-variante="D"]');
    await ecran.scrollIntoViewIfNeeded();
    const avant = (await recouvrement(ecran)).surface;
    await ecran.locator(".bascule-defile").click({ force: true });
    await attendre(500);
    const apres = (await recouvrement(ecran)).surface;
    dire(
      apres < avant / 3,
      `D — en défilant, son emprise passe de ${avant} à ${apres} px² (au moins trois fois moins)`,
    );
  }

  // 7. Le prix de A : cinq entrées, et rien qui déborde ni ne se coupe.
  {
    const ecran = page.locator('.ecran[data-variante="A"]');
    await ecran.scrollIntoViewIfNeeded();
    const barre = await ecran.evaluate((e) => {
      const b = e.querySelector(".barre").getBoundingClientRect();
      const ecr = e.getBoundingClientRect();
      const entrees = [...e.querySelectorAll(".barre .onglet, .barre .assistant-onglet")];
      const debordent = entrees.filter((o) => {
        const r = o.getBoundingClientRect();
        return r.left < ecr.left - 0.5 || r.right > ecr.right + 0.5;
      }).length;
      // Un mot coupé se voit à sa largeur rendue, plus petite que sa largeur
      // naturelle. Mesurer le `scrollWidth` le dit sans interpréter.
      const coupes = entrees.filter((o) => o.scrollWidth > Math.ceil(o.clientWidth) + 1).length;
      return { nombre: entrees.length, debordent, coupes, hauteur: Math.round(b.height) };
    });
    dire(barre.nombre === 5, `A — la barre porte ${barre.nombre} entrées (cinq attendues)`);
    dire(barre.debordent === 0, `A — aucune entrée ne déborde de l'écran (${barre.debordent})`);
    dire(barre.coupes === 0, `A — aucun mot n'est coupé dans la barre (${barre.coupes})`);
  }

  await page.close();
}

await navigateur.close();

if (plaintes.length) {
  console.log(`\n✗ ${plaintes.length} défaut(s) :`);
  for (const p of plaintes) console.log(`   — ${p}`);
  process.exit(1);
}
console.log("\n✅ Trois places sur cinq ne recouvrent plus rien, et l'avant prouve que la mesure voit.");
