import assert from "node:assert/strict";
import { lancerNavigateur } from "./e2e-browser";

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
  await page.click('button:has-text("Créer le chantier")');
  await page.waitForURL(/\/chantiers\/[0-9a-f-]{36}/, { timeout: 30000 });
  const fiche = page.url();
  const id = fiche.split("/").pop()!;

  await cas("un chantier neuf se rouvre sur sa fiche — la dictée y est", async () => {
    // Son deuxième exemple : « si je me suis arrêté à mettre des photos et à
    // rédiger la note vocale, il faut que ça me remette à cette page-là ».
    await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
    const lien = page.locator(`a:has-text("${marque}")`).first();
    await lien.waitFor({ state: "visible", timeout: 20000 });
    assert.equal(await lien.getAttribute("href"), `/chantiers/${id}`);
  });

  // Il pose son prix — « j'ai enregistré le nouveau prix ».
  await page.goto(`${fiche}/prix`, { waitUntil: "networkidle" });
  await page.click("text=+ Ajouter une ligne");
  await page.waitForTimeout(400);
  const champs = page.locator("form input");
  await champs.nth(0).fill("Abattage d'un chêne");
  await champs.nth(1).fill("1200.00");
  await champs.nth(1).blur();
  await page.waitForTimeout(900);

  await cas("SA SÉQUENCE : retour par mégarde, puis la ligne le ramène à l'envoi", async () => {
    // Il était allé jusqu'à l'écran d'envoi.
    await page.goto(`${fiche}/export`, { waitUntil: "networkidle" });
    // « J'ai fait retour sans faire exprès. »
    await page.goto(`${BASE}/`, { waitUntil: "networkidle" });

    const lien = page.locator(`a:has-text("${marque}")`).first();
    await lien.waitFor({ state: "visible", timeout: 20000 });
    assert.equal(
      await lien.getAttribute("href"),
      `/chantiers/${id}/export`,
      "la ligne ramène à la fiche : il devra refaire les étapes une à une"
    );

    await lien.click();
    await page.waitForURL(new RegExp(`/chantiers/${id}/export`), { timeout: 20000 });
  });

  await cas("et l'écran d'arrivée offre l'envoi, sans étape de plus", async () => {
    // `waitForURL` se résout dès que l'adresse change : le rendu, lui, arrive
    // après. Lire le texte tout de suite mesurait un écran encore vide, et le
    // rouge accusait l'envoi — qui n'y était pour rien.
    await page.waitForSelector("text=Envoyer au client", { timeout: 20000 });
    const texte = await page.locator("body").innerText();
    assert.match(texte, /Envoyer au client/, "le geste qui restait n'est pas offert ici");
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

  await cas("la fiche reste à un doigt — reprendre ne ferme aucune porte", async () => {
    // Photos, dictée, tiroir : tout reste joignable par la flèche de retour.
    const retour = page.locator(`a[href="/chantiers/${id}"]`).first();
    await retour.waitFor({ state: "visible", timeout: 15000 });
  });

  await contexte.close();
  await navigateur.close();

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
