import type { Page } from "playwright";
import { lancerNavigateur } from "./e2e-browser";

// « Mon compte » et « Connexion » — les deux dernières rubriques des réglages.
//
// Dessinées le 14 août 2026 (`maquettes/atlas-reglages-moi.html`), codées le
// même jour sur ses deux réponses : **« A A »** — pas de téléphone dans le
// compte, pas de liste d'appareils dans la connexion.
//
// CE QUE CETTE SUITE TIENT, ET CE QU'ELLE LAISSE À LA SUITE BASE :
//
//   · ce qu'elle tient — **l'écran** : les rubriques mènent quelque part, les
//     libellés ne promettent plus ce qui n'existe pas, l'œil affiche et masque
//     pour de bon, le bouton reste éteint tant que la saisie ne tient pas, et
//     « me déconnecter partout » demande confirmation avant de fermer ;
//   · ce qu'elle laisse — **l'écriture** : `scripts/test-compte-db.ts` éprouve
//     que le condensat change, que le voisin n'est pas touché et que la coupure
//     des jetons devance la seconde en cours. Les suites navigateur tournent
//     sous un rôle qui TRAVERSE la RLS (`CLAUDE.md` §5) : leur faire garder
//     l'isolation serait leur faire dire ce qu'elles ne peuvent pas voir.
//
// **ET ELLE NE CHANGE PAS LE MOT DE PASSE POUR DE BON.** Le compte de
// démonstration sert aux soixante-quinze suites de la batterie : le changer ici
// fermerait la porte à toutes celles qui suivent, et l'échec accuserait la page
// de connexion — un défaut qui envoie chercher au mauvais endroit
// (`AGENTS.md`). Le chemin éprouvé ici est donc celui du REFUS, qui n'écrit
// rien.

const BASE = "http://localhost:3000";

let echecs = 0;
function verifie(nom: string, condition: boolean, detail = "") {
  if (condition) {
    console.log(`  ✓ ${nom}`);
  } else {
    echecs++;
    console.log(`  ✗ ${nom}${detail ? ` — ${detail}` : ""}`);
  }
}

async function main() {
  const navigateur = await lancerNavigateur();
  // 390 × 664 : son iPhone. Sur un grand écran, la barre du bouton ne recouvre
  // jamais rien et le contrôle qui la mesure serait vert sans rien prouver.
  const contexte = await navigateur.newContext({ viewport: { width: 390, height: 664 } });
  const page: Page = await contexte.newPage();

  try {
    await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
    await page.fill('input[name="email"]', "demo@atlas.local");
    await page.fill('input[name="password"]', "demo1234");
    await page.click('button[type="submit"]');
    await page.waitForURL(`${BASE}/`);

    console.log("=== Mon compte, et ma connexion ===\n");

    // ── 1. Le sommaire ne promet plus ce qui n'existe pas ────────────────
    await page.goto(`${BASE}/reglages`, { waitUntil: "networkidle" });
    const sommaire = (await page.locator("main, body").first().innerText()).replace(/\s+/g, " ");

    verifie("le sommaire ne promet plus de téléphone dans « Mon compte »",
      !/Nom, e-mail et téléphone/i.test(sommaire), sommaire.slice(0, 120));
    verifie("ni de liste d'appareils dans « Connexion »",
      !/Mot de passe et appareils/i.test(sommaire));
    verifie("les deux rubriques ne sont plus marquées « Bientôt »",
      await page.locator('a[href="/reglages/compte"]').count() === 1 &&
      await page.locator('a[href="/reglages/connexion"]').count() === 1);

    // ── 2. Mon compte ────────────────────────────────────────────────────
    await page.goto(`${BASE}/reglages/compte`, { waitUntil: "networkidle" });
    const compte = (await page.locator("body").innerText()).replace(/\s+/g, " ");

    verifie("l'écran du compte s'ouvre sur son titre", /Mon compte/.test(compte));
    verifie("le nom se saisit", await page.getByLabel("Nom").count() === 1);
    verifie("l'e-mail du compte s'affiche", /demo@atlas\.local/.test(compte), compte.slice(0, 140));

    // **LE CONTRÔLE QUI PORTE SA DÉCISION.** Un champ téléphone rajouté ici
    // « pour faire complet » rouvrirait ce qu'il a fermé, et personne ne s'en
    // apercevrait avant qu'il ne le voie sur une capture.
    verifie("AUCUN champ téléphone — c'est sa réponse « A » du 14 août",
      await page.getByLabel(/téléphone/i).count() === 0);

    // **Le paragraphe qui l'expliquait a été retiré le 26 août 2026**, à sa
    // demande — quatre lignes sous le bouton, à moitié cachées par la barre.
    // Le contrôle qui le réclamait aurait rougi sur du code juste, pour une
    // demande exaucée (`CLAUDE.md` §5 bis) : ce qu'on défend, c'est l'ABSENCE
    // du champ, pas la phrase qui la commentait. Et on refuse qu'elle revienne.
    verifie("et l'écran ne l'explique plus — l'absence se suffit",
      !/Pas de téléphone ici/i.test(compte), compte.slice(0, 160));

    // **L'e-mail ne se saisit pas, et l'écran le dit en six mots.** Sans cette
    // ligne, un champ qui ne s'ouvre pas se lirait comme une panne. Le POURQUOI
    // — rien ne permet de vérifier une nouvelle adresse — a quitté l'écran le
    // 26 août : il vit dans `ARCHITECTURE.md`, pas sous ses yeux.
    verifie("l'e-mail ne se saisit pas, et l'écran le dit COURT",
      await page.getByLabel("E-mail").count() === 0 && /Pas encore modifiable/i.test(compte),
      compte.slice(0, 200));
    verifie("et la longue explication n'est pas revenue",
      !/ne se change pas encore/i.test(compte));

    // **Ce que le patron a fait retirer le 26 août ne doit pas repousser.**
    verifie("« Ce compte » et la phrase sous le nom sont partis",
      !/Ce compte\b/i.test(compte) && !/ne part pas chez le client/i.test(compte),
      compte.slice(0, 200));

    verifie("le bouton du bas est là, et dit que tout est écrit",
      /Enregistré/.test(await page.locator("button", { hasText: /Enregistr/ }).first().innerText()));

    // ── 3. Connexion : trois champs, et l'œil ────────────────────────────
    await page.goto(`${BASE}/reglages/connexion`, { waitUntil: "networkidle" });

    // **Viser l'ENTRÉE, pas le libellé.** L'œil porte le nom de son champ dans
    // son propre libellé — « Afficher mot de passe actuel » —, sans quoi une
    // personne qui n'entend que les libellés ne saurait pas lequel des trois
    // il ouvre. Chercher par libellé attrape donc les deux, et l'échec accuse
    // le champ alors que c'est la recherche qui est trop large.
    const champ = (etiquette: string) => page.locator(`input[aria-label="${etiquette}"]`);
    const actuel = champ("Mot de passe actuel");
    const nouveau = champ("Nouveau mot de passe");
    const confirmer = champ("Confirmer le nouveau mot de passe");
    verifie("le mot de passe se saisit TROIS fois — actuel, nouveau, confirmation",
      (await actuel.count()) === 1 && (await nouveau.count()) === 1 && (await confirmer.count()) === 1);

    verifie("les trois sont masqués au repos",
      (await actuel.getAttribute("type")) === "password" &&
      (await nouveau.getAttribute("type")) === "password" &&
      (await confirmer.getAttribute("type")) === "password");

    // **AUCUN APPAREIL INVENTÉ**, et c'est sa seconde réponse « A ». Une liste
    // plausible se valide en dix secondes ; il n'y a pourtant rien derrière.
    const connexion = (await page.locator("body").innerText()).replace(/\s+/g, " ");
    verifie("aucune liste d'appareils, qui n'existe nulle part",
      !/(iphone|android|ipad|chrome|safari|firefox|windows)/i.test(connexion), connexion.slice(0, 160));
    verifie("mais le geste utile est proposé", /Me déconnecter partout/i.test(connexion));

    // L'œil : il doit FAIRE quelque chose. Un pictogramme mort se valide sur
    // une capture sans que personne ne s'en aperçoive.
    await nouveau.fill("bruyere-42-nord");
    await page.getByRole("button", { name: /Afficher nouveau mot de passe/i }).click();
    verifie("touché, l'œil affiche le mot de passe",
      (await nouveau.getAttribute("type")) === "text");
    await page.getByRole("button", { name: /Masquer nouveau mot de passe/i }).click();
    verifie("et le second appui le remasque",
      (await nouveau.getAttribute("type")) === "password");
    verifie("l'œil du nouveau n'a pas ouvert les deux autres",
      (await actuel.getAttribute("type")) === "password" &&
      (await confirmer.getAttribute("type")) === "password");

    // ── 4. Le bouton ne s'allume que sur une saisie qui tient ────────────
    const bouton = page.getByRole("button", { name: /Changer mon mot de passe/ });
    verifie("sans confirmation, le bouton reste éteint", await bouton.isDisabled());

    await confirmer.fill("bruyere-42-NORD");
    verifie("une confirmation différente le laisse éteint", await bouton.isDisabled());
    verifie("et l'écran le DIT, sans attendre l'appui",
      /ne sont pas identiques/i.test((await page.locator("body").innerText()).replace(/\s+/g, " ")));

    await confirmer.fill("bruyere-42-nord");
    verifie("les deux saisies identiques sont signalées",
      /Les deux sont identiques/.test((await page.locator("body").innerText()).replace(/\s+/g, " ")));
    verifie("mais le mot de passe actuel manque encore : bouton éteint",
      await bouton.isDisabled());

    await actuel.fill("demo1234");
    verifie("les trois champs remplis allument le bouton", await bouton.isEnabled());

    // ── 5. Le refus DÉSIGNE le bon champ ─────────────────────────────────
    //
    // Ce chemin n'écrit rien : le compte de démonstration garde son mot de
    // passe, et les suites suivantes entrent toujours.
    await actuel.fill("pas-le-bon-mot-de-passe");
    await bouton.click();
    await page.waitForTimeout(1_200);
    const apresRefus = (await page.locator("body").innerText()).replace(/\s+/g, " ");
    verifie("un mot de passe actuel erroné est refusé, en toutes lettres",
      /mot de passe actuel n'est pas celui-là/i.test(apresRefus), apresRefus.slice(0, 200));

    // ── 6. « Me déconnecter partout » ne part pas au premier doigt ────────
    await page.getByRole("button", { name: /Me déconnecter partout/ }).first().click();
    await page.waitForTimeout(300);
    verifie("le geste demande confirmation avant de fermer",
      /Vous devrez vous reconnecter sur tous vos appareils/i.test(
        (await page.locator("body").innerText()).replace(/\s+/g, " ")));
    verifie("et il se reprend", await page.getByRole("button", { name: "Annuler" }).count() === 1);
    await page.getByRole("button", { name: "Annuler" }).click();
    await page.waitForTimeout(200);
    verifie("annulé, la session tient toujours", page.url().includes("/reglages/connexion"));

    // ── 7. Les onglets ne recouvrent pas le bouton ───────────────────────
    //
    // **Ce que ce contrôle défend n'a PAS changé le 26 août 2026 ; la façon de
    // le mesurer, si.** Le bouton vivait sur une barre fixe, et l'on vérifiait
    // que cette barre se posait au-dessus des onglets. Le patron l'a fait
    // remonter sous ses propres champs (`ARCHITECTURE.md` §183) : il n'y a plus
    // de barre, donc plus rien à mesurer — et le contrôle réclamait un élément
    // que sa demande venait de supprimer (`CLAUDE.md` §5 bis).
    //
    // La règle, elle, tient : **aucun geste ne doit être recouvert par les
    // onglets**. On amène donc le bouton sous les yeux et on regarde s'il l'est.
    // Le défaut ne se voit que sur SON écran : sur un grand, tout tient sans
    // effort. C'est la mesure, pas l'œil.
    await page.getByRole("button", { name: "Changer mon mot de passe" }).scrollIntoViewIfNeeded();
    await page.waitForTimeout(250);
    const place: { ecart: number | null; avecNav: boolean; erreur: string | null } = await page.evaluate(() => {
      const bouton = [...document.querySelectorAll("button")]
        .find((b) => /Changer mon mot de passe/.test(b.textContent ?? ""));
      const nav = document.querySelector('nav[aria-label="Navigation principale"]');
      if (!bouton) return { ecart: null, avecNav: Boolean(nav), erreur: "bouton introuvable" };
      const b = bouton.getBoundingClientRect();
      // **Une boîte de zéro pixel ne prouve rien** (`CLAUDE.md` §5) : la mise en
      // page ne serait pas appliquée, et « 0 ≥ 0 » rendrait un vert vide.
      if (b.height < 10) return { ecart: null, avecNav: Boolean(nav), erreur: `bouton haut de ${b.height} px` };
      // Sans navigation sur cet écran, la référence est le bas de la fenêtre :
      // ce qu'on veut savoir, c'est qu'aucun geste n'est recouvert.
      const bas = nav ? nav.getBoundingClientRect().y : window.innerHeight;
      return { ecart: bas - (b.y + b.height), avecNav: Boolean(nav), erreur: null };
    });
    verifie("les onglets ne recouvrent pas le bouton du mot de passe",
      place.ecart !== null && place.ecart >= -1.5,
      place.erreur ?? `${place.ecart?.toFixed(1)} px (navigation ${place.avecNav ? "présente" : "absente"})`);
  } finally {
    await navigateur.close();
  }

  console.log("");
  if (echecs) {
    console.log(`${echecs} ÉCHEC(S).`);
    process.exit(1);
  }
  console.log("Mon compte et ma connexion — 0 échec(s).");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
