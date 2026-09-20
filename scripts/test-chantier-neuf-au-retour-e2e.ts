import { lancerNavigateur } from "./e2e-browser";
import assert from "node:assert";
import { creerPuisFiche } from "./_creer-chantier-e2e";
import { ADRESSE } from "./_adresse";

/**
 * UN CHANTIER CRÉÉ EST LÀ QUAND IL REVIENT — 20 septembre 2026.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * **Sa remarque, capture à l'appui :** *« j'ai créé un chantier puis j'ai fait
 * retour. Problème ! J'ai dû recharger la page pour qu'il arrive dans mes
 * chantiers en cours ! »*
 *
 * Le chantier était bien en base : c'est l'accueil qu'il retrouvait tel qu'il
 * l'avait quitté. Un retour — la flèche, ou le geste du navigateur — REJOUE la
 * page telle qu'elle a été rendue (`node_modules/next/dist/docs/01-app/
 * 04-glossary.md`, « Client Cache » : *pages … are reused during browser
 * back/forward navigation*), et rien ne disait que la liste avait changé :
 * `creerChantierAction` n'annonçait pas l'accueil, là où les sept autres
 * écritures qui le touchent l'annoncent déjà (`src/app/actions.ts`).
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * **CE QUE CE CONTRÔLE FIXE, ET CE QU'IL NE FIXE PAS.** Il fixe la PROMESSE —
 * le chantier est là au retour, sans rechargement — jamais le mécanisme qui la
 * tient. Un contrôle qui chercherait `revalidatePath` dans un fichier ne
 * regarderait pas l'écran, et il rougirait le jour où le même résultat vient
 * d'ailleurs (`CLAUDE.md` §5 bis).
 *
 * **LA PATIENCE EST COURTE, ET C'EST DÉLIBÉRÉ.** L'accueil se relit tout seul
 * toutes les trente secondes (`VeilleDesNouvelles`) : attendre plus longtemps
 * verrait le battement réparer ce que ce contrôle doit attraper, et rendrait un
 * vert sur le défaut même qu'il éprouve. Huit secondes, donc — ce que le patron
 * appelle « tout de suite ».
 *
 * **Sait échouer** : jouée sur le code d'avant ce lot, elle tombe sur
 * « l'accueil est revenu sans le chantier ». Et le rechargement qui suit
 * vérifie que le chantier existe bel et bien — sans cela, elle accuserait la
 * création d'un défaut qui est dans l'affichage.
 */
const BASE = ADRESSE;

/** Ce que le patron appelle « tout de suite ». En dessous du battement de
 *  trente secondes de `VeilleDesNouvelles`, qui sinon réparerait le défaut. */
const PATIENCE_MS = 8_000;

async function main() {
  const navigateur = await lancerNavigateur();
  const contexte = await navigateur.newContext();
  const page = await contexte.newPage();

  await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  await page.fill('input[name="email"]', "demo@atlas.local");
  await page.fill('input[name="password"]', "demo1234");
  await page.click('button[type="submit"]');
  await page.waitForURL(`${BASE}/`, { timeout: 15_000 });
  await page.goto(`${BASE}/`, { waitUntil: "networkidle" });

  // Combien de chantiers en cours AVANT — le compteur de l'accueil, celui
  // qu'il lit. Il doit avancer d'un, sans quoi la ligne pourrait apparaître
  // sans que le compte suive, et il croirait avoir créé un chantier de trop.
  const compteur = page.locator('[data-atlas="compteur"]');
  await compteur.waitFor({ state: "visible", timeout: 15_000 });
  const avant = Number(await compteur.getAttribute("data-compte"));
  assert.ok(Number.isFinite(avant), "Le compteur de l'accueil ne se lit pas : rien n'est éprouvé");

  // ── SON CHEMIN, PAS UNE PORTE DE SERVICE ─────────────────────────────────
  // La feuille qui monte depuis l'accueil, et non l'adresse `/chantiers/
  // nouveau` : c'est par là qu'il passe, et c'est l'accueil laissé derrière
  // qui fait le défaut (`CLAUDE.md` §5 quater).
  const nom = `Retour ${Date.now().toString().slice(-6)}`;
  await page.click('[data-atlas="nouveau-chantier"]');
  await page.waitForSelector('input[placeholder="Bernard"]', { state: "visible", timeout: 15_000 });
  await page.fill('input[placeholder="Bernard"]', nom);
  await page.fill('input[placeholder="06 12 34 56 78"]', "0612345678");
  await creerPuisFiche(page);

  // ── ET IL FAIT RETOUR ────────────────────────────────────────────────────
  await page.click('[data-atlas="retour-du-devis"]');
  await page.waitForURL(`${BASE}/`, { timeout: 15_000 });

  let vu = false;
  try {
    await page.waitForSelector(`text=${nom}`, { timeout: PATIENCE_MS });
    vu = true;
  } catch {
    vu = false;
  }

  if (!vu) {
    // On recharge AVANT d'accuser : si le chantier apparaît alors, le défaut
    // est bien dans le retour — pas dans la création.
    await page.reload({ waitUntil: "networkidle" });
    const apresRechargement = await page.locator(`text=${nom}`).count();
    assert.fail(
      `L'accueil est revenu sans « ${nom} » : il a fallu recharger pour le voir ` +
        `(au rechargement, ${apresRechargement} ligne(s) le portent). ` +
        `C'est sa remarque du 20 septembre 2026.`
    );
  }

  const apres = Number(await compteur.getAttribute("data-compte"));
  assert.equal(
    apres,
    avant + 1,
    `Le compteur « En cours » doit suivre la ligne : ${avant} avant, ${apres} au retour`
  );

  await contexte.close();
  await navigateur.close();
  console.log("✅ Un chantier créé est là au retour, sans rechargement.");
}

main().catch((erreur) => {
  console.error(erreur);
  process.exit(1);
});
