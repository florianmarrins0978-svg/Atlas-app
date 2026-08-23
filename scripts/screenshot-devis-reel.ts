import { chromium, devices } from "playwright";
import { mkdirSync, writeFileSync } from "fs";
import { creerPuisFiche } from "./_creer-chantier-e2e";

const OUT = "artifacts/screenshots/step-24-devis-reel";
mkdirSync(OUT, { recursive: true });

async function main() {
  const browser = await chromium.launch({
    executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome",
  });
  const context = await browser.newContext({ ...devices["iPhone 13"], });
  const page = await context.newPage();

  await page.goto("http://localhost:3000/chantiers/nouveau", { waitUntil: "networkidle" });
  await page.fill('input[placeholder="Bernard"]', "M. Capture");
  await creerPuisFiche(page);
  await page.waitForURL(/\/chantiers\/[0-9a-f-]{36}/);
  const chantierUrl = page.url();

  await page.goto(`${chantierUrl}/prix`, { waitUntil: "networkidle" });
  await page.click("text=+ Ajouter une ligne");
  await page.waitForTimeout(200);
  await page.click("text=+ Ajouter une ligne");
  await page.waitForTimeout(300);
  const inputs = page.locator("form input");
  await inputs.nth(0).fill("Main d'œuvre — 2 hommes × 2 jours");
  await inputs.nth(1).fill("1120.00");
  await inputs.nth(2).fill("Forfait déplacement");
  await inputs.nth(3).fill("35.00");
  await inputs.nth(3).blur();
  await page.waitForTimeout(300);

  await page.goto(`${chantierUrl}/export`, { waitUntil: "networkidle" });
  await page.screenshot({ path: `${OUT}/01-avant-envoi.png`, fullPage: true });

  const apercuHref = await page.locator("text=Aperçu du PDF").getAttribute("href");
  const reponse = await page.request.get(`http://localhost:3000${apercuHref}`);
  writeFileSync(`${OUT}/apercu-devis.pdf`, await reponse.body());

  await page.click("text=Choisir la date");
  await page.waitForSelector('[data-atlas="invite-dates"]');
  await page.screenshot({ path: `${OUT}/02-confirmation-envoi.png`, fullPage: true });
  await page.getByRole("button", { name: "Envoyer le devis" }).click();
  await page.waitForURL(/localhost:3000\/$/, { timeout: 15000 }); // L'envoi ramène à L'ACCUEIL depuis le 21 août 2026 : c'est lui, le signal.
  await page.screenshot({ path: `${OUT}/03-apres-envoi.png`, fullPage: true });

  // **Demandé au serveur.** « Télécharger le PDF » a été retiré de cet écran le
  // 21 août 2026 : on photographie ce qu'il voit, et il ne le voit plus. Le
  // document, lui, existe toujours et c'est bien celui-là qu'on garde.
  const reponseFinale = await page.request.get(
    `http://localhost:3000${apercuHref}?telecharger=1`
  );
  writeFileSync(`${OUT}/devis-envoye.pdf`, await reponseFinale.body());

  await browser.close();
  console.log("captured 3 états + 2 PDF sauvegardés");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
