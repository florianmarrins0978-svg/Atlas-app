import { lancerNavigateur } from "./e2e-browser";
import assert from "node:assert/strict";
import { Pool } from "pg";

// La fiche du client, telle qu'il l'atteint.
//
// *Arrangement B de `docs/maquettes/66`, retenu le 16 août 2026.*
//
// **CE QUE CETTE SUITE TIENT, ET QU'AUCUNE SUITE BASE NE VERRAIT :**
//
//   1. **le chemin existe.** La règle est éprouvée à part
//      (`test-fiche-client.ts`, `test-fiche-client-db.ts`) et serait verte même
//      si aucune porte ne menait à cet écran — c'est le raccord qui casse,
//      jamais la formule ;
//   2. **la porte n'existe pas sans client.** Un chantier sans client ouvrirait
//      une fiche de personne ;
//   3. les trois chiffres s'affichent, et « — » quand il n'y a rien à compter.
//      **« 0 € » se lirait comme un mauvais client** ;
//   4. **rien ne se casse en deux lignes** dans les trois cases à 390 px. C'est
//      le défaut vu à la capture sur « encore dus », et la seule façon de
//      l'empêcher de revenir ;
//   5. depuis la fiche, ses chantiers se rouvrent.

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const BASE = "http://localhost:3000";

let echecs = 0;
async function cas(nom: string, fn: () => Promise<void>) {
  try {
    await fn();
    console.log(`  ✓ ${nom}`);
  } catch (e) {
    echecs++;
    console.error(`  ✗ ${nom}\n    ${(e as Error).message}`);
  }
}

async function main() {
  const navigateur = await lancerNavigateur();
  const contexte = await navigateur.newContext({ viewport: { width: 390, height: 900 } });
  const page = await contexte.newPage();

  await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  await page.fill('input[name="email"]', "demo@atlas.local");
  await page.fill('input[name="password"]', "demo1234");
  await page.click('button[type="submit"]');
  await page.waitForURL(`${BASE}/`, { timeout: 20_000 });

  const nomClient = `Mme Bracquemont ${Date.now()}`;
  await page.goto(`${BASE}/chantiers/nouveau`, { waitUntil: "networkidle" });
  await page.fill('input[placeholder="Bernard"]', nomClient);
  await page.click('button:has-text("Créer le chantier")');
  await page.waitForURL(/\/chantiers\/[0-9a-f-]{36}/, { timeout: 15_000 });
  const chantierUrl = page.url();
  const chantierId = chantierUrl.split("/").pop()!;

  await page.goto(`${chantierUrl}/devis-complet`, { waitUntil: "networkidle" });
  await page.click('button:has-text("Ajouter une ligne")');
  await page.waitForTimeout(600);
  const zones = page.locator('textarea[aria-label*="escription"]');
  await zones.nth((await zones.count()) - 1).fill("Élagage — 3 chênes");
  const prixs = page.locator('input[aria-label*="Prix unitaire"]');
  await prixs.nth((await prixs.count()) - 1).fill("450");
  await page.keyboard.press("Tab");
  // **On attend la BASE, pas l'écran.** Le total du devis se recalcule dans le
  // navigateur à la frappe : il affiche 450 € avant même que le serveur ait
  // répondu. Quitter l'écran à ce moment annule l'action en vol, la ligne reste
  // à 0,00 € en base, et la fiche du client affiche « 1 fois · 0,00 € ».
  // Attendre l'écran, c'était donc mesurer ce qu'on venait de taper.
  for (let i = 0; i < 30; i++) {
    const { rows } = await pool.query(
      `SELECT montant FROM lignes_prix WHERE chantier_id = $1 ORDER BY ordre DESC LIMIT 1`,
      [chantierId]
    );
    if (rows[0] && Number(rows[0].montant) === 450) break;
    await page.waitForTimeout(400);
  }

  await cas("depuis la fiche du chantier, une porte mène au client", async () => {
    await page.goto(chantierUrl, { waitUntil: "networkidle" });
    await page.waitForTimeout(700);
    const porte = page.locator('a[href^="/clients/"]');
    assert.ok(
      (await porte.count()) >= 1,
      "aucune porte vers le client : la fiche existe mais rien n'y mène"
    );
    await porte.first().click();
    await page.waitForURL(/\/clients\/[0-9a-f-]{36}/, { timeout: 15_000 });
  });

  await cas("elle porte son nom, et les trois chiffres", async () => {
    const texte = await page.locator("body").innerText();
    assert.ok(texte.includes(nomClient), `le nom du client manque :\n${texte.slice(0, 300)}`);
    for (const mot of ["CHANTIER", "FACTURÉS", "RESTE DÛ"]) {
      assert.ok(texte.toUpperCase().includes(mot), `« ${mot} » manque à la fiche`);
    }
  });

  await cas("sans facture, elle dit « — » ET pourquoi — jamais « 0 € »", async () => {
    const texte = await page.locator("body").innerText();
    assert.ok(
      /Aucune facture émise/.test(texte),
      "les tirets ne sont pas expliqués : ils se lisent comme une donnée perdue"
    );
    // **La borne de gauche n'est pas un détail : « 0,00 € » est un morceau de
    // « 45<b>0,00 €</b> ».** Sans elle, le contrôle accusait la fiche d'afficher
    // un zéro chaque fois qu'une prestation coûtait un compte rond — et une
    // erreur qui accuse à tort coûte plus cher que pas de contrôle
    // (`CLAUDE.md` §5). On exige donc qu'aucun chiffre ne précède le zéro.
    assert.doesNotMatch(
      texte,
      /(^|[^\d])0,00\s?€/m,
      "« 0,00 € » s'affiche : ce client se lirait comme un mauvais payeur alors que rien n'est facturé"
    );
  });

  // **Le défaut trouvé à la capture.** « ENCORE DUS » se cassait en deux lignes
  // dans sa case. Mesuré, pas regardé — et on refuse de conclure sur une boîte
  // de zéro pixel (`CLAUDE.md` §5).
  await cas("aucun libellé ne se casse en deux lignes dans les trois cases", async () => {
    const mesures = await page.evaluate(() => {
      const boites = [...document.querySelectorAll("span")].filter((e) =>
        /CHANTIER|FACTUR|RESTE/i.test(e.textContent ?? "") && e.children.length === 0
      );
      return boites.map((e) => {
        const s = getComputedStyle(e);
        return {
          texte: e.textContent ?? "",
          hauteur: e.getBoundingClientRect().height,
          ligne: parseFloat(s.lineHeight) || parseFloat(s.fontSize) * 1.2,
        };
      });
    });
    assert.ok(mesures.length >= 3, `il faut trois libellés à mesurer, ${mesures.length} trouvés`);
    for (const m of mesures) {
      assert.ok(m.hauteur > 0 && m.ligne > 0, `« ${m.texte} » ne se mesure pas : rien à conclure`);
      assert.ok(
        m.hauteur < m.ligne * 1.6,
        `« ${m.texte} » tient sur ${Math.round(m.hauteur / m.ligne)} lignes dans sa case`
      );
    }
  });

  await cas("les prestations du devis remontent sur la fiche", async () => {
    const texte = await page.locator("body").innerText();
    assert.ok(texte.includes("Élagage"), `la prestation dictée ne remonte pas :\n${texte.slice(0, 400)}`);
    assert.ok(/1 fois/.test(texte), "le nombre de fois manque");
  });

  await cas("ses chantiers se rouvrent depuis sa fiche", async () => {
    const lien = page.locator(`a[href="/chantiers/${chantierId}"]`);
    assert.ok((await lien.count()) >= 1, "le chantier n'est pas cliquable depuis la fiche du client");
    await lien.first().click();
    await page.waitForURL(new RegExp(`/chantiers/${chantierId}$`), { timeout: 15_000 });
  });

  await cas("un chantier SANS client n'ouvre aucune porte sur du vide", async () => {
    await page.goto(`${BASE}/chantiers/nouveau`, { waitUntil: "networkidle" });
    await page.click('button:has-text("Créer le chantier")');
    await page.waitForURL(/\/chantiers\/[0-9a-f-]{36}/, { timeout: 15_000 });
    await page.waitForTimeout(700);
    const { rows } = await pool.query(`SELECT client_id FROM chantiers WHERE id = $1`, [
      page.url().split("/").pop(),
    ]);
    if (rows[0]?.client_id) {
      // Le formulaire a quand même créé un client : le cas ne se produit pas ici.
      console.log("    (ce chantier a reçu un client : rien à vérifier)");
      return;
    }
    assert.equal(
      await page.locator('a[href^="/clients/"]').count(),
      0,
      "une porte vers la fiche d'un client qui n'existe pas"
    );
  });

  // ── La LISTE, sa remarque du 17 août au soir ──────────────────────────────
  //
  // *« La catégorie client n'a pas été créée. »* La fiche existait, mais elle ne
  // s'atteignait que depuis un chantier : rien ne menait à SES clients. Le
  // chemin s'éprouve donc DEPUIS L'ACCUEIL, en touchant le lien — viser
  // l'adresse directement laisserait passer un lien qui ne mène nulle part.
  await cas("depuis l'accueil, « Vos clients » ouvre la liste", async () => {
    await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
    const lien = page.getByRole("link", { name: /Vos clients/i });
    assert.equal(await lien.count(), 1, "aucun lien « Vos clients » sur l'accueil : la liste est introuvable");
    await lien.click();
    await page.waitForURL(`${BASE}/clients`, { timeout: 15_000 });
    // **Attendre le CONTENU, pas l'adresse.** L'adresse change avant le rendu :
    // la première ouverture d'un écran se compile sur le serveur de
    // développement, et la page affiche « Chargement… ». Le contrôle lisait ce
    // mot-là et accusait la liste d'être vide.
    await page.locator('a[href^="/clients/"]').first().waitFor({ timeout: 30_000 });
    const texte = await page.locator("body").innerText();
    // Le titre COMPTE, et le message montre ce qui a été vu : un contrôle qui
    // dit seulement « ça ne correspond pas » fait relire la page à la main.
    assert.match(
      texte,
      /\d+\s+clients?/i,
      `la liste ne dit pas combien de clients elle porte. L'écran dit : ${JSON.stringify(texte.slice(0, 200))}`
    );
    assert.ok(texte.includes(nomClient), `le client « ${nomClient} » manque dans sa propre liste`);
  });

  await cas("un nom de la liste ouvre sa fiche", async () => {
    await page.getByRole("link", { name: new RegExp(nomClient.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")) }).click();
    await page.waitForURL(/\/clients\/[0-9a-f-]{36}/, { timeout: 15_000 });
    assert.match(await page.locator("body").innerText(), new RegExp(nomClient.split(" ")[0]));
  });

  await cas("la barre du bas n'a pas gagné d'onglet", async () => {
    // Le cinquième onglet est décidé pour les outils métier
    // (`ARCHITECTURE.md` §125) : la liste des clients ne doit PAS lui prendre
    // sa place, et à cinq colonnes « CHANTIERS » déborde déjà sur 360 px.
    await page.goto(`${BASE}/clients`, { waitUntil: "networkidle" });
    const onglets = await page.locator("nav a").allInnerTexts();
    assert.equal(
      onglets.length,
      4,
      `la barre du bas porte ${onglets.length} onglets au lieu de quatre : ${onglets.join(", ")}`
    );
  });

  await contexte.close();
  await navigateur.close();
  await pool.end();

  console.log(`\n${echecs === 0 ? "✅" : "❌"} La fiche du client et sa liste — ${echecs} échec(s).`);
  process.exit(echecs === 0 ? 0 : 1);
}

main().catch(async (e) => {
  console.error(e);
  await pool.end().catch(() => {});
  process.exit(1);
});
