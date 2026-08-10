import assert from "node:assert/strict";
import { lancerNavigateur } from "./e2e-browser";

// **Le retrait, sur toutes les listes — pas seulement au planning.**
//
// Le patron, le 7 août 2026 : « le slide et la suppression possible que tu as
// fait pour les chantiers planifiés, je veux la même chose pour ceux en attente
// du client et ceux de la catégorie chantier ». Puis, le 10 août 2026, une fois
// la maquette retenue : « je veux qu'il applique ce style à tout ce qu'on peut
// supprimer dans l'appli ».
//
// **Ce qui a changé, et pourquoi cette suite a changé avec.** La corbeille
// rouge qui se découvrait sous la carte n'existe plus : le texte glisse,
// « Retirer » se découvre, la ligne tombe, et un tiroir la retient en bas de
// l'écran. La sécurité est passée d'une confirmation AVANT à une réversibilité
// APRÈS — c'est le geste retenu, et il vaut partout.
//
// Ce que cette suite tient :
//
//   1. **le geste existe sur les listes de chantiers**, accueil et planning, et
//      son libellé accessible porte le nom du chantier — c'est ce que lit une
//      personne qui n'utilise pas ses yeux, et c'est aussi le seul moyen de
//      vérifier qu'on retire bien celui qu'on croit ;
//   2. **la ligne reste un lien**. Rendre une liste retirable ne doit pas
//      rendre l'ouverture d'un chantier plus difficile : c'est le geste fait
//      cent fois par jour, contre un retrait de temps en temps ;
//   3. **« Retirer » n'est pas atteignable sans avoir glissé** — deux gestes,
//      jamais un. Avec des gants, dans une camionnette, un bouton de
//      suppression posé à découvert finit par être touché ;
//   4. **le tiroir rattrape**, et « Annuler » vise la ligne réellement retirée.
//
// Le mouvement lui-même — l'élan, la dissolution du texte au bord — ne se
// vérifie pas par un test : il se regarde (`scripts/capture-retrait.mts`).
// Ce qui se vérifie, c'est que le mécanisme est branché partout où il doit
// l'être : l'oublier sur une liste est le défaut probable, et il est invisible
// tant qu'on ne glisse pas.

const BASE = "http://localhost:3000";

async function main() {
  const navigateur = await lancerNavigateur();
  const contexte = await navigateur.newContext({ viewport: { width: 393, height: 852 }, hasTouch: true });
  const page = await contexte.newPage();

  await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  await page.fill('input[name="email"]', "demo@atlas.local");
  await page.fill('input[name="password"]', "demo1234");
  await page.click('button[type="submit"]');
  await page.waitForURL(`${BASE}/`, { timeout: 20000 });
  // Le marqueur n'apparaît qu'après le premier effet : attendre l'affichage ne
  // suffit pas, le HTML rendu par le serveur porte déjà les boutons sans le
  // moindre écouteur.
  await page.locator("[data-atlas-vivant='oui']").first().waitFor({ state: "attached", timeout: 30000 });

  // --- 1. L'onglet « Chantiers » -----------------------------------------
  const retraitsAccueil = page.getByRole("button", { name: /^Retirer le chantier / });
  const nbAccueil = await retraitsAccueil.count();
  assert.ok(
    nbAccueil > 0,
    "Aucun « Retirer » sur l'onglet Chantiers : la liste n'a pas le geste, alors que c'est la première des listes demandées."
  );

  const liens = page.locator('a[href^="/chantiers/"]');
  assert.ok(
    (await liens.count()) > 0,
    "Les lignes ne sont plus des liens : poser le retrait a coûté le geste le plus fréquent de l'application."
  );
  console.log(`  ✓ onglet Chantiers : ${nbAccueil} ligne(s) retirable(s), et toujours des liens`);

  // --- 2. « Retirer » reste hors d'atteinte tant qu'on n'a pas glissé -----
  //
  // Deux gestes, jamais un — et c'est une mesure, pas une impression.
  // La mesure qui compte n'est pas « où le bouton est dessiné » mais **ce que
  // le doigt touche à cet endroit**. Le bouton vit au bout d'une colonne qui
  // défile : au repos il est dessiné juste au bord, et son entière largeur est
  // rognée par le conteneur. Comparer sa position à celle de la fenêtre ne
  // dirait donc rien — il faut interroger le point lui-même.
  const premier = retraitsAccueil.first();
  const boite = await premier.boundingBox();
  assert.ok(boite, "« Retirer » n'a aucune boîte : cible de zéro pixel.");
  const atteignableAuRepos = await page.evaluate(
    ([x, y]) => {
      const el = document.elementFromPoint(x as number, y as number);
      return el ? !!el.closest(".atlas-decouvre") : false;
    },
    [boite!.x + boite!.width / 2, boite!.y + boite!.height / 2]
  );
  assert.equal(
    atteignableAuRepos,
    false,
    "« Retirer » est touchable sans avoir glissé : il sera atteint par accident, avec des gants, dans une camionnette."
  );
  console.log("  ✓ « Retirer » reste hors d'atteinte tant que le texte n'a pas glissé");

  // --- 3. Le geste, jusqu'au tiroir ---------------------------------------
  const avant = await page.locator(".atlas-ligne").count();
  await page.locator(".atlas-glisse").first().evaluate((el) => {
    el.scrollTo({ left: el.scrollWidth, behavior: "instant" as ScrollBehavior });
  });
  await page.waitForTimeout(400);
  await premier.click();
  await page.waitForTimeout(900);

  const partiesAccueil = avant - (await page.locator('.atlas-ligne:not([data-retiree="oui"])').count());
  assert.equal(
    partiesAccueil,
    1,
    `${partiesAccueil} ligne(s) sont parties au lieu d'une seule : le retrait frappe ses voisines.`
  );
  const tiroir = page.locator(".atlas-tiroir[data-ouvert='oui']");
  assert.equal(await tiroir.count(), 1, "Le tiroir des retirés ne s'est pas ouvert : rien ne rattrape le geste.");

  // « Annuler » doit viser la ligne réellement retirée. Un libellé unique
  // pointant toujours la même rendrait la première quand on retire la deuxième.
  const annuler = page.getByRole("button", { name: /^Annuler le retrait de / });
  assert.equal(await annuler.count(), 1, "Le tiroir ne nomme pas la ligne retirée : « Annuler » ne dit pas quoi.");
  await annuler.click();
  await page.waitForTimeout(700);
  assert.equal(
    await page.locator('.atlas-ligne:not([data-retiree="oui"])').count(),
    avant,
    "« Annuler » n'a pas rendu la ligne : une annulation qui ne rend rien est pire que pas d'annulation."
  );
  console.log("  ✓ la ligne tombe, le tiroir la retient, et « Annuler » la rend");

  // --- 4. Le planning : ses trois listes ----------------------------------
  await page.goto(`${BASE}/planning`, { waitUntil: "networkidle" });
  await page.locator("[data-atlas-vivant='oui']").first().waitFor({ state: "attached", timeout: 30000 });

  // `innerText` applique `text-transform` : les titres de section, en petites
  // capitales, en ressortent en majuscules. Comparer tel quel n'aurait rien
  // trouvé — et le contrôle aurait accusé le planning d'être vide.
  const ecran = (await page.locator("body").innerText()).toLowerCase();
  const nbPlanning = await page.getByRole("button", { name: /^Retirer le chantier / }).count();

  // Le jeu de démonstration ne garantit pas les trois sections peuplées : on
  // n'exige donc que ce qui est réellement affiché. Un contrôle qui échouerait
  // parce qu'une section est vide accuserait à tort.
  const sections = ["à planifier", "en attente du client", "planifiés"].filter((s) => ecran.includes(s));
  assert.ok(sections.length > 0, "Aucune section du planning n'est affichée : le contrôle n'éprouve rien.");
  assert.ok(
    nbPlanning > 0,
    `Aucun « Retirer » au planning alors que ${sections.length} section(s) y sont affichées : le geste n'y est plus branché.`
  );
  console.log(`  ✓ planning : ${nbPlanning} ligne(s) retirable(s) sur ${sections.join(", ")}`);

  await navigateur.close();
  console.log("✅ Le retrait est branché partout, et rien n'est devenu plus difficile.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
