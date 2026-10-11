import { lancerNavigateur } from "./e2e-browser";
import assert from "node:assert/strict";
import { ADRESSE } from "./_adresse";

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
//      envoie retaper à l'infini un mot de passe pourtant juste ;
//   3. **une connexion qui RÉUSSIT ne consomme rien** — 17 septembre 2026.
//      *« Un ami s'était connecté à mon appli via son tél, et sur le sien ça
//      n'a pas marché. »* Le compteur montait avant `signIn`, donc même quand
//      la porte s'ouvrait : cinq entrées depuis un même wifi, et le sixième —
//      son ami, avec le bon mot de passe — lisait qu'il avait trop essayé.
//      C'est le 6 août refait par l'autre bord, et c'est ce que ce troisième
//      cas empêche de revenir.
//
// Les deux visiteurs sont distingués par `x-forwarded-for`, exactement comme le
// proxy le fait devant l'application.

const BASE = ADRESSE;
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
  // **On attend ce qu'on affirme, pas une durée — 16 septembre 2026.** Une
  // attente fixe de 1,2 s laissait la page sur /login sous charge, et la
  // suite accusait alors le limiteur — « un visiteur en bloque un autre » —
  // sur du code juste, au milieu d'une batterie qui devenait rouge pour rien.
  // La porte s'ouvre (l'adresse quitte /login) ou le refus s'écrit ; on attend
  // l'un des deux, jamais l'horloge.
  await Promise.race([
    page.waitForURL((url) => url.pathname !== "/login", { timeout: 30_000 }),
    page.locator("text=/trop de tentatives|incorrect/i").first().waitFor({ timeout: 30_000 }),
  ]).catch(() => {});
  const entre = new URL(page.url()).pathname !== "/login";
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

  // --- SIX ENTRÉES RÉUSSIES DEPUIS LA MÊME ADRESSE ------------------------
  //
  // Son wifi, un soir où il fait essayer l'application. Chacun tape le BON mot
  // de passe ; personne ne doit se voir refuser la porte parce qu'un autre est
  // entré avant lui. Le seuil existe contre le martèlement — et marteler, ce
  // sont des essais qui RATENT.
  const ipDuSalon = `192.0.2.${marque % 200}`;
  for (let i = 1; i <= 6; i++) {
    const r = await tenter(navigateur, ipDuSalon, "demo1234");
    assert.equal(
      r.entre,
      true,
      `Entrée ${i} sur 6 refusée avec le BON mot de passe : une connexion réussie ` +
        `consomme encore le quota. Écran : « ${r.message.replace(/\s+/g, " ").slice(0, 200)} »`
    );
  }
  console.log("  ✓ six entrées réussies d'affilée depuis la même adresse — personne n'est mis dehors");

  await navigateur.close();
  console.log("✅ La connexion ne ment plus, et ne punit plus le voisin.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
