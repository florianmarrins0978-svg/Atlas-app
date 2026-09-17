import { lancerNavigateur } from "./e2e-browser";
import assert from "node:assert";
import { ADRESSE } from "./_adresse";

/**
 * « EN COURS 19 » RESTE À L'ÉCRAN TANT QU'IL Y A DES CHANTIERS.
 *
 * **Sa demande du 16 septembre 2026, capture à l'appui :** *« quand je descends,
 * le "en cours" disparaît ; il doit rester visible tant qu'il y a des
 * chantiers »*.
 *
 * Ce qu'il voyait : la rubrique vit DANS le fil qui défile (elle y est descendue
 * le 6 septembre pour être collée à ce qu'elle compte, `EcranChantiers.tsx`), et
 * elle partait donc par le haut dès le premier geste. Passé trois chantiers, il
 * ne restait qu'une suite de dates sans rien dire de combien il en a.
 *
 * **POURQUOI UNE SUITE NAVIGATEUR, ET NON UNE LECTURE DE LA SOURCE.** Ce qui
 * est en cause n'est pas ce qui est écrit mais ce qui est PEINT, après
 * défilement : `position: sticky` ne tient que si aucun ancêtre ne le casse
 * (`overflow` intermédiaire, conteneur trop court) et le fil porte en plus un
 * fondu de 18 px en haut — un titre cloué dedans serait à moitié effacé, donc
 * présent pour un `grep` et illisible pour lui (`CLAUDE.md` §5).
 *
 * **Elle refuse de conclure** plutôt que de rendre un vert creux : si le fil ne
 * défile pas, ou si la rubrique mesure zéro pixel, il n'y a rien à mesurer —
 * l'absence de matière n'est pas un succès (`CLAUDE.md` §5).
 *
 * **Sait échouer** : jouée sur l'écran d'avant ce lot, elle tombe sur « la
 * rubrique est sortie par le haut ».
 */

const BASE = ADRESSE;

async function main() {
  const browser = await lancerNavigateur();
  const context = await browser.newContext();
  const page = await context.newPage();

  await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  await page.fill('input[name="email"]', "demo@atlas.local");
  await page.fill('input[name="password"]', "demo1234");
  await page.click('button[type="submit"]');
  await page.waitForURL(`${BASE}/`, { timeout: 10000 });
  await page.goto(`${BASE}/`, { waitUntil: "networkidle" });

  const fil = page.locator(".atlas-fil-defile");
  const compteur = page.locator('[data-atlas="compteur"]');
  // Le MOT, pas le cadre : c'est lui qu'il lit, et c'est lui que le fondu du
  // haut peut effacer pendant que le cadre, lui, serait bien « à l'écran ».
  const mot = compteur.locator("span").first();
  await mot.waitFor({ state: "visible" });

  const combien = Number(await compteur.getAttribute("data-compte"));
  assert.ok(combien >= 1, `Rien à mesurer : la liste annonce ${combien} chantier(s) en cours`);

  // ── Ce qui rend la mesure possible, vérifié avant de mesurer ──────────────
  const mesures = await fil.evaluate((cadre) => ({
    hauteurVisible: cadre.clientHeight,
    hauteurTotale: cadre.scrollHeight,
    // Le fondu réellement appliqué, lu sur le cadre plutôt que recopié d'une
    // valeur du CSS : recopié, il vieillirait sans que rien ne le dise.
    fondu: Number(
      (getComputedStyle(cadre).maskImage || "").match(/(\d+(?:\.\d+)?)px/)?.[1] ?? NaN
    ),
  }));
  const course = mesures.hauteurTotale - mesures.hauteurVisible;
  assert.ok(
    course > 60,
    `Le fil ne défile que de ${course} px : rien à mesurer ici — il faut assez de chantiers`
  );
  assert.ok(
    Number.isFinite(mesures.fondu),
    "Le fondu du haut du fil n'a pas pu être lu : mesure impossible, pas un succès"
  );

  const cadreAvant = await fil.boundingBox();
  const motAvant = await mot.boundingBox();
  assert.ok(cadreAvant && motAvant, "Le fil ou la rubrique n'a pas de boîte : mesure impossible");
  assert.ok(
    motAvant.width > 0 && motAvant.height > 0,
    `La rubrique mesure ${motAvant.width} × ${motAvant.height} : une boîte de zéro pixel ne prouve rien`
  );

  // ── Le geste du patron : il descend ───────────────────────────────────────
  await fil.evaluate((cadre) => {
    cadre.scrollTop = cadre.scrollHeight;
  });
  // Deux images : le temps que le clouage soit peint, et non seulement calculé.
  await page.evaluate(
    () => new Promise((f) => requestAnimationFrame(() => requestAnimationFrame(() => f(null))))
  );

  const parcouru = await fil.evaluate((cadre) => cadre.scrollTop);
  assert.ok(parcouru > 60, `La liste n'a descendu que de ${parcouru} px : le geste n'a pas eu lieu`);

  const cadre = await fil.boundingBox();
  const apres = await mot.boundingBox();
  const bande = await compteur.boundingBox();
  assert.ok(cadre && apres && bande, "La rubrique a disparu du document après défilement");
  assert.ok(
    apres.height > 0,
    "La rubrique mesure zéro pixel de haut après défilement : mesure impossible"
  );

  // 1. Elle est encore DANS le cadre — pas sortie par le haut.
  assert.ok(
    apres.y >= cadre.y - 0.5 && apres.y + apres.height <= cadre.y + cadre.height + 0.5,
    `« En cours » est sortie du fil après ${Math.round(parcouru)} px : elle est à ${Math.round(apres.y - cadre.y)} px du haut, pour un cadre de ${Math.round(cadre.height)} px`
  );

  // 1 bis. Et elle est clouée AU BORD, pas dix pixels plus bas : une marge
  //        intérieure sur le cadre rétrécit la zone où `sticky` peut clouer, et
  //        les chantiers défilent dans la bande laissée libre au-dessus —
  //        c'est ce qu'on a vu sur la capture, pas dans le code.
  assert.ok(
    bande.y <= cadre.y + 0.5,
    `La bande « En cours » est clouée ${Math.round(bande.y - cadre.y)} px sous le bord du fil : les chantiers passent au-dessus d'elle`
  );

  // 2. Et elle est LISIBLE : sous le fondu, pas dedans. Un mot à demi effacé
  //    est présent pour une mesure d'appartenance et absent pour son œil.
  assert.ok(
    apres.y >= cadre.y + mesures.fondu - 0.5,
    `« En cours » est clouée dans le fondu du haut (${Math.round(apres.y - cadre.y)} px, fondu de ${mesures.fondu} px) : elle s'y lit à demi effacée`
  );

  // 3. Elle n'est pas recouverte par les chantiers qui passent dessous : c'est
  //    elle que le doigt trouve au point qu'elle occupe.
  const dessus = await page.evaluate(
    ({ x, y }) => {
      const el = document.elementFromPoint(x, y);
      return el?.closest('[data-atlas="compteur"]') ? "la rubrique" : (el?.textContent ?? "").trim().slice(0, 40);
    },
    { x: apres.x + apres.width / 2, y: apres.y + apres.height / 2 }
  );
  assert.equal(dessus, "la rubrique", `Un chantier passe DEVANT « En cours » : on y lit « ${dessus} »`);

  await browser.close();
  console.log(`✅ « En cours ${combien} » reste lisible après ${Math.round(parcouru)} px de défilement`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
