import assert from "node:assert/strict";
import type { Page, BrowserContext } from "playwright";
import { lancerNavigateur } from "./e2e-browser";
import { pool } from "../src/server/db/client";

/**
 * L'écran d'un devis déjà parti — « le signet d'or ».
 *
 * **Pourquoi cette suite existe.** Le patron, le 12 août 2026 : *« je trouve
 * qu'il y a trop d'infos sur cette page »*. Mesuré : l'écran portait onze blocs
 * et débordait de 382 px sur sa dalle. Après cinq propositions
 * (`docs/maquettes/34-le-devis-sur-sa-base.html`) il a retenu l'idée 5 et fixé
 * lui-même le contenu : le nom du devis, le total, un lien « Modifier mon
 * devis » sous le total, et les trois actions en encre foncée.
 *
 * Ce que cette suite tient, et chaque point répond à une de ses phrases :
 *
 *   1. **les lignes du devis ont disparu** de l'écran d'attente — c'est la
 *      demande, et c'est le genre de bloc qu'un correctif futur remettrait
 *      « pour information » sans y penser ;
 *   2. le nom du devis et le total sont là, et le total reste GRAND ;
 *   3. **tout tient sans défiler** — la mesure qui a motivé le lot entier ;
 *   4. les trois actions sont en ENCRE FONCÉE, et le PDF garde son nom de
 *      fichier (sans quoi il arrive sous le nom de la page sur iPhone) ;
 *   5. on peut encore changer de canal — ce bouton avait disparu de mes cinq
 *      maquettes, et le perdre serait défaire sa demande du 4 août ;
 *   6. **« Modifier mon devis » prévient avant d'agir**, et refuser ne crée
 *      AUCUNE version ;
 *   7. accepter ouvre le devis et crée bien la nouvelle version.
 *
 * **Le point 6 est le cœur, et il n'est pas cosmétique.** Vérifié dans le dépôt
 * avant d'être écrit : rouvrir un devis parti crée une nouvelle version mais
 * **n'annule pas l'envoi** — la page publique sert `envoi.devis`, donc la
 * version que le client a reçue. Il continue de la voir et peut l'accepter, au
 * prix d'avant. Un clic qui engagerait cela sans un mot est exactement ce que
 * `CLAUDE.md` §4 interdit.
 *
 * La suite **fabrique son propre chantier** par l'interface plutôt que
 * d'emprunter celui du jeu de démonstration : le seed ne tourne qu'une fois pour
 * toutes les suites navigateur, et muter des données partagées ferait échouer
 * les suivantes sur un défaut qui n'est pas le leur.
 */
const BASE = "http://localhost:3000";

async function seConnecter(contexte: BrowserContext): Promise<Page> {
  const page = await contexte.newPage();
  await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  await page.fill('input[name="email"]', "demo@atlas.local");
  await page.fill('input[name="password"]', "demo1234");
  await page.click('button[type="submit"]');
  await page.waitForURL(`${BASE}/`, { timeout: 20_000 });
  return page;
}

/** Un chantier neuf dont le devis vient de partir chez le client. */
async function devisParti(page: Page): Promise<{ chantierId: string; url: string }> {
  await page.goto(`${BASE}/chantiers/nouveau`, { waitUntil: "networkidle" });
  await page.fill('input[placeholder="M. Bernard"]', `M. Signet ${Date.now()}`);
  await page.fill('input[placeholder="06 12 34 56 78"]', "06 79 98 45 14");
  await page.click('button:has-text("Créer le chantier")');
  await page.waitForURL(/\/chantiers\/[0-9a-f-]{36}/, { timeout: 20_000 });
  const url = page.url();
  const chantierId = url.split("/").pop()!;

  await page.goto(`${url}/prix`, { waitUntil: "networkidle" });
  await page.click("text=+ Ajouter une ligne");
  await page.waitForTimeout(300);
  const champs = page.locator("form input");
  await champs.nth(0).fill("Taille haie de laurier");
  await champs.nth(1).fill("700.00");
  await champs.nth(1).blur();
  await page.waitForTimeout(600);

  await page.goto(`${url}/export`, { waitUntil: "networkidle" });
  await page.click("text=Envoyer au client");
  await page.waitForSelector("text=Une date, ou deux au choix du client ?", { timeout: 20_000 });
  await page.getByRole("button", { name: "Envoyer le devis" }).click();
  await page.waitForSelector("text=Devis prêt pour", { timeout: 20_000 });

  return { chantierId, url };
}

async function nombreDeVersions(chantierId: string): Promise<number> {
  const r = await pool.query<{ n: string }>(
    "select count(*)::text as n from devis where chantier_id = $1",
    [chantierId]
  );
  return Number(r.rows[0].n);
}

async function main() {
  const navigateur = await lancerNavigateur();
  // Pas de `viewport` : `lancerNavigateur` pose déjà la dalle du patron par
  // défaut, et la repasser ici créerait une seconde source de vérité pour la
  // seule mesure dont dépend « ça déborde ».
  const contexte = await navigateur.newContext();
  const page = await seConnecter(contexte);

  try {
    const { chantierId, url } = await devisParti(page);

    // **On RECHARGE.** Juste après l'envoi, l'écran dit « Devis prêt » — l'état
    // vient du navigateur. Rechargé, il vient du serveur et dit « En attente de
    // réponse » : c'est cet écran-là que le patron retrouve les jours suivants,
    // et c'est celui de sa capture.
    await page.goto(`${url}/export`, { waitUntil: "networkidle" });
    await page.waitForSelector("text=En attente de réponse", { timeout: 20_000 });

    // ── 1 · Les lignes ne sont plus là ────────────────────────────────────
    assert.equal(
      await page.locator("text=Lignes du devis").count(),
      0,
      "Les lignes du devis sont revenues sur l'écran d'attente : « garder que le nom du devis, le total »."
    );
    assert.equal(
      await page.locator("text=Taille haie de laurier").count(),
      0,
      "Le libellé des prestations est revenu sur l'écran d'attente."
    );
    console.log("  ✓ l'écran d'attente ne porte plus les lignes du devis");

    // ── 2 · Le nom du devis, et le total en grand ─────────────────────────
    assert.equal(
      await page.locator("text=/Devis nº/").count(),
      1,
      "Le numéro du devis n'est pas affiché : c'est la moitié de ce qu'il a demandé de garder."
    );
    const total = page.locator("text=/^\\s*840,00\\s*€\\s*$/").first();
    const taille = await total.evaluate((n) => parseFloat(getComputedStyle(n).fontSize));
    assert.ok(
      taille >= 38,
      `Le total est écrit en ${Math.round(taille)} px. Sur cet écran il est la pièce maîtresse : la maquette le pose à 46 px.`
    );
    console.log(`  ✓ le nom du devis, et le total en ${Math.round(taille)} px`);

    // ── 3 · Rien ne déborde ───────────────────────────────────────────────
    //
    // Mesuré avant les gestes qui suivent : ils ouvrent une feuille, laquelle
    // changerait la hauteur de la page et fausserait la mesure.
    const debordement = await page.evaluate(
      () => document.documentElement.scrollHeight - window.innerHeight
    );
    assert.ok(
      debordement <= 4,
      `L'écran déborde de ${debordement} px sur la dalle du patron — c'est exactement ce qu'il a signalé le 12 août. L'ancien débordait de 382 px.`
    );
    console.log(`  ✓ tout tient dans l'écran (${debordement} px de débordement)`);

    // ── 4 · Les trois actions, en encre foncée ────────────────────────────
    const pdf = page.getByRole("link", { name: "Télécharger le PDF" });
    assert.equal(await pdf.count(), 1, "« Télécharger le PDF » a disparu de l'écran d'attente.");
    assert.match(
      (await pdf.getAttribute("download")) ?? "",
      /^devis-.+\.pdf$/,
      "Le lien PDF n'annonce plus son nom de fichier : sur iPhone il arriverait sous le nom de la page."
    );
    const couleur = await pdf.evaluate((n) => getComputedStyle(n).color);
    assert.equal(
      couleur,
      "rgb(28, 28, 26)",
      `Les trois actions doivent être en encre foncée (#1c1c1a) — mesuré « ${couleur} ». Sa demande du 12 août : « mets-les en noir foncé ».`
    );
    assert.equal(
      await page.getByRole("button", { name: "Partager", exact: true }).count(),
      1,
      "« Partager » manque à la ligne des actions."
    );
    // **« Copier le lien » a été retiré le 13 août, à sa demande** : « je pense
    // qu'il faudrait aussi retirer copier le lien, ça ne sert à rien ». Le lien
    // part par le SMS, par l'e-mail ou par « Partager » — le presse-papier
    // n'était qu'un quatrième chemin vers la même chose. Le contrôle tient ce
    // retrait, sans quoi il reviendrait au premier écran recopié d'un voisin.
    assert.equal(
      await page.getByRole("button", { name: "Copier le lien", exact: true }).count(),
      0,
      "« Copier le lien » est revenu dans la rangée : il a été retiré le 13 août 2026."
    );
    console.log("  ✓ les deux actions sont là, en encre foncée, et « Copier le lien » a bien disparu");

    // ── 5 · On peut encore changer de canal ───────────────────────────────
    assert.equal(
      await page.getByRole("button", { name: /Plutôt par/ }).count(),
      1,
      "La bascule de canal a disparu. Elle manquait déjà à mes cinq maquettes — mais c'est une demande du 4 août : « si je veux l'envoyer par e-mail, je ne peux pas revenir le choisir »."
    );
    console.log("  ✓ on peut encore changer de canal");

    // ── 6 · « Modifier mon devis » prévient, et se refuse ─────────────────
    const versionsAvant = await nombreDeVersions(chantierId);

    const modifier = page.getByRole("button", { name: /Modifier mon devis/ });
    assert.equal(await modifier.count(), 1, "« Modifier mon devis » n'est pas sous le total.");
    await modifier.click();

    const feuille = page.locator('div[role="dialog"][aria-label="Modifier un devis déjà envoyé"]');
    await feuille.waitFor({ state: "visible", timeout: 10_000 });
    // Le CONTENU de l'avertissement compte autant que son existence : c'est la
    // seule information qui dise au patron ce qu'il engage.
    const dit = (await feuille.innerText()).replace(/\s+/g, " ");
    assert.match(
      dit,
      /nouvelle version/,
      `L'avertissement ne dit pas qu'une nouvelle version sera créée : « ${dit.slice(0, 140)} »`
    );
    assert.match(
      dit,
      /accepter/,
      `L'avertissement ne dit pas que le client peut encore accepter celle qu'il a reçue — c'est la seule chose qui engage vraiment : « ${dit.slice(0, 140)} »`
    );
    console.log("  ✓ « Modifier mon devis » prévient avant d'agir");

    await feuille.getByRole("button", { name: "Annuler", exact: true }).click();
    await feuille.waitFor({ state: "hidden", timeout: 10_000 });
    assert.equal(
      await nombreDeVersions(chantierId),
      versionsAvant,
      "Refuser l'avertissement a quand même créé une version. Un geste annulé ne doit RIEN engager."
    );
    console.log("  ✓ refuser ne crée aucune version");

    // ── 7 · Accepter ouvre le devis, et crée la version ───────────────────
    await modifier.click();
    await feuille.waitFor({ state: "visible", timeout: 10_000 });
    await feuille.getByRole("button", { name: /Modifier quand même/ }).click();
    await page.waitForURL(`${BASE}/chantiers/${chantierId}/devis-complet`, { timeout: 30_000 });
    assert.equal(
      await nombreDeVersions(chantierId),
      versionsAvant + 1,
      "Accepter n'a pas créé de nouvelle version : le patron modifierait le devis que son client a déjà en main."
    );
    console.log("  ✓ accepter ouvre le devis et crée une nouvelle version");

    console.log("✅ Le signet d'or : l'écran est nu, et « Modifier » prévient avant d'engager.");
  } finally {
    await contexte.close();
    await navigateur.close();
    await pool.end();
  }
}

main().catch((erreur) => {
  console.error(erreur);
  process.exit(1);
});
