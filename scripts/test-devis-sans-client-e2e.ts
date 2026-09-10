import assert from "node:assert/strict";
import { lancerNavigateur } from "./e2e-browser";
import { pool } from "../src/server/db/client";
import { creerPuisFiche } from "./_creer-chantier-e2e";
import { arriverAFroid } from "./_arriver-a-froid";
import { ADRESSE } from "./_adresse";

// **Un devis sans client dit ce qui manque, ET où le réparer.**
//
// ─────────────────────────────────────────────────────────────────────────────
// Le patron, le 31 août 2026, deux captures à l'appui : *« j'ai oublié de
// renseigner la fiche client du chantier. Lorsque je fais retour, je dois
// arriver sur la page de la fiche client ! Pas sur la page que je te mets en
// deuxième photo. »* Sa première capture est un devis portant « Aucun client
// rattaché à ce chantier » ; sa seconde, la fiche du chantier — l'écran où le
// retour le déposait, et qui ne dit ni ce qui manque ni où le réparer.
//
// ─────────────────────────────────────────────────────────────────────────────
// **CE QUI A CHANGÉ LE 9 SEPTEMBRE 2026, ET POURQUOI CE N'EST PAS UN RECUL.**
//
// Sa demande : *« le bouton retour doit marcher comme un vrai bouton marche
// arrière, il doit toujours renvoyer à la page d'où l'on vient juste avant. »*
// La flèche ne peut donc plus être le chemin vers la fiche client — elle recule.
//
// Le manque, lui, doit toujours se réparer : le chemin se pose **là où il se
// lit**, sous « Aucun client rattaché à ce chantier », et il s'annonce. C'est le
// pansement retiré (`CLAUDE.md` §4 quater) : la flèche avait été détournée le
// 31 août parce que cette phrase était un cul-de-sac, et elle n'a plus à
// l'être.
//
// **CE QUE CETTE SUITE TIENT, ET QUE LES SUITES PURES NE PEUVENT PAS VOIR :**
// que le chemin est BRANCHÉ — qu'il existe là où le manque se lit, qu'il ouvre
// la fiche pour de bon, et que le chemin se REFERME : enregistrer ramène au
// devis, qui porte alors le client. Une règle juste et débranchée serait verte
// partout sauf ici (`CLAUDE.md` §5 quater).

const BASE = ADRESSE;

let echecs = 0;
async function cas(nom: string, verifier: () => Promise<void>) {
  try {
    await verifier();
    console.log(`  ✓ ${nom}`);
  } catch (e) {
    echecs++;
    console.error(`  ✗ ${nom}\n    ${(e as Error).message}`);
  }
}

async function main() {
  console.log("=== Le retour d'un devis sans client ===\n");

  const navigateur = await lancerNavigateur();
  // L'écran du patron est déjà le défaut de `lancerNavigateur`.
  const contexte = await navigateur.newContext();
  const page = await contexte.newPage();

  await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  await page.fill('input[name="email"]', "demo@atlas.local");
  await page.fill('input[name="password"]', "demo1234");
  await page.click('button[type="submit"]');
  await page.waitForURL(`${BASE}/`, { timeout: 30_000 });

  // **Son chantier : créé sans un mot sur le client.** C'est ce qui produit
  // « Aucun client rattaché à ce chantier » sur le devis, et c'est exactement
  // ce qu'il a photographié. Poser un client puis le retirer en base
  // éprouverait un état que l'application ne fabrique pas.
  await page.goto(`${BASE}/chantiers/nouveau`, { waitUntil: "networkidle" });
  const chantierId = await creerPuisFiche(page, BASE);

  const retour = page.locator('[data-atlas="retour-du-devis"]');
  const versLaFiche =
    `/chantiers/${chantierId}/coordonnees` +
    `?de=${encodeURIComponent(`/chantiers/${chantierId}/devis-complet`)}`;
  // Le chemin qui répare le manque, posé sous la phrase qui l'annonce.
  const lienFiche = page.locator(`a[href="${versLaFiche}"]`);

  await cas("SON CAS : le devis dit qu'aucun client n'est rattaché", async () => {
    await page.goto(`${BASE}/chantiers/${chantierId}/devis-complet`, { waitUntil: "networkidle" });
    await page.waitForSelector("text=DEVIS", { timeout: 30_000 });
    const ecran = await page.locator("body").innerText();
    assert.ok(
      ecran.includes("Aucun client rattaché"),
      "le devis ne montre pas le manque qu'il a photographié : ce n'est plus son cas"
    );
  });

  await cas("le devis garde une sortie — une page nue sans retour est un piège", async () => {
    assert.equal(await retour.count(), 1, "le devis n'a plus de sortie : un piège sur un téléphone");
  });

  await cas("ET LE CHEMIN VERS LA FICHE SE LIT LÀ OÙ LE MANQUE SE LIT", async () => {
    // C'est ce qui remplace le détour de la flèche : un chemin nommé, à côté de
    // la phrase qui dit ce qui manque. Sans lui, « Aucun client rattaché à ce
    // chantier » redeviendrait le cul-de-sac de sa capture du 31 août.
    assert.equal(
      await lienFiche.count(),
      1,
      "rien ne mène à la fiche client : le devis dit le manque sans dire où le réparer"
    );
    assert.match(
      (await lienFiche.innerText()).trim(),
      /fiche client/i,
      "le chemin ne s'annonce pas : il faut deviner où il mène"
    );
  });

  await cas("il ouvre pour de bon la fiche client, et son champ est vide", async () => {
    await lienFiche.click();
    await page.waitForURL(/\/coordonnees/, { timeout: 30_000 });
    const nom = page.locator('input[placeholder="Bernard"]');
    await nom.waitFor({ state: "visible", timeout: 30_000 });
    assert.equal(await nom.inputValue(), "", "un champ prérempli : ce n'est pas ce chantier-là");
  });

  await cas("ET C'EST LA FICHE ENTIÈRE : les photos et l'anneau y sont", async () => {
    // **Sa demande du 31 août 2026, deux captures à l'appui :** *« lorsque je
    // fais retour j'arrive sur la page 1re photo alors que je veux arriver sur
    // la 2e. Je sais pas d'où sort la 1re photo ? Si elle sert à rien il faut
    // la supprimer. »* La première était cet écran privé de ses photos et de
    // son anneau. Il n'y a plus qu'une fiche client, et c'est celle-là.
    const photos = page.locator('[aria-label="Photos du chantier"]');
    assert.equal(await photos.count(), 1, "la fiche rouverte n'a pas ses photos");
    const anneau = page.locator('button[aria-label="Dicter une note vocale"]');
    assert.ok(
      (await anneau.count()) > 0,
      "la fiche rouverte n'a pas son anneau : c'est l'écran amputé qu'il a refusé"
    );
    // Et le bouton qui la distingue encore : sans lui, ce qu'il TAPE ne part
    // nulle part sur un chantier qui existe déjà.
    assert.equal(await page.locator('[data-atlas="action-creation"]').count(), 1);
  });

  const NOM = `Luk ${Date.now()}`;

  await cas("enregistrée, la fiche RAMÈNE au devis — le chemin se referme", async () => {
    await page.fill('input[placeholder="Bernard"]', NOM);
    await page.click('[data-atlas="action-creation"]');
    await page.waitForURL(new RegExp(`/chantiers/${chantierId}/devis-complet`), { timeout: 30_000 });
  });

  await cas("et le devis porte enfin son client", async () => {
    await page.waitForSelector("text=DEVIS", { timeout: 30_000 });
    // **Le nom se lit dans le CHAMP, pas dans le texte de la page.** Sur ce
    // devis, le client est saisissable en place : `innerText` ne le voit pas,
    // et une assertion sur le texte serait rouge sur un écran juste.
    const nom = page.locator('input[aria-label="Nom du client"]');
    await nom.waitFor({ state: "visible", timeout: 30_000 });
    assert.equal(await nom.inputValue(), NOM, "le nom saisi n'est pas arrivé sur le devis");
    const ecran = await page.locator("body").innerText();
    assert.ok(!ecran.includes("Aucun client rattaché"), "le devis dit encore qu'il n'y a pas de client");
  });

  await cas("LE CLIENT POSÉ, LE CHEMIN S'EFFACE — il n'y a plus rien à réparer", async () => {
    // **Ce cas est le seul qui puisse le voir** : le chantier vient d'acquérir
    // son client à la ligne du dessus, dans l'application et non en base. Une
    // suite qui poserait le client à la main éprouverait un état fabriqué.
    //
    // Le client posé, ses quatre champs s'éditent sur la feuille elle-même
    // (`majClientDuDevisAction`) : un lien vers un autre écran n'aurait plus
    // qu'à faire sortir de son document pour rien.
    assert.equal(
      await lienFiche.count(),
      0,
      "le chemin vers la fiche est resté alors que le client est là : deux endroits pour le même geste"
    );
    const nom = page.locator('input[aria-label="Nom du client"]');
    assert.equal(await nom.count(), 1, "le client n'est plus corrigible sur la feuille");
  });

  await cas("et SA plainte du 9 septembre : la flèche ramène d'où il vient", async () => {
    // *« J'ai cliqué sur ouvrir le devis, une fois sur le devis je clique sur
    // retour, j'arrive sur la page de la fiche client. »* Il venait de
    // l'accueil. Le détour du 31 août ne s'impose plus dès qu'on sait d'où il
    // vient (`src/lib/journal-de-navigation.ts`).
    await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
    await page.goto(`${BASE}/chantiers/${chantierId}/devis-complet`, { waitUntil: "networkidle" });
    await retour.waitFor({ state: "visible", timeout: 30_000 });
    await page.waitForFunction(
      () => document.querySelector('[data-atlas="retour-du-devis"]')?.getAttribute("href") === "/",
      undefined,
      { timeout: 15_000 }
    );
  });

  await cas("MAIS À FROID, sa règle du 31 août tient toujours", async () => {
    // *« Je veux tout le temps revenir à cette page et seulement celle-là ! La
    // page fiche client »*. Elle n'est pas abandonnée : elle est la sortie
    // déclarée de cet écran, celle qui sert quand il n'y a pas de page d'avant
    // — un signet, une notification ouverte à froid.
    await arriverAFroid(page, `${BASE}/chantiers/${chantierId}/devis-complet`);
    await retour.waitFor({ state: "visible", timeout: 30_000 });
    assert.equal(
      await retour.getAttribute("href"),
      versLaFiche,
      "à froid, la flèche ne mène plus à la fiche client : sa règle du 31 août a disparu"
    );
  });

  await cas("la fiche ouverte SANS provenance garde sa sortie du 17 août 2026", async () => {
    // Le chemin de l'accueil (« Adresse non renseignée ») entre par la même
    // porte : sa flèche rend la liste, et rien de ce lot ne doit la détourner.
    // **À FROID** : la sortie déclarée ne se lit que sans page d'avant
    // (9 septembre 2026, `scripts/_arriver-a-froid.ts`).
    await arriverAFroid(page, `${BASE}/chantiers/${chantierId}/coordonnees`);
    const flecheFiche = page.locator('a[aria-label="Retour à la liste des chantiers"]');
    assert.equal(await flecheFiche.count(), 1, "la fiche client n'a plus sa sortie vers la liste");
    assert.equal(await flecheFiche.getAttribute("href"), "/");
  });

  await cas("UNE PROVENANCE ÉTRANGÈRE NE FAIT PAS SORTIR D'ATLAS", async () => {
    // La valeur vient de l'adresse : sans le contrôle, la flèche « retour »
    // deviendrait une porte de sortie vers un site étranger.
    // À froid : c'est le filtre du paramètre `?de=` qu'on éprouve ici, et il ne
    // répond que lorsqu'il n'y a pas de page d'avant.
    await arriverAFroid(
      page,
      `${BASE}/chantiers/${chantierId}/coordonnees?de=${encodeURIComponent("https://ailleurs.example")}`
    );
    const cible = await page.locator('a[aria-label^="Retour"]').first().getAttribute("href");
    assert.equal(cible, "/", `la flèche pointe vers « ${cible} » : elle quitterait Atlas`);
  });

  await contexte.close();
  await navigateur.close();
  await pool.end();

  console.log(`\n${echecs === 0 ? "✅" : "❌"} Le retour d'un devis sans client — ${echecs} échec(s).`);
  process.exit(echecs === 0 ? 0 : 1);
}

main();
