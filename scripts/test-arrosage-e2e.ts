import { lancerNavigateur } from "./e2e-browser";
import assert from "node:assert/strict";

// L'écran « Plan d'arrosage », DANS l'application — sa demande du 20 août 2026 :
// *« code le tout dans l'appli »*.
//
// **CE QUE CETTE SUITE TIENT, ET QU'AUCUNE SUITE BASE NE VERRAIT :**
//
//   1. **le chemin existe.** Paysage ouvrait jusqu'ici une page HORS d'Atlas ;
//      il doit maintenant mener à un écran interne. C'est le raccord qui casse,
//      jamais la formule ;
//   2. **l'écran tient en peu de mots.** Sa demande, quatre fois répétée en dix
//      jours : « beaucoup trop de mots dans tous les sens ». Un plafond compté
//      ici empêche l'écran de regrossir — corriger un écran de plus n'a jamais
//      rien réglé ;
//   3. **rien ne déborde à 390 px**, la largeur de son téléphone ;
//   4. **l'absence de clé d'IA se DIT**, avant le geste. Le laisser
//      photographier pour rien serait le troisième bouton qui ne répond pas ;
//   5. **aucun chiffre n'est annoncé tant que rien n'est calculé.** « 0,00 m³/h »
//      se lirait comme une mesure.

const BASE = "http://localhost:3000";

let echecs = 0;
async function cas(nom: string, fn: () => Promise<void>) {
  try {
    await fn();
    console.log(`  ✓ ${nom}`);
  } catch (e) {
    echecs++;
    console.error(`  ✗ ${nom}\n    ${(e as Error).message}`);
  }
}

async function main() {
  const navigateur = await lancerNavigateur();
  const contexte = await navigateur.newContext({ viewport: { width: 390, height: 900 } });
  const page = await contexte.newPage();

  await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  await page.fill('input[name="email"]', "demo@atlas.local");
  await page.fill('input[name="password"]', "demo1234");
  await page.click('button[type="submit"]');
  await page.waitForURL(`${BASE}/`, { timeout: 20_000 });

  await cas("depuis Paysage, l'arrosage s'ouvre DANS l'application", async () => {
    await page.goto(`${BASE}/paysage`, { waitUntil: "networkidle" });
    const lien = page.locator('a[href="/paysage/arrosage"]');
    assert.ok(
      (await lien.count()) >= 1,
      "aucun lien vers l'arrosage interne : l'écran Paysage renvoie encore dehors"
    );
    // **Et il ne s'ouvre plus dans un autre onglet.** C'était la marque d'une
    // page publiée à côté ; la garder ferait sortir de l'application pour rien.
    assert.equal(
      await lien.first().getAttribute("target"),
      null,
      "le lien s'ouvre encore hors de l'application"
    );
    await lien.first().click();
    await page.waitForURL(`${BASE}/paysage/arrosage`, { timeout: 20_000 });
  });

  await cas("l'écran porte le titre, le piquage, la mesure et le croquis", async () => {
    await page.locator("h1").first().waitFor({ timeout: 30_000 });
    const texte = await page.locator("body").innerText();
    assert.match(texte, /Plan d.arrosage/i, `le titre manque :\n${texte.slice(0, 200)}`);
    assert.match(texte, /piquage se fait/i, "le libellé du piquage manque");
    assert.equal(await page.locator('select[name="piquage"]').count(), 1, "le déroulant du piquage manque");
    for (const champ of ["litres", "secondes", "bar"]) {
      assert.equal(
        await page.locator(`input[name="${champ}"]`).count(),
        1,
        `la case « ${champ} » de la mesure au seau manque`
      );
    }
    assert.equal(
      await page.locator('input[name="croquis"]').count(),
      1,
      "le champ de la photo du croquis manque"
    );
  });

  // ── L'écran ne regagne pas de mots ────────────────────────────────────────
  //
  // **C'est ce que le dépôt réclamait depuis quatre plaintes** : un contrôle qui
  // rougit quand un écran grossit. Le plafond n'est pas une cible — c'est ce que
  // l'écran pèse, plus une marge.
  await cas("l'écran tient en peu de mots", async () => {
    // **`innerText`, jamais `textContent`.** Le second rend TOUT le document,
    // menus repliés et gabarits cachés compris : il annonçait 270 mots là où
    // l'écran en montre une quarantaine, et accusait l'écran d'avoir regagné
    // 240 mots qu'il ne portait pas. Un contrôle qui accuse à tort coûte plus
    // cher que pas de contrôle (`CLAUDE.md` §5).
    //
    // **Aucune fonction NOMMÉE dans `page.evaluate`.** Le compilateur de ce
    // dépôt injecte un helper `__name` dans les fonctions qu'il nomme ; envoyé
    // au navigateur, ce helper n'existe pas et l'évaluation tombe sur
    // « __name is not defined » — une panne qui n'a rien à voir avec l'écran.
    const mots = await page.evaluate(() => {
      const vu = (document.querySelector("form") as HTMLElement | null)?.innerText ?? "";
      // D'un menu fermé, seule l'option retenue se voit — mais `innerText` les
      // rend toutes. On retire donc celles qui ne sont pas choisies, et
      // l'étiquette du bouton d'envoi, réservée aux lecteurs d'écran.
      const aRetirer = [
        ...[...document.querySelectorAll("select option")].filter(
          (o) => !(o as HTMLOptionElement).selected
        ),
        ...document.querySelectorAll(".sr-only"),
        // **Une ALERTE n'est pas du bavardage.** « Aucune clé d'IA » ou le
        // motif d'un croquis refusé sont là pour être lus quand quelque chose
        // cloche — et n'apparaissent pas quand tout va bien. Les compter
        // ferait rougir le plafond sur un banc sans clé, pour un écran qui,
        // chez lui, ne les montre pas.
        ...document.querySelectorAll('[data-atlas="alerte"]'),
      ]
        .map((e) => e.textContent ?? "")
        .join(" ");
      const motsVus = vu.split(/\s+/).filter((m) => /[\p{L}\p{N}]/u.test(m)).length;
      const motsCaches = aRetirer.split(/\s+/).filter((m) => /[\p{L}\p{N}]/u.test(m)).length;
      return motsVus - motsCaches;
    });
    const PLAFOND = 30;
    assert.ok(
      mots <= PLAFOND,
      `l'écran porte ${mots} mots pour un plafond de ${PLAFOND} : il en a regagné ${mots - PLAFOND}`
    );
  });

  await cas("aucun chiffre n'est annoncé tant que rien n'est calculé", async () => {
    const texte = await page.locator("body").innerText();
    // Un « 0,00 m³/h » posé d'avance se lirait comme une mesure faite.
    assert.doesNotMatch(texte, /0,00\s*m³\/h/, "un débit nul s'affiche avant toute mesure");
    assert.equal(
      await page.locator('[data-atlas="plan-arrosage"]').count(),
      0,
      "le plan s'affiche avant qu'aucun croquis n'ait été lu"
    );
  });

  await cas("rien ne déborde sur la largeur de son téléphone", async () => {
    const m = await page.evaluate(() => ({
      page: document.documentElement.scrollWidth,
      vue: window.innerWidth,
      // **Ce qu'on TOUCHE, pas ce qu'on lit.** La première version comptait
      // aussi les étiquettes « Litres », « Secondes », « Bar » — dix pixels de
      // haut, et personne n'a jamais eu à les viser. Elle accusait l'écran de
      // porter cinq cibles trop petites qui n'en sont pas.
      petits: [...document.querySelectorAll('[data-atlas="ajouter-croquis"], select, input[type="number"]')]
        .map((e) => e.getBoundingClientRect())
        .filter((r) => r.height > 0 && r.height < 28).length,
    }));
    assert.ok(
      m.page <= m.vue + 1,
      `l'écran déborde de ${m.page - m.vue} px : il faut le glisser de côté pour tout lire`
    );
    assert.equal(m.petits, 0, `${m.petits} geste(s) de moins de 28 px de haut : on les rate au doigt`);
  });

  // ── L'IA absente se dit AVANT le geste ────────────────────────────────────
  //
  // Sur ce banc, aucune clé n'est posée : l'écran doit donc l'annoncer. Chez
  // lui, les clés existent et la phrase disparaît.
  await cas("sans clé d'IA, l'écran le dit avant de faire photographier", async () => {
    const texte = await page.locator("body").innerText();
    const aLaCle = await page.evaluate(() => document.body.innerText.includes("Aucune clé"));
    if (!aLaCle) {
      // Une clé est posée sur ce serveur : le cas ne se produit pas ici, et le
      // dire vaut mieux que de laisser croire à une vérification qui n'a pas eu
      // lieu (`CLAUDE.md` §5).
      console.log("    (une clé d'IA est posée sur ce banc : rien à vérifier)");
      return;
    }
    assert.match(
      texte,
      /Aucune clé d.IA[\s\S]*ne sera pas lu/,
      "l'écran ne dit pas que le croquis ne sera pas lu"
    );
  });

  await contexte.close();
  await navigateur.close();

  console.log(`\n${echecs === 0 ? "✅" : "❌"} Le plan d'arrosage, dans l'application — ${echecs} échec(s).`);
  process.exit(echecs === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
