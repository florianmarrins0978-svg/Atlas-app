import { lancerNavigateur } from "./e2e-browser";
// Le nom du chantier se DÉDUIT du client (`src/lib/nom-chantier.ts`) : on
// applique la même règle que le produit plutôt que de recomposer « Chez … ».
import { avecCivilite } from "../src/lib/civilite";
import assert from "node:assert";
import { Pool } from "pg";

// DATABASE_URL, jamais une base codée en dur : la suite doit viser la même base
// que le serveur qu'elle pilote (atlas_dev en local, atlas_test en CI).
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function main() {
  const browser = await lancerNavigateur();
  const context = await browser.newContext({ deviceScaleFactor: 3 });
  const page = await context.newPage();

  // Connexion réelle (Auth.js) — toutes les routes applicatives sont
  // désormais protégées par le middleware d'authentification.
  await page.goto("http://localhost:3000/login", { waitUntil: "networkidle" });
  await page.fill('input[name="email"]', "demo@atlas.local");
  await page.fill('input[name="password"]', "demo1234");
  await page.click('button[type="submit"]');
  await page.waitForURL("http://localhost:3000/", { timeout: 10000 });

  const nomUnique = `Chantier planning e2e ${Date.now()}`;
  await page.goto("http://localhost:3000/chantiers/nouveau", { waitUntil: "networkidle" });
  await page.fill('input[placeholder="Bernard"]', nomUnique);
  await page.click('button:has-text("Créer le chantier")');
  await page.waitForURL(/\/chantiers\/[0-9a-f-]{36}/, { timeout: 5000 });
  const chantierId = page.url().split("/").pop()!;

  // Un chantier neuf n'a pas de devis envoyé : force l'éligibilité directement
  // en base pour ce test (équivalent à un devis réellement envoyé). Nécessite
  // le contexte RLS de l'entreprise du chantier (FORCE RLS s'applique même au
  // rôle propriétaire).
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const { rows: entRows } = await client.query(`SELECT id FROM entreprises ORDER BY created_at ASC LIMIT 1`);
    const entrepriseId = entRows[0].id;
    await client.query(`SELECT set_config('app.entreprise_id', $1, true)`, [entrepriseId]);
    await client.query(`UPDATE chantiers SET devis_envoye_at = now() WHERE id = $1`, [chantierId]);
    await client.query("COMMIT");
  } finally {
    client.release();
  }

  // --- Le chantier apparaît en "À planifier" ---
  await page.goto("http://localhost:3000/planning", { waitUntil: "networkidle" });
  assert.ok(
    await page.locator(`text=${nomUnique}`).first().isVisible(),
    "Le chantier doit apparaître en 'À planifier'"
  );

  // --- Planification : on POSE, et poser dit à la fois quand et qui ---
  //
  // **Le sélecteur de date natif a disparu le 10 août 2026**, et ce contrôle a
  // rougi à juste titre : il verrouillait un geste qui n'existe plus. Le
  // planning est un mois — on choisit le chantier à poser, on touche un jour,
  // puis une demi-journée libre, et le bouton s'arme
  // (`ARCHITECTURE.md` §52).
  await page.locator(`[data-atlas="sans-date"]:has-text("${nomUnique}")`).first().click();
  await page.waitForTimeout(300);

  // Décembre 2026 : on avance jusqu'au mois voulu plutôt que de le supposer
  // affiché — le calendrier s'ouvre sur le mois courant.
  for (let i = 0; i < 24; i++) {
    const titre = await page.locator("[data-atlas='grille-mois']").count();
    if (titre && (await page.locator('[data-atlas="grille-mois"] button[data-jour="2026-12-10"]').count()) > 0) break;
    await page.click('button[aria-label="Mois suivant"]');
    await page.waitForTimeout(150);
  }
  await page.click('[data-atlas="grille-mois"] button[data-jour="2026-12-10"]');
  await page.waitForTimeout(500);
  await page.locator("[data-atlas='creneau'][data-libre='oui']").first().click();
  await page.waitForTimeout(300);
  await page.click("[data-atlas='poser']");
  await page.waitForTimeout(900);

  // --- Persistance après rechargement ---
  await page.reload({ waitUntil: "networkidle" });
  assert.ok(
    await page.locator(`text=${nomUnique}`).first().isVisible(),
    "Le chantier planifié doit réapparaître après rechargement"
  );
  // **La vignette de CE chantier, pas la première de l'écran.** Viser
  // « text=DÉC » globalement rendait la suite non rejouable : au deuxième
  // passage sur la même base, deux chantiers de décembre coexistent et le
  // contrôle échoue sur son propre passé, en accusant le code.
  const carte = () => page.locator(`a[href="/chantiers/${chantierId}"]`);

  // **CE CONTRÔLE A ROUGI À JUSTE TITRE LE 14 AOÛT 2026, et il a changé de
  // cible plutôt que de disparaître.** Il exigeait le MOIS sur la ligne du
  // planning ; le patron l'en a fait retirer — *« pas la date, elle est déjà
  // présente juste au-dessus »* — et la ligne dit désormais ce que le chantier
  // OCCUPE. Supprimer le contrôle aurait laissé la pose sans preuve ; on
  // vérifie donc les deux choses qui restent vraies :
  //
  //   · la ligne dit « journée » — le chantier est posé sur une journée
  //     entière, ce qui est la durée par défaut. Elle disait « matin », et
  //     c'est précisément le mensonge qu'on vient de réparer ;
  //   · le JOUR, lui, se lit toujours — dans la feuille du chevron, seul
  //     endroit où il n'est écrit nulle part ailleurs.
  const surLaLigne = (await carte().innerText()).toLowerCase();
  assert.ok(
    surLaLigne.includes("journée"),
    `La ligne doit dire ce que le chantier occupe : « ${await carte().innerText()} »`
  );
  assert.ok(
    !surLaLigne.includes("déc"),
    `La date ne doit plus figurer sur la ligne du planning : « ${await carte().innerText()} »`
  );
  assert.ok(
    !/\bmatin\b/.test(surLaLigne),
    `Une journée entière ne s'annonce plus « matin » : « ${await carte().innerText()} »`
  );

  // Le chevron ouvre la feuille, et c'est là que le jour survit. Le geste est
  // celui des autres suites — `getByRole` sur le libellé accessible — et non un
  // `data-atlas` inventé pour l'occasion : un sélecteur qui n'existe que dans
  // le contrôle ne prouve rien de ce que le patron touche.
  await page.getByRole("button", { name: `Y aller — ${avecCivilite(nomUnique)}` }).click();
  await page.waitForSelector("text=Y aller", { timeout: 10000 });
  assert.ok(
    (await page.locator("body").innerText()).toLowerCase().includes("déc"),
    "Le jour doit rester lisible dans la feuille du chevron, seul endroit où il n'est écrit nulle part ailleurs"
  );
  await page.getByRole("button", { name: "Annuler", exact: true }).click();
  await page.waitForTimeout(300);

  // --- La carte planifiée mène au chantier, pas au sélecteur de date ---
  //
  // **Changé le 8 août 2026, et ce contrôle a rougi à juste titre.** Il
  // verrouillait l'ancien comportement : toucher un chantier planifié n'ouvrait
  // qu'un sélecteur de date. Le patron : « il se range dans les chantiers
  // planifiés, mais comment moi je fais pour avoir accès au devis ? » — la
  // réponse était : on ne peut pas. La carte mène désormais au chantier, et la
  // date se change par un lien à part.
  await carte().click();
  // Le tiroir du bas est le repère d'arrivée sur une fiche : « Autres étapes »
  // ne s'écrit plus depuis que les étapes y sont rangées (`ARCHITECTURE.md` §49).
  await page.waitForSelector("[data-atlas='tiroir-fiche']", { timeout: 10000 });
  assert.ok(
    page.url().endsWith(`/chantiers/${chantierId}`),
    `la carte planifiée mène à ${page.url()} au lieu de la fiche du chantier`
  );

  // Et la clôture reste à portée depuis le planning, sans passer par la fiche.
  //
  // **Elle a changé de place le 12 août 2026, jamais d'existence.** Le patron :
  // *« il faut cliquer sur le chevron, la page s'ouvre avec le GPS et tout
  // machin, et là tu mets créer la facture »*. Un appui de plus, c'est son
  // choix ; ce qui ne doit pas revenir, c'est le cul-de-sac du 8 août — le
  // planning d'où l'on ne pouvait rien faire. Le contrôle suit donc le NOUVEAU
  // chemin en entier, plutôt que de disparaître avec l'ancien.
  await page.goto("http://localhost:3000/planning", { waitUntil: "networkidle" });
  assert.equal(
    await page.locator(`a[href="/chantiers/${chantierId}/facture"]`).count(),
    0,
    "« Créer la facture » ne doit plus encombrer la ligne : il est passé dans la feuille"
  );
  await page.getByRole("button", { name: `Y aller — ${avecCivilite(nomUnique)}` }).click();
  await page.waitForSelector("text=Y aller", { timeout: 10000 });
  assert.equal(
    await page.locator(`a[href="/chantiers/${chantierId}/facture"]`).count(),
    1,
    "« Créer la facture » manque dans la feuille du chevron : le planning redevient un cul-de-sac"
  );
  await page.getByRole("button", { name: "Annuler", exact: true }).click();
  await page.waitForTimeout(300);

  // --- Déplacer un chantier déjà posé ---
  //
  // Le sélecteur de date a disparu avec l'ancien écran ; changer une date se
  // fait désormais avec le MÊME geste que poser — « Déplacer », puis un jour,
  // une demi-journée, et le bouton s'arme.
  await page.getByRole("button", { name: `Déplacer le chantier ${avecCivilite(nomUnique)}` }).click();
  await page.waitForTimeout(400);
  for (let i = 0; i < 24; i++) {
    if ((await page.locator('[data-atlas="grille-mois"] button[data-jour="2027-01-15"]').count()) > 0) break;
    await page.click('button[aria-label="Mois suivant"]');
    await page.waitForTimeout(150);
  }
  await page.click('[data-atlas="grille-mois"] button[data-jour="2027-01-15"]');
  await page.waitForTimeout(500);
  await page.locator("[data-atlas='creneau'][data-libre='oui']").first().click();
  await page.waitForTimeout(300);
  await page.click("[data-atlas='poser']");
  await page.waitForTimeout(900);
  await page.reload({ waitUntil: "networkidle" });

  // **Même correction qu'au premier contrôle, et pour la même raison** : la
  // ligne ne porte plus la date depuis le 14 août 2026. Le déplacement se
  // vérifie donc là où le jour subsiste — la feuille du chevron. Ce qui est
  // éprouvé n'a pas changé d'un pouce : que la NOUVELLE date ait bien été
  // enregistrée, et qu'elle survive à un rechargement.
  await page.getByRole("button", { name: `Y aller — ${avecCivilite(nomUnique)}` }).click();
  await page.waitForSelector("text=Y aller", { timeout: 10000 });
  const apresDeplacement = (await page.locator("body").innerText()).toLowerCase();
  assert.ok(
    apresDeplacement.includes("janv"),
    "La nouvelle date (janvier) doit être persistée et lisible dans la feuille"
  );
  assert.ok(
    !apresDeplacement.includes("déc"),
    "L'ancienne date (décembre) ne doit plus apparaître nulle part après le déplacement"
  );

  await browser.close();
  await pool.end();
  console.log("✅ Test bout-en-bout Planning réussi.");
}

main().catch(async (err) => {
  console.error("❌", err);
  await pool.end();
  process.exit(1);
});
