import assert from "node:assert/strict";
import { lancerNavigateur } from "./e2e-browser";
import { ADRESSE } from "./_adresse";
import { MOIS_A_L_ECRAN } from "./_calendrier-e2e";

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
    // **Dans le mois à l'écran** : ses deux voisins sont montés hors du cadre
    // depuis le 11 septembre 2026, et une case prise là-bas ne se clique pas.
    const laCase = page.locator(`${MOIS_A_L_ECRAN} button[data-jour="${jour}"]`);
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
    // **On annule PAR OÙ IL ANNULE** — depuis le 10 septembre 2026, « Annuler »
    // vit derrière le +, jamais à demeure à côté d'une absence posée. Entrer
    // par une autre porte laisserait ce chemin-là sans contrôle.
    const rouvrirIci = page.locator('[data-atlas="rouvrir-le-jour"]');
    const posees = page.locator('[data-atlas="absence-posee"]');
    for (let garde = 0; garde < 6 && (await posees.count()) > 0; garde++) {
      if ((await rouvrirIci.count()) === 0) {
        await page.locator('[data-atlas="fermer-le-jour"]').first().click();
        await page.waitForTimeout(400);
      }
      if ((await rouvrirIci.count()) === 0) break;
      await rouvrirIci.first().click();
      await page.waitForTimeout(900);
    }
  };

  const fermer = page.locator('[data-atlas="fermer-le-jour"]');
  const rouvrir = page.locator('[data-atlas="rouvrir-le-jour"]');
  const qui = page.locator('[data-atlas="qui-nest-pas-la"]');
  /** La ligne d'une absence déjà écrite : « Julien absent · matin ». */
  const posee = page.locator('[data-atlas="absence-posee"]');

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
     *
     * **LE 9 SEPTEMBRE, IL A FAIT RETIRER LE CERNE** — *« Salarié absent + sans
     * contour ! »* —, et ce contrôle serait alors devenu un contrôle qui
     * réclame ce qu'il vient de faire enlever (`CLAUDE.md` §5 bis). On vise
     * donc plus profond : ce qui compte n'est pas le cadre, c'est qu'un SIGNE
     * distingue le geste d'une phrase. Un cerne, une ombre, un fond propre —
     * ou un **+**, qui dit « ceci s'appuie et ça ajoute » aussi bien qu'un
     * cadre. Aucun des quatre, et c'est une phrase : le défaut du 7 revient.
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
        signe: (cible.textContent ?? "").includes("+"),
        hauteur: b.height,
      };
    });
    assert.ok(allure, "le geste n'a pas de boîte mesurable : rien n'est mesuré");
    assert.ok(
      allure.bordure || allure.ombre || allure.fond || allure.signe,
      "le geste n'a ni cerne, ni ombre, ni fond, ni + : il se lit comme une phrase"
    );
    // **La cible du pouce ne suit PAS l'encre.** Le dessin a rétréci le
    // 9 septembre ; 44 px reste le plancher, sinon le geste se rate avec des
    // gants — et un geste raté coûte autant qu'un geste invisible.
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
    assert.equal(
      await posee.count(),
      1,
      "le jour ne s'annonce pas fermé après l'appui"
    );
    idFerme = true;

    // LE point : on recharge, et la fermeture tient.
    await ouvrirLeJour(dansCinqJours);
    assert.equal(
      await posee.count(),
      1,
      "rechargé, le jour est rouvert : l'écran l'avait barré sans que le serveur l'écrive"
    );
  });

  // ─── L'INTERRUPTEUR, ET CE QU'IL ÉCRIT — 10 septembre 2026 ───────────────
  //
  // Sa demande : *« remets le bouton matin / aprem / journée ; une fois choisi,
  // le bouton se cache »*, et *« à côté de Julien absent on marque matin, aprem
  // ou journée en fonction de la sélection »*.
  //
  // **On entre par SA porte** (`CLAUDE.md` §5 quater) : on repose l'absence
  // depuis le +, comme lui, plutôt que d'appeler la fonction qui restreint.
  await cas("l'interrupteur restreint l'absence à une demi-journée, puis s'efface", async () => {
    // **On repart d'un jour ouvert, puis on refait SON geste en entier.**
    // L'interrupteur ne vit qu'à côté de l'absence qu'il vient de poser : le
    // rouvrir demande donc de reposer, comme lui.
    await rendreLeJourOuvert();
    // **On recharge avant de refaire le geste.** Le ménage ci-dessus a ouvert
    // la liste pour y trouver « Annuler » : appuyer sur le + la refermerait au
    // lieu de poser, et l'on mesurerait un écran qu'il ne voit jamais.
    await ouvrirLeJour(dansCinqJours);
    await fermer.click();
    await page.waitForTimeout(500);
    // **Avec des salariés, le + ouvre la liste et c'est le nom qui pose ; seul,
    // le + pose directement.** Les deux chemins mènent au même interrupteur,
    // et cette suite doit tenir sur les deux — le compte de démonstration n'a
    // aucun salarié, celui du patron en a deux.
    if ((await qui.count()) > 0) {
      await qui.first().click();
      await page.waitForTimeout(1200);
    }

    const bascule = page.locator('[data-atlas="quand-absent"]');
    assert.equal(await bascule.count(), 3, "l'interrupteur ne propose pas ses trois positions");
    assert.equal(
      await page.locator('[data-atlas="quand-absent"][data-quand="journee"]').getAttribute("aria-pressed"),
      "true",
      "l'interrupteur n'est pas allumé sur ce qui vient d'être écrit"
    );

    await page.locator('[data-atlas="quand-absent"][data-quand="matin"]').click();
    await page.waitForTimeout(1400);

    // **Il s'efface une fois choisi** : c'est sa demande, mot pour mot.
    assert.equal(await bascule.count(), 0, "l'interrupteur reste après le choix");
    // **Et la ligne DIT quand** — sinon le choix n'est visible nulle part.
    assert.equal(
      await posee.first().getAttribute("data-quand"),
      "matin",
      "la ligne de l'absence n'annonce pas la demi-journée choisie"
    );
    assert.match(
      (await posee.first().innerText()).trim(),
      /matin/,
      "le moment n'est pas écrit à côté du nom"
    );

    // Et le serveur l'a écrit : on recharge.
    await ouvrirLeJour(dansCinqJours);
    assert.equal(
      await posee.first().getAttribute("data-quand"),
      "matin",
      "rechargé, l'absence a repris la journée entière"
    );
  });

  // **ANNULER SE TROUVE DERRIÈRE LE +, et nulle part ailleurs** — sa demande du
  // 10 septembre. Le mot ne reste plus sous les yeux à côté d'une absence
  // posée ; ce contrôle prouve qu'on peut quand même défaire.
  await cas("annuler se retrouve derrière le +, et le jour se rouvre", async () => {
    if (!idFerme) throw new Error("le jour n'a jamais été fermé : rien à rouvrir");
    await ouvrirLeJour(dansCinqJours);
    assert.equal(await rouvrir.count(), 0, "« Annuler » traîne à l'écran sans qu'on ait ouvert le +");
    await fermer.click();
    await page.waitForTimeout(400);
    assert.ok((await rouvrir.count()) >= 1, "le + n'ouvre pas la liste où l'on annule");
    await rouvrir.first().click();
    await page.waitForTimeout(1200);
    await ouvrirLeJour(dansCinqJours);
    assert.equal(await posee.count(), 0, "rechargé, le jour est toujours fermé");
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
