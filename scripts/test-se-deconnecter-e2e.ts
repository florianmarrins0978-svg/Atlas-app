import { lancerNavigateur, ECRAN_DU_PATRON } from "./e2e-browser";
import assert from "node:assert";
import type { Page } from "playwright";
import { Pool } from "pg";
import { ADRESSE } from "./_adresse";

// **SE DÉCONNECTER — le geste du patron, du premier appui au dernier.**
//
// ─────────────────────────────────────────────────────────────────────────────
// Sa question du 9 septembre 2026 : *« si je clique sur me déconnecter dans les
// réglages, est-ce que ça me remet à la page de connexion ? »* Le bouton
// n'existait pas. Cette suite éprouve celui qui vient d'être posé.
//
// **Elle entre par SA porte, et c'est tout l'objet** (`CLAUDE.md` §5 quater).
// Le 28 août 2026, six gestes de l'assistant ont été livrés avec leurs
// contrôles tous verts et aucun atteignable : les contrôles construisaient la
// demande à la main au lieu de la faire naître d'un geste. Ici, rien n'est
// appelé directement — on se connecte, on ouvre les Réglages, on touche.
//
// ─── CE QU'ELLE ÉPROUVE, ET POURQUOI CHAQUE CAS EXISTE ──────────────────────
//
// | 1 | la ligne existe, et sa cible fait 44 px — le mot est petit, pas le bouton |
// | 2 | UN appui ne déconnecte pas : c'est la mégarde qu'on refuse |
// | 3 | « Annuler » referme sans rien casser |
// | 4 | confirmer mène dehors, et le cookie est bien mort |
// | 5 | **Face ID reste posé** — c'est ce qui sépare ce geste de « partout » |
//
// ─── LE CAS 5 POSE SON PROPRE TÉMOIN, ET CE N'EST PAS DU ZÈLE ───────────────
//
// Le compte de démonstration n'a aucune clé d'appareil. Compter « zéro clé
// avant, zéro clé après » rendrait un vert qui ne mesure rien — la faute payée
// le 15 août 2026, où `0 − 0 = 0` affirmait qu'aucun nom n'était coupé sur un
// écran où trois l'étaient. La suite insère donc une clé témoin avant de se
// déconnecter, et exige de la retrouver.

const BASE = ADRESSE;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const EMAIL = "demo@atlas.local";
const MOT_DE_PASSE = "demo1234";

let passed = 0;
let failed = 0;

async function test(nom: string, corps: () => Promise<void>) {
  try {
    await corps();
    passed++;
    console.log(`  ✓ ${nom}`);
  } catch (e) {
    failed++;
    console.error(`  ✗ ${nom}\n    ${(e as Error).message}`);
  }
}

async function connecter(page: Page) {
  await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  await page.fill('input[name="email"]', EMAIL);
  await page.fill('input[name="password"]', MOT_DE_PASSE);
  await page.click('button[type="submit"]');
  await page.waitForURL(`${BASE}/`, { timeout: 30_000 });
}

/**
 * L'identifiant du compte de démonstration.
 *
 * **Refuse de conclure s'il manque**, plutôt que de laisser les cas suivants
 * accuser le produit : c'est le message du 26 août 2026 — « le compte de
 * démonstration est absent : la base n'est pas amorcée » — qui n'arrivait qu'à
 * la dernière étape, après quatre suites rougies pour rien.
 */
async function idDuPatron(): Promise<string> {
  const { rows } = await pool.query<{ id: string }>("SELECT id FROM users WHERE email = $1 LIMIT 1", [
    EMAIL,
  ]);
  assert.ok(
    rows[0]?.id,
    `le compte de démonstration (${EMAIL}) est absent : la base n'est pas amorcée`
  );
  return rows[0].id;
}

/**
 * **DEUX SESSIONS POUR QUATRE CAS, ET C'EST UNE CORRECTION.**
 *
 * La première version se connectait au début de chaque cas — quatre fois de
 * suite avec le même compte. Le limiteur de connexion refuse la quatrième, et
 * la suite rougissait alors sur « Timeout waiting for navigation to / » : un
 * message qui accuse la connexion d'Atlas alors qu'elle fonctionne exactement
 * comme prévu. Elle passait dans la batterie complète, où Redis venait d'être
 * vidé, et échouait rejouée seule — le pire des deux, puisqu'on ne peut plus la
 * jouer pour diagnostiquer.
 *
 * Une session sert donc les trois cas qui ne déconnectent pas, une seconde le
 * cas qui déconnecte. C'est aussi la séquence du patron : il ne se reconnecte
 * pas entre deux gestes.
 */
async function main() {
  const navigateur = await lancerNavigateur();
  const utilisateurId = await idDuPatron();

  // ── Session 1 : les trois cas qui laissent la session ouverte ────────────
  const contexte = await navigateur.newContext({ ...ECRAN_DU_PATRON });
  const page = await contexte.newPage();
  await connecter(page);

  // ── 1 · La ligne se trouve, et elle se touche ────────────────────────────
  await test("La sortie est au bas des Réglages, et sa cible fait au moins 44 px", async () => {
    await page.goto(`${BASE}/reglages`, { waitUntil: "networkidle" });

    const sortie = page.locator('[data-atlas="se-deconnecter"]');
    await sortie.waitFor({ state: "visible", timeout: 15_000 });

    // **Mesurée après la mise en page**, jamais sur `domcontentloaded` : une
    // boîte de zéro pixel n'est pas une mesure, c'est une mesure impossible
    // (`CLAUDE.md` §5).
    const boite = await sortie.boundingBox();
    assert.ok(boite && boite.height > 0, "la ligne n'a aucune hauteur mesurable");
    assert.ok(
      boite.height >= 44,
      `la cible fait ${boite.height.toFixed(1)} px de haut, il en faut 44 au doigt`
    );

    // Elle vient APRÈS les rubriques : une sortie posée au milieu des tarifs se
    // touche en faisant défiler.
    const apres = await page.evaluate(() => {
      const s = document.querySelector('[data-atlas="se-deconnecter"]');
      const rubriques = Array.from(document.querySelectorAll('a[href^="/reglages/"]'));
      const derniere = rubriques[rubriques.length - 1];
      if (!s || !derniere) return null;
      return s.getBoundingClientRect().top > derniere.getBoundingClientRect().top;
    });
    assert.equal(apres, true, "la sortie doit venir après la dernière rubrique");
  });

  // ── 2 · Un seul appui ne déconnecte pas ──────────────────────────────────
  await test("Un seul appui ouvre la feuille et ne déconnecte personne", async () => {
    await page.goto(`${BASE}/reglages`, { waitUntil: "networkidle" });
    await page.click('[data-atlas="se-deconnecter"]');
    await page.locator('[data-atlas="confirmer-deconnexion"]').waitFor({ state: "visible" });

    assert.equal(
      new URL(page.url()).pathname,
      "/reglages",
      "un seul appui a quitté l'écran : la mégarde qu'on voulait éviter"
    );
    // Et la session tient toujours : un écran gardé s'ouvre encore.
    await page.goto(`${BASE}/reglages/compte`, { waitUntil: "networkidle" });
    assert.equal(new URL(page.url()).pathname, "/reglages/compte", "la session a été fermée trop tôt");
  });

  // ── 3 · « Annuler » ne casse rien ────────────────────────────────────────
  await test("« Annuler » referme la feuille et laisse la session ouverte", async () => {
    await page.goto(`${BASE}/reglages`, { waitUntil: "networkidle" });
    await page.click('[data-atlas="se-deconnecter"]');
    await page.locator('[data-atlas="confirmer-deconnexion"]').waitFor({ state: "visible" });
    await page.getByRole("button", { name: "Annuler" }).click();
    await page.locator('[data-atlas="confirmer-deconnexion"]').waitFor({ state: "hidden" });

    await page.goto(`${BASE}/reglages/compte`, { waitUntil: "networkidle" });
    assert.equal(new URL(page.url()).pathname, "/reglages/compte", "« Annuler » a quand même déconnecté");
  });
  await contexte.close();

  // ── 4 et 5 · Le geste complet, et ce qu'il laisse derrière lui ───────────
  await test("Confirmer ferme bien la session, et Face ID reste posé", async () => {
    // **Le témoin est posé AVANT**, et retiré quoi qu'il arrive : sans lui, le
    // cas 5 comparerait zéro à zéro.
    const identifiant = `temoin-deconnexion-${Date.now()}`;
    await pool.query(
      `INSERT INTO cles_appareil (utilisateur_id, identifiant_cle, cle_publique, nom_appareil)
       VALUES ($1, $2, $3, $4)`,
      [utilisateurId, identifiant, "cle-publique-de-test", "iPhone témoin"]
    );

    try {
      const sortant = await navigateur.newContext({ ...ECRAN_DU_PATRON });
      const ecran = await sortant.newPage();
      await connecter(ecran);
      await ecran.goto(`${BASE}/reglages`, { waitUntil: "networkidle" });

      await ecran.click('[data-atlas="se-deconnecter"]');
      await ecran.click('[data-atlas="confirmer-deconnexion"]');
      await ecran.waitForURL(`${BASE}/login`, { timeout: 30_000 });

      // **Le cookie doit être MORT, pas seulement la page changée.** Revenir
      // sur un écran gardé est la seule preuve qui vaille : une redirection
      // côté client se contournerait en tapant l'adresse.
      //
      // **On exige « plus les réglages », pas une adresse précise — corrigé le
      // 9 septembre 2026, et c'est une faute payée.** La première version
      // attendait `/login` ; le middleware renvoie un visiteur sans session vers
      // `/bienvenue`, la porte ouverte le 8 septembre. La suite rougissait donc
      // sur un geste qui MARCHAIT, avec un message — « la session survit » — qui
      // disait exactement le contraire de ce qui se passait. Une erreur qui
      // désigne le mauvais coupable coûte plus cher que pas d'erreur
      // (`AGENTS.md`), et il a fallu monter un serveur pour s'en apercevoir.
      //
      // Ce qui est éprouvé ici est la RÈGLE — l'écran gardé ne s'ouvre plus —,
      // pas le chemin par lequel Atlas la fait respecter (`CLAUDE.md` §5 bis).
      await ecran.goto(`${BASE}/reglages`, { waitUntil: "networkidle" });
      assert.notEqual(
        new URL(ecran.url()).pathname,
        "/reglages",
        "la session survit : l'écran des réglages s'ouvre encore après la déconnexion"
      );

      const { rows } = await pool.query<{ n: string }>(
        "SELECT count(*)::text AS n FROM cles_appareil WHERE identifiant_cle = $1",
        [identifiant]
      );
      assert.equal(
        rows[0].n,
        "1",
        "Face ID a été retiré : ce geste ne doit toucher que CET appareil, pas les clés du compte"
      );
      await sortant.close();
    } finally {
      await pool.query("DELETE FROM cles_appareil WHERE identifiant_cle = $1", [identifiant]);
    }
  });

  await navigateur.close();
  await pool.end();
  console.log(`\n${passed} test(s) réussi(s), ${failed} échoué(s).`);
  if (failed > 0) process.exit(1);
}

main().catch(async (err) => {
  console.error(err);
  await pool.end().catch(() => {});
  process.exit(1);
});
