// Les trois onglets de Terminés tiennent sur UNE ligne — mesuré, pas supposé.
//
// ═══════════════════════════════════════════════════════════════════════════
// **Sa demande du 9 septembre 2026 :** *« comment est-ce possible que "retours
// d'intervention" déborde, il y a beaucoup de place ? Tu te débrouilles comme
// tu veux mais tu fais tenir les 3 sur la même ligne, donc rétrécis-les un peu
// tous les 3 s'il faut. »*
//
// Il avait raison de tiquer : le mot ne fait que 145 px. Ce qui débordait,
// c'était le REMBOURRAGE — 18 px de chaque côté sur trois pastilles, plus
// 26 px de marge. Mesuré : 440 px avant, 377 après.
//
// **Ce contrôle mesure ce qui est RENDU**, une fois la mise en page faite :
// un libellé rallongé, une police changée, un rembourrage remis à 18 le
// feraient rougir — et c'est le seul moyen de le savoir avant lui.
//
// **Et il refuse de conclure sur une boîte de zéro pixel** : l'absence de
// matière à mesurer n'est pas un succès, c'est une mesure impossible
// (`CLAUDE.md` §5, payé le 15 août 2026).

import { mkdirSync } from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";
import { Pool } from "pg";
import { lancerNavigateur } from "./e2e-browser";
import { ADRESSE } from "./_adresse";

const BASE = ADRESSE;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

/**
 * **Les largeurs qu’il faut tenir, et pas seulement la sienne.**
 *
 * Sa remarque du 9 septembre 2026 : *« n’oublie pas que ça doit être adapté à
 * tous les téléphones »*. La première livraison ne mesurait qu’à 390 — son
 * iPhone à lui — et la rangée aurait débordé de quinze pixels sur un Android
 * ordinaire, chez le premier de ses salariés à en avoir un.
 *
 * **360 px est le plancher que ce dépôt tient déjà** (`ARCHITECTURE.md` §125,
 * où la barre du bas se vérifie à cette largeur). 430 est le grand format.
 */
const LARGEURS = [360, 375, 390, 430] as const;
const RANGEE = "[data-atlas='onglets-termines']";
/** **On la REGARDE aussi.** Une rangée peut tenir au pixel et rester laide :
 *  quatre défauts réels de ce dépôt sont sortis d’une image, d’aucun test. */
const DOSSIER_CAPTURES = process.env.ATLAS_CAPTURES ?? null;

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
  console.log("=== Les onglets de Terminés, à la largeur de son téléphone ===\n");

  // **L'onglet des retours ne s'affiche QUE s'il y en a**, et c'est voulu : un
  // onglet qui ouvre une liste vide s'apprend à ne plus être touché. Il faut
  // donc en poser un pour mesurer les trois.
  //
  // **La suite pose ce dont elle a besoin, et le retire après.** S'appuyer sur
  // ce que le jeu de démonstration contient, c'est rougir le jour où il change
  // — et il change (`CLAUDE.md` §5 bis).
  const { rows } = await pool.query<{ id: string; entreprise_id: string }>(
    `SELECT c.id, c.entreprise_id FROM chantiers c
       JOIN membres_entreprise me ON me.entreprise_id = c.entreprise_id
       JOIN users u ON u.id = me.utilisateur_id AND u.email = 'demo@atlas.local'
      WHERE c.deleted_at IS NULL
      ORDER BY c.created_at DESC LIMIT 1`
  );
  assert.ok(rows.length === 1, "aucun chantier dans le jeu de démonstration");
  const { id: chantierId, entreprise_id: entrepriseId } = rows[0];

  // **Et l'écran des Terminés ne montre ses onglets que s'il a quelque chose
  // à trier** : sans chantier terminé, il rend son état vide et la rangée
  // n'existe pas. On pose donc les deux conditions, et on les défait à la fin.
  const { rows: avant } = await pool.query<{ termine_at: Date | null }>(
    `SELECT termine_at FROM chantiers WHERE id = $1`,
    [chantierId]
  );
  await pool.query(`UPDATE chantiers SET termine_at = now() WHERE id = $1`, [chantierId]);
  await pool.query(
    `INSERT INTO retours_intervention (entreprise_id, chantier_id, pose_le)
     VALUES ($1, $2, now())
     ON CONFLICT (chantier_id) DO NOTHING`,
    [entrepriseId, chantierId]
  );

  const navigateur = await lancerNavigateur();
  const contexte = await navigateur.newContext({ viewport: { width: LARGEURS[0], height: 844 } });
  const page = await contexte.newPage();

  await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  await page.fill('input[name="email"]', "demo@atlas.local");
  await page.fill('input[name="password"]', "demo1234");
  await page.click('button[type="submit"]');
  await page.waitForURL(`${BASE}/`, { timeout: 30_000 });
  // `networkidle` et non `domcontentloaded` : sans la feuille de style
  // appliquée, toutes les largeurs valent 0 et le contrôle rendrait un vert
  // qui ne prouve rien.
  await page.goto(`${BASE}/termines`, { waitUntil: "networkidle" });
  await page.locator(RANGEE).waitFor({ state: "visible", timeout: 20_000 });

  // La capture se prend à la largeur la PLUS ÉTROITE : c’est là que ça casse.
  if (DOSSIER_CAPTURES) {
    mkdirSync(DOSSIER_CAPTURES, { recursive: true });
    await page.locator(RANGEE).screenshot({
      path: path.join(DOSSIER_CAPTURES, "onglets-termines.png"),
    });
  }

  await cas("les trois onglets sont là, celui des retours portant son nom entier", async () => {
    const dit = (await page.locator(RANGEE).innerText()).replace(/\n/g, " · ");
    assert.match(dit, /Tout/);
    assert.match(dit, /facturer/i);
    assert.match(dit, /Retours d'intervention/, `la rangée dit « ${dit} »`);
  });

  for (const large of LARGEURS) {
    await cas(`LA RANGÉE TIENT DANS ${large} px — toutes les largeurs, pas seulement la sienne`, async () => {
      await page.setViewportSize({ width: large, height: 844 });
      // La mise en page se refait : sans cette attente, on mesure celle d’avant.
      await page.waitForTimeout(350);
      const rangee = page.locator(RANGEE);
      const boite = await rangee.boundingBox();
      assert.ok(boite && boite.height > 20, "la rangée est écrasée : rien n’est mesuré");

      // La largeur RÉELLE de ce qui est posé dedans, marges comprises — pas la
      // largeur de la boîte, qui vaut celle de l’écran quoi qu’elle contienne.
      // ═══════════════════════════════════════════════════════════════════
      // **NE PAS MESURER LA LARGEUR OCCUPÉE : elle ment.** Les pastilles sont
      // des enfants de flex, donc elles SE SERRENT quand la place manque. La
      // rangée « tient » alors toujours — en écrasant les libellés. La
      // première version de ce contrôle rendait exactement la largeur de
      // l’écran à 360 comme à 375, et croyait avoir prouvé quelque chose.
      //
      // Ce qui se mesure, c’est **ce que chaque pastille voudrait** contre ce
      // qu’on lui laisse : un libellé plus large que sa boîte est un libellé
      // rogné ou replié, et ça se voit à l’œil.
      // **`scrollWidth` NE VOIT RIEN quand le débordement est visible**, et
      // c’est le piège de ce contrôle : il rendait 68/68 sur une pastille dont
      // le texte demandait 74. On mesure donc le TEXTE lui-même, par un
      // intervalle posé sur le contenu — la seule largeur qui ne mente pas.
      const serres = await rangee.evaluate((r) =>
        Array.from(r.children).map((e) => {
          const intervalle = document.createRange();
          intervalle.selectNodeContents(e);
          const texte = intervalle.getBoundingClientRect();
          const st = getComputedStyle(e as HTMLElement);
          const dedans =
            e.getBoundingClientRect().width -
            (parseFloat(st.paddingLeft) || 0) -
            (parseFloat(st.paddingRight) || 0);
          return {
            mot: (e.textContent ?? "").trim().slice(0, 24),
            large: Math.round(e.getBoundingClientRect().width),
            dedans: Math.round(dedans),
            voulu: Math.ceil(texte.width),

          };
        })
      );
      const pris = await rangee.evaluate((r) => Math.ceil(r.scrollWidth));
      console.log(
        `    ${large} px : la rangée voudrait ${pris} — ` +
          serres.map((x) => `${x.mot} ${x.dedans}←${x.voulu}`).join(" · ")
      );
      assert.ok(pris > 200, `mesure invraisemblable (${pris} px) : la mise en page n’est pas faite`);

      // **La borne, c’est la place DISPONIBLE**, pas la largeur de l’écran :
      // la rangée vit entre deux marges, et les comparer à l’écran entier
      // rendrait un vert sur trente pixels qui n’existent pas.
      const dispo = await rangee.evaluate((r) => {
        const st = getComputedStyle(r as HTMLElement);
        return Math.floor(
          (r.parentElement?.getBoundingClientRect().width ?? 0) -
            (parseFloat(st.marginLeft) || 0) -
            (parseFloat(st.marginRight) || 0)
        );
      });
      assert.ok(
        pris <= dispo,
        `les onglets débordent de ${pris - dispo} px à ${large} (${pris} pour ${dispo} disponibles)`
      );
      // **À 360 px, la capture montrait « À / facturer » sur deux lignes — et
      // tous les contrôles au vert**, parce que deux lignes de 12,5 px tiennent
      // dans les 44 px du pouce et que `scrollWidth` ne voit rien d’un
      // débordement visible.
      //
      // Les pastilles portent donc `whitespace-nowrap` ET `shrink-0` : ni
      // repli ni écrasement ne sont plus possibles, et le manque de place
      // devient un DÉBORDEMENT que la mesure ci-dessous voit. Un défaut
      // visible vaut mieux qu’un défaut absorbé en silence.
      const hauts = await rangee.evaluate((r) =>
        Array.from(r.children).map((e) => Math.round(e.getBoundingClientRect().height))
      );
      for (const h of hauts) {
        assert.ok(h <= 48, `un onglet fait ${h} px de haut à ${large} px : son libellé s’est replié`);
      }
      for (const x of serres) {
        assert.ok(x.voulu > 0, `« ${x.mot} » ne mesure rien : la mise en page n’est pas faite`);
        assert.ok(
          x.dedans + 1 >= x.voulu,
          `« ${x.mot} » est rogné à ${large} px : ${x.dedans} px de place pour ${x.voulu} de texte`
        );
      }

      const deborde = await page.evaluate(
        () => document.documentElement.scrollWidth > window.innerWidth + 1
      );
      assert.equal(deborde, false, `l’écran défile de côté à ${large} px`);
    });
  }

  await cas("AUCUN ONGLET N’EST ROND — son coup d’œil du 9 septembre", async () => {
    // *« Le bouton Tout, on dirait qu’il est rond et pas ovale comme les
    // autres »* : un mot court dans un rembourrage resserré rend une pastille
    // aussi haute que large. On mesure donc le RAPPORT, pas seulement la
    // largeur — c’est ce que l’œil voit.
    const formes = await page.locator(`${RANGEE} > *`).evaluateAll((els) =>
      els.map((e) => {
        const b = e.getBoundingClientRect();
        return { l: Math.round(b.width), h: Math.round(b.height) };
      })
    );
    for (const f of formes) {
      assert.ok(f.l > 0 && f.h > 0, "un onglet sans dimension : rien n’est mesuré");
      // **Le seuil vient de l’image, pas d’une intuition.** Ce qu’il a vu était
      // une pastille aussi haute que large — un rapport proche de 1. À 1,36
      // (60 × 44) elle se lit ovale, vérifié à la capture ; le garde-fou est
      // donc posé à 1,25, où il attrape un vrai rond sans refuser ce qui va.
      assert.ok(f.l >= f.h * 1.25, `un onglet est presque rond : ${f.l} × ${f.h} px`);
    }
  });

  await cas("aucun onglet ne descend sous 44 px — le pouce, avec des gants", async () => {
    const hauteurs = await page.locator(`${RANGEE} > *`).evaluateAll((els) =>
      els.map((e) => Math.round(e.getBoundingClientRect().height))
    );
    assert.ok(hauteurs.length === 3, `${hauteurs.length} onglets au lieu de trois`);
    for (const h of hauteurs) {
      assert.ok(h >= 44, `un onglet ne fait que ${h} px de haut`);
    }
  });

  // On rend le jeu de démonstration tel qu'on l'a pris : les suites voisines
  // comptent les retours de cette entreprise, et un de trop les ferait mentir.
  await pool.query(`DELETE FROM retours_intervention WHERE chantier_id = $1`, [chantierId]);
  await pool.query(`UPDATE chantiers SET termine_at = $2 WHERE id = $1`, [
    chantierId,
    avant[0]?.termine_at ?? null,
  ]);
  await pool.end();
  await navigateur.close();
  console.log(`\n${echecs === 0 ? "✅" : "❌"} Les onglets de Terminés — ${echecs} échec(s).`);
  process.exit(echecs === 0 ? 0 : 1);
}

main().catch(async (e) => {
  console.error(e);
  await pool.end().catch(() => {});
  process.exit(1);
});
