import assert from "node:assert/strict";
import { Client } from "pg";
import { lancerNavigateur } from "./e2e-browser";

// UN PRIX TAPÉ NE PART JAMAIS À ZÉRO — même quand l'écran est en retard.
//
// ═══════════════════════════════════════════════════════════════════════════
// **LE DÉFAUT, ET CE QU'IL A COÛTÉ.**
//
// Sur la feuille du devis, le prix s'enregistre quand on quitte le champ. Le
// gestionnaire lisait la ligne du DERNIER RENDU — or React ne rend pas au
// moment de la frappe, il le programme. Sur une machine chargée, le rendu
// n'arrive pas avant la sortie du champ : le serveur recevait l'ANCIENNE
// valeur — un zéro sur une ligne neuve — **pendant que l'écran continuait
// d'afficher le prix tapé**.
//
// Rien ne le disait. On le découvrait au rechargement, ou sur le devis parti
// chez le client. `test-lecons-prix-e2e` est tombé SIX fois là-dessus depuis le
// 26 août 2026, et six fois on a conclu à la lenteur de la machine.
//
// ═══════════════════════════════════════════════════════════════════════════
// **POURQUOI CETTE SUITE-CI EXISTE À PART.**
//
// `test-lecons-prix-e2e` ne voit le défaut que **sous la charge des cent-dix-neuf
// suites**, et une fois sur deux. Un contrôle qui ne parle qu'à la loterie ne
// défend rien : celui-ci reproduit la condition **à coup sûr**, et sans charge.
//
// Il pose la valeur dans le champ **sans faire savoir à React qu'elle a
// changé** — pas d'événement `input`. L'état du composant reste donc à sa
// valeur d'avant, exactement comme lorsqu'un rendu n'a pas eu le temps
// d'arriver. Puis il quitte le champ (`focusout`, que React écoute — `blur`, lui,
// ne bulle pas et ne déclenche RIEN : une sonde qui l'emploie mesure zéro).
//
// **Ce que la base porte ensuite tranche :** le prix tapé, ou l'ancien.
//
// Vu rouge sur le code d'avant : `{"prixUnitaire":"0"}` posté, réponse 200.

const BASE = "http://localhost:3000";
const PRIX = "1234";

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
  console.log("=== Un prix tapé survit à un écran en retard ===\n");

  const db = new Client({ connectionString: process.env.DATABASE_URL });
  await db.connect();

  const { rows } = await db.query(
    `SELECT c.id FROM chantiers c
       JOIN devis d ON d.chantier_id = c.id
      WHERE c.deleted_at IS NULL
      ORDER BY c.created_at LIMIT 1`
  );
  assert.ok(rows[0], "aucun chantier avec devis : la base n'est pas amorcée");
  const chantier = rows[0].id as string;

  // **On repart d'une ligne à zéro**, sinon la valeur du tour précédent ferait
  // répondre « écrit » sans que rien n'ait été mesuré (`CLAUDE.md` §5).
  await db.query(`UPDATE lignes_prix SET prix_unitaire = 0 WHERE chantier_id = $1`, [chantier]);

  const navigateur = await lancerNavigateur();
  const contexte = await navigateur.newContext({ viewport: { width: 390, height: 664 } });
  const page = await contexte.newPage();

  // Ce que le navigateur envoie vraiment — c'est cela qui a fini par nommer le
  // coupable, après six enquêtes menées sans lui.
  const envois: string[] = [];
  page.on("request", (r) => {
    if (r.method() !== "POST" || !r.headers()["next-action"]) return;
    const corps = (r.postData() ?? "").slice(0, 200).replace(/\s+/g, " ");
    envois.push(corps);
  });

  await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  await page.fill('input[name="email"]', "demo@atlas.local");
  await page.fill('input[name="password"]', "demo1234");
  await page.click('button[type="submit"]');
  await page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 30_000 });
  await page.goto(`${BASE}/chantiers/${chantier}/devis-complet`, { waitUntil: "networkidle" });
  await page.waitForSelector("text=Total TTC", { timeout: 60_000 });

  await cas("LE CHAMP EST LÀ, ET IL PORTE ZÉRO — sinon rien n'est mesuré", async () => {
    const champ = page.locator('[aria-label="Prix unitaire 1"]');
    await champ.waitFor({ state: "visible", timeout: 30_000 });
    const avant = (await db.query(
      `SELECT prix_unitaire FROM lignes_prix WHERE chantier_id = $1 ORDER BY created_at`,
      [chantier]
    )).rows.map((r) => r.prix_unitaire as string);
    assert.ok(avant.length > 0, "aucune ligne de prix sur ce chantier");
    assert.ok(
      avant.every((p) => Number(p) === 0),
      `les lignes ne sont pas à zéro (${JSON.stringify(avant)}) : le contrôle ne prouverait rien`
    );
  });

  await cas("LE PRIX PART, MÊME SI L'ÉCRAN N'A PAS ENCORE RENDU LA FRAPPE", async () => {
    await page.evaluate((prix) => {
      const champ = document.querySelector('[aria-label="Prix unitaire 1"]') as
        | HTMLInputElement
        | HTMLTextAreaElement;
      const proto =
        champ.tagName === "TEXTAREA"
          ? window.HTMLTextAreaElement.prototype
          : window.HTMLInputElement.prototype;
      // La valeur est posée dans le DOM **sans prévenir React** : son état reste
      // celui d'avant, comme lorsqu'un rendu n'a pas eu le temps d'arriver.
      Object.getOwnPropertyDescriptor(proto, "value")!.set!.call(champ, prix);
      // `focusout`, et jamais `blur` : React écoute le premier.
      champ.dispatchEvent(new FocusEvent("focusout", { bubbles: true }));
    }, PRIX);

    let lu: string[] = [];
    for (const essai of [0, 1, 2, 3, 4, 5]) {
      if (essai > 0) await new Promise((r) => setTimeout(r, essai * 600));
      lu = (await db.query(
        `SELECT prix_unitaire FROM lignes_prix WHERE chantier_id = $1 ORDER BY created_at`,
        [chantier]
      )).rows.map((r) => r.prix_unitaire as string);
      if (lu.some((p) => Number(p) === Number(PRIX))) return;
    }
    assert.fail(
      `Le prix ${PRIX} n'est arrivé sur AUCUNE ligne — lues : ${JSON.stringify(lu)}\n` +
        `    ce que le navigateur a envoyé :\n      ${envois.join("\n      ") || "rien"}`
    );
  });

  await navigateur.close();
  await db.end();
  console.log(
    echecs === 0
      ? "\n✅ Un prix tapé ne part jamais à zéro — 0 échec(s)."
      : `\n❌ Un prix tapé ne part jamais à zéro — ${echecs} échec(s).`
  );
  process.exit(echecs === 0 ? 0 : 1);
}

main();
