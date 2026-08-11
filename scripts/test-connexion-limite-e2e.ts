import { lancerNavigateur } from "./e2e-browser";
import assert from "node:assert/strict";

// **Le défaut qui a empêché les parents du patron d'entrer.**
//
// Le 6 août 2026, il leur donne l'adresse de l'application. Ils saisissent les
// bons identifiants et lisent « Email ou mot de passe incorrect ». Ils
// recommencent — ce que le message leur dit de faire — et s'enfoncent.
//
// Ce que cette suite tient, et qu'aucune autre ne voyait :
//
//   1. **un visiteur ne peut plus en bloquer un autre.** Le compteur était tenu
//      par email, et le banc d'essai partage un compte unique : les essais des
//      uns verrouillaient les autres ;
//   2. **le message dit la vérité.** Bloqué, on lit « trop de tentatives,
//      réessayez dans N minutes » — jamais « mot de passe incorrect », qui
//      envoie retaper à l'infini un mot de passe pourtant juste.
//
// Les deux visiteurs sont distingués par `x-forwarded-for`, exactement comme le
// proxy le fait devant l'application.

const BASE = "http://localhost:3000";
const MAUVAIS = "pas-le-bon-mot-de-passe";

async function tenter(navigateur: Awaited<ReturnType<typeof lancerNavigateur>>, ip: string, motDePasse: string) {
  const contexte = await navigateur.newContext({
    extraHTTPHeaders: { "x-forwarded-for": ip },
  });
  const page = await contexte.newPage();
  await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  await page.fill('input[name="email"]', "demo@atlas.local");
  await page.fill('input[name="password"]', motDePasse);
  await page.click('button[type="submit"]');
  await page.waitForTimeout(1200);
  const entre = new URL(page.url()).pathname === "/";
  const message = entre ? "" : await page.locator("body").innerText();
  await contexte.close();
  return { entre, message };
}

async function main() {
  const navigateur = await lancerNavigateur();

  // Deux adresses distinctes à chaque exécution : le compteur du visiteur vit
  // quinze minutes, et une suite ne doit pas dépendre de la précédente.
  const marque = Date.now();
  const ipParents = `203.0.113.${marque % 200}`;
  const ipPatron = `198.51.100.${marque % 200}`;

  // --- Le visiteur maladroit épuise SON quota -----------------------------
  let dernier = { entre: false, message: "" };
  for (let i = 0; i < 6; i++) {
    dernier = await tenter(navigateur, ipParents, MAUVAIS);
  }
  assert.equal(dernier.entre, false, "Un mauvais mot de passe ne doit jamais ouvrir la porte.");
  assert.match(
    dernier.message,
    /trop de tentatives/i,
    `Bloqué, le message doit le DIRE. Lu : « ${dernier.message.replace(/\\s+/g, " ").slice(0, 200)} »`
  );
  assert.match(dernier.message, /minute/i, "Le message doit dire combien de temps attendre.");
  console.log("  ✓ bloqué, on lit qu'il faut attendre — pas « mot de passe incorrect »");

  // --- L'autre visiteur entre normalement ---------------------------------
  //
  // LE point du lot : avant, ce compte-ci était verrouillé par les erreurs du
  // précédent, et le patron voyait ses parents rejetés avec le bon mot de passe.
  const autre = await tenter(navigateur, ipPatron, "demo1234");
  assert.equal(
    autre.entre,
    true,
    `Un visiteur en bloque un autre : c'est le défaut du 6 août. Écran : « ${autre.message.replace(/\\s+/g, " ").slice(0, 200)} »`
  );
  console.log("  ✓ les erreurs d'un visiteur ne verrouillent plus les autres");

  await navigateur.close();
  console.log("✅ La connexion ne ment plus, et ne punit plus le voisin.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
