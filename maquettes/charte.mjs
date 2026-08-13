/*
  LA CHARTE DE L'APPLICATION, OPPOSÉE À UNE PLANCHE.

  Sa consigne du 13 août 2026 : « toujours en respectant le style de l'appli », et
  « garde le style de toutes les pages, pas du devis et facture ».

  Ce module existe parce que la règle serait sinon recopiée dans chaque
  vérificateur — et `CLAUDE.md` §3 le dit : deux implémentations d'une même règle
  finissent toujours par diverger. Le jour où un jeton change, un seul fichier
  bouge et TOUTES les planches qui l'appellent le savent.

  CE QU'IL COMPARE, ET À QUOI :

    · les couleurs de l'écran, aux jetons de `src/lib/design-tokens.ts` — pas à
      une valeur recopiée ici, qui serait une deuxième source de vérité ;
    · l'absence d'ombre : `cardShadow` vaut « none » depuis le 10 août 2026, et
      l'écran retenu par le patron n'en porte pas une seule. Dans cette charte,
      le luxe est fait de ce qu'elle refuse — une ombre ajoutée « pour faire haut
      de gamme » irait contre son choix ;
    · les mesures des écrans refaits : retrait de 26 px, titre de 36 px, cheveu
      de fermeture, titres de section gris, barre basse à 9,5 px / 0,28 em.

  ATTENTION AU PIÈGE DE `spacing.pageX` : il vaut `px-6`, soit 24 px, et c'est
  l'ANCIENNE échelle. Tous les écrans refondus le 10 août emploient `px-[26px]` ;
  seuls `error.tsx`, `loading.tsx` et `Notifications.tsx`, jamais repris, sont
  restés à 24. Lire le jeton de bonne foi conduit donc à se tromper.
*/
import fs from "node:fs";

/** Les couleurs de l'écran, et le jeton dont chacune doit sortir. */
const CORRESPONDANCES = [
  ["fond", "cream"],
  ["plage", "card"],
  ["encre", "ink"],
  ["gris", "muted"],
  ["bronze", "or"],
  ["plein", "rust"],
  ["trait", "line"],
  // Facultative : toutes les planches n'ont pas de quoi alerter.
  ["alerte", "alert"],
];

/**
 * `rgba(28, 28, 26, 0.12)` et `rgba(28,28,26,.12)` sont la même couleur : la
 * comparaison porte sur la couleur, pas sur sa ponctuation.
 */
function meme(a, b) {
  if (!a || !b) return false;
  const net = (v) => v.toLowerCase().replace(/\s/g, "").replace(/0\./g, ".");
  return net(a) === net(b);
}

/**
 * Compare les couleurs déclarées dans le bloc `.ecran{}` d'une planche aux
 * jetons de l'application, et refuse toute ombre portée dans l'écran.
 *
 * @param source le HTML de la planche, tel qu'il est sur le disque
 * @param verifie la fonction de contrôle du vérificateur appelant
 */
export function controlerCharte(source, verifie) {
  const jetons = fs.readFileSync("src/lib/design-tokens.ts", "utf8");
  const lire = (nom) => (jetons.match(new RegExp(`\\b${nom}:\\s*"([^"]+)"`)) || [])[1];

  const bloc = (source.match(/\.ecran\{[\s\S]*?\}/) || [""])[0];
  const dansEcran = (nom) => (bloc.match(new RegExp(`--e-${nom}:\\s*([^;}]+)`)) || [])[1];

  const ecarts = CORRESPONDANCES
    // Une couleur que la planche n'emploie pas n'a pas à être déclarée.
    .filter(([e]) => dansEcran(e) !== undefined)
    .filter(([e, j]) => !meme(dansEcran(e), lire(j)))
    .map(([e, j]) => `--e-${e} vaut ${dansEcran(e)}, ${j} vaut ${lire(j)}`);
  verifie("les couleurs de l'écran sortent des jetons de l'application",
    ecarts.length === 0, ecarts.join(" · "));

  // Six couleurs au moins : une planche qui n'en déclarerait que deux passerait
  // le contrôle ci-dessus sans rien prouver.
  const declarees = CORRESPONDANCES.filter(([e]) => dansEcran(e) !== undefined).length;
  verifie("l'écran déclare bien la charte, et pas deux couleurs au hasard",
    declarees >= 6, `${declarees} couleurs`);

  const styles = source.split("</style>")[0];
  const ombres = (styles.match(/box-shadow:\s*(?!none|inset)[^;}]+/g) || [])
    // La coque du téléphone n'est pas l'écran : elle a le droit à son ombre.
    .filter((o) => !/^box-shadow:\s*0 1px 3px rgba\(20,18,14/.test(o));
  verifie("aucune ombre portée dans l'écran — la charte n'en a pas une seule",
    ombres.length === 0, ombres.join(" | "));
}

/**
 * Les mesures des écrans refaits, vérifiées dans le navigateur sur un écran
 * donné. Relevées dans `EnTeteEcran.tsx` et `AtlasBottomNav.tsx`, jamais à
 * l'œil.
 */
export async function controlerGrammaire(page, selecteur, verifie) {
  const ecran = await page.$eval(selecteur, (e) => {
    const r = e.getBoundingClientRect();
    const h = e.querySelector(".tete h1"), c = e.querySelector(".cheveu");
    const g = getComputedStyle(h);
    return {
      largeur: r.width,
      retrait: h.getBoundingClientRect().x - r.x,
      corps: parseFloat(g.fontSize),
      cheveu: c ? c.getBoundingClientRect().width : null,
    };
  });

  // L'écran de la planche doit mesurer 390 px comme un iPhone. Sous les 390, la
  // barre basse de l'application ne tient pas — et c'est ce qui avait fait
  // rapetisser sa chasse, planche après planche, jusqu'à valider une barre plus
  // petite que la vraie (`ARCHITECTURE.md` §80).
  verifie("l'écran fait la largeur d'un iPhone, pas celle qui reste après la coque",
    ecran.largeur >= 390, `${ecran.largeur.toFixed(0)} px`);
  verifie("le titre est en retrait de 26 px, comme tous les écrans refaits",
    Math.abs(ecran.retrait - 26) < 1.5, `${ecran.retrait.toFixed(1)} px`);
  verifie("et fait 36 px, la mesure d'`EnTeteEcran`",
    Math.abs(ecran.corps - 36) < 0.6, `${ecran.corps} px`);
  verifie("un cheveu ferme l'en-tête, en retrait de 26 px des deux bords",
    ecran.cheveu !== null && Math.abs(ecran.cheveu - (ecran.largeur - 52)) < 2,
    `${ecran.cheveu?.toFixed(0)} px pour ${(ecran.largeur - 52).toFixed(0)} attendus`);

  const titreSection = await page.$eval(`${selecteur} .bloc .t`, (e) => getComputedStyle(e).color);
  verifie("les titres de section sont gris, pas dorés",
    titreSection === "rgb(138, 133, 120)", titreSection);

  // Deux filets qui se suivent à moins de 48 px dessinent une bande vide. Le
  // défaut a été vu à l'œil sur la première planche, jamais par un contrôle.
  const bandes = await page.$eval(`${selecteur} .corps`, (c) => {
    const traits = [];
    for (const e of c.querySelectorAll("*")) {
      const g = getComputedStyle(e), r = e.getBoundingClientRect();
      if (r.width < 40) continue;
      if (parseFloat(g.borderTopWidth) > 0) traits.push(Math.round(r.y));
      if (parseFloat(g.borderBottomWidth) > 0) traits.push(Math.round(r.y + r.height));
    }
    traits.sort((a, b) => a - b);
    return traits.filter((v, i) => i && v - traits[i - 1] > 12 && v - traits[i - 1] < 48).length;
  });
  verifie("aucune bande vide entre deux filets qui se suivent", bandes === 0, `${bandes}`);

  const b = await page.$$eval(`${selecteur} .bas span`, (l) =>
    l.map((e) => {
      const r = document.createRange(); r.selectNodeContents(e);
      const q = r.getBoundingClientRect();
      return { g: q.x, d: q.x + q.width, t: e.textContent.trim() };
    }));
  let pire = { ecart: 1e9, ou: "" };
  for (let i = 1; i < b.length; i++) {
    const w = b[i].g - b[i - 1].d;
    if (w < pire.ecart) pire = { ecart: w, ou: `${b[i - 1].t}|${b[i].t}` };
  }
  verifie("les libellés du bandeau ne se touchent pas", pire.ecart >= 6,
    `${pire.ecart.toFixed(1)} px — ${pire.ou}`);

  const chasse = await page.$eval(`${selecteur} .bas span`, (e) => {
    const g = getComputedStyle(e);
    return { corps: parseFloat(g.fontSize), chasse: g.letterSpacing };
  });
  verifie("et ils portent la chasse de l'application, pas une chasse rétrécie",
    Math.abs(chasse.corps - 9.5) < 0.3 && parseFloat(chasse.chasse) > 2.5,
    `${chasse.corps} px / ${chasse.chasse}`);
}

/**
 * TOUT S'ARRÊTE À 26 PX DES BORDS, sur tous les écrans de la planche.
 *
 * Un encart d'alerte posé hors d'un bloc touchait les deux côtés de l'écran
 * pendant que le reste s'arrêtait au retrait — vu sur une capture le 13 août
 * 2026, jamais par un contrôle. Il balaie les enfants directs du corps : c'est
 * là que se glissent les éléments qui oublient leur marge.
 */
export async function controlerRetrait(page, verifie) {
  const hors = await page.$$eval(".ecran .corps", (corps) =>
    corps.flatMap((c) => {
      const r = c.getBoundingClientRect();
      return [...c.children]
        .filter((e) => e.checkVisibility({ opacityProperty: true, visibilityProperty: true }))
        .map((e) => ({ e, b: e.getBoundingClientRect() }))
        .filter(({ b }) => b.width > 40 &&
          (b.x - r.x < 25.5 || (r.x + r.width) - (b.x + b.width) < 25.5))
        .map(({ e, b }) => `${e.className || e.tagName} à ${(b.x - r.x).toFixed(0)} px`);
    }));
  verifie("rien ne dépasse le retrait de 26 px, encarts compris",
    hors.length === 0, hors.join(" | "));
}
