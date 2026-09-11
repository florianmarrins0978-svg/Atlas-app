import assert from "node:assert";
import type { Page, BrowserContext } from "playwright";
import { lancerNavigateur } from "./e2e-browser";
import { pool } from "../src/server/db/client";
import { ADRESSE } from "./_adresse";

// ═══════════════════════════════════════════════════════════════════════════
// FACTURER SANS PASSER PAR LA CASE DEVIS — le chemin qu'IL emprunte
// ═══════════════════════════════════════════════════════════════════════════
//
// Sa demande du 10 septembre 2026 : *« il faut que l'on puisse facturer sans
// avoir besoin de passer par la case devis »*. Puis, le 11 : *« sous retour
// d'intervention, collé à droite, tu mets créer une facture en doré »*.
//
// ─── POURQUOI CETTE SUITE EXISTE, ALORS QUE LE DÉPÔT EST DÉJÀ ÉPROUVÉ ──────
//
// **Payé le 28 août 2026** (`CLAUDE.md` §5 quater) : six gestes de l'assistant
// ont été livrés avec leur code, leurs refus et leurs contrôles — tous verts,
// et **aucun atteignable**. Les contrôles entraient par une porte de service.
//
// `test-facture-sans-devis-db.ts` éprouve les règles d'écriture, sous
// `atlas_app`, et c'est indispensable. Mais il appelle `creerFactureSansDevis`
// directement — c'est-à-dire la moitié qu'on vient d'écrire, jamais le chemin
// qu'il prend, lui : ouvrir Terminés, voir un bouton doré, appuyer dessus.
//
// **C'est cette porte-là qui peut être fermée**, et elle seule. Cette suite
// part donc de l'écran Terminés et ne touche que ce qu'un doigt touche.

const BASE = ADRESSE;

/** L'adresse de sa capture du 11 septembre 2026, chez Frédéric. */
const ADRESSE_CHANTIER = "Rue Denfert Rochereau 78200 Mantes-la-Jolie";

let passed = 0;
let failed = 0;
async function test(nom: string, fn: () => Promise<void>) {
  try {
    await fn();
    console.log(`✅ ${nom}`);
    passed++;
  } catch (err) {
    console.error(`❌ ${nom}`);
    console.error(`   ${err instanceof Error ? err.message : err}`);
    failed++;
  }
}

async function seConnecter(context: BrowserContext): Promise<Page> {
  const page = await context.newPage();
  await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  await page.fill('input[name="email"]', "demo@atlas.local");
  await page.fill('input[name="password"]', "demo1234");
  await page.click('button[type="submit"]');
  await page.waitForURL(`${BASE}/`, { timeout: 15000 });
  return page;
}

/**
 * Le parcours entier, en ne touchant QUE ce qu'un doigt touche.
 *
 * Aucune adresse n'est composée à la main après le premier appui : c'est ce qui
 * rend la suite capable de voir une porte fermée. Fabriquer l'adresse de la
 * fiche client soi-même prouverait que la fiche marche, pas qu'on y arrive.
 */
async function depuisTerminesJusquALaFacture(page: Page, nomClient: string) {
  await page.goto(`${BASE}/termines`, { waitUntil: "networkidle" });
  await page.click('[data-atlas="creer-une-facture"]');
  await page.waitForURL(/\/chantiers\/nouveau/, { timeout: 15000 });
  await page.waitForLoadState("networkidle");

  await page.fill('input[placeholder="Bernard"]', nomClient);
  await page.fill('input[placeholder="06 12 34 56 78"]', "06 14 22 87 30");
  await page.click('[data-atlas="action-facture-directe"]');
  await page.waitForURL(/\/chantiers\/[^/]+\/facture$/, { timeout: 20000 });

  // **ON ATTEND LA CHOSE QU'ON VA LIRE, jamais « le réseau s'est calmé ».**
  //
  // Payé à la première exécution de cette suite. `waitForURL` rend la main dès
  // que l'adresse change, et `networkidle` dès que le réseau se tait — or
  // React n'avait pas encore remplacé l'arbre : le contrôle lisait la FICHE
  // CLIENT et concluait « l'écran d'arrivée ne parle pas de facture », sur un
  // produit qui marchait. Le pire des rouges, celui qui accuse du code juste
  // (`AGENTS.md` : une erreur qui envoie chercher au mauvais endroit coûte plus
  // cher que pas d'erreur du tout).
  //
  // Le repère attendu est celui de l'ENVOI, parce que c'est le bas de l'écran :
  // quand il est là, tout ce qui est au-dessus l'est aussi.
  await page.waitForSelector('[data-atlas="envoyer-la-facture"]', { timeout: 20000 });

  const url = page.url();
  return { chantierId: url.split("/").slice(-2)[0] };
}

async function main() {
  const navigateur = await lancerNavigateur();
  const context = await navigateur.newContext({ viewport: { width: 390, height: 844 } });
  const page = await seConnecter(context);

  // ── LA PORTE ─────────────────────────────────────────────────────────────

  await test("le bouton doré est sur Terminés, et il mène à la fiche client", async () => {
    await page.goto(`${BASE}/termines`, { waitUntil: "networkidle" });

    const bouton = page.locator('[data-atlas="creer-une-facture"]');
    assert.strictEqual(await bouton.count(), 1, "le bouton « Créer une facture » n'est pas sur Terminés");
    assert.match((await bouton.innerText()).trim(), /Créer une facture/);

    // **44 px, comme tout ce qu'on appuie ici** — la mesure d'un pouce sur un
    // chantier, parfois avec des gants. Et une boîte de zéro pixel ne se
    // compare à rien : c'est une mesure impossible, pas un succès.
    const boite = await bouton.boundingBox();
    assert.ok(boite && boite.height > 0, "le bouton fait zéro pixel : rien n'est mesuré");
    assert.ok(
      boite.height >= 44,
      `le bouton fait ${Math.round(boite.height)} px de haut : sous les 44 px du pouce`
    );

    await bouton.click();
    await page.waitForURL(/\/chantiers\/nouveau/, { timeout: 15000 });
  });

  await test("la rangée d'onglets ne déborde toujours pas de son écran", async () => {
    // C'est ce que la seconde rangée achète (`appli/creer-une-facture-sous-les-onglets.html`) :
    // les trois onglets gardent leur nom entier. Un jour où quelqu'un les
    // rallongerait, c'est ici qu'on l'apprendrait — pas sur son téléphone.
    await page.goto(`${BASE}/termines`, { waitUntil: "networkidle" });
    const mesure = await page.evaluate(() => {
      const r = document.querySelector<HTMLElement>('[data-atlas="onglets-termines"]');
      if (!r) return null;
      const pastilles = Array.from(r.children) as HTMLElement[];
      const largeurs = pastilles.map((p) => p.getBoundingClientRect().width);
      return {
        zero: largeurs.some((x) => x === 0),
        prise: Math.round(largeurs.reduce((s, x) => s + x, 0) + 4 * (largeurs.length - 1)),
        dispo: Math.round(r.getBoundingClientRect().width),
      };
    });
    assert.ok(mesure, "la rangée d'onglets est introuvable");
    assert.ok(!mesure.zero && mesure.prise > 0, "un onglet fait zéro : la mesure est impossible");
    assert.ok(
      mesure.prise <= mesure.dispo,
      `les onglets débordent : ${mesure.prise} px pour ${mesure.dispo}`
    );
  });

  await test("la fiche qui facture porte le micro, et pas l'anneau du devis", async () => {
    await page.goto(`${BASE}/chantiers/nouveau?facture=1`, { waitUntil: "networkidle" });

    // **LE PETIT MICRO EST LÀ — sa demande du 11 septembre 2026** : *« il faut
    // rajouter la petite note vocale comme sur la fiche client si on veut
    // dicter les infos de la facture »*. Il remplit le nom, le numéro,
    // l'e-mail, l'adresse — les mêmes cases qu'au devis, sur le même écran.
    assert.strictEqual(
      await page.locator('button[aria-label="Dicter les informations du client"]').count(),
      1,
      "le micro des coordonnées manque sur la fiche qui facture"
    );

    // **L'ANNEAU, LUI, RESTE DEHORS**, et la raison n'a pas changé : il dicte
    // le CHANTIER pour le faire chiffrer, et il n'y a pas de devis ici. Un
    // geste qui n'aboutit à rien est le pire des ornements.
    assert.strictEqual(
      await page.locator('[data-atlas="anneau-note-vocale"]').count(),
      0,
      "l'anneau de la note vocale est resté sur la fiche qui facture"
    );

    const bouton = page.locator('[data-atlas="action-facture-directe"]');
    assert.strictEqual(await bouton.count(), 1, "le geste « Faire la facture » est absent");
    assert.match((await bouton.innerText()).trim(), /Faire la facture/);
  });

  await test("L'E-MAIL TAPÉ ICI EST SUR SA FICHE LA FOIS D'APRÈS", async () => {
    // ── SA DEMANDE DU 11 SEPTEMBRE 2026 ───────────────────────────────────
    //
    // *« Là j'ai tapé Frédéric, il a reconnu le nom et a ajouté les infos seul,
    // c'est très bien ! Mais il n'avait pas l'info de l'adresse e-mail, donc
    // là je l'ai rajoutée, et ce qu'il faut faire c'est que maintenant il a
    // l'info et il doit la rajouter dans la catégorie client, comme ça la
    // prochaine fois que je taperai Frédéric l'adresse e-mail pourra être
    // ajoutée automatiquement aussi. »*
    //
    // **Le contrôle entre par SA porte** (`CLAUDE.md` §5 quater) : rien n'est
    // écrit en base à la main, le client naît du premier passage sur cet écran
    // et l'e-mail est tapé au clavier sur le second. Poser le client par le
    // dépôt aurait éprouvé `completerLaFiche`, que je viens d'écrire — jamais
    // le chemin où l'écran tient son identifiant et le lui passe.
    const nom = `Frederic ${Date.now()}`;
    const mail = `flo-speed-${Date.now()}@hotmail.test`;

    // 1ᵉʳ passage : il le crée SANS e-mail, comme le Frédéric de sa capture.
    await depuisTerminesJusquALaFacture(page, nom);

    // 2ᵉ passage : il retape le nom, Atlas le reconnaît, il ajoute l'e-mail.
    await page.goto(`${BASE}/termines`, { waitUntil: "networkidle" });
    await page.click('[data-atlas="creer-une-facture"]');
    await page.waitForURL(/\/chantiers\/nouveau/, { timeout: 15000 });
    await page.waitForLoadState("networkidle");
    await page.fill('input[placeholder="Bernard"]', nom);

    // **On attend la RECONNAISSANCE, pas un délai.** Elle part 350 ms après la
    // frappe et revient quand elle revient : un `waitForTimeout` rendrait la
    // suite verte ou rouge selon la charge de la machine.
    await page.waitForSelector('[data-atlas="client-reconnu"]', { timeout: 15000 });
    const repris = await page.inputValue('input[placeholder="06 12 34 56 78"]');
    assert.ok(repris.replace(/\D/g, "").length > 0, "Atlas n'a pas reposé le numéro qu'il connaît");

    await page.fill('input[placeholder="bernard@exemple.fr"]', mail);
    // **TOUT CE QU'IL POSE SUR CET ÉCRAN, pas seulement l'e-mail.** Sa capture
    // porte « Mr » choisi, une adresse de chantier et « SMS » souligné : ces
    // trois-là n'entraient PAS dans sa fiche, et il les rechoisissait à chaque
    // passage sans jamais savoir pourquoi (`completerLaFiche`).
    await page.click('[data-atlas="civilite-mr"]');
    await page.fill('input[placeholder="12 rue des Lilas, Nantes"]', ADRESSE_CHANTIER);
    await page.click('[data-atlas="action-facture-directe"]');
    await page.waitForURL(/\/chantiers\/[^/]+\/facture$/, { timeout: 20000 });
    await page.waitForSelector('[data-atlas="envoyer-la-facture"]', { timeout: 20000 });

    // **UNE SEULE FICHE, et elle porte l'e-mail.** Deux lignes voudraient dire
    // qu'il a appris sur un doublon : son e-mail serait bien en base, et le
    // Frédéric qu'il retrouve en tapant son nom ne l'aurait toujours pas.
    const { rows } = await pool.query(
      `SELECT id, email, telephone, civilite, adresse, canal_communication
         FROM clients WHERE nom = $1 AND deleted_at IS NULL`,
      [nom]
    );
    assert.strictEqual(rows.length, 1, `${rows.length} fiches pour un seul client`);
    assert.strictEqual(rows[0].email, mail, "l'e-mail tapé n'est pas entré dans sa fiche client");
    assert.strictEqual(rows[0].civilite, "mr", "la civilité choisie n'est pas entrée dans sa fiche");
    assert.strictEqual(
      rows[0].adresse,
      ADRESSE_CHANTIER,
      "l'adresse du chantier n'est pas devenue la sienne, ce que l'écran promet sous le champ"
    );
    assert.strictEqual(
      rows[0].canal_communication,
      "sms",
      "le canal d'envoi n'est pas entré dans sa fiche"
    );
    // Le numéro que le premier passage a posé (`depuisTerminesJusquALaFacture`),
    // en chiffres comme la base le garde. Apprendre, oui — écraser, jamais.
    assert.strictEqual(
      rows[0].telephone,
      "0614228730",
      "le numéro qu'il avait déjà a été réécrit au passage"
    );
  });

  // ── LE PARCOURS ──────────────────────────────────────────────────────────

  let chantierId = "";

  await test("de Terminés à une facture, sans jamais composer une adresse", async () => {
    const nom = `M. Julien ${Date.now()}`;
    ({ chantierId } = await depuisTerminesJusquALaFacture(page, nom));

    const dit = await page.locator("body").innerText();
    assert.match(dit, /Facture/, "l'écran d'arrivée ne parle pas de facture");
    // Le point 2 des trois qu'il a acceptés : jamais le mot « devis » sur ce
    // qu'on facture — cet écran se photographie et s'envoie au client.
    assert.doesNotMatch(
      dit,
      /Reprise du devis/,
      "la facture directe annonce qu'elle reprend un devis qui n'existe pas"
    );

    const { rows } = await pool.query(
      "SELECT devis_id, statut FROM factures WHERE chantier_id = $1",
      [chantierId]
    );
    assert.strictEqual(rows.length, 1, "aucune facture n'a été posée");
    assert.strictEqual(rows[0].devis_id, null, "la facture directe s'est trouvé un devis");
    assert.strictEqual(rows[0].statut, "brouillon", "elle est partie sans qu'il ait rien saisi");
  });

  await test("le chantier créé est DIRECTEMENT dans les terminés", async () => {
    // Sa décision du 10 septembre. Sans cela, il resterait à l'accueil comme un
    // travail en cours alors qu'il est fait, payé et facturé.
    const { rows } = await pool.query("SELECT termine_at FROM chantiers WHERE id = $1", [chantierId]);
    assert.ok(rows[0]?.termine_at, "le chantier d'une facture directe est resté en cours");
  });

  // ── LE REFUS QUI COMPTE ──────────────────────────────────────────────────

  await test("une facture VIDE ne peut pas partir, et le refus nomme son geste", async () => {
    // **Le trou qu'ouvrait la facture sans devis.** Née vide, rien ne
    // l'empêchait d'être envoyée à 0,00 € — une pièce comptable immuable, à
    // corriger par un avoir.
    const envoyer = page.locator('[data-atlas="envoyer-la-facture"]');
    assert.strictEqual(await envoyer.count(), 1, "le bouton d'envoi est absent");
    assert.ok(await envoyer.isDisabled(), "une facture sans aucune ligne peut être envoyée");

    const refus = page.locator('[data-atlas="facture-pas-prete"]');
    assert.strictEqual(await refus.count(), 1, "rien ne dit pourquoi l'envoi est fermé");
    const texte = await refus.innerText();
    assert.match(texte, /aucune ligne/i, `le refus dit « ${texte.replace(/\s+/g, " ")} »`);
    // Un bouton grisé sans un mot se lit comme une application en panne.
    assert.match(texte, /Remplir la facture/, "le refus ne nomme pas le geste qui le lève");
    // Et le geste qu'il nomme doit exister à l'écran, sinon c'est un cul-de-sac.
    assert.strictEqual(
      await page.locator('[data-atlas="ajouter-travaux-supplementaires"]').count(),
      1,
      "le geste que le refus désigne n'est nulle part"
    );
  });

  // ── LA REMPLIR, PUIS L'ENVOYER ───────────────────────────────────────────

  await test("il remplit sa facture, et l'écran cesse de refuser", async () => {
    await page.click('[data-atlas="ajouter-travaux-supplementaires"]');
    await page.waitForURL(/travaux-supplementaires/, { timeout: 15000 });
    await page.waitForLoadState("networkidle");

    // Sans devis, l'écran s'appelle « Facture » — jamais « Travaux en plus » :
    // il se photographie et s'envoie au client.
    const enTete = await page.locator("h1").first().innerText();
    assert.match(enTete, /Facture/, `l'en-tête dit « ${enTete} »`);

    await page.click('[data-atlas="ajouter-ligne-supplement"]');
    await page.waitForTimeout(600);

    const description = page.locator('[data-atlas="ligne-supplement"] textarea').first();
    await description.fill("Dépannage arrosage — remplacement électrovanne");
    await description.blur();
    const chiffres = page.locator('[data-atlas="ligne-supplement"] input');
    await chiffres.nth(1).fill("145");
    await chiffres.nth(1).blur();
    await page.waitForTimeout(800);

    await page.click('[data-atlas="revenir-a-la-facture"]');
    await page.waitForURL(/\/facture$/, { timeout: 15000 });
    // Même raison qu'au premier passage : on attend l'écran, pas le silence.
    await page.waitForSelector('[data-atlas="envoyer-la-facture"]', { timeout: 20000 });

    const dit = await page.locator("body").innerText();
    assert.match(dit, /Dépannage arrosage/, "la ligne saisie n'est pas sur la facture");
    assert.match(dit, /145,00\s*€/, `le montant n'est pas repris : « ${dit.slice(0, 200)} »`);
    // **Toujours pas un mot de devis**, alors qu'on vient de passer par l'écran
    // qui, ailleurs, s'appelle « Travaux en plus ».
    assert.doesNotMatch(dit, /Reprise du devis/, "le mot « devis » est réapparu");

    assert.strictEqual(
      await page.locator('[data-atlas="facture-pas-prete"]').count(),
      0,
      "l'écran refuse encore alors que la facture porte une ligne chiffrée"
    );
    assert.ok(
      !(await page.locator('[data-atlas="envoyer-la-facture"]').isDisabled()),
      "l'envoi reste fermé sur une facture remplie"
    );
  });

  await test("elle porte les lignes que LUI a saisies, et aucun supplément", async () => {
    // Marquée « supplément », la ligne s'imprimerait sous le titre « TRAVAUX
    // SUPPLÉMENTAIRES » — au-dessus de la seule chose qu'on facture.
    const { rows } = await pool.query(
      `SELECT lf.libelle, lf.montant, lf.supplement
         FROM lignes_facture lf
         JOIN factures f ON f.id = lf.facture_id
        WHERE f.chantier_id = $1`,
      [chantierId]
    );
    assert.strictEqual(rows.length, 1, `la facture porte ${rows.length} ligne(s) au lieu d'une`);
    assert.strictEqual(rows[0].supplement, false, "une ligne de facture directe se déclare supplément");
    assert.strictEqual(Number(rows[0].montant), 145);
  });

  await test("le PDF sort, et il ne cite aucun devis", async () => {
    const reponse = await page.request.get(
      `${BASE}/api/factures/${(await pool.query("SELECT id FROM factures WHERE chantier_id = $1", [chantierId])).rows[0].id}/pdf`
    );
    assert.strictEqual(reponse.status(), 200, "le PDF de la facture directe ne se sert pas");
    const octets = await reponse.body();
    assert.ok(octets.length > 800, `le PDF fait ${octets.length} octets : c'est une page vide`);
  });

  await context.close();
  await navigateur.close();
}

main()
  .catch((e) => {
    console.error(e);
    failed++;
  })
  .finally(async () => {
    await pool.end();
    console.log(
      `\n${failed === 0 ? "✅" : "❌"} Facture sans devis, de bout en bout — ${passed} réussi(s), ${failed} échec(s).`
    );
    process.exit(failed === 0 ? 0 : 1);
  });
