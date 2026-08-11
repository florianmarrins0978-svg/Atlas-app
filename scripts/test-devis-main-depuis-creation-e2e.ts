import { lancerNavigateur } from "./e2e-browser";
import type { Locator } from "playwright";
import assert from "node:assert/strict";
import { Pool } from "pg";

// **« Ça m'ouvre la page du devis complet, avec les informations du client
// qui se seront ajoutées automatiquement ? C'est bien ça ? »**
//
// Le patron, le 11 août 2026, avant de valider la porte posée sur l'écran de
// création. Sa question portait sur une crainte précise : qu'en partant de là,
// le devis arrive **orphelin** — sans le nom, sans l'adresse, sans le téléphone
// qu'il venait de taper.
//
// La réponse est oui, et elle tient à une chose qui n'a rien d'évident : le
// chantier est créé D'ABORD, puis le devis s'ouvre. C'est ce qui permet à
// `devis-complet/page.tsx` de relire le client rattaché au chantier. Sauter la
// création pour « gagner du temps » produirait exactement le devis orphelin
// qu'il redoutait.
//
// Ce que cette suite tient :
//
//   1. la porte mène au devis complet, **et le chantier existe vraiment** en
//      base — un devis sans chantier n'aurait aucun client à lire ;
//   2. le client saisi se retrouve **sur le devis**, nom et adresse ;
//   3. le bouton, laissé sur son choix par défaut, mène toujours à la fiche. Le
//      jour où les deux chemins se confondraient, la sortie de secours
//      deviendrait le chemin ordinaire — et personne ne dicterait plus rien.
//
// **La porte a changé de forme le 11 août 2026 au soir.** Ce n'était plus un
// lien sous le bouton — « on ne voit que création de chantier, on ne voit pas
// devis à la main » — mais une BASCULE au-dessus : on touche « Je l'écris », et
// le bouton unique change de libellé. Ce que cette suite éprouve n'a pas
// changé ; la façon de l'atteindre, si.

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const BASE = "http://localhost:3000";

let echecs = 0;

/**
 * **Le libellé qu'on LIT sur le bouton — pas ce que `innerText` rend.**
 *
 * Les deux libellés vivent en même temps dans le bouton, superposés dans la
 * même case de grille, l'un à `opacity:0` : c'est ce qui empêche le bouton de
 * changer de largeur au moment du choix. Mais `innerText` ne connaît pas
 * l'opacité — il rendrait TOUJOURS les deux. Un contrôle écrit dessus passerait
 * au vert quel que soit l'état, y compris sur une bascule complètement morte :
 * il ne saurait pas échouer, donc il ne prouverait rien.
 *
 * On lit donc le style calculé. Et l'on attend que le fondu (260 ms) soit fini :
 * pendant sa première moitié, l'ancien libellé est encore au-dessus de 0,5, et
 * conclure là donnerait l'état d'AVANT — le piège exact déjà payé sur les
 * maquettes (`scripts/verifier-maquette-bascule.mjs`).
 */
async function libelleLu(bouton: Locator): Promise<string> {
  await bouton.page().waitForTimeout(500);
  return bouton.evaluate((b) =>
    [...b.querySelectorAll("span")]
      .filter((s) => s.childElementCount === 0 && Number(getComputedStyle(s).opacity) > 0.5)
      .map((s) => s.textContent?.trim() ?? "")
      .join(" | ")
  );
}

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
  console.log("=== Le devis à la main, depuis l'écran de création ===\n");

  const navigateur = await lancerNavigateur();
  const contexte = await navigateur.newContext();
  const page = await contexte.newPage();

  await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  await page.fill('input[name="email"]', "demo@atlas.local");
  await page.fill('input[name="password"]', "demo1234");
  await page.click('button[type="submit"]');
  await page.waitForURL(`${BASE}/`, { timeout: 30_000 });

  const client = `M. Lemoine ${Date.now()}`;
  const adresse = "8 chemin des Peupliers, Nantes";

  await page.goto(`${BASE}/chantiers/nouveau`, { waitUntil: "networkidle" });
  await page.fill('input[placeholder="M. Bernard"]', client);
  await page.fill('input[placeholder="06 12 34 56 78"]', "0699887766");
  await page.fill('input[placeholder="12 rue des Lilas, Nantes"]', adresse);

  const versLaMain = page.getByRole("button", { name: /je l'écris/i });
  const bouton = page.locator('[data-atlas="action-creation"] button');

  await cas("la porte est sur l'écran de création, et une seule fois", async () => {
    assert.equal(
      await versLaMain.count(),
      1,
      "aucune porte vers le devis à la main sur l'écran de création — ou plusieurs"
    );
  });

  // **Le libellé doit suivre le choix, sinon la bascule ment.** C'était toute
  // la demande : voir les deux chemins. Un bouton qui resterait sur « Créer le
  // chantier » après un appui sur « Je l'écris » enverrait le patron ailleurs
  // que là où il croit aller.
  await cas("toucher « Je l'écris » change le libellé du bouton", async () => {
    assert.match(await libelleLu(bouton), /Créer le chantier/, "au repos, le bouton doit proposer la dictée");
    await versLaMain.click();
    assert.match(
      await libelleLu(bouton),
      /Ouvrir le devis/,
      "le bouton n'a pas suivi le choix : la bascule ne sert à rien"
    );
  });

  await cas("elle mène au devis complet, et le chantier existe vraiment", async () => {
    await bouton.click();
    await page.waitForURL(/\/chantiers\/[0-9a-f-]{36}\/devis-complet$/, { timeout: 30_000 });

    const chantierId = page.url().split("/").slice(-2)[0];
    const { rows } = await pool.query(
      `select c.id, c.adresse_chantier, cl.nom, cl.telephone
         from chantiers c
         left join clients cl on cl.id = c.client_id
        where c.id = $1`,
      [chantierId]
    );
    assert.ok(rows[0], "le devis s'est ouvert sur un chantier qui n'existe pas en base");
    assert.equal(rows[0].nom, client, "le client n'a pas été enregistré : le devis sera orphelin");
    assert.equal(rows[0].telephone, "0699887766", "le téléphone saisi a été perdu en chemin");
    assert.equal(rows[0].adresse_chantier, adresse, "l'adresse du chantier a été perdue en chemin");
  });

  // **On lit la VALEUR des champs, pas le texte de la page.**
  //
  // Une première version de ce contrôle a crié au défaut sur une application
  // parfaitement saine : l'en-tête du devis est fait de champs éditables
  // (`ChampNu`), et `innerText` ne rend jamais la valeur d'un `<input>`. Le nom
  // était bien là, à l'écran, sous les yeux — et le contrôle annonçait
  // exactement la panne que le patron redoutait. Une erreur qui accuse à tort
  // coûte plus cher que pas d'erreur du tout (`AGENTS.md`).
  await cas("le devis porte le client, sans qu'on ait rien retapé", async () => {
    await page.waitForSelector("text=DEVIS", { timeout: 30_000 });
    for (const [quoi, aria, attendu] of [
      ["le nom du client", "Nom du client", client],
      ["l'adresse", "Adresse du client", "Peupliers"],
      ["le téléphone", "Téléphone du client", "0699887766"],
    ] as const) {
      const champ = page.getByLabel(aria);
      assert.equal(await champ.count(), 1, `le devis n'a pas de champ « ${aria} »`);
      const lu = await champ.inputValue();
      assert.ok(
        lu.includes(attendu),
        `${quoi} n'est pas repris sur le devis — il devrait le retaper. Lu : « ${lu} »`
      );
    }
  });

  // **Le contrôle qui protège du remède.** Si le bouton menait au devis SANS
  // qu'on ait touché la bascule, la sortie de secours deviendrait le chemin
  // ordinaire — et la dictée, qui EST le produit, ne serait plus jamais
  // proposée en premier. C'est le choix par défaut qui est éprouvé ici : on ne
  // touche rien, et l'on doit arriver sur la fiche.
  await cas("sans toucher la bascule, le bouton mène toujours à la fiche", async () => {
    await page.goto(`${BASE}/chantiers/nouveau`, { waitUntil: "networkidle" });
    await page.fill('input[placeholder="M. Bernard"]', `M. Ordinaire ${Date.now()}`);
    await page.click('button:has-text("Créer le chantier")');
    await page.waitForURL(/\/chantiers\/[0-9a-f-]{36}$/, { timeout: 30_000 });
    assert.ok(
      !page.url().endsWith("/devis-complet"),
      "le bouton principal ouvre le devis : la dictée n'est plus proposée en premier"
    );
    await page.waitForSelector('[data-atlas="anneau-note-vocale"]', { timeout: 30_000 });
  });

  await navigateur.close();
  await pool.end();

  console.log(`\n${echecs === 0 ? "✅" : "❌"} Devis à la main depuis la création — ${echecs} échec(s).`);
  process.exit(echecs === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
