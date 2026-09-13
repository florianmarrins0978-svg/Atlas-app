import { lancerNavigateur } from "./e2e-browser";
import assert from "node:assert";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { creerPuisFiche } from "./_creer-chantier-e2e";
import { ADRESSE } from "./_adresse";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MICRO_SIMULE = path.join(__dirname, "fixtures", "fake-mic.wav");
const BASE = ADRESSE;

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
//   3. l'objet redevient alors le lecteur, au même endroit ;
//   4. **la bulle de l'assistant ne recouvre rien.**
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
    // **`any` et non `race` :** l'une des deux attentes n'aboutira JAMAIS —
    // selon que la chaîne s'annonce ou qu'elle a déjà emmené. `race` échoue
    // sur la première qui expire, `any` réussit sur la première qui aboutit.
    await Promise.any([
      page.locator('[data-atlas="preparation-automatique"]').waitFor({ timeout: 60_000 }),
      page.waitForURL(/\/devis-complet$/, { timeout: 60_000 }),
    ]);
  });

  await cas("la note dictée se voit, et elle se JETTE depuis cet écran", async () => {
    /**
     * **CE CAS RÉCLAMAIT LE LECTEUR — retiré le 13 septembre 2026.**
     *
     * Il exigeait que l'anneau « redevienne le lecteur » et que la fosse
     * `.atlas-fosse` soit là. Or ce rendu n'était monté par AUCUN écran : le
     * contrôle défendait du code que le patron ne pouvait pas atteindre
     * (`CLAUDE.md` §5 bis — on adapte le contrôle, on ne remet pas ce qu'il a
     * fait enlever).
     *
     * Ce qui compte n'a jamais été la forme de l'anneau : c'est qu'une note
     * dictée se VOIE, et qu'il puisse la jeter sans quitter l'écran — sa
     * décision du 13 septembre, *« en cas de problème on peut supprimer la
     * dictée comme ça »*.
     */
    await page.goto(fiche, { waitUntil: "networkidle" });
    assert.equal(await anneau.count(), 1, "le micro a disparu après la dictée : il ne peut plus redicter");
    assert.equal(
      await page.getByText("Votre dictée").count(),
      1,
      "rien ne dit qu'une note est là : il ne sait ni ce qu'il a envoyé, ni quoi jeter"
    );
    assert.ok(
      await page.locator(".atlas-glisse").count(),
      "la note ne glisse pas : c'est une note qu'on ne peut plus enlever"
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
