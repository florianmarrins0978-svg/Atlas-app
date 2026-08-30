import { lancerNavigateur } from "./e2e-browser";
import assert from "node:assert/strict";
import { Pool } from "pg";
import { creerPuisFiche } from "./_creer-chantier-e2e";

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
// **La porte a changé de forme deux fois.** Le 11 août 2026 au soir, le lien
// discret est devenu une BASCULE au-dessus d'un bouton unique — « on ne voit
// que création de chantier, on ne voit pas devis à la main ». Le 18 août, la
// bascule a cédé la place à DEUX BOUTONS, « Je dicte mon devis » et « J'écris
// mon devis », chacun portant sa destination (sa demande, puis « la 5, mais
// sans les flèches »). Ce que cette suite éprouve n'a pas changé ; la façon de
// l'atteindre, si — et c'est bien pour ça qu'elle vise des repères
// `data-atlas`, pas des libellés.

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
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
  await page.fill('input[placeholder="Bernard"]', client);
  await page.fill('input[placeholder="06 12 34 56 78"]', "0699887766");
  await page.fill('input[placeholder="12 rue des Lilas, Nantes"]', adresse);

  const leBouton = page.locator('[data-atlas="action-ecrire"]');

  // **UN SEUL bouton depuis le 21 août 2026** : *« garde un seul bouton, garde
  // je rédige mon devis »*. Le second — « Je dicte mon devis » — n'a plus
  // d'objet : la dictée se fait sur cet écran, à l'anneau. Ce contrôle tenait
  // les deux boutons ; il tient maintenant le seul, et surtout ce qui a pris la
  // place de l'autre (`CLAUDE.md` §5 bis : on adapte le contrôle, on ne remet
  // pas ce qu'il a fait retirer).
  await cas("un seul bouton d'action, et une seule fois", async () => {
    assert.equal(await leBouton.count(), 1, "il n'y a pas exactement un bouton d'action sur cet écran");
    assert.equal(
      await page.locator("button", { hasText: "Je dicte mon devis" }).count(),
      0,
      "« Je dicte mon devis » est revenu : il a demandé qu'il n'y en ait plus qu'un"
    );
  });

  // **Ce qu'il DIT, et sans flèche.** Sa correction du 18 août était littérale
  // — « la 5, mais sans les flèches » —, et une flèche revenue par mégarde ne
  // se verrait dans aucun autre contrôle.
  //
  // **« Je rédige À LA MAIN » depuis le 30 août 2026**, et c'est lui qui l'a
  // écrit : *« le bouton change par "je rédige à la main", mais ça doit être un
  // bouton secondaire, car l'idée c'est qu'il utilise en priorité la note
  // vocale »*. Le mot change parce que la hiérarchie a changé : ce n'est plus
  // la façon normale de faire un devis, c'est l'autre.
  await cas("le libellé est le sien, et sans flèche", async () => {
    assert.equal((await leBouton.innerText()).trim(), "Je rédige à la main");
  });

  // **La dictée n'a pas disparu : elle a DÉMÉNAGÉ ici.** C'est la contrepartie
  // du bouton retiré, et sans ce contrôle le retrait pourrait passer pour un
  // appauvrissement — c'est exactement ce qu'il a reproché le 21 août au soir.
  await cas("l'anneau et le carré photo sont sur la fiche client", async () => {
    assert.equal(
      await page.locator('[data-atlas="anneau-note-vocale"]').count(),
      1,
      "l'anneau manque : le bouton de la dictée a été retiré sans que la dictée arrive"
    );
    // **On vise la MARQUE, pas la valeur de l'attribut.** Cette ligne cherchait
    // `accept="image/*"` : la liste blanche d'images du 24 août (audit, constat
    // M2) l'a fait rougir sur du code juste. Ce qu'il faut tenir ici, c'est que
    // le carré photo EXISTE — pas ce qu'il accepte, qui a vocation à bouger
    // (`CLAUDE.md` §5 bis).
    assert.ok(
      await page.locator('input[type="file"][data-atlas="carre-photo"]').count(),
      "le carré photo manque sur la fiche client"
    );
  });

  // **Plus rien ne doit annoncer « Créer le chantier ».** C'était le libellé du
  // bouton unique ; le laisser traîner ferait trois actions à l'écran là où il
  // en a demandé deux.
  await cas("la bascule et son bouton ont bien disparu", async () => {
    const ecran = await page.locator("form").innerText();
    for (const disparu of ["Je dicterai", "Je l'écris", "Créer le chantier"]) {
      assert.ok(!ecran.includes(disparu), `l'écran dit encore « ${disparu} »`);
    }
  });

  await cas("elle mène au devis complet, et le chantier existe vraiment", async () => {
    await leBouton.click();
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

  // **Le seul bouton mène AU DEVIS**, et c'est ce qu'il dit. Un libellé qui
  // annonce le devis et ouvre autre chose est le défaut le plus coûteux d'un
  // écran à un seul geste : rien à l'écran ne le trahirait.
  await cas("« Je rédige à la main » ouvre bien le devis", async () => {
    await page.goto(`${BASE}/chantiers/nouveau`, { waitUntil: "networkidle" });
    await page.fill('input[placeholder="Bernard"]', `M. Ordinaire ${Date.now()}`);
    await page.click('[data-atlas="action-ecrire"]');
    await page.waitForURL(/\/chantiers\/[0-9a-f-]{36}\/devis-complet$/, { timeout: 30_000 });
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
