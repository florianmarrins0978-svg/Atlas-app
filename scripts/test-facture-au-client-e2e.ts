import { lancerNavigateur } from "./e2e-browser";
import assert from "node:assert/strict";
import { Pool } from "pg";

// **« La facture s'affiche partie, mais le client ne la reçoit pas. »**
//
// Le patron, le 6 août 2026. Il avait raison au mot près : l'écran annonçait
// « Facture F2026-0001 arrêtée » — vrai comptablement — et **rien** ne portait
// la facture jusqu'à son client. Aucun lien, aucun message, aucun moyen.
// Le devis, lui, avait tout cela depuis des semaines.
//
// Aucun prestataire n'envoie à la place du patron (`docs/A-FAIRE.md` §5,
// tranché le 4 août) : Atlas prépare le message, le patron l'expédie de sa
// messagerie. Ce que cette suite tient :
//
//   1. une facture arrêtée propose de l'envoyer, et dit qu'elle n'est pas
//      encore partie ;
//   2. le lien obtenu ouvre une page lisible par le client, sans compte ;
//   3. le PDF derrière ce lien est celui qui a été archivé à l'arrêt ;
//   4. **rien ne part tout seul** — le message s'ouvre dans SA messagerie ;
//   5. un lien inconnu ne dit rien à un visiteur au hasard.

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
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

  const client = `Client facture ${Date.now()}`;
  await page.goto(`${BASE}/chantiers/nouveau`, { waitUntil: "networkidle" });
  await page.fill('input[placeholder="M. Bernard"]', client);
  await page.fill('input[placeholder="06 12 34 56 78"]', "0612345678");
  await page.click('button:has-text("Créer le chantier")');
  await page.waitForURL(/\/chantiers\/[0-9a-f-]{36}/, { timeout: 15000 });
  const chantierId = page.url().split("/").pop()!;

  // Un devis chiffré, envoyé, accepté : la facture ne naît que d'un chantier
  // réellement mené — c'est l'arrêt 3 de `docs/AGENT.md` §2.3.
  await page.goto(`${BASE}/chantiers/${chantierId}/devis-complet`, { waitUntil: "networkidle" });
  await page.waitForSelector("text=Total TTC", { timeout: 20000 });
  await page.getByRole("button", { name: "+ Ajouter une ligne" }).click();
  await page.waitForTimeout(1000);
  await page.getByLabel("Description 1").fill("Élagage d'un tilleul");
  await page.getByLabel("Prix unitaire 1").fill("800");
  await page.getByLabel("Description 1").click();
  await page.waitForTimeout(1200);

  await page.goto(`${BASE}/chantiers/${chantierId}/export`, { waitUntil: "networkidle" });
  await page.click("text=Envoyer au client");
  await page.waitForTimeout(800);
  await page.locator("button[aria-pressed]").nth(1).click();
  await page.getByRole("button", { name: "Envoyer le devis" }).click();
  await page.waitForTimeout(2000);

  const jetonDevis = (
    await pool.query(
      `SELECT e.jeton FROM envois_devis e JOIN devis d ON d.id = e.devis_id WHERE d.chantier_id = $1`,
      [chantierId]
    )
  ).rows[0].jeton;
  await page.goto(`${BASE}/devis/${jetonDevis}`, { waitUntil: "networkidle" });
  // La date se choisit avant d'accepter — c'est le parcours réel du client.
  await page.locator('input[name="choixDate"]').first().check();
  await page.click('button:has-text("J\'accepte ce devis")');
  await page.waitForSelector("text=Votre artisan est prévenu", { timeout: 15000 });

  // Fin de chantier, puis arrêt de la facture.
  await page.goto(`${BASE}/chantiers/${chantierId}/facture`, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: /Fin de chantier|Confirmer le départ/i }).first().click();
  await page.waitForTimeout(2000);
  const confirmer = page.getByRole("button", { name: /Confirmer le départ/i });
  if (await confirmer.count()) {
    await confirmer.first().click();
    await page.waitForTimeout(2500);
  }

  // --- 1. « Arrêtée » n'est pas « partie » ---------------------------------
  const ecran = await page.locator("body").innerText();
  assert.match(ecran, /arrêtée/i, `La facture n'a pas été arrêtée. Écran :\n${ecran.slice(0, 500)}`);
  assert.match(
    ecran,
    /ne l'a pas encore reçue/i,
    "L'écran laisse croire que la facture est partie alors que rien ne la porte au client."
  );
  const bouton = page.getByRole("button", { name: /Envoyer la facture au client/i });
  assert.equal(await bouton.count(), 1, "Aucun moyen d'envoyer la facture au client.");
  console.log("  ✓ une facture arrêtée dit qu'elle n'est pas encore partie, et propose de l'envoyer");

  // --- 2. Le lien, et la messagerie du patron -----------------------------
  await bouton.click();
  await page.waitForTimeout(2000);

  const lien = page.getByRole("link", { name: /Ouvrir le (SMS|e-mail) tout prêt/ });
  assert.equal(await lien.count(), 1, "Le message tout prêt n'est pas proposé.");
  const adresse = (await lien.getAttribute("href")) ?? "";
  assert.ok(adresse.startsWith("sms:") || adresse.startsWith("mailto:"), `Adresse inattendue : ${adresse}`);
  // Le numéro part sans espaces, sinon l'application de messagerie n'y
  // reconnaît pas un destinataire et ouvre un message vide (défaut du 5 août).
  // Le contrôle porte sur le DESTINATAIRE seul : le corps du message, lui,
  // contient légitimement des %20 — première version de ce contrôle, qui
  // accusait donc à tort.
  const destinataire = adresse.slice(adresse.indexOf(":") + 1).split("?")[0];
  assert.ok(
    !destinataire.includes("%20") && !/\s/.test(destinataire),
    `Le destinataire porte des espaces : « ${destinataire} »`
  );
  assert.ok(destinataire.length > 0, "Le message s'ouvrirait sans destinataire.");
  console.log("  ✓ le message s'ouvre dans la messagerie du patron, destinataire compris");

  const envoi = await pool.query(
    `SELECT ef.jeton FROM envois_factures ef
       JOIN factures f ON f.id = ef.facture_id
      WHERE f.chantier_id = $1`,
    [chantierId]
  );
  assert.equal(envoi.rows.length, 1, "Aucun lien de facture n'a été enregistré.");
  const jeton = envoi.rows[0].jeton;
  assert.ok(adresse.includes(encodeURIComponent(jeton)) || adresse.includes(jeton), "Le message ne porte pas le lien.");

  // --- 3. Ce que le client voit -------------------------------------------
  const contexteClient = await navigateur.newContext({ viewport: { width: 393, height: 852 } });
  const pageClient = await contexteClient.newPage();
  await pageClient.goto(`${BASE}/factures/${jeton}`, { waitUntil: "networkidle" });
  const vueClient = await pageClient.locator("body").innerText();
  assert.match(vueClient, /Facture/i, `Le client ne voit pas sa facture :\n${vueClient.slice(0, 300)}`);
  assert.match(vueClient, /960,00|1 ?200|€/, "Le client ne voit aucun montant.");
  console.log("  ✓ le client ouvre sa facture sans compte, et la reconnaît");

  const pdf = await pageClient.request.get(`${BASE}/factures/${jeton}/pdf`);
  assert.equal(pdf.status(), 200, "Le PDF de la facture n'est pas servi au client.");
  assert.match(pdf.headers()["content-type"] ?? "", /pdf/, "Ce n'est pas un PDF.");
  console.log("  ✓ le PDF archivé est servi au client");

  // --- 4. Un lien inconnu ne raconte rien ---------------------------------
  const inconnu = await pageClient.goto(`${BASE}/factures/jeton-qui-n-existe-pas`, { waitUntil: "networkidle" });
  assert.equal(inconnu?.status(), 200, "Un lien inconnu doit rendre une page, pas une erreur technique.");
  const rien = await pageClient.locator("body").innerText();
  assert.match(rien, /plus valable/i, `Un lien inconnu doit s'expliquer en français :\n${rien.slice(0, 200)}`);
  assert.doesNotMatch(rien, /\{|error|stack/i, "Le client ne doit jamais voir de message technique.");
  console.log("  ✓ un lien inconnu s'explique, sans rien révéler");

  await contexteClient.close();
  await contexte.close();
  await navigateur.close();
  await pool.end();
  console.log("✅ La facture parvient au client, et rien ne part sans le patron.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
