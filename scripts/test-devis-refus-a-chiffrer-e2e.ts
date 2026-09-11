import { lancerNavigateur } from "./e2e-browser";
import assert from "node:assert/strict";
import { Pool } from "pg";
import { creerPuisFiche } from "./_creer-chantier-e2e";
import { ADRESSE } from "./_adresse";

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * **LE REFUS « À CHIFFRER » ARRIVE AVANT LA FEUILLE DES DATES, PAS APRÈS.**
 *
 * Sa règle du 27 août 2026 : *« le devis ne doit pas pouvoir être considéré
 * comme prêt à envoyer tant qu'une ligne nécessitant un prix n'est pas
 * chiffrée. »* Elle était tenue — **au dernier moment, et au mauvais endroit** :
 *
 *   1. « Choisir la date » s'ouvrait sans condition ;
 *   2. la feuille d'envoi ne connaît pas ce blocage : elle n'en porte que
 *      quatre (`preparation-envoi.ts`), et celui-là n'en fait pas partie ;
 *   3. il choisissait donc une date, parfois deux, appuyait « Envoyer » — et
 *      **c'est le serveur qui refusait alors** (`envoyerDevis`).
 *
 * Et la phrase du refus l'envoyait où il se tenait déjà : « Posez leur montant
 * sur l'écran du devis, puis revenez ici. » Elle datait du temps où la feuille
 * vivait sur `/export` ; depuis le 20 août, elle s'ouvre depuis le devis.
 *
 * ─── POURQUOI CETTE SUITE ENTRE PAR SA PORTE ───────────────────────────────
 *
 * `test-preparation-devis.ts` éprouve déjà la règle pure, et il est vert depuis
 * le 31 août — **pendant que le chemin du patron, lui, était cassé**. C'est
 * exactement la faute du 28 août (`CLAUDE.md` §5 quater) : des contrôles qui
 * confirment la moitié qu'on vient d'écrire, jamais la porte d'entrée.
 *
 * Celle-ci fait donc ce que LUI fait : elle ouvre l'écran du devis avec une
 * ligne qui attend son prix, et regarde ce que l'écran propose.
 *
 * ─── ELLE SAIT ÉCHOUER ─────────────────────────────────────────────────────
 *
 * Confrontée à l'écran d'avant ce lot, elle rougit sur la première assertion :
 * « Choisir la date » y est présent, et le devis part choisir une date pour se
 * faire refuser au bout. C'est le seul état dégradé qui compte ici.
 *
 * ─── LE DRAPEAU EST POSÉ EN BASE, ET C'EST ASSUMÉ ──────────────────────────
 *
 * `a_chiffrer` ne se lève que par la dictée (`devis-depuis-dictee.ts`,
 * `appliquer-proposition.ts`), qui demande une clé d'IA — et les postes de
 * développement n'en ont aucune (`CLAUDE.md` §1 ter). On reproduit donc
 * l'ÉTAT que la dictée laisse, pas le chemin qui l'y amène : une ligne
 * identifiée, à zéro, avec son drapeau levé. Le chemin de la dictée est
 * éprouvé ailleurs, là où c'est son sujet.
 * ═══════════════════════════════════════════════════════════════════════════
 */

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const BASE = ADRESSE;

async function main() {
  const navigateur = await lancerNavigateur();
  const contexte = await navigateur.newContext();
  const page = await contexte.newPage();

  await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  await page.fill('input[name="email"]', "demo@atlas.local");
  await page.fill('input[name="password"]', "demo1234");
  await page.click('button[type="submit"]');
  await page.waitForURL(`${BASE}/`, { timeout: 15000 });

  await page.goto(`${BASE}/chantiers/nouveau`, { waitUntil: "networkidle" });
  await page.fill('input[placeholder="Bernard"]', `Mme Roux ${Date.now()}`);
  await page.fill('input[placeholder="06 12 34 56 78"]', "0612345678");
  const chantierId = await creerPuisFiche(page);
  const devisUrl = `${BASE}/chantiers/${chantierId}/devis-complet`;

  // --- Une ligne identifiée, pas chiffrée : ce que la dictée produit -------
  await page.waitForSelector("text=DEVIS", { timeout: 15000 });
  await page.click("text=+ Ajouter une ligne");
  await page.waitForTimeout(400);
  await page.getByLabel("Description 1").fill("Dessouchage du frêne");
  await page.getByLabel("Description 1").blur();
  await page.waitForTimeout(600);

  const pose = await pool.query(
    `UPDATE lignes_prix SET a_chiffrer = true, prix_unitaire = '0', montant = '0'
      WHERE chantier_id = $1 RETURNING id`,
    [chantierId]
  );
  assert.equal(pose.rowCount, 1, "La ligne écrite n'est pas arrivée en base : le reste ne mesurerait rien.");

  // --- 1. L'écran refuse AVANT d'ouvrir la feuille ------------------------
  await page.goto(devisUrl, { waitUntil: "networkidle" });
  await page.waitForSelector("text=à chiffrer", { timeout: 15000 });

  const boutonDate = await page.locator("text=Choisir la date").count();
  assert.equal(
    boutonDate,
    0,
    "« Choisir la date » est encore proposé sur un devis dont une ligne attend son prix : " +
      "il va choisir une date, appuyer sur Envoyer, et se faire refuser au bout du chemin."
  );

  const texte = await page.locator("body").innerText();
  assert.ok(
    /attend son prix/i.test(texte),
    `Le refus ne nomme pas sa raison. L'écran dit : « ${texte.slice(0, 200)} »`
  );
  assert.ok(
    /Dessouchage du frêne/i.test(texte),
    "Le refus ne nomme pas LA ligne : sur un devis de dix lignes, il faut chercher laquelle."
  );
  console.log("  ✓ le devis refuse la date tant qu'une ligne attend son prix, et dit laquelle");

  // --- 2. Le refus emmène le doigt sur le champ ---------------------------
  //
  // **Le geste qui débloque, et pas seulement la raison** (`CLAUDE.md`). Un
  // refus qui nomme la ligne sans y mener laisse chercher dans un tableau qui
  // fait plusieurs hauteurs d'écran.
  await page.click("text=Poser le prix");
  await page.waitForTimeout(600);
  const focus = await page.evaluate(() => document.activeElement?.getAttribute("aria-label") ?? "");
  assert.match(
    focus,
    /^Prix unitaire/,
    `« Poser le prix » n'a pas mis le doigt sur le champ du prix : le focus est sur « ${focus} ».`
  );
  console.log("  ✓ « Poser le prix » ouvre le champ de la ligne qui manque");

  // --- 2 bis. LE CHAMP EST VIDE, PAS À ZÉRO ------------------------------
  //
  // **Sa correction du 11 septembre 2026, capture à l'appui :** *« pour le prix
  // unitaire HT il faudrait que lorsque l'on clique il n'y ait rien de
  // réellement écrit quand aucun prix n'est affiché [...] ils doivent être
  // fictifs pour qu'on comprenne qu'on peut écrire dans la case, mais pas
  // vraiment là »*.
  //
  // Le champ portait un `0` RÉEL, venu du zéro que la base met par défaut. Il a
  // tapé 450 derrière, et sa capture montre **0450**. Ce coup-ci le nombre
  // tombait juste ; un zéro de plus au mauvais endroit part chez le client.
  //
  // **C'est ICI que ça se mesure** : le décor de cette suite pose exactement son
  // cas — `a_chiffrer = true`, `prix_unitaire = '0'`.
  const dansLeChamp = await page.getByLabel("Prix unitaire 1").inputValue();
  assert.equal(
    dansLeChamp,
    "",
    `la case du prix porte « ${dansLeChamp} » au lieu d'être vide : ce qu'il tapera se collera derrière`
  );
  console.log("  ✓ une ligne qui attend son prix ouvre une case VIDE, pas un zéro");

  // --- 2 ter. LE CURSEUR ARRIVE AU BOUT DU CHIFFRE ------------------------
  //
  // **Sa seconde correction du même message :** *« quand je clique sur la case
  // de la quantité, je veux que le petit trait qui clignote [...] soit toujours
  // à droite ; comme ça, si la quantité par défaut n'est pas bonne, on a juste à
  // supprimer. Or des fois il se met à gauche. »*
  //
  // **Le « des fois » s'explique, et c'est ce qu'on reproduit :** le champ est
  // aligné à DROITE dans une case large. On appuie donc volontairement dans le
  // VIDE qui précède le chiffre — là où le doigt tombe le plus souvent —, et
  // c'est exactement l'appui qui posait le curseur devant.
  const qte = page.getByLabel("Quantité 1");
  const boite = await qte.boundingBox();
  assert.ok(boite && boite.width > 20, "la case de la quantité est introuvable : rien à mesurer");
  await qte.click({ position: { x: 6, y: boite!.height / 2 } });
  await page.waitForTimeout(250);
  const ou = await qte.evaluate((n) => {
    const champ = n as HTMLInputElement;
    return { curseur: champ.selectionStart, longueur: champ.value.length, valeur: champ.value };
  });
  assert.ok(ou.longueur > 0, "la quantité est vide : le curseur n'a nulle part où se tromper");
  assert.equal(
    ou.curseur,
    ou.longueur,
    `le curseur est retombé en ${ou.curseur} devant « ${ou.valeur} » : il faut le déplacer avant de pouvoir effacer`
  );
  console.log("  ✓ le curseur de la quantité arrive DERRIÈRE le chiffre, même si l'on appuie à gauche");

  // --- 3. Le prix posé, le bouton revient de lui-même ---------------------
  await page.getByLabel("Prix unitaire 1").fill("480");
  await page.getByLabel("Prix unitaire 1").blur();
  await page.waitForSelector("text=Choisir la date", { timeout: 15000 });

  const apres = await page.locator("body").innerText();
  assert.ok(
    !/attend son prix/i.test(apres),
    "Le refus reste affiché alors que le prix est posé : un refus qui ne se lève pas se lit comme une panne."
  );
  console.log("  ✓ le prix posé, « Choisir la date » revient et le refus s'efface");

  await navigateur.close();
  await pool.end();
  console.log("\n✅ Le refus « à chiffrer » arrive avant la feuille des dates.");
}

main().catch(async (e) => {
  console.error(e);
  await pool.end().catch(() => {});
  process.exit(1);
});
