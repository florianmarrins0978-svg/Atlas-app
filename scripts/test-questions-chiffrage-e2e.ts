import assert from "node:assert";
import { Client } from "pg";
import { lancerNavigateur } from "./e2e-browser";

// L'arrêt d'avant-chiffrage, parcouru comme le patron le parcourt.
//
// **Ce qu'aucune autre suite ne verrait.** Les règles du métier sont éprouvées
// à part, sans base (`test-questions-chiffrage.ts`) ; la persistance l'est
// aussi (`test-precisions-chantier.ts`). Ce qui n'existe nulle part ailleurs,
// c'est la chaîne : il dicte, l'agent l'arrête, il répond d'un pouce, et le
// devis se termine avec sa réponse écrite dessus.
//
// C'est aussi le seul contrôle qui verrait un arrêt devenu un formulaire — le
// défaut qui ferait qu'il cesse de s'en servir.

const DICTEE = `Alors il y a une taille de haie de laurier, vingt mètres de long, un chêne mort à abattre, de vingt mètres de haut. On coupe le bois en cinquante centimètres, on le laisse sur place, on le fend. Pour ce faire, on aura besoin d'un camion, un broyeur et une fendeuse. J'estime le temps de travail à deux jours deux hommes.`;

/**
 * Crée un chantier **à elle** et y pose la dictée de référence.
 *
 * **Pourquoi pas le chantier de démonstration** — la première version le
 * reprenait, et elle a rougi deux suites qui n'avaient rien demandé : le
 * lanceur sème la base UNE fois pour les trente suites, et récrire la dictée du
 * seed retirait à `test-transcription-e2e` le texte qu'elle vérifie. Le défaut
 * ne se voyait pas ici, où chaque suite est jouée seule ; il se voyait en CI,
 * sur une suite qui n'était pas la mienne.
 *
 * Une suite qui abîme les données d'une autre est pire qu'une suite absente :
 * elle accuse un code innocent.
 */
async function preparerChantier(): Promise<string> {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    const { rows: e } = await client.query(
      `SELECT id FROM entreprises ORDER BY created_at LIMIT 1`
    );
    assert.ok(e[0], "Aucune entreprise en base : le jeu de démonstration n'a pas été semé.");
    const entrepriseId = e[0].id as string;

    await client.query(`SELECT set_config('app.entreprise_id', $1, false)`, [entrepriseId]);
    const { rows: ch } = await client.query(
      `INSERT INTO chantiers (entreprise_id, nom) VALUES ($1, $2) RETURNING id`,
      [entrepriseId, `Essai questions ${process.pid}`]
    );
    const chantierId = ch[0].id as string;

    await client.query(
      `INSERT INTO notes_vocales (entreprise_id, chantier_id, storage_key, mime_type, taille_octets, checksum, transcription, transcription_statut)
       VALUES ($1, $2, NULL, 'audio/webm', 0, 'essai', $3, 'reussie')`,
      [entrepriseId, chantierId, DICTEE]
    );
    console.log(`   chantier d'essai : ${chantierId}`);
    return chantierId;
  } finally {
    await client.end();
  }
}

async function precisionsEnregistrees(chantierId: string): Promise<{ sujet: string; lisible: string }[]> {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    const { rows } = await client.query(
      `SELECT sujet, lisible FROM precisions_chantier WHERE chantier_id = $1 ORDER BY sujet`,
      [chantierId]
    );
    return rows;
  } finally {
    await client.end();
  }
}

async function main() {
  const chantierId = await preparerChantier();
  const browser = await lancerNavigateur();
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    await page.goto("http://localhost:3000/login", { waitUntil: "networkidle" });
    await page.fill('input[name="email"]', "demo@atlas.local");
    await page.fill('input[name="password"]', "demo1234");
    await page.click('button[type="submit"]');
    await page.waitForURL("http://localhost:3000/", { timeout: 20000 });

    await page.goto(`http://localhost:3000/chantiers/${chantierId}/transcription`, { waitUntil: "networkidle" });
    await page.click("text=Créer le devis à partir de ma dictée");

    // --- L'arrêt doit venir -------------------------------------------------
    const bloc = page.locator("text=avant de chiffrer");
    await bloc.first().waitFor({ timeout: 60000 });

    const texte = await page.locator("body").innerText();
    assert.match(
      texte,
      /Comment s'abat-il\s*\?/,
      "L'agent n'a pas demandé la technique — c'est pourtant elle qui fait 600 € ou 1 400 €."
    );
    assert.match(texte, /diamètre/i, "L'agent n'a pas demandé le diamètre.");

    // --- Et il doit rester franchissable ------------------------------------
    //
    // **Pourquoi on compte, au lieu de vérifier quelles questions manquent.**
    // Cette suite tourne aussi bien avec un modèle qu'en recopie littérale (la
    // CI n'a que des clés factices). Or les deux lectures ne produisent pas les
    // mêmes libellés : avec un modèle, « vingt mètres de long » est rattaché à
    // la haie et la question ne se pose pas ; en recopie, elle se pose — et
    // c'est honnête, puisque personne n'a compris à quoi ces mètres se
    // rapportaient. Le piège est réel : « vingt mètres » figure DEUX FOIS dans
    // cette dictée, pour la haie et pour la hauteur du chêne
    // (`docs/EXEMPLE-DICTEE.md` §3).
    //
    // Ce qui doit tenir dans les deux cas, c'est la promesse d'AGENT.md §2 :
    // l'arrêt reste franchissable. On compte donc les questions. Le détail de
    // ce qui se demande et de ce qui se tait est éprouvé sur une lecture
    // maîtrisée, dans `test-questions-chiffrage.ts`.
    const posees = await page.locator("text=/^(Une précision|\\d+ précisions) avant de chiffrer$/").innerText();
    const combien = /^(\d+)/.exec(posees) ? Number(/^(\d+)/.exec(posees)![1]) : 1;
    assert.ok(combien <= 3, `${combien} questions posées : l'arrêt devient un formulaire, il le contournera.`);

    // --- Il répond d'un pouce -----------------------------------------------
    // Le bouton, pas le paragraphe. « démontage avec rétention » figure aussi
    // dans la phrase qui explique pourquoi la question est posée : viser le
    // texte cliquait la explication, aucune option n'était retenue, et le
    // contrôle passait quand même — vert sur une réponse jamais donnée.
    await page.locator("button", { hasText: /^Démontage avec rétention$/ }).click();
    // Ciblé par son libellé : en recopie littérale, l'écran porte aussi le
    // champ « longueur de haie », et un sélecteur sur le type remplirait le
    // mauvais — le contrôle passerait alors au vert sur un diamètre absent.
    await page.fill('input[aria-label="Quel diamètre fait le tronc ?"]', "70");
    // Le libellé du bouton dit la vérité sur ce qui va se passer : « Continuer
    // vers le devis » quand tout est renseigné, « Continuer sans répondre à
    // tout » sinon. Les deux mènent au devis — on vise donc le geste, pas le mot.
    await page.locator("button", { hasText: /^Continuer/ }).first().click();

    // --- Et sa réponse se retrouve sur la fiche du chantier -----------------
    //
    // **Sur la prestation, pas sur la ligne du devis** — et c'est délibéré, pas
    // un pis-aller mal assumé. La ligne du devis porte l'intitulé du tarif
    // appliqué ; le montant, lui, ne peut pas encore dépendre de la technique,
    // faute de mémoire reliant les deux (`docs/EXEMPLE-DICTEE.md` §9c : « tant
    // que la mémoire est vide, aucun multiplicateur ne s'applique »). Affirmer
    // ici que le devis en porte la trace ferait passer au vert une promesse que
    // le produit ne tient pas.
    await page.waitForURL(`**/chantiers/${chantierId}/devis-complet`, { timeout: 60000 });
    await page.goto(`http://localhost:3000/chantiers/${chantierId}/informations`, { waitUntil: "networkidle" });
    // Les prestations y sont des champs de saisie : `innerText` ne rend PAS
    // leur valeur, et une assertion sur le texte de la page passerait au rouge
    // en accusant le produit d'un tort qui n'est qu'un mauvais sélecteur.
    const champs = await page.locator("input").evaluateAll((els) =>
      els.map((e) => (e as HTMLInputElement).value).join(" | ")
    );
    const fiche = `${await page.locator("body").innerText()} ${champs}`;
    assert.match(
      fiche,
      /démontage avec rétention/i,
      "La technique qu'il vient d'indiquer n'apparaît nulle part : la question a été posée pour rien."
    );
    assert.match(fiche, /70\s*cm/, "Le diamètre n'apparaît pas sur la fiche du chantier.");

    // --- Et elle est conservée ----------------------------------------------
    const gardees = await precisionsEnregistrees(chantierId);
    const sujets = gardees.map((g) => g.sujet).join(", ");
    assert.ok(
      gardees.some((g) => g.sujet.startsWith("abattage.technique")),
      `la technique n'a pas été conservée (gardé : ${sujets})`
    );
    assert.ok(
      gardees.some((g) => g.sujet.startsWith("abattage.diametre")),
      `le diamètre n'a pas été conservé (gardé : ${sujets})`
    );

    // --- Rejouer ne repose pas les mêmes questions --------------------------
    // Le défaut qui ferait abandonner l'arrêt : répondre, rejouer, et se voir
    // redemander la même chose.
    await page.goto(`http://localhost:3000/chantiers/${chantierId}/transcription`, { waitUntil: "networkidle" });
    await page.click("text=Créer le devis à partir de ma dictée");
    const reposees = page.locator("text=avant de chiffrer");
    await Promise.race([
      page.waitForURL(`**/chantiers/${chantierId}/devis-complet`, { timeout: 60000 }),
      reposees.first().waitFor({ timeout: 60000 }),
    ]);
    if (await reposees.count()) {
      const restant = await page.locator("body").innerText();
      assert.doesNotMatch(
        restant,
        /Comment s'abat-il|Quel diamètre/,
        "Une question déjà répondue est reposée : l'arrêt se rouvre tout seul, il finira par le contourner."
      );
    }

    console.log("✅ L'agent s'arrête sur ce qui coûte, reste franchissable, conserve la réponse et l'écrit sur la prestation.");
  } finally {
    await browser.close();
  }
}

main().catch((e: Error) => {
  console.error(`❌ ${e.message}`);
  process.exit(1);
});
