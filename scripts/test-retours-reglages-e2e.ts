import { lancerNavigateur } from "./e2e-browser";
import assert from "node:assert/strict";

// La flèche « retour » ramène-t-elle d'où l'on vient ?
//
// **Le patron, le 17 août 2026 :** *« lorsque je vais dans mes prix et que je
// fais un retour, je retourne directement dans l'application et pas dans la
// catégorie tarif. Corrige ça. »*
//
// Les réglages ont deux étages : une rubrique (Tarifs & catalogue, Atlas IA),
// et sous elle des écrans qui n'ont **qu'une seule porte**. Trois de ces
// écrans-là renvoyaient à la racine des réglages, ou nulle part :
//
//   | L'écran | Sa seule porte | Où la flèche menait |
//   |---|---|---|
//   | Mes prix | Tarifs & catalogue | la racine des réglages |
//   | Le catalogue | Tarifs & catalogue | **aucune flèche du tout** |
//   | Le vocabulaire | Atlas IA | la racine des réglages |
//
// **Aucun test ne pouvait le voir**, parce qu'aucun ne PARCOURAIT le chemin :
// on ouvrait chaque écran par son adresse, où la question ne se pose pas. Cette
// suite entre par la porte, puis ressort par la flèche — comme lui.
//
// **Ce qu'elle exige d'un nouvel écran :** l'ajouter à la table ci-dessous.
// Deux étages, c'est déjà assez pour se perdre ; trois le seront davantage.

const BASE = "http://localhost:3000";

/** Chaque porte : la page d'où l'on part, et l'écran qu'elle ouvre. */
const PORTES: { depuis: string; vers: string; nom: string }[] = [
  { depuis: "/reglages/tarifs", vers: "/reglages/prix", nom: "Mes prix" },
  { depuis: "/reglages/tarifs", vers: "/catalogue", nom: "Le catalogue" },
  // **Le vocabulaire n'est PAS ici, et ce n'est pas un oubli.** Son renvoi
  // n'apparaît que pour le compte éditeur (`src/server/editeur.ts`), que le
  // compte de démonstration n'est pas : la suite ne peut pas l'atteindre. Son
  // retour a été corrigé en même temps (`/reglages/ia`), mais **il n'est pas
  // éprouvé ici** — l'écrire vaut mieux que de laisser croire le contraire
  // (`AGENTS.md`).
  { depuis: "/reglages/prix", vers: "/reglages/prix/mesures", nom: "Mes mesures" },
  // Un témoin, et il compte : celui-ci était déjà juste. Sans lui, une suite
  // qui exigerait « jamais /reglages » passerait au vert en cassant les
  // rubriques de premier étage.
  { depuis: "/reglages", vers: "/reglages/agenda", nom: "L'agenda (témoin)" },
];

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

  for (const { depuis, vers, nom } of PORTES) {
    await cas(`${nom} : on y entre, et la flèche ramène à « ${depuis} »`, async () => {
      await page.goto(`${BASE}${depuis}`, { waitUntil: "networkidle" });

      const porte = page.locator(`a[href="${vers}"]`);
      assert.ok(
        (await porte.count()) >= 1,
        `aucune porte vers ${vers} depuis ${depuis} — l'écran est devenu inatteignable`
      );
      await porte.first().click();
      await page.waitForURL(`${BASE}${vers}`, { timeout: 15_000 });

      // **La flèche doit exister.** Sans elle — le cas du catalogue — il n'y a
      // pas de mauvais retour : il n'y a pas de retour du tout, et c'est pire.
      //
      // **On l'ATTEND plutôt que de la compter tout de suite.** Ces écrans ont
      // un `loading.tsx` : au moment où l'adresse change, c'est encore le
      // squelette qui est affiché, et un comptage immédiat rend zéro. Un
      // contrôle qui accuse « aucune flèche » alors qu'elle arrive une seconde
      // plus tard envoie chercher au mauvais endroit (`CLAUDE.md` §5).
      const fleche = page.locator('a[aria-label^="Retour"]').first();
      try {
        await fleche.waitFor({ state: "visible", timeout: 15_000 });
      } catch {
        assert.fail(`aucune flèche de retour sur ${vers} : on y entre sans pouvoir en ressortir`);
      }

      // **La destination se lit sur le lien, pas seulement après le clic.**
      // C'est elle, le défaut du patron ; la mesurer directement dit quel
      // écran est fautif plutôt que « on est arrivé ailleurs ».
      const destination = await fleche.getAttribute("href");
      assert.equal(
        destination,
        depuis,
        `la flèche de ${vers} pointe sur « ${destination} » au lieu de « ${depuis} » — il faut rouvrir la rubrique pour reprendre`
      );

      await fleche.click();
      await page.waitForURL(`${BASE}${depuis}`, { timeout: 15_000 });
    });
  }

  await contexte.close();
  await navigateur.close();

  console.log(`\n${echecs === 0 ? "✅" : "❌"} Les retours des réglages — ${echecs} échec(s).`);
  process.exit(echecs === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
