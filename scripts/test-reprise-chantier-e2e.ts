import assert from "node:assert/strict";
import { lancerNavigateur } from "./e2e-browser";
import { creerPuisFiche } from "./_creer-chantier-e2e";
import { Pool } from "pg";

// **« Il n'y a pas de mémoire dans les actions. »** — le patron, 13 août 2026.
//
// Sa séquence, rejouée telle qu'il l'a décrite : il rédige son devis, se trompe
// de prix, corrige, **fait retour sans faire exprès**, retombe sur la liste des
// chantiers, et reclique son chantier. Il devait alors refaire toutes les
// étapes une à une alors qu'il ne lui restait qu'à envoyer.
//
// Sa demande : *« que ça me renvoie à l'étape où je me suis arrêté. Donc là, en
// l'occurrence, j'étais sur la page où je devais ouvrir le SMS pour envoyer le
// devis. Ça doit m'envoyer là. »*
//
// **Pourquoi une suite NAVIGATEUR alors que la règle est pure.**
// `test-reprendre-ou-il-en-etait.ts` couvre déjà la règle, cas par cas. Mais
// elle ne dit rien du fil réel : que la liste porte bien ce lien, que la ligne
// soit cliquable, et qu'on arrive sur un écran qui offre l'envoi. C'est ce
// parcours-là qu'il a fait, et c'est celui-là qui était cassé.

const BASE = "http://localhost:3000";
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function main() {
  const navigateur = await lancerNavigateur();
  const contexte = await navigateur.newContext();
  const page = await contexte.newPage();

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

  await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
  await page.fill('input[name="email"]', "demo@atlas.local");
  await page.fill('input[name="password"]', "demo1234");
  await page.click('button[type="submit"]');
  await page.waitForURL(`${BASE}/`, { timeout: 20000 });

  console.log("--- Rouvrir un chantier, c'est reprendre ---");

  // **Repéré par un fragment du nom du CLIENT, jamais par le libellé du
  // chantier.** Le 13 août 2026, `main` a changé la façon de nommer un chantier
  // — « Monsieur Martins » remplace « Chez M. Martins » (`ARCHITECTURE.md`
  // §77) — et cette suite, écrite le même jour sur une autre branche, cherchait
  // « Chez … ». Elle rougissait alors sur la reprise, qui n'y était pour rien.
  const marque = `Martins ${Date.now()}`;
  const client = `M. ${marque}`;
  await page.goto(`${BASE}/chantiers/nouveau`, { waitUntil: "networkidle" });
  // **Repéré par son ÉTIQUETTE, pas par son exemple.** Le repère
  // `placeholder="M. Bernard"` est passé à « Bernard » le 13 août 2026, quand la
  // civilité s'est choisie au-dessus du nom : cette suite rougissait alors sur
  // la reprise, alors qu'elle ne trouvait plus le champ. Une étiquette change
  // moins souvent qu'un exemple, et elle dit ce que le champ EST.
  await page.getByLabel(/Nom du client/i).fill(client);
  await page.fill('input[placeholder="06 12 34 56 78"]', "06 12 34 56 78");
  await creerPuisFiche(page);
  await page.waitForURL(/\/chantiers\/[0-9a-f-]{36}/, { timeout: 30000 });
  const fiche = page.url();
  const id = fiche.split("/").pop()!;

  await cas("un chantier neuf se rouvre LÀ OÙ IL EN EST", async () => {
    // Son deuxième exemple, le 17 août : « si je me suis arrêté à mettre des
    // photos et à rédiger la note vocale, il faut que ça me remette à cette
    // page-là ».
    //
    // **Ce que « cette page-là » désigne a changé le 21 août 2026, et c'est
    // lui qui l'a décidé** : les photos et la dictée vivent maintenant sur la
    // fiche client, et le seul bouton de cet écran mène au devis. Un chantier
    // créé porte donc un devis dès sa naissance — et sa consigne est alors
    // sans ambiguïté : *« si elle est créée et qu'on a rempli le devis, alors
    // on doit rouvrir la page du devis directement »*.
    //
    // Ce que ce contrôle défend n'a pas bougé : la ligne de l'accueil ramène à
    // l'étape en cours, jamais à l'accueil d'un autre écran. C'est la
    // DESTINATION qui suit le parcours, pas la promesse.
    await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
    const lien = page.locator(`a:has-text("${marque}")`).first();
    await lien.waitFor({ state: "visible", timeout: 20000 });
    const href = await lien.getAttribute("href");
    // **La fiche du chantier n'est plus une réponse acceptable** (4 septembre
    // 2026, `ARCHITECTURE.md` §254) : son adresse ne rend qu'une redirection,
    // et la laisser ici accepterait un aller-retour invisible au patron.
    assert.equal(
      href,
      `/chantiers/${id}/devis-complet`,
      `la ligne mène à « ${href} » au lieu du devis où il s'est arrêté`
    );
  });

  // Il pose son prix — « j'ai enregistré le nouveau prix ».
  await page.goto(`${fiche}/prix`, { waitUntil: "networkidle" });
  await page.click("text=+ Ajouter une ligne");

  // **On attend que la ligne EXISTE, on ne compte pas 400 ms.** L'écran des prix
  // porte d'autres champs que ceux de la ligne — la proposition de prix en a —,
  // si bien qu'un `nth(0)`/`nth(1)` lancé trop tôt visait à côté : le libellé
  // arrivait, le montant non. Le devis s'ouvrait alors sur une ligne à zéro, et
  // le rouge accusait l'écran d'arrivée, qui n'y était pour rien.
  const champs = page.locator("form input");
  for (const essai of [1, 2, 3, 4, 5]) {
    if ((await champs.count()) >= 2) break;
    await page.waitForTimeout(essai * 300);
  }
  await champs.nth(0).fill("Abattage d'un chêne");
  await champs.nth(1).fill("1200.00");
  await champs.nth(1).blur();

  // **Puis on attend que LA BASE l'ait reçu — pas l'écran.**
  //
  // Une première version relisait le total affiché, et elle a laissé passer le
  // défaut qu'elle prétendait attraper : l'écran des prix montre le montant
  // qu'on vient de taper AVANT que le serveur ait répondu. Sous une batterie
  // entière, la garde lisait donc « 1 200,00 € » sur une base encore vide, se
  // déclarait satisfaite, et c'est l'écran d'arrivée — rendu par le serveur,
  // lui — qui affichait 0,00 € deux cas plus loin et se faisait accuser.
  //
  // Lire l'écran pour prouver un enregistrement, c'est mesurer ce qu'on vient
  // de taper (`CLAUDE.md` §5 bis : viser plus profond qu'un libellé).
  let montantEnBase = "";
  const finAttente = Date.now() + 20_000;
  do {
    const { rows } = await pool.query(
      `SELECT COALESCE(sum(montant), 0)::text AS total FROM lignes_prix WHERE chantier_id = $1`,
      [id]
    );
    montantEnBase = rows[0].total;
    if (Number(montantEnBase) >= 1200) break;
    await page.waitForTimeout(200);
  } while (Date.now() < finAttente);

  // **Et l'on ACCUSE le bon coupable.** Sans cela, un prix non enregistré passait
  // inaperçu ici et faisait rougir l'écran d'arrivée deux cas plus loin — « le
  // total n'est pas montré avant l'envoi » —, qui n'y était pour rien.
  assert.equal(
    Number(montantEnBase),
    1200,
    `le prix n'a jamais atteint la base (total lu : ${montantEnBase}) : rien de ce que cette suite affirme ensuite n'a de sens`
  );

  await cas("SA SÉQUENCE : retour par mégarde, puis la ligne le ramène à l'envoi", async () => {
    // Il était allé jusqu'à l'écran d'envoi — le devis lui-même depuis le
    // 20 août 2026, où « Choisir la date » ouvre le calendrier
    // (`ARCHITECTURE.md` §136). L'ancienne adresse `/export` n'est plus qu'un
    // renvoi tant que le devis n'est pas parti.
    await page.goto(`${fiche}/devis-complet`, { waitUntil: "networkidle" });
    // « J'ai fait retour sans faire exprès. »
    await page.goto(`${BASE}/`, { waitUntil: "networkidle" });

    const lien = page.locator(`a:has-text("${marque}")`).first();
    await lien.waitFor({ state: "visible", timeout: 20000 });
    assert.equal(
      await lien.getAttribute("href"),
      `/chantiers/${id}/devis-complet`,
      "la ligne ramène à la fiche : il devra refaire les étapes une à une"
    );

    await lien.click();
    await page.waitForURL(new RegExp(`/chantiers/${id}/devis-complet`), { timeout: 20000 });
  });

  await cas("et l'écran d'arrivée offre l'envoi, sans étape de plus", async () => {
    // `waitForURL` se résout dès que l'adresse change : le rendu, lui, arrive
    // après. Lire le texte tout de suite mesurait un écran encore vide, et le
    // rouge accusait l'envoi — qui n'y était pour rien.
    await page.waitForSelector("text=Choisir la date", { timeout: 20000 });
    // **Le bouton arrive AVANT le montant**, et c'est ce décalage qui faisait
    // rougir cette suite une batterie sur deux : elle lisait « TOTAL HT
    // 0,00 € » — un devis dont les lignes n'étaient pas encore écrites — et
    // accusait l'envoi, qui n'y était pour rien. On attend donc la trace du
    // total, jamais un délai (`TODO.md`, quatre suites du même motif).
    await page
      .locator("text=/1[\\s\\u202f\\u00a0]?440,00/")
      .first()
      .waitFor({ timeout: 20000 })
      .catch(() => undefined);
    const texte = await page.locator("body").innerText();
    // Le geste s'appelle « Choisir la date » depuis le 20 août 2026, et il ne
    // vit plus sur l'écran récapitulatif mais sur le devis lui-même : c'est le
    // raccourci qu'il a demandé, trois écrans devenus deux.
    assert.match(texte, /Choisir la date/, "le geste qui restait n'est pas offert ici");
    // Le montant est sous ses yeux : c'est ce qu'il était venu corriger.
    // **Toute espace, pas l'espace ordinaire.** Le format français pose une
    // espace fine insécable (U+202F) entre les milliers : `/1 440/` ne trouvait
    // rien sur un montant parfaitement affiché, et accusait l'écran.
    assert.match(
      texte,
      /1[\s\u202f\u00a0]?440,00/,
      `le total n'est pas montré avant l'envoi. Vu : ${texte.replace(/\n+/g, " ").slice(0, 200)}`
    );
  });

  await cas("reprendre ne ferme aucune porte — la flèche mène à la fiche client", async () => {
    // **Depuis le 31 août 2026 au soir, elle mène à la fiche CLIENT** et non
    // plus à celle du chantier : *« je veux tout le temps revenir à cette page
    // et seulement celle-là »* (`ARCHITECTURE.md` §230).
    //
    // Ce que ce cas défend n'a pas changé pour autant : que le devis ait une
    // sortie, et qu'elle rouvre ce qu'il avait sous la main. La fiche client
    // porte ses photos et son anneau depuis §226 — reprendre ne ferme donc
    // toujours aucune porte, et la fiche du chantier reste à la barre du bas.
    const retour = page.locator('[data-atlas="retour-du-devis"]').first();
    await retour.waitFor({ state: "visible", timeout: 15000 });
    const cible = await retour.getAttribute("href");
    assert.ok(
      cible?.startsWith(`/chantiers/${id}/coordonnees`),
      `la flèche du devis mène à « ${cible} » : ce n'est pas la fiche client de ce chantier`
    );
  });

  await contexte.close();
  await navigateur.close();
  await pool.end();

  console.log(
    echecs === 0
      ? "\n✅ Reprise du chantier — 0 échec(s).\n"
      : `\n❌ Reprise du chantier — ${echecs} échec(s).\n`
  );
  process.exit(echecs === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
