/**
 * La perle du fil : où se tient-elle, vraiment, en pixels — et le dernier
 * chantier peut-il venir dessous ?
 *
 * **Pourquoi ce script existe.** Le 11 août 2026, le patron a envoyé une
 * capture de son téléphone : la perle était tout en bas de l'écran, à demeure.
 * Aucune suite n'était rouge, et pour cause — aucune ne regardait où le point
 * tombait. La perle était posée devant le premier chantier « en attente », donc
 * n'importe où selon la liste ; chez lui, sur le dernier.
 *
 * Un contrôle qui se contente d'affirmer « la perle est présente » ne prouve
 * rien : elle l'était. Celui-ci MESURE, et refuse sur trois points :
 *
 *   1. la perle tombe à mi-hauteur du cadre qui défile partout SAUF au bout —
 *      c'est ce qui fait d'elle un repère qu'on apprend ;
 *   2. un chantier se trouve toujours dessous, jamais du vide ;
 *   3. tout en bas, elle est en face du DERNIER jour : *« quand on arrive au
 *      dernier, là, elle descend et elle se met en face du dernier jour »*
 *      (le patron, 11 août 2026). C'est le seul endroit où elle bouge.
 *
 * Il écrit aussi trois captures : l'œil juge ce que la mesure ne dit pas.
 *
 * Suppose un serveur déjà en écoute. **Sur `localhost`, jamais `127.0.0.1`** :
 * Next refuse ses ressources de développement à une origine qu'il ne
 * reconnaît pas, la page n'est jamais hydratée, et on mesure une page morte.
 *
 *   npx tsx scripts/capture-accueil-perle.mts [dossier] [port]
 */
import { existsSync, readdirSync } from "node:fs";
import { chromium } from "playwright";

const dossier = process.argv[2] ?? "/tmp";
const port = process.argv[3] ?? "3000";
const base = `http://localhost:${port}`;

/** La hauteur d'une ligne de chantier, mesurée. Voir `.atlas-tige`. */
const LIGNE_ATTENDUE = 122;
/** Ce qu'on tolère entre le point et le milieu du cadre. */
const ECART_TOLERE = 3;

function navigateurPreInstalle(): string | undefined {
  if (process.env.CHROMIUM_PATH) return process.env.CHROMIUM_PATH;
  const racine = process.env.PLAYWRIGHT_BROWSERS_PATH;
  if (!racine || !existsSync(racine)) return undefined;
  const nom = readdirSync(racine).find((d) => /^chromium-\d+$/.test(d));
  if (!nom) return undefined;
  const chemin = `${racine}/${nom}/chrome-linux/chrome`;
  return existsSync(chemin) ? chemin : undefined;
}

/**
 * **Deux hauteurs d'écran, et la seconde n'est pas un luxe.**
 *
 * La première version de ce contrôle ne mesurait que 852 px, et elle était
 * verte pendant que la perle était en bas de l'écran du patron. La raison : à
 * cette hauteur, la liste de démonstration a 325 px de chemin devant elle —
 * bien plus qu'il n'en faut pour la plongée finale. Le défaut ne se réveille
 * que lorsque la liste défile À PEINE, c'est-à-dire sur un écran haut, ou chez
 * un artisan qui a trois chantiers au lieu de quinze.
 *
 * 1100 px n'est pas un téléphone : c'est le plus court chemin pour mettre la
 * liste de démonstration dans cet état-là. Ce qu'on éprouve, c'est le RAPPORT
 * entre le chemin à défiler et la descente à faire, et il se règle aussi bien
 * en changeant l'écran qu'en changeant le nombre de chantiers.
 */
const ECRANS = [
  { hauteur: 852, quoi: "iPhone 14/15, la taille de la maquette du patron" },
  { hauteur: 1100, quoi: "écran haut : la liste ne défile presque plus" },
];

const navigateur = await chromium.launch({ executablePath: navigateurPreInstalle() });
const griefs: string[] = [];
let page!: import("playwright").Page;
let ecranCourant = 0;

async function releve(nom: string) {
  const m = await page.evaluate(() => {
    const fil = document.querySelector(".atlas-fil-defile") as HTMLElement | null;
    const perle = document.querySelector(".atlas-perle span") as HTMLElement | null;
    if (!fil) return null;
    const rf = fil.getBoundingClientRect();
    const rp = perle ? perle.getBoundingClientRect() : null;
    const enveloppe = document.querySelector(".atlas-perle") as HTMLElement | null;
    const releve = {
      descente: enveloppe ? enveloppe.style.getPropertyValue("--atlas-perle-descente") : "",
      milieuDuCadre: Math.round(rf.top + rf.height / 2),
      defile: Math.round(fil.scrollTop),
      defileMax: Math.round(fil.scrollHeight - fil.clientHeight),
      perle: rp ? Math.round(rp.top + rp.height / 2) : null,
      lignes: [] as { nom: string; jour: string; haut: number; bas: number; hauteur: number }[],
    };
    for (const l of document.querySelectorAll(".atlas-ligne")) {
      const r = l.getBoundingClientRect();
      const titre = l.querySelector("h2");
      const jour = l.querySelector("b");
      releve.lignes.push({
        nom: (titre ? titre.textContent ?? "" : "").trim(),
        jour: (jour ? jour.textContent ?? "" : "").trim(),
        haut: Math.round(r.top),
        bas: Math.round(r.bottom),
        hauteur: Math.round(r.height),
      });
    }
    return releve;
  });

  if (!m) {
    griefs.push("le cadre qui défile (.atlas-fil-defile) est introuvable : ce n'est pas l'écran d'accueil");
    return null;
  }
  if (m.perle === null) {
    griefs.push(`[${ecranCourant} px · ${nom}] aucune perle sur l'écran — le repère du fil a disparu`);
    return m;
  }

  const dessous = m.lignes.find((l) => m.perle! >= l.haut && m.perle! <= l.bas);
  const ecart = m.perle - m.milieuDuCadre;
  console.log(
    `  ${nom.padEnd(7)} défilé ${String(m.defile).padStart(3)}/${m.defileMax} · ` +
      `perle y=${m.perle} (milieu ${m.milieuDuCadre}, écart ${ecart >= 0 ? "+" : ""}${ecart}, ` +
      `descente « ${m.descente || "—"} ») · ` +
      `dessous : ${dessous ? `${dessous.jour} ${dessous.nom}` : "RIEN"}`
  );

  // Au bout de la liste, la perle a le DROIT — le devoir — de quitter le milieu :
  // elle plonge sur le dernier jour. Partout ailleurs, elle n'y touche pas.
  if ((nom === "haut" || nom === "sommet") && Math.abs(ecart) > ECART_TOLERE) {
    griefs.push(
      `[${ecranCourant} px · ${nom}] la perle est à ${m.perle} px, le milieu du cadre à ` +
        `${m.milieuDuCadre} : ${ecart > 0 ? "elle est descendue" : "elle est remontée"} de ` +
        `${Math.abs(ecart)} px alors qu'on est TOUT EN HAUT de la liste. C'est le défaut que le ` +
        "patron a vu sur son téléphone le 11 août 2026 au soir."
    );
  }

  // Ailleurs, elle a le droit de descendre — jamais de remonter. On ne
  // redemande pas ici de combien exactement : ce serait réécrire la règle une
  // seconde fois, et deux écritures d'une même règle finissent toujours par
  // diverger (`CLAUDE.md` §3). Ce contrôle éprouve la PROMESSE ; le calcul est
  // éprouvé par `scripts/test-perle-descente.ts`, et son arrivée à destination
  // par le contrôle du bas, plus loin.
  if (ecart < -ECART_TOLERE) {
    griefs.push(
      `[${ecranCourant} px · ${nom}] la perle est REMONTÉE de ${Math.abs(ecart)} px au-dessus du ` +
        "milieu du cadre : elle ne doit jamais aller plus haut que lui."
    );
  }
  if (!dessous) {
    griefs.push(`[${ecranCourant} px · ${nom}] la perle ne tombe sur aucun chantier : elle désigne du vide`);
  }
  await page.screenshot({ path: `${dossier}/perle-${ecranCourant}-${nom}.png` });
  return { ...m, dessous };
}

console.log("=== La perle du fil, mesurée ===");

for (const ecran of ECRANS) {
  ecranCourant = ecran.hauteur;
  console.log(`\n── écran de ${ecran.hauteur} px — ${ecran.quoi} ──`);
  const contexte = await navigateur.newContext({
    viewport: { width: 393, height: ecran.hauteur },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
  });
  page = await contexte.newPage();
  await page.goto(`${base}/login`, { waitUntil: "networkidle" });
  await page.fill('input[name="email"]', "demo@atlas.local");
  await page.fill('input[name="password"]', "demo1234");
  await page.click('button[type="submit"]');
  await page.waitForURL(`${base}/`, { timeout: 60_000 });
  await page.goto(`${base}/`, { waitUntil: "networkidle" });
  // Les polices décident de la moitié des mesures qu'on vient de régler.
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(400);

  // « haut » est la position d'arrivée, celle que le navigateur choisit seul.
  const haut = await releve("haut");
  // « sommet » est le fil poussé de force tout en haut, hors de tout point
  // d'accroche : c'est là que la perle risque de tomber dans l'intervalle entre
  // le bandeau et le premier chantier — le seul endroit de la liste où elle peut
  // désigner du vide.
  await page.evaluate(() => {
    const fil = document.querySelector(".atlas-fil-defile") as HTMLElement;
    fil.scrollTop = 0;
  });
  await page.waitForTimeout(300);
  await releve("sommet");
  await page.evaluate(() => {
    const fil = document.querySelector(".atlas-fil-defile") as HTMLElement;
    fil.scrollTop = Math.round((fil.scrollHeight - fil.clientHeight) / 2);
  });
  await page.waitForTimeout(400);
  await releve("milieu");
  await page.evaluate(() => {
    const fil = document.querySelector(".atlas-fil-defile") as HTMLElement;
    fil.scrollTop = fil.scrollHeight;
  });
  await page.waitForTimeout(500);
  const bas = await releve("bas");

  // **Tout en bas, la perle doit être en face du DERNIER jour.** C'est la réponse
  // que le patron a donnée le 11 août : *« quand on arrive au dernier, là, elle
  // descend et elle se met en face du dernier jour. »* C'est le seul endroit de la
  // liste où elle a le droit de quitter le milieu, et le seul contrôle capable de
  // dire si la descente arrive à destination.
  if (bas && "dessous" in bas && bas.perle !== null && bas.lignes.length > 0) {
    const dernier = bas.lignes[bas.lignes.length - 1];
    // La cible est le MILIEU de la dernière ligne : ailleurs, le point d'accroche
    // centre la ligne dans le cadre et la perle y tombe au milieu. Se poser
    // ailleurs sur la dernière se lirait comme un décalage, pas une intention.
    const cible = dernier.haut + dernier.hauteur / 2;
    const ecart = Math.round(bas.perle - cible);
    if (!bas.dessous || bas.dessous.nom !== dernier.nom) {
      // **Deux pannes très différentes portent le même symptôme, et les
      // confondre coûte une heure.** Ou bien la descente est mal calculée — et
      // c'est `perle-descente.ts` qu'il faut lire ; ou bien elle est calculée
      // juste et le navigateur ne la dessine pas — et c'est le CSS. Le second cas
      // est arrivé le 11 août 2026 : `.atlas-perle` est un `span`, donc une boîte
      // EN LIGNE, et une transformation ne s'y applique pas. La valeur était
      // bonne, `getComputedStyle` la renvoyait, rien ne bougeait. La variable
      // relevée sur l'écran départage les deux, alors disons laquelle.
      const calculee = parseFloat(bas.descente || "0");
      griefs.push(
        `[${ecranCourant} px] ` +
        "tout en bas, la perle s'arrête sur « " +
          (bas.dessous ? bas.dessous.nom : "rien") +
          " » alors que le dernier chantier est « " +
          dernier.nom +
          " » : il lui manque " +
          -ecart +
          " px. " +
          (Math.abs(calculee - -ecart) < ECART_TOLERE + 2
            ? `La descente est pourtant CALCULÉE à ${bas.descente} — elle n'est donc pas DESSINÉE. ` +
              "Chercher du côté du CSS de `.atlas-perle` (une transformation ne s'applique pas à " +
              "une boîte en ligne), pas du côté de `src/lib/perle-descente.ts`."
            : `La descente calculée vaut ${bas.descente || "rien"} : c'est le calcul qui est en cause, ` +
              "dans `src/lib/perle-descente.ts`.")
      );
    } else if (Math.abs(ecart) > ECART_TOLERE) {
      griefs.push(
        `[${ecranCourant} px] tout en bas, la perle est bien sur « ${dernier.nom} » mais ${Math.abs(ecart)} px ` +
          `${ecart > 0 ? "sous" : "au-dessus de"} le milieu de la ligne : la descente vise à côté.`
      );
    }
  }

  // La hauteur d'une ligne ne sert à aucun calcul depuis que la descente se
  // mesure, mais elle reste le repère de tout le reste de l'écran : la voir
  // dériver, c'est apprendre qu'un texte s'est mis à se replier.
  if (haut && haut.lignes.length > 0) {
    const hauteurs = [...new Set(haut.lignes.map((l) => l.hauteur))];
    if (hauteurs.some((h) => Math.abs(h - LIGNE_ATTENDUE) > 2)) {
      griefs.push(
        `[${ecranCourant} px] une ligne de chantier ne fait plus ${LIGNE_ATTENDUE} px mais ${hauteurs.join(", ")} px : ` +
          "un texte s'est replié, ou une marge a bougé. Vérifier l'écran avant de rien recalibrer."
      );
    }
  }

  await contexte.close();
}

await navigateur.close();

if (griefs.length > 0) {
  console.log(`\n❌ La perle — ${griefs.length} grief(s) :`);
  for (const g of griefs) console.log(`   · ${g}`);
  process.exit(1);
}
console.log(`\n✅ La perle tient le milieu, du premier au dernier chantier, sur les ${ECRANS.length} hauteurs d écran. Captures : ${dossier}/perle-*.png`);
