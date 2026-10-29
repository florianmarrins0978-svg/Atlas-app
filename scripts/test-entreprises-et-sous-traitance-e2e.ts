import assert from "node:assert/strict";
import { lancerNavigateur, DELAI_PAR_DEFAUT_MS } from "./e2e-browser";
import type { Page } from "playwright";
import { ADRESSE } from "./_adresse";
import { eq } from "drizzle-orm";
import { db, pool } from "../src/server/db/client";
import { users, membresEntreprise } from "../src/server/db/schema";
import * as clientsRepo from "../src/server/repositories/clients";
import * as chantiersRepo from "../src/server/repositories/chantiers";
import * as prixRepo from "../src/server/repositories/lignes-prix";
import * as devisRepo from "../src/server/repositories/devis";
import { texteDuPdf } from "./_lecteur-pdf-protege";

// ═══════════════════════════════════════════════════════════════════════════
// MR, MME OU ENTREPRISE ; VOS ENTREPRISES ; LE DEVIS EN SOUS-TRAITANCE
// ═══════════════════════════════════════════════════════════════════════════
//
// Ses choix du 4 octobre 2026, joués par SES portes : la liste des clients et
// sa porte, la fiche « Ses coordonnées », l'écran du devis. Ce que la base
// garantit est éprouvé sous `atlas_app` (`test-documents-en-regle-db.ts`) ;
// ici, on vérifie qu'il PEUT l'atteindre, et ce qu'il voit.

// L'adresse de SON atelier (`_adresse.ts`), jamais le port 3000 en dur : la
// batterie prend un autre port quand le 3000 est tenu, et cette suite visait
// alors un autre serveur que le sien (5 octobre 2026).
const BASE = ADRESSE;

let echecs = 0;
async function cas(nom: string, f: () => Promise<void>) {
  try {
    await f();
    console.log(`  ✓ ${nom}`);
  } catch (e) {
    echecs++;
    console.error(`  ✗ ${nom}\n    ${(e as Error).message}`);
  }
}

async function seConnecter(page: Page) {
  await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
  await page.locator('input[name="email"]').waitFor();
  await page.fill('input[name="email"]', "demo@atlas.local");
  await page.fill('input[name="password"]', "demo1234");
  await page.click('button[type="submit"]');
  await page.waitForURL(`${BASE}/`, { timeout: DELAI_PAR_DEFAUT_MS });
}

/** Son propre client et son propre chantier : jamais l'état laissé par une autre suite. */
async function preparer() {
  const [demo] = await db.select().from(users).where(eq(users.email, "demo@atlas.local")).limit(1);
  if (!demo) throw new Error("le compte de démonstration est absent : la base n'est pas amorcée");
  const [m] = await db
    .select({ e: membresEntreprise.entrepriseId })
    .from(membresEntreprise)
    .where(eq(membresEntreprise.utilisateurId, demo.id))
    .limit(1);
  const ctx = { utilisateurId: demo.id, entrepriseId: m!.e };
  const marque = Date.now();
  const entreprise = await clientsRepo.creerClient(ctx, { nom: `Paysages Essai ${marque}` });
  await clientsRepo.mettreAJourClient(ctx, entreprise.id, { civilite: "entreprise" });
  const particulier = await clientsRepo.creerClient(ctx, { nom: `Particulier ${marque}` });
  const chantier = await chantiersRepo.creerChantier(ctx, { nom: `Chez Essai ${marque}`, clientId: entreprise.id });
  await prixRepo.ajouterLignePrix(ctx, chantier.id, "Création de massifs", "1000.00");
  await devisRepo.getOuCreerDevisBrouillon(ctx, chantier.id);
  return { entreprise, particulier, chantier };
}

async function principal() {
  const { entreprise, particulier, chantier } = await preparer();
  const nav = await lancerNavigateur();
  const page = await (await nav.newContext()).newPage();
  await seConnecter(page);

  await cas("« Vos clients » : les particuliers, et la porte « Vos entreprises »", async () => {
    await page.goto(`${BASE}/clients`, { waitUntil: "domcontentloaded" });
    await page.locator('[data-atlas="porte-entreprises"]').waitFor({ timeout: DELAI_PAR_DEFAUT_MS });
    const noms = await page.locator('[data-atlas="nom-client"]').allInnerTexts();
    assert.ok(noms.some((n) => n.includes(particulier.nom)), "le particulier manque à « Vos clients »");
    assert.ok(!noms.some((n) => n.includes(entreprise.nom)), "l'entreprise est mêlée aux particuliers");
  });

  await cas("la porte ouvre « Vos entreprises », et la flèche ramène aux clients", async () => {
    await page.click('[data-atlas="porte-entreprises"]');
    await page.waitForURL(/\/clients\?vue=entreprises/, { timeout: DELAI_PAR_DEFAUT_MS });
    await page.locator("h1", { hasText: "Vos entreprises" }).waitFor({ timeout: DELAI_PAR_DEFAUT_MS });
    const noms = await page.locator('[data-atlas="nom-client"]').allInnerTexts();
    assert.ok(noms.some((n) => n.includes(entreprise.nom)), "l'entreprise manque derrière la porte");
    assert.ok(!noms.some((n) => n.includes(particulier.nom)), "un particulier est rangé chez les entreprises");
    // La loupe cherche aussi un titre ou un montant depuis le 28 octobre 2026 :
    // derrière chaque porte, elle porte sa phrase, celle de Vos clients.
    assert.equal(
      await page.locator('[data-atlas="chercher-client"]').getAttribute("placeholder"),
      "Chercher un nom, un titre, un montant"
    );
  });

  await cas("la fiche : trois pastilles, et Entreprise montre le SIRET et la TVA", async () => {
    await page.goto(`${BASE}/clients/${entreprise.id}/coordonnees`, { waitUntil: "domcontentloaded" });
    const pastille = page.locator('[data-atlas="civilite-entreprise"]');
    await pastille.waitFor({ timeout: DELAI_PAR_DEFAUT_MS });
    assert.equal(await pastille.getAttribute("aria-pressed"), "true");
    await page.locator('[data-atlas="siret-client"]').waitFor({ timeout: DELAI_PAR_DEFAUT_MS });
    assert.equal(await page.locator('[data-atlas="tva-client-fiche"]').count(), 1);
    assert.equal(await page.locator('[data-atlas="tva-client-fiche"]').inputValue(), "FR", "la fiche sans numéro ne porte pas FR");
    await page.click('[data-atlas="civilite-mr"]');
    await page.locator('[data-atlas="siret-client"]').waitFor({ state: "detached", timeout: DELAI_PAR_DEFAUT_MS });
  });

  // Sa condition du 7 octobre 2026, planche B : « faut pas que ça bloque ».
  // Un numéro signalé faux s'enregistre quand même, tel qu'il l'a tapé.
  await cas("un n° TVA signalé faux propose le bon, et s'enregistre quand même", async () => {
    await page.goto(`${BASE}/clients/${entreprise.id}/coordonnees`, { waitUntil: "domcontentloaded" });
    await page.locator('[data-atlas="siret-client"]').waitFor({ timeout: DELAI_PAR_DEFAUT_MS });
    await page.locator('[data-atlas="siret-client"]').fill("93848383883833");
    await page.locator('[data-atlas="tva-client-fiche"]').fill("FR54938483838");
    await page.locator('[data-atlas="avis-tva"]').waitFor({ timeout: DELAI_PAR_DEFAUT_MS });
    assert.equal(await page.locator('[data-atlas="mettre-la-tva"]').innerText(), "Mettre FR45938483838");
    await page.click('[data-atlas="enregistrer-coordonnees"]');
    let enregistre: string | null = null;
    for (let i = 0; i < 40 && enregistre !== "FR54938483838"; i++) {
      await page.waitForTimeout(250);
      const r = await pool.query<{ numero_tva: string | null }>("SELECT numero_tva FROM clients WHERE id = $1", [entreprise.id]);
      enregistre = r.rows[0]?.numero_tva ?? null;
    }
    assert.equal(enregistre, "FR54938483838", "la ligne rouge a retenu l'enregistrement");
  });

  await cas("à la création, Entreprise fait apparaître le SIRET et le n° TVA", async () => {
    await page.goto(`${BASE}/chantiers/nouveau`, { waitUntil: "domcontentloaded" });
    const pastille = page.locator('[data-atlas="civilite-entreprise"]');
    await pastille.waitFor({ timeout: DELAI_PAR_DEFAUT_MS });
    assert.equal(await page.locator('input[aria-label="SIRET"]').count(), 0, "le SIRET s'affiche pour un particulier");
    await pastille.click();
    await page.locator('input[aria-label="SIRET"]').waitFor({ timeout: DELAI_PAR_DEFAUT_MS });
    const tva = page.locator('input[aria-label="N° TVA intracommunautaire"]');
    assert.equal(await tva.count(), 1);
    // Sa demande du 7 octobre 2026 : « FR » d'office, et il s'efface pour une
    // entreprise étrangère sans qu'aucune alerte ne le retienne.
    assert.equal(await tva.inputValue(), "FR", "le FR n'est pas posé d'office");
    await page.locator('input[aria-label="SIRET"]').fill("81234567800021");
    assert.equal(await page.locator('text=Le n° TVA : FR suivi de 11 chiffres.').count(), 0, "FR seul est pris pour un numéro faux");
    await tva.fill("");
    assert.equal(await tva.inputValue(), "", "le FR ne s'efface pas");
  });

  // Vu à l'écran le 27 octobre 2026 : à la création, Public n'ouvrait rien,
  // alors que sa fiche demande le SIRET et le code service de Chorus Pro. Une
  // mairie créée par « Créer un devis » partait donc sans eux, et sa facture
  // ne pouvait pas se déposer telle quelle.
  await cas("à la création, Public fait apparaître le SIRET et le code service, et sa fiche les garde", async () => {
    await page.goto(`${BASE}/chantiers/nouveau`, { waitUntil: "domcontentloaded" });
    const pastille = page.locator('[data-atlas="civilite-public"]');
    await pastille.waitFor({ timeout: DELAI_PAR_DEFAUT_MS });
    await pastille.click();
    await page.locator('input[aria-label="SIRET"]').waitFor({ timeout: DELAI_PAR_DEFAUT_MS });
    assert.equal(await page.locator('input[aria-label="Code service"]').count(), 1, "le code service manque à une mairie");
    assert.equal(
      await page.locator('input[aria-label="N° TVA intracommunautaire"]').count(),
      0,
      "le n° TVA s'affiche pour une mairie, comme si elle pouvait être donneuse d'ordre en sous-traitance"
    );
    const nom = `Mairie d'essai ${Date.now()}`;
    await page.locator('input[aria-label="Nom du client"]').fill(nom);
    await page.locator('input[aria-label="SIRET"]').fill("21490353500018");
    await page.locator('input[aria-label="Code service"]').fill("ESPACES-VERTS");
    await page.locator("button", { hasText: /^Je rédige à la main$/ }).click();
    await page.waitForURL(/\/chantiers\/[^/]+\/devis-complet/, { timeout: DELAI_PAR_DEFAUT_MS });
    const r = await pool.query<{ siret: string | null; code_service: string | null; civilite: string | null }>(
      "SELECT siret, code_service, civilite FROM clients WHERE nom = $1",
      [nom]
    );
    assert.equal(r.rows[0]?.civilite, "public", `la mairie n'est pas rangée comme service public : ${JSON.stringify(r.rows)}`);
    assert.equal(r.rows[0]?.siret, "214 903 535 00018", "le SIRET de la mairie n'est pas sur sa fiche");
    assert.equal(r.rows[0]?.code_service, "ESPACES-VERTS", "le code service n'est pas sur sa fiche");
  });

  // Sa question du 28 octobre 2026 : « tu as bien vérifié que, lorsqu'on crée
  // la facture, ça apparaît aussi ? ». Par SA porte : Terminés, « Faire la
  // facture », la mairie tapée sur la fiche qui facture, puis l'écran de la
  // facture et son PDF, celui qui se dépose sur Chorus Pro.
  await cas("par « Faire la facture », le SIRET et le code service d'une mairie arrivent sur sa facture et son PDF", async () => {
    await page.goto(`${BASE}/chantiers/nouveau?facture=1`, { waitUntil: "domcontentloaded" });
    const pastille = page.locator('[data-atlas="civilite-public"]');
    await pastille.waitFor({ timeout: DELAI_PAR_DEFAUT_MS });
    await pastille.click();
    const nom = `Mairie facturée ${Date.now()}`;
    await page.locator('input[aria-label="Nom du client"]').fill(nom);
    await page.locator('input[aria-label="SIRET"]').fill("21490353500018");
    await page.locator('input[aria-label="Code service"]').fill("ESPACES-VERTS");
    await page.locator('[data-atlas="action-facture-directe"]').click();
    await page.waitForURL(/\/chantiers\/[^/]+\/facture$/, { timeout: DELAI_PAR_DEFAUT_MS });
    const chantierId = page.url().split("/chantiers/")[1].split("/")[0];

    const service = page.locator('[data-atlas="code-service-facture"]');
    await service.waitFor({ timeout: DELAI_PAR_DEFAUT_MS });
    assert.equal(await service.inputValue(), "ESPACES-VERTS", "le code service n'est pas repris sur la facture");
    await page.screenshot({ path: "/tmp/facture-de-la-mairie.png", fullPage: true });
    const f = await pool.query<{ id: string; client_siret: string | null; client_code_service: string | null }>(
      "SELECT id, client_siret, client_code_service FROM factures WHERE chantier_id = $1",
      [chantierId]
    );
    assert.equal(f.rows[0]?.client_siret, "214 903 535 00018", "le SIRET n'est pas sur la facture");
    assert.equal(f.rows[0]?.client_code_service, "ESPACES-VERTS");

    const pdf = await page.request.get(`${BASE}/api/factures/${f.rows[0].id}/pdf`);
    assert.equal(pdf.status(), 200, "l'aperçu du PDF ne répond pas");
    const texte = texteDuPdf(new Uint8Array(await pdf.body())).replace(/\s+/g, " ");
    assert.match(texte, /SIRET 214 903 535 00018/, "le SIRET manque au PDF");
    assert.match(texte, /Code service ESPACES-VERTS/, "le code service manque au PDF");
  });

  await cas("le devis d'une entreprise : la sous-traitance est là, décochée ; allumée, plus de TVA", async () => {
    await page.goto(`${BASE}/chantiers/${chantier.id}/devis-complet`, { waitUntil: "domcontentloaded" });
    const interrupteur = page.locator('[data-atlas="sous-traitance-devis"]');
    await interrupteur.waitFor({ timeout: DELAI_PAR_DEFAUT_MS });
    assert.equal(await interrupteur.getAttribute("aria-checked"), "false", "cochée d'office : c'est la A, il a choisi la B");
    await interrupteur.click();
    await page.locator("text=Total à payer").waitFor({ timeout: DELAI_PAR_DEFAUT_MS });
    assert.equal(
      await page.locator('[data-atlas="sous-traitance-devis"]').getAttribute("aria-checked"),
      "true"
    );
    await page.locator("text=TVA, autoliquidation").waitFor({ timeout: DELAI_PAR_DEFAUT_MS });
  });

  await page.screenshot({ path: "/tmp/entreprises-et-sous-traitance.png", fullPage: true });
  await nav.close();
  await pool.end();
  console.log(`\n${echecs === 0 ? "✅" : "❌"} Entreprises et sous-traitance au navigateur — ${echecs} échec(s).`);
  process.exit(echecs === 0 ? 0 : 1);
}

principal();
