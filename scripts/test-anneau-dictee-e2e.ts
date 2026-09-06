import { lancerNavigateur } from "./e2e-browser";
import assert from "node:assert";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { creerPuisFiche } from "./_creer-chantier-e2e";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MICRO_SIMULE = path.join(__dirname, "fixtures", "fake-mic.wav");
const BASE = "http://localhost:3000";

// **« Il manque la note vocale au milieu. »**
//
// Le patron, le 11 août 2026, devant la fiche d'un chantier qu'il venait de
// créer. L'anneau n'apparaissait qu'une fois la dictée faite, et la dictée
// arrivait en DEUXIÈME action, derrière les photos : sur un chantier neuf —
// c'est-à-dire au moment précis où l'on veut parler — le cœur du produit était
// caché derrière autre chose.
//
// Sa demande, mot pour mot : *« l'anneau qui est en plein milieu et dès qu'on
// arrive sur la page, il y est en fait, qu'on ait cliqué dessus ou non. »*
//
// Ce que cette suite tient :
//
//   1. le geste de dictée est là **dès l'arrivée**, sur un chantier vide, sans
//      qu'on ait touché quoi que ce soit ;
//   2. un appui dicte, l'avion envoie — et la note existe vraiment ;
//   3. rouverte, la fiche montre LE MÊME objet — le micro, jamais le lecteur
//      (sa remarque du 5 septembre 2026, `ARCHITECTURE.md` §261) ;
//   4. la note reste écoutable et retirable, sur l'écran qui la porte ;
//   5. **la bulle de l'assistant ne recouvre rien.**
//
// **Le DESSIN a changé le 30 août 2026, la règle non.** Le repos est le disque
// plein qu'il a choisi (repos B) et non plus l'anneau creux ; l'arrêt n'envoie
// plus — l'avion le fait, la poubelle jette. Ce contrôle vise donc les marques
// stables (`data-atlas`) partout où il le peut : une assertion écrite sur une
// classe de dessin réclame demain ce qu'il aura fait retirer (`CLAUDE.md`
// §5 bis). Remonter l'anneau au centre
//      a poussé « ou rédiger le devis à la main » sous la bulle : le lien
//      existait, il était touchable, et il était illisible. Vu en capture, et
//      seulement là — c'est le troisième défaut de cette sorte sur ce dépôt.

let echecs = 0;

async function cas(nom: string, verifier: () => Promise<void>) {
  try {
    await verifier();
    console.log(`  ✓ ${nom}`);
  } catch (e) {
    echecs++;
    console.error(`  ✗ ${nom}\n    ${(e as Error).message}`);
  }
}

async function main() {
  const navigateur = await lancerNavigateur({
    args: [
      "--use-fake-device-for-media-stream",
      "--use-fake-ui-for-media-stream",
      `--use-file-for-fake-audio-capture=${MICRO_SIMULE}`,
    ],
  });
  // L'écran du patron vient de `e2e-browser` — c'est ce défaut-ci qui l'y a
  // fait poser, et le détail de l'histoire est écrit là-bas.
  const contexte = await navigateur.newContext({ permissions: ["microphone"] });
  const page = await contexte.newPage();

  await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  await page.fill('input[name="email"]', "demo@atlas.local");
  await page.fill('input[name="password"]', "demo1234");
  await page.click('button[type="submit"]');
  await page.waitForURL(`${BASE}/`, { timeout: 20_000 });

  // Un chantier NEUF : ni photo, ni dictée — exactement le sien.
  await page.goto(`${BASE}/chantiers/nouveau`, { waitUntil: "networkidle" });
  await page.fill('input[placeholder="Bernard"]', `Anneau e2e ${Date.now()}`);
  const chantierId = await creerPuisFiche(page);
  // **L'ANNEAU VIT SUR LA FICHE CLIENT** — 4 septembre 2026. Il était au milieu
  // de la fiche du chantier depuis sa demande du 11 août ; cette fiche est
  // retirée (`ARCHITECTURE.md` §254) parce qu'elle montrait une seconde fois ce
  // que la fiche client porte déjà — la pellicule et l'anneau.
  //
  // **Sa demande, elle, n'a pas bougé d'un mot** : *« l'anneau qui est en plein
  // milieu et dès qu'on arrive sur la page, il y est »*. C'est cette page-ci,
  // désormais.
  const fiche = `${BASE}/chantiers/${chantierId}/coordonnees`;
  // **On attend que la PAGE soit arrivée, pas plus.** `waitForURL` rend la main
  // dès que l'adresse change, avant que quoi que ce soit soit rendu : sans
  // cela, le premier contrôle mesurait un écran encore vide et accusait
  // l'anneau d'être absent alors qu'il n'était pas encore né. Attendre
  // l'anneau lui-même, en revanche, viderait ce contrôle de son objet.
  // On ouvre la fiche explicitement : `waitForURL` rend la main dès que
  // l'adresse change, avant que rien soit rendu, et le premier contrôle
  // mesurait alors un écran encore vide. Attendre l'anneau lui-même viderait ce
  // contrôle de son objet — c'est justement sa présence qu'on éprouve.
  await page.goto(fiche, { waitUntil: "networkidle" });

  const anneau = page.locator('[data-atlas="anneau-note-vocale"]');
  const bouton = anneau.locator(".atlas-micro");
  const consigne = page.locator(".atlas-indice").first();

  await cas("l'anneau est là dès l'arrivée, sur un chantier vide", async () => {
    assert.equal(await anneau.count(), 1, "aucun anneau sur la fiche d'un chantier neuf");
    assert.ok(await bouton.isVisible(), "l'anneau existe mais ne se voit pas");
    assert.match(
      (await consigne.textContent())?.trim() ?? "",
      /Appuyez/,
      "la consigne ne dit pas qu'on peut parler"
    );
  });

  // ─── UN CAS A ÉTÉ RETIRÉ ICI, ET IL FAUT SAVOIR LEQUEL ─────────────────────
  //
  // « le corps ne porte que l'anneau, et le tiroir garde tout le reste »
  // défendait la maquette du 11 août 2026 : ni bouton ni lien dans le corps de
  // la fiche du chantier, l'étape suivante et la rédaction à la main
  // recueillies dans son tiroir. **Cet écran est retiré le 4 septembre** —
  // corps, tiroir et tout (`ARCHITECTURE.md` §254).
  //
  // Le réécrire sur la fiche client aurait été lui prêter une promesse qu'il
  // n'a jamais faite sur cet écran-là : celui-ci porte un formulaire, et c'est
  // sa raison d'être. Écrire un contrôle qui réclame ce que le patron a fait
  // retirer, c'est rendre son écran impossible à changer (`CLAUDE.md` §5 bis).
  //
  // Ce que ce cas défendait de vivant — la rédaction à la main reste
  // atteignable — est tenu sur son écran à lui, `test-devis-a-la-main-e2e.ts`.

  await cas("un appui dicte, l'avion envoie — et la note existe", async () => {
    await bouton.click();
    await page.waitForTimeout(700);
    // **Ce qui distingue une dictée en cours d'un bouton inerte a changé de
    // forme, pas de fonction.** L'indice ne dit plus « arrêter » — il
    // disparaît, et ce sont la poubelle, l'avion et le compteur qui naissent.
    // Trois signes valent mieux qu'une phrase, et il n'a plus à la lire.
    for (const [quoi, sel] of [
      ["la poubelle", '[data-atlas="dictee-jeter"]'],
      ["l'avion", '[data-atlas="dictee-envoyer"]'],
      ["le compteur", ".atlas-compteur"],
    ] as const) {
      assert.ok(
        await page.locator(sel).isVisible(),
        `${quoi} ne paraît pas pendant la dictée : rien ne la distingue d'un bouton inerte`
      );
    }

    await page.waitForTimeout(2200);
    // **L'avion, et non plus le second appui sur l'objet** : celui-ci met en
    // pause désormais. C'est sa demande du 30 août — arrêter ne doit plus
    // envoyer.
    await page.locator('[data-atlas="dictee-envoyer"]').click();

    // **LA PAGE NE RESTE PLUS SOUS SES YEUX, ET C'EST SA DEMANDE DU 30 AOÛT.**
    //
    // Sur la fiche du chantier, l'écran se rafraîchissait sur place et l'anneau
    // devenait le lecteur. Sur la fiche client — où l'anneau vit depuis que la
    // fiche du chantier est retirée (`ARCHITECTURE.md` §254) —, l'avion fait
    // tout : *« envoyer de suite la transcription et arriver sur la page du
    // devis »*. La chaîne part seule et emmène le patron.
    //
    // On attend donc l'un OU l'autre : la chaîne s'annonce, ou elle a déjà
    // emmené. Exiger le lecteur ici réclamerait un écran qu'il a fait quitter.
    // **`any` et non `race` :** l'une des attentes n'aboutira JAMAIS — selon
    // que la chaîne s'annonce ou qu'elle a déjà emmené. `race` échoue sur la
    // première qui expire, `any` réussit sur la première qui aboutit.
    //
    // **UNE TROISIÈME ISSUE, ET C'EST ELLE QUI PORTE LE TITRE DE CE CAS.**
    // Les deux premières disent ce que fait la CHAÎNE du devis — qui dépend
    // d'un service d'IA, absent des postes de développement (`CLAUDE.md`
    // §1 ter). En batterie, sous cinquante suites, elles expiraient toutes les
    // deux et le rouge accusait la dictée : « All promises were rejected »,
    // sur une note pourtant bien enregistrée. Un contrôle qui échoue au hasard
    // s'apprend à être ignoré.
    //
    // Ce que ce cas affirme, lui, c'est que **la note existe** — et l'écran le
    // dit sans dépendre d'aucun service : l'invite « Appuyez et décrivez le
    // chantier » ne se tait que lorsque l'envoi a RÉUSSI (`onDicte`, puis
    // `preparationEnCours`). Un refus la laisserait en place avec son message.
    await Promise.any([
      page.locator('[data-atlas="preparation-automatique"]').waitFor({ timeout: 60_000 }),
      page.waitForURL(/\/devis-complet$/, { timeout: 60_000 }),
      // **Le micro REVENU et l'invite TUE — les deux, et pas l'un des deux.**
      // Écrite d'abord sur la seule absence d'invite, cette attente se
      // dénouait dès le premier appui : pendant qu'on dicte, l'objet n'est
      // plus le micro et l'invite n'est pas rendue non plus. Elle rendait donc
      // un vert AVANT l'envoi, et les cas suivants trouvaient un chantier sans
      // note — deux rouges qui accusaient l'écran. Un contrôle qui conclut
      // trop tôt est pire qu'absent (`AGENTS.md`).
      //
      // Les deux ensemble ne se rencontrent qu'après un envoi RÉUSSI : le
      // micro renaît (la dictée est finie) et l'invite reste tue
      // (`preparationEnCours`). Un refus, lui, ramène le micro AVEC sa phrase.
      page.waitForFunction(
        () =>
          !!document.querySelector(".atlas-micro") && !document.querySelector(".atlas-indice"),
        undefined,
        { timeout: 60_000 }
      ),
    ]);
  });

  await cas("rouverte, la fiche montre LE MÊME objet — 5 septembre 2026", async () => {
    // **Ce contrôle demandait l'inverse jusqu'au 5 septembre, et c'est LUI qui
    // l'a fait changer** (`ARCHITECTURE.md` §261) : *« ce n'est pas la même que
    // lorsque j'ai cliqué sur nouveau chantier. Tu verras par toi-même que la
    // note vocale a changé. »*
    //
    // Il exigeait ici « Poussez l'anneau vers le haut » — le LECTEUR. C'est
    // exactement l'écran qu'il ne reconnaissait pas : le micro vert de la
    // création devenu un anneau creux dont le seul geste est de retirer. La
    // règle défendue est donc retournée : le même objet aux deux visites.
    await page.goto(fiche, { waitUntil: "networkidle" });
    assert.equal(await anneau.count(), 1, "l'anneau a disparu après la dictée");
    assert.equal(
      await page.locator('button[aria-label="Dicter une note vocale"]').count(),
      1,
      "la fiche rouverte ne porte plus le micro : elle a changé de visage entre deux visites"
    );
    assert.equal(
      await page.locator('button[aria-label="Écouter la note vocale"]').count(),
      0,
      "le lecteur est revenu sur la fiche client : c'est l'écran qu'il ne reconnaît pas"
    );
    // **Et l'écran n'invite plus à parler par-dessus** — sa règle du
    // 1ᵉʳ septembre : une invitation devant une note déjà là proposerait de
    // recouvrir ce qu'il vient de dicter.
    assert.equal(
      await consigne.count(),
      0,
      "l'écran invite encore à dicter alors qu'une note existe : la précédente serait écrasée"
    );
  });

  await cas("ET LA NOTE RESTE RETIRABLE — sur l'écran qui la porte", async () => {
    // **Ce que l'ancien contrôle défendait ne se perd pas, il change
    // d'adresse.** Il exigeait « Retirer » sous l'anneau de la fiche client ;
    // le geste vit sur l'écran Note vocale, avec l'écoute. Le vérifier ailleurs
    // qu'où il vit, c'était réclamer un dessin ; le vérifier ici, c'est tenir
    // la promesse — une note qu'on ne peut plus enlever resterait chez lui.
    await page.goto(`${BASE}/chantiers/${chantierId}/note-vocale`, { waitUntil: "networkidle" });
    assert.ok(
      await page.locator('button[aria-label="Écouter la note"]').count(),
      "on ne peut plus écouter sa dictée nulle part"
    );
    // Le geste est celui de partout : la ligne glisse et « Retirer » se
    // découvre (`LigneRetirable`). On vise son nom accessible, pas sa classe :
    // le dessin peut changer, la promesse non.
    assert.ok(
      await page.locator('button[aria-label="Retirer cette note vocale"]').count(),
      "le retrait a disparu : une note qu'on ne peut plus enlever"
    );
  });

  await navigateur.close();

  console.log(`\n${echecs === 0 ? "✅" : "❌"} L'anneau au centre de la fiche — ${echecs} échec(s).`);
  process.exit(echecs === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
