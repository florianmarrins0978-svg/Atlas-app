import { lancerNavigateur } from "./e2e-browser";
import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { mkdirSync } from "node:fs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MICRO_SIMULE = path.join(__dirname, "fixtures", "fake-mic.wav");
const BASE = "http://localhost:3000";

// **« La phrase doit disparaître, sinon ça incite à appuyer. »**
//
// Sa remarque du 1ᵉʳ septembre 2026, deux captures à l'appui. Il venait
// d'envoyer sa note ; l'écran annonçait « Atlas prépare toujours votre
// devis… (96 s) » — et JUSTE AU-DESSUS, sous le micro revenu au repos :
// « Appuyez et décrivez le chantier ».
//
// **Ce que ça lui faisait faire, et pourquoi c'est grave.** L'écran l'invitait
// à recommencer ce qu'il était en train de faire. Une seconde dictée par-dessus
// la première, c'est la note qui écrase celle qui travaille — et il n'aurait
// eu aucune raison de s'en douter, puisque l'écran le lui demandait.
//
// **POURQUOI CETTE SUITE ENTRE PAR LE MICRO** (`CLAUDE.md` §5 quater) : le
// défaut ne vit pas dans une fonction, il vit dans l'ENCHAÎNEMENT — l'anneau
// revient au repos pendant qu'un autre composant travaille. Seul le parcours
// complet, micro compris, le met en évidence. Un contrôle qui aurait posé
// l'état à la main ne l'aurait jamais vu.

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
  console.log("=== L'invite à dicter se tait pendant que le devis se prépare ===\n");
  mkdirSync("/tmp/atlas-captures", { recursive: true });

  const navigateur = await lancerNavigateur({
    args: [
      "--use-fake-device-for-media-stream",
      "--use-fake-ui-for-media-stream",
      `--use-file-for-fake-audio-capture=${MICRO_SIMULE}`,
    ],
  });
  const contexte = await navigateur.newContext({
    permissions: ["microphone"],
    viewport: { width: 390, height: 844 },
  });
  const page = await contexte.newPage();

  await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  await page.fill('input[name="email"]', "demo@atlas.local");
  await page.fill('input[name="password"]', "demo1234");
  await page.click('button[type="submit"]');
  await page.waitForURL(`${BASE}/`, { timeout: 30_000 });

  // **SA FICHE CLIENT, pas la fiche du chantier.** C'est l'écran de ses
  // captures : celui où la chaîne du devis démarre toute seule après l'envoi
  // (`auto`), donc le seul où l'anneau et la préparation coexistent.
  await page.goto(`${BASE}/chantiers/nouveau`, { waitUntil: "networkidle" });
  await page.fill('input[placeholder="Bernard"]', `Invite dictee ${Date.now()}`);

  const invite = page.getByText("Appuyez et décrivez le chantier");
  const micro = page.locator('[data-atlas="anneau-note-vocale"] .atlas-micro');
  const avion = page.locator('[data-atlas="dictee-envoyer"]');

  await cas("au repos, l'invite est bien là — c'est elle qui apprend le geste", async () => {
    assert.equal(await invite.count(), 1, "l'invite manque sur un écran neuf");
  });

  await cas("pendant qu'on dicte, elle se tait déjà (ce qui marchait)", async () => {
    await micro.click();
    await page.waitForTimeout(2400);
    assert.equal(
      await invite.count(),
      0,
      "l'invite reste affichée pendant la dictée"
    );
  });

  await cas("APRÈS L'ENVOI, elle ne revient pas — son défaut du 1ᵉʳ septembre", async () => {
    await avion.click();
    // On attend que la chaîne soit visiblement au travail : c'est l'instant
    // exact de ses captures.
    await page.waitForTimeout(3500);

    const corps = await page.locator("body").innerText();
    const prepare = /Atlas prépare/.test(corps);

    await page.addStyleTag({
      content: "nextjs-portal, #__next-build-watcher { display: none !important; }",
    });
    await page.screenshot({ path: "/tmp/atlas-captures/dictee-apres-envoi.png", fullPage: true });

    assert.equal(
      await invite.count(),
      0,
      "« Appuyez et décrivez le chantier » est revenu après l'envoi : l'écran " +
        "invite à refaire ce qui est en cours" +
        (prepare ? " — et il annonce en même temps qu'il prépare le devis" : "")
    );
  });

  console.log(`\n${echecs === 0 ? "✅" : "❌"} ${echecs} échec(s).`);
  await contexte.close();
  await navigateur.close();
  process.exit(echecs === 0 ? 0 : 1);
}

void main();
