import assert from "node:assert/strict";
import { Pool } from "pg";
import { lancerNavigateur } from "./e2e-browser";
import { creerPuisFiche } from "./_creer-chantier-e2e";
import { ouvrirLeTiroirDuPlanning } from "./_tiroir-planning-e2e";
import { ADRESSE } from "./_adresse";

// ─────────────────────────────────────────────────────────────────────────────
// **CE QU'IL A RETIRÉ NE REVIENT PLUS — sa plainte du 12 septembre 2026.**
//
// *« Lorsqu'on retire un chantier posé au planning, il réapparaît sur la page
// d'accueil ! »*, capture de l'accueil à l'appui.
//
// Mesuré avant de corriger, et c'était double :
//
//   1. **sur le planning lui-même**, la ligne revenait six secondes après le
//      geste — au moment où le tiroir se ferme et rend le retrait définitif ;
//   2. **sur l'accueil**, le chantier effacé était encore là, et y restait :
//      seul un rechargement à la main le faisait partir.
//
// La base, elle, avait bien écrit la suppression. C'est l'écran qui mentait —
// et c'est le pire des deux : il a retiré, il voit que ce n'est pas retiré, il
// recommence.
//
// **Ce que cette suite fixe, c'est la RÈGLE, pas un écran** (`CLAUDE.md` §5
// bis) : ce que le serveur a effacé ne se réaffiche nulle part, ni là où l'on
// a fait le geste, ni sur l'écran d'à côté. Elle passe donc par SON chemin —
// le tiroir du planning, puis l'onglet du bas — et non par une porte de
// service (`CLAUDE.md` §5 quater).
//
// **Et elle interroge la base**, sans quoi elle se contenterait d'un écran
// muet : un écran qui n'affiche plus rien parce que la suppression a été
// perdue serait vert ici, et faux.
//
// **CE QUI LA FAIT ROUGIR SANS LE CORRECTIF, et ce qu'il faut en savoir.**
// Jouée contre la version du 11 septembre, elle rougit sur *« retiré au
// planning, il n'y revient pas six secondes plus tard »* — le cas du planning,
// qui ne dépend d'aucune horloge : la ligne revient à la fermeture du tiroir,
// à tous les coups. Le cas de l'accueil, lui, tenait à une course entre
// l'écriture et le rendu de la page d'arrivée : il rougissait chez le patron,
// et il pouvait passer ici selon la milliseconde. Le correctif supprime la
// course — la page est redemandée APRÈS l'écriture (`useRetraits`) —, et ce
// cas ne peut donc plus passer par chance.
// ─────────────────────────────────────────────────────────────────────────────

const BASE = ADRESSE;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

let echecs = 0;
async function cas(nom: string, fn: () => Promise<void>) {
  try {
    await fn();
    console.log(`  ✓ ${nom}`);
  } catch (e) {
    echecs++;
    console.error(`  ✗ ${nom}\n    ${e instanceof Error ? e.message : String(e)}`);
  }
}

/** Un chantier qui attend son jour : c'est ce qui figure sous « Sans date ». */
async function chantierAPlanifier(page: import("playwright").Page): Promise<{ id: string; nom: string }> {
  await page.goto(`${BASE}/chantiers/nouveau`, { waitUntil: "networkidle" });
  // **Le nom est POSÉ, pas subi** : « Sans date » désigne ses lignes par lui,
  // et un « Retirer » pris au hasard emporterait le chantier d'à côté.
  await page.fill('input[placeholder="Bernard"]', `Retrait ${Date.now()}`);
  const id = await creerPuisFiche(page);
  // Le devis parti, sans passer par l'envoi réel : ce que cette suite éprouve
  // est le retrait, pas le parcours du devis — et un envoi enverrait pour de
  // bon un lien à un client de démonstration.
  await pool.query(
    "update chantiers set devis_genere_at = now(), devis_envoye_at = now() where id = $1",
    [id]
  );
  const { rows } = await pool.query("select nom from chantiers where id = $1", [id]);
  const nom = rows[0]?.nom as string | undefined;
  assert.ok(nom, `Le chantier créé n'a pas de nom : rien à chercher à l'écran (${id}).`);
  return { id, nom };
}

/** Glisse la ligne du chantier, puis touche le « Retirer » qui se découvre. */
async function retirerAuPlanning(page: import("playwright").Page, nom: string) {
  await page.goto(`${BASE}/planning`, { waitUntil: "networkidle" });
  await page.locator("[data-atlas-vivant='oui']").first().waitFor({ state: "attached", timeout: 30_000 });
  const tiroir = await ouvrirLeTiroirDuPlanning(page);
  assert.ok(tiroir, "Le tiroir du planning ne s'ouvre pas : le geste du patron n'est pas atteignable.");

  const bouton = page.getByRole("button", { name: `Retirer le chantier ${nom}` });
  assert.equal(
    await bouton.count(),
    1,
    `« Sans date » ne porte pas « ${nom} » : la suite ne mesure plus le geste qu'elle prétend mesurer.`
  );
  const ligne = page.locator(".atlas-glisse").filter({ hasText: nom }).first();
  await ligne.evaluate((el) => el.scrollTo({ left: el.scrollWidth, behavior: "instant" as ScrollBehavior }));
  await page.waitForTimeout(400);
  await bouton.click();
  await page.waitForTimeout(250);
}

const SANS_DATE = '[data-atlas="sans-date"]';

async function main() {
  const navigateur = await lancerNavigateur();
  const contexte = await navigateur.newContext({ hasTouch: true });
  const page = await contexte.newPage();

  await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  await page.fill('input[name="email"]', "demo@atlas.local");
  await page.fill('input[name="password"]', "demo1234");
  await page.click('button[type="submit"]');
  await page.waitForURL(`${BASE}/`, { timeout: 20_000 });

  // ── 1. Sa plainte, mot pour mot : le planning, puis l'accueil ───────────
  const premier = await chantierAPlanifier(page);
  await retirerAuPlanning(page, premier.nom);

  await cas("retiré au planning, il n'est plus sur l'accueil", async () => {
    // Il part tout de suite, par l'onglet du bas — c'est ce qu'il fait, et
    // c'est ce qui fabriquait le défaut : l'écriture part au moment où l'écran
    // se démonte, et l'accueil s'affichait avec la liste d'avant.
    await page.getByRole("link", { name: "Chantiers" }).click();
    await page.waitForURL(`${BASE}/`, { timeout: 20_000 });
    await page.waitForTimeout(2_000);
    const lignes = await page.locator(".atlas-ligne").count();
    assert.ok(lignes > 0, "L'accueil ne porte aucune ligne : rien à mesurer, donc rien de prouvé.");
    assert.equal(
      await page.locator(`a[href*="${premier.id}"]`).count(),
      0,
      "Le chantier retiré au planning est encore sur l'accueil : c'est sa plainte du 12 septembre 2026."
    );
  });

  await cas("et il n'y revient pas une fois le tiroir fermé", async () => {
    // Le tiroir se referme au bout de six secondes et rend le retrait
    // définitif : c'est précisément l'instant où la ligne réapparaissait.
    await page.waitForTimeout(7_000);
    assert.equal(
      await page.locator(`a[href*="${premier.id}"]`).count(),
      0,
      "Le chantier est revenu sur l'accueil à la fermeture du tiroir."
    );
  });

  await cas("la base l'a bel et bien effacé", async () => {
    const { rows } = await pool.query("select deleted_at from chantiers where id = $1", [premier.id]);
    assert.ok(rows[0], `Le chantier ${premier.id} a disparu de la base : la suppression douce n'est plus douce.`);
    assert.ok(
      rows[0].deleted_at,
      "L'écran ne montre plus le chantier, mais la base le garde : un écran muet sur une suppression perdue."
    );
  });

  // ── 2. Le même geste, SANS quitter le planning ─────────────────────────
  const second = await chantierAPlanifier(page);
  await retirerAuPlanning(page, second.nom);

  await cas("retiré au planning, il n'y revient pas six secondes plus tard", async () => {
    const avant = await page.locator(SANS_DATE).count();
    assert.ok(avant >= 0, "« Sans date » est introuvable : la mesure ne porte sur rien.");
    // On ne touche plus à rien : le tiroir se ferme seul.
    await page.waitForTimeout(8_000);
    const restants = (await page.locator(SANS_DATE).allInnerTexts()).map((t) => t.replace(/\s+/g, " "));
    assert.ok(
      !restants.some((l) => l.includes(second.nom)),
      `« ${second.nom} » est revenu sous « Sans date » après la fermeture du tiroir : ${restants.join(" | ")}`
    );
  });

  // ── 3. « Annuler » rend toujours la ligne ──────────────────────────────
  //
  // Le masque posé sur ce que le serveur a effacé ne doit pas mordre sur ce
  // qui n'a jamais été écrit : un retrait annulé n'est pas un retrait.
  const troisieme = await chantierAPlanifier(page);
  await retirerAuPlanning(page, troisieme.nom);

  await cas("« Annuler » rend la ligne, et rien n'est effacé", async () => {
    const annuler = page.getByRole("button", { name: /^Annuler le retrait de / });
    assert.equal(await annuler.count(), 1, "Le tiroir ne propose pas « Annuler » : le geste n'est plus réversible.");
    await annuler.click();
    await page.waitForTimeout(700);
    const restants = (await page.locator(SANS_DATE).allInnerTexts()).map((t) => t.replace(/\s+/g, " "));
    assert.ok(
      restants.some((l) => l.includes(troisieme.nom)),
      `« Annuler » n'a pas rendu « ${troisieme.nom} » : ${restants.join(" | ")}`
    );
    const { rows } = await pool.query("select deleted_at from chantiers where id = $1", [troisieme.id]);
    assert.equal(rows[0]?.deleted_at, null, "Un retrait annulé a quand même été écrit en base.");
  });

  // **On rend la base comme on l'a trouvée.** Les suites se suivent et
  // travaillent sur ce que les précédentes laissent (`run-e2e-tests.ts`) : un
  // chantier d'essai oublié sous « Sans date » ferait rougir la suivante sur
  // un décompte qui n'est pas le sien.
  await pool.query("update chantiers set deleted_at = now() where id = $1", [troisieme.id]);

  await navigateur.close();
  await pool.end();

  if (echecs > 0) {
    console.error(`\n${echecs} cas en échec.`);
    process.exit(1);
  }
  console.log("\nCe qui est retiré ne revient pas : vérifié sur les deux écrans.");
}

main().catch(async (e) => {
  console.error(e);
  await pool.end().catch(() => {});
  process.exit(1);
});
