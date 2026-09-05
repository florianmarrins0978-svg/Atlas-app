import type { BrowserContext, Page } from "playwright";
import { lancerNavigateur } from "./e2e-browser";
import { pool } from "../src/server/db/client";
import { creerPuisFiche } from "./_creer-chantier-e2e";

// **« Facture impayée » : la carte, son montant, et son « J'ai vu ».**
//
// ─────────────────────────────────────────────────────────────────────────────
// Le patron, le 16 août 2026, devant la maquette
// (`maquettes/atlas-rappel-facture-impayee.html`, cinq écrans) :
//
//   · sur le point de départ du compte : ***« faut faire a plus b »*** — le
//     délai de paiement quand il est réglé, le jour de l'envoi sinon ;
//   · sur la répétition : ***« il faut également qu'on puisse régler, par
//     exemple, je veux un rappel toutes les semaines ou tous les quinze jours,
//     mais pas qu'il y ait la notification tous les jours »***.
//
// ─────────────────────────────────────────────────────────────────────────────
// **CE QUE CE CONTRÔLE TIENT, ET QUE LES DEUX AUTRES NE PEUVENT PAS VOIR.**
// `test-rappels.ts` éprouve la règle sans base ; `test-rappels-db.ts` l'éprouve
// contre la base. Ni l'un ni l'autre ne sait si quoi que ce soit arrive
// jusqu'à l'écran : les deux seraient verts sur une application où rien n'est
// branché à l'accueil.
//
//   1. la carte paraît, et **elle porte le montant** — ce qu'il cherche ;
//   2. son geste mène à l'endroit où l'on solde, pas à la facture figée ;
//   3. **« J'ai vu » fait taire le rappel** — la carte s'en va, la date part
//      en base, et elle ne revient pas au rechargement ;
//   4. le réglage existe, avec **trois rythmes et trois seulement** — une case
//      de saisie rouvrirait le « tous les jours » qu'il a exclu ;
//   5. et le rythme choisi **tient après rechargement**.

const BASE = "http://localhost:3000";

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

/** Une écriture de montage. Elle DOIT toucher sa ligne, sinon la suite accuserait
 *  l'écran d'un défaut qui serait le sien (`CLAUDE.md` §5). */
async function monter(sql: string, params: unknown[], attendu = 1) {
  const r = await pool.query(sql, params);
  if (r.rowCount !== attendu) {
    throw new Error(
      `Montage : ${r.rowCount} ligne(s) au lieu de ${attendu} — « ${sql.slice(0, 60)}… ». ` +
        "Le rôle de test ne traverse probablement plus RLS."
    );
  }
  return r;
}

async function seConnecter(contexte: BrowserContext): Promise<Page> {
  const page = await contexte.newPage();
  await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  await page.fill('input[name="email"]', "demo@atlas.local");
  await page.fill('input[name="password"]', "demo1234");
  await page.click('button[type="submit"]');
  await page.waitForURL(`${BASE}/`, { timeout: 30_000 });
  return page;
}

/** Un chantier chiffré, devis parti, chantier fait — l'état d'où part une facture. */
async function chantierFacturable(page: Page): Promise<string> {
  await page.goto(`${BASE}/chantiers/nouveau`, { waitUntil: "networkidle" });
  await page.fill('input[placeholder="Bernard"]', `Impaye ${Date.now()}`);
  await page.fill('input[placeholder="06 12 34 56 78"]', "06 12 34 56 78");
  const chantierId = await creerPuisFiche(page);
  // L'adresse se bâtit sur l'identifiant rendu : la relire dans le navigateur
  // donnait « devis-complet » depuis que la fiche du chantier est retirée
  // (`ARCHITECTURE.md` §254).
  const url = `${BASE}/chantiers/${chantierId}`;

  await page.goto(`${url}/prix`, { waitUntil: "networkidle" });
  await page.click("text=+ Ajouter une ligne");
  await page.waitForTimeout(300);
  const champs = page.locator("form input");
  await champs.nth(0).fill("Abattage");
  await champs.nth(1).fill("1200.00");
  await champs.nth(1).blur();
  await page.waitForTimeout(600);

  await page.goto(`${url}/devis-complet`, { waitUntil: "networkidle" });
  await page.click("text=Choisir la date");
  await page.waitForSelector('[data-atlas="invite-dates"]', { timeout: 30_000 });
  await page.getByRole("button", { name: "Envoyer le devis" }).click();
  await page.waitForURL(/localhost:3000\/$/, { timeout: 30_000 }); // L'envoi ramène à L'ACCUEIL depuis le 21 août 2026 : c'est lui, le signal.

  await monter("UPDATE chantiers SET date_planifiee = CURRENT_DATE - 3 WHERE id = $1", [chantierId]);

  await page.goto(`${BASE}/chantiers/${chantierId}/facture`, { waitUntil: "networkidle" });
  await page.click("text=Créer la facture");
  await page.waitForSelector("text=Rien n'a changé depuis le devis ?", { timeout: 30_000 });
  // **UN SEUL APPUI depuis le 22 août 2026** : ce bouton arrête la facture ET
  // ouvre la messagerie (`ARCHITECTURE.md` §152). Repéré par son `data-atlas`,
  // jamais par son libellé — c'est le libellé qui a changé.
  await page.click('[data-atlas="envoyer-la-facture"]');
  await page.waitForSelector("text=arrêtée", { timeout: 30_000 });
  // **Et l'on attend que le GESTE SOIT FINI, pas seulement l'arrêt.** Depuis le
  // geste unique du 22 août 2026, « arrêtée » s'affiche AVANT que le lien du
  // client soit préparé — et cette préparation date le chantier de l'instant.
  // Une suite qui antidate entre les deux voit son écriture écrasée, puis
  // accuse l'accueil de ne pas poser la carte (`ARCHITECTURE.md` §152).
  await page.waitForSelector("a[data-transmission-directe]", { state: "attached", timeout: 30_000 });
  return chantierId;
}

/** Déplie l'accueil : il ne pose que deux cartes, et le jeu de démonstration en porte. */
async function deplier(page: Page) {
  const bouton = page.getByRole("button", { name: /autres? devis à regarder/ });
  if ((await bouton.count()) > 0) {
    await bouton.first().click();
    await page.waitForTimeout(300);
  }
}

async function main() {
  console.log("=== La facture impayée : la carte, et son rythme ===\n");

  const navigateur = await lancerNavigateur();
  // Son écran : c'est sur un téléphone qu'il regarde ses impayés.
  const contexte = await navigateur.newContext({ viewport: { width: 390, height: 664 } });
  const page = await seConnecter(contexte);

  const chantierId = await chantierFacturable(page);

  // **Le cas « A » de sa réponse, et il est monté explicitement.** Un délai de
  // trente jours, une facture partie il y a soixante : l'échéance est dépassée
  // de trente jours. Compter depuis l'ENVOI donnerait le même verdict ici, mais
  // le montage dit lequel des deux est éprouvé — une autre suite peut avoir
  // laissé l'entreprise de démonstration sans délai.
  await monter("UPDATE entreprises SET delai_paiement_jours = 30 WHERE id = (SELECT entreprise_id FROM chantiers WHERE id = $1)", [chantierId]);
  await monter(
    "UPDATE chantiers SET facture_envoyee_at = now() - interval '60 days' WHERE id = $1",
    [chantierId]
  );

  const carte = page.locator(`[data-atlas="carte-reponse"][data-chantier="${chantierId}"]`);

  await cas("la carte paraît, et elle porte le MONTANT dû", async () => {
    await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
    await deplier(page);
    if ((await carte.count()) === 0) {
      const ecran = await page.locator("body").innerText();
      throw new Error(
        "aucune carte pour cette facture à l'accueil.\n      " +
          ecran.split("\n").filter((l) => l.trim()).slice(0, 14).join("\n      ")
      );
    }
    const texte = await carte.innerText();
    if (!/Facture impayée/i.test(texte)) throw new Error(`l'étiquette manque : « ${texte} »`);
    // **Le montant, et pas seulement le mot.** Une carte qui dirait « impayée »
    // sans la somme l'obligerait à ouvrir la facture pour savoir combien
    // réclamer — le geste que ce rappel existe pour éviter.
    if (!/1\s*440/.test(texte.replace(/ | /g, " "))) {
      throw new Error(`le montant dû (1 440,00 €) n'est pas sur la carte : « ${texte} »`);
    }
  });

  await cas("son geste mène là où l'on solde, pas à la facture figée", async () => {
    // Ouvrir la facture ne servirait à rien : elle est immuable. Le geste
    // attendu — noter le règlement — se fait dans l'endroit en attente.
    const geste = carte.getByRole("link", { name: /Marquer payée|Noter un règlement/ });
    if ((await geste.count()) === 0) throw new Error("le geste manque sur la carte");
    await geste.click();
    await page.waitForURL(/\/termines\/tva/, { timeout: 30_000 });
  });

  // **Le mot est « J'ai vu » depuis le 30 août 2026** — le même sur les quatre
  // cartes, à sa demande. La mécanique dessous n'a pas bougé : le rappel se
  // tait le temps du rythme réglé, et la facture reste dans l'endroit en
  // attente. Nommer ce geste « Plus tard » ici et « J'ai vu » deux cartes plus
  // bas faisait chercher une différence qui n'existe pas.
  await cas("« J'ai vu » fait taire le rappel, et la date part en base", async () => {
    await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
    await deplier(page);
    const plusTard = carte.getByRole("button", { name: "J'ai vu" });
    if ((await plusTard.count()) === 0) throw new Error("« J'ai vu » manque sur la carte");
    await plusTard.click();
    // La carte part de l'écran sans attendre le serveur : le geste est fait.
    await carte.waitFor({ state: "detached", timeout: 15_000 });

    // **Et elle ne revient pas au rechargement** — c'est la seule preuve que le
    // serveur a retenu quelque chose. Une carte retirée côté écran seulement
    // reviendrait à la première visite, et il croirait le geste sans effet.
    await page.waitForTimeout(800);
    const { rows } = await pool.query(
      "SELECT rappel_facture_repousse_le AS jour FROM chantiers WHERE id = $1",
      [chantierId]
    );
    if (!rows[0]?.jour) throw new Error("rien n'est écrit en base : le geste n'a pas porté");

    await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
    await deplier(page);
    if ((await carte.count()) !== 0) {
      throw new Error("la carte revient au rechargement : « J'ai vu » n'a fait taire que l'écran");
    }
  });

  // ── La ligne dans les réglages ──────────────────────────────────────────
  await cas("le réglage existe, et son délai se compte APRÈS L'ÉCHÉANCE", async () => {
    await page.goto(`${BASE}/reglages/notifications`, { waitUntil: "networkidle" });
    await page.waitForSelector("text=Ce que vous réglez", { timeout: 30_000 });
    const ecran = await page.locator("body").innerText();
    if (!ecran.includes("Facture impayée")) {
      throw new Error(
        "la ligne « Facture impayée » manque des réglages.\n      " +
          ecran.split("\n").filter((l) => l.trim()).slice(0, 20).join("\n      ")
      );
    }
    // Le « A plus B » se lit à l'écran, ou il ne se lit nulle part : un délai
    // sans son point de départ se comprend comme partant de l'envoi.
    if (!/après l'échéance/i.test(ecran)) {
      throw new Error("le délai ne dit pas d'où il compte : « après l'échéance » manque");
    }
  });

  await cas("« 1 jour », pas « 1 jours » — vu sur la capture, par aucun test", async () => {
    // **Le défaut de ce rappel vaut UN**, c'est donc la première chose qu'il lit
    // sur cette ligne. La faute était à l'écran et la batterie était verte : la
    // cinquième fois dans ce dépôt qu'un défaut sort d'une image.
    const champ = page.getByLabel(/Délai du rappel « Facture impayée »/);
    // **L'unité se lit sur SON repère, pas dans le texte de la page.** Un
    // `<input>` ne figure pas dans `innerText` : la première version de ce
    // contrôle cherchait « 1 jours » dans la page entière et ne pouvait jamais
    // le trouver — verte sur l'écran fautif, elle ne mesurait rien.
    const unite = page.locator('[data-atlas="rappel-unite"]').last();

    await champ.fill("1");
    await page.waitForTimeout(1200);
    if ((await champ.inputValue()) !== "1") throw new Error("le délai n'a pas pris la valeur 1");
    const un = (await unite.innerText()).trim();
    if (un !== "jour après l'échéance") {
      throw new Error(`l'écran écrit « 1 ${un} » : le singulier est attendu`);
    }

    // Et le pluriel revient dès deux : un singulier posé partout serait l'autre
    // faute, et elle ne se verrait qu'à l'usage.
    await champ.fill("5");
    await page.waitForTimeout(1200);
    const cinq = (await unite.innerText()).trim();
    if (cinq !== "jours après l'échéance") {
      throw new Error(`l'écran écrit « 5 ${cinq} » : le pluriel est attendu`);
    }

    await champ.fill("1");
    await page.waitForTimeout(1200);
  });

  await cas("trois rythmes, et trois seulement — jamais une case à remplir", async () => {
    // **Sa phrase du 16 août, mot pour mot : « mais pas qu'il y ait la
    // notification tous les jours ».** Une case de saisie rouvrirait ce qu'il a
    // exclu ; les trois pastilles le ferment.
    const pastilles = page.locator("[data-rythme]");
    const n = await pastilles.count();
    if (n !== 3) throw new Error(`${n} rythme(s) proposé(s) au lieu de trois`);
    const libelles = await pastilles.allInnerTexts();
    for (const attendu of ["Chaque jour", "Chaque semaine", "Tous les 15 jours"]) {
      if (!libelles.some((l) => l.trim() === attendu)) {
        throw new Error(`« ${attendu} » manque parmi « ${libelles.join(" · ")} »`);
      }
    }
    const pris = page.locator('[data-rythme][aria-pressed="true"]');
    if ((await pris.count()) !== 1) {
      throw new Error(`${await pris.count()} rythme(s) marqué(s) comme choisi(s) : il en faut un`);
    }
  });

  await cas("le rythme choisi tient après rechargement", async () => {
    await page.locator('[data-rythme="15"]').click();
    await page.waitForTimeout(1500);
    await page.reload({ waitUntil: "networkidle" });
    await page.waitForSelector("text=Ce que vous réglez", { timeout: 30_000 });
    const pris = await page.locator('[data-rythme][aria-pressed="true"]').getAttribute("data-rythme");
    if (pris !== "15") throw new Error(`relu « ${pris} » au lieu de 15 : le rythme ne tient pas`);
    // Remis à sa valeur d'origine : les suites se jouent l'une après l'autre sur
    // la même entreprise, et un réglage laissé de travers piégerait la suivante.
    await page.locator('[data-rythme="7"]').click();
    await page.waitForTimeout(1000);
  });

  await navigateur.close();
  await pool.end();

  console.log(`\n${echecs === 0 ? "✅" : "❌"} La facture impayée — ${echecs} échec(s).`);
  process.exit(echecs === 0 ? 0 : 1);
}

main().catch(async (e) => {
  console.error(e);
  await pool.end();
  process.exit(1);
});
