import assert from "node:assert/strict";
import { lancerNavigateur } from "./e2e-browser";
import { Pool } from "pg";

// **« Il doit pouvoir le rentrer via une touche. »** — le patron, le 8 août 2026.
//
// Les règles sont éprouvées sans navigateur (`test-import-tarifs.ts`) et le
// parcours en base aussi (`test-import-tarifs-db.ts`). Ce que CETTE suite tient :
// **la touche existe, et ce qu'elle promet arrive.**
//
// C'est la leçon des dates lointaines, deux heures plus tôt le même jour : le
// calcul était juste, la base acceptait tout, et le geste n'existait pas. Un
// défaut invisible depuis le code.
//
// Et surtout le contrôle qui compte : **déposer un fichier n'écrit rien.** Le
// patron doit pouvoir regarder puis repartir, sa grille intacte.

const BASE = "http://localhost:3000";

// **Des intitulés uniques à chaque exécution, et ce n'est pas un détail.**
// La première version reprenait les mêmes noms : elle a réussi une fois, puis
// s'est bloquée elle-même — au second passage les tarifs existaient déjà, et
// l'aperçu annonçait « rien à changer ». Un contrôle qui ne passe qu'une fois
// est un contrôle qui rougira un jour sans qu'aucun code n'ait bougé.
const MARQUE = `E2E${Date.now()}`;
const FEUILLE = [
  "Intitulé;Prix (€);Unité",
  `Débroussaillage ${MARQUE};320,00;jour`,
  "ABATTAGE",
  `Rognage de souche ${MARQUE};180,00;u`,
  `Évacuation ${MARQUE};sur devis;`,
].join("\n");

async function main() {
  const navigateur = await lancerNavigateur();
  const contexte = await navigateur.newContext();
  const page = await contexte.newPage();
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });

  await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  await page.fill('input[name="email"]', "demo@atlas.local");
  await page.fill('input[name="password"]', "demo1234");
  await page.click('button[type="submit"]');
  await page.waitForURL(`${BASE}/`);

  const avant = await compterTarifs(pool);

  // Les tarifs ont leur rubrique depuis le 14 août 2026 (ARCHITECTURE.md §96).
  await page.goto(`${BASE}/reglages/tarifs`, { waitUntil: "networkidle" });

  // --- 1. La touche existe -------------------------------------------------
  const champ = page.locator("#fichier-tarifs");
  assert.equal(
    await champ.count(),
    1,
    "Aucun moyen de déposer une liste de prix : il faut tout retaper à la main."
  );

  await champ.setInputFiles({
    name: "mes-tarifs.csv",
    mimeType: "text/csv",
    buffer: Buffer.from(FEUILLE, "utf8"),
  });

  // **On attend l'aperçu, pas un délai.** Un `waitForTimeout` de deux secondes
  // suffisait seul et tombait en batterie, sur un serveur qui compile la route
  // pour la première fois — et l'échec accusait alors la lecture du fichier,
  // qui n'y était pour rien. Trois faux échecs du même genre le 7 août ont déjà
  // coûté une soirée.
  await page
    .getByRole("button", { name: "Enregistrer ces tarifs" })
    .waitFor({ state: "visible" });

  // --- 2. L'aperçu dit ce qui se passerait ---------------------------------
  const ecran = await page.locator("body").innerText();
  assert.match(ecran, new RegExp(`Débroussaillage ${MARQUE}`), `Le fichier n'a pas été lu. Lu : « ${resume(ecran)} »`);
  assert.match(ecran, new RegExp(`Rognage de souche ${MARQUE}`));
  assert.match(ecran, /2 à ajouter/i, `Le décompte des ajouts manque. Lu : « ${resume(ecran)} »`);
  console.log("  ✓ le fichier est lu, et l'aperçu nomme ce qui s'ajouterait");

  // --- 3. RIEN n'a encore été écrit ----------------------------------------
  //
  // Le contrôle central. Un import qui écrit dès la lecture remplacerait sa
  // grille sans qu'il l'ait vu passer — et ces tarifs partent sur les devis de
  // ses clients.
  assert.equal(
    await compterTarifs(pool),
    avant,
    "Déposer un fichier a déjà modifié ses tarifs : l'aperçu ne sert plus à rien."
  );
  console.log("  ✓ déposer un fichier n'écrit rien");

  // --- 4. Ce qui n'a pas été compris est dit -------------------------------
  assert.match(
    ecran,
    /laissée?s? de côté/i,
    "Les lignes écartées ne sont pas signalées : le patron croirait l'import complet."
  );
  console.log("  ✓ ce qui a été laissé de côté est annoncé");

  // --- 5. Son appui, et seulement lui, enregistre --------------------------
  await page.getByRole("button", { name: "Enregistrer ces tarifs" }).click();
  // L'écriture est finie quand l'aperçu a disparu et que le bilan s'affiche.
  await page.getByText(/tarifs? ajouté/).waitFor({ state: "visible" });

  assert.equal(
    await compterTarifs(pool),
    avant + 2,
    "Les deux tarifs lisibles ne sont pas arrivés en base."
  );
  const { rows } = await pool.query(
    `SELECT intitule, prix, unite FROM tarifs WHERE intitule LIKE $1 OR intitule = 'ABATTAGE' ORDER BY intitule`,
    [`%${MARQUE}%`]
  );
  const noms = rows.map((r) => r.intitule);
  assert.ok(!noms.includes("ABATTAGE"), "une ligne de titre est devenue un tarif");
  assert.ok(!noms.some((n) => n.startsWith("Évacuation")), "« sur devis » est devenu un prix");
  const debroussaillage = rows.find((r) => r.intitule.startsWith("Débroussaillage"));
  assert.equal(Number(debroussaillage?.prix), 320);
  assert.equal(debroussaillage?.unite, "jour");
  console.log("  ✓ après son appui, les tarifs sont là — et rien d'inventé");

  // --- 6. Et ils s'affichent, sans recharger -------------------------------
  const champTarif = page.locator(`input[value="Débroussaillage ${MARQUE}"]`);
  await champTarif.waitFor({ state: "visible" });
  // `innerText` ne contient PAS la valeur d'un champ de saisie, et la liste des
  // tarifs en est faite. On interroge donc les valeurs, pas le texte — l'oublier
  // rend un contrôle qui échoue sur un écran parfaitement juste.
  assert.equal(
    await champTarif.count(),
    1,
    "Le tarif est en base mais l'écran ne le montre pas : il croirait l'import raté et recommencerait."
  );
  console.log("  ✓ la liste se met à jour sous ses yeux");

  // Le jeu de démonstration est semé UNE fois pour toute la batterie : laisser
  // deux tarifs d'essai derrière soi fausserait les suites qui comptent ce que
  // contient l'écran Réglages. Une suite qui abîme les données d'une autre
  // accuse un code innocent.
  await pool.query(`DELETE FROM tarifs WHERE intitule LIKE $1`, [`%${MARQUE}%`]);

  await pool.end();
  await navigateur.close();
  console.log("✅ Une liste de prix se dépose, se relit, et ne s'enregistre que sur son geste.");
}

function resume(texte: string): string {
  return texte.replace(/\s+/g, " ").slice(0, 300);
}

async function compterTarifs(pool: Pool): Promise<number> {
  const { rows } = await pool.query("SELECT count(*)::int AS n FROM tarifs");
  return rows[0].n as number;
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
