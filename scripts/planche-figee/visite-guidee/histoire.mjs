// L'HISTOIRE DE MME COSTA, jouée avant la visite et jamais figée : un devis
// signé, un chantier passé, son retour d'intervention, sa facture envoyée et ouverte, encore due. C'est
// ce que montre sa fiche quand le visiteur la touche dans Vos clients.
import { session, TRAVAIL } from "./fige.mjs";
import { writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
const P = (sql) => execFileSync("psql", ["-qtA", "postgresql://postgres@localhost:5432/atlas_test", "-c", sql]).toString().trim();
// SUITE=1 reprend après l'accord du client, quand une première passe s'est arrêtée là.
const SUITE = process.env.SUITE === "1";

const LIGNES = [
  ["Plantation d'une haie de photinias", "18", "ml", "45"],
  ["Paillage du pied de haie", "1", "forfait", "120"],
  // La ligne que l'assistant retrouvera pendant la visite (sa demande du 21 novembre).
  ["Pose de claustras en bois, 3 panneaux", "3", "u", "165"],
];
let id = SUITE ? readFileSync(`${TRAVAIL}/chantier-costa.txt`, "utf8").trim() : null;
if (!SUITE) {
  const { page, va, fin } = await session();
  const pas = (t = 700) => page.waitForTimeout(t);
  const remplir = async (label, v) => { const c = page.getByLabel(label, { exact: true }); await c.click(); await c.fill(v); await c.blur(); await pas(400); };
  try {
    await va("/chantiers/nouveau");
    await page.click('[data-atlas="civilite-mme"]');
    await page.getByLabel("Nom du client").fill("Costa");
    await pas(2500);
    await page.getByLabel("Adresse du chantier").fill("3 impasse des Lavandes, 44120 Vertou");
    await pas(800);
    await page.click('[data-atlas="action-ecrire"]');
    await page.waitForURL(/devis-complet/, { timeout: 60000 });
    id = page.url().match(/chantiers\/([0-9a-f-]{36})/)[1];
    await pas(2500);
    await remplir("Titre du devis", "Plantation de la haie");
    for (let i = 0; i < LIGNES.length; i++) {
      await page.getByRole("button", { name: "+ Ajouter une ligne" }).click(); await pas(800);
      const [d, q, u, p] = LIGNES[i];
      await remplir(`Description ${i + 1}`, d); await remplir(`Quantité ${i + 1}`, q);
      await remplir(`Unité ${i + 1}`, u); await remplir(`Prix unitaire ${i + 1}`, p);
    }
    await pas(3000);
    await va(`/chantiers/${id}/devis-complet`);
    await page.click('button:has-text("Choisir la date")'); await pas(2500);
    await page.locator('button[aria-label^="26 novembre"]:visible').first().click(); await pas(1000);
    await page.click('button:has-text("Envoyer le devis")'); await pas(5000);
    console.log("devis envoyé", page.url());
  } catch (e) { console.log("ÉCHEC devis", e.message.split("\n")[0]); await page.screenshot({ path: `${TRAVAIL}/echec.png`, fullPage: true }); }
  await fin();
}
if (!SUITE) writeFileSync(`${TRAVAIL}/chantier-costa.txt`, id);
const jeton = P(`select jeton from envois_devis where chantier_id='${id}' order by envoye_at desc limit 1`);
if (!SUITE) {
  const { page, va, fin } = await session({ anonyme: true });
  try {
    await va(`/devis/${jeton}`);
    await page.locator('input[name="choixDate"]').first().check({ force: true }); await page.waitForTimeout(600);
    await page.locator('input[name="demarrageAnticipe"]').check({ force: true }).catch(() => {});
    await page.getByRole("button", { name: "J'accepte ce devis" }).first().click(); await page.waitForTimeout(1500);
    const z = await page.locator('[data-atlas="signature-devis"] canvas').first().boundingBox();
    await page.mouse.move(z.x + 30, z.y + z.height * 0.5); await page.mouse.down();
    for (const [x, y] of [[70, 0.3], [110, 0.7], [150, 0.35], [200, 0.6], [240, 0.4]]) await page.mouse.move(z.x + x, z.y + z.height * y, { steps: 6 });
    await page.mouse.up(); await page.waitForTimeout(600);
    await page.locator('[data-atlas="signature-devis"]').getByRole("button", { name: /J'accepte/ }).click(); await page.waitForTimeout(4000);
    console.log("accepté");
  } catch (e) { console.log("ÉCHEC client", e.message.split("\n")[0]); }
  await fin();
}
// Le chantier a eu lieu le 10 novembre : Terminés et le retour ne prennent qu'un jour passé.
P(`update chantiers set date_planifiee='2026-11-10' where id='${id}'`);
P(`update creneaux_chantier set jour='2026-11-10' where chantier_id='${id}'`);
P(`update envois_devis set date_retenue='2026-11-10', jours_retenus='["2026-11-10"]' where chantier_id='${id}'`);
{
  const { page, va, fin } = await session();
  const pas = (t = 700) => page.waitForTimeout(t);
  try {
    await va("/planning");
    await page.locator('button[aria-label^="10 novembre"]:visible').first().click(); await pas(2000);
    await page.locator('[data-atlas="ouvrir-travaux"]').first().click(); await pas(1200);
    for (const t of await page.locator('[data-atlas="tache-du-retour"]').all()) { await t.click(); await pas(500); }
    await page.locator('[data-atlas="a-signaler"]').fill("Arrosage à prévoir la première semaine. La cliente garde le reste de paillage.");
    await page.locator('[data-atlas="envoyer-le-retour"]').click(); await pas(4000);
    console.log("retour", await page.locator('[data-atlas="retour-envoye"]').count());
    await va(`/chantiers/${id}/facture`);
    await page.getByRole("button", { name: "Créer la facture" }).click(); await pas(6000);
    await page.locator('[data-atlas="envoyer-la-facture"]').click(); await pas(6000);
    // Sa facture reste due : la fiche et Ma TVA montrent ce qu'on attend d'elle.
    await page.screenshot({ path: `${TRAVAIL}/histoire-paye.png`, fullPage: true });
    // Elle a ouvert sa facture : sa fiche le dira.
    const jf = P(`select e.jeton from envois_factures e join factures f on f.id=e.facture_id where f.chantier_id='${id}' order by e.envoye_at desc limit 1`);
    await page.context().clearCookies();
    await va(`/factures/${jf}`); await pas(1500);
    await page.getByRole("button", { name: /J'ai bien reçu/ }).click().catch((e) => console.log("accusé :", e.message.split("\n")[0]));
    await pas(2500);
    console.log((await page.evaluate(() => document.body.innerText)).slice(-900));
  } catch (e) { console.log("ÉCHEC suite", e.message.split("\n")[0]); await page.screenshot({ path: `${TRAVAIL}/echec.png`, fullPage: true }); }
  await fin();
}
