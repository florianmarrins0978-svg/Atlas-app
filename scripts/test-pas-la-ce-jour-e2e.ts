import assert from "node:assert/strict";
import { lancerNavigateur } from "./e2e-browser";
import { ADRESSE } from "./_adresse";

// FERMER UN JOUR DEPUIS LE PLANNING — sa demande du 6 septembre 2026.
//
// **Ce que ce lot NE fait pas, et qu'il ne faut pas croire.** Il ne décide rien
// de la disponibilité : fermer un jour écrit une absence d'un jour, la même
// ligne que l'écran des Réglages, et c'est `fusionnerAbsences` qui retire la
// place depuis le 14 août. Que l'absence enlève bien le jour aux clients est
// tenu ailleurs (`test-absence-equipe-e2e.ts`) — ici on éprouve LE GESTE.
//
// **Éprouver le geste du patron, pas la fonction qu'on vient d'écrire**
// (`CLAUDE.md` §5 quater) : on part du planning, on touche un jour comme lui,
// et l'on regarde ce que l'écran propose. Une suite qui appellerait l'action
// serveur directement laisserait passer une carte où le geste n'apparaît pas.
//
// **CE QUI SE VÉRIFIE APRÈS RECHARGEMENT.** L'écran est optimiste : il barre le
// jour avant que le serveur réponde. Sans recharger, on mesurerait l'espoir de
// l'écran et non ce que la base porte — et un jour qu'il croit fermé et qui
// part chez un client est exactement ce qu'on cherche à éviter.
//
// Usage : npm run test:e2e -- --seulement pas-la-ce-jour

const BASE = ADRESSE;

let echecs = 0;
async function cas(nom: string, verifier: () => Promise<void>) {
  try {
    await verifier();
    console.log(`  ✓ ${nom}`);
  } catch (e) {
    echecs++;
    console.error(`  ✗ ${nom}\n    ${(e as Error).message}`);
  }
}

/** Un jour à venir, choisi loin devant pour ne croiser aucun chantier de démonstration. */
const dansCinqJours = new Date(Date.now() + 5 * 86_400_000).toISOString().slice(0, 10);
const hier = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);

async function main() {
  const navigateur = await lancerNavigateur();
  // Sa mesure à lui (`PRODUCT.md`).
  const contexte = await navigateur.newContext({ viewport: { width: 390, height: 664 } });
  const page = await contexte.newPage();

  await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  await page.fill('input[name="email"]', "demo@atlas.local");
  await page.fill('input[name="password"]', "demo1234");
  await page.click('button[type="submit"]');
  await page.waitForURL(`${BASE}/`, { timeout: 30_000 });

  const ouvrirLeJour = async (jour: string) => {
    await page.goto(`${BASE}/planning`, { waitUntil: "networkidle" });
    await page.waitForTimeout(900);
    const laCase = page.locator(`button[data-jour="${jour}"]`);
    assert.ok(
      (await laCase.count()) >= 1,
      `le jour ${jour} n'est pas au calendrier : rien n'est mesuré`
    );
    await laCase.first().click();
    await page.waitForTimeout(700);
    assert.ok(
      (await page.locator('[data-atlas="carte-jour"]').count()) >= 1,
      "la carte du jour ne s'est pas ouverte : rien n'est mesuré"
    );
  };

  /**
   * **RENDRE LE JOUR OUVERT AVANT DE COMMENCER, et le rendre à la fin.**
   *
   * Payé le 6 septembre 2026 : une première version de cette suite a échoué en
   * cours de route et a laissé DEUX absences derrière elle. Le tour suivant
   * trouvait un jour déjà fermé, ne voyait plus le geste, et accusait le code.
   * Une suite qui salit la base accuse la suivante (`CLAUDE.md` §5).
   */
  const rendreLeJourOuvert = async () => {
    await ouvrirLeJour(dansCinqJours);
    const rouvrirIci = page.locator('[data-atlas="rouvrir-le-jour"]');
    for (let garde = 0; garde < 6 && (await rouvrirIci.count()) > 0; garde++) {
      await rouvrirIci.first().click();
      await page.waitForTimeout(900);
    }
  };

  const fermer = page.locator('[data-atlas="fermer-le-jour"]');
  const rouvrir = page.locator('[data-atlas="rouvrir-le-jour"]');
  const qui = page.locator('[data-atlas="qui-nest-pas-la"]');

  await rendreLeJourOuvert();

  await cas("le geste est là, sur un jour à venir", async () => {
    await ouvrirLeJour(dansCinqJours);
    assert.equal(await fermer.count(), 1, "aucun geste pour fermer le jour");
  });

  await cas("il est ATTEIGNABLE — rien ne le recouvre", async () => {
    // **Le défaut que la capture a montré le 6 septembre 2026** : posé en bas de
    // la carte, le geste tombait derrière le tiroir du bas — `fixed`, z-19 — et
    // les noms étaient coupés en deux. On mesure donc le RECOUVREMENT, pas la
    // simple présence : `count()` valait déjà 1 quand le geste était inutilisable.
    const couvert = await page.evaluate(() => {
      const cible = document.querySelector<HTMLElement>('[data-atlas="fermer-le-jour"]');
      if (!cible) return null;
      const b = cible.getBoundingClientRect();
      if (b.height < 8) return null;
      const bandes = [...document.querySelectorAll<HTMLElement>("*")]
        .filter((e) => getComputedStyle(e).position === "fixed")
        .map((e) => e.getBoundingClientRect())
        .filter((r) => r.height > 8);
      return {
        dansLEcran: b.top >= 0 && b.bottom <= window.innerHeight,
        recouvert: bandes.some((r) => b.top < r.bottom && b.bottom > r.top && b.left < r.right && b.right > r.left),
      };
    });
    assert.ok(couvert, "le geste n'a pas de boîte mesurable : rien n'est mesuré");
    assert.ok(couvert.dansLEcran, "le geste est hors de l'écran à l'ouverture de la carte");
    assert.ok(!couvert.recouvert, "le geste passe sous une bande fixe : il ne se vise pas");
  });

  await cas("IL SE VOIT : le geste a l'allure d'un bouton, pas d'une phrase", async () => {
    /*
     * **Son signalement du 7 septembre 2026 :** *« y'a marqué "quelqu'un pas
     * là" mais comment savoir qu'il faut cliquer dessus ? On comprend pas
     * bien ! »* — sur du code qui MARCHAIT. La suite ci-dessus visait le
     * `data-atlas` : elle était verte devant un bouton invisible, parce qu'un
     * bouton qu'on ne reconnaît pas se clique très bien depuis un script.
     *
     * Ce qu'on mesure donc : le geste se DISTINGUE-t-il du texte qui l'entoure ?
     * Un cerne, une ombre, ou un fond différent de celui de la carte — n'importe
     * lequel des trois suffit ; aucun des trois, et c'est une phrase.
     *
     * **Il refuse de conclure sur une boîte de zéro pixel** (`CLAUDE.md` §5) :
     * un élément non mis en page rendrait « aucune bordure » en vert, ce qui
     * ne prouverait rien.
     */
    await ouvrirLeJour(dansCinqJours);
    const allure = await page.evaluate(() => {
      const cible = document.querySelector<HTMLElement>('[data-atlas="fermer-le-jour"]');
      if (!cible) return null;
      const b = cible.getBoundingClientRect();
      if (b.width < 8 || b.height < 8) return null;
      const s = getComputedStyle(cible);
      const parent = cible.parentElement ? getComputedStyle(cible.parentElement) : null;
      return {
        bordure: parseFloat(s.borderTopWidth) > 0 || parseFloat(s.borderBottomWidth) > 0,
        ombre: s.boxShadow !== "none" && s.boxShadow.length > 0,
        fond:
          parent !== null &&
          s.backgroundColor !== parent.backgroundColor &&
          s.backgroundColor !== "rgba(0, 0, 0, 0)",
        hauteur: b.height,
      };
    });
    assert.ok(allure, "le geste n'a pas de boîte mesurable : rien n'est mesuré");
    assert.ok(
      allure.bordure || allure.ombre || allure.fond,
      "le geste n'a ni cerne, ni ombre, ni fond propre : il se lit comme une phrase"
    );
    // La cible du pouce, tant qu'on y est — 48 px est la mesure de l'écran.
    assert.ok(allure.hauteur >= 44, `le geste ne fait que ${Math.round(allure.hauteur)} px de haut`);
  });

  let idFerme = false;

  await cas("un appui ferme le jour, et le serveur l'a bien écrit", async () => {
    await fermer.click();
    await page.waitForTimeout(500);
    // Avec au moins un salarié, Atlas demande QUI — c'est son mot du 6 septembre :
    // « c'est pas les équipes, c'est le nom des salariés ».
    if ((await qui.count()) > 0) {
      const noms = await qui.allTextContents();
      assert.ok(
        noms.every((n) => n.trim().length > 0),
        "un choix sans nom : l'écran propose un bouton muet"
      );
      await qui.first().click();
    }
    await page.waitForTimeout(1200);
    assert.equal(await rouvrir.count(), 1, "le jour ne s'annonce pas fermé après l'appui");
    idFerme = true;

    // LE point : on recharge, et la fermeture tient.
    await ouvrirLeJour(dansCinqJours);
    assert.equal(
      await rouvrir.count(),
      1,
      "rechargé, le jour est rouvert : l'écran l'avait barré sans que le serveur l'écrive"
    );
  });

  await cas("et il se rouvre du même geste", async () => {
    if (!idFerme) throw new Error("le jour n'a jamais été fermé : rien à rouvrir");
    await rouvrir.click();
    await page.waitForTimeout(1200);
    await ouvrirLeJour(dansCinqJours);
    assert.equal(await rouvrir.count(), 0, "rechargé, le jour est toujours fermé");
    assert.equal(await fermer.count(), 1, "le geste de fermeture n'est pas revenu");
  });

  await cas("un jour PASSÉ ne se ferme pas", async () => {
    // Même règle que le reste de la carte : un jour passé se lit, il ne s'écrit
    // pas (planche 98). Un geste possible est un geste qu'on fait par erreur.
    await ouvrirLeJour(hier);
    assert.equal(await fermer.count(), 0, "on peut fermer un jour déjà passé");
    assert.equal(await qui.count(), 0, "on peut désigner un absent sur un jour déjà passé");
  });

  // On rend la base comme on l'a trouvée, quoi qu'il soit arrivé au-dessus.
  await rendreLeJourOuvert();

  await navigateur.close();
  if (echecs > 0) {
    console.error(`\n❌ Fermer un jour — ${echecs} échec(s).`);
    process.exit(1);
  }
  console.log("\n✅ Un jour se ferme et se rouvre depuis le planning, et le serveur suit.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
