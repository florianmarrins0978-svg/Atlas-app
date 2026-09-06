import assert from "node:assert/strict";
import { lancerNavigateur } from "./e2e-browser";
import { ADRESSE } from "./_adresse";

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

const BASE = ADRESSE;

async function main() {
  const navigateur = await lancerNavigateur();
  const contexte = await navigateur.newContext();
  const page = await contexte.newPage();

  await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  await page.fill('input[name="email"]', "demo@atlas.local");
  await page.fill('input[name="password"]', "demo1234");
  await page.click('button[type="submit"]');
  await page.waitForURL(`${BASE}/`, { timeout: 20000 });

  // --- 1. Le lien n'est pas proposé --------------------------------------
  // **Il faut regarder là où le renvoi SERAIT.** Depuis le 14 août 2026 il est
  // rangé sous « Atlas IA » et non plus à même l'écran des réglages
  // (`ARCHITECTURE.md` §96) : viser `/reglages` rendrait ce contrôle vert par
  // accident, en cherchant un lien à un endroit où plus personne ne le met.
  //
  // **PAR L'ADRESSE ET NON PAR LE LIBELLÉ — corrigé le 6 septembre 2026.**
  // Ce contrôle cherchait la phrase « vocabulaire de mon métier ». L'écran a
  // été renommé « Mon vocabulaire » le même jour, parce que l'ancien titre se
  // cassait en deux lignes sous la pastille de l'assistant — et le contrôle
  // serait alors resté VERT en cherchant un texte qui n'existe plus, c'est-à-dire
  // en ne prouvant plus rien. Une adresse, elle, ne se renomme pas pour faire
  // tenir un titre (`CLAUDE.md` §5 bis).
  await page.goto(`${BASE}/reglages/ia`, { waitUntil: "networkidle" });
  await page.waitForTimeout(800);
  assert.equal(
    await page.locator('a[href="/reglages/vocabulaire"]').count(),
    0,
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
    /charpentière|vendre seule|Mon vocabulaire/i,
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
