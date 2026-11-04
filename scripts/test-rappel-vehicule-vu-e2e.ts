import { lancerNavigateur } from "./e2e-browser";
import { devices } from "playwright";
import assert from "node:assert/strict";
import { Pool } from "pg";
import { ADRESSE } from "./_adresse";
import { jourIso } from "../src/lib/jour";

/**
 * « J'AI VU » SUR LA CARTE D'UN CONTRÔLE DE VÉHICULE, joué comme il le joue.
 *
 * Sa demande du 3 novembre 2026, devant le contrôle technique de l'Amarok :
 * *« c'est bien le rappel, mais j'ai aucun moyen de l'enlever. Il faut qu'il y
 * ait une petite case J'ai vu, je peux cliquer pour l'enlever. »* Et son choix :
 * la carte part tout de suite ; l'échéance passée sans contrôle, elle revient
 * en rouge.
 *
 * `test-vehicules` éprouve la règle et `test-vehicules-rls` l'écriture sous
 * `atlas_app` ; celle-ci éprouve le RACCORD, que la règle seule ne voit pas :
 *
 *   1. la carte « Plus que 2 jours » porte « J'ai vu », et le toucher la fait
 *      partir AVANT la réponse du serveur, puis pour de bon au rechargement ;
 *   2. vue, elle revient le JOUR de l'échéance, sans « J'ai vu » (sa réponse du
 *      3 novembre : *« si le contrôle n'est toujours pas fait le jour de
 *      l'échéance, elle revient »*), puis rouge une fois la date passée ;
 *   3. une nouvelle date la remet à neuf, avec son « J'ai vu » ;
 *   4. un refus du serveur (la date a changé derrière l'écran) fait revenir la
 *      carte AVEC sa phrase, jamais un geste avalé.
 *
 * La date dépassée ne s'attend pas : elle s'écrit en base, telle que le
 * « J'ai vu » d'il y a quelques jours l'aurait laissée.
 */

const BASE = ADRESSE;
// En clair : c'est ainsi que le calcul du niveau sait quelle suite ouvre cet écran.
const ACCUEIL = "/";
const ECRAN_DU_PATRON = devices["iPhone 13"];
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

function decaler(jour: string, n: number): string {
  const d = new Date(`${jour}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

async function main() {
  const { rows } = await pool.query(
    `SELECT m.entreprise_id FROM membres_entreprise m JOIN users u ON u.id = m.utilisateur_id WHERE u.email = 'demo@atlas.local' LIMIT 1`
  );
  const entrepriseId = rows[0]?.entreprise_id as string | undefined;
  assert.ok(entrepriseId, "le compte de démonstration est absent : la base n'est pas amorcée");

  const NOM = `Amarok vu ${Date.now()}`;
  const aujourdhui = jourIso(new Date());
  const v = await pool.query(
    `INSERT INTO vehicules (entreprise_id, nom, controle_technique_avant) VALUES ($1, $2, $3) RETURNING id`,
    [entrepriseId, NOM, decaler(aujourdhui, 2)]
  );
  const id = v.rows[0].id as string;

  const navigateur = await lancerNavigateur();
  try {
    const page = await (await navigateur.newContext({ ...ECRAN_DU_PATRON })).newPage();
    await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
    await page.fill('input[name="email"]', "demo@atlas.local");
    await page.fill('input[name="password"]', "demo1234");
    await page.click('button[type="submit"]');
    await page.waitForURL(`${BASE}/`, { timeout: 30_000 });

    const carte = page.locator('[data-atlas="rappel-vehicule"]', { hasText: NOM });
    const jaiVu = carte.locator('[data-atlas="j-ai-vu-vehicule"]');

    // 1. « Plus que 2 jours », et « J'ai vu ».
    await page.goto(`${BASE}${ACCUEIL}`, { waitUntil: "networkidle" });
    await carte.waitFor({ timeout: 15_000 });
    assert.equal(await carte.getAttribute("data-atlas-ton"), "ambre");
    assert.match(await carte.innerText(), /Plus que 2 jours/);
    assert.equal(await jaiVu.count(), 1, "la carte du contrôle ne porte pas « J'ai vu »");
    assert.equal((await jaiVu.innerText()).trim(), "J’ai vu");

    // Sans attendre le serveur : il a fait son geste, la carte ne doit pas
    // rester sous ses yeux le temps d'un aller-retour.
    // La route reste posée jusqu'au bout : la retirer pendant qu'elle retient
    // la requête la relâcherait deux fois. Une fois lâchée, elle laisse tout
    // passer.
    let lacher: () => void = () => undefined;
    const tenu = new Promise<void>((r) => (lacher = r));
    await page.route("**/*", async (route) => {
      if (route.request().method() === "POST") await tenu;
      await route.continue();
    });
    await jaiVu.click();
    await carte.waitFor({ state: "detached", timeout: 2_000 });
    lacher();
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(800);
    const ecrit = await pool.query(`SELECT controle_technique_vu_pour::text AS d FROM vehicules WHERE id = $1`, [id]);
    assert.equal(ecrit.rows[0].d, decaler(aujourdhui, 2), "le « J'ai vu » n'a pas été retenu pour cette date");
    await page.reload({ waitUntil: "networkidle" });
    assert.equal(await carte.count(), 0, "la carte vue est revenue au rechargement");
    console.log("  ✓ « J'ai vu » fait partir la carte tout de suite, et pour de bon");

    // 2. Vue quand elle était proche, c'est aujourd'hui son dernier jour : elle
    //    revient, quand il est encore temps de passer le contrôle.
    await pool.query(
      `UPDATE vehicules SET controle_technique_avant = $2, controle_technique_vu_pour = $2 WHERE id = $1`,
      [id, aujourdhui]
    );
    await page.reload({ waitUntil: "networkidle" });
    await carte.waitFor({ timeout: 15_000 });
    assert.match(await carte.innerText(), /Dernier jour aujourd’hui/);
    assert.equal(await jaiVu.count(), 0, "le dernier jour propose encore « J'ai vu »");
    console.log("  ✓ vue, elle revient le jour de l'échéance, sans « J'ai vu »");

    // Puis l'échéance est passée sans contrôle.
    const hier = decaler(aujourdhui, -1);
    await pool.query(
      `UPDATE vehicules SET controle_technique_avant = $2, controle_technique_vu_pour = $2 WHERE id = $1`,
      [id, hier]
    );
    await page.reload({ waitUntil: "networkidle" });
    await carte.waitFor({ timeout: 15_000 });
    assert.equal(await carte.getAttribute("data-atlas-ton"), "rouge", "le contrôle dépassé ne revient pas en rouge");
    assert.match(await carte.innerText(), /Dépassé depuis 1 jour/);
    assert.equal(await jaiVu.count(), 0, "un contrôle dépassé propose encore « J'ai vu »");
    console.log("  ✓ vue puis dépassée, elle revient rouge, sans « J'ai vu »");

    // 3. Le nouveau procès-verbal pose une nouvelle date : le rappel repart à neuf.
    await pool.query(`UPDATE vehicules SET controle_technique_avant = $2 WHERE id = $1`, [id, decaler(aujourdhui, 10)]);
    await page.reload({ waitUntil: "networkidle" });
    await carte.waitFor({ timeout: 15_000 });
    assert.equal(await carte.getAttribute("data-atlas-ton"), "ambre");
    assert.equal(await jaiVu.count(), 1, "la nouvelle échéance n'offre pas « J'ai vu »");
    console.log("  ✓ une nouvelle date la remet à neuf, avec son « J'ai vu »");

    // 4. La date change derrière son écran : le serveur refuse, la carte revient
    //    avec la phrase.
    await pool.query(`UPDATE vehicules SET controle_technique_avant = $2 WHERE id = $1`, [id, decaler(aujourdhui, 11)]);
    await jaiVu.click();
    const refus = carte.locator('[data-atlas="refus-vehicule"]');
    await refus.waitFor({ timeout: 15_000 });
    assert.match(await refus.innerText(), /Cette date a changé/);
    const reste = await pool.query(`SELECT controle_technique_vu_pour::text AS d FROM vehicules WHERE id = $1`, [id]);
    assert.equal(reste.rows[0].d, hier, "un « J'ai vu » refusé a écrit quand même");
    console.log("  ✓ un refus du serveur fait revenir la carte avec sa phrase");
  } finally {
    await navigateur.close();
    await pool.query(`DELETE FROM vehicules WHERE id = $1`, [id]);
    await pool.end();
  }
}

main().catch((err) => {
  console.error("❌", err);
  process.exit(1);
});
