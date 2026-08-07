import assert from "node:assert/strict";
import { lancerNavigateur } from "./e2e-browser";

// **« Est-ce que les utilisateurs auront accès à cette page ? Moi c'est ça que
// je ne veux pas. »** — le patron, le 7 août 2026.
//
// Le vocabulaire du métier part avec l'application chez tous ses futurs clients,
// mais **eux ne doivent pas pouvoir le réécrire** : ce qu'il y met sert à tout
// le monde, et un client qui le modifierait changerait le comportement des
// autres.
//
// Ce que cette suite tient, et qui ne se voit pas à l'œil :
//
//   1. **la page refuse, elle ne se contente pas de cacher son lien.** Une
//      adresse se tape ; masquer une entrée de menu ne protège rien ;
//   2. **elle répond « introuvable », jamais « accès refusé ».** Un refus
//      annonce l'existence de ce qu'il refuse, et apprend où chercher ;
//   3. **sans configuration, personne n'est éditeur.** Le défaut doit refuser,
//      pas accorder — une installation muette ne doit pas ouvrir la page à tous.
//
// Le banc d'essai tourne sans `ATLAS_EDITEUR_EMAIL` : le compte de
// démonstration n'est donc PAS éditeur, et c'est exactement le cas à éprouver.

const BASE = "http://localhost:3000";

async function main() {
  const navigateur = await lancerNavigateur();
  const contexte = await navigateur.newContext({ viewport: { width: 393, height: 852 } });
  const page = await contexte.newPage();

  await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  await page.fill('input[name="email"]', "demo@atlas.local");
  await page.fill('input[name="password"]', "demo1234");
  await page.click('button[type="submit"]');
  await page.waitForURL(`${BASE}/`, { timeout: 20000 });

  // --- 1. Le lien n'est pas proposé --------------------------------------
  await page.goto(`${BASE}/reglages`, { waitUntil: "networkidle" });
  await page.waitForTimeout(800);
  const reglages = await page.locator("body").innerText();
  assert.doesNotMatch(
    reglages,
    /vocabulaire de mon métier/i,
    "Le vocabulaire est proposé à un compte ordinaire : chaque client pourrait réécrire celui de tous les autres."
  );

  // --- 2. Et l'adresse tapée à la main ne s'ouvre pas ---------------------
  //
  // LE point de cette suite. Le premier contrôle ne prouve rien tout seul : une
  // page cachée reste une page, et son adresse tient en trois mots.
  await page.goto(`${BASE}/reglages/vocabulaire`, { waitUntil: "networkidle" });
  await page.waitForTimeout(600);
  const contenu = await page.locator("body").innerText();

  // **Le code HTTP ne prouve rien ici, et c'est documenté.** Première version de
  // ce contrôle : elle exigeait un 404 et échouait sur un 200 — en accusant une
  // faille qui n'existait pas. `not-found.md` (documentation embarquée de cette
  // version de Next.js) : « Next.js will return a 200 HTTP status code for
  // streamed responses, and 404 for non-streamed responses ». La page REFUSAIT
  // bien ; c'est le contrôle qui visait la mauvaise chose.
  //
  // Ce qui compte, et qui se vérifie : **rien du vocabulaire n'arrive dans le
  // navigateur**. Ni le contenu, ni les champs pour l'écrire.
  assert.doesNotMatch(
    contenu,
    /charpentière|vendre seule|vocabulaire de mon métier/i,
    "Le contenu du vocabulaire a fuité dans une page d'erreur."
  );
  assert.doesNotMatch(
    contenu,
    /accès refusé|réservé à l'éditeur|non autorisé/i,
    "La page annonce qu'elle existe et qu'elle est refusée : elle apprend où chercher à qui n'y a pas droit."
  );

  // Ni le formulaire : une page qui n'affiche rien mais laisse ses champs
  // aurait laissé écrire dans le vocabulaire de tous les clients.
  assert.equal(
    await page.getByRole("button", { name: /^Ajouter$/ }).count(),
    0,
    "Le formulaire d'écriture est rendu à un compte ordinaire."
  );

  await navigateur.close();
  console.log("✅ Le vocabulaire du métier reste hors de portée des comptes ordinaires.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
