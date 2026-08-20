import { lancerNavigateur } from "./e2e-browser";
import assert from "node:assert";

/**
 * Le bouton de l'accueil : le geste, et sa demi-seconde.
 *
 * **Il s'appelle « Créer un devis » depuis le 18 août 2026** — sa décision, une
 * autre session. Ce contrôle visait encore « Nouveau chantier » : il a rougi
 * sur du code juste, et son message accusait la feuille de ne pas s'ouvrir
 * alors qu'elle s'ouvrait très bien sous un autre nom.
 *
 * **Pourquoi cette suite existe.** Le patron a arrêté ce bouton après onze
 * maquettes, en réglant lui-même l'onde, la taille du rond et le nombre de
 * grains (`docs/maquettes/24-le-bouton-retenu.html`). Le délai de 520 ms est
 * exactement le genre de chose qu'un correctif de confort supprime sans y
 * penser — et personne ne s'en apercevrait : l'écran marcherait toujours, il
 * aurait seulement perdu ce qui a coûté une soirée. Une suite qui regarde
 * l'écran ne l'aurait pas vu ; il fallait le mesurer.
 *
 * Ce qu'elle éprouve, et chaque point correspond à une phrase de sa demande :
 *
 *   1. le bouton est là, rond et petit — l'aplat vert qui barrait l'écran n'y
 *      est plus ;
 *   2. la feuille ne monte pas tout de suite : la demi-seconde tient ;
 *   3. elle finit par monter ;
 *   4. un second appui pendant le geste n'ouvre pas deux feuilles — sinon deux
 *      chantiers naissent là où il n'en voulait qu'un ;
 *   5. sous « mouvement réduit », elle monte TOUT DE SUITE : attendre une
 *      animation qui ne joue pas ferait passer un réglage d'accessibilité pour
 *      une lenteur ;
 *   6. **le mot est gros et très gras, et il n'est pas coupé.** Ajouté le
 *      16 août 2026, quand le patron est revenu sur son propre resserrage :
 *      « les capitales, gros et très gras » (`docs/maquettes/67`). Deux
 *      dangers, opposés, et une seule mesure les tient : qu'un correctif de
 *      style le ramène au libellé minuscule d'avant, ou qu'on le grossisse
 *      jusqu'à ce qu'il finisse en « … » sur son téléphone. Le contrôle se
 *      fait à 360 px — le plus étroit de ses écrans —, parce qu'une coupure ne
 *      se voit pas sur un écran large.
 */
const BASE = "http://localhost:3000";

/** Le lien garde son `href` : tant que React n'a pas attaché son écouteur, un
 *  appui NAVIGUE vers la page entière au lieu de jouer le geste. C'est le repli
 *  voulu quand JavaScript manque — mais cliquer avant l'hydratation ferait
 *  échouer la suite sur un défaut inexistant. */
async function attendreEcranVivant(page: import("playwright").Page) {
  try {
    await page
      .locator("[data-atlas-vivant='oui']")
      .first()
      .waitFor({ state: "attached", timeout: 60_000 });
  } catch {
    throw new Error(
      "L'écran ne s'est jamais hydraté : ce n'est pas le bouton qui est en cause. " +
        "Vérifier que le serveur de développement a fini de compiler, et que " +
        "l'adresse est bien « localhost » (Next bloque ses ressources sur 127.0.0.1).",
    );
  }
}

async function seConnecter(page: import("playwright").Page) {
  await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  await page.fill('input[name="email"]', "demo@atlas.local");
  await page.fill('input[name="password"]', "demo1234");
  await page.click('button[type="submit"]');
  await page.waitForURL(`${BASE}/`, { timeout: 15_000 });
  await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
  await attendreEcranVivant(page);
}

async function main() {
  const navigateur = await lancerNavigateur();

  // ── Le geste, en mouvement normal ────────────────────────────────────────
  const contexte = await navigateur.newContext();
  const page = await contexte.newPage();
  await seConnecter(page);

  const bouton = page.locator('[data-atlas="nouveau-chantier"]');
  await bouton.waitFor({ state: "visible", timeout: 5_000 });

  const rond = bouton.locator(".atlas-rond");
  const boite = await rond.boundingBox();
  assert.ok(boite, "L'anneau doit être mesurable");
  assert.ok(
    boite.width <= 60 && Math.abs(boite.width - boite.height) < 2,
    `L'anneau doit être rond et petit, pas un aplat qui barre l'écran ` +
      `(mesuré ${Math.round(boite.width)} × ${Math.round(boite.height)})`,
  );

  // ── Le mot : gros, très gras, et entier ──────────────────────────────────
  //
  // Les valeurs viennent de la planche 67, pas d'une appréciation : c'est le
  // cran « Gros » et la graisse « Très gras » qu'il a désignés. On mesure large
  // (≥ 12 px, ≥ 700) plutôt qu'au pixel près — figer 13 et 800 rendrait rouge
  // le jour où il demande un cran de plus, alors que la suite doit attraper le
  // retour au libellé minuscule, pas un réglage qu'il aura voulu.
  const mot = bouton.locator(".atlas-mot");
  const ecriture = await mot.evaluate((n) => {
    const s = getComputedStyle(n);
    return { taille: Number.parseFloat(s.fontSize), poids: Number.parseInt(s.fontWeight, 10) };
  });
  assert.ok(
    ecriture.taille >= 12,
    `Le mot doit rester gros — mesuré ${ecriture.taille} px, il en faut au moins 12 ` +
      `(le patron est revenu sur son resserrage le 16 août 2026)`,
  );
  assert.ok(
    ecriture.poids >= 700,
    `Le mot doit rester très gras — mesuré ${ecriture.poids}, il en faut au moins 700`,
  );

  // Et sur son écran le plus étroit, il ne doit pas se couper. Une boîte de
  // zéro pixel n'est pas un succès : c'est une mesure impossible, et la rendre
  // verte est le défaut du 15 août 2026.
  await page.setViewportSize({ width: 360, height: 780 });
  await page.waitForTimeout(120);
  const boiteMot = await mot.boundingBox();
  assert.ok(
    boiteMot && boiteMot.width > 1,
    "Le mot ne se mesure pas à 360 px — rien n'a été éprouvé",
  );
  const coupe = await mot.evaluate((n) => n.scrollWidth > n.clientWidth + 1);
  assert.ok(!coupe, "À 360 px, le libellé du bouton est coupé : le mot est trop gros");
  const debordement = await bouton.evaluate((n) => {
    const b = n.getBoundingClientRect();
    return { gauche: b.left, droite: window.innerWidth - b.right };
  });
  assert.ok(
    debordement.gauche >= 0 && debordement.droite >= 0,
    `À 360 px, le bouton déborde de l'écran (${Math.round(debordement.gauche)} px à gauche, ` +
      `${Math.round(debordement.droite)} px à droite)`,
  );
  await page.setViewportSize({ width: 390, height: 844 });

  const feuille = page.locator('div[role="dialog"][aria-label="Créer un devis"]');
  assert.equal(await feuille.isVisible(), false, "La feuille est fermée au départ");

  // **Le clic est envoyé au nœud lui-même.** Le geste déplace ce qu'il y a
  // autour de lui (les lettres s'écartent) : un clic positionnel rejoué par
  // l'outil relancerait le geste en boucle, et l'échec accuserait alors le
  // bouton là où le fautif serait l'outil.
  const depart = Date.now();
  await bouton.evaluate((n) => (n as HTMLElement).click());

  await page.waitForTimeout(150);
  assert.equal(
    await feuille.isVisible(),
    false,
    "À 150 ms, la feuille ne doit pas être montée : la demi-seconde du geste a disparu",
  );

  // Le tour se joue-t-il vraiment ? Une classe posée ne prouve rien : on lit
  // les animations que le navigateur exécute.
  const tours = await bouton.evaluate(
    (n) => n.querySelector(".atlas-signe")?.getAnimations().length ?? 0,
  );
  assert.ok(tours > 0, "Le signe doit tourner pendant le geste");

  // Un second appui pendant le geste : il doit être ignoré.
  await bouton.evaluate((n) => (n as HTMLElement).click());

  await feuille.waitFor({ state: "visible", timeout: 3_000 });
  const attente = Date.now() - depart;
  assert.ok(
    attente >= 380,
    `La feuille est montée en ${attente} ms : le geste doit durer environ une demi-seconde`,
  );
  assert.equal(
    await page.locator('div[role="dialog"][aria-label="Créer un devis"]').count(),
    1,
    "Deux appuis pendant le geste ne doivent pas ouvrir deux feuilles",
  );
  await contexte.close();

  // ── Le même geste, sous « mouvement réduit » ─────────────────────────────
  const calme = await navigateur.newContext({ reducedMotion: "reduce" });
  const pageCalme = await calme.newPage();
  await seConnecter(pageCalme);
  const boutonCalme = pageCalme.locator('[data-atlas="nouveau-chantier"]');
  await boutonCalme.waitFor({ state: "visible", timeout: 5_000 });
  await boutonCalme.evaluate((n) => (n as HTMLElement).click());
  await pageCalme.waitForTimeout(120);
  assert.equal(
    await pageCalme
      .locator('div[role="dialog"][aria-label="Créer un devis"]')
      .isVisible(),
    true,
    "Sous « mouvement réduit », la feuille doit monter tout de suite — attendre " +
      "une animation qui ne joue pas ferait passer un réglage d'accessibilité pour une lenteur",
  );
  await calme.close();

  await navigateur.close();
  console.log("✅ Le bouton tourne, attend sa demi-seconde, puis ouvre la feuille.");
}

main().catch((erreur) => {
  console.error(erreur);
  process.exit(1);
});
