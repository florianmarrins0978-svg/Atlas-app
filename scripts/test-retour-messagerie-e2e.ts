import assert from "node:assert/strict";
import { lancerNavigateur } from "./e2e-browser";
import { Pool } from "pg";

// **Revenir de sa messagerie, et retomber chez soi.**
//
// Le patron, le 7 août 2026 : *« lorsque j'envoie le SMS et que je reviens sur
// la page, il faut que la page se remette sur la première page automatiquement,
// avec un petit message. »* Il revenait jusque-là sur l'écran qu'il avait
// quitté, identique au pixel près — rien ne disait que quelque chose s'était
// passé, et il devait redescendre chercher la barre du bas.
//
// Ce que cette suite tient, et qu'aucune autre ne voit :
//
//   1. **le retour est détecté**, et ramène à la liste des chantiers ;
//   2. **le bandeau dit ce qui s'est passé**, avec le nom du client ;
//   3. **il ne revient pas.** Lu une fois, effacé — un message qu'on voit à
//      chaque passage sur l'accueil ne se lit plus ;
//   4. **un simple aller-retour d'onglet ne déclenche rien.** Sans ce
//      garde-fou, relire son devis renverrait le patron à l'accueil.
//
// Le départ vers Messages ne se simule pas : `sms:` sort du navigateur. On
// reproduit donc ce qui se passe RÉELLEMENT — le passage en arrière-plan puis
// le retour au premier plan, que le composant écoute par `visibilitychange`.

const BASE = "http://localhost:3000";

async function main() {
  const navigateur = await lancerNavigateur();
  const contexte = await navigateur.newContext({ viewport: { width: 393, height: 852 } });
  const page = await contexte.newPage();

  await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  await page.fill('input[name="email"]', "demo@atlas.local");
  await page.fill('input[name="password"]', "demo1234");
  await page.click('button[type="submit"]');
  await page.waitForURL(`${BASE}/`, { timeout: 30_000 });

  // --- 4 d'abord : un retour SANS départ ne doit rien faire ---------------
  //
  // Éprouvé en premier, sur l'accueil : si ce cas échouait après les autres, on
  // ne saurait pas s'il est faux ou s'il subit leur état résiduel.
  await simulerRetour(page);
  await page.waitForTimeout(600);
  assert.equal(
    new URL(page.url()).pathname,
    "/",
    "Un simple retour au premier plan a déclenché une navigation : relire un devis renverrait le patron à l'accueil."
  );
  const sansDepart = await page.locator("body").innerText();
  assert.doesNotMatch(sansDepart, /transmis/i, "Un bandeau s'affiche alors que rien n'a été transmis.");
  console.log("  ✓ revenir sans être parti ne déclenche rien");

  // --- 1 à 3 : le vrai parcours -------------------------------------------
  //
  // **Depuis l'écran du devis, et pas d'ailleurs.** Première version de cette
  // suite : elle simulait le retour depuis le planning, un écran qui ne porte
  // pas le mécanisme — et concluait que le mécanisme ne marchait pas. Le
  // patron, lui, part TOUJOURS de l'écran où se trouve le bouton.
  const chantierId = await chantierAvecDevisPret();
  assert.ok(chantierId, "Aucun chantier avec un devis prêt : le jeu de démonstration ne permet pas d'éprouver ce parcours.");
  await page.goto(`${BASE}/chantiers/${chantierId}/export`, { waitUntil: "networkidle" });
  await page.waitForTimeout(1200);

  // On pose la marque exactement comme le fait le lien de transmission — le
  // toucher pour de vrai ferait sortir le navigateur vers Messages, qui
  // n'existe pas ici.
  await page.evaluate(() => {
    sessionStorage.setItem("atlas.transmission", JSON.stringify({ quoi: "devis", client: "Mr Cuisseau" }));
    sessionStorage.setItem("atlas.transmission.depart", "1");
  });
  await simulerRetour(page);

  await page.waitForURL(`${BASE}/`, { timeout: 20_000 });
  console.log("  ✓ le retour ramène à la liste des chantiers");

  const accueil = page.locator("body");
  await accueil.getByText(/Devis transmis à Mr Cuisseau/).waitFor({ state: "visible", timeout: 10_000 });
  const texte = await accueil.innerText();
  assert.match(
    texte,
    /en attente de sa réponse/i,
    "Le bandeau ne dit pas où en est le devis — c'est la moitié de ce qu'il apporte."
  );
  assert.doesNotMatch(
    texte,
    /Devis envoyé/i,
    "Le bandeau affirme un envoi qu'aucun contrôle n'a constaté : le patron a pu annuler dans sa messagerie."
  );
  console.log("  ✓ le bandeau nomme le client et dit ce qui suit");

  // --- 3 : lu une fois, effacé --------------------------------------------
  await page.goto(`${BASE}/planning`, { waitUntil: "networkidle" });
  await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
  await page.waitForTimeout(800);
  assert.doesNotMatch(
    await page.locator("body").innerText(),
    /Devis transmis/i,
    "Le bandeau revient à chaque passage sur l'accueil : un message vu dix fois ne se lit plus."
  );
  console.log("  ✓ lu une fois, il ne revient pas");

  await navigateur.close();
  console.log("✅ Le retour de la messagerie ramène chez soi, avec un mot juste.");
}

/** Un chantier dont le devis est parti et attend encore une réponse. */
async function chantierAvecDevisPret(): Promise<string | null> {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  try {
    const { rows } = await pool.query(
      `SELECT d.chantier_id FROM envois_devis e
         JOIN devis d ON d.id = e.devis_id
        WHERE e.reponse IS NULL
        LIMIT 1`
    );
    return rows[0]?.chantier_id ?? null;
  } finally {
    await pool.end();
  }
}

/** Ce que fait iOS au retour de Messages : la page était cachée, elle réapparaît. */
async function simulerRetour(page: import("playwright").Page) {
  await page.evaluate(() => {
    Object.defineProperty(document, "visibilityState", { value: "hidden", configurable: true });
    document.dispatchEvent(new Event("visibilitychange"));
    Object.defineProperty(document, "visibilityState", { value: "visible", configurable: true });
    document.dispatchEvent(new Event("visibilitychange"));
  });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
