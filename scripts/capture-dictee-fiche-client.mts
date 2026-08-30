// LA FICHE CLIENT ET SA DICTÉE, PHOTOGRAPHIÉES SUR L'ÉCRAN RÉEL.
//
// **Pourquoi ce script, et pourquoi il fait partie du travail.** Ses trois
// exigences du 30 août 2026 ne se voient QUE sur une image ou une mesure de la
// page vivante — aucune suite fonctionnelle ne les attrape :
//
//   *« Je veux que tout tienne sur une seule page, qu'on n'ait pas à scroller
//   pour voir les infos en bas de la page ; et utilise tout l'espace, il ne
//   doit pas rester du vide en bas ; et l'écran ne doit plus pouvoir se
//   balader de droite à gauche. »*
//
// Il mesure donc, sur `390 × 664` — l'écran du patron, barre d'adresse
// déduite (`e2e-browser.ts`) : la hauteur du contenu, le débordement
// horizontal, et le vide sous le dernier élément.
//
// **Le micro est un faux micro.** Chromium sait produire un flux audio
// synthétique (`--use-fake-device-for-media-stream`) : la dictée se déclenche
// donc pour de bon, et l'on photographie l'écran EN TRAIN d'enregistrer — celui
// où le bouton doit avoir disparu.
//
// Usage : npx tsx scripts/capture-dictee-fiche-client.mts <dossier>
import { mkdirSync } from "node:fs";
import { chromium, devices } from "playwright";
import { existsSync } from "node:fs";

const dossier = process.argv[2];
if (!dossier) {
  console.error("usage: capture-dictee-fiche-client.mts <dossier>");
  process.exit(1);
}
mkdirSync(dossier, { recursive: true });

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
// **La hauteur se règle**, et ce n'est pas un confort : c'est ce qui permet de
// voir ce contrôle ROUGIR. Un contrôle jamais vu rouge ne prouve rien
// (`AGENTS.md`) — `HAUTEUR=560` rend un écran trop court, et la feuille doit
// alors annoncer ce qui passe sous le pli.
const HAUTEUR = Number(process.env.HAUTEUR ?? 664);
const CHROME = process.env.CHROME_ATLAS ?? "/opt/pw-browsers/chromium";

const navigateur = await chromium.launch({
  // **`headless` explicite.** Sans lui, le navigateur s'ouvrait dans une vraie
  // fenêtre de 717 × 421 et le viewport demandé n'était jamais appliqué : on
  // mesurait un écran que personne ne possède.
  headless: true,
  ...(existsSync(CHROME) ? { executablePath: CHROME } : {}),
  args: ["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream"],
});
// **Le viewport se pose APRÈS le descripteur, et pas seulement par lui.**
// Mesuré : le contexte rendait 717 × 421 — la fenêtre par défaut — alors que le
// descripteur annonce 390 × 664. Une mesure prise sur un écran que personne ne
// possède ne prouve rien (`e2e-browser.ts` le dit déjà pour les suites).
const contexte = await navigateur.newContext({
  ...devices["iPhone 13"],
  viewport: { width: 390, height: HAUTEUR },
  permissions: ["microphone"],
});
const page = await contexte.newPage();

// La porte est `/login`, et l'on attend l'ACCUEIL RÉEL — pas la simple absence
// d'erreur : un formulaire qui ne ferait rien passerait sinon pour un succès.
// Même séquence que `scripts/verifier-connexion.mjs`, qui l'a éprouvée.
await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
await page.locator('input[name="email"]').fill("demo@atlas.local");
await page.locator('input[name="password"]').fill("demo1234");
await page.locator('button[type="submit"]').click();
await page.getByRole("heading", { name: "Vos chantiers" }).waitFor({ timeout: 60_000 });

// **On entre PAR SON PARCOURS, pas par l'adresse directe.** Depuis l'accueil,
// « Nouveau chantier » ouvre la fiche en FEUILLE : elle recouvre la barre du bas
// et la bulle de l'assistant, et son talon vaut 40 px au lieu de 160. Mesurer
// `/chantiers/nouveau` en page, c'est mesurer un écran qu'il ne voit jamais —
// et se donner 200 px de contrainte qui n'existent pas.
await page.locator('[data-atlas="nouveau-chantier"]').click();
await page.getByRole("heading", { name: "Fiche client" }).waitFor({ timeout: 45_000 });
await page.waitForTimeout(600);

/**
 * Ce que le doigt éprouve — **dans la FEUILLE, pas dans la page**.
 *
 * La fiche client s'ouvre par-dessus l'accueil : celui-ci reste monté derrière
 * elle, avec sa liste qui défile et ses vignettes qui débordent. Mesurer le
 * document entier, c'était accuser la fiche de défauts qui ne sont pas les
 * siens — et, symétriquement, laisser passer les siens : la hauteur du document
 * ne bouge pas d'un pixel quand la feuille déborde, puisque c'est ELLE qui
 * défile en elle-même.
 *
 * On mesure donc le cadre qui défile réellement : celui qui porte le
 * formulaire.
 */
async function mesurer(quand: string, videAttendu = 0) {
  const m = await page.evaluate(() => {
    const feuille = document.querySelector('[role="dialog"][aria-label="Créer un devis"]');
    // Le cadre qui défile, à l'intérieur de la feuille. Sans feuille — l'écran
    // ouvert en page — c'est le document lui-même.
    const cadre = (feuille?.querySelector("form")?.closest("div.min-h-0") ??
      document.documentElement) as HTMLElement;
    // **La racine est le CADRE, jamais la feuille.** Mesuré le 30 août 2026 :
    // en prenant la feuille, on comptait parmi « ce qui est dessiné » le cadre
    // lui-même, qui l'occupe entièrement — le bas du contenu tombait donc
    // toujours pile sur le bas de l'écran, et « vide en bas : aucun » se
    // rendait en vert quoi qu'il arrive. Un contrôle qui ne peut pas rougir ne
    // prouve rien (`AGENTS.md`).
    const racine = cadre;

    const hautCadre = cadre.getBoundingClientRect().top;
    // Le plus bas de tout ce qui est DESSINÉ dans la feuille : c'est lui qui dit
    // où l'écran finit vraiment, pas la hauteur d'un conteneur qui s'étire.
    let bas = 0;
    racine.querySelectorAll("*").forEach((el) => {
      const r = (el as HTMLElement).getBoundingClientRect();
      if (r.height > 0 && r.width > 0) bas = Math.max(bas, r.bottom - hautCadre + cadre.scrollTop);
    });

    // **Ce qui DÉBORDE LATÉRALEMENT, nommément.** On compare au bord du cadre,
    // et l'on nomme les coupables : `scrollWidth` contre `innerWidth` ne dit
    // rien, le viewport de mise en page s'élargissant lui-même pour contenir ce
    // qui dépasse.
    const bordGauche = cadre.getBoundingClientRect().left;
    const bordDroit = bordGauche + cadre.clientWidth;
    const dehors: string[] = [];
    racine.querySelectorAll("*").forEach((el) => {
      const r = (el as HTMLElement).getBoundingClientRect();
      if (r.width === 0 || r.height === 0) return;
      if (r.right > bordDroit + 1 || r.left < bordGauche - 1) {
        const c = (el as HTMLElement).className;
        const q = el.tagName.toLowerCase() + (typeof c === "string" && c ? "." + c.split(" ").slice(0, 2).join(".") : "");
        dehors.push(`${q} (${Math.round(r.left - bordGauche)}→${Math.round(r.right - bordGauche)})`);
      }
    });

    return {
      // **Le défilement latéral s'éprouve, il ne se déduit pas.** On pousse la
      // page de 60 px vers la droite et l'on regarde si elle a bougé : c'est
      // exactement ce que fait son pouce.
      glisseALaDroite: (() => {
        const avant = window.scrollX;
        window.scrollTo(60, window.scrollY);
        const apres = window.scrollX;
        window.scrollTo(avant, window.scrollY);
        return apres > avant;
      })(),
      enFeuille: feuille !== null,
      hauteurVisible: cadre.clientHeight,
      hauteurContenu: cadre.scrollHeight,
      largeurCadre: cadre.clientWidth,
      dehors: dehors.slice(0, 6),
      basDuContenu: Math.round(bas),
    };
  });

  // **Une mesure impossible n'est pas un succès** (`CLAUDE.md` §5) : un cadre de
  // zéro pixel rendrait « rien ne déborde » sur un écran qu'on n'a pas vu.
  if (m.hauteurVisible < 200 || m.largeurCadre < 200) {
    console.log(`  ${quand} : ✗ le cadre mesure ${m.largeurCadre}×${m.hauteurVisible} — rien de mesurable`);
    return { versLeBas: -1, vide: -1, dehors: m.dehors };
  }

  const versLeBas = m.hauteurContenu - m.hauteurVisible;
  const vide = m.hauteurVisible - m.basDuContenu;
  console.log(
    `  ${quand} : ${m.enFeuille ? "la feuille" : "la page"} montre ${m.hauteurVisible} px` +
      ` et en contient ${m.hauteurContenu}` +
      ` · à faire défiler ${versLeBas > 0 ? versLeBas + " px ✗" : "rien ✓"}` +
      ` · vide en bas ${vide > videAttendu + 4 ? vide + " px ✗" : `${vide} px ✓`}`
  );
  console.log(
    `     ${m.glisseALaDroite ? "✗ la page GLISSE de droite à gauche" : "✓ la page ne glisse pas latéralement"}`
  );
  if (m.dehors.length) {
    console.log(`     ✗ déborde du cadre (${m.largeurCadre} px) : ${m.dehors.join(" · ")}`);
  } else {
    console.log("     ✓ rien ne dépasse à droite ni à gauche");
  }
  return { versLeBas, vide, dehors: m.dehors };
}

console.log(`=== La fiche client, sur 390 × ${HAUTEUR} ===`);

// Le détail bloc par bloc : sans lui, on resserre au hasard et l'on découvre
// après coup qu'on a rogné 4 px là où il y en avait 100 à prendre ailleurs.
const detail = await page.evaluate(() => {
  const lignes: string[] = [];
  const entete = document.querySelector("form")?.previousElementSibling as HTMLElement | null;
  if (entete) lignes.push(`en-tête ${Math.round(entete.getBoundingClientRect().height)}`);
  document.querySelectorAll("form > *").forEach((el, i) => {
    const e = el as HTMLElement;
    const h = Math.round(e.getBoundingClientRect().height);
    const q = typeof e.className === "string" ? e.className.split(" ").slice(0, 2).join(".") : e.tagName;
    lignes.push(`${i} ${q || e.tagName} ${h}`);
  });
  const form = document.querySelector("form") as HTMLElement | null;
  if (form) {
    const st = getComputedStyle(form);
    lignes.push(`form: gap ${st.rowGap}, haut ${st.paddingTop}, bas ${st.paddingBottom}, total ${Math.round(form.getBoundingClientRect().height)}`);
  }
  return lignes;
});
console.log("  ── détail ──\n     " + detail.join("\n     "));
await mesurer("au repos ");
await page.screenshot({ path: `${dossier}/fiche-repos.png` });

// La dictée : le micro est le premier bouton de la zone.
const micro = page.locator('[data-atlas="anneau-note-vocale"] .atlas-micro');
if (await micro.count()) {
  await micro.click();
  await page.waitForTimeout(1500);
  // **Le vide attendu pendant la dictée, c'est l'empreinte du bouton parti.**
  // Il a demandé que « Je rédige à la main » DISPARAISSE dès qu'on appuie : les
  // cinquante-deux pixels qu'il occupait se libèrent forcément, et rien ne doit
  // venir les prendre — faire grandir la dictée pour les combler ferait
  // descendre le micro de vingt pixels sous le doigt qui vient de l'appuyer.
  await mesurer("en dictée", 52);
  await page.screenshot({ path: `${dossier}/fiche-dictee.png` });
  console.log(
    `  le bouton « Je rédige à la main » est ${
      (await page.locator('[data-atlas="action-ecrire"]').count()) === 0 ? "PARTI ✓" : "ENCORE LÀ ✗"
    }`
  );
  await page.locator('[data-atlas="dictee-jeter"]').click();
  await page.waitForTimeout(500);
  console.log(
    `  après la poubelle, il est ${
      (await page.locator('[data-atlas="action-ecrire"]').count()) === 1 ? "REVENU ✓" : "ABSENT ✗"
    }`
  );
  await page.screenshot({ path: `${dossier}/fiche-apres-poubelle.png` });
} else {
  console.log("  ✗ le micro de la dictée est introuvable");
}

await navigateur.close();
