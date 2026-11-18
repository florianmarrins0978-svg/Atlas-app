// Signer au doigt dans un navigateur, comme le client sur son téléphone.
//
// Depuis sa planche du 17 novembre 2026, « J'accepte ce devis » ne part pas
// sans un trait dans le cadre « Votre signature ». Les suites qui acceptent un
// devis passent donc par ce geste, et par lui seul : un trait posé à la souris,
// point par point, sur la vraie toile. Remplir les champs cachés à la main
// éprouverait la porte de service, pas celle du client (`CLAUDE.md` §5 quater).
import type { Page } from "playwright";

/** Trace une signature ondulée dans la toile de `zone` (par défaut, celle du devis). */
export async function signerAuDoigt(page: Page, zone = '[data-atlas="signature-devis"]'): Promise<void> {
  const toile = page.locator(`${zone} canvas`).first();
  await toile.scrollIntoViewIfNeeded();
  const boite = await toile.boundingBox();
  if (!boite || boite.width < 40 || boite.height < 40) {
    throw new Error(`La toile de signature n'est pas à l'écran (${JSON.stringify(boite)}) : rien ne peut s'y tracer.`);
  }
  const x0 = boite.x + boite.width * 0.12;
  const largeur = boite.width * 0.76;
  const milieu = boite.y + boite.height * 0.45;
  await page.mouse.move(x0, milieu);
  await page.mouse.down();
  for (let i = 1; i <= 30; i++) {
    await page.mouse.move(x0 + (largeur * i) / 30, milieu + Math.sin(i / 3) * boite.height * 0.18);
  }
  await page.mouse.up();
}
