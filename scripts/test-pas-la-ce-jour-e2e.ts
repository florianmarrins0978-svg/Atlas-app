import assert from "node:assert/strict";
import { lancerNavigateur } from "./e2e-browser";
import { ADRESSE } from "./_adresse";
import { MOIS_A_L_ECRAN } from "./_calendrier-e2e";
import { pool } from "../src/server/db/client";

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
// **DEPUIS LE 27 OCTOBRE 2026, LA FEUILLE C** (`appli/soignee/salarie-absent.html`) :
// « Salarié absent ? » ouvre une feuille, une piste par salarié (Présent,
// Matin, Après-midi, Journée), qui se touche ou se glisse. Et le geste d'un
// jour ne touche qu'à ce jour : une semaine notée ailleurs garde ses autres
// jours (le défaut qu'elle a trouvé, tenu aussi par `test-absence-d-un-jour-repo`).
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
const decale = (jours: number) => new Date(Date.parse(`${dansCinqJours}T00:00:00Z`) + jours * 86_400_000).toISOString().slice(0, 10);
/** Le motif qui marque la semaine posée par cette suite, pour la retirer à coup sûr. */
const MOTIF = "Semaine d'essai, suite pas-la-ce-jour";

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
    // **Dans cinq jours, c'est parfois le mois d'après.** Le planning s'ouvre
    // sur le mois en cours : du 27 au 31, le jour visé n'y est pas, et la suite
    // rougissait sur un écran sain, une semaine par mois (26 septembre 2026,
    // le 1er octobre cherché dans septembre). On avance comme lui, par
    // « Mois suivant ».
    for (let essai = 0; essai < 2 && (await laCase.count()) === 0; essai++) {
      await page.getByRole("button", { name: "Mois suivant" }).click();
      await page.waitForTimeout(400);
    }
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
    await pool.query(`DELETE FROM absences_equipe WHERE motif = $1`, [MOTIF]);
    await ouvrirLeJour(dansCinqJours);
    for (let garde = 0; garde < 6 && (await posee.count()) > 0; garde++) {
      await page.locator('[data-atlas="retirer-absence"]').first().click();
      await page.waitForTimeout(900);
    }
  };

  const fermer = page.locator('[data-atlas="fermer-le-jour"]');
  const feuille = page.locator('[data-atlas="feuille-absent"]');
  /** La ligne d'une absence déjà écrite : « Absent Julien matin ». */
  const posee = page.locator('[data-atlas="absence-posee"]');
  const premierSalarie = page.locator('[data-atlas="salarie-du-jour"]').first();
  const caseDe = (quand: string) => premierSalarie.locator(`[data-atlas="piste-quand"][data-quand="${quand}"]`);
  const fermerLaFeuille = async () => {
    await feuille.getByRole("button", { name: "Fermer", exact: true }).click();
    await page.waitForTimeout(400);
  };

  // **Deux salariés, sinon la feuille n'existe pas** : seul, « Absent ? » pose
  // la journée d'un appui (le dernier cas). Le réglage est posé ici plutôt que
  // supposé, une autre suite le déplaçant, et il est rendu à la fin.
  const avant = (await pool.query(`SELECT nombre_equipes, nombre_salaries FROM entreprises LIMIT 1`)).rows[0];
  await pool.query(`UPDATE entreprises SET nombre_equipes = 2, nombre_salaries = 2`);

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

  await cas("le geste ouvre la feuille, une piste par salarié, Présent d'office", async () => {
    await ouvrirLeJour(dansCinqJours);
    await fermer.click();
    await page.waitForTimeout(500);
    assert.equal(await feuille.count(), 1, "« Salarié absent ? » n'ouvre pas la feuille");
    const salaries = await page.locator('[data-atlas="salarie-du-jour"]').count();
    assert.ok(salaries >= 2, `${salaries} salarié(s) dans la feuille : rien n'est mesuré`);
    assert.equal(await caseDe("present").getAttribute("aria-checked"), "true", "le salarié n'est pas Présent d'office");
    assert.equal((await caseDe("present").innerText()).trim(), "Présent");
    // **Elle tient dans l'écran** (27 octobre 2026) : posée dans le rail des
    // mois, elle se mesurait sur lui et sortait du téléphone par la gauche.
    const boite = await page.locator('[data-atlas="feuille-absent"]').boundingBox();
    const large = page.viewportSize()?.width ?? 0;
    assert.ok(boite && boite.width > 100, "la feuille n'a pas de boîte mesurable : rien n'est mesuré");
    assert.ok(boite.x >= 0 && boite.x + boite.width <= large, `la feuille sort de l'écran : de ${Math.round(boite.x)} à ${Math.round(boite.x + boite.width)} px sur ${large}`);
    await fermerLaFeuille();
  });

  await cas("un appui sur Journée ferme le jour, et le serveur l'a bien écrit", async () => {
    await ouvrirLeJour(dansCinqJours);
    await fermer.click();
    await page.waitForTimeout(500);
    await caseDe("journee").click();
    await page.waitForTimeout(1200);
    assert.equal((await caseDe("present").innerText()).trim(), "Absent", "la première case dit encore Présent");
    await fermerLaFeuille();
    assert.equal(await posee.count(), 1, "le jour ne s'annonce pas fermé après l'appui");

    await ouvrirLeJour(dansCinqJours);
    assert.equal(await posee.count(), 1, "rechargé, le jour est rouvert : l'écran l'avait barré sans que le serveur l'écrive");
    assert.equal(await posee.first().getAttribute("data-quand"), "journee");
  });

  await cas("le curseur se GLISSE au doigt jusqu'à l'après-midi", async () => {
    await ouvrirLeJour(dansCinqJours);
    await fermer.click();
    await page.waitForTimeout(600);
    // Du Présent... jusqu'à l'Après-midi, en restant appuyé : son geste du 27 octobre.
    await caseDe("present").click();
    await page.waitForTimeout(900);
    const depart = await caseDe("present").boundingBox();
    const arrivee = await caseDe("apres_midi").boundingBox();
    assert.ok(depart && arrivee && depart.width > 20, "la piste n'a pas de boîte mesurable : rien n'est mesuré");
    const y = depart.y + depart.height / 2;
    await page.mouse.move(depart.x + depart.width / 2, y);
    await page.mouse.down();
    for (let i = 1; i <= 12; i++) {
      await page.mouse.move(depart.x + depart.width / 2 + ((arrivee.x - depart.x) * i) / 12, y);
    }
    assert.equal((await caseDe("present").innerText()).trim(), "Absent", "pendant le glissé, la première case ne dit pas Absent");
    await page.mouse.up();
    await page.waitForTimeout(1400);
    assert.equal(await caseDe("apres_midi").getAttribute("aria-checked"), "true", "le lâcher n'a pas retenu l'après-midi");
    await fermerLaFeuille();

    await ouvrirLeJour(dansCinqJours);
    assert.equal(await posee.first().getAttribute("data-quand"), "apres_midi", "rechargé, l'absence n'est pas l'après-midi");
    assert.match((await posee.first().innerText()).trim(), /après-midi/, "le moment n'est pas écrit à côté du nom");
  });

  await cas("ramener le curseur sur la première case le rend présent", async () => {
    await ouvrirLeJour(dansCinqJours);
    await fermer.click();
    await page.waitForTimeout(500);
    await caseDe("present").click();
    await page.waitForTimeout(1200);
    await fermerLaFeuille();
    await ouvrirLeJour(dansCinqJours);
    assert.equal(await posee.count(), 0, "rechargé, le jour est toujours fermé");
  });

  await cas("UNE SEMAINE notée ailleurs ne perd que CE jour", async () => {
    // Le défaut du 27 octobre 2026 : « Julien, annuler » un mercredi effaçait
    // toute sa semaine. On pose la semaine comme Réglages, Équipe la pose, sur
    // le salarié de la première ligne, puis on le rend présent ce jour-là.
    await ouvrirLeJour(dansCinqJours);
    await fermer.click();
    await page.waitForTimeout(500);
    const rang = Number(await premierSalarie.getAttribute("data-rang"));
    await caseDe("journee").click();
    await page.waitForTimeout(1200);
    await fermerLaFeuille();
    const { rowCount } = await pool.query(
      `UPDATE absences_equipe a SET premier_jour = $1, dernier_jour = $2, motif = $3
         FROM equipes e
        WHERE e.id = a.equipe_id AND e.rang = $4 AND a.deleted_at IS NULL
          AND a.premier_jour = $5 AND a.dernier_jour = $5`,
      [decale(-2), decale(2), MOTIF, rang, dansCinqJours]
    );
    assert.equal(rowCount, 1, `${rowCount} ligne(s) étendues à la semaine au lieu d'une : rien n'est mesuré`);

    await ouvrirLeJour(dansCinqJours);
    await fermer.click();
    await page.waitForTimeout(500);
    const periode = (await premierSalarie.locator('[data-atlas="periode-absent"]').innerText()).trim();
    assert.match(periode, /^Du /, `la feuille ne dit pas la semaine : « ${periode} »`);
    await caseDe("present").click();
    await page.waitForTimeout(1400);

    const { rows } = await pool.query(
      `SELECT to_char(premier_jour, 'YYYY-MM-DD') AS premier, to_char(dernier_jour, 'YYYY-MM-DD') AS dernier
         FROM absences_equipe a JOIN equipes e ON e.id = a.equipe_id
        WHERE e.rang = $1 AND a.deleted_at IS NULL AND a.motif = $2
        ORDER BY premier_jour`,
      [rang, MOTIF]
    );
    assert.deepEqual(
      rows,
      [
        { premier: decale(-2), dernier: decale(-1) },
        { premier: decale(1), dernier: decale(2) },
      ],
      `la semaine n'a pas survécu au geste d'un seul jour : ${JSON.stringify(rows)}`
    );
    const reste = (await premierSalarie.locator('[data-atlas="periode-absent"]').innerText()).trim();
    assert.match(reste, /^Absent /, `la feuille ne dit pas ce qui reste de la semaine : « ${reste} »`);
    await fermerLaFeuille();
    await pool.query(`DELETE FROM absences_equipe WHERE motif = $1`, [MOTIF]);
  });

  await cas("un jour PASSÉ ne se ferme pas", async () => {
    // Même règle que le reste de la carte : un jour passé se lit, il ne s'écrit
    // pas (planche 98). Un geste possible est un geste qu'on fait par erreur.
    await ouvrirLeJour(hier);
    assert.equal(await fermer.count(), 0, "on peut fermer un jour déjà passé");
  });

  // On rend la base comme on l'a trouvée, quoi qu'il soit arrivé au-dessus.
  await cas("SEUL, « Absent ? » pose la journée d'un appui, sans feuille, et la croix la retire", async () => {
    await pool.query(`UPDATE entreprises SET nombre_salaries = 0`);
    await ouvrirLeJour(dansCinqJours);
    await fermer.click();
    await page.waitForTimeout(1200);
    assert.equal(await feuille.count(), 0, "seul, une feuille s'ouvre pour un appui qui n'a personne à désigner");
    assert.equal(await posee.count(), 1, "seul, l'appui n'a pas fermé le jour");
    assert.equal(await page.locator('[data-atlas="quand-absent"]').count(), 3, "seul, le choix du moment n'apparaît pas sous la ligne");
    await page.locator('[data-atlas="retirer-absence"]').first().click();
    await page.waitForTimeout(1200);
    await ouvrirLeJour(dansCinqJours);
    assert.equal(await posee.count(), 0, "seul, la croix n'a pas rouvert le jour");
  });

  await pool.query(`UPDATE entreprises SET nombre_equipes = $1, nombre_salaries = $2`, [avant?.nombre_equipes ?? 1, avant?.nombre_salaries ?? 0]);
  await rendreLeJourOuvert();

  await navigateur.close();
  await pool.end();
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
