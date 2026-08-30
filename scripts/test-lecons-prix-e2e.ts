import assert from "node:assert";
import { Client } from "pg";
import { lancerNavigateur } from "./e2e-browser";
import type { Page } from "playwright";

// La mémoire des corrections, parcourue comme le patron la parcourt.
//
// **Ce qu'aucune autre suite ne verrait.** Les règles de rapprochement sont
// éprouvées sans base (`test-lecons-prix.ts`), la persistance aussi
// (`test-lecons-prix-db.ts`). Ce qui n'existe nulle part ailleurs, c'est la
// boucle entière : il chiffre un chantier, puis sur le suivant l'agent lui
// rappelle ce qu'il avait retenu — et il reprend ce prix d'un geste.
//
// C'est aussi le seul contrôle qui verrait un rappel calculé correctement et
// jamais affiché, ou un bouton qui ne persiste pas.

const LIBELLE_PASSE = "Abattage d'un chêne mort — démontage avec rétention, ⌀ 70 cm";
// Diamètre voisin, volontairement différent : c'est le rapprochement par
// tranche de dix centimètres qu'on éprouve ici, pas une égalité de chaînes.
const LIBELLE_DU_JOUR = "Abattage d'un chêne mort — démontage avec rétention, ⌀ 68 cm";

type Terrain = { passe: string; duJour: string; lignePasse: string; entrepriseId: string };

/** Deux chantiers à elle : un déjà chiffré, un à chiffrer. */
async function preparerTerrain(): Promise<Terrain> {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    const { rows: e } = await client.query(`SELECT id FROM entreprises ORDER BY created_at LIMIT 1`);
    assert.ok(e[0], "Aucune entreprise en base : le jeu de démonstration n'a pas été semé.");
    const entrepriseId = e[0].id as string;
    await client.query(`SELECT set_config('app.entreprise_id', $1, false)`, [entrepriseId]);

    const creerChantier = async (nom: string) => {
      const { rows } = await client.query(
        `INSERT INTO chantiers (entreprise_id, nom) VALUES ($1,$2) RETURNING id`,
        [entrepriseId, `${nom} ${process.pid}`]
      );
      return rows[0].id as string;
    };
    const passe = await creerChantier("Chêne déjà chiffré");
    const duJour = await creerChantier("Chêne du jour");

    // Le chantier passé porte une ligne encore à zéro : c'est le patron qui
    // posera le prix par l'écran, pour que la leçon vienne de SON geste et non
    // d'une écriture directe en base. Sans quoi la suite éprouverait la base,
    // pas le produit.
    const { rows: l } = await client.query(
      `INSERT INTO lignes_prix (entreprise_id, chantier_id, libelle, quantite, prix_unitaire, montant)
       VALUES ($1,$2,$3,1,0,0) RETURNING id`,
      [entrepriseId, passe, LIBELLE_PASSE]
    );
    await client.query(
      `INSERT INTO lignes_prix (entreprise_id, chantier_id, libelle, quantite, prix_unitaire, montant)
       VALUES ($1,$2,$3,1,0,0)`,
      [entrepriseId, duJour, LIBELLE_DU_JOUR]
    );
    return { passe, duJour, lignePasse: l[0].id as string , entrepriseId };
  } finally {
    await client.end();
  }
}

const BASE = "http://localhost:3000";

async function main() {
  const terrain = await preparerTerrain();
  const browser = await lancerNavigateur();
  const context = await browser.newContext();
  const page = await context.newPage();

  /**
   * ═══════════════════════════════════════════════════════════════════════
   * **CE QUE LE NAVIGATEUR A RÉELLEMENT ENVOYÉ — et pourquoi il fallait le
   * relever.**
   *
   * Ce contrôle est tombé six fois depuis le 26 août 2026, toujours sur la
   * même phrase : *« le prix 1400 n'est arrivé sur aucune ligne »*. Et six
   * fois, l'enquête a dû repartir de zéro, faute de savoir la seule chose qui
   * tranche : **la requête est-elle partie ?**
   *
   * | Si elle n'est pas partie | l'écran n'a pas enregistré — c'est le CLIENT |
   * | Si elle est partie et a répondu 200 | le serveur a écrit autre chose |
   * | Si elle a répondu autrement | c'est une garde, ou une panne |
   *
   * Le 30 août, un lot de rôles a passé une soirée à départager ces trois cas
   * en rejouant des batteries entières, parce que l'échec ne disait rien.
   * `AGENTS.md` le nomme : **devant un défaut muet, la première livraison
   * n'est pas un correctif, c'est de rendre le défaut bavard.**
   *
   * On n'attend rien de ces requêtes et on n'assouplit rien : elles ne servent
   * qu'à écrire le message d'échec.
   */
  const envois: string[] = [];
  page.on("request", (r) => {
    if (r.method() !== "POST") return;
    if (!r.headers()["next-action"]) return;
    const corps = (r.postData() ?? "").slice(0, 160).replace(/\s+/g, " ");
    envois.push(`→ ${new URL(r.url()).pathname} ${corps}`);
  });
  page.on("response", async (r) => {
    if (r.request().method() !== "POST") return;
    if (!r.request().headers()["next-action"]) return;
    envois.push(`← ${r.status()} sur ${new URL(r.url()).pathname}`);
  });
  const journalDesEnvois = () =>
    envois.length === 0
      ? "AUCUNE action serveur n'est partie du navigateur : l'écran n'a rien envoyé."
      : `ce que le navigateur a envoyé :\n      ${envois.join("\n      ")}`;

  try {
    await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
    await page.fill('input[name="email"]', "demo@atlas.local");
    await page.fill('input[name="password"]', "demo1234");
    await page.click('button[type="submit"]');
    await page.waitForURL(`${BASE}/`, { timeout: 30000 });


  /**
   * Attend que le prix soit ÉCRIT, plutôt que d'écouter passer une requête.
   *
   * **Septième contrôle du même mal en une journée, et le plus instructif.**
   * Il guettait la réponse HTTP de l'action serveur — un délai relevé de 30 à
   * 60 secondes le matin même, pour la même raison. Sous la batterie entière,
   * soixante ne suffisent pas non plus, et quatre-vingt-dix ne feraient que
   * repousser le mur : **une attente calée sur la vitesse de la machine finit
   * toujours par mesurer la machine.**
   *
   * Ce que la suite veut savoir n'est pas qu'une requête est passée, c'est que
   * le prix est en base — c'est cela seul qui apprend quelque chose à l'agent.
   * On regarde donc la base, et l'échec dit ce qu'elle portait vraiment.
   */
  /**
   * Écrit le prix, et VÉRIFIE qu'il est resté dans le champ avant de partir.
   *
   * ─────────────────────────────────────────────────────────────────────────
   * **Ce contrôle est tombé dans QUATRE batteries** — les 26 et 27 août 2026 —
   * en annonçant « le prix 1400 n'est jamais arrivé en base », et il passait
   * seul à chaque fois. Le produit n'y était pour rien.
   *
   * **L'écran de devis se redessine tout seul** : il ajoute une ligne vide,
   * recalcule ses totaux, remplace ses champs. Sur une machine chargée, ce
   * redessin tombe entre la saisie et la sortie du champ — la valeur tapée
   * disparaît avec l'ancien champ, et le `blur` n'enregistre alors rien du
   * tout. La suite attendait ensuite vingt secondes une écriture qui ne
   * pouvait plus venir, puis accusait l'application.
   *
   * **Un délai plus long n'y aurait rien changé** : ce n'est pas une lenteur,
   * c'est une saisie perdue. On relit donc le champ après l'avoir quitté, et
   * l'on recommence tant qu'il ne porte pas la valeur — comme le patron le
   * ferait en voyant son chiffre s'effacer.
   * ─────────────────────────────────────────────────────────────────────────
   */
  const saisirLePrix = async (page: Page, valeur: number) => {
    for (let essai = 1; essai <= 5; essai++) {
      const champ = page.getByLabel("Prix unitaire 1");
      await champ.waitFor({ state: "visible", timeout: 30_000 });
      await champ.fill(String(valeur));
      // L'enregistrement part quand il quitte le champ — c'est là que l'agent
      // apprend.
      await champ.blur();
      await page.waitForTimeout(500 * essai);
      const relu = await page.getByLabel("Prix unitaire 1").inputValue().catch(() => "");
      if (Number(relu) === valeur) return;
    }
    throw new Error(
      `le champ du prix n'a pas gardé « ${valeur} » après cinq tentatives : l'écran le vide ` +
        "plus vite qu'on ne le saisit, et ce n'est pas un défaut d'enregistrement"
    );
  };

  const attendrePrixEcrit = async (chantierId: string, attendu: number) => {
    const lecteur = new Client({ connectionString: process.env.DATABASE_URL });
    await lecteur.connect();
    try {
      // **Le contexte d'entreprise, sinon la RLS rend zéro ligne** — et le
      // contrôle mesurerait zéro, ce qui est pire qu'absent (`CLAUDE.md` §5).
      await lecteur.query(`SELECT set_config('app.entreprise_id', $1, false)`, [terrain.entrepriseId]);
      let lu: unknown = null;
      for (const essai of [0, 1, 2, 3, 4, 5, 6, 7]) {
        if (essai > 0) await new Promise((r) => setTimeout(r, essai * 700));
        // **On cherche le prix parmi TOUTES les lignes, pas sur la première.**
        //
        // Payé le 27 août 2026 : ce contrôle est tombé trois fois en batterie —
        // « Le prix 1400 n'est jamais arrivé en base — lu : "0.00" » — et passait
        // seul à chaque fois. L'écran ajoute une ligne vide à la volée ; sous
        // charge elle est créée AVANT que la saisie parte, elle devient donc la
        // plus ancienne, et `LIMIT 1` lisait son zéro.
        //
        // **Ce que la suite veut savoir n'a jamais été « la première ligne porte
        // le prix », c'est « le prix est arrivé ».** Viser la première était une
        // commodité d'écriture, et elle accusait le produit d'avoir perdu une
        // saisie parfaitement enregistrée.
        const { rows } = await lecteur.query(
          `SELECT prix_unitaire FROM lignes_prix WHERE chantier_id = $1 ORDER BY created_at`,
          [chantierId]
        );
        const prix = rows.map((r) => r.prix_unitaire as string);
        lu = prix.length ? prix : null;
        if (prix.some((p) => Number(p) === attendu)) return;
      }
      assert.fail(
        `Le prix ${attendu} n'est arrivé sur AUCUNE ligne du chantier — lues : ${JSON.stringify(lu)}\n` +
          `    ${journalDesEnvois()}`
      );
    } finally {
      await lecteur.end();
    }
  };

    // --- 1. Il chiffre son chantier, à la main ------------------------------
    await page.goto(`${BASE}/chantiers/${terrain.passe}/devis-complet`, { waitUntil: "domcontentloaded" });
    await page.waitForSelector("text=Total TTC", { timeout: 60000 });
    await saisirLePrix(page, 1400);
    await attendrePrixEcrit(terrain.passe, 1400);

    // --- 2. Sur le chantier suivant, l'agent s'en souvient ------------------
    await page.goto(`${BASE}/chantiers/${terrain.duJour}/devis-complet`, { waitUntil: "domcontentloaded" });
    await page.waitForSelector("text=Total TTC", { timeout: 60000 });

    const ecran = await page.locator("body").innerText();
    assert.match(
      ecran,
      /La dernière fois/i,
      "Aucun rappel : ce qu'il vient de chiffrer n'a rien appris à l'agent."
    );
    assert.match(ecran, /1400 € HT/, "Le rappel ne porte pas le prix qu'il avait retenu.");
    assert.match(
      ecran,
      /⌀ 70 cm/,
      "Le rappel ne dit pas de quel chantier il vient — un chiffre sans source se lit comme un calcul."
    );

    // --- 3. Il le reprend d'un geste, et ça tient ---------------------------
    const reprendre = page.locator("text=Reprendre ce prix").first();
    assert.equal(await reprendre.count(), 1, "Le rappel s'affiche mais ne se reprend pas d'un geste.");
    await reprendre.click();
    await attendrePrixEcrit(terrain.duJour, 1400);

    await page.reload({ waitUntil: "domcontentloaded" });
    await page.waitForSelector("text=Total TTC", { timeout: 60000 });
    // Comparé en nombre, jamais en chaîne : « 1400 » et « 1400.00 » sont le
    // même prix, et l'écran est libre de choisir sa mise en forme. Un contrôle
    // qui exige une écriture précise rougit à la première retouche d'affichage
    // et accuse le produit d'un tort qu'il n'a pas.
    const repris = await page.getByLabel("Prix unitaire 1").inputValue();
    assert.equal(
      Number(repris.replace(",", ".")),
      1400,
      `Le prix repris n'a pas survécu au rechargement : « ${repris} »`
    );

    // --- 4. Et l'agent ne se cite jamais lui-même ---------------------------
    // Le chantier du jour porte maintenant 1 400 € : afficher « la dernière
    // fois : 1 400 € » juste au-dessus n'apprendrait rien et donnerait
    // l'impression d'un agent qui radote.
    const apres = await page.locator("body").innerText();
    const rappels = apres.match(/La dernière fois/gi) ?? [];
    assert.ok(
      rappels.length <= 1,
      `${rappels.length} rappels sur une seule ligne : l'agent se cite lui-même.`
    );

    console.log("✅ Il chiffre, l'agent retient, et le lui rappelle sur le chantier suivant.");
  } finally {
    await browser.close();
  }
}

main().catch((e: Error) => {
  console.error(`❌ ${e.message}`);
  process.exit(1);
});
