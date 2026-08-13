import { lancerNavigateur } from "./e2e-browser";
import assert from "node:assert/strict";

// Le geste exact du patron, rejoué dans un navigateur.
//
// Le 3 août 2026 : « lorsque je clique sur la touche retour de mon navigateur
// et que je reviens sur la page, ça me compte deux prestations, donc le prix du
// devis a fait ×2 tout seul ». Son devis affichait 4 017,60 € TTC, soit
// 3 348 € HT — deux fois 1 674 €.
//
// La suite pure `test-proposition-au-detail.ts` éprouve la règle. Celle-ci
// éprouve **le parcours**, parce que le défaut n'était pas dans la règle : il
// était dans un bouton qui oubliait, au premier retour arrière, ce qu'il venait
// de faire. Une règle juste que l'écran n'applique pas ne protège personne.

const BASE = "http://localhost:3000";

function montantDuTotal(texte: string): number {
  // « 1 674,00 € » — espaces insécables compris.
  return Number(texte.replace(/[^\d,]/g, "").replace(",", "."));
}

async function main() {
  const navigateur = await lancerNavigateur();
  const contexte = await navigateur.newContext();
  const page = await contexte.newPage();

  await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  await page.fill('input[name="email"]', "demo@atlas.local");
  await page.fill('input[name="password"]', "demo1234");
  await page.click('button[type="submit"]');
  await page.waitForURL(`${BASE}/`, { timeout: 15000 });

  const nom = `Chantier doublon e2e ${Date.now()}`;
  await page.goto(`${BASE}/chantiers/nouveau`, { waitUntil: "networkidle" });
  await page.fill('input[placeholder="Bernard"]', nom);
  await page.click('button:has-text("Créer le chantier")');
  await page.waitForURL(/\/chantiers\/[0-9a-f-]{36}/, { timeout: 10000 });
  const chantierUrl = page.url();
  const prixUrl = `${chantierUrl}/prix`;

  // Une prestation qui correspond à un tarif des données de démonstration :
  // sans correspondance, aucune proposition n'est calculée et la suite
  // n'éprouverait rien (elle le dit et échoue plutôt que de passer au vert).
  await page.goto(`${chantierUrl}/informations`, { waitUntil: "networkidle" });
  await page.click("text=+ Ajouter une prestation");
  await page.waitForTimeout(400);
  const champPrestation = page.locator("form input").first();
  await champPrestation.fill("Dépose carrelage");
  await champPrestation.blur();
  await page.waitForTimeout(800);

  await page.goto(prixUrl, { waitUntil: "networkidle" });

  const bouton = page.getByRole("button", { name: /Ajouter au détail|Déjà au détail/ });
  if ((await bouton.count()) === 0) {
    // Aucune proposition possible sur ce jeu de données : la suite n'a rien à
    // éprouver, et le dire vaut mieux que de passer au vert sans avoir regardé.
    console.error(
      "✗ Aucune proposition de prix n'a pu être calculée : ce contrôle n'a rien éprouvé. " +
        "Vérifier les tarifs de démonstration."
    );
    process.exit(1);
  }

  await bouton.click();
  await page.waitForTimeout(1500);

  const totalApresPremierAjout = montantDuTotal(await page.locator("p", { hasText: "€" }).first().innerText());
  assert.ok(totalApresPremierAjout > 0, "La proposition n'a rien ajouté au détail.");
  console.log(`  ✓ premier ajout : ${totalApresPremierAjout.toFixed(2)} €`);

  // Le geste du patron : partir vers le devis, puis revenir en arrière.
  await page.goto(`${chantierUrl}/export`, { waitUntil: "networkidle" });
  await page.goBack({ waitUntil: "networkidle" });
  await page.waitForTimeout(1500);

  const libelleApresRetour = await bouton.innerText();
  // Insensible à la casse, pour la même raison qu'ailleurs depuis la refonte :
  // `innerText` rend « DÉJÀ AU DÉTAIL » là où le code écrit « Déjà au détail ».
  // Ce qui compte est que le bouton REFUSE de rajouter la ligne, pas la casse.
  assert.match(
    libelleApresRetour,
    /déjà au détail/i,
    `Après un retour arrière, le bouton dit « ${libelleApresRetour} » : l'écran réinvite à doubler le devis.`
  );
  assert.equal(await bouton.isDisabled(), true, "Le bouton reste actionnable après un retour arrière.");
  console.log("  ✓ après retour arrière : le bouton dit « Déjà au détail » et ne répond plus");

  // Le refus côté serveur — le cas où l'écran est contourné — est éprouvé
  // séparément par `test-prix-doublon-serveur.ts`, sans navigateur.

  await page.reload({ waitUntil: "networkidle" });
  await page.waitForTimeout(1000);
  const totalApresRechargement = montantDuTotal(await page.locator("p", { hasText: "€" }).first().innerText());
  assert.equal(
    totalApresRechargement.toFixed(2),
    totalApresPremierAjout.toFixed(2),
    `Le total a bougé tout seul : ${totalApresPremierAjout} € puis ${totalApresRechargement} €.`
  );
  console.log(`  ✓ après rechargement : toujours ${totalApresRechargement.toFixed(2)} €`);

  await contexte.close();
  await navigateur.close();
  console.log("✅ Le devis ne double plus au retour arrière.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
