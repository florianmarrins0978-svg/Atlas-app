import assert from "node:assert/strict";
import { Pool } from "pg";
import { lancerNavigateur } from "./e2e-browser";
import { ADRESSE } from "./_adresse";

// **« Que l'utilisateur puisse, s'il le souhaite ou non, connecter son planning
// à son agenda Google. »** — le patron, le 9 août 2026.
//
// Le « ou non » est la moitié qu'un contrôle peut réellement tenir ici. Le
// raccordement lui-même demande des identifiants Google que cet environnement
// n'a pas (`docs/A-FAIRE.md` §7) — et c'est précisément **l'état que le patron
// verra en ouvrant l'écran aujourd'hui**. Il vaut donc d'être éprouvé pour
// lui-même, plutôt que traité comme un cas dégradé sans intérêt.
//
// Ce que cette suite tient :
//
//   1. **l'écran existe et se trouve depuis les réglages.** Une page qu'on ne
//      peut atteindre qu'en tapant son adresse n'existe pas pour lui ;
//   2. **sans identifiants, l'écran le dit et ne propose RIEN à cliquer.** Un
//      bouton « Relier » qui mène à une erreur Google est pire qu'un bouton
//      absent : il donne à croire que le raccordement a été tenté ;
//   3. **le risque est nommé, pas caché.** Atlas ne voit pas les rendez-vous
//      notés ailleurs, et peut proposer ce jour-là. L'artisan doit l'apprendre
//      de l'écran, pas de son client mécontent.

const BASE = ADRESSE;

async function main() {
  const navigateur = await lancerNavigateur();
  const contexte = await navigateur.newContext();
  const page = await contexte.newPage();

  let echecs = 0;
  const cas = async (nom: string, verifier: () => Promise<void>) => {
    try {
      await verifier();
      console.log(`  ✓ ${nom}`);
    } catch (e) {
      echecs++;
      console.error(`  ✗ ${nom}\n    ${(e as Error).message}`);
    }
  };

  await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
  await page.fill('input[name="email"]', "demo@atlas.local");
  await page.fill('input[name="password"]', "demo1234");
  await page.click('button[type="submit"]');
  await page.waitForURL(`${BASE}/`, { timeout: 20000 });

  console.log("--- L'agenda, au choix de l'artisan ---");

  await cas("les réglages mènent à l'écran de l'agenda", async () => {
    await page.goto(`${BASE}/reglages`, { waitUntil: "domcontentloaded" });
    // **La rubrique s'est appelée « Intégrations » du 14 août au 5 septembre
    // 2026.** Elle porte désormais le nom de l'écran où elle mène — « Mon
    // agenda » —, parce qu'elle en annonçait trois : un calendrier, une
    // comptabilité et des « services connectés », dont deux n'ont jamais
    // existé.
    //
    // **Le lien se cherche par son ADRESSE, pas par son libellé.** Ce contrôle
    // veut prouver que le sommaire ouvre bien cet écran ; visé par le mot, il
    // rougissait au premier renommage, sur du code juste (`CLAUDE.md` §5 bis).
    const lien = page.locator('a[href="/reglages/agenda"]');
    await lien.waitFor({ state: "visible", timeout: 15000 });
    await lien.click();
    // `waitForURL` ne se résout pas sur une navigation côté client : on attend
    // un élément réel de la page d'arrivée.
    await page.getByRole("heading", { name: "Mon agenda" }).waitFor({ timeout: 15000 });
  });

  // ─── L'écran simplifié : sa demande du 26 septembre 2026 ────────────────
  //
  // *« trop de mots, trop compliqué, il faut qu'elle soit hyper simple »*, et
  // son choix A de `appli/mon-agenda-simple.html` : une ligne par agenda, son
  // état en deux mots, un bouton. Ce que la suite tient n'est pas le texte,
  // ce sont les règles qui ont survécu au remaniement.

  await cas("une ligne par agenda, chacune dit son état", async () => {
    const texte = await page.locator("body").innerText();
    assert.match(texte, /Google Agenda/, "la ligne Google manque");
    assert.match(texte, /iCloud/, "la ligne iCloud manque");
    const nonRelies = (texte.match(/Non relié/g) ?? []).length;
    assert.equal(nonRelies, 2, `${nonRelies} « Non relié » pour deux agendas jamais reliés`);
  });

  await cas("aucune commande d'un agenda relié n'est proposée tant que rien n'est relié", async () => {
    // Pause, débrancher et écrire n'existent qu'une fois relié : les proposer
    // avant laisserait croire que quelque chose tourne déjà.
    assert.equal(await page.getByRole("button", { name: "Gérer" }).count(), 0, "« Gérer » sans rien de relié");
    assert.equal(await page.getByRole("switch").count(), 0, "un interrupteur avant tout raccordement");
  });

  await cas("sans identifiants, « Relier » ouvre la saisie et n'envoie PAS chez Google", async () => {
    // Un bouton qui partirait chez Google avec un client vide ferait lire un
    // message d'erreur en anglais, qu'il prendrait pour une panne d'Atlas.
    // Le parcours : toucher « Relier » sur la ligne Google, et rester ici.
    const ligneGoogle = page.locator('[data-atlas="agenda-google"]');
    await ligneGoogle.getByRole("button", { name: "Relier" }).click();
    for (const libelle of ["Identifiant client", "Secret client", "Adresse de retour"]) {
      await page.getByLabel(libelle).waitFor({ state: "visible", timeout: 10000 }).catch(() => {
        throw new Error(`la case « ${libelle} » n'est pas proposée`);
      });
    }
    assert.ok(page.url().startsWith(BASE), `l'écran est parti ailleurs : ${page.url()}`);
    assert.equal(await page.getByLabel("Secret client").getAttribute("type"), "password", "le secret s'affiche en clair");
    assert.match(await page.locator("body").innerText(), /console\.cloud\.google\.com/i, "la console Google n'est pas nommée");
  });

  await cas("le bouton « Enregistrer » n'est couvert par rien", async () => {
    // La barre du bas et la bulle d'assistance flottent au-dessus du contenu :
    // un bouton dessous reste dans le HTML, donc vert pour un test de texte,
    // et intouchable au doigt (`CLAUDE.md` §5).
    const bouton = page.getByRole("button", { name: "Enregistrer" });
    await bouton.scrollIntoViewIfNeeded();
    await page.waitForTimeout(300);
    const boite = await bouton.boundingBox();
    assert.ok(boite && boite.width > 0, "le bouton « Enregistrer » n'a pas de place à l'écran");
    const dessus = await page.evaluate(
      `(() => {
        var r = ${JSON.stringify(boite)};
        var el = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
        return el ? el.tagName : "rien";
      })()`
    );
    assert.match(String(dessus), /BUTTON/, `quelque chose recouvre le bouton « Enregistrer » : ${dessus}`);
    await page.getByRole("button", { name: "Refermer" }).click();
  });

  // ─── iCloud : le second raccordement, et ses deux règles ────────────────

  await cas("iCloud se relie sans configuration préalable : « Relier » ouvre ses champs", async () => {
    const ligneApple = page.locator('[data-atlas="agenda-icloud"]');
    await ligneApple.getByRole("button", { name: "Relier" }).click();
    await page.getByLabel("Mot de passe pour les apps").waitFor({ state: "visible", timeout: 10000 });
  });

  await cas("l'avertissement est AU-DESSUS du champ, pas en dessous", async () => {
    // **La règle que cet écran ne peut pas se permettre de rater.** Le mot de
    // passe pour les apps ouvre TOUT l'iCloud. Vérifié par les POSITIONS : une
    // phrase juste, au mauvais endroit, laisse un contrôle de texte au vert.
    const avertissement = await page.locator("text=Ce mot de passe ouvre tout votre iCloud").first().boundingBox();
    const champ = await page.getByLabel("Mot de passe pour les apps").boundingBox();
    assert.ok(avertissement && champ, "l'avertissement ou le champ manque à l'écran");
    assert.ok(
      avertissement.y + avertissement.height <= champ.y,
      `l'avertissement finit à ${Math.round(avertissement.y + avertissement.height)} et le champ commence à ${Math.round(champ.y)}`
    );
  });

  await cas("le mot de passe iCloud est masqué, et ne fait pas zoomer iOS", async () => {
    const champ = page.getByLabel("Mot de passe pour les apps");
    assert.equal(await champ.getAttribute("type"), "password", "le mot de passe s'affiche en clair");
    const corps = await champ.evaluate((e) => parseFloat(getComputedStyle(e).fontSize));
    assert.ok(corps >= 16, `${corps} px : iOS zoomera à la mise au point`);
  });

  await cas("l'écran dit où générer le mot de passe, sans faire chercher", async () => {
    const texte = await page.locator("body").innerText();
    assert.match(texte, /account\.apple\.com/i, "l'adresse du compte Apple n'est pas donnée");
    assert.match(texte, /Mots de passe pour les apps/i, "le nom exact du réglage chez Apple manque");
  });

  await cas("l'écran ne déborde pas sur un téléphone", async () => {
    await page.goto(`${BASE}/reglages/agenda`, { waitUntil: "domcontentloaded" });
    await page.getByRole("heading", { name: "Mon agenda" }).waitFor({ timeout: 15000 });
    // Contre la largeur RÉELLE de la fenêtre, jamais un nombre écrit à la main.
    const largeur = await page.evaluate(() => document.documentElement.scrollWidth);
    const fenetre = await page.evaluate(() => document.documentElement.clientWidth);
    assert.ok(largeur <= fenetre + 1, `la page déborde (${largeur}px pour ${fenetre})`);
  });

  // ─── Le haut du Planning : sa demande du 26 septembre 2026 ──────────────
  //
  // *« ceux qui vont jamais remplir leur agenda, ils vont voir la phrase tous
  // les jours, c'est chiant »*, puis *« une fois qu'on a choisi masquer, faut
  // pas qu'il reste de phrase »*. La règle vit dans `bandeauAgendaDuPlanning` ;
  // ici se prouve le GESTE, et surtout qu'il tient après un rechargement.

  // La suite doit pouvoir se rejouer sur une même base : le masquage d'un
  // passage précédent ne doit pas lui faire conclure à une phrase absente.
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  await pool.query(
    `UPDATE entreprises SET rappel_agenda_masque = false
      WHERE id IN (SELECT m.entreprise_id FROM membres_entreprise m JOIN users u ON u.id = m.utilisateur_id WHERE u.email = 'demo@atlas.local')`
  );

  await cas("jamais relié : la phrase propose, et « Ouvrir » mène à Mon agenda", async () => {
    await page.goto(`${BASE}/planning`, { waitUntil: "domcontentloaded" });
    await page.getByText("Vous pouvez relier votre agenda").waitFor({ state: "visible", timeout: 15000 });
    await page.getByRole("link", { name: "Ouvrir" }).click();
    await page.getByRole("heading", { name: "Mon agenda" }).waitFor({ timeout: 15000 });
  });

  await cas("« Masquer » : il ne reste rien, et rien ne revient au rechargement", async () => {
    await page.goto(`${BASE}/planning`, { waitUntil: "domcontentloaded" });
    await page.getByText("Vous pouvez relier votre agenda").waitFor({ state: "visible", timeout: 15000 });
    await page.getByRole("button", { name: "Masquer" }).click();
    assert.equal(await page.getByText("Vous pouvez relier votre agenda").count(), 0, "la phrase reste après « Masquer »");
    // Le serveur écrit en arrière-plan : on attend qu'il l'ait fait, en base,
    // plutôt qu'un délai qui passerait sur cette machine et pas sur une autre.
    for (let i = 0; i < 50; i++) {
      const { rows } = await pool.query(
        `SELECT e.rappel_agenda_masque AS m FROM entreprises e
           JOIN membres_entreprise m ON m.entreprise_id = e.id JOIN users u ON u.id = m.utilisateur_id
          WHERE u.email = 'demo@atlas.local'`
      );
      if (rows[0]?.m === true) break;
      await page.waitForTimeout(100);
    }
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.getByRole("heading", { name: "Planning" }).waitFor({ timeout: 15000 });
    assert.equal(await page.getByText("Vous pouvez relier votre agenda").count(), 0, "la phrase est revenue au rechargement");
    assert.equal(await page.getByRole("button", { name: "Masquer" }).count(), 0, "« Masquer » est resté seul à l'écran");
  });

  await pool.end();

  await navigateur.close();
  console.log(`\n${echecs === 0 ? "✅" : "❌"} Écran de l'agenda — ${echecs} échec(s).`);
  if (echecs > 0) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
