import { lancerNavigateur } from "./e2e-browser";
import { devices } from "playwright";
import { pool } from "../src/server/db/client";

// **« Le devis qui tarde » : la carte, et sa ligne dans les réglages.**
//
// ─────────────────────────────────────────────────────────────────────────────
// Le patron, le 14 août 2026 : *« il faudrait créer un rappel lorsque le
// chantier a été ouvert mais le devis n'a pas été envoyé […] comme la Mme
// Félicie, vue il y a quatorze jours, aucun devis envoyé »*.
//
// Puis le 16, devant la planche : *« la B et 4 »* — la carte teintée, avec le
// compte des jours dans l'étiquette, et quatre jours par défaut. Enfin, devant
// le libellé « Devis pas encore parti » : *« j'ai peur que la façon dont tu l'as
// écrit ne soit pas compréhensible »*. Il a retenu **« Chantier sans devis »**.
//
// ─────────────────────────────────────────────────────────────────────────────
// **CE QUE CE CONTRÔLE TIENT, ET QUE `test-rappels-db` NE PEUT PAS VOIR.**
// Celui-là éprouve la règle ; celui-ci éprouve le RACCORD — qu'elle arrive
// jusqu'à l'écran, et sous la forme qu'il a choisie. La règle serait verte même
// si rien n'était branché à l'accueil.
//
//   1. la carte existe, et porte le compte des jours DANS son étiquette ;
//   2. elle est TEINTÉE — sa proposition B, et le seul rappel qui l'est ;
//   3. son geste mène au chantier, là où il peut faire le devis ;
//   4. la ligne des réglages s'appelle « Chantier sans devis », son délai vaut
//      4, et l'écrire le fait tenir ;
//   5. **et le mot ne se confond pas avec sa voisine** — c'est sa crainte du
//      16 août, et c'est le seul contrôle qui la tient.

const BASE = "http://localhost:3000";
const ECRAN_DU_PATRON = devices["iPhone 13"];

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
  console.log("=== Le devis qui tarde : la carte, et sa ligne ===\n");

  const navigateur = await lancerNavigateur();
  const contexte = await navigateur.newContext({ ...ECRAN_DU_PATRON });
  const page = await contexte.newPage();

  await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  await page.fill('input[name="email"]', "demo@atlas.local");
  await page.fill('input[name="password"]', "demo1234");
  await page.click('button[type="submit"]');
  await page.waitForURL(`${BASE}/`, { timeout: 30_000 });

  // Un chantier ouvert il y a quatorze jours, sans devis — le cas exact de sa
  // phrase. `created_at` s'écrit à la main : rien ne l'ouvre côté produit, et
  // c'est très bien ainsi.
  const CLIENT = `Felicie ${Date.now()}`;
  await page.goto(`${BASE}/chantiers/nouveau`, { waitUntil: "networkidle" });
  await page.locator('input[placeholder="Bernard"]').fill(CLIENT);
  await page.locator('input[placeholder="06 12 34 56 78"]').fill("0679984514");
  await page.click('[data-atlas="action-dicter"]');
  await page.waitForURL(/\/chantiers\/[0-9a-f-]{36}/, { timeout: 30_000 });
  const chantierId = page.url().split("/").pop()!.split("?")[0];

  const vieillir = await pool.query(
    `UPDATE chantiers SET created_at = now() - interval '14 days' WHERE id = $1`,
    [chantierId]
  );
  if (vieillir.rowCount !== 1) {
    throw new Error(
      "le montage n'a pas pu vieillir le chantier — sans cela aucune carte n'apparaît, " +
        "et la suite accuserait la carte d'un défaut qui serait le sien (CLAUDE.md §5)"
    );
  }

  await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
  await page.waitForTimeout(500);

  // **L'accueil ne montre que DEUX cartes**, et les rappels ferment la marche
  // (`Notifications.tsx`). Le jeu de démonstration en porte déjà : sans ce
  // dépliage, la suite accuserait la carte d'être absente alors qu'elle est
  // seulement repliée — une erreur qui envoie chercher au mauvais endroit.
  const deplier = page.getByRole("button", { name: /autres? devis à regarder/ });
  if ((await deplier.count()) > 0) {
    await deplier.first().click();
    await page.waitForTimeout(300);
  }

  await cas("la carte est là, et son étiquette porte le compte des jours", async () => {
    const ecran = await page.locator("body").innerText();
    // **Le compte AVANT le nom** : c'est l'autre moitié de sa proposition B.
    if (!/DEVIS EN ATTENTE\s*·\s*14 JOURS/i.test(ecran)) {
      throw new Error(
        "l'étiquette « Devis en attente · 14 jours » manque à l'accueil.\n      " +
          ecran.split("\n").filter((l) => l.trim()).slice(0, 12).join("\n      ")
      );
    }
    if (!ecran.includes(CLIENT)) throw new Error("la carte ne nomme pas le chantier concerné");
  });

  await cas("elle est TEINTÉE — sa proposition B, et elle seule l'est", async () => {
    // **Mesuré à l'écran, pas déduit du code.** Un `urgent` posé dans l'objet
    // ne prouve rien : c'est la couleur rendue qui décide de ce qu'il voit.
    const carte = page.locator(`[data-atlas="carte-reponse"][data-chantier="${chantierId}"]`);
    if ((await carte.count()) === 0) throw new Error("aucune carte pour ce chantier à l'écran");
    if ((await carte.getAttribute("data-atlas-ton")) !== "teinte") {
      throw new Error("la carte n'est pas déclarée teintée : la proposition B n'est pas appliquée");
    }
    // **Et la couleur RENDUE, pas seulement l'intention.** Un attribut posé ne
    // prouve rien : c'est ce que l'œil reçoit qui décide.
    const fond = await carte.evaluate((n) => getComputedStyle(n).backgroundColor);
    const nu = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
    if (fond === nu) throw new Error(`la carte a le fond nu (${fond}) : le ton B ne se voit pas`);
  });

  await cas("son geste mène au chantier, là où le devis se fait", async () => {
    // **Le geste de CETTE carte, pas du premier venu.** Le jeu de démonstration
    // porte lui aussi des chantiers ouverts sans devis — c'est d'ailleurs la
    // preuve que la règle vaut au-delà du montage —, et un `.first()` suivait
    // le rappel d'un autre chantier en passant au vert.
    const carte = page.locator(`[data-atlas="carte-reponse"][data-chantier="${chantierId}"]`);
    const geste = carte.getByRole("link", { name: "Faire le devis" });
    if ((await geste.count()) === 0) throw new Error("« Faire le devis » manque sur la carte");
    await geste.click();
    await page.waitForURL(new RegExp(`/chantiers/${chantierId}$`), { timeout: 30_000 });
  });

  await cas("une carte ne peut pas se reposer à moitié coupée", async () => {
    // **Sa capture du 16 août** : *« le premier message est trop haut et le
    // début n'est pas visible. »* Il avait raison, et la cause n'était pas la
    // carte : le cadre qui défile porte un fondu de 18 px en haut, et il
    // déclarait `scroll-snap-type: y proximity` SANS qu'aucun enfant n'ait
    // jamais déclaré de point d'accroche. La propriété ne faisait rien.
    //
    // Ce contrôle ne juge pas le fondu : il vérifie qu'après un défilement, la
    // carte s'ARRÊTE en dessous de lui — donc que son étiquette et le nom du
    // chantier restent lisibles.
    await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
    await page.waitForTimeout(600);
    const haut = await page.evaluate(async () => {
      const sc = document.querySelector<HTMLElement>(".atlas-fil-defile");
      if (!sc) return { erreur: "cadre introuvable" };
      sc.scrollTo({ top: 70, behavior: "smooth" });
      await new Promise((r) => setTimeout(r, 900));
      const rs = sc.getBoundingClientRect();
      const hauts = [...document.querySelectorAll<HTMLElement>('[data-atlas="carte-reponse"]')]
        .map((c) => Math.round(c.getBoundingClientRect().top - rs.top))
        .filter((y) => y > -40 && y < rs.height);
      return { hauts };
    });
    if ("erreur" in haut) throw new Error(haut.erreur as string);
    const hauts = (haut as { hauts: number[] }).hauts;
    if (hauts.length === 0) throw new Error("aucune carte à l'écran après défilement");
    // **18 px de fondu.** Une carte posée plus haut a son étiquette effacée —
    // c'est-à-dire, pour la sienne, le compte des jours qu'il a demandé.
    const coupees = hauts.filter((y) => y < 18 && y > -40);
    if (coupees.length > 0) {
      throw new Error(
        `une carte s'arrête à ${coupees[0]} px du bord, sous le fondu de 18 px : ` +
          "son étiquette et le nom du chantier sont effacés — le défaut du 16 août"
      );
    }
  });

  await cas("le rappel est PREMIER, et une réponse garde la seconde place", async () => {
    // **Ses deux décisions du 16 août 2026 :** *« fait la B »* — le rappel
    // devant —, puis *« fait le »* — la place garantie, après qu'une photo lui
    // a montré trois chantiers sans devis masquant toutes les réponses.
    //
    // La règle vit dans `src/lib/ordre-notifications.ts` et y est éprouvée sur
    // les cas limites. Ce contrôle-ci tient le RACCORD : que l'écran l'emploie
    // vraiment. Elle serait verte même si personne ne l'appelait.
    await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
    await page.waitForTimeout(600);
    const vus = await page.$$eval('[data-atlas="carte-reponse"]', (cartes) =>
      cartes.map((c) => (/DEVIS EN ATTENTE|Devis sans réponse|À facturer/i.test(c.textContent ?? "")
        ? "rappel"
        : "reponse"))
    );
    if (vus.length === 0) throw new Error("aucune carte à l'écran");
    if (vus[0] !== "rappel") {
      throw new Error(`la première carte est une ${vus[0]} : son choix B n'est pas appliqué`);
    }
    // La garantie ne vaut que si les deux sortes existent : on regarde d'abord
    // ce que l'écran porte en tout, replié compris.
    const deplier = page.getByRole("button", { name: /autres? devis à regarder/ });
    if ((await deplier.count()) > 0) {
      await deplier.first().click();
      await page.waitForTimeout(300);
    }
    const toutes = await page.$$eval('[data-atlas="carte-reponse"]', (cartes) =>
      cartes.map((c) => (/DEVIS EN ATTENTE|Devis sans réponse|À facturer/i.test(c.textContent ?? "")
        ? "rappel"
        : "reponse"))
    );
    if (toutes.includes("reponse") && vus.length > 1 && !vus.includes("reponse")) {
      throw new Error(
        "une réponse de client attend derrière le repli alors qu'une place lui est garantie : " +
          `visible = ${vus.join(", ")} — en tout = ${toutes.join(", ")}`
      );
    }
  });

  // ── La ligne dans les réglages ──────────────────────────────────────────
  await page.goto(`${BASE}/reglages/notifications`, { waitUntil: "networkidle" });
  await page.waitForSelector("text=Ce que vous réglez", { timeout: 30_000 });

  await cas("elle s'appelle « Chantier sans devis », et vaut 4 jours", async () => {
    const ecran = await page.locator("body").innerText();
    if (!ecran.includes("Chantier sans devis")) {
      throw new Error(
        "la ligne « Chantier sans devis » manque des réglages.\n      " +
          ecran.split("\n").filter((l) => l.trim()).slice(0, 16).join("\n      ")
      );
    }
    const champ = page.getByLabel(/Délai du rappel « Chantier sans devis »/);
    if ((await champ.count()) === 0) throw new Error("son délai ne se règle pas");
    if ((await champ.inputValue()) !== "4") {
      throw new Error(`le délai vaut « ${await champ.inputValue()} » au lieu de 4`);
    }
  });

  await cas("aucun réglage ne se confond avec son VOISIN — sa crainte du 16 août", async () => {
    // **Le contrôle qu'il a inspiré, et la règle exacte qu'il décrit.**
    // Sa phrase : la ligne « tombe juste au-dessus » de sa voisine. La confusion
    // naît de la PROXIMITÉ — deux lignes collées qui commencent par le même mot
    // obligent à lire la ligne grise pour les séparer.
    //
    // Comparer toutes les paires serait trop dur et le prouverait : « Chantier
    // sans devis » et « Chantier fini, pas facturé » partagent leur premier mot
    // sans jamais se toucher — une ligne entière les sépare, et leurs sens sont
    // aux deux bouts du chantier. C'est le voisinage qui compte, pas la liste.
    const noms = await page.$$eval('[data-atlas="rappel-nom"]', (e) =>
      e.map((n) => (n.textContent ?? "").trim())
    );
    if (noms.length < 3) throw new Error(`${noms.length} ligne(s) réglable(s) : il en faut trois`);
    for (let i = 1; i < noms.length; i++) {
      const a = noms[i - 1].split(/\s+/)[0].toLowerCase();
      const b = noms[i].split(/\s+/)[0].toLowerCase();
      if (a === b) {
        throw new Error(
          `« ${noms[i - 1]} » et « ${noms[i]} » se touchent et commencent par le même mot — ` +
            "il faut lire la ligne grise pour les séparer, c'est exactement ce qu'il a signalé"
        );
      }
    }
  });

  await cas("le délai écrit tient après rechargement", async () => {
    const champ = page.getByLabel(/Délai du rappel « Chantier sans devis »/);
    await champ.fill("6");
    await page.waitForTimeout(1500);
    await page.reload({ waitUntil: "networkidle" });
    await page.waitForSelector("text=Ce que vous réglez", { timeout: 30_000 });
    const relu = await page.getByLabel(/Délai du rappel « Chantier sans devis »/).inputValue();
    if (relu !== "6") throw new Error(`relu « ${relu} » au lieu de 6 : le réglage ne tient pas`);
  });

  await navigateur.close();
  await pool.end();

  console.log(`\n${echecs === 0 ? "✅" : "❌"} Le devis qui tarde — ${echecs} échec(s).`);
  process.exit(echecs === 0 ? 0 : 1);
}

main().catch(async (e) => {
  console.error(e);
  await pool.end();
  process.exit(1);
});
