import assert from "node:assert/strict";
import { lancerNavigateur } from "./e2e-browser";

/**
 * La phrase française apparaît-elle vraiment, dans un vrai navigateur ?
 *
 * **La capture du patron, le 12 août 2026 à 14 h 04 :** « An unexpected
 * response was received from the server. », un panneau rouge en anglais, une
 * pile d'appel dans `node_modules`. Sur la version rapide, ce panneau n'existe
 * même pas : l'échec y est simplement muet.
 *
 * La suite pure (`test-reponse-illisible.ts`) tient la règle. Elle ne dit rien
 * de l'essentiel : que l'écouteur est bien posé sur la fenêtre, dans la vraie
 * coque de l'application, et qu'il attrape une promesse rejetée que personne
 * n'a rattrapée. Un écouteur oublié dans `layout.tsx` laisserait la règle juste
 * et l'écran muet.
 *
 * Trois points, et le troisième compte autant que les deux autres :
 *
 *   1. sans incident, RIEN ne s'affiche — un bandeau qui apparaît tout seul
 *      inquiéterait pour rien ;
 *   2. sur cette famille d'échec, la phrase et « Recharger » apparaissent ;
 *   3. sur un défaut ORDINAIRE, rien n'apparaît : l'habiller en lenteur
 *      enverrait chercher au mauvais endroit.
 */
const BASE = "http://localhost:3000";

async function main() {
  const navigateur = await lancerNavigateur();
  const contexte = await navigateur.newContext();
  const page = await contexte.newPage();

  try {
    // L'écran de connexion suffit : la coque est la même partout, et il évite
    // d'user la limite de connexion pour un contrôle qui n'en a pas besoin.
    await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });

    const bandeau = page.locator('[data-atlas="reponse-illisible"]');

    // ── 1 · Rien, tant que rien ne va mal ────────────────────────────────
    assert.equal(
      await bandeau.count(),
      0,
      "Le bandeau s'affiche alors que rien n'a échoué : il inquiéterait pour rien."
    );
    console.log("  ✓ rien ne s'affiche tant que rien n'échoue");

    // ── 3 · Un défaut ordinaire ne déclenche rien ────────────────────────
    //
    // Éprouvé AVANT le cas qui doit réussir : dans l'autre ordre, le bandeau
    // déjà affiché rendrait ce contrôle incapable d'échouer.
    await page.evaluate(() => {
      window.dispatchEvent(
        new PromiseRejectionEvent("unhandledrejection", {
          promise: Promise.reject(new Error("Cannot read properties of undefined")),
          reason: new Error("Cannot read properties of undefined"),
          cancelable: true,
        })
      );
    });
    await page.waitForTimeout(400);
    assert.equal(
      await bandeau.count(),
      0,
      "Un vrai défaut du code a été habillé en « le serveur se prépare » : le patron rechargerait une page qui ne guérira pas, et le défaut resterait caché."
    );
    console.log("  ✓ un défaut ordinaire n'est pas habillé en lenteur");

    // ── 2 · La famille d'échec qu'il a photographiée ─────────────────────
    await page.evaluate(() => {
      const raison = new Error("An unexpected response was received from the server.");
      window.dispatchEvent(
        new PromiseRejectionEvent("unhandledrejection", {
          promise: Promise.reject(raison),
          reason: raison,
          cancelable: true,
        })
      );
    });
    await bandeau.waitFor({ state: "visible", timeout: 5_000 });

    const dit = (await bandeau.innerText()).replace(/\s+/g, " ");
    assert.match(
      dit,
      /rechargez/i,
      `Le bandeau ne dit pas le geste : « ${dit.slice(0, 120)} »`
    );
    assert.ok(
      !/error|unexpected|server\b/i.test(dit.replace(/serveur/gi, "")),
      `Le bandeau recopie l'anglais du cadre : « ${dit.slice(0, 120)} »`
    );
    assert.equal(
      await bandeau.getByRole("button", { name: "Recharger" }).count(),
      1,
      "Le bouton « Recharger » manque : la phrase dirait quoi faire sans permettre de le faire."
    );
    console.log("  ✓ la phrase française et « Recharger » apparaissent");

    console.log("✅ Une réponse illisible se dit en français, et seulement elle.");
  } finally {
    await contexte.close();
    await navigateur.close();
  }
}

main().catch((erreur) => {
  console.error(erreur);
  process.exit(1);
});
