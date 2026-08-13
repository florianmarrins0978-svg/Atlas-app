import assert from "node:assert/strict";
import { lancerNavigateur } from "./e2e-browser";

// **« Que l'utilisateur puisse, s'il le souhaite ou non, connecter son planning
// à son agenda Google. »** — le patron, le 9 août 2026.
//
// Le « ou non » est la moitié qu'un contrôle peut réellement tenir ici. Le
// raccordement lui-même demande des identifiants Google que cet environnement
// n'a pas (`docs/A-FAIRE.md` §7) — et c'est précisément **l'état que le patron
// verra en ouvrant l'écran aujourd'hui**. Il vaut donc d'être éprouvé pour
// lui-même, plutôt que traité comme un cas dégradé sans intérêt.
//
// Ce que cette suite tient :
//
//   1. **l'écran existe et se trouve depuis les réglages.** Une page qu'on ne
//      peut atteindre qu'en tapant son adresse n'existe pas pour lui ;
//   2. **sans identifiants, l'écran le dit et ne propose RIEN à cliquer.** Un
//      bouton « Relier » qui mène à une erreur Google est pire qu'un bouton
//      absent : il donne à croire que le raccordement a été tenté ;
//   3. **le risque est nommé, pas caché.** Atlas ne voit pas les rendez-vous
//      notés ailleurs, et peut proposer ce jour-là. L'artisan doit l'apprendre
//      de l'écran, pas de son client mécontent.

const BASE = "http://localhost:3000";

async function main() {
  const navigateur = await lancerNavigateur();
  const contexte = await navigateur.newContext();
  const page = await contexte.newPage();

  let echecs = 0;
  const cas = async (nom: string, verifier: () => Promise<void>) => {
    try {
      await verifier();
      console.log(`  ✓ ${nom}`);
    } catch (e) {
      echecs++;
      console.error(`  ✗ ${nom}\n    ${(e as Error).message}`);
    }
  };

  await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
  await page.fill('input[name="email"]', "demo@atlas.local");
  await page.fill('input[name="password"]', "demo1234");
  await page.click('button[type="submit"]');
  await page.waitForURL(`${BASE}/`, { timeout: 20000 });

  console.log("--- L'agenda, au choix de l'artisan ---");

  await cas("les réglages mènent à l'écran de l'agenda", async () => {
    await page.goto(`${BASE}/reglages`, { waitUntil: "domcontentloaded" });
    const lien = page.getByRole("link", { name: /Mon agenda/i });
    await lien.waitFor({ state: "visible", timeout: 15000 });
    await lien.click();
    // `waitForURL` ne se résout pas sur une navigation côté client : on attend
    // un élément réel de la page d'arrivée.
    await page.getByRole("heading", { name: "Mon agenda" }).waitFor({ timeout: 15000 });
  });

  await cas("l'écran dit le risque : un rendez-vous noté ailleurs est invisible", async () => {
    const texte = await page.locator("body").innerText();
    assert.match(
      texte,
      /rendez-vous noté ailleurs/i,
      "l'écran ne dit pas pourquoi il existe — l'artisan ne saura pas ce qu'il risque"
    );
  });

  await cas("sans identifiants, l'écran l'annonce clairement", async () => {
    const texte = await page.locator("body").innerText();
    assert.match(
      texte,
      /pas encore disponible/i,
      `l'écran laisse croire que le raccordement est possible. Vu : ${texte.slice(0, 400)}`
    );
  });

  await cas("et il ne propose AUCUN bouton GOOGLE qui mènerait à une erreur", async () => {
    // Le point qui compte. Un bouton « Relier » sans identifiants envoie
    // l'artisan chez Google avec un client vide : il lit un message d'erreur en
    // anglais et croit qu'Atlas est cassé.
    //
    // **Recadré sur Google le 12 août 2026**, quand iCloud est venu sur le même
    // écran. Le compte ne portait aucun nom de fournisseur et rougissait sur le
    // bouton « Relier mon agenda Apple » — lequel, lui, est parfaitement
    // légitime : le raccordement iCloud ne demande aucune configuration
    // préalable, c'est toute la différence entre les deux (`QUESTIONS.md` §14).
    // Les commandes iCloud (pause, débrancher) n'existent qu'une fois relié :
    // le compte reste donc à zéro ici, et il le vérifie.
    const boutons = await page
      .getByRole("button", { name: /mon agenda Google|Débrancher et effacer|Mettre en pause/i })
      .count();
    assert.equal(boutons, 0, `${boutons} bouton(s) de raccordement proposés alors que rien n'est configuré`);
  });

  await cas("mais il propose de coller ses identifiants — le geste qui débloque", async () => {
    // **Sa demande du 9 août 2026.** Avant, les identifiants se posaient dans
    // la configuration du serveur : il faisait sa part chez Google et restait
    // bloqué faute de pouvoir les saisir. Trois cases, et il n'a plus besoin
    // de personne.
    for (const libelle of ["Identifiant client", "Secret client", "Adresse de retour"]) {
      await page
        .getByLabel(libelle)
        .waitFor({ state: "visible", timeout: 10000 })
        .catch(() => {
          throw new Error(`la case « ${libelle} » n'est pas proposée`);
        });
    }
    const enregistrer = await page.getByRole("button", { name: /Enregistrer/ }).count();
    assert.equal(enregistrer, 1, "aucun bouton pour enregistrer les identifiants");
  });

  await cas("le secret ne s'affiche pas en clair pendant la frappe", async () => {
    // Ces écrans se remplissent souvent à deux, ou en visio avec quelqu'un qui
    // aide à trouver la bonne page dans la console Google.
    const type = await page.getByLabel("Secret client").getAttribute("type");
    assert.equal(type, "password", "le secret client s'affiche en clair");
  });

  await cas("l'écran dit où créer les identifiants, sans faire chercher", async () => {
    const texte = await page.locator("body").innerText();
    assert.match(texte, /console\.cloud\.google\.com/i, "l'adresse de la console Google n'est pas donnée");
  });

  // ─── iCloud : le second raccordement, et ses deux règles ────────────────
  //
  // Sa demande du 12 août 2026, capture du Calendrier d'Apple à l'appui, puis
  // « code pour qu'on puisse lire et écrire dans cet agenda ». Le raccordement
  // lui-même ne peut pas être joué ici — le réseau refuse `caldav.icloud.com` —
  // mais l'écran, lui, est celui qu'il verra, et il porte deux règles qu'aucun
  // test de texte ne tiendrait.

  await cas("iCloud se relie sans configuration préalable, contrairement à Google", async () => {
    await page.goto(`${BASE}/reglages/agenda`, { waitUntil: "domcontentloaded" });
    await page.getByRole("heading", { name: "Mon agenda" }).waitFor({ timeout: 15000 });
    await page
      .getByRole("button", { name: /Relier mon agenda Apple/i })
      .waitFor({ state: "visible", timeout: 15000 });
  });

  await cas("l'avertissement est AU-DESSUS du champ, pas en dessous", async () => {
    // **La règle que cet écran ne peut pas se permettre de rater.** Le mot de
    // passe pour les apps ouvre TOUT l'iCloud — mail, contacts, fichiers —,
    // Apple ne sachant pas le restreindre à un service. Prévenir après la
    // frappe, c'est prévenir trop tard.
    //
    // Vérifié par les POSITIONS et non par la présence du texte : une phrase
    // juste, placée au mauvais endroit, laisse un contrôle de texte au vert.
    const avertissement = await page
      .locator("text=Ce mot de passe ouvre tout votre iCloud")
      .first()
      .boundingBox();
    const champ = await page.getByLabel("Mot de passe pour les apps").boundingBox();
    assert.ok(avertissement && champ, "l'avertissement ou le champ manque à l'écran");
    assert.ok(
      avertissement.y + avertissement.height <= champ.y,
      `l'avertissement finit à ${Math.round(avertissement.y + avertissement.height)} et le champ commence à ${Math.round(champ.y)}`
    );
  });

  await cas("le mot de passe iCloud est masqué, et ne fait pas zoomer iOS", async () => {
    const champ = page.getByLabel("Mot de passe pour les apps");
    assert.equal(await champ.getAttribute("type"), "password", "le mot de passe s'affiche en clair");
    // En dessous de 16 px, iOS agrandit la page dès la mise au point et l'écran
    // part de travers sous son doigt.
    const corps = await champ.evaluate((e) => parseFloat(getComputedStyle(e).fontSize));
    assert.ok(corps >= 16, `${corps} px : iOS zoomera à la mise au point`);
  });

  await cas("l'écriture n'est pas proposée tant que rien n'est relié", async () => {
    // **Écrire est une décision**, et on ne propose pas de décider de ce qui
    // n'existe pas encore. L'interrupteur n'apparaît qu'une fois le compte
    // branché — sinon il laisserait croire que des chantiers partent déjà.
    const interrupteurs = await page.getByRole("switch").count();
    assert.equal(interrupteurs, 0, `${interrupteurs} interrupteur(s) d'écriture avant tout raccordement`);
  });

  await cas("l'avertissement se lit d'une phrase, sans mot recollé au suivant", async () => {
    // **Trouvé sur une capture, pas par un test (12 août 2026) :** l'écran
    // affichait « votre iCloud— pas seulement l'agenda ». Le JSX avale l'espace
    // qui suit une balise fermante à cet endroit — l'écran de Google portait
    // déjà un `{" "}` pour cette raison, sans que personne l'ait écrit.
    //
    // Le contrôle vise le TEXTE RENDU, pas la source : c'est le seul endroit où
    // la différence se voit.
    const phrase = await page
      .locator("text=Ce mot de passe ouvre tout votre iCloud")
      .first()
      .evaluate((e) => (e.closest("p") ?? e).textContent ?? "");
    assert.match(
      phrase,
      /tout votre iCloud — pas seulement l'agenda/,
      `mot recollé au suivant : « ${phrase.slice(0, 80)} »`
    );
  });

  await cas("l'écran dit où générer le mot de passe, sans faire chercher", async () => {
    const texte = await page.locator("body").innerText();
    assert.match(texte, /account\.apple\.com/i, "l'adresse du compte Apple n'est pas donnée");
    assert.match(texte, /Mots de passe pour les apps/i, "le nom exact du réglage chez Apple manque");
  });

  await cas("le planning propose de relier l'agenda, là où le manque se constate", async () => {
    // **Sa demande, textuellement :** *« dans planning il faut un petit bouton
    // connecter son agenda Google cliquable. »* Le laisser au fond des réglages
    // revenait à demander à quelqu'un qui ignore le problème d'aller chercher
    // sa solution.
    await page.goto(`${BASE}/planning`, { waitUntil: "domcontentloaded" });
    const lien = page.getByRole("link", { name: /Relier mon agenda Google/i });
    await lien.waitFor({ state: "visible", timeout: 15000 });
    await lien.click();
    await page.getByRole("heading", { name: "Mon agenda" }).waitFor({ timeout: 15000 });
  });

  await cas("l'écran ne s'effondre pas et reste lisible sur un téléphone", async () => {
    await page.goto(`${BASE}/reglages/agenda`, { waitUntil: "domcontentloaded" });
    await page.getByRole("heading", { name: "Mon agenda" }).waitFor({ timeout: 15000 });
    // `truncate` et les débordements sont du CSS : une vérification de texte
    // reste verte sur un écran illisible. On mesure donc la page rendue.
    const largeur = await page.evaluate(() => document.documentElement.scrollWidth);
    // **Contre la largeur RÉELLE de la fenêtre, pas contre un nombre écrit à la
    // main.** « 400 » s'accordait sept pixels de marge sur un écran de 393 — et
    // le vrai téléphone n'en fait que 390. Une tolérance inventée finit
    // toujours par couvrir un débordement véritable.
    const fenetre = await page.evaluate(() => document.documentElement.clientWidth);
    assert.ok(
      largeur <= fenetre + 1,
      `la page déborde horizontalement (${largeur}px pour ${fenetre} disponibles)`
    );
    const hauteur = await page.evaluate(() => document.body.getBoundingClientRect().height);
    assert.ok(hauteur > 300, `la page semble vide (${Math.round(hauteur)}px de haut)`);
  });

  await cas("le bouton « Enregistrer » n'est couvert par rien", async () => {
    // **Ce que seule une mesure attrape.** La barre de navigation et la bulle
    // d'assistance sont en position fixe : elles flottent au-dessus du contenu.
    // Un bouton dessous reste dans le HTML, donc vert pour toute vérification
    // de texte — et intouchable au doigt. Trois défauts réels de ce projet
    // étaient de cette famille (`CLAUDE.md` §5).
    const bouton = page.getByRole("button", { name: "Enregistrer" });
    await bouton.scrollIntoViewIfNeeded();
    await page.waitForTimeout(300);
    const boite = await bouton.boundingBox();
    assert.ok(boite, "le bouton « Enregistrer » n'a pas de place à l'écran");
    const dessus = await page.evaluate(
      `(() => {
        var r = ${JSON.stringify(boite)};
        var el = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
        return el ? el.tagName + " " + String(el.className).slice(0, 60) : "rien";
      })()`
    );
    assert.match(
      String(dessus),
      /BUTTON/,
      `quelque chose recouvre le bouton « Enregistrer » : ${dessus}`
    );
  });

  await navigateur.close();
  console.log(`\n${echecs === 0 ? "✅" : "❌"} Écran de l'agenda — ${echecs} échec(s).`);
  if (echecs > 0) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
