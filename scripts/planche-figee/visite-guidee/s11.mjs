import { session, TRAVAIL } from "./fige.mjs";
const { page, va, fige, fin } = await session();
const pas = (t = 700) => page.waitForTimeout(t);
const RUBRIQUES = ["identite","banque","mon-annee","equipe","vehicules","organigramme","tarifs","documents","fournisseurs","ia","agenda","abonnement","donnees","compte","notifications","connexion","connexion/double-verification","apparence","idee"];
try {
  await va("/termines/comptable/dossiers");
  await page.click('[data-atlas="ouvrir-dossier"]');
  await page.waitForURL(/documents\/pdf/, { timeout: 60000 });
  await page.waitForSelector("canvas", { timeout: 60000 }); await pas(5000);
  await fige("49-dossier-pdf");
  await va("/reglages");
  await fige("50-reglages");
  for (const r of RUBRIQUES) { await va(`/reglages/${r}`); await pas(800); await fige(`r-${r.replace("/", "-")}`); }
  await va("/reglages/idee");
  await page.getByRole("button", { name: /J'écris mon idée/ }).click(); await pas(1200);
  await page.locator("textarea").first().fill("Pouvoir envoyer le devis par WhatsApp.");
  await pas(600);
  await fige("r-idee-ecrite");
} catch (e) { console.log("ÉCHEC", e.message.split("\n")[0]); await page.screenshot({ path: `${TRAVAIL}/echec.png`, fullPage: true }); }
await fin();
