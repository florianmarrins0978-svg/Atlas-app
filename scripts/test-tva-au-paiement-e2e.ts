import assert from "node:assert";
import type { BrowserContext, Page } from "playwright";
import { lancerNavigateur } from "./e2e-browser";
import { avecCivilite } from "../src/lib/civilite";
import { pool } from "../src/server/db/client";
import { creerPuisFiche } from "./_creer-chantier-e2e";

// **« Est-ce qu'il y a une possibilité pour que la facture rentre au relevé de
// TVA seulement une fois que le client m'a payé ? »** — le patron, le 14 août
// 2026. Puis, sur la forme : *« elle arrive dans un endroit en attente, et
// lorsque j'ai reçu le paiement, je clique sur valider et boum. »*
//
// Les règles sont éprouvées sans navigateur (`test-exigibilite-tva.ts`), le
// parcours en base aussi (`test-paiements-facture-db.ts`). Ce que CETTE suite
// tient, et qu'aucune des deux ne peut tenir :
//
//   · **la facture arrêtée ne dit plus qu'elle figure au relevé.** Elle le
//     disait, et c'était faux depuis ce lot : il aurait cherché dans son relevé
//     un montant qui n'y est pas, et douté de l'application ;
//   · **l'endroit en attente existe, et porte le geste** — « Payée », d'un
//     doigt, exactement ce qu'il a décrit ;
//   · **le relevé bouge du bon montant** quand il valide, et pas avant.

const BASE = "http://localhost:3000";

async function inspecter(sql: string, params: unknown[], attendu?: number) {
  const r = await pool.query(sql, params);
  if (attendu !== undefined && r.rowCount !== attendu) {
    throw new Error(
      `Inspection hors application : ${r.rowCount} ligne(s) au lieu de ${attendu}. ` +
        "Le rôle de test ne traverse probablement plus RLS."
    );
  }
  return r;
}

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

/** Un chantier réalisé, devis envoyé, daté dans le passé — comme lui. */
async function chantierRealise(page: Page, suffixe: string) {
  await page.goto(`${BASE}/chantiers/nouveau`, { waitUntil: "networkidle" });
  const client = `M. Bernard ${suffixe} ${Date.now()}`;
  await page.fill('input[placeholder="Bernard"]', client);
  await page.fill('input[placeholder="06 12 34 56 78"]', "06 12 34 56 78");
  await creerPuisFiche(page);
  await page.waitForURL(/\/chantiers\/[0-9a-f-]{36}/, { timeout: 10000 });
  const url = page.url();
  const chantierId = url.split("/").pop()!;

  await page.goto(`${url}/prix`, { waitUntil: "networkidle" });
  await page.click("text=+ Ajouter une ligne");
  await page.waitForTimeout(300);
  const champs = page.locator("form input");
  await champs.nth(0).fill("Main d'œuvre");
  await champs.nth(1).fill("1000.00");
  await champs.nth(1).blur();
  await page.waitForTimeout(500);

  await page.goto(`${url}/devis-complet`, { waitUntil: "networkidle" });
  await page.click("text=Choisir la date");
  await page.waitForSelector('[data-atlas="invite-dates"]', { timeout: 10000 });
  await page.getByRole("button", { name: "Envoyer le devis" }).click();
  await page.waitForURL(/localhost:3000\/$/, { timeout: 15000 }); // L'envoi ramène à L'ACCUEIL depuis le 21 août 2026 : c'est lui, le signal.

  await inspecter("UPDATE chantiers SET date_planifiee = CURRENT_DATE - 3 WHERE id = $1", [chantierId], 1);
  return { chantierId, nom: avecCivilite(client) };
}

/** Émet la facture du chantier, et rend son numéro. */
async function emettre(page: Page, chantierId: string): Promise<string> {
  await page.goto(`${BASE}/chantiers/${chantierId}/facture`, { waitUntil: "networkidle" });
  await page.click("text=Créer la facture");
  await page.waitForSelector("text=Rien n'a changé depuis le devis ?", { timeout: 15000 });
  // **UN SEUL APPUI depuis le 22 août 2026** : ce bouton arrête la facture ET
  // ouvre la messagerie (`ARCHITECTURE.md` §147). Repéré par son `data-atlas`,
  // jamais par son libellé — c'est le libellé qui a changé.
  await page.click('[data-atlas="envoyer-la-facture"]');
  await page.waitForSelector("text=arrêtée", { timeout: 15000 });
  const { rows } = await inspecter(
    "SELECT numero_commercial FROM factures WHERE chantier_id = $1",
    [chantierId],
    1
  );
  return rows[0].numero_commercial as string;
}

/** Le montant « Collectée » que l'écran annonce, en euros. */
async function collectee(page: Page): Promise<number> {
  const texte = await page.locator("body").innerText();
  const m = texte.match(/COLLECTÉE\s*\n?\s*([\d\s   ,.]+)\s*€/i);
  assert.ok(m, `Le montant collecté est introuvable. Lu : « ${texte.slice(0, 200)} »`);
  return Number(m[1].replace(/[\s   ]/g, "").replace(",", "."));
}

async function main() {
  const navigateur = await lancerNavigateur();
  // Son écran : c'est sur un téléphone qu'il note ses règlements.
  const contexte = await navigateur.newContext({ viewport: { width: 390, height: 664 } });
  const page = await seConnecter(contexte);

  // Le régime de l'entreprise de démonstration est remis au défaut : une autre
  // suite a pu le basculer, et cette suite éprouve les encaissements.
  await inspecter("UPDATE entreprises SET tva_exigibilite = 'encaissements'", []);

  await test("la facture arrêtée NE DIT PLUS qu'elle figure au relevé", async () => {
    // Elle le disait, et c'était faux : il aurait cherché un montant absent de
    // son relevé, et douté de l'application plutôt que de noter son paiement.
    const { chantierId } = await chantierRealise(page, "dit");
    await emettre(page, chantierId);
    const ecran = await page.locator("body").innerText();
    assert.ok(
      !/figure au relevé de TVA collectée/.test(ecran),
      "l'écran promet encore que la facture est au relevé"
    );
    // **La seconde assertion exigeait une PHRASE, et il l'a fait retirer.**
    // Le 24 août 2026, capture à l'appui : *« tout ce qui est en gris sous
    // facture F2026, supprime »*. Elle réclamait « entrera au relevé de TVA le
    // jour où votre client vous paiera » — un mécanisme, exactement ce qu'il ne
    // veut plus lire. Un contrôle qui réclame ce qu'il a fait enlever rend son
    // écran impossible à changer (`CLAUDE.md` §5 bis) : on vise plus profond.
    //
    // Ce que la règle dit vraiment, et qui ne dépend d'aucun libellé : **rien,
    // sur cet écran, ne doit affirmer que la facture est au relevé**. Elle n'y
    // est pas tant qu'elle n'est pas payée, et le cas suivant le vérifie en
    // base, sur le total collecté lui-même.
    for (const promesse of [
      /figure au relevé/i,
      /est au relevé/i,
      /entre dans votre TVA/i,
      /portée au relevé/i,
    ]) {
      assert.ok(
        !promesse.test(ecran),
        `l'écran promet que la facture est au relevé (« ${promesse} »). Lu : « ${ecran.slice(0, 400)} »`
      );
    }
  });

  await test("LA FACTURE ATTEND, ET LE RELEVÉ NE BOUGE PAS", async () => {
    const avant = await (async () => {
      await page.goto(`${BASE}/termines/tva`, { waitUntil: "networkidle" });
      return collectee(page);
    })();

    const { chantierId, nom } = await chantierRealise(page, "attend");
    const numero = await emettre(page, chantierId);

    await page.goto(`${BASE}/termines/tva`, { waitUntil: "networkidle" });
    assert.strictEqual(await collectee(page), avant, "la facture impayée est entrée au relevé");

    // Et elle est visible dans l'endroit en attente, avec son nom.
    const attente = page.getByRole("heading", { name: "En attente de paiement" });
    await attente.waitFor({ state: "visible", timeout: 10_000 });
    const ecran = await page.locator("body").innerText();
    assert.ok(ecran.includes(numero), `la facture ${numero} n'apparaît pas en attente`);
    assert.ok(ecran.includes(nom.replace("Chez ", "")) || ecran.includes("Bernard"), "le client n'est pas nommé");
    assert.ok(/1\s?200,00\s?€/.test(ecran), `le montant restant dû n'est pas affiché. Lu : « ${ecran.slice(0, 300)} »`);
  });

  await test("« PAYÉE » LA FAIT ENTRER AU RELEVÉ — son geste, d'un doigt", async () => {
    await page.goto(`${BASE}/termines/tva`, { waitUntil: "networkidle" });
    const avant = await collectee(page);

    const { chantierId } = await chantierRealise(page, "payee");
    const numero = await emettre(page, chantierId);

    await page.goto(`${BASE}/termines/tva`, { waitUntil: "networkidle" });
    const ligne = page.locator("li").filter({ hasText: numero });
    await ligne.getByRole("button", { name: "Payée" }).click();

    // Le relevé bouge du bon montant : 1 000 € HT à 20 % font 200 € de TVA.
    await page.waitForFunction(
      (attendu) => !document.body.innerText.includes(attendu),
      numero,
      { timeout: 15_000 }
    );
    const apres = await collectee(page);
    assert.strictEqual(
      (apres - avant).toFixed(2),
      "200.00",
      `le relevé est passé de ${avant} à ${apres} : l'écart devrait être de 200,00 €`
    );

    const { rows } = await inspecter(
      "SELECT count(*)::int AS n FROM paiements_facture p JOIN factures f ON f.id = p.facture_id WHERE f.chantier_id = $1",
      [chantierId],
      1
    );
    assert.strictEqual(rows[0].n, 1, "aucun règlement n'a été écrit");
  });

  await test("un acompte n'apporte que sa part, et la facture reste en attente", async () => {
    await page.goto(`${BASE}/termines/tva`, { waitUntil: "networkidle" });
    const avant = await collectee(page);

    const { chantierId } = await chantierRealise(page, "acompte");
    const numero = await emettre(page, chantierId);

    await page.goto(`${BASE}/termines/tva`, { waitUntil: "networkidle" });
    const ligne = page.locator("li").filter({ hasText: numero });
    await ligne.getByRole("button", { name: "Noter un règlement" }).click();
    await ligne.getByLabel("Montant reçu, en euros").fill("600");
    await ligne.getByRole("button", { name: "Enregistrer ce règlement" }).click();

    // 600 € sur 1 200 € TTC : la moitié, donc 100 € de TVA sur 200.
    await page.waitForFunction(
      (a) => {
        const m = document.body.innerText.match(/COLLECTÉE\s*\n?\s*([\d\s   ,.]+)\s*€/i);
        return m ? Number(m[1].replace(/[\s   ]/g, "").replace(",", ".")) !== a : false;
      },
      avant,
      { timeout: 15_000 }
    );
    const apres = await collectee(page);
    assert.strictEqual((apres - avant).toFixed(2), "100.00", `l'acompte a apporté ${(apres - avant).toFixed(2)} €`);

    // Et elle attend toujours son solde : c'est ce qui empêche de l'oublier.
    const ecran = await page.locator("body").innerText();
    assert.ok(ecran.includes(numero), "la facture partiellement réglée a quitté l'attente");
    assert.ok(/reste sur/.test(ecran), "rien ne dit qu'il s'agit d'un reste");
  });

  await test("UN MONTANT TROP GRAND EST REFUSÉ, et le refus lui parvient", async () => {
    const { chantierId } = await chantierRealise(page, "trop");
    const numero = await emettre(page, chantierId);

    await page.goto(`${BASE}/termines/tva`, { waitUntil: "networkidle" });
    const ligne = page.locator("li").filter({ hasText: numero });
    await ligne.getByRole("button", { name: "Noter un règlement" }).click();
    await ligne.getByLabel("Montant reçu, en euros").fill("5000");
    await ligne.getByRole("button", { name: "Enregistrer ce règlement" }).click();

    const refus = page.locator('[role="alert"]').filter({ hasText: /.+/ }).first();
    await refus.waitFor({ state: "visible", timeout: 15_000 });
    const raison = await refus.innerText();
    assert.match(raison, /reste que/i, `le refus ne dit pas ce qui reste : « ${raison} »`);
  });

  await test("le régime se change à l'écran, et le relevé suit", async () => {
    const { chantierId } = await chantierRealise(page, "regime");
    const numero = await emettre(page, chantierId);

    await page.goto(`${BASE}/termines/tva`, { waitUntil: "networkidle" });
    const avant = await collectee(page);

    await page.getByRole("radio", { name: /Le mois où j'envoie la facture/ }).click();
    await page.waitForFunction(
      (a) => {
        const m = document.body.innerText.match(/COLLECTÉE\s*\n?\s*([\d\s   ,.]+)\s*€/i);
        return m ? Number(m[1].replace(/[\s   ]/g, "").replace(",", ".")) !== a : false;
      },
      avant,
      { timeout: 15_000 }
    );
    const apres = await collectee(page);
    assert.ok(apres > avant, `aux débits, la facture impayée devrait entrer au relevé (${avant} → ${apres})`);

    // Et l'endroit en attente disparaît : plus rien à faire, tout est déclaré.
    const ecran = await page.locator("body").innerText();
    assert.ok(!ecran.includes("En attente de paiement"), "l'attente subsiste alors que tout est déclaré");
    // **Le numéro du relevé porte des espaces et des retours à la ligne.**
    // `NumeroDeDocument` le coupe en blocs pour qu'iOS cesse d'y voir un numéro
    // de téléphone (`ARCHITECTURE.md`, 13 août) : le comparer tel quel fait
    // rougir un écran parfaitement juste. On compare sans les blancs.
    const sansBlancs = (x: string) => x.replace(/[\s   ]/g, "");
    assert.ok(
      sansBlancs(ecran).includes(sansBlancs(numero)),
      "la facture n'est pas au relevé sous le régime des débits"
    );

    // On repose le régime : les suites suivantes partent d'un état connu.
    await page.getByRole("radio", { name: /Le mois où mon client me paie/ }).click();
    await page.waitForTimeout(1500);
  });

  // ─── SA PLAINTE DU 26 AOÛT 2026 : « rien ne se passe » ───────────────────
  //
  // *« Et lorsque je change entre les deux, rien ne se passe, c'est normal ? »*
  //
  // **C'était normal, et c'est bien là le problème.** Quand toutes les factures
  // d'un mois ont été payées dans le mois, les deux régimes tombent sur le même
  // chiffre : le calcul est juste. Mais un écran qui ne bouge pas sans rien
  // dire se lit comme une panne — il a cru l'application cassée.
  //
  // Ce que ce cas garde, c'est la PHRASE qui manquait, et surtout le fait
  // qu'elle ne peut pas dériver : le premier montant qu'elle cite est celui du
  // bloc au-dessus. Une phrase qui annoncerait un chiffre absent de l'écran
  // serait pire que pas de phrase du tout.
  await test("LA PHRASE DIT CE QUE LE CHOIX CHANGE — sa plainte du 26 août", async () => {
    const { chantierId } = await chantierRealise(page, "ecart");
    await emettre(page, chantierId); // émise, et jamais payée
    await page.goto(`${BASE}/termines/tva`, { waitUntil: "networkidle" });

    const phrase = page.locator('[data-atlas="ecart-des-regimes"]');
    assert.equal(await phrase.count(), 1, "la phrase qui dit ce que le choix change a disparu");

    const nombre = (x: string) => Number(x.replace(/[\s   ]/g, "").replace(",", "."));
    const montants = async () => {
      const dit = (await phrase.innerText()).trim();
      const lus = [...dit.matchAll(/([\d \s   ]+,\d{2})\s*€/g)].map((m) => nombre(m[1]));
      return { dit, lus };
    };

    // **Une facture jamais payée sépare forcément les deux régimes.** Si la
    // phrase dit « ne change rien » ici, c'est qu'elle ne regarde pas le second
    // régime — et elle mentirait exactement là où il a besoin d'elle.
    const avant = await montants();
    assert.ok(
      /en attendant le paiement/i.test(avant.dit) && /dès l'envoi/i.test(avant.dit),
      `elle dit « ${avant.dit} » alors qu'une facture émise attend son paiement`
    );
    // **Un espace mangé par la compilation.** L'écran a affiché
    // « 1 400,00 €dès l'envoi » — vu dans le HTML rendu, et par aucune mesure :
    // le montant et le mot suivant sont deux nœuds, et JSX avale l'espace entre
    // les deux si on ne le pose pas soi-même.
    assert.doesNotMatch(avant.dit, /€\S/, `un espace manque après un montant : « ${avant.dit} »`);
    assert.equal(avant.lus.length, 2, `deux montants attendus, lu « ${avant.dit} »`);
    assert.equal(
      avant.lus[0],
      await collectee(page),
      "le montant cité n'est pas celui du bloc au-dessus : la phrase a dérivé"
    );
    assert.ok(avant.lus[1] > avant.lus[0], "aux débits, la facture impayée doit ajouter sa TVA");

    // **ET ELLE NE DEVANCE PAS LE GRAND CHIFFRE.** Première version écartée
    // ici même : la phrase suivait le doigt et annonçait déjà le montant de
    // l'autre régime pendant que « Collectée » portait encore l'ancien. Deux
    // chiffres qui se contredisent dans le même écran, et c'est toute la liste
    // qu'on cesse de croire (`CLAUDE.md` §4 bis).
    //
    // Elle nomme donc les deux régimes, dans un ordre qui ne bouge pas — et
    // c'est ce que ce contrôle fixe : après la bascule, ce sont les MÊMES deux
    // montants, et c'est « Collectée » qui passe de l'un à l'autre.
    await page.getByRole("radio", { name: /Le mois où j'envoie la facture/ }).click();
    await page.waitForFunction(
      (a) => {
        const m = document.body.innerText.match(/COLLECTÉE\s*\n?\s*([\d \s   ,.]+)\s*€/i);
        return m ? Number(m[1].replace(/[\s   ]/g, "").replace(",", ".")) !== a : false;
      },
      avant.lus[0],
      { timeout: 15_000 }
    );
    const apres = await montants();
    assert.deepEqual(apres.lus, avant.lus, `la phrase a changé d'ordre : « ${apres.dit} »`);
    assert.equal(
      await collectee(page),
      avant.lus[1],
      "aux débits, le grand chiffre ne rejoint pas le second montant de la phrase"
    );

    // On repose le régime : les suites suivantes partent d'un état connu.
    await page.getByRole("radio", { name: /Le mois où mon client me paie/ }).click();
    await page.waitForTimeout(1500);
  });

  console.log(`\n${passed} test(s) réussi(s), ${failed} échoué(s).`);
  await contexte.close();
  await navigateur.close();
  await pool.end();
  process.exit(failed === 0 ? 0 : 1);
}

main().catch(async (err) => {
  console.error(err);
  await pool.end();
  process.exit(1);
});
