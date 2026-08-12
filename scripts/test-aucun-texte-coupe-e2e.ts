import { lancerNavigateur } from "./e2e-browser";
import { Pool } from "pg";

// **Aucune zone de saisie ne cache ce qu'on vient d'y écrire.**
//
// Le 11 août 2026, le balayage des barres de défilement
// (`test-aucune-barre-de-defilement-e2e.ts`) a trouvé une barre grise sur une
// zone de texte du devis. La barre était le symptôme ; le défaut était que le
// devis coupait le texte du patron.
//
// Les trois zones du devis estimaient leur hauteur : l'adresse comptait les
// caractères, la description comptait les retours à la ligne, les conditions ne
// comptaient rien (`rows={2}`). Or un texte se coupe au MOT, quand il touche le
// bord. Deux lignes estimées en font trois à l'écran, et le bas disparaît.
//
// **Ce contrôle existe parce que le précédent pouvait être satisfait de
// travers.** Masquer la barre aurait rendu le balayage vert — et la coupure
// silencieuse, donc pire. Celui-ci mesure la chose elle-même : le texte
// tient-il dans sa boîte. On ne peut pas le contenter en cachant quoi que ce
// soit.
//
// Il écrit un texte long pour de bon, comme le patron le ferait. Une zone vide
// ne déborde jamais : le contrôler à vide, c'est ne rien contrôler.

const BASE = "http://localhost:3000";
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const LONG =
  "128 bis avenue du Général-Leclerc, résidence les Hauts-de-Seine, bâtiment C, 78200 Mantes-la-Jolie";

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

/** Ce que le navigateur voit d'une zone trop petite pour son texte. */
const SONDE = `(() => {
  const coupes = [];
  for (const t of document.querySelectorAll("textarea")) {
    // Deux pixels de marge : les arrondis de rendu ne sont pas une coupure.
    if (t.scrollHeight > t.clientHeight + 2) {
      coupes.push(
        (t.getAttribute("aria-label") || "zone sans nom") +
          " — " + t.clientHeight + " px affichés pour " + t.scrollHeight + " px de texte"
      );
    }
  }
  return coupes;
})()`;

async function main() {
  console.log("=== Aucune zone de saisie ne coupe son texte ===\n");

  const { rows } = await pool.query(
    `select c.id
       from chantiers c
       join devis d on d.chantier_id = c.id
      where d.envoye_le is null
      limit 1`
  );
  const chantier = rows[0]?.id as string | undefined;

  const navigateur = await lancerNavigateur();
  const contexte = await navigateur.newContext();
  const page = await contexte.newPage();

  await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  await page.fill('input[name="email"]', "demo@atlas.local");
  await page.fill('input[name="password"]', "demo1234");
  await page.click('button[type="submit"]');
  await page.waitForURL(`${BASE}/`, { timeout: 30_000 });

  await cas("le jeu de démonstration porte un devis encore modifiable", async () => {
    if (!chantier) {
      throw new Error(
        "aucun devis non envoyé en base. Ce contrôle ne peut RIEN éprouver : un " +
          "devis parti est figé, ses zones sont en lecture seule et rien ne s'y écrit. " +
          "Recharger le jeu de démonstration."
      );
    }
  });

  if (chantier) {
    await cas("le devis à la main — rien de ce qu'on écrit n'est coupé", async () => {
      await page.goto(`${BASE}/chantiers/${chantier}/devis-complet`, { waitUntil: "networkidle" });
      await page.evaluate(() => document.fonts.ready);
      await page.waitForTimeout(900);

      const zones = page.locator("textarea:not([readonly])");
      const combien = await zones.count();
      // **Le mode de défaillance propre à ce contrôle : ne rien avoir rempli.**
      // Une page sans zone modifiable le rendrait vert sans qu'il ait regardé
      // quoi que ce soit — et « vert » se lit alors comme « tout va bien ».
      if (combien === 0) {
        throw new Error(
          "aucune zone de texte modifiable sur cet écran. Le devis est-il déjà " +
            "envoyé, donc figé ? Rien n'a été éprouvé."
        );
      }
      for (let i = 0; i < combien; i++) await zones.nth(i).fill(LONG);
      await page.waitForTimeout(600);

      const coupes = (await page.evaluate(SONDE)) as string[];
      if (coupes.length > 0) {
        throw new Error(
          `${coupes.length} zone(s) cachent une partie du texte saisi :\n      ` +
            coupes.join("\n      ") +
            `\n      La hauteur doit être MESURÉE (scrollHeight), pas estimée — voir` +
            ` ZoneQuiGrandit dans DevisCompletClient.tsx. Masquer la barre de` +
            ` défilement rendrait la coupure silencieuse, pas absente.`
        );
      }
    });
  }

  await navigateur.close();
  await pool.end();

  console.log(`\n${echecs === 0 ? "✅" : "❌"} Texte coupé — ${echecs} échec(s).`);
  process.exit(echecs === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
