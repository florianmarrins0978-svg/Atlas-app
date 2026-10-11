import { lancerNavigateur } from "./e2e-browser";
import assert from "node:assert";
import { ADRESSE } from "./_adresse";

/**
 * LA BARRE DU BAS REVIENT QUAND ON QUITTE UN ÉCRAN QUI N'EN A PAS.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * **Sa capture du 17 septembre 2026 :** *« le menu du bas disparaît »*, sur
 * l'accueil, juste après l'envoi d'un devis.
 *
 * Le devis vit seul sur sa page, sans onglets ni cadre. La mise en page racine
 * choisissait donc AU SERVEUR de ne rien rendre autour de lui — et Next.js ne
 * rejoue pas cette mise en page sur une navigation de lien. Le choix fait pour
 * le devis survivait à l'écran suivant, et pour toute la durée de l'onglet :
 * plus de barre, plus de rembourrage du bas, tant qu'il ne rechargeait pas.
 *
 * **Le dépôt avait déjà réparé l'autre sens** — la barre d'un écran précédent
 * qui RESTAIT sur le devis (5 septembre 2026, `ecrans-sans-navigation.ts`). Ce
 * rattrapage-là ne pouvait rien ici : une barre jamais rendue n'a rien à
 * retirer. La correction est dans `CadreApplication`.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * **POURQUOI LE DEVIS EST ATTEINT À SON ADRESSE, ET NON PAR UN LIEN.** C'est la
 * seule façon de reproduire ce qu'il vit : l'application rouverte sur ce devis,
 * la page rechargée, ou l'adresse suivie depuis un message. Atteint par un lien
 * depuis l'accueil, le cadre est déjà là et le défaut ne se voit pas — les deux
 * mesures se contredisaient, et c'est ce qui a fait chercher au mauvais endroit
 * le 5 septembre.
 *
 * **Et le geste joué est un VRAI geste**, celui de sa flèche de retour : une
 * navigation douce, comme celle de l'envoi (`router.push("/")`). Une URL
 * poussée à la main (`history.pushState`) ne rend pas le segment suivant — elle
 * éprouverait la moitié qu'on vient d'écrire, pas le chemin qu'il emprunte
 * (`CLAUDE.md` §5 quater).
 *
 * **Sait échouer** : jouée sur le code d'avant ce lot, elle tombe sur « la
 * barre du bas n'est pas revenue ».
 *
 * **Et elle refuse de conclure** plutôt que de rendre un vert creux : sans
 * chantier à l'accueil, il n'y a pas de devis à ouvrir, donc rien à mesurer.
 */

const BASE = ADRESSE;

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

  const barre = () => page.locator(".atlas-nav-basse").count();

  assert.equal(
    await barre(),
    1,
    "L'accueil chargé à son adresse n'a pas de barre : ce n'est plus le défaut visé, c'est pire."
  );

  const chantierId = await page.evaluate(() => {
    const liens = [...document.querySelectorAll('a[href^="/chantiers/"]')]
      .map((a) => a.getAttribute("href") ?? "")
      .filter((h) => !h.startsWith("/chantiers/nouveau"));
    return liens[0]?.match(/\/chantiers\/([0-9a-f-]{36})/)?.[1] ?? null;
  });
  assert.ok(chantierId, "Aucun chantier à l'accueil : rien à mesurer ici, la suite ne conclut pas.");

  // ── Le devis seul, atteint à SON adresse — l'application rouverte dessus ──
  await page.goto(`${BASE}/chantiers/${chantierId}/devis-complet`, { waitUntil: "networkidle" });
  const retour = page.locator('[data-atlas="retour-du-devis"]');
  await retour.waitFor({ state: "visible", timeout: 15_000 });
  assert.equal(
    await barre(),
    0,
    "La barre d'onglets est revenue sur la page du devis : une feuille de devis n'est pas un écran."
  );

  // ── Le geste : on quitte le devis sans recharger ──────────────────────────
  await retour.click();
  await page.waitForURL((u) => !u.pathname.endsWith("/devis-complet"), { timeout: 15_000 });
  await page.waitForTimeout(600);

  assert.ok(
    !page.url().includes("/devis-complet"),
    `La flèche n'a mené nulle part : toujours sur ${page.url()}`
  );
  assert.equal(
    await barre(),
    1,
    `La barre du bas n'est pas revenue sur ${new URL(page.url()).pathname} : il ne peut plus changer d'onglet sans recharger.`
  );

  // Le cadre entier, pas seulement la barre : sans lui, le bas de la page passe
  // sous les onglets. C'est la même racine, et elle se mesure du même coup.
  assert.equal(
    await page.locator("main.atlas-contenu").count(),
    1,
    "Le cadre de l'application n'est pas revenu : le bas de la page passera sous les onglets."
  );

  await navigateur.close();
  console.log("✓ La barre du bas revient quand on quitte la page du devis.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
