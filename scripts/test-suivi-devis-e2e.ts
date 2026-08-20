import assert from "node:assert";
import type { Page, BrowserContext } from "playwright";
import { lancerNavigateur } from "./e2e-browser";
// Le nom du chantier se DÉDUIT du client (`src/lib/nom-chantier.ts`) : on
// applique la même règle que le produit plutôt que de recomposer « Chez … ».
// Recopié ici, ce contrôle est passé au rouge le 13 août 2026, le jour où le
// patron a fait retirer ce mot.
import { avecCivilite } from "../src/lib/civilite";
import { pool } from "../src/server/db/client";

// Ce que devient un devis parti, vu du patron (docs/AGENT.md §2.2).
//
// Le cycle complet est déjà couvert ailleurs. Ce qui se joue ici est différent
// et n'était couvert nulle part : une fois le devis parti, l'application
// dit-elle au patron où il en est — et lui laisse-t-elle un chemin ?

const BASE = "http://localhost:3000";

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

/** Requête d'inspection hors application — voir test-facture-e2e.ts. */
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

async function seConnecter(context: BrowserContext): Promise<Page> {
  const page = await context.newPage();
  await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  await page.fill('input[name="email"]', "demo@atlas.local");
  await page.fill('input[name="password"]', "demo1234");
  await page.click('button[type="submit"]');
  await page.waitForURL(`${BASE}/`, { timeout: 15000 });
  return page;
}

/** Un chantier dont le devis vient de partir chez le client. */
async function devisParti(page: Page, suffixe: string) {
  await page.goto(`${BASE}/chantiers/nouveau`, { waitUntil: "networkidle" });
  // Le chantier n'a plus de nom saisi : il prend celui de son client
  // (« Chez … », voir `src/lib/nom-chantier.ts`). C'est donc le client qui
  // porte la marque unique, et le repère suit.
  const client = `M. Bernard ${suffixe} ${Date.now()}`;
  const nom = avecCivilite(client);
  await page.fill('input[placeholder="Bernard"]', client);
  await page.fill('input[placeholder="06 12 34 56 78"]', "06 12 34 56 78");
  await page.click('[data-atlas="action-dicter"]');
  await page.waitForURL(/\/chantiers\/[0-9a-f-]{36}/, { timeout: 10000 });
  const url = page.url();
  const chantierId = url.split("/").pop()!;

  await page.goto(`${url}/prix`, { waitUntil: "networkidle" });
  await page.click("text=+ Ajouter une ligne");
  await page.waitForTimeout(300);
  const champs = page.locator("form input");
  await champs.nth(0).fill("Main d'œuvre");
  await champs.nth(1).fill("900.00");
  await champs.nth(1).blur();
  await page.waitForTimeout(500);

  await page.goto(`${url}/devis-complet`, { waitUntil: "networkidle" });
  await page.click("text=Choisir la date");
  await page.waitForSelector("text=Une date, ou deux au choix du client ?", { timeout: 10000 });
  await page.getByRole("button", { name: "Envoyer le devis" }).click();
  await page.waitForSelector("text=Devis prêt pour", { timeout: 15000 });

  // **Le jeton se lit dans la BASE, plus à l'écran.**
  //
  // Il se lisait dans l'adresse complète, affichée en toutes lettres sous le
  // total. Le patron l'a fait retirer le 12 août — « il y a trop d'infos sur
  // cette page » : trois lignes de caractères illisibles qu'il ne relisait
  // jamais, et que « Copier le lien » met de toute façon dans le presse-papier.
  //
  // Cette suite ne parle pas du lien : elle a besoin du jeton pour JOUER LE
  // CLIENT sur sa page publique. Le prendre à l'écran, c'était faire dépendre
  // cinq contrôles de suivi d'un détail d'affichage — et c'est exactement ce
  // qui vient d'arriver : les cinq sont tombés d'un coup sur un changement qui
  // ne les concernait pas.
  const { rows } = await inspecter(
    "select jeton from envois_devis where chantier_id = $1 order by envoye_at desc limit 1",
    [chantierId],
    1
  );
  const jeton = rows[0].jeton as string;

  return { chantierId, nom, url, jeton };
}

/** Le client refuse, depuis sa page publique — sans session, comme en vrai. */
async function clientRefuse(browser: Awaited<ReturnType<typeof lancerNavigateur>>, jeton: string) {
  const contexte = await browser.newContext();
  const p = await contexte.newPage();
  await p.goto(`${BASE}/devis/${jeton}`, { waitUntil: "networkidle" });
  await p.click('button:has-text("Je ne donne pas suite")');
  await p.waitForSelector("text=Votre réponse a bien été transmise", { timeout: 15000 });
  await contexte.close();
}

async function main() {
  const browser = await lancerNavigateur();
  const context = await browser.newContext();
  const page = await seConnecter(context);

  await test("un devis parti met le chantier en attente, pas en « à planifier »", async () => {
    const { nom } = await devisParti(page, "attente");

    await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
    const carte = page.locator(`text=${nom}`).first().locator("xpath=ancestor::a[1]");
    // **Le libellé a changé le 13 août 2026, à sa demande** : « en attente de
    // réponse » était vrai mais ne disait pas CE QUI attend — un devis parti,
    // ou un client qu'on n'a pas rappelé (`ARCHITECTURE.md` §77).
    assert.ok(
      (await carte.locator("text=Devis envoyé").count()) > 0,
      "la liste ne dit pas que le devis est parti"
    );
    // Et la date d'envoi, en clair, sous l'état : c'est ce qu'il a demandé de
    // voir. Sans elle, il ne sait pas depuis combien de temps il attend.
    assert.ok(
      (await carte.locator("text=/Envoyé le /").count()) > 0,
      "la liste ne dit pas QUAND le devis est parti"
    );

    // Planifier soi-même une date que le client s'apprête à choisir préparerait
    // deux engagements sur le même jour.
    await page.goto(`${BASE}/planning`, { waitUntil: "networkidle" });
    const sectionAPlanifier = page.locator("text=À planifier").locator("xpath=..");
    assert.strictEqual(
      await sectionAPlanifier.locator(`text=${nom}`).count(),
      0,
      "le chantier est proposé à la planification alors que le client choisit"
    );
    assert.ok(
      await page.locator("text=En attente du client").isVisible(),
      "le chantier disparaît du planning au lieu d'y être annoncé en attente"
    );
  });

  await test("un refus est annoncé au patron sur son écran d'accueil", async () => {
    const { nom, jeton } = await devisParti(page, "refus");
    await clientRefuse(browser, jeton);

    await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
    assert.ok(
      await page.locator("text=Devis retourné").first().isVisible(),
      "le refus n'est annoncé nulle part"
    );
    assert.ok(
      (await page.locator(`text=${nom}`).count()) > 0,
      "la notification ne dit pas de quel chantier il s'agit"
    );
  });

  await test("« J'ai vu » retire la notification, et pour de bon", async () => {
    const { jeton } = await devisParti(page, "vu");
    await clientRefuse(browser, jeton);

    await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
    // **Déplier la pile avant de chercher.** Depuis le 16 août 2026, les rappels
    // passent devant les réponses de clients (sa décision « fait la B »), et
    // l'accueil n'en pose que deux : une réponse peut donc être repliée derrière
    // « N autres devis à regarder ». Elle existe et se touche en un appui — mais
    // pas sans ce geste, et la suite accuserait la carte d'être absente.
    const deplier = page.getByRole("button", { name: /autres? devis à regarder/ });
    if ((await deplier.count()) > 0) {
      await deplier.first().click();
      await page.waitForTimeout(300);
    }
    // Compté avant/après : les suites précédentes laissent leurs propres refus
    // non lus, et exiger zéro reviendrait à tester l'ordre d'exécution.
    const avant = await page.locator("text=Devis retourné").count();
    assert.ok(avant > 0, "aucune notification à marquer comme vue");

    await page.locator("text=J'ai vu").first().click();
    await page.waitForTimeout(1500);

    // **Et redéplier APRÈS le rechargement.** Le repli revient à zéro à chaque
    // chargement : compter la pile dépliée avant et repliée après comparait
    // deux choses différentes, et le contrôle accusait « J'ai vu » de ne rien
    // faire alors qu'il faisait exactement son travail.
    await page.reload({ waitUntil: "networkidle" });
    const encore = page.getByRole("button", { name: /autres? devis à regarder/ });
    if ((await encore.count()) > 0) {
      await encore.first().click();
      await page.waitForTimeout(300);
    }
    assert.strictEqual(
      await page.locator("text=Devis retourné").count(),
      avant - 1,
      "la notification revient après rechargement"
    );
  });

  await test("un devis retourné peut être repris et renvoyé", async () => {
    const { chantierId, url, jeton } = await devisParti(page, "reprise");
    await clientRefuse(browser, jeton);

    await page.goto(`${url}/devis-complet`, { waitUntil: "networkidle" });
    assert.ok(
      await page.locator("text=Le client n'a pas donné suite").isVisible(),
      "l'écran devis ne dit pas que le client a refusé"
    );

    await page.click("text=Reprendre le devis");
    await page.waitForSelector("text=Choisir la date", { timeout: 15000 });

    // Une nouvelle version, pas une modification de celle qui est partie : le
    // devis refusé reste la trace de ce qui avait été proposé.
    const { rows } = await inspecter(
      "SELECT numero_version, statut FROM devis WHERE chantier_id = $1 ORDER BY numero_version",
      [chantierId]
    );
    assert.strictEqual(rows.length, 2, "la reprise n'a pas ouvert de nouvelle version");
    assert.strictEqual(rows[0].statut, "envoye", "la version refusée a été modifiée");
    assert.strictEqual(rows[1].statut, "brouillon");

    // Et elle repart réellement : c'est tout l'objet de la reprise.
    await page.click("text=Choisir la date");
    await page.waitForSelector("text=Une date, ou deux au choix du client ?", { timeout: 10000 });
    await page.getByRole("button", { name: "Envoyer le devis" }).click();
    try {
      await page.waitForSelector("text=Devis prêt pour", { timeout: 15000 });
    } catch (e) {
      // Ce contrôle a échoué une fois dans la batterie complète, jamais seul :
      // l'attente expirait sans qu'on sache pourquoi. Un délai dépassé ne
      // désigne aucun coupable — l'écran, lui, porte le message de refus.
      // Sans cette capture, la prochaine occurrence coûterait la même enquête.
      console.error(
        "L'envoi n'a pas abouti. Ce que la feuille affichait :\n" +
          (await page.locator("body").innerText()).slice(0, 1500)
      );
      throw e;
    }

    const envois = await inspecter("SELECT count(*)::int AS n FROM envois_devis WHERE chantier_id = $1", [
      chantierId,
    ]);
    assert.strictEqual(envois.rows[0].n, 2, "le second envoi n'a pas été enregistré");

    // **Un seul bouton à chaque instant — sa règle du 13 août (maquette 40, B).**
    //
    // Sa capture montrait « Ouvrir le SMS tout prêt » ET « Reprendre le devis »
    // l'un sous l'autre, tous deux pleins, sur un devis qu'il venait de reprendre
    // et d'envoyer : l'écran lui proposait de reprendre ce qu'il venait de
    // reprendre. Le contrôle regarde donc l'écran APRÈS l'envoi, moment que
    // personne n'inspectait — c'est exactement là que le défaut vivait.
    for (const libelle of [/Reprendre le devis/i, /Corriger et renvoyer/i]) {
      assert.strictEqual(
        await page.getByRole("button", { name: libelle }).count(),
        0,
        `Une fois le devis reparti, « ${libelle.source} » ne doit plus être à l'écran : ` +
          "il proposerait de reprendre ce qui vient d'être repris et envoyé."
      );
    }

    // Et le geste qui reste est bien celui du moment.
    assert.ok(
      (await page.getByRole("link", { name: /Ouvrir le (SMS|mail|message)/i }).count()) +
        (await page.getByRole("button", { name: /Ouvrir le (SMS|mail|message)/i }).count()) >
        0,
      "après l'envoi, l'écran ne porte plus aucun geste : la transmission a disparu avec la reprise."
    );
  });

  await test("relancer réutilise le MÊME lien, sans regénérer de devis", async () => {
    const { url, jeton } = await devisParti(page, "relance");

    await page.reload({ waitUntil: "networkidle" });
    await page.goto(`${url}/devis-complet`, { waitUntil: "networkidle" });

    // Sélecteur restreint au paragraphe : en mode développement, une erreur
    // afficherait le code source de l'écran, où cette phrase figure aussi.
    assert.strictEqual(
      await page.locator('p:text-is("En attente de réponse")').count(),
      1,
      "l'écran ne rappelle pas que le client n'a pas répondu"
    );

    // **Ce qui compte, c'est que le lien soit LE MÊME — pas qu'il soit affiché.**
    //
    // Ce contrôle exigeait la phrase « Le lien est toujours actif », posée sous
    // l'adresse complète écrite en toutes lettres. Le patron a fait retirer les
    // deux le 12 août : trois lignes de caractères qu'il ne relisait jamais.
    // Le contrôle est alors tombé — sur un détail d'affichage, pas sur ce qu'il
    // avait à défendre.
    //
    // Ce qu'il avait à défendre, c'est ceci : relancer ne doit pas obliger à
    // regénérer un devis, donc le geste de relance doit porter le jeton DÉJÀ
    // envoyé. On le lit dans le lien de transmission, celui que le doigt touche.
    const adresse = (await page.locator("a[data-transmission]").getAttribute("href")) ?? "";
    assert.ok(
      decodeURIComponent(adresse).includes(`/devis/${jeton}`),
      `Le geste de relance ne porte pas le jeton déjà envoyé (${jeton}) : le patron devrait renvoyer un nouveau devis pour relancer. Adresse : « ${adresse.slice(0, 90)} »`
    );

    // Et le devis n'a pas été régénéré au passage : une seule version existe.
    const { rows } = await inspecter(
      "select count(*)::text as n from devis where chantier_id = $1",
      [url.split("/").pop()!]
    );
    assert.strictEqual(
      rows[0].n,
      "1",
      "Consulter l'écran d'un devis parti a créé une seconde version : la relance ne doit rien regénérer."
    );
  });

  await context.close();
  await browser.close();
  console.log(`\n${passed} réussis, ${failed} échoués`);
  await pool.end();
  if (failed > 0) process.exit(1);
}

main().catch(async (err) => {
  console.error(err);
  await pool.end();
  process.exit(1);
});
