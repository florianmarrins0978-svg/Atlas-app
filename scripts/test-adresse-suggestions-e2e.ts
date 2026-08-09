import assert from "node:assert/strict";
import { lancerNavigateur } from "./e2e-browser";

// **Le geste que le patron a décrit, joué en entier.**
//
// Le 7 août 2026 : *« on commence à taper l'adresse et il nous propose tout un
// tas de listes, et plus on écrit, plus l'adresse se réduit ; ensuite il n'y a
// plus qu'à cliquer sur notre adresse et ça la valide, ça l'enregistre. »*
//
// Ce que cette suite tient, et qu'aucune autre ne voit :
//
//   1. **la liste apparaît pendant la frappe**, sans qu'on touche à rien ;
//   2. **toucher une ligne remplit le champ ENTIER** — code postal et commune
//      compris. C'est tout l'intérêt : sinon il faut retaper la fin ;
//   3. **le choix ne rouvre pas la liste sous le doigt.** Le champ change de
//      valeur au moment du choix ; si ce changement relançait une recherche, la
//      liste se rouvrirait sur l'adresse tout juste validée, par-dessus le
//      bouton « Créer le chantier » ;
//   4. **une panne du service ne casse pas le formulaire.** Le patron travaille
//      dehors : le réseau va et vient. Le champ doit rester un champ ordinaire,
//      et le chantier doit pouvoir se créer quand même.
//
// La réponse du service est fournie ici par le navigateur lui-même : le
// mandataire réseau de cet environnement refuse `api-adresse.data.gouv.fr`. Le
// contrôle contre le VRAI service vit dans `.github/workflows/adresses.yml`, sur
// une machine qui peut le joindre.

const BASE = "http://localhost:3000";

const REPONSE = {
  suggestions: [
    { libelle: "20 Rue de la Paix 75002 Paris", contexte: "75, Paris, Île-de-France" },
    { libelle: "20 Rue de la Paix 78200 Mantes-la-Jolie", contexte: "78, Yvelines, Île-de-France" },
  ],
};

async function main() {
  const navigateur = await lancerNavigateur();
  const contexte = await navigateur.newContext({ viewport: { width: 393, height: 852 } });
  const page = await contexte.newPage();

  let appels = 0;
  let servicePanne = false;
  await page.route("**/api/adresses**", async (route) => {
    appels++;
    if (servicePanne) {
      await route.fulfill({ status: 502, contentType: "text/html", body: "<html>panne</html>" });
      return;
    }
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(REPONSE) });
  });

  await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  await page.fill('input[name="email"]', "demo@atlas.local");
  await page.fill('input[name="password"]', "demo1234");
  await page.click('button[type="submit"]');
  await page.waitForURL(`${BASE}/`, { timeout: 15000 });

  await page.goto(`${BASE}/chantiers/nouveau`, { waitUntil: "networkidle" });

  // Vérifié AVANT de s'en servir : sans cela, un champ d'adresse redevenu
  // ordinaire ne produit qu'un « Timeout waiting for getByRole('combobox') »,
  // qui envoie chercher un défaut de navigateur là où c'est l'écran qui a
  // changé. Une erreur qui accuse à tort coûte plus cher que pas d'erreur.
  const adresse = page.getByRole("combobox").first();
  assert.equal(
    await adresse.count(),
    1,
    "Le champ « Adresse du chantier » ne propose plus rien : c'est un champ ordinaire, et le geste décrit par le patron n'existe pas."
  );

  // --- 1. Rien ne part tant qu'il n'y a rien à chercher --------------------
  await adresse.fill("20");
  await page.waitForTimeout(700);
  assert.equal(
    appels,
    0,
    `${appels} requête(s) pour deux caractères : à ce rythme, une adresse entière en coûte huit, et le service nous couperait.`
  );

  // --- 2. La liste apparaît pendant la frappe ------------------------------
  await adresse.fill("20 rue de la paix");
  const liste = page.getByRole("listbox");
  await liste.waitFor({ state: "visible", timeout: 5000 });

  const lignes = page.getByRole("option");
  assert.equal(await lignes.count(), 2, "La liste n'affiche pas les adresses proposées.");
  const premiere = (await lignes.first().innerText()).replace(/\s+/g, " ");
  assert.match(
    premiere,
    /78, Yvelines|75, Paris/,
    `Le département manque sous l'adresse : deux rues du même nom seraient indiscernables. Lu : « ${premiere} »`
  );

  // --- 3. Toucher une ligne remplit le champ entier ------------------------
  await page.getByRole("option").nth(1).click();
  await page.waitForTimeout(400);
  assert.equal(
    await adresse.inputValue(),
    "20 Rue de la Paix 78200 Mantes-la-Jolie",
    "L'adresse choisie ne s'inscrit pas ENTIÈRE : le code postal et la commune seraient à retaper."
  );

  // --- 4. Le choix ne rouvre pas la liste sous le doigt --------------------
  await page.waitForTimeout(700);
  assert.equal(
    await liste.count(),
    0,
    "La liste s'est rouverte sur l'adresse tout juste validée — elle recouvre alors le bouton « Créer le chantier »."
  );

  // --- 5. Une panne du service ne casse pas le formulaire ------------------
  servicePanne = true;
  await adresse.fill("7 chemin de la Scierie");
  await page.waitForTimeout(900);
  assert.equal(await liste.count(), 0, "Une panne du service ne doit rien afficher, surtout pas une liste vide ouverte.");
  assert.equal(
    await adresse.inputValue(),
    "7 chemin de la Scierie",
    "Le champ a perdu ce qui était tapé : une aide en panne ne doit pas emporter la saisie."
  );

  // Et le chantier se crée quand même, avec une adresse que la base ignore —
  // un chemin, un lieu-dit, « derrière la scierie ». C'est là qu'il travaille.
  await page.getByRole("button", { name: /Créer le chantier/i }).click();
  // **Généreux, et pour une raison précise.** Cette suite passe la PREMIÈRE de
  // la batterie (ordre alphabétique) : elle paie donc la toute première
  // compilation de la fiche de chantier, sur un serveur de développement qui
  // n'a encore rien en cache. Quinze secondes suffisaient seule et pas en
  // batterie — l'échec accusait alors l'adresse, qui n'y était pour rien.
  await page.waitForURL(/\/chantiers\/[0-9a-f-]{36}$/, { timeout: 60_000 });
  // La fiche affiche « CHARGEMENT… » le temps de se composer : lire l'écran à
  // cet instant reviendrait à accuser le produit d'avoir perdu l'adresse.
  await page.waitForFunction(() => !document.body.innerText.includes("CHARGEMENT"), null, { timeout: 40_000 });

  const fiche = await page.locator("body").innerText();
  assert.match(
    fiche,
    /Scierie/i,
    "L'adresse libre n'a pas été conservée : la liste aurait alors enfermé le patron dans ce que la base connaît."
  );

  await navigateur.close();
  console.log("✅ L'adresse se propose, se choisit d'un doigt, et n'enferme personne.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
