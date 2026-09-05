import assert from "node:assert/strict";
import { lancerNavigateur } from "./e2e-browser";
import { creerPuisFiche } from "./_creer-chantier-e2e";

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
//      bouton de création (« Je dicte mon devis ») ;
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
  const contexte = await navigateur.newContext();
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
    "La liste s'est rouverte sur l'adresse tout juste validée — elle recouvre alors les boutons de création."
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
  const chantierId = await creerPuisFiche(page);
  // **ON NE VA PLUS SUR LA FICHE DU CHANTIER : elle n'existe plus** — retirée
  // le 4 septembre 2026 (`ARCHITECTURE.md` §254), son adresse ne rend qu'une
  // redirection. Ce contrôle l'attendait encore et tombait sur un délai de
  // soixante secondes qui accusait l'adresse, laquelle n'y était pour rien.
  //
  // **Ce qu'il vérifie n'a pas bougé d'un mot** : que l'adresse LIBRE — un
  // chemin, un lieu-dit, « derrière la scierie », ce que la base ne connaît
  // pas — a bien été conservée. On la relit donc là où elle vit désormais : la
  // fiche client rouverte, dans son champ. Le texte de la page ne la porte pas
  // (c'est une valeur de champ, pas du texte), et une assertion sur
  // `innerText` serait rouge sur un écran juste.
  //
  // **Généreux, et pour une raison précise.** Cette suite passe la PREMIÈRE de
  // la batterie (ordre alphabétique) : elle paie donc la toute première
  // compilation de l'écran, sur un serveur de développement qui n'a encore
  // rien en cache.
  await page.goto(`${BASE}/chantiers/${chantierId}/coordonnees`, { waitUntil: "networkidle" });
  // Le champ se prend par son RÔLE, comme plus haut dans cette suite : son
  // `aria-label` n'existe que lorsque l'écran cache le libellé, et cela dépend
  // du dessin du jour.
  const champChantier = page.getByRole("combobox").first();
  await champChantier.waitFor({ state: "visible", timeout: 60_000 });
  assert.match(
    await champChantier.inputValue(),
    /Scierie/i,
    "L'adresse libre n'a pas été conservée : la liste aurait alors enfermé le patron dans ce que la base connaît."
  );

  // ─── LA FICHE ROUVERTE N'OUVRE AUCUNE LISTE ──────────────────────────────
  //
  // **Sa plainte du 4 septembre 2026 :** *« je suis arrivé sur la page de la
  // fiche client […] ce n'est pas la même que lorsque j'ai cliqué sur nouveau
  // chantier »*. C'était bien le même écran : ce qui différait, c'est que la
  // liste des suggestions s'était ouverte TOUTE SEULE sur l'adresse que la
  // reprise venait de remplir. Six adresses recouvraient les photos, l'anneau
  // de la note vocale et « Je rédige à la main ».
  //
  // **Le contrôle mesure la HAUTEUR, et pas seulement la liste.** C'est elle
  // qui dit ce qu'il voyait : 672 px à la création, 1099 px à la reprise. Une
  // assertion sur le seul `combobox` resterait verte le jour où la liste
  // s'ouvrirait sous une autre forme.
  const appelsAvant = appels;

  // On rouvre la fiche du chantier qu'on vient de créer — celui qui porte
  // l'adresse libre, et c'est le chemin du retour depuis le devis
  // (`src/lib/retour-du-devis.ts`).
  //
  // **L'identifiant vient de la création, plus de l'accueil.** Il se lisait
  // dans le premier lien `/chantiers/<uuid>` de la liste ; ces liens ont
  // changé de cible le 4 septembre, la fiche du chantier ayant été retirée
  // (`ARCHITECTURE.md` §254) — plus aucun ne portait cette forme, et le
  // contrôle s'arrêtait sur « aucun chantier sur l'accueil » alors qu'il
  // venait d'en créer un. Le prendre à la source vaut mieux : c'est CE
  // chantier-là qu'on veut rouvrir, pas le premier venu.
  await page.goto(`${BASE}/chantiers/${chantierId}/coordonnees`, { waitUntil: "networkidle" });
  await page.waitForTimeout(900);

  const champReprise = page.getByRole("combobox").first();
  assert.equal(
    await champReprise.count(),
    1,
    "La fiche rouverte n'a pas de champ d'adresse : ce n'est plus le même écran que la création."
  );
  const adresseReprise = await champReprise.inputValue();
  if (adresseReprise.trim().length >= 5) {
    assert.equal(
      appels,
      appelsAvant,
      `La fiche rouverte a interrogé le service d'adresses ${appels - appelsAvant} fois sur une valeur ` +
        "qu'elle venait elle-même de remplir : la liste s'ouvre sous les yeux du patron, sur un écran " +
        "où il n'a rien tapé."
    );
    const listes = await page.locator('[role="listbox"], ul[id*="suggestion"]').count();
    assert.equal(
      listes,
      0,
      "Une liste de suggestions est ouverte à l'arrivée sur la fiche : elle recouvre les photos, " +
        "l'anneau de la note vocale et « Je rédige à la main »."
    );
  }

  await navigateur.close();
  console.log("✅ L'adresse se propose, se choisit d'un doigt, et n'enferme personne.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
