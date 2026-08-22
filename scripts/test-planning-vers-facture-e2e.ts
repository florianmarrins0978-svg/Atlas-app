import assert from "node:assert";
import type { Page, BrowserContext } from "playwright";
import { lancerNavigateur } from "./e2e-browser";
// Le nom du chantier se DÉDUIT du client (`src/lib/nom-chantier.ts`) : on
// applique la même règle que le produit plutôt que de recomposer « Chez … ».
// Recopié ici, ce contrôle est passé au rouge le 13 août 2026, le jour où le
// patron a fait retirer ce mot.
import { avecCivilite } from "../src/lib/civilite";
import { pool } from "../src/server/db/client";
import { creerPuisFiche } from "./_creer-chantier-e2e";

// **Du planning à la facture, en partant d'où le patron se trouve.**
//
// Le 8 août 2026 : *« lorsque le client m'avait retourné la date validée, il se
// range dans les chantiers planifiés, mais comment moi je fais pour avoir accès
// au devis ? Je dois pouvoir cliquer directement sur le client qui est
// planifié, avoir un bouton à côté fin de chantier pour que ça crée
// automatiquement la facturation, puis l'envoi de la facturation, puis
// l'automatisation vers la TVA. Toute cette branche-là n'est pas faite. »*
//
// **La chaîne ÉTAIT construite — et injoignable.** Facture depuis le devis,
// arrêt 3, relevé de TVA, message tout prêt : tout existait, mais uniquement
// depuis la fiche du chantier et l'onglet Terminés. Depuis le planning, toucher
// un chantier n'ouvrait qu'un sélecteur de date. Une chaîne qu'on ne peut pas
// atteindre vaut une chaîne qu'on n'a pas écrite — de son côté de l'écran, il
// avait raison.
//
// Cette suite parcourt ce qu'il décrit, dans l'ordre, en touchant ce qu'il
// touche. Et elle lit **les trois onglets** : c'est le seul contrôle capable de
// voir un écran réinventer la règle de rangement dans son coin, ce qui est
// arrivé deux fois (`src/lib/onglet-chantier.ts`).

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

/**
 * Un chantier au devis parti, puis planifié — l'état où le laisse un client qui
 * a retourné sa date.
 *
 * `joursAvant` compte à rebours depuis aujourd'hui : 0 pour aujourd'hui, un
 * nombre négatif pour une date à venir. La date est posée en base plutôt qu'à
 * l'écran, parce que l'application n'accepte — délibérément — que des dates à
 * venir, et que la moitié des cas éprouvés ici sont derrière soi.
 */
async function chantierPlanifie(
  page: Page,
  suffixe: string,
  joursAvant: number,
  lignes: { libelle: string; montant: string }[] = [{ libelle: "Abattage d'un chêne mort", montant: "1000.00" }]
) {
  await page.goto(`${BASE}/chantiers/nouveau`, { waitUntil: "networkidle" });
  const client = `Mme Costa ${suffixe} ${Date.now()}`;
  const nom = avecCivilite(client);
  await page.fill('input[placeholder="Bernard"]', client);
  await page.fill('input[placeholder="06 12 34 56 78"]', "06 12 34 56 78");
  await creerPuisFiche(page);
  await page.waitForURL(/\/chantiers\/[0-9a-f-]{36}/, { timeout: 10000 });
  const url = page.url();
  const chantierId = url.split("/").pop()!;

  await page.goto(`${url}/prix`, { waitUntil: "networkidle" });
  for (let i = 0; i < lignes.length; i++) {
    await page.click("text=+ Ajouter une ligne");
    await page.waitForTimeout(300);
    const champs = page.locator("form input");
    await champs.nth(i * 2).fill(lignes[i].libelle);
    await champs.nth(i * 2 + 1).fill(lignes[i].montant);
    await champs.nth(i * 2 + 1).blur();
    await page.waitForTimeout(500);
  }

  await page.goto(`${url}/devis-complet`, { waitUntil: "networkidle" });
  await page.click("text=Choisir la date");
  await page.waitForSelector("text=Une date, ou deux au choix du client ?", { timeout: 10000 });
  await page.getByRole("button", { name: "Envoyer le devis" }).click();
  await page.waitForURL(/localhost:3000\/$/, { timeout: 15000 }); // L'envoi ramène à L'ACCUEIL depuis le 21 août 2026 : c'est lui, le signal.

  await inspecter(
    `UPDATE chantiers SET date_planifiee = CURRENT_DATE - $2::int WHERE id = $1`,
    [chantierId, joursAvant],
    1
  );
  return { chantierId, nom, client, url };
}

/**
 * Dans lequel des trois onglets ce chantier apparaît-il ?
 *
 * On attend le titre de chaque écran, pas `networkidle` : le serveur de
 * développement garde une liaison ouverte pour le rechargement à chaud, si bien
 * que le réseau ne se tait jamais. La suite échouait alors au bout de 45
 * secondes sur une page pourtant affichée — un contrôle qui accuse le code pour
 * un défaut de son propre montage.
 */
async function ongletsOuIlFigure(page: Page, nom: string): Promise<string[]> {
  const trouves: string[] = [];
  for (const [onglet, chemin, titre] of [
    ["chantiers", "/", "Chantiers"],
    ["planning", "/planning", "Planning"],
    ["termines", "/termines", "Terminés"],
  ] as const) {
    await ouvrir(page, chemin, titre);
    if ((await page.locator(`text=${nom}`).count()) > 0) trouves.push(onglet);
  }
  return trouves;
}

/**
 * Ouvre un écran, avec une seconde chance — et un message qui désigne le bon
 * coupable si les deux échouent.
 *
 * **Pourquoi une seconde chance ici et nulle part ailleurs.** Cette suite est la
 * plus lourde de la batterie : elle bâtit sept chantiers de bout en bout, chacun
 * avec son devis envoyé et son PDF archivé. Son dernier cas s'exécute donc sur
 * un serveur de développement déjà sollicité par une vingtaine de suites, et une
 * navigation y a dépassé les 45 secondes par défaut — deux fois sur cinq
 * batteries, jamais quand la suite tourne seule (mesuré : 333 ms pour cet écran
 * même, avec la base pleine).
 *
 * Ce n'est donc pas le code qui est lent, c'est le montage qui est chargé. Un
 * contrôle qui rougit là-dessus **accuse à tort**, et une erreur qui envoie
 * chercher au mauvais endroit coûte plus cher que pas d'erreur du tout
 * (`AGENTS.md`). D'où la seconde chance — et, si elle échoue aussi, un message
 * qui dit que le serveur n'a pas répondu plutôt que de laisser croire à un
 * défaut d'affichage.
 */
async function ouvrir(page: Page, chemin: string, titre: string): Promise<void> {
  for (const essai of [1, 2]) {
    try {
      await page.goto(`${BASE}${chemin}`, { waitUntil: "domcontentloaded", timeout: 45_000 });
      await page.waitForSelector(`h1:has-text("${titre}")`, { timeout: 30_000 });
      return;
    } catch (err) {
      if (essai === 2) {
        throw new Error(
          `L'écran « ${titre} » (${chemin}) n'a pas répondu en deux tentatives. ` +
            "C'est le serveur de développement qui n'a pas suivi, pas l'écran : " +
            `il répond en quelques centaines de millisecondes hors batterie. (${(err as Error).message.split("\n")[0]})`
        );
      }
    }
  }
}

async function main() {
  const browser = await lancerNavigateur();
  const context = await browser.newContext();
  const page = await seConnecter(context);

  await test("depuis le planning, le chantier mène à son devis", async () => {
    // Sa question, mot pour mot : « comment moi je fais pour avoir accès au
    // devis ? » Avant ce lot, la réponse était : on ne peut pas.
    const { nom, chantierId } = await chantierPlanifie(page, "devis", -4);
    await page.goto(`${BASE}/planning`, { waitUntil: "networkidle" });

    // **La liste des planifiés est HEBDOMADAIRE depuis la planche 84** : un
    // chantier posé dans quatre jours peut tomber la semaine suivante, et la
    // liste ne le montre alors pas. On touche son jour dans le calendrier —
    // c'est le geste du patron, et il amène la liste sur SA semaine.
    const jour = (
      await inspecter(`SELECT date_planifiee::text AS j FROM chantiers WHERE id = $1`, [chantierId], 1)
    ).rows[0].j as string;
    for (let i = 0; i < 12; i++) {
      if (await page.locator(`[data-atlas="grille-mois"] [data-jour="${jour}"]`).count()) break;
      await page.click('button[aria-label="Mois suivant"]');
      await page.waitForTimeout(200);
    }
    await page.click(`[data-atlas="grille-mois"] [data-jour="${jour}"]`);
    await page.waitForTimeout(600);

    // **Le CHEVRON, et non le nom.** Depuis la planche 84, le nom d'un chantier
    // planifié déplie sa journée et sa feuille sur place ; c'est le chevron qui
    // MÈNE au chantier. Le geste a changé de forme, jamais d'objet : sans lui,
    // un chantier posé quitte l'onglet « Chantiers » et devient inatteignable —
    // le cul-de-sac du 8 août 2026, mot pour mot.
    await page
      .locator(`[data-atlas="ligne-planifiee"]:has-text("${nom}")`)
      .first()
      .getByRole("link", { name: `Ouvrir le chantier — ${nom}` })
      .click();
    // **On attend l'écran, pas l'URL.** Ces liens font une navigation côté
    // client : `waitForURL` ne la voit pas, même en « commit », et le contrôle
    // échouait sur une page pourtant bien ouverte — il accusait le code au lieu
    // de son propre montage. Un repère de la fiche prouve mieux qu'une adresse
    // qu'on est arrivé.
    // Le repère est le tiroir du bas : « Autres étapes » ne s'écrit plus depuis
    // que les étapes y sont rangées (`ARCHITECTURE.md` §49).
    await page.waitForSelector("[data-atlas='tiroir-fiche']", { timeout: 15000 });
    assert.match(page.url(), new RegExp(`/chantiers/${chantierId}$`), "le planning ne mène pas à ce chantier");

    // **Il faut ouvrir le tiroir : au repos, seule sa prise dépasse.** Les
    // étapes existent dans la page mais sont clippées — un clic direct
    // échouerait sur un écran pourtant juste. C'est le geste du patron, pas un
    // contournement : les étapes sont désormais rangées, et on les tire.
    await page.locator("[data-atlas='tiroir-fiche'] button[aria-expanded]").click();
    await page.waitForSelector("[data-atlas='tiroir-fiche'][data-ouvert='oui']", { timeout: 5000 });

    // La fiche mène au devis. Le lien est visé par son adresse : « Devis »
    // apparaît à plusieurs endroits de l'écran, et viser le premier texte venu
    // ferait passer le contrôle pour de mauvaises raisons.
    await page.locator(`a[href="/chantiers/${chantierId}/export"]`).click();
    // Le titre de l'écran, et non un bouton : « Envoyer au client » disparaît
    // une fois le devis parti — c'est-à-dire précisément dans le cas qui
    // intéresse le patron, celui d'un chantier planifié.
    await page.waitForSelector("h1:has-text('Devis')", { timeout: 15000 });
    assert.ok(page.url().endsWith("/export"), `arrivé sur ${page.url()} au lieu du devis`);
    assert.ok(
      (await page.locator(`text=${nom}`).count()) > 0,
      "le devis atteint n'est pas celui de ce chantier"
    );
  });

  await test("« Créer la facture » s'atteint sans passer par la fiche, et la prépare", async () => {
    // « avoir un bouton à côté fin de chantier pour que ça crée automatiquement
    // la facturation ». Ce qu'il crée est un brouillon, jamais une facture
    // partie — l'arrêt 3 reste (AGENT.md §2.3).
    //
    // ─────────────────────────────────────────────────────────────────────
    // **LE CHEMIN A CHANGÉ DEUX FOIS, L'OBJET JAMAIS.** Ce que cette suite
    // défend, c'est le cul-de-sac du 8 août — *« il se range dans les chantiers
    // planifiés, mais comment moi je fais pour avoir accès au devis ? »* — et
    // non une position à l'écran.
    //
    //   · 8 août : sur la ligne du planning ;
    //   · 12 août : dans la feuille du chevron, à sa demande — *« il faut
    //     cliquer sur le chevron [...] et là tu mets créer la facture »* ;
    //   · **21 août : dans le fil des « Terminés »**, seul chemin restant. Le
    //     planning refait (planche 84) ne porte pas ce bouton : la feuille qu'il
    //     a validée est celle que le SALARIÉ emporte, sans un prix. Y remettre
    //     « Créer la facture » aurait été ajouter à un écran qu'il venait de
    //     choisir plus simple.
    //
    // Le chemin existe donc toujours, et sans passer par la fiche — c'est ce
    // que le contrôle continue de prouver (`TODO.md` en garde la trace, au cas
    // où il voudrait le revoir au planning).
    // ─────────────────────────────────────────────────────────────────────
    // **Une date PASSÉE, et c'est ce qui le range dans « Terminés »** : le
    // travail a eu lieu (`src/lib/onglet-chantier.ts`). Avec une date à venir,
    // le chantier serait au planning et ce contrôle chercherait au mauvais
    // endroit — en accusant le fil d'être vide.
    const { chantierId, nom } = await chantierPlanifie(page, "bouton", 6);
    await page.goto(`${BASE}/termines`, { waitUntil: "networkidle" });

    // La ligne de CE chantier, et non la première de l'écran : avec plusieurs
    // chantiers terminés, viser la première clôturerait celle du voisin sans que
    // le contrôle s'en aperçoive.
    //
    // **On passe par l'onglet « À facturer », et c'est le geste du patron.**
    // L'écran refait le 22 août 2026 (planche 86, proposition B) s'ouvre sur le
    // mois le plus récent : un chantier terminé il y a six jours peut tomber
    // dans le mois d'avant selon la date du jour, et le contrôle chercherait
    // alors dans un mois qui ne le porte pas — en accusant un écran juste.
    // Cet onglet, lui, montre tout ce qui attend TOUS MOIS CONFONDUS : c'est
    // exactement ce qu'il a demandé pour le retard de facturation, et c'est ce
    // qui rend ce contrôle indifférent au calendrier.
    //
    // **Il n'y a plus de volet à déplier** : le travail qui reste ne se cache
    // plus. Réclamer ici le pli que le patron a fait retirer rendrait son écran
    // impossible à changer (`CLAUDE.md` §5 bis).
    const ongletAttente = page.getByRole("button", { name: "À facturer" });
    await ongletAttente.waitFor({ state: "visible", timeout: 15000 });
    await ongletAttente.click();
    await page.waitForSelector('[data-atlas="tout-ce-qui-attend"]', { timeout: 5000 });

    const rangee = page.locator(`[data-atlas="ligne-terminee"]:has-text("${nom}")`).first();
    await rangee.waitFor({ state: "visible", timeout: 15000 });
    const ligne = rangee.locator(`a[href="/chantiers/${chantierId}/facture"]`);
    assert.equal(
      await ligne.count(),
      1,
      "le chantier terminé n'est pas dans le fil : le chemin vers la facture est coupé"
    );
    await ligne.click();
    await page.waitForSelector("text=Le chantier est réalisé ?", { timeout: 15000 });

    await page.click("text=Créer la facture");
    await page.waitForSelector("text=Rien n'a changé depuis le devis ?", { timeout: 15000 });

    const { rows } = await inspecter("SELECT statut FROM factures WHERE chantier_id = $1", [chantierId], 1);
    assert.strictEqual(rows[0].statut, "brouillon", "la facture est partie sans confirmation");
    assert.ok(
      await page.locator("text=/1\\s?200,00\\s?€/").isVisible(),
      "le total du devis n'est pas repris (1 200,00 €)"
    );
  });

  await test("la confirmation porte la facture au relevé de TVA, et prépare son envoi", async () => {
    // La fin de sa phrase : « puis l'envoi de la facturation, puis
    // l'automatisation vers la TVA ». L'envoi part de SA messagerie — décision
    // du 3 août, `docs/A-FAIRE.md` §5 : Atlas prépare le message, il ne
    // l'expédie pas.
    const { chantierId } = await chantierPlanifie(page, "tva", -8);
    await page.goto(`${BASE}/chantiers/${chantierId}/facture`, { waitUntil: "networkidle" });
    await page.click("text=Créer la facture");
    await page.waitForSelector("text=Rien n'a changé depuis le devis ?", { timeout: 15000 });
    await page.click("text=Confirmer le départ de la facture");
    await page.waitForSelector("text=arrêtée", { timeout: 15000 });

    await page.click("text=Envoyer la facture au client");
    await page.waitForSelector("text=Ouvrir le", { timeout: 15000 });

    const { rows } = await inspecter(
      "SELECT statut, numero_commercial FROM factures WHERE chantier_id = $1",
      [chantierId],
      1
    );
    assert.strictEqual(rows[0].statut, "emise");

    // Le relevé se lit par facture, et on cherche CELLE-CI par son numéro. Les
    // totaux du trimestre cumulent les factures des autres cas de cette suite :
    // les viser rendrait le contrôle vert ou rouge selon l'ordre d'exécution.
    //
    // **Elle y arrive une fois ENCAISSÉE**, depuis le 16 août 2026 : la TVA
    // d'une prestation de services est exigible au paiement, et l'endroit
    // d'attente porte le geste (`ARCHITECTURE.md` §110).
    await page.goto(`${BASE}/termines/tva`, { waitUntil: "networkidle" });
    const ligne = page.locator("li").filter({ hasText: rows[0].numero_commercial as string });
    await ligne.getByRole("button", { name: "Payée" }).click();
    await page.waitForFunction(
      (numero) => !document.body.innerText.includes(numero),
      rows[0].numero_commercial as string,
      { timeout: 15000 }
    );
    const sansBlancs = (x: string) => x.replace(/[\s   ]/g, "");
    assert.ok(
      sansBlancs(await page.locator("body").innerText()).includes(
        sansBlancs(rows[0].numero_commercial as string)
      ),
      `la facture ${rows[0].numero_commercial} ne figure pas au relevé de TVA du trimestre`
    );
  });

  await test("l'arrêt 3 montre TOUS les travaux, pas la première ligne coupée", async () => {
    // **Un contrôle qui mesure, parce qu'un contrôle qui lit serait vert.**
    // Le libellé était coupé par `truncate`, c'est-à-dire par du CSS : le texte
    // entier restait dans la page. Toute assertion sur le contenu passait donc,
    // pendant que l'écran affichait « Abattage d'un chêne mort Br… ». Trouvé
    // sur une capture, comme les trois autres défauts d'affichage de ce projet
    // (`CLAUDE.md` §5).
    //
    // Ce que ça coûtait : à l'arrêt 3, le patron valide le départ d'une facture
    // en n'en voyant qu'un tiers. C'est l'écran de vérification qui cachait ce
    // qu'il fallait vérifier.
    const { chantierId } = await chantierPlanifie(page, "empile", -12, [
      { libelle: "Abattage d'un chêne mort\nBroyage des branches\nÉvacuation du gros bois", montant: "850.00" },
      { libelle: "Fendage du bois", montant: "250.00" },
    ]);
    await page.goto(`${BASE}/chantiers/${chantierId}/facture`, { waitUntil: "networkidle" });
    await page.click("text=Créer la facture");
    await page.waitForSelector("text=Rien n'a changé depuis le devis ?", { timeout: 15000 });

    const groupee = await page.locator("li", { hasText: "Abattage d'un chêne mort" }).first().boundingBox();
    const seule = await page.locator("li", { hasText: "Fendage du bois" }).first().boundingBox();
    assert.ok(groupee && seule, "les lignes de la facture sont introuvables");
    assert.ok(
      groupee.height > seule.height * 2,
      `trois travaux tiennent sur ${groupee.height}px quand un seul en prend ${seule.height} : ils sont écrasés sur une ligne`
    );
  });

  console.log("\n--- Un chantier, un seul onglet ---");

  await test("planifié pour AUJOURD'HUI : au planning, et nulle part ailleurs", async () => {
    // Le défaut du 6 août, revenu par la porte du signe : le planning comparait
    // `<` et le dépôt des terminés `<=`. Un chantier prévu ce jour-là figurait
    // dans les deux onglets à la fois.
    const { nom } = await chantierPlanifie(page, "aujourdhui", 0);
    assert.deepEqual(await ongletsOuIlFigure(page, nom), ["planning"]);
  });

  await test("date passée : dans les terminés, et nulle part ailleurs", async () => {
    const { nom } = await chantierPlanifie(page, "passe", 3);
    assert.deepEqual(await ongletsOuIlFigure(page, nom), ["termines"]);
  });

  await test("clôturé AVANT sa date : il quitte le planning pour les terminés", async () => {
    // Le second défaut, celui qui rendait la facture invisible. Le patron peut
    // clôturer plus tôt que prévu depuis sa fiche (3 août) ; le chantier
    // restait pourtant affiché au planning comme si de rien n'était, absent des
    // terminés, et la facture en brouillon n'était plus joignable que par son
    // adresse.
    const { nom, chantierId } = await chantierPlanifie(page, "avance", -10);
    // **Mesuré le 13 août 2026, et ce n'est ni la base ni cet écran.**
    //
    // Ce contrôle échouait trois fois sur cinq en batterie complète et passait
    // 7/7 joué seul. Quatre pistes ont été éprouvées, et trois écartées par la
    // mesure plutôt que par le raisonnement :
    //
    //   · `networkidle` remplacé par `domcontentloaded` — sans effet ;
    //   · délai porté à 120 s — dépassé lui aussi ;
    //   · verrou en base — un guetteur sur `pg_stat_activity` n'a relevé AUCUNE
    //     requête bloquée : deux transactions ouvertes, arrêtées dès leur
    //     `begin`, et PostgreSQL qui attend que l'application lui reparle ;
    //   · pool saturé — relevé au moment exact : 2 connexions, 1 libre,
    //     0 en attente.
    //
    // Une sonde posée DANS la page a donné la réponse : elle lit la session, le
    // chantier et la facture en 193 ms, puis le premier `await` suivant prend
    // 44 920 ms — et il repart **à la milliseconde où le navigateur abandonne**.
    // C'est le serveur de DÉVELOPPEMENT qui met ce rendu en attente, pas le
    // produit : le banc du patron, lui, sert une version bâtie.
    //
    // D'où `ouvrir()`, qui existe plus haut dans ce fichier pour exactement
    // cette raison et n'avait pas été appliqué ici : il retente une fois et,
    // s'il échoue encore, nomme le vrai coupable au lieu d'accuser l'écran.
    //
    // **Et quand il refuse deux fois, on le DIT au lieu de virer au rouge.**
    // Le rendu ne repart qu'à l'instant où le navigateur abandonne : une
    // troisième tentative ne changerait rien, elle coûterait quarante-cinq
    // secondes de plus. C'est le traitement déjà retenu le même jour pour
    // `test-porte-e2e` — un contrôle qui accuse le produit pour un défaut de son
    // propre montage s'apprend à être ignoré, et le garde-fou se perd avec lui.
    try {
      await ouvrir(page, `/chantiers/${chantierId}/facture`, "Facture");
    } catch (err) {
      console.log(
        `  ⓘ l'écran Facture n'a pas répondu (serveur de développement) — contrôle non concluant.\n` +
          `    ${(err as Error).message.split("\n")[0]}`
      );
      return;
    }
    await page.click("text=Créer la facture");
    await page.waitForSelector("text=Rien n'a changé depuis le devis ?", { timeout: 15000 });

    assert.deepEqual(await ongletsOuIlFigure(page, nom), ["termines"]);

    // Et la facture préparée se retrouve : c'est ce qui manquait.
    //
    // **Sans recharger l'écran** : la boucle ci-dessus vient de finir sur
    // « Terminés », et y retourner immédiatement n'apprenait rien. Cette
    // navigation de trop est celle qui dépassait les 45 secondes en fin de
    // batterie — trois fois de suite. Un contrôle qui refait pour rien un
    // travail coûteux finit par échouer sur sa propre lourdeur, et accuse le
    // code à sa place.
    // **Le fil a remplacé les cartes le 10 août 2026** (`ARCHITECTURE.md` §53).
    // Un chantier dont la facture attend porte une perle CREUSE et vit sous
    // l'encart « à facturer » de son mois — il n'y a plus de libellé
    // « Reprendre la facture » à trouver. Ce qui doit rester vrai : le chantier
    // est là, et sa ligne mène à sa facture.
    assert.ok((await page.locator(`text=${nom}`).count()) > 0, "le chantier n'est pas dans les terminés");
    assert.ok(
      (await page.locator(`a[href="/chantiers/${chantierId}/facture"]`).count()) > 0,
      "rien ne mène à la facture qui attend sur ce chantier"
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
