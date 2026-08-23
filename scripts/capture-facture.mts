// Capture de l'écran Facture — les trois manques signalés par le patron.
//
// **Pourquoi ce script existe.** Le 10 août 2026, il photographie son écran de
// facture et relève trois choses (`TODO.md` §8) : impossible de télécharger le
// PDF, le bouton « Ouvrir le SMS tout prêt » est carré, et **on ne lui propose
// que le SMS**. Aucun contrôle ne pouvait voir les deux premiers : ils ne se
// lisent pas, ils se regardent. Ce script les regarde, et rend la planche qui
// se montre au patron.
//
// **Il sait échouer** : chaque défaut retrouvé fait sortir le script en 1, avec
// sa phrase. Un contrôle qui n'a jamais échoué ne prouve rien (`AGENTS.md`).
//
// `localhost`, jamais `127.0.0.1` : Next refuse ses ressources de développement
// à une origine étrangère, et la page n'arrive alors jamais hydratée.
import { mkdirSync } from "node:fs";
import { lancerNavigateur } from "./e2e-browser";
import { Pool } from "pg";
import { creerPuisFiche } from "./_creer-chantier-e2e";

const dossier = process.argv[2];
if (!dossier) {
  console.error("usage: capture-facture.mts <dossier>");
  process.exit(1);
}
mkdirSync(dossier, { recursive: true });

const BASE = "http://localhost:3000";
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const echecs: string[] = [];

const navigateur = await lancerNavigateur();
const contexte = await navigateur.newContext();
const page = await contexte.newPage();

// Le client naît avec un NUMÉRO et sans adresse : c'est très exactement le cas
// du patron, celui où l'ancien écran n'offrait aucune issue.
const client = `Client facture ${Date.now()}`;

await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
await page.fill('input[name="email"]', "demo@atlas.local");
await page.fill('input[name="password"]', "demo1234");
await page.click('button[type="submit"]');
await page.waitForURL(`${BASE}/`, { timeout: 60_000 });

await page.goto(`${BASE}/chantiers/nouveau`, { waitUntil: "networkidle" });
await page.fill('input[placeholder="Bernard"]', client);
await page.fill('input[placeholder="06 12 34 56 78"]', "0612345678");
await creerPuisFiche(page);
await page.waitForURL(/\/chantiers\/[0-9a-f-]{36}/, { timeout: 30_000 });
const chantierId = page.url().split("/").pop()!;

// Un devis chiffré, envoyé, accepté : la facture ne naît que d'un chantier
// réellement mené (arrêt 3, `docs/AGENT.md` §2.3).
await page.goto(`${BASE}/chantiers/${chantierId}/devis-complet`, { waitUntil: "networkidle" });
await page.waitForSelector("text=Total TTC", { timeout: 40_000 });
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
await page.waitForTimeout(2500);

const jetonDevis = (
  await pool.query(
    `SELECT e.jeton FROM envois_devis e JOIN devis d ON d.id = e.devis_id WHERE d.chantier_id = $1`,
    [chantierId]
  )
).rows[0].jeton;
await page.goto(`${BASE}/devis/${jetonDevis}`, { waitUntil: "networkidle" });
await page.locator('input[name="choixDate"]').first().check();
await page.click('button:has-text("J\'accepte ce devis")');
await page.waitForSelector("text=Votre artisan est prévenu", { timeout: 30_000 });

// ─── L'écran Facture ────────────────────────────────────────────────────────
await page.goto(`${BASE}/chantiers/${chantierId}/facture`, { waitUntil: "networkidle" });
await page.getByRole("button", { name: /Créer la facture/i }).first().click();
await page.waitForTimeout(2500);

/** Ce que l'œil voit, mesuré plutôt que supposé. */
async function sonder(quoi: string) {
  const e = (await page.evaluate(`(() => ({
    debordement: document.documentElement.scrollWidth > window.innerWidth + 1,
    texte: document.body.innerText.replace(/\\s+/g, " ").trim(),
  }))()`)) as { debordement: boolean; texte: string };
  if (e.debordement) echecs.push(`${quoi} : la page déborde latéralement.`);
  return e;
}

// ─── 1. Le lien de téléchargement ───────────────────────────────────────────
await page.evaluate(() => document.fonts.ready);
await page.waitForTimeout(400);
await sonder("brouillon");
await page.screenshot({ path: `${dossier}/facture-1-brouillon.png`, fullPage: true });

const telechargement = page.locator("[data-atlas='telecharger-facture']");
if ((await telechargement.count()) !== 1) {
  echecs.push("aucun lien de téléchargement sous « Voir la facture en PDF ».");
} else {
  const href = (await telechargement.getAttribute("href")) ?? "";
  const nomPropose = (await telechargement.getAttribute("download")) ?? "";
  const libelle = (await telechargement.innerText()).trim();
  console.log(`  téléchargement — href=${href} download=${nomPropose} libellé=« ${libelle} »`);
  if (!href.includes("telecharger=1")) {
    echecs.push("le lien de téléchargement n'appelle pas `?telecharger=1` : le PDF s'ouvrirait au lieu d'être rangé.");
  }
  if (!/^F\d{4}-\d{4}(-brouillon)?\.pdf$/.test(nomPropose)) {
    echecs.push(`le fichier proposé s'appelle « ${nomPropose} » : le patron en aura des centaines dans le même dossier.`);
  }
  if (!libelle.includes(nomPropose)) {
    echecs.push(`l'écran annonce « ${libelle} » et rangerait « ${nomPropose} » : il ne retrouvera pas le fichier.`);
  }
  // Ce que le SERVEUR répond, et non ce que le lien promet : l'attribut
  // `download` est ignoré par certaines versions d'iOS, et c'est l'en-tête qui
  // décide alors. Le contrôle porte donc là où la décision se prend.
  const reponse = await page.request.get(`${BASE}${href}`);
  const remise = reponse.headers()["content-disposition"] ?? "";
  console.log(`  le serveur répond — ${reponse.status()} · ${remise}`);
  if (!remise.startsWith("attachment")) {
    echecs.push(`le serveur répond « ${remise} » : le PDF s'ouvre au lieu de se ranger.`);
  }
  if (!remise.includes(".pdf") || !/F\d{4}-\d{4}/.test(remise)) {
    echecs.push(`le fichier servi ne porte pas le numéro de facture : « ${remise} »`);
  }
  // **Les deux noms doivent coïncider.** L'attribut `download` du lien et
  // l'en-tête du serveur sont écrits à deux endroits, et rien dans le code ne
  // les relie : sans ce contrôle, ils divergeraient en silence — et le patron
  // trouverait dans son dossier un nom que l'écran ne lui avait pas annoncé.
  if (!remise.includes(`filename="${nomPropose}"`)) {
    echecs.push(`l'écran propose « ${nomPropose} » et le serveur range « ${remise} ».`);
  }
  // Et l'aperçu, lui, doit continuer de s'ouvrir : la nouveauté ne remplace pas
  // l'ancien geste, elle s'ajoute à côté.
  const apercu = await page.request.get(`${BASE}${href.replace("?telecharger=1", "")}`);
  const remiseApercu = apercu.headers()["content-disposition"] ?? "";
  if (!remiseApercu.startsWith("inline")) {
    echecs.push(`« Voir la facture en PDF » ne s'ouvre plus : « ${remiseApercu} »`);
  }
}

// ─── 2. La facture arrêtée, et l'envoi ──────────────────────────────────────
const confirmer = page.getByRole("button", { name: /Confirmer le départ/i });
if (await confirmer.count()) {
  await confirmer.first().click();
  await page.waitForTimeout(3000);
}
await page.screenshot({ path: `${dossier}/facture-2-arretee.png`, fullPage: true });

await page.getByRole("button", { name: /Envoyer la facture au client/i }).first().click();
const lienSms = page.locator("a[data-atlas='transmission-sms']");
await lienSms.waitFor({ state: "visible", timeout: 30_000 }).catch(() => undefined);
await page.waitForTimeout(500);
await page.screenshot({ path: `${dossier}/facture-3-sms.png`, fullPage: true });

if ((await lienSms.count()) !== 1) {
  echecs.push("le message SMS tout prêt n'est pas proposé.");
} else {
  const adresse = (await lienSms.getAttribute("href")) ?? "";
  if (!adresse.startsWith("sms:")) echecs.push(`adresse inattendue pour le SMS : ${adresse}`);

  // **La capsule, et non un aplat repeint sur place** — son choix du 12 août
  // (maquette 31, variante A). Ce bouton était le dernier de l'écran dessiné à
  // la main, et c'est ce qui lui avait fait manquer la décision du 11 août.
  const forme = await lienSms.evaluate((el) => {
    const s = getComputedStyle(el);
    const r = el.getBoundingClientRect();
    return {
      rayon: parseFloat(s.borderTopLeftRadius),
      hauteur: Math.round(r.height),
      largeur: Math.round(r.width),
      fond: s.backgroundColor,
    };
  });
  console.log(`  la capsule — ${JSON.stringify(forme)}`);
  if (forme.rayon <= 20) {
    echecs.push(`le bouton est revenu carré : rayon de ${forme.rayon} px au lieu d'une capsule.`);
  }
  if (forme.hauteur < 44) {
    echecs.push(`le bouton fait ${forme.hauteur} px de haut : sous 44, le doigt le rate deux fois sur trois.`);
  }
}

// ─── 3. « On ne propose que le SMS » — la bascule ───────────────────────────
const bascule = page.locator("[data-bascule-canal='email']");
if ((await bascule.count()) !== 1) {
  echecs.push("l'écran ne propose pas d'envoyer la facture par e-mail : c'est le manque le plus grave du §8.");
} else {
  await bascule.click();
  await page.waitForTimeout(900);
  const etat = await sonder("bascule e-mail");
  await page.screenshot({ path: `${dossier}/facture-4-email-sans-adresse.png`, fullPage: true });

  // Ce client n'a pas d'adresse : l'écran doit OFFRIR DE LEVER ce qui l'arrête,
  // jamais renvoyer vers une fiche client qui n'existe pas (`HANDOVER.md`).
  if (!/n'a pas d'adresse e-mail enregistrée/.test(etat.texte)) {
    echecs.push("l'écran ne dit pas que l'adresse manque.");
  }
  const champ = page.getByLabel("Adresse e-mail");
  if ((await champ.count()) !== 1) {
    echecs.push("l'adresse manquante ne peut se saisir nulle part : le patron est de nouveau bloqué.");
  } else {
    await champ.fill("client@exemple.fr");
    await page.waitForTimeout(300);
    await page.screenshot({ path: `${dossier}/facture-5-email-saisie.png`, fullPage: true });
    await page.getByRole("button", { name: /Enregistrer et ouvrir le message/i }).click();
    await page.waitForTimeout(2500);
    await page.screenshot({ path: `${dossier}/facture-6-email-pret.png`, fullPage: true });

    const lienMail = page.locator("a[data-atlas='transmission-email']");
    if ((await lienMail.count()) !== 1) {
      echecs.push("après saisie de l'adresse, le message e-mail tout prêt n'apparaît pas.");
    } else {
      const adresse = (await lienMail.getAttribute("href")) ?? "";
      console.log(`  e-mail — ${adresse.slice(0, 90)}…`);
      if (!adresse.startsWith("mailto:client%40exemple.fr") && !adresse.startsWith("mailto:client@exemple.fr")) {
        echecs.push(`l'e-mail s'ouvrirait sur un mauvais destinataire : ${adresse.slice(0, 60)}`);
      }
      if (!/subject=/.test(adresse)) echecs.push("l'e-mail part sans objet.");
    }

    // La coordonnée est écrite SUR LE CLIENT, pas retenue pour cet envoi seul :
    // la ressaisir au chantier suivant serait le même geste perdu deux fois.
    const enBase = await pool.query(
      `SELECT c.email, c.canal_communication FROM clients c
         JOIN chantiers ch ON ch.client_id = c.id WHERE ch.id = $1`,
      [chantierId]
    );
    console.log(`  la fiche du client — ${JSON.stringify(enBase.rows[0])}`);
    if (enBase.rows[0]?.email !== "client@exemple.fr") {
      echecs.push("l'adresse saisie n'a pas été conservée sur la fiche du client.");
    }

    // Le registre doit dire par où la facture est réellement partie.
    const envoi = await pool.query(
      `SELECT ef.canal FROM envois_factures ef JOIN factures f ON f.id = ef.facture_id
        WHERE f.chantier_id = $1`,
      [chantierId]
    );
    console.log(`  le registre d'envoi — ${JSON.stringify(envoi.rows)}`);
    if (envoi.rows.length !== 1) {
      echecs.push(`${envoi.rows.length} lien(s) pour une seule facture : le client ne saurait plus lequel ouvrir.`);
    } else if (envoi.rows[0].canal !== "email") {
      echecs.push("le registre dit « sms » alors que la facture part par courriel.");
    }
  }
}

await contexte.close();
await navigateur.close();
await pool.end();

if (echecs.length) {
  console.log(`\n✗ ${echecs.length} défaut(s) :`);
  for (const e of echecs) console.log(`   — ${e}`);
  process.exit(1);
}
console.log(`\n✅ La facture se télécharge, et part par SMS OU par e-mail. Captures dans ${dossier}`);
