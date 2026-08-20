import { lancerNavigateur } from "./e2e-browser";
import assert from "node:assert/strict";
import { Pool } from "pg";

// Le prix accordé au client, sur l'écran du devis.
//
// **Sa demande du 16 août 2026 :** *« si jamais un client me demande une
// réduction, [pouvoir] lui demander "fais cinq pour cent sur le montant du
// devis" »*. Puis son choix, sur `docs/maquettes/61` : *« sous le total et prix
// accordé au client »* — l'arrangement B.
//
// **CE QUE CETTE SUITE TIENT, ET QU'AUCUNE SUITE BASE NE VERRAIT :**
//
//   1. **sans réduction, l'écran ne montre RIEN** de plus qu'avant. Une
//      première version laissait une ligne vide « Prix accordé au client — % »
//      sur tous les devis, pendant que le PDF n'imprimait rien : l'écran et le
//      document se contredisaient. Vu à la CAPTURE, pas au test ;
//   2. les trois lignes de B s'affichent **dans l'ordre**, et les montants
//      tombent juste — 870,00 → 130,50 retirés → 739,50, TVA 147,90 ;
//   3. **la TVA n'est jamais celle du prix plein.** 174,00 € à l'écran, c'est
//      un devis que le client refusera de payer et une déclaration fausse ;
//   4. **elle se retire**, et le devis revient exactement à son prix plein.
//      Sans ce chemin, un 15 % posé par erreur resterait pour toujours ;
//   5. la base porte ce que l'écran affiche. Un total juste à l'écran et faux
//      en base, c'est le PDF qui partirait faux.

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const BASE = "http://localhost:3000";

let echecs = 0;
async function cas(nom: string, fn: () => Promise<void>) {
  try {
    await fn();
    console.log(`  ✓ ${nom}`);
  } catch (e) {
    echecs++;
    console.error(`  ✗ ${nom}\n    ${(e as Error).message}`);
  }
}

async function main() {
  const navigateur = await lancerNavigateur();
  const contexte = await navigateur.newContext({ viewport: { width: 390, height: 900 } });
  const page = await contexte.newPage();

  await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  await page.fill('input[name="email"]', "demo@atlas.local");
  await page.fill('input[name="password"]', "demo1234");
  await page.click('button[type="submit"]');
  await page.waitForURL(`${BASE}/`, { timeout: 20_000 });

  await page.goto(`${BASE}/chantiers/nouveau`, { waitUntil: "networkidle" });
  await page.fill('input[placeholder="Bernard"]', `Mme Remise ${Date.now()}`);
  await page.click('[data-atlas="action-dicter"]');
  await page.waitForURL(/\/chantiers\/[0-9a-f-]{36}/, { timeout: 15_000 });
  const url = page.url();
  const chantierId = url.split("/").pop()!;

  // Le devis de la maquette 61, aux mêmes chiffres : 870,00 € HT.
  await page.goto(`${url}/devis-complet`, { waitUntil: "networkidle" });
  const lignesVoulues = [
    ["Élagage — 3 chênes", "450"],
    ["Broyage des branches", "180"],
    ["Évacuation des déchets verts", "240"],
  ];
  for (const [rang, [libelle, prix]] of lignesVoulues.entries()) {
    await page.click('button:has-text("Ajouter une ligne")');
    const zones = page.locator('textarea[aria-label*="escription"]');
    // **On attend que la ligne EXISTE, on ne compte pas 500 ms.** Sous la
    // batterie, la nouvelle ligne n'était pas encore rendue : `nth(count - 1)`
    // désignait alors la PRÉCÉDENTE, et l'écrasait. Une ligne disparaissait
    // ainsi du devis, le total tombait de 870 à 420, et le rouge accusait
    // l'affichage de la remise — qui n'y était pour rien.
    for (const essai of [1, 2, 3, 4, 5]) {
      if ((await zones.count()) > rang) break;
      await page.waitForTimeout(essai * 300);
    }
    await zones.nth(rang).fill(libelle);
    const prixs = page.locator('input[aria-label*="Prix unitaire"]');
    await prixs.nth(rang).fill(prix);
    await page.keyboard.press("Tab");
    await page.waitForTimeout(400);
  }

  // Et l'on relit jusqu'à voir le devis complet : l'écran rend la main avant que
  // l'enregistrement soit arrivé, et tout ce qui suit en dépend.
  for (const essai of [1, 2, 3, 4]) {
    await page.goto(`${url}/devis-complet`, { waitUntil: "networkidle" });
    if ((await page.locator("body").innerText()).includes("870,00")) break;
    await page.waitForTimeout(essai * 500);
  }

  const totaux = () => page.locator("section").filter({ hasText: "Total TTC" }).last();

  await cas("sans réduction, l'écran est EXACTEMENT celui d'avant", async () => {
    const texte = await totaux().innerText();
    assert.ok(texte.includes("870,00"), `le total plein manque :\n${texte}`);
    // **L'espace des milliers vient d'`Intl`, pas du clavier** : c'est une
    // espace insécable fine (U+202F), qu'un « 1 044,00 » tapé à la main ne
    // contient pas. Le contrôle comparait deux espaces différentes et accusait
    // le TTC d'avoir disparu — une erreur qui envoie chercher au mauvais endroit.
    assert.match(texte.replace(/\s/g, " "), /1 044,00/, "le TTC plein manque");
    assert.ok(
      !texte.includes("après remise"),
      "« Total HT après remise » s'affiche sans qu'aucune remise existe"
    );
    // La ligne vide du premier essai : elle contredisait le PDF, qui n'imprime rien.
    assert.equal(
      await page.locator('input[aria-label="Prix accordé au client, en pourcentage"]').count(),
      0,
      "un champ de remise vide traîne sur un devis qui n'en a pas — l'écran ment sur le document"
    );
  });

  await cas("le chemin pour en poser une existe, et il est discret", async () => {
    const bouton = page.getByRole("button", { name: /Prix accordé au client/ });
    assert.equal(await bouton.count(), 1, "aucun moyen d'accorder un prix sans dicter");
    await bouton.click();
    await page.waitForTimeout(900);
  });

  await cas("15 % : les trois lignes de B, dans l'ordre et aux bons montants", async () => {
    const champ = page.locator('input[aria-label="Prix accordé au client, en pourcentage"]');
    await champ.fill("15");
    await page.keyboard.press("Tab");
    await page.waitForTimeout(900);

    const texte = await totaux().innerText();
    for (const attendu of ["870,00", "130,50", "739,50", "147,90", "887,40"]) {
      assert.ok(texte.includes(attendu), `${attendu} € manque à l'écran :\n${texte}`);
    }
    assert.ok(texte.includes("Total HT après remise"), "le net n'est pas nommé");

    // **L'ordre, mesuré** : le prix plein au-dessus de la remise, la remise
    // au-dessus du net. C'est ce qui permet au client de refaire le calcul.
    const y = async (motif: string) => {
      const el = totaux().locator("div").filter({ hasText: motif }).last();
      const b = await el.boundingBox();
      assert.ok(b && b.height > 0, `« ${motif} » n'occupe aucune place : rien à mesurer`);
      return b!.y;
    };
    const yPlein = await y("Total HT870,00");
    const yRemise = await y("Prix accordé au client");
    const yNet = await y("Total HT après remise");
    assert.ok(yPlein < yRemise, `le prix plein doit être au-dessus (${yPlein} contre ${yRemise})`);
    assert.ok(yRemise < yNet, `la remise doit être au-dessus du net (${yRemise} contre ${yNet})`);
  });

  await cas("la TVA du prix plein ne s'affiche NULLE PART", async () => {
    const texte = await totaux().innerText();
    assert.ok(
      !texte.includes("174,00"),
      "la TVA est calculée sur le prix plein : le devis est faux, et la déclaration aussi"
    );
  });

  await cas("la base porte ce que l'écran affiche", async () => {
    const { rows } = await pool.query(
      `SELECT reduction_pourcent, reduction_montant, total_ht, total_tva, total_ttc
         FROM devis WHERE chantier_id = $1 ORDER BY numero_version DESC LIMIT 1`,
      [chantierId]
    );
    assert.equal(rows.length, 1, "aucun devis en base");
    assert.equal(rows[0].reduction_pourcent, "15.00");
    assert.equal(rows[0].reduction_montant, "130.50");
    assert.equal(rows[0].total_ht, "739.50", "le HT en base n'est pas net : le PDF partirait faux");
    assert.equal(rows[0].total_tva, "147.90");
    assert.equal(rows[0].total_ttc, "887.40");
  });

  await cas("elle se retire, et le devis revient à son prix plein", async () => {
    const champ = page.locator('input[aria-label="Prix accordé au client, en pourcentage"]');
    await champ.fill("");
    await page.keyboard.press("Tab");
    await page.waitForTimeout(1_000);
    await page.reload({ waitUntil: "networkidle" });
    await page.waitForTimeout(600);

    const texte = await totaux().innerText();
    assert.match(texte.replace(/\s/g, " "), /1 044,00/, `le devis n'est pas revenu au prix plein :\n${texte}`);
    assert.ok(!texte.includes("après remise"), "la remise est restée affichée");

    const { rows } = await pool.query(
      `SELECT reduction_pourcent, reduction_montant, total_ht FROM devis
        WHERE chantier_id = $1 ORDER BY numero_version DESC LIMIT 1`,
      [chantierId]
    );
    assert.equal(rows[0].reduction_pourcent, null);
    assert.equal(rows[0].reduction_montant, null, "un montant sans pourcentage laisse la base incohérente");
    assert.equal(rows[0].total_ht, "870.00");
  });

  // **« ZÉRO POUR CENT » EST LE SEUL GESTE QU'IL AIT TROUVÉ, ET IL NE MARCHAIT
  // PAS.** Le 17 août 2026 : *« Il n'y a aucun moyen de retirer les cinq pour
  // cent, si ce n'est en écrivant zéro pour cent à la place de cinq. »*
  //
  // Vider la case sur un téléphone, c'est viser un champ de 36 px, sélectionner
  // un chiffre et le supprimer. Écrire 0 par-dessus est le geste naturel — et
  // il laissait une ligne or « Prix accordé au client 0 % », sans montant,
  // pendant que la base, elle, n'en portait plus aucune. L'écran affirmait donc
  // une remise que le PDF n'imprimait pas.
  await cas("écrire 0 % la retire pour de bon, à l'écran comme en base", async () => {
    await page.getByRole("button", { name: /Prix accordé au client/ }).click();
    await page.waitForTimeout(900);

    const champ = page.locator('input[aria-label="Prix accordé au client, en pourcentage"]');
    await champ.fill("0");
    await page.keyboard.press("Tab");
    await page.waitForTimeout(1_000);

    // **Sans rechargement** : c'est tout l'objet du défaut. Une vérification
    // qui rechargerait la page verrait un écran juste et manquerait celui
    // qu'il a sous les yeux.
    // **La ligne se reconnaît à son CHAMP, pas à son libellé** : « + Prix
    // accordé au client » — la ligne discrète qui permet d'en reposer une —
    // reparaît en dessous, et c'est justement ce qu'on veut. Chercher le
    // libellé accuserait donc ce bouton d'être la ligne morte.
    const texte = await totaux().innerText();
    assert.equal(
      await page.locator('input[aria-label="Prix accordé au client, en pourcentage"]').count(),
      0,
      `la ligne or survit à un zéro pour cent :\n${texte}`
    );
    assert.ok(!texte.includes("après remise"), "le net est encore nommé comme s'il y avait une remise");
    assert.match(texte.replace(/\s/g, " "), /1 044,00/, `le devis n'est pas revenu au prix plein :\n${texte}`);

    const { rows } = await pool.query(
      `SELECT reduction_pourcent, total_ht FROM devis
        WHERE chantier_id = $1 ORDER BY numero_version DESC LIMIT 1`,
      [chantierId]
    );
    assert.equal(rows[0].reduction_pourcent, null, "la base garde une remise que l'écran dit absente");
    assert.equal(rows[0].total_ht, "870.00");
  });

  // **LE « − » EN FACE DE LA LIGNE — sa proposition B, retenue le 17 août 2026.**
  //
  // *« Tout comme on ajoute une ligne avec un petit plus, il faudrait qu'on ait
  // un petit moins pour supprimer la ligne de la réduction. »*
  // `docs/maquettes/68-retirer-le-prix-accorde.html`.
  const moins = () => page.getByRole("button", { name: /Retirer le prix accordé/i });

  await cas("le « − » existe, et se touche : 26 px", async () => {
    await page.getByRole("button", { name: /^\+ Prix accordé au client/ }).click();
    await page.waitForTimeout(900);
    assert.equal(await moins().count(), 1, "aucun « − » en face de la ligne");
    const b = await moins().boundingBox();
    // Une boîte de zéro pixel ne prouve rien : refuser de conclure plutôt que
    // de rendre un vert vide (`CLAUDE.md` §5).
    assert.ok(b && b.width > 0, "le « − » n'occupe aucune place : rien à mesurer");
    assert.ok(b!.width >= 24 && b!.height >= 24, `le « − » fait ${Math.round(b!.width)} × ${Math.round(b!.height)} px — au doigt, il en faut 24`);
  });

  await cas("un appui rend le prix plein TOUT DE SUITE, avant toute écriture", async () => {
    await moins().click();
    await page.waitForTimeout(400);

    // **Sans attendre le tiroir** : rien n'est écrit tant qu'il peut annuler
    // (`useRetraits`), mais le total doit avoir bougé sous ses yeux — sinon le
    // geste paraît sans effet, et c'est exactement sa plainte du 17 août.
    const texte = await totaux().innerText();
    assert.match(texte.replace(/\s/g, " "), /1 044,00/, `le devis n'affiche pas le prix plein :\n${texte}`);
    assert.ok(!texte.includes("après remise"), "le net est encore nommé comme s'il y avait une remise");

    // Et la base n'a RIEN perdu : « Annuler » doit pouvoir tout rendre.
    const { rows } = await pool.query(
      `SELECT reduction_pourcent FROM devis WHERE chantier_id = $1 ORDER BY numero_version DESC LIMIT 1`,
      [chantierId]
    );
    assert.equal(rows[0].reduction_pourcent, "5.00", "la remise est déjà effacée : « Annuler » ne rendrait rien");
  });

  await cas("« Annuler » la rend, avec son pourcentage", async () => {
    await page.getByRole("button", { name: /Annuler/i }).first().click();
    await page.waitForTimeout(600);
    const texte = await totaux().innerText();
    assert.ok(texte.includes("après remise"), `la remise n'est pas revenue :\n${texte}`);
    assert.match(texte.replace(/\s/g, " "), /991,80/, `le TTC remisé manque :\n${texte}`);
  });

  await cas("laissé fermer, le retrait devient définitif — écran et base d'accord", async () => {
    await moins().click();
    // Le tiroir se ferme au bout de six secondes ; on lui laisse le temps.
    await page.waitForTimeout(8_000);

    const texte = await totaux().innerText();
    assert.equal(
      await page.locator('input[aria-label="Prix accordé au client, en pourcentage"]').count(),
      0,
      `la ligne or survit à son propre retrait :\n${texte}`
    );
    const { rows } = await pool.query(
      `SELECT reduction_pourcent, reduction_montant, total_ht FROM devis
        WHERE chantier_id = $1 ORDER BY numero_version DESC LIMIT 1`,
      [chantierId]
    );
    assert.equal(rows[0].reduction_pourcent, null, "la base garde une remise que l'écran dit absente");
    assert.equal(rows[0].reduction_montant, null, "un montant sans pourcentage laisse la base incohérente");
    assert.equal(rows[0].total_ht, "870.00");
  });

  await contexte.close();
  await navigateur.close();
  await pool.end();

  console.log(`\n${echecs === 0 ? "✅" : "❌"} Le prix accordé au client — ${echecs} échec(s).`);
  process.exit(echecs === 0 ? 0 : 1);
}

main().catch(async (e) => {
  console.error(e);
  await pool.end().catch(() => {});
  process.exit(1);
});
