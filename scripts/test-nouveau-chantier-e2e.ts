import { lancerNavigateur } from "./e2e-browser";
import { nomDuChantier } from "../src/lib/nom-chantier";
import { jourIso } from "../src/lib/jour";
import assert from "node:assert";
import { creerPuisFiche } from "./_creer-chantier-e2e";

// Créer un chantier, et ce que cela demande au patron.
//
// **Le 5 août 2026 : « dans la catégorie chantier, retire la case nom du
// chantier ».** C'était le seul champ obligatoire, et le seul qui lui demandait
// d'inventer quelque chose : un élagueur ne baptise pas ses chantiers, il dit
// « chez M. Bernard ». Lui faire trouver un titre avant de pouvoir commencer,
// c'était une porte fermée à clé devant une maison ouverte.
//
// Ce que cette suite tient désormais :
//   1. le champ n'existe plus, et **plus rien n'est obligatoire** ;
//   2. le chantier porte quand même un nom, déduit de ce qu'il a donné ;
//   3. ce nom le suit — sur la fiche comme dans la liste.

async function main() {
  const browser = await lancerNavigateur();
  const context = await browser.newContext({ deviceScaleFactor: 3 });
  const page = await context.newPage();

  // Connexion réelle (Auth.js) — toutes les routes applicatives sont
  // désormais protégées par le middleware d'authentification.
  await page.goto("http://localhost:3000/login", { waitUntil: "networkidle" });
  await page.fill('input[name="email"]', "demo@atlas.local");
  await page.fill('input[name="password"]', "demo1234");
  await page.click('button[type="submit"]');
  await page.waitForURL("http://localhost:3000/", { timeout: 10000 });

  const client = `M. E2E ${Date.now()}`;
  // Le nom du chantier se DÉDUIT du client (`src/lib/nom-chantier.ts`) : on
  // applique la même règle que le produit plutôt que de la recomposer. Recopié
  // « Chez … » ici, ce contrôle est passé au rouge le 13 août 2026, le jour où
  // le patron a fait retirer ce mot.
  const nomAttendu = nomDuChantier({ nomClient: client, jour: jourIso(new Date()) });

  await page.goto("http://localhost:3000/chantiers/nouveau", { waitUntil: "networkidle" });

  // Le champ retiré ne doit pas revenir par une autre porte.
  assert.equal(
    await page.locator('input[placeholder="Rénovation salle de bain"]').count(),
    0,
    "La case « Nom du chantier » est de retour : le patron a demandé qu'elle disparaisse."
  );

  // Et rien n'est obligatoire : le bouton est actif sur un formulaire vierge.
  assert.ok(
    await page.locator('[data-atlas="action-ecrire"]').isEnabled(),
    "Le bouton reste inactif sur un formulaire vide : quelque chose est encore exigé."
  );

  // ── Sa fiche client refaite, le 21 août 2026 ──────────────────────────────
  //
  // Trois demandes littérales, éprouvées ICI parce qu'aucune ne se voit ailleurs
  // que dans le navigateur : le numéro qui s'espace à la frappe, le nom et le
  // numéro sur la même ligne, et la question de l'envoi passée SOUS l'adresse.

  const tel = page.locator('input[type="tel"]');
  await tel.click();
  await tel.pressSequentially("0679984514", { delay: 20 });
  assert.equal(
    await tel.inputValue(),
    "06 79 98 45 14",
    "« il faut que je puisse taper les dix chiffres à la suite et qu'ils se mettent " +
      "automatiquement avec les bons espaces » — ce n'est pas le cas"
  );

  const boiteNom = await page.locator('input[placeholder="Bernard"]').boundingBox();
  const boiteTel = await tel.boundingBox();
  assert.ok(boiteNom && boiteTel, "le nom et le numéro doivent être dessinés pour être comparés");
  assert.ok(
    Math.abs(boiteNom.y - boiteTel.y) < 4,
    `le nom et le numéro ne sont plus sur la même ligne (${Math.round(Math.abs(boiteNom.y - boiteTel.y))} px d'écart)`
  );
  // Un numéro coupé ne se rappelle pas : c'est la seule donnée qu'on ne devine
  // pas. À 132 px, le dernier chiffre tombait — en silence.
  assert.ok(
    await tel.evaluate((e: HTMLInputElement) => e.scrollWidth <= e.clientWidth + 1),
    "le numéro déborde de sa case : il s'affiche tronqué"
  );

  // « Comment lui envoyer son devis, tu le mets sous l'adresse. »
  //
  // **On vise les CAPSULES, plus l'intitulé** — 30 août 2026. La question est
  // partie de l'écran pour qu'il tienne dans une page ; elle reste en
  // `aria-label` sur le groupe. Ce que sa demande fixait, c'est la PLACE du
  // choix sous l'adresse, pas la présence d'une phrase au-dessus : chercher le
  // texte, c'était réclamer ce qu'il a fait retirer (`CLAUDE.md` §5 bis).
  // **Le canal se désigne par sa MARQUE, plus par son libellé** — 4 septembre
  // 2026. Le mot est passé de « Par SMS » à « SMS » avec la planche
  // « A — Épurée », qu'il a retenue : *« l'envoi n'est plus une action, c'est
  // un réglage »*. Viser le texte, c'était réclamer ce qu'il vient de faire
  // changer ; `data-atlas="canal-sms"` survit au remaniement, et c'est la
  // PLACE sous l'adresse que ce contrôle défend (`CLAUDE.md` §5 bis).
  const boiteAdresse = await page.locator('input[placeholder="12 rue des Lilas, Nantes"]').boundingBox();
  const boiteCanal = await page.locator('[data-atlas="canal-sms"]').boundingBox();
  assert.ok(boiteAdresse && boiteCanal, "l'adresse et le choix de l'envoi doivent être visibles");
  assert.ok(
    boiteCanal.y > boiteAdresse.y,
    "le choix du canal d'envoi n'est pas sous l'adresse"
  );

  // Un retrait ne tient que par ce qui ne doit plus être là.
  const ecran = await page.locator("form").innerText();
  assert.ok(!/facultatif/i.test(ecran), "« facultatif » est revenu sur la fiche client");
  assert.ok(!/civilit/i.test(ecran), "l'intitulé « Civilité » est revenu : il l'a fait retirer");

  await page.fill('input[placeholder="Bernard"]', client);
  const idChantier = await creerPuisFiche(page);

  // **L'IDENTIFIANT RENDU, PLUS L'ADRESSE D'ARRIVÉE.** Ce contrôle lisait
  // l'adresse et exigeait qu'elle FINISSE par un UUID — c'est-à-dire la fiche
  // du chantier, retirée le 4 septembre 2026 (`ARCHITECTURE.md` §254). Ce qu'il
  // défend n'a pas bougé : la création rend un vrai chantier, pas une
  // simulation.
  assert.match(idChantier, /^[0-9a-f-]{36}$/, "La création ne rend pas un vrai UUID");

  // Le nom déduit et l'anneau se regardent sur la FICHE CLIENT : c'est elle qui
  // les porte depuis le 31 août, et c'était le doublon qu'il a fait retirer.
  await page.goto(`http://localhost:3000/chantiers/${idChantier}/coordonnees`, {
    waitUntil: "networkidle",
  });

  // La page hub relit le chantier depuis la base — si ces valeurs s'affichent,
  // la création a bien été persistée (pas de simulation restante).
  //
  // Le nom attendu est celui que déduit `src/lib/nom-chantier.ts`.
  //
  // **`.first()` et non le locator nu, depuis le 13 août 2026.** Le nom du
  // chantier ne porte plus « Chez » devant : quand le client s'appelle déjà
  // « M. … », le nom du chantier lui est IDENTIQUE, et le même texte se trouve
  // donc à deux endroits de la fiche. Playwright refusait alors d'agir —
  // « strict mode violation » — sur une page parfaitement juste. Ce qui est
  // éprouvé ici, c'est que le nom déduit est bien à l'écran, pas qu'il n'y
  // figure qu'une fois.
  // **LE NOM SE LIT DANS SON CHAMP, plus dans le texte de la page.** Il
  // s'affichait en titre de la fiche du chantier ; celle-ci est retirée le
  // 4 septembre 2026 (`ARCHITECTURE.md` §254), et sur la fiche client ce nom
  // vit là où il se corrige — dans le formulaire. Un `text=` n'y voit rien : la
  // valeur d'un champ n'est pas du texte de page, et le contrôle aurait rougi
  // sur un écran parfaitement juste.
  const champNom = page.locator('input[placeholder="Bernard"]');
  await champNom.waitFor({ state: "visible", timeout: 10_000 });
  assert.equal(
    (await champNom.inputValue()).trim(),
    client,
    "Le chantier n'a pas pris le nom de son client : il est devenu impossible à reconnaître."
  );
  // **Ce contrôle réclamait « Ajouter des photos » dans le tiroir — il ne le
  // peut plus, et c'est le parcours qui a changé, pas un défaut.** Depuis le
  // 21 août 2026, le seul bouton de la fiche client mène au DEVIS : un devis
  // brouillon existe donc dès la création, et le tiroir cesse alors d'annoncer
  // les étapes qui l'ont précédé. Les photos, elles, se posent maintenant sur
  // la fiche client (`Pellicule`), pas ici.
  //
  // Ce qu'on vérifie à la place tient à ce qui EST le cœur de cette fiche, et
  // qui survivra au prochain remaniement : l'anneau y est, dès l'arrivée, sur
  // un chantier neuf — sa demande du 11 août 2026.
  assert.ok(
    await page.locator('[data-atlas="anneau-note-vocale"]').isVisible(),
    "L'anneau manque sur la fiche d'un chantier neuf"
  );

  // Revérifie via la liste (autre écran, autre requête) que le chantier y figure aussi.
  await page.goto("http://localhost:3000/", { waitUntil: "networkidle" });
  assert.ok(
    await page.locator(`text=${nomAttendu}`).first().isVisible(),
    "Le nouveau chantier doit apparaître dans la liste, sous son nom déduit"
  );

  // --- Sans rien du tout ---------------------------------------------------
  // Le cas qui rendait le champ obligatoire. Un chantier sans client ni adresse
  // doit exister quand même, et rester reconnaissable : la date est la seule
  // chose vraie qui reste, et elle vaut mieux qu'un « Sans titre ».
  await page.goto("http://localhost:3000/chantiers/nouveau", { waitUntil: "networkidle" });
  await creerPuisFiche(page);
  // **LE NOM SE LIT DANS LA LISTE, PLUS DANS LE TITRE DE LA FICHE.** Il se
  // lisait dans le `h1` de la fiche du chantier ; cette fiche est retirée le
  // 4 septembre 2026 (`ARCHITECTURE.md` §254). La liste est l'écran où ce nom
  // SERT — c'est là qu'il reconnaît son chantier —, et c'est déjà par elle que
  // le cas précédent se vérifie deux blocs plus haut.
  await page.goto("http://localhost:3000/", { waitUntil: "networkidle" });
  const sansNom = page.locator(`text=/^Chantier du /`).first();
  assert.ok(
    await sansNom.isVisible(),
    "Un chantier créé sans rien n'a pas de nom lisible dans la liste"
  );

  await browser.close();
  console.log("✅ Test bout-en-bout de création réussi.");
}

main().catch((err) => {
  console.error("❌", err);
  process.exit(1);
});
