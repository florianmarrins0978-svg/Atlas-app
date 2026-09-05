// SON MESSAGE AU CLIENT, DE L'ÉCRAN DES RÉGLAGES JUSQU'AU TÉLÉPHONE DU CLIENT.
//
// **Sa demande du 23 août 2026 :** *« y a-t-il un endroit dans les réglages où
// l'utilisateur peut rédiger ce message automatique ? S'il n'y en a pas, il faut
// en créer un. »* Puis ses trois décisions : **A** (dans « Devis & factures »),
// **le lien obligatoire**, et **un seul message pour tous** — « façon 1 », avec
// la phrase du document posée par Atlas.
//
// **CE QUE CETTE SUITE TIENT, ET QU'AUCUNE AUTRE NE VERRAIT.** Les suites de
// `message-client` éprouvent la règle sans base : elles diraient vert même si
// l'écran des réglages n'enregistrait rien, ou si l'écran d'envoi ignorait ce
// qui est enregistré. Ce qui compte, c'est le FIL — il écrit, il envoie, son
// client reçoit ce qu'il a écrit. C'est ce fil-là qui est éprouvé ici, et lui
// seul le traverse en entier.
//
// Usage : npm run test:e2e -- --seulement message-au-client
import assert from "node:assert/strict";
import { Pool } from "pg";
import type { Page } from "playwright";
import { lancerNavigateur } from "./e2e-browser";
import { creerPuisFiche } from "./_creer-chantier-e2e";

const BASE = "http://localhost:3000";
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

/** Son message à lui — reconnaissable entre mille, et qui porte les quatre pastilles. */
const SIEN = [
  "Salut [client] !",
  "",
  "[document]",
  "",
  "[lien]",
  "",
  "Bonne journée, [entreprise] — Eden Nature",
].join("\n");

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

/**
 * Attend que la BASE porte la valeur, jamais un délai fixe.
 *
 * Un `waitForTimeout` suffit à vide et manque sous une batterie entière : c'est
 * le défaut qui a fait rougir cinq suites une batterie sur deux (`TODO.md`
 * 0 trigies quinquies). L'attente sait abandonner et rend la dernière valeur
 * lue, pour que ce soit l'assertion de l'appelant qui accuse, avec son chiffre.
 */
async function attendreEnBase<T>(
  lire: () => Promise<T>,
  tient: (v: T) => boolean,
  msMax = 20_000
): Promise<T> {
  const fin = Date.now() + msMax;
  let dernier = await lire();
  while (!tient(dernier) && Date.now() < fin) {
    await new Promise((r) => setTimeout(r, 200));
    dernier = await lire();
  }
  return dernier;
}

const messageEnBase = async () =>
  (await pool.query<{ message_client: string | null }>(
    `SELECT message_client FROM entreprises ORDER BY created_at LIMIT 1`
  )).rows[0]?.message_client ?? null;

/**
 * Écrit dans le cadre du message — qui est un `contenteditable`, pas un
 * `<textarea>` (`EditeurMessage`, 25 août 2026). On pose le texte et on déclenche
 * l'événement `input` que l'éditeur écoute pour reconstruire le modèle : c'est le
 * chemin réel de la saisie, celui qui finit en base.
 */
async function ecrireMessage(p: Page, texte: string) {
  await p.evaluate((t) => {
    const el = document.querySelector('[data-atlas="message-client"]');
    if (!el) throw new Error("le cadre du message est introuvable");
    el.textContent = t;
    el.dispatchEvent(new InputEvent("input", { bubbles: true }));
  }, texte);
  await p.waitForTimeout(150);
}

async function main() {
  const navigateur = await lancerNavigateur();
  const contexte = await navigateur.newContext();
  const page = await contexte.newPage();

  console.log("=== Son message au client, de bout en bout ===\n");

  await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  await page.fill('input[name="email"]', "demo@atlas.local");
  await page.fill('input[name="password"]', "demo1234");
  await page.click('button[type="submit"]');
  await page.waitForURL(`${BASE}/`, { timeout: 30_000 });

  // ── 1. LE RÉGLAGE EST BIEN LÀ OÙ IL L'A DEMANDÉ : dans « Devis & factures »
  await page.goto(`${BASE}/reglages/documents`, { waitUntil: "networkidle" });
  await page.waitForSelector('[data-atlas="message-client"]', { timeout: 30_000 });

  await cas("le cadre est dans « Devis & factures », pas dans une rubrique à part", async () => {
    // **Sa réponse A**, et il faut la fixer : une rubrique « Mes messages »
    // aurait été la B. Le sommaire ne doit pas en avoir gagné une.
    await page.goto(`${BASE}/reglages`, { waitUntil: "networkidle" });
    const rubriques = await page.evaluate(() =>
      [...document.querySelectorAll("a[href^='/reglages/']")].map((a) => a.getAttribute("href"))
    );
    assert.ok(
      !rubriques.includes("/reglages/messages"),
      "une rubrique « Mes messages » est apparue : c'est la proposition B, qu'il n'a pas retenue"
    );
    await page.goto(`${BASE}/reglages/documents`, { waitUntil: "networkidle" });
    await page.waitForSelector('[data-atlas="message-client"]', { timeout: 30_000 });
  });

  await cas("les pastilles à poser à la main ont disparu — « un simple texte » (25 août)", async () => {
    // **Sa demande du 25 août 2026 : « un simple texte ».** Plus de pastilles à
    // POSER — ce qui s'adapte se MONTRE (les deux aperçus en doré), il ne se
    // place plus au doigt. On fixe le retrait pour qu'un futur lot ne les
    // ramène pas de bonne foi (`CLAUDE.md` §5 bis).
    for (const mot of ["client", "document", "lien", "entreprise"]) {
      assert.equal(
        await page.locator(`[data-atlas="pastille-${mot}"]`).count(),
        0,
        `la pastille « ${mot} » est revenue : il avait demandé « un simple texte »`
      );
    }
    // Les deux aperçus, eux, sont là — c'est par eux qu'il voit ce qui bouge.
    assert.equal(await page.locator('[data-atlas="apercu-devis"]').count(), 1, "l'aperçu du devis manque");
    assert.equal(await page.locator('[data-atlas="apercu-facture"]').count(), 1, "l'aperçu de la facture manque");
  });

  // ── 2. LE LIEN EST OBLIGATOIRE — et c'est un REFUS, pas un avertissement
  await cas("sans le lien, l'écran refuse et le bouton s'éteint", async () => {
    await ecrireMessage(page, "Bonjour [client], voici [document]. [entreprise]");
    const refus = await page.locator('[data-atlas="message-refus"]').innerText();
    assert.ok(/obligatoire/i.test(refus), `le refus ne dit pas que le lien est obligatoire : « ${refus} »`);
    // **Le bouton s'éteint AVEC le message.** Un bouton resté allumé s'appuie,
    // ne fait rien, et l'on croit l'écran cassé.
    assert.equal(
      await page.getByRole("button", { name: "Message incomplet" }).count(),
      1,
      "on peut encore appuyer sur « Enregistrer » avec un message sans lien"
    );
  });

  await cas("et rien n'est parti en base pendant ce temps", async () => {
    // Le refus doit tenir jusqu'à la base : un écran qui refuse et un serveur
    // qui accepte, c'est un message sans lien chez le client.
    assert.equal(await messageEnBase(), null, "un message sans lien a été enregistré");
  });

  // ── 3. SON MESSAGE S'ENREGISTRE
  await cas("son message s'écrit et s'enregistre", async () => {
    await ecrireMessage(page, SIEN);
    assert.equal(
      await page.locator('[data-atlas="message-refus"]').count(),
      0,
      "l'écran refuse un message qui porte pourtant son lien"
    );
    await page.getByRole("button", { name: "Enregistrer" }).click();
    const enBase = await attendreEnBase(messageEnBase, (v) => v === SIEN);
    assert.equal(enBase, SIEN, "le message n'est pas arrivé en base");
  });

  await cas("les deux aperçus, côte à côte, disent chacun le sien", async () => {
    // **Plus de bascule : les deux envois se voient ENSEMBLE** (sa maquette
    // `message-au-client-simple.html`). Le mot change tout seul — c'est ce que
    // la « façon 2 » lui coûtait : une facture qui parle d'un devis, l'échéance
    // perdue. Le compte rendu, lui, n'est pas prévisualisé ici — sa maquette ne
    // montre que devis et facture ; son adaptation reste tenue par la suite pure
    // `test-message-client`.
    const devis = await page.locator('[data-atlas="apercu-devis"]').innerText();
    const facture = await page.locator('[data-atlas="apercu-facture"]').innerText();

    // Le cadre est le sien sur les deux — c'est « un message pour tous ».
    assert.ok(devis.includes("Salut "), `l'aperçu du devis ne porte pas son message : ${devis.slice(0, 60)}`);
    assert.ok(facture.includes("Salut "), `l'aperçu de la facture ne porte pas son message : ${facture.slice(0, 60)}`);
    // Le milieu, lui, s'adapte.
    assert.match(devis, /votre devis/i, "l'aperçu du devis ne se nomme pas");
    assert.match(facture, /votre facture/i, "l'aperçu de la facture ne se nomme pas");
    assert.match(facture, /à régler avant le/i, "l'échéance manque à l'aperçu de la facture");
    assert.doesNotMatch(facture, /votre devis/i, "l'aperçu de la facture parle d'un devis");
  });

  // ── 4. LE FIL ENTIER : ce qu'il a écrit arrive au TÉLÉPHONE du client
  //
  // **C'est le seul contrôle qui prouve le câblage.** Tout le reste pourrait
  // être vert sur une application où l'écran d'envoi ignore le réglage.
  await cas("le devis part avec SON message, pas celui d'Atlas", async () => {
    // **Un client JOIGNABLE, sinon rien ne part.** Sans nom ni numéro, la
    // feuille des dates ne s'ouvre pas — et le rouge accusait alors le
    // calendrier, qui n'y était pour rien. C'est le montage qui était incomplet,
    // pas l'écran (`test-transmission-e2e` monte la même scène).
    await page.goto(`${BASE}/chantiers/nouveau`, { waitUntil: "networkidle" });
    await page.fill('input[placeholder="Bernard"]', `Larousse ${Date.now()}`);
    await page.fill('input[placeholder="06 12 34 56 78"]', "06 79 98 45 14");
    const idChantier = await creerPuisFiche(page);
    await page.waitForURL(/\/chantiers\/[0-9a-f-]{36}/, { timeout: 20_000 });
    const chantierUrl = `${BASE}/chantiers/${idChantier}`;

    await page.goto(`${chantierUrl}/prix`, { waitUntil: "networkidle" });
    await page.click("text=+ Ajouter une ligne");
    await page.waitForTimeout(400);
    const champs = page.locator("form input");
    await champs.nth(0).fill("Taille de haie");
    await champs.nth(1).fill("560.00");
    await champs.nth(1).blur();

    const chantierId = chantierUrl.split("/").pop()!;
    const lignes = await attendreEnBase(
      async () =>
        Number(
          (await pool.query(`SELECT COALESCE(sum(montant), 0)::text AS t FROM lignes_prix WHERE chantier_id = $1`, [chantierId])).rows[0].t
        ),
      (v) => v >= 560
    );
    assert.equal(lignes, 560, `le prix n'a jamais atteint la base (${lignes}) : la suite ne prouverait rien`);

    // **On passe par `/export`, comme `test-transmission-e2e`** : l'adresse
    // renvoie sur le devis depuis le 20 août, et c'est le chemin qu'il emprunte.
    // Et l'on ATTEND le bouton : `networkidle` se résout avant que React ait
    // repris la page, si bien qu'un clic immédiat tombait dans le vide et le
    // rouge accusait la feuille des dates, qui n'y était pour rien.
    await page.goto(`${chantierUrl}/export`, { waitUntil: "networkidle" });
    const choisir = page.getByText("Choisir la date").first();
    await choisir.waitFor({ state: "visible", timeout: 20_000 });
    await choisir.click();
    await page.waitForSelector('[data-atlas="invite-dates"]', { timeout: 20_000 });
    await page.getByRole("button", { name: "Envoyer le devis" }).click();
    await page.waitForURL(new RegExp(`${BASE}/$`), { timeout: 20_000 });

    await page.goto(`${chantierUrl}/export`, { waitUntil: "networkidle" });
    const lien = page.locator("a[data-transmission]");
    await lien.waitFor({ state: "visible", timeout: 20_000 });
    const adresse = decodeURIComponent((await lien.getAttribute("href")) ?? "");

    assert.ok(adresse.length > 0, "aucun lien de transmission : il n'a rien à toucher");
    assert.ok(
      adresse.includes("Salut "),
      `son message n'est pas dans ce qui part au client : « ${adresse.slice(0, 160)} »`
    );
    assert.ok(
      adresse.includes("Bonne journée,"),
      "sa signature n'est pas dans ce qui part au client"
    );
    // **Et la phrase d'Atlas est bien posée à la place de `[document]`** : sans
    // elle, le client recevrait « [document] » en clair.
    assert.ok(
      /votre devis/i.test(adresse),
      `la phrase du document n'a pas été posée : « ${adresse.slice(0, 160)} »`
    );
    assert.ok(!adresse.includes("[document]"), "une pastille est partie en clair chez le client");
    assert.ok(!adresse.includes("[lien]"), "la pastille du lien est partie en clair chez le client");
  });

  await contexte.close();
  await navigateur.close();
  await pool.end();

  console.log(
    echecs === 0
      ? "\n✅ Son message va de l'écran des réglages au téléphone du client."
      : `\n❌ Son message au client — ${echecs} échec(s).`
  );
  if (echecs > 0) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
