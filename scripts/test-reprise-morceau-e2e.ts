import { lancerNavigateur } from "./e2e-browser";
import assert from "node:assert";
import type { Page, Route } from "playwright";

// **La panne du 11 août 2026, rejouée dans un vrai navigateur.**
//
// Le patron ouvre Atlas sur son téléphone, l'onglet reste ouvert, le serveur de
// son espace redémarre — mise à jour, bascule du banc, veilleur — et les
// morceaux de code changent de nom. Le premier lien qu'il touche ensuite demande
// un fichier que le serveur ne sert plus :
//
//     Failed to load chunk /_next/static/chunks/src_06hhplf._.js
//
// L'écran d'erreur d'Atlas lui offrait alors « Réessayer », qui refait le même
// rendu avec les mêmes adresses mortes et échoue à l'identique, autant de fois
// qu'on appuie.
//
// **Ce que cette suite éprouve, et qu'aucune autre ne pouvait voir** : que la
// page se relève TOUTE SEULE, et qu'elle ne tourne PAS en rond si le
// rechargement ne suffit pas. Les deux comptent autant : une page qui recharge
// sans fin sur un téléphone n'affiche jamais rien à lire — ce serait le remède
// devenu pire que la panne.
//
// Le 404 est posé par le navigateur plutôt qu'en redémarrant le serveur : au
// niveau du réseau, c'est exactement la même chose — le morceau demandé n'est
// pas là —, et c'est reproductible à la seconde près.

const BASE = "http://localhost:3000";
const CLE_RECHARGEMENT = "atlas:rechargement-morceau";

async function connecter(page: Page) {
  await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  await page.fill('input[name="email"]', "demo@atlas.local");
  await page.fill('input[name="password"]', "demo1234");
  await page.click('button[type="submit"]');
  await page.waitForURL(`${BASE}/`, { timeout: 30_000 });
}

/**
 * Fait manquer les morceaux, comme un serveur qui a changé de version sous
 * l'onglet.
 *
 * `arreterAuDocument` est ce qui distingue les deux cas : un rechargement
 * complet commence par redemander le DOCUMENT. Le laisser lever le sabotage,
 * c'est éprouver « la page se relève » ; le maintenir, c'est éprouver « la page
 * ne tourne pas en rond ».
 */
async function saboterLesMorceaux(page: Page, { arreterAuDocument }: { arreterAuDocument: boolean }) {
  let actif = true;
  await page.route("**/*", async (route: Route) => {
    const requete = route.request();
    if (requete.resourceType() === "document") {
      if (arreterAuDocument) actif = false;
      return route.continue();
    }
    if (actif && requete.url().includes("/_next/static/chunks/")) {
      return route.fulfill({ status: 404, contentType: "text/plain", body: "" });
    }
    return route.continue();
  });
}

/** Touche le planning depuis la barre du bas — une navigation côté client. */
async function allerAuPlanning(page: Page) {
  await page.click('a[href="/planning"]');
}

let passed = 0;
let failed = 0;
async function test(nom: string, fn: () => Promise<void>) {
  try {
    await fn();
    console.log(`✅ ${nom}`);
    passed++;
  } catch (err) {
    console.error(`❌ ${nom}`);
    console.error(`   ${err instanceof Error ? err.message : err}`);
    failed++;
  }
}

async function main() {
  const navigateur = await lancerNavigateur();

  // ── Cas 1 : le patron ne voit presque rien, et se retrouve sur son écran ──
  await test("Un morceau manquant recharge la page tout seul, et l'écran revient", async () => {
    const contexte = await navigateur.newContext();
    const page = await contexte.newPage();
    await connecter(page);

    // Le préchauffage compte : sans lui, le premier appel au planning compile
    // la route et l'on mesurerait une lenteur, pas un correctif.
    await page.goto(`${BASE}/planning`, { waitUntil: "networkidle" });
    await page.goto(`${BASE}/`, { waitUntil: "networkidle" });

    await saboterLesMorceaux(page, { arreterAuDocument: true });

    // **On compte les requêtes de DOCUMENT, pas les `framenavigated`.** Le
    // routeur d'App Router navigue par `pushState` : Playwright émet alors
    // `framenavigated` sans qu'aucune page n'ait été rechargée. Compter cela
    // reviendrait à prendre la navigation qu'on provoque pour le rechargement
    // qu'on veut prouver — un contrôle qui passe au vert sans rien mesurer.
    const documents: string[] = [];
    page.on("request", (requete) => {
      if (requete.resourceType() === "document") documents.push(requete.url());
    });

    await allerAuPlanning(page);

    // On attend que la page se retrouve d'aplomb : le titre du planning, rendu
    // par un code qui a bel et bien été rechargé.
    await page.waitForSelector('h1:has-text("Planning")', { timeout: 60_000 });

    assert.ok(
      documents.length > 0,
      "aucun document redemandé : la page n'a pas rechargé, elle s'en est donc sortie autrement"
    );
    const texte = await page.locator("body").innerText();
    assert.doesNotMatch(
      texte,
      /Réessayer/,
      "l'écran d'erreur est encore là : le patron est toujours devant son bouton sans issue"
    );
    await contexte.close();
  });

  // ── Cas 2 : le rechargement ne suffit pas — on s'arrête et on explique ────
  //
  // C'est la garde, et elle vaut le correctif lui-même : sans elle, un serveur
  // durablement en panne donnerait un téléphone qui recharge à l'infini.
  await test("Quand un rechargement vient d'avoir lieu, la page NE recharge PAS — elle explique", async () => {
    const contexte = await navigateur.newContext();
    const page = await contexte.newPage();
    await connecter(page);
    await page.goto(`${BASE}/planning`, { waitUntil: "networkidle" });
    await page.goto(`${BASE}/`, { waitUntil: "networkidle" });

    // On pose la trace d'un rechargement à l'instant : c'est l'état dans lequel
    // se trouve la page qui vient de se relever et retombe aussitôt.
    await page.evaluate(
      ([cle]) => window.sessionStorage.setItem(cle, String(Date.now())),
      [CLE_RECHARGEMENT]
    );

    await saboterLesMorceaux(page, { arreterAuDocument: false });

    // Voir le cas 1 : c'est la requête de DOCUMENT qui signe un rechargement,
    // jamais l'événement de navigation, que le `pushState` du routeur émet aussi.
    let documentsDemandes = 0;
    page.on("request", (requete) => {
      if (requete.resourceType() === "document") documentsDemandes++;
    });

    await allerAuPlanning(page);
    await page.waitForSelector('button:has-text("Recharger")', { timeout: 60_000 });

    const texte = await page.locator("body").innerText();
    assert.match(
      texte,
      /mise à jour/i,
      "le message doit nommer la mise à jour comme cause possible"
    );
    assert.match(texte, /connexion/i, "…et la connexion, l'autre cause possible");
    assert.doesNotMatch(
      texte,
      /Impossible de charger le planning/,
      "le planning n'y est pour rien : accuser le mauvais coupable est le défaut qu'on répare"
    );

    // Laisser passer largement le temps qu'un rechargement automatique aurait
    // pris : s'il devait arriver, il serait arrivé.
    await page.waitForTimeout(3000);
    assert.equal(
      documentsDemandes,
      0,
      "la page a rechargé malgré la garde : c'est la boucle infinie que la garde interdit"
    );

    // **Et le bouton doit être atteignable par le doigt.** Vu en capture, pas
    // supposé : la bulle de l'assistant est `fixed` en bas à droite, et sur
    // l'écran du patron elle recouvrait 48 px du bouton dès que le message
    // dépassait deux lignes. Un écran d'erreur dont le seul recours est sous une
    // bulle ne vaut pas mieux que celui du 11 août.
    // On amène la cible AU CENTRE avant de juger — la même précaution que
    // `test-rien-de-recouvert-e2e.ts`, et pour la même raison : sans elle, tout
    // ce qui se trouve en bas de page est accusé à tort.
    const mesures = await page.evaluate(() => {
      const b = [...document.querySelectorAll("button")].find((x) => x.textContent?.trim() === "Recharger");
      b?.scrollIntoView({ block: "center", inline: "center", behavior: "instant" });
      const bulle = document.querySelector('[aria-label*="ssistant"]');
      return {
        bouton: b ? b.getBoundingClientRect().toJSON() : null,
        bulle: bulle ? bulle.getBoundingClientRect().toJSON() : null,
      };
    });
    assert.ok(mesures.bouton, "le bouton doit exister");
    if (mesures.bulle) {
      const b = mesures.bouton as DOMRect;
      const u = mesures.bulle as DOMRect;
      const chevauche = b.left < u.right && u.left < b.right && b.top < u.bottom && u.top < b.bottom;
      assert.equal(chevauche, false, "la bulle de l'assistant recouvre le bouton « Recharger »");
    }
    await contexte.close();
  });

  await navigateur.close();
  console.log(`\n${passed} test(s) réussi(s), ${failed} échoué(s).`);
  if (failed > 0) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
