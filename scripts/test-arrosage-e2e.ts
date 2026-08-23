import { lancerNavigateur } from "./e2e-browser";
import assert from "node:assert/strict";

// L'écran « Plan d'arrosage », DANS l'application — sa demande du 20 août 2026 :
// *« code le tout dans l'appli »*.
//
// **CE QUE CETTE SUITE TIENT, ET QU'AUCUNE SUITE BASE NE VERRAIT :**
//
//   1. **le chemin existe.** Paysage ouvrait jusqu'ici une page HORS d'Atlas ;
//      il doit maintenant mener à un écran interne. C'est le raccord qui casse,
//      jamais la formule ;
//   2. **l'écran tient en peu de mots.** Sa demande, quatre fois répétée en dix
//      jours : « beaucoup trop de mots dans tous les sens ». Un plafond compté
//      ici empêche l'écran de regrossir — corriger un écran de plus n'a jamais
//      rien réglé ;
//   3. **rien ne déborde à 390 px**, la largeur de son téléphone ;
//   4. **l'absence de clé d'IA se DIT**, avant le geste. Le laisser
//      photographier pour rien serait le troisième bouton qui ne répond pas ;
//   5. **aucun chiffre n'est annoncé tant que rien n'est calculé.** « 0,00 m³/h »
//      se lirait comme une mesure.

const BASE = "http://localhost:3000";

let echecs = 0;
async function cas(nom: string, fn: () => Promise<void>) {
  try {
    await fn();
    console.log(`  ✓ ${nom}`);
  } catch (e) {
    echecs++;
    console.error(`  ✗ ${nom}\n    ${(e as Error).message}`);
  }
}

async function main() {
  const navigateur = await lancerNavigateur();
  const contexte = await navigateur.newContext({ viewport: { width: 390, height: 900 } });
  const page = await contexte.newPage();

  await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  await page.fill('input[name="email"]', "demo@atlas.local");
  await page.fill('input[name="password"]', "demo1234");
  await page.click('button[type="submit"]');
  await page.waitForURL(`${BASE}/`, { timeout: 20_000 });

  await cas("depuis Paysage, l'arrosage s'ouvre DANS l'application", async () => {
    await page.goto(`${BASE}/paysage`, { waitUntil: "networkidle" });
    const lien = page.locator('a[href="/paysage/arrosage"]');
    assert.ok(
      (await lien.count()) >= 1,
      "aucun lien vers l'arrosage interne : l'écran Paysage renvoie encore dehors"
    );
    // **Et il ne s'ouvre plus dans un autre onglet.** C'était la marque d'une
    // page publiée à côté ; la garder ferait sortir de l'application pour rien.
    assert.equal(
      await lien.first().getAttribute("target"),
      null,
      "le lien s'ouvre encore hors de l'application"
    );
    await lien.first().click();
    await page.waitForURL(`${BASE}/paysage/arrosage`, { timeout: 20_000 });
  });

  // **CE CONTRÔLE A CHANGÉ AVEC L'ÉCRAN, le 20 août au soir.** Il exigeait les
  // trois cases « litres · secondes · bar » à l'ouverture. Or le patron a
  // demandé qu'au compteur rien ne s'affiche, et que le seau vaille 10 L sans
  // qu'on le demande — la case « litres » n'existe plus, et les deux autres
  // n'apparaissent qu'hors compteur. Un contrôle qui réclame ce qu'il a fait
  // retirer rend son écran impossible à changer (`CLAUDE.md` §5 bis).
  await cas("l'écran porte le titre, le piquage et le croquis", async () => {
    await page.locator("h1").first().waitFor({ timeout: 30_000 });
    const texte = await page.locator("body").innerText();
    assert.match(texte, /Plan d.arrosage/i, `le titre manque :\n${texte.slice(0, 200)}`);
    assert.match(texte, /piquage se fait/i, "le libellé du piquage manque");
    assert.equal(await page.locator('select[name="piquage"]').count(), 1, "le déroulant du piquage manque");
    assert.equal(
      await page.locator('input[name="croquis"]').count(),
      1,
      "le champ de la photo du croquis manque"
    );
  });

  // ── L'écran ne regagne pas de mots ────────────────────────────────────────
  //
  // **C'est ce que le dépôt réclamait depuis quatre plaintes** : un contrôle qui
  // rougit quand un écran grossit. Le plafond n'est pas une cible — c'est ce que
  // l'écran pèse, plus une marge.
  await cas("l'écran tient en peu de mots", async () => {
    // **`innerText`, jamais `textContent`.** Le second rend TOUT le document,
    // menus repliés et gabarits cachés compris : il annonçait 270 mots là où
    // l'écran en montre une quarantaine, et accusait l'écran d'avoir regagné
    // 240 mots qu'il ne portait pas. Un contrôle qui accuse à tort coûte plus
    // cher que pas de contrôle (`CLAUDE.md` §5).
    //
    // **Aucune fonction NOMMÉE dans `page.evaluate`.** Le compilateur de ce
    // dépôt injecte un helper `__name` dans les fonctions qu'il nomme ; envoyé
    // au navigateur, ce helper n'existe pas et l'évaluation tombe sur
    // « __name is not defined » — une panne qui n'a rien à voir avec l'écran.
    const mots = await page.evaluate(() => {
      const vu = (document.querySelector("form") as HTMLElement | null)?.innerText ?? "";
      // D'un menu fermé, seule l'option retenue se voit — mais `innerText` les
      // rend toutes. On retire donc celles qui ne sont pas choisies, et
      // l'étiquette du bouton d'envoi, réservée aux lecteurs d'écran.
      const aRetirer = [
        ...[...document.querySelectorAll("select option")].filter(
          (o) => !(o as HTMLOptionElement).selected
        ),
        ...document.querySelectorAll(".sr-only"),
        // **Une ALERTE n'est pas du bavardage.** « Aucune clé d'IA » ou le
        // motif d'un croquis refusé sont là pour être lus quand quelque chose
        // cloche — et n'apparaissent pas quand tout va bien. Les compter
        // ferait rougir le plafond sur un banc sans clé, pour un écran qui,
        // chez lui, ne les montre pas.
        ...document.querySelectorAll('[data-atlas="alerte"]'),
        // **L'AVERTISSEMENT SUR LE CROQUIS NE SE COMPTE PAS NON PLUS**, et
        // c'est lui qui a fait rougir ce contrôle le 23 août 2026.
        //
        // Deux de ses règles se croisaient ici : *« tous les autres mots, tu me
        // les supprimes »* (20 août) et *« c'est un petit message qu'il faut
        // mettre au-dessus du croquis, en noir gras »* (22 août). Il a tranché
        // lui-même en demandant la seconde — et un contrôle qui interdit ce que
        // le patron a demandé rend son écran impossible à faire (`CLAUDE.md`
        // §5 bis, dans l'autre sens).
        //
        // **On l'exclut plutôt que de relever le plafond** : relever le plafond
        // rendrait vingt mots de bavardage possibles ailleurs, ce que ce
        // contrôle existe précisément pour empêcher. Sa présence, elle, est
        // éprouvée à part — et sa position aussi.
        ...document.querySelectorAll('[data-atlas="avertissement-croquis"]'),
      ]
        .map((e) => e.textContent ?? "")
        .join(" ");
      const motsVus = vu.split(/\s+/).filter((m) => /[\p{L}\p{N}]/u.test(m)).length;
      const motsCaches = aRetirer.split(/\s+/).filter((m) => /[\p{L}\p{N}]/u.test(m)).length;
      return motsVus - motsCaches;
    });
    const PLAFOND = 30;
    assert.ok(
      mots <= PLAFOND,
      `l'écran porte ${mots} mots pour un plafond de ${PLAFOND} : il en a regagné ${mots - PLAFOND}`
    );
  });

  // ── Les mesures n'apparaissent QUE hors compteur ──────────────────────────
  //
  // *Sa correction du 20 août au soir :* « quand je choisis le piquage, qu'il se
  // fait après le compteur d'eau, rien ne doit s'afficher. Il ne doit pas y
  // avoir marqué dix litres, vingt, trois bars. »
  await cas("au compteur, aucune mesure n'est demandée", async () => {
    await page.goto(`${BASE}/paysage/arrosage`, { waitUntil: "networkidle" });
    await page.waitForTimeout(500);
    assert.equal(
      await page.locator('[data-atlas="mesures"]').count(),
      0,
      "l'écran demande des mesures alors que le piquage est au compteur"
    );
    // Et rien n'est prérempli : un chiffre posé d'avance se prend pour une mesure.
    const valeurs = await page.locator('input[type="number"]').all();
    for (const v of valeurs) {
      assert.equal(await v.inputValue(), "", "une case porte une valeur qu'il n'a pas saisie");
    }
  });

  await cas("hors compteur, les mesures s'ouvrent", async () => {
    await page.selectOption("#piquage", "ailleurs");
    await page.waitForTimeout(400);
    assert.equal(
      await page.locator('[data-atlas="mesures"]').count(),
      1,
      "les mesures ne s'ouvrent pas quand le piquage est ailleurs"
    );
    for (const champ of ["secondes", "barStatique", "barDynamique"]) {
      assert.equal(
        await page.locator(`input[name="${champ}"]`).count(),
        1,
        `la case « ${champ} » manque`
      );
    }
  });

  // ── Le seau n'est PAS dans le kit ─────────────────────────────────────────
  //
  // *Sa correction du 21 août 2026 :* « la mesure au seau ne doit pas rentrer
  // dans le kit débit/pression ».
  //
  // **Ce que ce contrôle tient est une RÈGLE, pas une mise en page**
  // (`CLAUDE.md` §5 bis) : le seau et le kit sont deux gestes, deux outils,
  // deux fiabilités — et l'écran ne doit jamais laisser croire qu'un chiffre
  // tiré du seau vaut celui du manomètre. Il ne dit donc RIEN de l'ordre des
  // deux blocs, de leurs titres exacts ni de leur allure : il exige que le
  // champ du seau ne soit pas rangé sous le kit, et que le seau porte une
  // réserve de précision.
  await cas("le seau est séparé du kit, et se dédouane", async () => {
    const seau = page.locator('[data-atlas="seau"]');
    const kit = page.locator('[data-atlas="kit"]');
    assert.equal(await seau.count(), 1, "l'encart du seau manque");
    assert.equal(await kit.count(), 1, "l'encart du kit manque");

    // **Le défaut qu'il a signalé se teste EN PREMIER**, sans quoi son message
    // n'atteint jamais l'écran : une assertion qui tombe avant lui dirait « le
    // champ n'est pas dans le seau » sans dire où il est parti, et enverrait
    // chercher au mauvais endroit (`CLAUDE.md` §5).
    assert.equal(
      await kit.locator('input[name="secondes"]').count(),
      0,
      "le champ du seau est RANGÉ DANS le kit débit/pression — c'est précisément ce qu'il a fait retirer le 21 août"
    );
    // Et il est bien quelque part : chez le seau, à qui il appartient.
    assert.equal(
      await seau.locator('input[name="secondes"]').count(),
      1,
      "le champ des secondes n'est nulle part dans l'encart du seau"
    );

    // Les deux pressions appartiennent au kit.
    for (const champ of ["barStatique", "barDynamique"]) {
      assert.equal(
        await kit.locator(`input[name="${champ}"]`).count(),
        1,
        `la case « ${champ} » n'est pas dans l'encart du kit`
      );
    }

    // **Le seau se dédouane, et il DÉCONSEILLE.** Sa correction du 21 août :
    // « peu précis, ordre de grandeur, ça ne va rien dire — qu'on comprenne
    // tout de suite qu'en gros ce n'est pas une bonne idée de calculer au seau
    // pour son arrosage automatique ». Une réserve qui se contente de qualifier
    // le chiffre se lit comme une nuance et se franchit sans y penser.
    //
    // Deux exigences, aucune formule imposée — les mots restent les siens :
    // la mention réserve le chiffre, ET elle désigne le geste à faire à la
    // place. Un contrôle qui figerait la phrase rendrait l'écran impossible à
    // retoucher (`CLAUDE.md` §5 bis).
    const texteSeau = (await seau.innerText()).toLowerCase();
    assert.ok(
      /approximat|peu précis|pas précis|peu fiable|déconseill|à éviter|dépannage|à la louche/.test(texteSeau),
      `le seau ne réserve pas son chiffre : ${texteSeau}`
    );
    assert.ok(
      /kit|manomètre|préf[eé]r|prenez|plutôt/.test(texteSeau),
      `le seau réserve son chiffre mais ne dit pas quoi faire à la place — une nuance se franchit sans y penser : ${texteSeau}`
    );

    // Et le kit nomme sa buse : sans elle, il relèverait la statique, robinet
    // fermé, toujours flatteuse — la bonne grandeur au mauvais moment.
    const texteKit = (await kit.innerText()).toLowerCase();
    assert.match(texteKit, /buse 5/, `le kit ne nomme pas la buse : ${texteKit}`);
  });

  // ── La photo se PREND ou se CHOISIT ──────────────────────────────────────
  //
  // *Sa demande du 21 août 2026 :* « soit je peux mettre une photo de ma
  // bibliothèque, soit prendre une photo — le même schéma que pour ajouter des
  // photos à la fiche client ».
  //
  // **`capture` n'est pas une préférence, c'est un ordre.** Avec cet attribut,
  // le téléphone ouvre l'appareil et le menu ne paraît jamais. Or un croquis se
  // dessine souvent la veille : le rephotographier depuis un écran donne une
  // photo de photo, que le modèle lira mal.
  //
  // Le contrôle tient la RÈGLE — le choix reste au patron — et non une mise en
  // page : il ne dit rien du libellé du bouton ni de son allure.
  await cas("le croquis se prend OU se choisit dans la bibliothèque", async () => {
    const capture = await page.evaluate(() => {
      const champ = document.querySelector("#croquis") as HTMLInputElement | null;
      return champ ? champ.getAttribute("capture") : "champ absent";
    });
    assert.equal(
      capture,
      null,
      `le champ force l'appareil photo (capture="${capture}") : le menu « Photothèque / Prendre une photo » ne s'ouvrira jamais`
    );
    // Et il accepte bien des images — sans quoi la bibliothèque s'ouvrirait sur
    // des fichiers qu'on ne peut pas choisir.
    const accepte = await page.getAttribute("#croquis", "accept");
    assert.match(accepte ?? "", /image/, `le champ n'accepte pas les images : ${accepte}`);
  });

  // **Le puits et la cuve sont retirés**, sur sa demande du 20 août au soir.
  await cas("le piquage sur une pompe n'est plus proposé", async () => {
    const choix = await page.locator("#piquage option").allInnerTexts();
    assert.equal(choix.length, 2, `le menu porte ${choix.length} choix : ${choix.join(" | ")}`);
    assert.ok(
      !choix.some((c) => /puits|cuve|pompe/i.test(c)),
      `un choix de pompe subsiste : ${choix.join(" | ")}`
    );
    // **Un choix qu'on ne peut pas lire en entier ne se choisit pas.** Vu à la
    // capture : « Ailleurs (robinet de jardin, nourrice exista… » se coupait
    // dans le menu natif à 390 px. Le menu fermé montre l'option retenue : on
    // mesure donc qu'elle tient dans sa boîte.
    await page.selectOption("#piquage", "ailleurs");
    await page.waitForTimeout(300);
    const coupe = await page.evaluate(() => {
      const sel = document.querySelector("#piquage") as HTMLSelectElement | null;
      if (!sel) return null;
      // Le texte de l'option retenue, mesuré dans la police du menu.
      const sonde = document.createElement("span");
      const style = getComputedStyle(sel);
      sonde.style.cssText = `position:absolute;visibility:hidden;white-space:nowrap;font:${style.font}`;
      sonde.textContent = sel.options[sel.selectedIndex]?.text ?? "";
      document.body.appendChild(sonde);
      const large = sonde.getBoundingClientRect().width;
      sonde.remove();
      // La flèche du menu et les marges mangent une quarantaine de pixels.
      return { texte: sonde.textContent, large, place: sel.getBoundingClientRect().width - 44 };
    });
    assert.ok(
      coupe !== null && coupe.large <= coupe.place,
      `le choix « ${coupe?.texte} » se coupe : ${Math.round(coupe?.large ?? 0)} px pour ${Math.round(coupe?.place ?? 0)} disponibles`
    );
  });

  await cas("aucun chiffre n'est annoncé tant que rien n'est calculé", async () => {
    const texte = await page.locator("body").innerText();
    // Un « 0,00 m³/h » posé d'avance se lirait comme une mesure faite.
    assert.doesNotMatch(texte, /0,00\s*m³\/h/, "un débit nul s'affiche avant toute mesure");
    assert.equal(
      await page.locator('[data-atlas="plan-arrosage"]').count(),
      0,
      "le plan s'affiche avant qu'aucun croquis n'ait été lu"
    );
  });

  // ── L'AVERTISSEMENT SE LIT AVANT DE PHOTOGRAPHIER ────────────────────────
  //
  // Sa demande du 22 août 2026 : *« c'est un petit message qu'il faut mettre
  // au-dessus du croquis, en noir gras »*. **Au-dessus, pas en dessous** — placé
  // après le bouton, il se lirait une fois la photo partie, donc trop tard, et
  // il faudrait retourner au jardin refaire le croquis.
  //
  // Ce n'est pas une recommandation : sans ces trois éléments, l'outil ne
  // propose rien (`CLAUDE.md` §4 bis). Le contrôle vérifie donc les trois mots
  // ET la position, parce que c'est la position qui fait tout son intérêt.
  await cas("l'avertissement sur le croquis se lit AVANT le bouton photo", async () => {
    const avertissement = page.locator('[data-atlas="avertissement-croquis"]');
    assert.equal(await avertissement.count(), 1, "l'avertissement sur le croquis a disparu de l'écran");
    const texte = (await avertissement.innerText()).toLowerCase();
    for (const mot of ["métrés", "nourrice", "piquage"]) {
      assert.ok(texte.includes(mot), `l'avertissement ne parle pas des ${mot} : « ${texte} »`);
    }
    const gras = await avertissement.evaluate((e) => Number(getComputedStyle(e).fontWeight));
    assert.ok(gras >= 600, `l'avertissement n'est pas en gras (${gras}) : il se lira comme une note de bas de page`);
    const haut = await avertissement.boundingBox();
    const bouton = await page.locator('[data-atlas="ajouter-croquis"]').boundingBox();
    assert.ok(
      haut !== null && bouton !== null && haut.y + haut.height <= bouton.y,
      "l'avertissement est SOUS le bouton photo : il se lirait une fois la photo partie",
    );
  });

  await cas("rien ne déborde sur la largeur de son téléphone", async () => {
    const m = await page.evaluate(() => ({
      page: document.documentElement.scrollWidth,
      vue: window.innerWidth,
      // **Ce qu'on TOUCHE, pas ce qu'on lit.** La première version comptait
      // aussi les étiquettes « Litres », « Secondes », « Bar » — dix pixels de
      // haut, et personne n'a jamais eu à les viser. Elle accusait l'écran de
      // porter cinq cibles trop petites qui n'en sont pas.
      petits: [...document.querySelectorAll('[data-atlas="ajouter-croquis"], select, input[type="number"]')]
        .map((e) => e.getBoundingClientRect())
        .filter((r) => r.height > 0 && r.height < 28).length,
    }));
    assert.ok(
      m.page <= m.vue + 1,
      `l'écran déborde de ${m.page - m.vue} px : il faut le glisser de côté pour tout lire`
    );
    assert.equal(m.petits, 0, `${m.petits} geste(s) de moins de 28 px de haut : on les rate au doigt`);
  });

  // ── L'IA absente se dit AVANT le geste ────────────────────────────────────
  //
  // Sur ce banc, aucune clé n'est posée : l'écran doit donc l'annoncer. Chez
  // lui, les clés existent et la phrase disparaît.
  // ── LE GESTE ENTIER, ET C'EST LE CONTRÔLE QUI MANQUAIT ────────────────────
  //
  // **Sa plainte du 20 août au soir :** *« quand je clique sur croquis et que
  // j'ajoute une photo, rien ne se passe »*. Il avait raison : le bouton
  // ouvrait l'appareil, mais rien ne soumettait le formulaire ensuite.
  //
  // **La suite ne l'a pas vu parce qu'elle ne posait jamais de photo.** Elle
  // vérifiait que le bouton existe et qu'il fait 64 px — jamais que le geste
  // aboutit. C'est exactement ce qu'`AGENTS.md` interdit : parcourir en entier
  // ce qu'on transmet, du premier geste au dernier.
  //
  // Ici, sans clé d'IA, la lecture ne peut pas rendre de plan — et c'est très
  // bien : ce qu'on éprouve, c'est que l'envoi PART. Un refus affiché prouve
  // que le serveur a été saisi ; le silence prouverait le contraire.
  await cas("choisir une photo déclenche la lecture, sans second bouton", async () => {
    await page.goto(`${BASE}/paysage/arrosage`, { waitUntil: "networkidle" });
    await page.waitForTimeout(600);

    // Un vrai fichier, minuscule mais valide : un PNG d'un pixel.
    const pixel = Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
      "base64"
    );
    await page.setInputFiles("#croquis", {
      name: "croquis.png",
      mimeType: "image/png",
      buffer: pixel,
    });

    // **Aucun second bouton n'est touché.** C'est tout le sujet : l'écran n'en
    // montre pas, à sa demande.
    const reponse = page.locator('[data-atlas="alerte"], [data-atlas="plan-arrosage"]');
    await reponse.first().waitFor({ timeout: 30_000 });
    const vu = (await page.locator("body").innerText()).toLowerCase();
    assert.ok(
      /lecture|croquis|plan|clé/.test(vu),
      `l'écran n'a rien répondu après la photo :\n${vu.slice(0, 300)}`
    );
  });

  // ── L'ATTENTE SOUFFLE, ELLE NE S'ÉCRIT PAS EN « … » ──────────────────────
  //
  // **Sa demande du 23 août 2026 :** *« lors de la lecture du croquis, mets les
  // trois petits points qui bougent — la fonction souffle qu'on a mise partout
  // dans l'application »*.
  //
  // Trois points de suspension IMMOBILES sont exactement le défaut qu'il avait
  // signalé le 13 août sur la dictée : ils disent « rien ne se passe » pendant
  // que le travail est en cours. Et la lecture d'un croquis est la plus longue
  // attente de l'application.
  //
  // **LA RÉPONSE DU SERVEUR EST RETARDÉE EXPRÈS**, et c'est ce qui rend ce
  // contrôle sûr. Sur ce banc, aucune clé de vision n'est posée : la lecture
  // refuse en quelques dizaines de millisecondes, et guetter le souffle
  // reviendrait à jouer à pile ou face — un contrôle qui passe au vert une fois
  // sur deux ne prouve rien et finit ignoré.
  await cas("pendant la lecture, les trois points soufflent", async () => {
    await page.goto(`${BASE}/paysage/arrosage`, { waitUntil: "networkidle" });
    await page.waitForTimeout(400);

    // On ne retarde QUE l'action serveur (une requête POST sur l'écran
    // lui-même) : retarder tout la page mettrait aussi les ressources en
    // attente, et l'écran ne serait plus celui qu'il voit.
    const retarder = async (route: import("playwright").Route) => {
      if (route.request().method() !== "POST") return route.continue();
      await new Promise((r) => setTimeout(r, 2_000));
      return route.continue();
    };
    await page.route(`${BASE}/paysage/arrosage`, retarder);

    try {
      const pixel = Buffer.from(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
        "base64"
      );
      await page.setInputFiles("#croquis", { name: "croquis.png", mimeType: "image/png", buffer: pixel });

      const points = page.locator(".atlas-souffle i");
      await points.first().waitFor({ state: "visible", timeout: 5_000 });
      assert.equal(await points.count(), 3, "il faut trois points, pas un glyphe « … »");

      // **Le souffle se MESURE**, il ne se suppose pas : le composant peut être
      // là et son animation coupée par une feuille de style, et l'écran
      // montrerait alors trois points immobiles — le défaut d'origine, sous un
      // autre nom.
      const echelles: number[] = [];
      for (let t = 0; t < 1_000; t += 40) {
        echelles.push(
          await points.first().evaluate((el) => {
            const m = new DOMMatrixReadOnly(
              getComputedStyle(el).transform === "none" ? "" : getComputedStyle(el).transform
            );
            return Math.hypot(m.m11, m.m12);
          })
        );
        await page.waitForTimeout(40);
      }
      const amplitude = Math.max(...echelles) - Math.min(...echelles);
      assert.ok(
        amplitude >= 0.5,
        `les points n'enflent que de ${amplitude.toFixed(2)} — sous 0,5, l'œil ne le voit pas`
      );

      // Et le caractère immobile ne doit pas cohabiter avec eux.
      const libelle = await page.locator('[data-atlas="ajouter-croquis"]').innerText();
      assert.doesNotMatch(libelle, /…/, `le « … » immobile est encore là : « ${libelle} »`);
    } finally {
      await page.unroute(`${BASE}/paysage/arrosage`, retarder);
    }
  });

  // **Quand la lecture ne se fera pas, l'écran dit POURQUOI — et le motif doit
  // désigner le bon coupable.** Corrigé le 21 août 2026 : l'écran servait
  // « aucune clé d'IA n'est posée sur ce serveur » quelle qu'en soit la cause,
  // ce qui est faux quand la clé est là mais que le fournisseur choisi ne sait
  // pas lire une image — et envoie coller une clé qui ne changera rien.
  //
  // Le contrôle tient la RÈGLE, pas la phrase : l'écran annonce que le croquis
  // ne sera pas lu, et il n'accuse « aucune clé » que lorsque c'est bien une clé
  // qui manque.
  await cas("quand la lecture ne se fera pas, l'écran dit pourquoi", async () => {
    const alerte = page.locator('[data-atlas="alerte"]');
    if ((await alerte.count()) === 0) {
      // La lecture est disponible sur ce banc : le cas ne se produit pas ici, et
      // le dire vaut mieux que de laisser croire à une vérification qui n'a pas
      // eu lieu (`CLAUDE.md` §5).
      console.log("    (la lecture d'image est disponible sur ce banc : rien à vérifier)");
      return;
    }
    const texte = await alerte.first().innerText();
    assert.match(texte, /ne sera pas lu/, `l'écran ne dit pas que le croquis ne sera pas lu : ${texte}`);
    // **La règle : une CAUSE, pas une formule.** Les trois causes possibles se
    // réparent différemment — une clé à poser, un fournisseur qui ne lit pas,
    // aucun fournisseur réglé — et l'écran doit dire laquelle. Une première
    // version de ce contrôle exigeait « n'est pas configuré » et rougissait sur
    // « n'est configuré » : elle accusait l'écran d'un défaut qu'il n'avait pas,
    // ce qui coûte plus cher que pas de contrôle du tout (`CLAUDE.md` §5).
    assert.ok(
      /API_KEY|configur|ne sait pas|n.est pas pos/i.test(texte),
      `l'écran dit que rien ne sera lu, sans dire pourquoi : ${texte}`
    );
  });

  await contexte.close();
  await navigateur.close();

  console.log(`\n${echecs === 0 ? "✅" : "❌"} Le plan d'arrosage, dans l'application — ${echecs} échec(s).`);
  process.exit(echecs === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
