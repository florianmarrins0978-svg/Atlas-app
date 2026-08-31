// Les sept chartes de couleurs — et surtout : que RIEN ne bouge par défaut.
//
// **LE CONTRÔLE QUI PORTE TOUT LE LOT.** Les couleurs de l'application passent
// désormais par des variables CSS, pour que les sept chartes du patron puissent
// les changer. La promesse faite avec ce changement est qu'il n'a **aucun effet
// visible tant que personne n'a choisi** : la charte `origine` doit reprendre,
// au caractère près, ce que `design-tokens.ts` portait en clair — et le repli
// de chaque jeton doit être cette même valeur.
//
// Sans ces contrôles, une seule valeur recopiée de travers repeindrait
// l'application entière, et personne ne le verrait avant une capture.

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  CHARTES,
  CHARTE_PAR_DEFAUT,
  charte,
  normaliserCharte,
  variablesCharte,
  variablesCss,
} from "../src/lib/chartes";
import { colors } from "../src/lib/design-tokens";

let echecs = 0;
function essai(nom: string, fn: () => void) {
  try {
    fn();
    console.log(`  ✓ ${nom}`);
  } catch (e) {
    echecs++;
    console.log(`  ✗ ${nom}`);
    console.log(`    ${(e as Error).message}`);
  }
}

console.log("=== Les huit chartes, et l'application qui ne bouge pas ===\n");

// ─── « NE CHANGE PAS L'APPLI » — sa consigne du 24 août 2026 ─────────────────
//
// Il a choisi « Brume moderne » (planche 92) et l'a demandée EN OPTION : *« mais
// ne change pas l'appli »*. Les deux moitiés commandent ensemble, et c'est la
// seconde qui est fragile — une charte qui pose un jeton de forme sans que les
// autres le posent aussi ferait basculer la typographie de tout le monde.

essai("aucune charte SAUF Brume ne touche à la forme", () => {
  for (const c of CHARTES) {
    if (c.nom === "brume") continue;
    assert.equal(
      c.formes,
      undefined,
      `« ${c.libelle} » porte une forme : la typographie de ceux qui ne l'ont pas choisie bougerait`
    );
  }
});

essai("une charte sans forme n'écrit AUCUNE variable de police", () => {
  // Poser `--atlas-police-titres:initial` écraserait le repli de `globals.css`,
  // donc changerait la police de tout le monde pour ajouter une option à un
  // seul. Le contrôle vise l'absence, pas une valeur.
  const css = variablesCss(charte("origine"));
  assert.ok(
    !css.includes("police-titres"),
    `« origine » écrit une police : ${css.split(";").filter((d) => d.includes("police")).join(", ")}`
  );
});

essai("Brume, elle, pose bien sa police — et c'est une SANS-SERIF", () => {
  const css = variablesCss(charte("brume"));
  assert.ok(css.includes("--atlas-police-titres"), "Brume n'écrit aucune police : la moitié « moderne » manque");
  assert.match(
    css,
    /--atlas-police-titres:[^;]*sans-serif/,
    "la pile de Brume ne finit pas sur une sans-serif : un appareil qui ne connaît pas les premières rendrait un Times"
  );
});

essai("le repli de --font-display EST la serif d'aujourd'hui", () => {
  // Si la variable de charte n'a pas de repli, ou un repli différent, alors
  // l'application change pour tout le monde — exactement ce qu'il a interdit.
  const css = readFileSync(new URL("../src/app/globals.css", import.meta.url), "utf8");
  const bloc = css.slice(css.indexOf("--font-display:"), css.indexOf("--font-body:"));
  assert.ok(bloc.includes("--atlas-police-titres"), "--font-display ne suit pas la charte");
  assert.ok(
    bloc.includes("ui-serif") && bloc.includes("Georgia"),
    "le repli n'est plus la serif d'aujourd'hui : la typographie de tout le monde a changé"
  );
});

essai("le marqueur d'onglet ne bouge QUE pour Brume", () => {
  // **Sa demande du 24 août 2026 :** *« modifie aussi la sélection des
  // catégories, juste pour Brume moderne »*. Le « juste » est la moitié qui
  // compte : sept chartes doivent garder le trait doré.
  for (const c of CHARTES) {
    const v = variablesCharte(c);
    const marqueur = Object.keys(v).filter((k) => k.startsWith("--atlas-onglet"));
    if (c.nom === "brume") {
      assert.ok(marqueur.length > 0, "Brume ne pose pas la pastille : sa barre du bas garde le trait");
      // **DORÉE, ET NON À L'ACCENT — sa consigne du 27 août 2026 :** *« tout ce
      // qui est en doré sur Origine le reste aussi sur Brume »*.
      //
      // Ce cas exigeait l'accent, et l'accent de Brume est un bleu marine :
      // c'était le SEUL endroit de l'accueil où l'or se perdait en changeant
      // d'apparence. Une suite qui réclame ce qu'il a fait retirer rend son
      // écran impossible à changer (`CLAUDE.md` §5 bis) — elle réclame donc
      // maintenant ce qu'il a demandé.
      assert.ok(
        v["--atlas-onglet-fond"]?.includes(charte("brume").jetons.or),
        `la pastille est teintée de « ${v["--atlas-onglet-fond"]} » : l'or s'est perdu`
      );
      // **Et rien ne teinte le LIBELLÉ.** Sur Origine il est à l'encre de
      // l'écran ; sa consigne dit que l'or reste l'or, pas qu'une autre couleur
      // s'invite. La variable qui le passait à l'accent a donc disparu.
      assert.equal(
        v["--atlas-onglet-encre"],
        undefined,
        "le libellé de l'onglet est teinté : sur Origine il porte l'encre de l'écran, et rien d'autre"
      );
    } else {
      assert.deepEqual(
        marqueur,
        [],
        `« ${c.libelle} » pose ${marqueur.join(", ")} : sa barre du bas changerait alors qu'il ne l'a pas demandé`
      );
    }
  }
});

essai("la barre du bas garde le trait doré en REPLI", () => {
  // Si le composant cessait de replier sur la valeur d'aujourd'hui, les sept
  // autres chartes perdraient leur trait — et rien ne le dirait avant une
  // capture.
  const nav = readFileSync(new URL("../src/components/atlas/AtlasBottomNav.tsx", import.meta.url), "utf8");
  for (const [variable, repli] of [
    ["--atlas-onglet-fond", "colors.or"],
    ["--atlas-onglet-hauteur", "1px"],
    ["--atlas-onglet-haut", "auto"],
    ["--atlas-onglet-rayon", "0"],
  ]) {
    assert.ok(
      new RegExp(`var\\(${variable},\\s*\\$?\\{?${repli.replace(".", "\\.")}`).test(nav),
      `${variable} n'a pas « ${repli} » pour repli : les autres chartes perdraient leur trait`
    );
  }
  // Et la pastille doit passer DERRIÈRE le libellé, sinon elle le recouvre.
  assert.ok(/relative z-\[1\]/.test(nav), "les libellés ne passent pas au-dessus du marqueur");
});

essai("le GABARIT et la chaîne CSS disent la même chose", () => {
  // **Le défaut du 24 août 2026, et aucun contrôle ne le voyait.** `layout.tsx`
  // reparcourait `c.jetons` de son côté au lieu d'appeler la source commune :
  // la police de Brume était émise par `variablesCss` et pas par le gabarit.
  // Le réglage s'écrivait, les couleurs changeaient, la typographie non — et
  // rien ne le disait. Ce contrôle compare les DEUX formes, charte par charte.
  const layout = readFileSync(new URL("../src/app/layout.tsx", import.meta.url), "utf8");
  assert.ok(
    layout.includes("variablesCharte"),
    "le gabarit n'emploie pas la source commune : il reconstruit les variables à sa façon"
  );
  // **La présence de l'import ne prouvait rien** — la première version de ce
  // contrôle s'en contentait, et elle restait verte avec le gabarit remis à sa
  // recopie. Ce qu'il faut interdire, c'est le PARCOURS des jetons : c'est lui
  // qui fabrique la seconde implémentation.
  assert.ok(
    !/Object\.(entries|keys)\(\s*c\.jetons\s*\)/.test(layout),
    "le gabarit reparcourt `c.jetons` : c'est une seconde implémentation, et elle divergera"
  );

  for (const c of CHARTES) {
    const parPaires = Object.entries(variablesCharte(c))
      .map(([cle, v]) => `${cle}:${v}`)
      .sort();
    const parChaine = variablesCss(c).split(";").sort();
    assert.deepEqual(
      parChaine,
      parPaires,
      `« ${c.libelle} » : le gabarit et la chaîne CSS ne posent pas les mêmes variables`
    );
  }
});

essai("Brume est proposée juste après Origine", () => {
  // Une liste où son choix se trouve en sixième position se parcourt pour rien.
  assert.equal(CHARTES[0].nom, "origine", "Origine n'ouvre plus la liste");
  assert.equal(CHARTES[1].nom, "brume", "Brume n'est pas à côté d'Origine");
});

essai("le défaut reste Origine", () => {
  assert.equal(CHARTE_PAR_DEFAUT, "origine", "le défaut a changé : l'application bouge sans qu'il l'ait demandé");
});

essai("« brume » se reconnaît comme un nom de charte", () => {
  assert.equal(normaliserCharte("brume"), "brume");
});


/** Ce que `design-tokens.ts` portait en clair avant ce lot. Recopié ici. */
const AVANT_LE_LOT: Record<string, string> = {
  cream: "#f5f3ee",
  card: "#faf9f5",
  ink: "#1c1c1a",
  inkSoft: "#4a4a44",
  muted: "#8a8578",
  rust: "#2f3b2f",
  rustDeep: "#4f5f4c",
  rustTint: "#ece9e1",
  or: "#B98B47",
  orClair: "#C9A15E",
  line: "rgba(28,28,26,0.12)",
  lineSoft: "rgba(28,28,26,0.07)",
  chevron: "rgba(28,28,26,0.28)",
};

essai("les huit chartes sont là, dans l'ordre qu'il a donné", () => {
  // **« Brume moderne » s'est AJOUTÉE le 24 août 2026**, sur son choix devant
  // la planche 92 — elle n'a remplacé personne, et elle se pose en deuxième
  // parce que c'est celle qu'il a prise.
  assert.deepEqual(
    CHARTES.map((c) => c.nom),
    ["origine", "brume", "pierre", "beurre", "moka", "prune", "sylve", "nuit"]
  );
});

essai("« origine » est le défaut, et c'est la première", () => {
  assert.equal(CHARTE_PAR_DEFAUT, "origine");
  assert.equal(CHARTES[0].nom, "origine");
});

// **LE CONTRÔLE CENTRAL.** Une valeur qui s'écarterait repeindrait
// l'application sans que personne ne l'ait demandé.
essai("« origine » reprend EXACTEMENT les couleurs d'avant ce lot", () => {
  const o = charte("origine").jetons as unknown as Record<string, string>;
  for (const [cle, attendue] of Object.entries(AVANT_LE_LOT)) {
    assert.equal(o[cle], attendue, `${cle} : « ${o[cle]} » au lieu de « ${attendue} »`);
  }
});

// Et le REPLI de chaque jeton doit être cette même valeur : un écran rendu hors
// du gabarit — qui ne pose donc aucune variable — doit rester identique.
essai("et le repli de chaque jeton est cette même valeur", () => {
  const source = readFileSync("src/lib/design-tokens.ts", "utf8");
  for (const [cle, attendue] of Object.entries(AVANT_LE_LOT)) {
    const trouve = source.match(new RegExp(`\\b${cle}:\\s*"([^"]+)"`));
    assert.ok(trouve, `le jeton ${cle} a disparu de design-tokens.ts`);
    const repli = trouve[1].match(/^var\(\s*--atlas-[\w-]+\s*,\s*(.+)\)$/);
    assert.ok(repli, `${cle} ne passe pas par une variable : « ${trouve[1]} »`);
    assert.equal(repli[1].trim(), attendue, `repli de ${cle}`);
  }
});

essai("chaque jeton employé par l'application EST une variable", () => {
  for (const cle of Object.keys(AVANT_LE_LOT)) {
    const valeur = (colors as unknown as Record<string, string>)[cle];
    assert.match(valeur, /^var\(--atlas-/, `${cle} vaut « ${valeur} »`);
  }
});

console.log("");

// **Le compte n'est plus écrit ici, et c'est délibéré.** Il valait « treize »,
// et le lot du 22 août 2026 en a ajouté trois — alerte, bordeaux, vert pâle,
// qui devaient suivre la charte pour rester lisibles sur Nuit et Sylve
// (`ARCHITECTURE.md` §160). La suite a rougi sur du code juste, pour un chiffre
// qui ne défendait rien : ce qu'elle doit fixer, c'est qu'**aucune charte ne
// porte moins de jetons qu'une autre** — un jeton oublié sur une seule des sept
// laisse un écran à demi repeint, et c'est ce défaut-là qui coûte cher.
const JETONS_ATTENDUS = Object.keys(charte("origine").jetons).sort();

essai("les huit chartes portent les mêmes jetons, aucun vide", () => {
  for (const c of CHARTES) {
    const cles = Object.keys(c.jetons);
    assert.deepEqual(
      [...cles].sort(),
      JETONS_ATTENDUS,
      `${c.nom} ne porte pas les mêmes jetons qu'origine`
    );
    for (const cle of cles) {
      const v = (c.jetons as unknown as Record<string, string>)[cle];
      assert.match(v, /^(#[0-9a-fA-F]{6}|rgba\()/, `${c.nom}.${cle} vaut « ${v} »`);
    }
  }
});

// ─── L'OR NE CHANGE PAS D'UNE APPARENCE À L'AUTRE ───────────────────────────
//
// **Sa consigne du 31 août 2026 :** *« pour l'apparence, j'aimerais que tout ce
// qui est en doré sur la version originale apparaisse en doré sur les autres
// apparences »* — la généralisation de celle du 27 août, qui ne portait que sur
// Brume.
//
// **Ce que ce contrôle attrape, et qu'aucun autre ne voyait.** `depuisPlanche`
// recopiait le second accent de chaque charte dans `or` : la sauge de Pierre,
// l'argile de Moka, le prune de Prune. Tous les jetons étaient présents, tous
// lisibles — les deux suites existantes passaient au vert pendant que changer
// d'apparence repeignait l'accueil, les libellés d'état, les filets et le
// sceau. Un contrôle sur la LISIBILITÉ ne dit rien de l'IDENTITÉ.
essai("l'or est le même sur les huit chartes — sa consigne du 31 août 2026", () => {
  const or = charte("origine").jetons;
  for (const c of CHARTES) {
    assert.equal(c.jetons.or, or.or, `${c.libelle} : l'or vaut « ${c.jetons.or} » au lieu de « ${or.or} »`);
    assert.equal(
      c.jetons.orClair,
      or.orClair,
      `${c.libelle} : l'or clair vaut « ${c.jetons.orClair} » au lieu de « ${or.orClair} »`
    );
  }
});

// Une phrase qui décrit la charte d'avant se croit encore : « Aucun or » a été
// retiré de Pierre le 31 août, en même temps que l'or y revenait.
essai("aucune charte n'annonce qu'elle est sans or", () => {
  for (const c of CHARTES) {
    assert.ok(!/aucun or/i.test(c.dit), `${c.libelle} annonce « ${c.dit} » alors qu'elle porte l'or d'Origine`);
  }
});

essai("deux chartes sont sombres, et ce sont les siennes", () => {
  assert.deepEqual(CHARTES.filter((c) => c.sombre).map((c) => c.nom), ["sylve", "nuit"]);
});

// Une charte dont le fond et l'encre seraient proches serait illisible. Le
// contrôle ne juge pas du goût : il refuse ce qu'on ne peut pas lire.
essai("sur chaque charte, l'encre se détache du fond", () => {
  const clarte = (hex: string) => {
    const n = hex.replace("#", "");
    const [r, v, b] = [0, 2, 4].map((i) => parseInt(n.slice(i, i + 2), 16) / 255);
    const c = (x: number) => (x <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4);
    return 0.2126 * c(r) + 0.7152 * c(v) + 0.0722 * c(b);
  };
  for (const c of CHARTES) {
    const [a, b] = [clarte(c.jetons.cream), clarte(c.jetons.ink)];
    const contraste = (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
    assert.ok(contraste >= 7, `${c.nom} : contraste de ${contraste.toFixed(1)}, il en faut 7`);
  }
});

// **Une charte sombre doit avoir un fond sombre**, sans quoi le drapeau ment et
// l'écran des réglages annoncerait « Sombre » sur un écran clair.
essai("le drapeau « sombre » dit la vérité sur le fond", () => {
  const sombreVraiment = (hex: string) => {
    const n = hex.replace("#", "");
    return [0, 2, 4].map((i) => parseInt(n.slice(i, i + 2), 16)).reduce((a, b) => a + b, 0) / 3 < 96;
  };
  for (const c of CHARTES) {
    assert.equal(sombreVraiment(c.jetons.cream), c.sombre, `${c.nom} : fond ${c.jetons.cream}`);
  }
});

console.log("");

essai("un nom inconnu retombe sur l'origine, sans lever", () => {
  assert.equal(charte("n-importe-quoi").nom, "origine");
  assert.equal(charte(null).nom, "origine");
  assert.equal(charte(undefined).nom, "origine");
});

essai("et il ne s'écrit pas en base : il devient nul", () => {
  assert.equal(normaliserCharte("n-importe-quoi"), null);
  assert.equal(normaliserCharte(""), null);
  assert.equal(normaliserCharte("nuit"), "nuit");
});

essai("les variables CSS portent le nom du jeton, pas celui de la planche", () => {
  const css = variablesCss(charte("nuit"));
  assert.match(css, /--atlas-cream:#101210/);
  assert.match(css, /--atlas-rust:/);
  assert.ok(!css.includes("--atlas-fond"), "le vocabulaire de la planche a fui dans les variables");
});

console.log("");
if (echecs) {
  console.log(`${echecs} ÉCHEC(S).`);
  process.exit(1);
}
console.log("Les chartes — 0 échec(s).");
