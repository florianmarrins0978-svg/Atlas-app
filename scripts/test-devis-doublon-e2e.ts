import { lancerNavigateur } from "./e2e-browser";
import assert from "node:assert/strict";
import { creerPuisFiche } from "./_creer-chantier-e2e";

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
  const idChantier = await creerPuisFiche(page);
  await page.waitForURL(/\/chantiers\/[0-9a-f-]{36}/, { timeout: 10000 });
  const chantierUrl = `${BASE}/chantiers/${idChantier}`;
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

  // **ON ATTEND LE BOUTON, ON NE COMPTE PLUS LES MILLISECONDES.**
  //
  // Deux pauses fixes ont déjà été posées ici — 800 ms, puis 1 500 ms — parce
  // que la suite passait seule et rougissait en batterie, où l'enregistrement
  // de la prestation prend plus longtemps. **Elles n'ont pas suffi non plus :**
  // les 26 et 27 août 2026, deux batteries de suite se sont arrêtées ici, et le
  // message accusait « les tarifs de démonstration » — le mauvais coupable, sur
  // un jeu de données parfaitement sain.
  //
  // **Une pause fixe est un pari sur la charge de la machine**, et ce pari se
  // reperd à chaque suite ajoutée à la batterie. On attend donc que le bouton
  // PARAISSE, en redemandant la page : le délai devient une borne haute, plus
  // une supposition. Rapide quand la machine l'est, patient quand elle ne l'est
  // pas.
  const bouton = page.getByRole("button", { name: /Ajouter au détail|Déjà au détail/ });
  const finAttente = Date.now() + 30_000;
  do {
    await page.goto(prixUrl, { waitUntil: "networkidle" });
    if ((await bouton.count()) > 0) break;
    await page.waitForTimeout(1000);
  } while (Date.now() < finAttente);

  if ((await bouton.count()) === 0) {
    // **Le message ne peut plus accuser les tarifs sans avoir regardé.** Après
    // trente secondes d'attente, ce n'est plus une question de charge : soit la
    // prestation ne s'est pas enregistrée, soit aucun tarif ne lui correspond.
    // Les deux se distinguent à l'écran, et l'on dit lequel on a vu.
    // **On lit les CHAMPS, pas le texte de la page.** Une prestation saisie vit
    // dans la `value` d'un `<input>`, et `innerText` ne la voit pas : la
    // première version de ce diagnostic annonçait « la prestation n'a pas été
    // enregistrée » alors qu'elle l'était — c'est-à-dire qu'elle accusait à
    // tort, le défaut même qu'elle vient réparer. Vu en retirant le tarif.
    await page.goto(`${chantierUrl}/informations`, { waitUntil: "networkidle" });
    const saisies = await page.locator("form input").evaluateAll((champs) =>
      champs.map((c) => (c as HTMLInputElement).value)
    );
    const posee = saisies.some((v) => /Dépose carrelage/i.test(v));
    console.error(
      "✗ Aucune proposition de prix après trente secondes : ce contrôle n'a rien éprouvé.\n" +
        (posee
          ? "  La prestation « Dépose carrelage » EST bien sur le chantier : c'est donc le tarif " +
            "correspondant qui manque au jeu de démonstration."
          : "  La prestation « Dépose carrelage » n'a PAS été enregistrée sur le chantier : " +
            "le défaut est dans la saisie, pas dans les tarifs.")
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
