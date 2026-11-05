import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { cheminDuNavigateur } from "./_navigateur.mjs";

// LE NAVIGATEUR DES SUITES, TROUVÉ À UN SEUL ENDROIT (`_navigateur.mjs`).
//
// Le 28 octobre 2026, 88 suites navigateur sont tombées sur un poste du nuage
// sans défaut du produit : le chemin `chromium-1194/chrome-linux` était écrit
// en dur, et le poste portait `chromium-1243/chrome-linux64`. Chaque cas
// ci-dessous est un poste réel ou une configuration déjà rencontrée.

let echecs = 0;
function cas(nom: string, fn: () => void) {
  try {
    fn();
    console.log(`  ✓ ${nom}`);
  } catch (e) {
    echecs++;
    console.log(`  ✗ ${nom}\n    ${(e as Error).message}`);
  }
}

function poste(versions: { nom: string; sous: string }[], lien?: string): string {
  const racine = mkdtempSync(join(tmpdir(), "navigateurs-"));
  for (const v of versions) {
    mkdirSync(join(racine, v.nom, v.sous), { recursive: true });
    writeFileSync(join(racine, v.nom, v.sous, "chrome"), "");
  }
  if (lien) symlinkSync(join(racine, lien), join(racine, "chromium"));
  return racine;
}

cas("le poste du nuage d'aujourd'hui : le lien stable vers chromium-1243/chrome-linux64", () => {
  const racine = poste([{ nom: "chromium-1243", sous: "chrome-linux64" }], "chromium-1243/chrome-linux64/chrome");
  assert.equal(cheminDuNavigateur({ PLAYWRIGHT_BROWSERS_PATH: racine }), join(racine, "chromium"));
});

cas("sans lien stable, la version la plus récente, sous chrome-linux64 comme sous chrome-linux", () => {
  const racine = poste([
    { nom: "chromium-1194", sous: "chrome-linux" },
    { nom: "chromium-1243", sous: "chrome-linux64" },
  ]);
  assert.equal(cheminDuNavigateur({ PLAYWRIGHT_BROWSERS_PATH: racine }), join(racine, "chromium-1243", "chrome-linux64", "chrome"));
  const ancien = poste([{ nom: "chromium-1194", sous: "chrome-linux" }]);
  assert.equal(cheminDuNavigateur({ PLAYWRIGHT_BROWSERS_PATH: ancien }), join(ancien, "chromium-1194", "chrome-linux", "chrome"));
});

cas("ce qu'on demande passe avant tout, sous les trois noms que le dépôt employait", () => {
  const racine = poste([{ nom: "chromium-1243", sous: "chrome-linux64" }]);
  for (const nom of ["PLAYWRIGHT_EXECUTABLE_PATH", "CHROMIUM_PATH", "CHROME_ATLAS"]) {
    assert.equal(cheminDuNavigateur({ PLAYWRIGHT_BROWSERS_PATH: racine, [nom]: "/mon/chrome" }), "/mon/chrome", nom);
  }
});

cas("un runner de CI sans dossier : rien n'est imposé, Playwright prend le sien", () => {
  assert.equal(cheminDuNavigateur({ PLAYWRIGHT_BROWSERS_PATH: join(tmpdir(), "nulle-part-" + Date.now()) }), undefined);
  assert.equal(cheminDuNavigateur({ PLAYWRIGHT_BROWSERS_PATH: poste([]) }), undefined);
});

if (echecs > 0) {
  console.log(`\n✗ ${echecs} échec(s)`);
  process.exit(1);
}
console.log("\n✅ Le navigateur se trouve à un seul endroit, quelle que soit sa version.");
