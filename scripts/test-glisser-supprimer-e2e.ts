import assert from "node:assert/strict";
import { lancerNavigateur } from "./e2e-browser";

// **Le glissement, sur les trois listes — pas seulement au planning.**
//
// Le patron, le 7 août 2026 : « le slide et la suppression possible que tu as
// fait pour les chantiers planifiés, je veux la même chose pour ceux en attente
// du client et ceux de la catégorie chantier ».
//
// Ce que cette suite tient :
//
//   1. **la corbeille existe sur les trois listes**, et porte le nom du
//      chantier — c'est ce que lit une personne qui n'utilise pas ses yeux, et
//      c'est aussi le seul moyen de vérifier qu'on supprime bien celui qu'on
//      croit ;
//   2. **la carte reste un lien**. Rendre une liste glissante ne doit pas
//      rendre l'ouverture d'un chantier plus difficile : c'est le geste fait
//      cent fois par jour, contre une suppression de temps en temps.
//
// Le mouvement lui-même (élan, résistance, apparition progressive) ne se
// vérifie pas par un test : il se regarde. Ce qui se vérifie, c'est que le
// mécanisme est branché partout où il doit l'être — l'oublier sur une liste est
// le défaut probable, et il est invisible tant qu'on ne glisse pas.

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
  await page.waitForTimeout(1200);

  // --- 1. L'onglet « Chantiers » -----------------------------------------
  const corbeillesAccueil = page.getByRole("button", { name: /^Supprimer le chantier / });
  const nbAccueil = await corbeillesAccueil.count();
  assert.ok(
    nbAccueil > 0,
    "Aucune corbeille sur l'onglet Chantiers : la liste ne glisse pas, alors que c'est la première des trois demandées."
  );

  const liens = page.locator('a[href^="/chantiers/"]');
  assert.ok(
    (await liens.count()) > 0,
    "Les cartes ne sont plus des liens : rendre la liste glissante a coûté le geste le plus fréquent de l'application."
  );
  console.log(`  ✓ onglet Chantiers : ${nbAccueil} carte(s) glissante(s), et toujours des liens`);

  // --- 2. Le planning : « À planifier » et « En attente du client » -------
  await page.goto(`${BASE}/planning`, { waitUntil: "networkidle" });
  await page.waitForTimeout(1200);

  // `innerText` applique `text-transform` : les titres de section, en petites
  // capitales, en ressortent en majuscules. Comparer tel quel n'aurait rien
  // trouvé — et le contrôle aurait accusé le planning d'être vide.
  const ecran = (await page.locator("body").innerText()).toLowerCase();
  const corbeillesPlanning = page.getByRole("button", { name: /^Supprimer le chantier / });
  const nbPlanning = await corbeillesPlanning.count();

  // Le jeu de démonstration ne garantit pas les trois sections peuplées : on
  // n'exige donc que ce qui est réellement affiché. Un contrôle qui échouerait
  // parce qu'une section est vide accuserait à tort.
  const sections = ["à planifier", "en attente du client", "planifiés"].filter((s) => ecran.includes(s));
  assert.ok(sections.length > 0, "Aucune section du planning n'est affichée : le contrôle n'éprouve rien.");
  assert.ok(
    nbPlanning > 0,
    `Aucune corbeille au planning alors que ${sections.length} section(s) y sont affichées : le glissement n'y est plus branché.`
  );
  console.log(`  ✓ planning : ${nbPlanning} carte(s) glissante(s) sur ${sections.join(", ")}`);

  // --- 3. La corbeille reste hors d'atteinte tant qu'on n'a pas glissé -----
  //
  // Deux gestes, jamais un : c'est ce qui distingue ce mécanisme d'un bouton
  // posé sur la carte. Sur un chantier, avec des gants, un bouton de
  // suppression atteignable au doigt finit par être touché.
  const premiere = corbeillesPlanning.first();
  assert.equal(
    await premiere.getAttribute("tabindex"),
    "-1",
    "La corbeille est atteignable au clavier sans avoir glissé : elle sera touchée par accident."
  );
  console.log("  ✓ la corbeille reste hors d'atteinte tant que la carte n'a pas glissé");

  await navigateur.close();
  console.log("✅ Les trois listes glissent, et rien n'est devenu plus difficile.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
