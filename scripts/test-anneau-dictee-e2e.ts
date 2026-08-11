import { lancerNavigateur } from "./e2e-browser";
import assert from "node:assert";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MICRO_SIMULE = path.join(__dirname, "fixtures", "fake-mic.wav");
const BASE = "http://localhost:3000";

// **« Il manque la note vocale au milieu. »**
//
// Le patron, le 11 août 2026, devant la fiche d'un chantier qu'il venait de
// créer. L'anneau n'apparaissait qu'une fois la dictée faite, et la dictée
// arrivait en DEUXIÈME action, derrière les photos : sur un chantier neuf —
// c'est-à-dire au moment précis où l'on veut parler — le cœur du produit était
// caché derrière autre chose.
//
// Sa demande, mot pour mot : *« l'anneau qui est en plein milieu et dès qu'on
// arrive sur la page, il y est en fait, qu'on ait cliqué dessus ou non. »*
//
// Ce que cette suite tient :
//
//   1. l'anneau est là **dès l'arrivée**, sur un chantier vide, sans qu'on ait
//      touché quoi que ce soit ;
//   2. un appui dicte, un second enregistre — et la note existe vraiment ;
//   3. l'anneau redevient alors le lecteur, au même endroit ;
//   4. **la bulle de l'assistant ne recouvre rien.** Remonter l'anneau au centre
//      a poussé « ou rédiger le devis à la main » sous la bulle : le lien
//      existait, il était touchable, et il était illisible. Vu en capture, et
//      seulement là — c'est le troisième défaut de cette sorte sur ce dépôt.

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
  const navigateur = await lancerNavigateur({
    args: [
      "--use-fake-device-for-media-stream",
      "--use-fake-ui-for-media-stream",
      `--use-file-for-fake-audio-capture=${MICRO_SIMULE}`,
    ],
  });
  // L'écran du patron vient de `e2e-browser` — c'est ce défaut-ci qui l'y a
  // fait poser, et le détail de l'histoire est écrit là-bas.
  const contexte = await navigateur.newContext({ permissions: ["microphone"] });
  const page = await contexte.newPage();

  await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  await page.fill('input[name="email"]', "demo@atlas.local");
  await page.fill('input[name="password"]', "demo1234");
  await page.click('button[type="submit"]');
  await page.waitForURL(`${BASE}/`, { timeout: 20_000 });

  // Un chantier NEUF : ni photo, ni dictée — exactement le sien.
  await page.goto(`${BASE}/chantiers/nouveau`, { waitUntil: "networkidle" });
  await page.fill('input[placeholder="M. Bernard"]', `Anneau e2e ${Date.now()}`);
  await page.click('button:has-text("Créer le chantier")');
  await page.waitForURL(/\/chantiers\/[0-9a-f-]{36}/, { timeout: 20_000 });
  const fiche = page.url();
  // **On attend que la PAGE soit arrivée, pas plus.** `waitForURL` rend la main
  // dès que l'adresse change, avant que quoi que ce soit soit rendu : sans
  // cela, le premier contrôle mesurait un écran encore vide et accusait
  // l'anneau d'être absent alors qu'il n'était pas encore né. Attendre
  // l'anneau lui-même, en revanche, viderait ce contrôle de son objet.
  // On ouvre la fiche explicitement : `waitForURL` rend la main dès que
  // l'adresse change, avant que rien soit rendu, et le premier contrôle
  // mesurait alors un écran encore vide. Attendre l'anneau lui-même viderait ce
  // contrôle de son objet — c'est justement sa présence qu'on éprouve.
  await page.goto(fiche, { waitUntil: "networkidle" });

  const anneau = page.locator('[data-atlas="anneau-note-vocale"]');
  const bouton = anneau.locator(".atlas-anneaux");
  const consigne = page.locator(".atlas-indice").first();

  await cas("l'anneau est là dès l'arrivée, sur un chantier vide", async () => {
    assert.equal(await anneau.count(), 1, "aucun anneau sur la fiche d'un chantier neuf");
    assert.ok(await bouton.isVisible(), "l'anneau existe mais ne se voit pas");
    assert.match(
      (await consigne.textContent())?.trim() ?? "",
      /Appuyez/,
      "la consigne ne dit pas qu'on peut parler"
    );
  });

  // **Rien ne s'est perdu en vidant le corps de la fiche.**
  //
  // Le 11 août 2026, le patron a demandé que la fiche respecte strictement sa
  // maquette : ni bouton, ni lien dans le corps — l'anneau, et rien d'autre.
  // Alléger un écran est facile ; le faire sans amputer l'est moins. L'étape
  // suivante et la rédaction à la main descendent dans le tiroir, et ce
  // contrôle existe pour que personne ne les y oublie : ce sont deux demandes
  // qu'il avait faites lui-même, les 3 et 4 août.
  await cas("le corps ne porte que l'anneau, et le tiroir garde tout le reste", async () => {
    // **On s'assure d'abord que la cible existe.** Un sélecteur qui ne trouve
    // rien compte zéro lien, et ce contrôle passerait alors au vert sur une
    // page vide — c'est-à-dire exactement quand il devrait crier.
    const corps = page.locator(".atlas-scene-fiche");
    assert.equal(await corps.count(), 1, "le corps de la fiche est introuvable : ce contrôle n'éprouve rien");
    assert.equal(
      await corps.locator("a[href*='/devis-complet'], a[href*='/photos']").count(),
      0,
      "le corps de la fiche porte encore un bouton ou un lien : la maquette n'en montre aucun"
    );

    // **Le tiroir est exigé, pas espéré.** Une première version se rabattait
    // sur la page entière quand elle ne le trouvait pas : le tiroir aurait pu
    // disparaître sans que rien ne rougisse, alors que c'est précisément lui
    // qui recueille ce qu'on a retiré du corps.
    const tiroir = page.locator('[data-atlas="tiroir-fiche"]');
    assert.equal(await tiroir.count(), 1, "le tiroir a disparu : le corps a été vidé sans que rien ne recueille le reste");
    for (const [quoi, href] of [
      ["l'étape suivante", "/note-vocale"],
      ["la rédaction à la main", "/devis-complet"],
    ] as const) {
      assert.ok(
        await tiroir.locator(`a[href*="${href}"]`).count(),
        `${quoi} a disparu du tiroir : vider le corps l'a supprimée au lieu de la déplacer`
      );
    }
  });

  await cas("un appui dicte, un second enregistre — et la note existe", async () => {
    await bouton.click();
    await page.waitForTimeout(700);
    assert.match(
      (await consigne.textContent())?.trim() ?? "",
      /arrêter/i,
      "l'anneau ne dit pas qu'il enregistre : rien ne distingue une dictée en cours d'un bouton inerte"
    );
    assert.ok(await page.locator(".atlas-chrono").isVisible(), "le compteur ne tourne pas pendant la dictée");

    await page.waitForTimeout(2200);
    await bouton.click();

    // La fiche se rafraîchit sur place : l'anneau devient le lecteur.
    await page.waitForFunction(
      () => document.querySelector(".atlas-indice")?.textContent?.includes("Poussez") ?? false,
      undefined,
      { timeout: 60_000 }
    );
  });

  await cas("l'anneau est redevenu le lecteur, au même endroit", async () => {
    await page.goto(fiche, { waitUntil: "networkidle" });
    assert.equal(await anneau.count(), 1, "l'anneau a disparu après la dictée");
    assert.match(
      (await consigne.textContent())?.trim() ?? "",
      /Poussez/,
      "l'anneau propose encore de dicter alors qu'une note existe : la précédente serait écrasée"
    );
    assert.ok(
      await page.locator(".atlas-fosse").count(),
      "le retrait a disparu : une note qu'on ne peut plus enlever"
    );
  });

  await navigateur.close();

  console.log(`\n${echecs === 0 ? "✅" : "❌"} L'anneau au centre de la fiche — ${echecs} échec(s).`);
  process.exit(echecs === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
