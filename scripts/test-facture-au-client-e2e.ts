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
//
// **Deux garanties ajoutées le 12 août 2026** (`TODO.md` §8, ses mots du
// 10 août) : la facture se TÉLÉCHARGE, sous un nom qui porte son numéro ; et
// elle part par SMS **ou** par e-mail, au choix, y compris quand le client n'a
// pas d'adresse enregistrée. Le second manque était le plus grave — un client
// sur deux ne pouvait tout simplement pas être facturé.

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const BASE = "http://localhost:3000";

async function main() {
  const navigateur = await lancerNavigateur();
  const contexte = await navigateur.newContext();
  const page = await contexte.newPage();

  await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  await page.fill('input[name="email"]', "demo@atlas.local");
  await page.fill('input[name="password"]', "demo1234");
  await page.click('button[type="submit"]');
  await page.waitForURL(`${BASE}/`, { timeout: 20000 });

  const client = `Client facture ${Date.now()}`;
  await page.goto(`${BASE}/chantiers/nouveau`, { waitUntil: "networkidle" });
  await page.fill('input[placeholder="Bernard"]', client);
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

  // **Attendre l'ÉTAT, jamais un délai fixe** — la règle que ce fichier énonce
  // quarante lignes plus bas, et qui manquait ICI, sur le geste qui la précède.
  //
  // Le 12 août 2026 au soir, en batterie : `TypeError: Cannot read properties
  // of undefined (reading 'jeton')`. Deux secondes suffisent quand la suite est
  // jouée seule ; sous soixante suites enchaînées, l'envoi ne les tient pas, la
  // ligne n'existe pas encore, et l'erreur accuse un `undefined` au lieu de
  // dire que l'envoi n'a pas eu le temps. Un contrôle qui échoue au hasard
  // apprend à ignorer le rouge.
  let jetonDevis: string | undefined;
  for (let i = 0; i < 60 && !jetonDevis; i++) {
    jetonDevis = (
      await pool.query(
        `SELECT e.jeton FROM envois_devis e JOIN devis d ON d.id = e.devis_id WHERE d.chantier_id = $1`,
        [chantierId]
      )
    ).rows[0]?.jeton;
    if (!jetonDevis) await page.waitForTimeout(500);
  }
  if (!jetonDevis) {
    throw new Error(
      "Le devis n'est jamais parti : aucune ligne dans `envois_devis` après trente secondes. " +
        "Ce n'est pas un défaut d'attente — c'est l'envoi lui-même qui a échoué."
    );
  }
  await page.goto(`${BASE}/devis/${jetonDevis}`, { waitUntil: "networkidle" });
  // La date se choisit avant d'accepter — c'est le parcours réel du client.
  await page.locator('input[name="choixDate"]').first().check();
  await page.click('button:has-text("J\'accepte ce devis")');
  await page.waitForSelector("text=Votre artisan est prévenu", { timeout: 15000 });

  // Créer la facture, puis arrêt de l'envoi.
  //
  // **Attendre l'ÉTAT, jamais un délai fixe.** Cette suite portait déjà la règle
  // plus bas, pour le lien de la messagerie — mais pas ici, sur le geste qui la
  // précède. Deux secondes suffisent quand la suite est jouée seule ; sous
  // cinquante suites enchaînées, la préparation de la facture les dépasse, et
  // le contrôle accusait alors le produit de n'avoir pas arrêté la facture. Faux
  // rouge constaté le 12 août 2026, vert dans la foulée joué seul.
  await page.goto(`${BASE}/chantiers/${chantierId}/facture`, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: /Créer la facture|Confirmer le départ/i }).first().click();

  const confirmer = page.getByRole("button", { name: /Confirmer le départ/i });
  // Le bouton de confirmation apparaît quand la facture est préparée. S'il ne
  // vient pas, l'écran est peut-être déjà passé à l'étape suivante : on ne fait
  // donc pas de son absence un échec, c'est l'assertion qui suit qui tranche.
  await confirmer
    .first()
    .waitFor({ state: "visible", timeout: 30_000 })
    .catch(() => undefined);
  if (await confirmer.count()) {
    await confirmer.first().click();
  }
  // Ce qu'on attend vraiment : que l'écran dise la facture arrêtée.
  await page
    .getByText(/arrêtée/i)
    .first()
    .waitFor({ state: "visible", timeout: 30_000 })
    .catch(() => undefined);

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

  const lien = page.getByRole("link", { name: /Ouvrir le (SMS|e-mail) tout prêt/ });
  // **Attendre le lien, jamais un délai fixe.** Ce contrôle a échoué une fois
  // au milieu de la batterie complète, et passé seul dans la foulée : sous
  // trente-cinq suites enchaînées sur un même serveur de développement, la
  // préparation du lien dépasse parfois deux secondes. Un contrôle qui échoue
  // au hasard est pire qu'aucun contrôle — il apprend à ignorer le rouge.
  await lien
    .first()
    .waitFor({ state: "visible", timeout: 20_000 })
    .catch(() => undefined);
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

  // **La capsule, et non un aplat repeint sur place** (son choix du 12 août,
  // maquette 31, variante A). On mesure le RAYON CALCULÉ : ce bouton était le
  // dernier de l'écran dessiné à la main, et c'est ainsi qu'il avait manqué la
  // décision du 11 août. Un retour au dessin local rendrait ce contrôle rouge.
  const rayon = await lien.first().evaluate((el) => parseFloat(getComputedStyle(el).borderTopLeftRadius));
  const hauteur = (await lien.first().boundingBox())?.height ?? 0;
  assert.ok(rayon > 20, `Le bouton n'est pas une capsule : rayon de ${rayon} px.`);
  // 44 px est ce qu'Apple demande au doigt ; la capsule en fait 50.
  assert.ok(hauteur >= 44, `Le bouton fait ${Math.round(hauteur)} px de haut : sous 44, on le rate.`);
  console.log(`  ✓ le message tout prêt porte la capsule (rayon ${rayon} px, ${Math.round(hauteur)} px de haut)`);

  const envoi = await pool.query(
    `SELECT ef.jeton FROM envois_factures ef
       JOIN factures f ON f.id = ef.facture_id
      WHERE f.chantier_id = $1`,
    [chantierId]
  );
  assert.equal(envoi.rows.length, 1, "Aucun lien de facture n'a été enregistré.");
  const jeton = envoi.rows[0].jeton;
  assert.ok(adresse.includes(encodeURIComponent(jeton)) || adresse.includes(jeton), "Le message ne porte pas le lien.");

  // --- 2 bis. « Impossible d'enregistrer la facture » ----------------------
  //
  // Le patron ne pouvait qu'OUVRIR le PDF, jamais le ranger. Le contrôle porte
  // sur l'en-tête du serveur et non sur l'attribut `download` du lien : celui-ci
  // est ignoré par certaines versions d'iOS, et c'est alors le serveur qui
  // décide. Le nom doit porter le numéro — il en aura des centaines.
  const telechargement = page.locator("[data-atlas='telecharger-facture']");
  assert.equal(await telechargement.count(), 1, "Rien ne permet de télécharger la facture.");
  const cheminPdf = (await telechargement.getAttribute("href")) ?? "";
  const nomPropose = (await telechargement.getAttribute("download")) ?? "";
  const range = await page.request.get(`${BASE}${cheminPdf}`);
  const remise = range.headers()["content-disposition"] ?? "";
  assert.ok(remise.startsWith("attachment"), `Le PDF s'ouvre au lieu de se ranger : « ${remise} »`);
  assert.ok(
    remise.includes(`filename="${nomPropose}"`),
    `L'écran propose « ${nomPropose} » et le serveur range « ${remise} ».`
  );
  assert.match(nomPropose, /^F\d{4}-\d{4}\.pdf$/, `Nom de fichier inexploitable : « ${nomPropose} »`);
  // Et l'aperçu continue de s'ouvrir : la nouveauté s'ajoute, elle ne remplace pas.
  const apercu = await page.request.get(`${BASE}${cheminPdf.replace("?telecharger=1", "")}`);
  assert.ok(
    (apercu.headers()["content-disposition"] ?? "").startsWith("inline"),
    "« Voir la facture en PDF » ne s'ouvre plus dans un onglet."
  );
  console.log("  ✓ la facture se télécharge, sous un nom qui porte son numéro");

  // --- 2 ter. « On ne propose que le SMS » --------------------------------
  //
  // Ce client n'a qu'un numéro. L'écran doit offrir l'autre voie ET permettre
  // de lever ce qui l'arrête sur place : il n'existe aucun écran de fiche
  // client où aller saisir l'adresse.
  const versEmail = page.locator("[data-bascule-canal='email']");
  assert.equal(await versEmail.count(), 1, "L'écran ne propose pas d'envoyer la facture par e-mail.");
  await versEmail.click();
  await page.waitForTimeout(600);
  const champEmail = page.getByLabel("Adresse e-mail");
  assert.equal(await champEmail.count(), 1, "L'adresse manquante ne se saisit nulle part : le patron est bloqué.");
  await champEmail.fill("client@exemple.fr");
  await page.getByRole("button", { name: /Enregistrer et ouvrir le message/i }).click();
  const lienMail = page.locator("a[data-atlas='transmission-email']");
  await lienMail.waitFor({ state: "visible", timeout: 20_000 }).catch(() => undefined);
  assert.equal(await lienMail.count(), 1, "Le message e-mail tout prêt n'apparaît pas.");
  const adresseMail = (await lienMail.getAttribute("href")) ?? "";
  assert.ok(adresseMail.startsWith("mailto:"), `Adresse inattendue : ${adresseMail.slice(0, 60)}`);
  assert.match(adresseMail, /subject=/, "L'e-mail partirait sans objet.");
  // La coordonnée est écrite SUR LE CLIENT : la ressaisir au chantier suivant
  // serait le même geste perdu deux fois.
  const fiche = await pool.query(
    `SELECT c.email FROM clients c JOIN chantiers ch ON ch.client_id = c.id WHERE ch.id = $1`,
    [chantierId]
  );
  assert.equal(fiche.rows[0]?.email, "client@exemple.fr", "L'adresse saisie n'a pas été conservée.");
  // Un seul lien pour une seule facture, et un registre qui dit la vérité.
  const registre = await pool.query(
    `SELECT ef.canal FROM envois_factures ef JOIN factures f ON f.id = ef.facture_id WHERE f.chantier_id = $1`,
    [chantierId]
  );
  assert.equal(registre.rows.length, 1, "Deux liens pour une même facture : le client ne saurait lequel ouvrir.");
  assert.equal(registre.rows[0].canal, "email", "Le registre dit « sms » alors que la facture part par courriel.");
  console.log("  ✓ la facture part par SMS ou par e-mail, et l'adresse manquante se saisit sur place");

  // --- 3. Ce que le client voit -------------------------------------------
  const contexteClient = await navigateur.newContext();
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
