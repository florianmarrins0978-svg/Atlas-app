/**
 * Les sept chartes de couleurs, et celle qui s'applique.
 *
 * *Choisies par le patron le 14 août 2026, planche en main
 * (`docs/maquettes/11-ecran-retenu-seize-couleurs.html`, seize propositions) :*
 * ***« garde seulement pour l'instant nuit, beurre, moka, pierre, sylve »***
 * *et la rose-violet — Prune —, puis :* ***« oui garde Origine en défaut, fais
 * les sept »***.
 *
 * ─── CE QUI EST GARANTI, ET QUI COMMANDE TOUT LE RESTE ──────────────────────
 *
 * **`origine` reprend les valeurs actuelles au caractère près.** Elles ne sont
 * pas recalculées, pas dérivées, pas arrondies : ce sont exactement celles que
 * `design-tokens.ts` portait en clair avant ce lot, relevées jadis au navigateur
 * sur le site d'Arborea (`ARCHITECTURE.md` §17). Tant que le patron n'a rien
 * choisi, **l'application ne change pas d'un pixel** — et c'est ce que la
 * batterie vérifie, puisque des dizaines de contrôles comparent des couleurs
 * calculées à `rgb(47, 59, 47)` et consorts.
 *
 * Les six autres viennent de la planche, valeur pour valeur. Ce qu'elle ne
 * donnait pas — les traits, le chevron, le fond teinté — est **dérivé de leur
 * encre par les mêmes proportions qu'`origine`**, jamais choisi à l'œil : une
 * couleur inventée à la main sur six chartes, c'est six occasions de se
 * tromper, et personne ne les regarderait toutes.
 *
 * ─── LE MODE SOMBRE EST DEDANS, ET CE N'EST PAS UN SECOND RÉGLAGE ───────────
 *
 * Le patron voulait « le mode sombre » ET les couleurs de la planche. Ce sont
 * la même chose : **Nuit** et **Sylve** SONT sombres. Deux interrupteurs — un
 * pour le sombre, un pour la couleur — se seraient contredits dès qu'on aurait
 * choisi « Nuit » avec le sombre éteint.
 */

/** Ce qui change d'une charte à l'autre. Le reste de `design-tokens.ts` ne bouge pas. */
export type JetonsCharte = {
  cream: string;
  card: string;
  ink: string;
  inkSoft: string;
  muted: string;
  rust: string;
  rustDeep: string;
  rustTint: string;
  or: string;
  orClair: string;
  line: string;
  lineSoft: string;
  chevron: string;
  /**
   * ─── LES TROIS COULEURS DE SIGNAL, RENDUES LISIBLES SUR LES DEUX SOMBRES ───
   *
   * **Elles étaient écrites en clair dans `design-tokens.ts`, et c'était une
   * faute** que sa capture du 22 août 2026 a rendue visible : *« le mode nuit
   * est illisible »*. Un rouge sombre sur un fond noir ne se lit pas, et un
   * bordeaux non plus — or c'est précisément ce que le dépôt affirmait ne pas
   * avoir besoin de suivre la charte.
   *
   * **Sur les cinq chartes claires, elles ne bougent pas d'un caractère** : la
   * dérivation ci-dessous ne remonte la clarté que si le contraste manque, et
   * il ne manque jamais sur un fond clair. C'est vérifié par
   * `scripts/test-chartes-lisibles.ts`.
   */
  alerte: string;
  bordeaux: string;
  vertPale: string;
};

export type NomCharte =
  | "origine"
  | "brume"
  | "pierre"
  | "beurre"
  | "moka"
  | "prune"
  | "sylve"
  | "nuit";

export type Charte = {
  nom: NomCharte;
  /** Ce qu'il lit dans la liste. */
  libelle: string;
  /** Une phrase, la sienne quand elle existe — celle de la planche. */
  dit: string;
  /** Sombre : l'écran est plus foncé que l'encre ne l'est claire. */
  sombre: boolean;
  jetons: JetonsCharte;
  /**
   * Ce que la charte change au-delà de la couleur. Absent = la forme
   * d'aujourd'hui, au pixel près — c'est ce qui garantit qu'ajouter une charte
   * ne touche à rien.
   */
  formes?: FormesCharte;
};

/** `origine` est le défaut. Sa valeur ne se devine pas : elle est écrite ici. */
export const CHARTE_PAR_DEFAUT: NomCharte = "origine";

/** `rgba(r,g,b,a)` à partir d'un `#rrggbb` — la forme exacte qu'employait `origine`. */
function voile(hex: string, alpha: string): string {
  const n = hex.replace("#", "");
  const r = parseInt(n.slice(0, 2), 16);
  const v = parseInt(n.slice(2, 4), 16);
  const b = parseInt(n.slice(4, 6), 16);
  return `rgba(${r},${v},${b},${alpha})`;
}

/** La clarté perçue d'une couleur, au sens de la norme (WCAG). */
export function lumiere(hex: string): number {
  const n = hex.replace("#", "");
  const canal = (i: number) => {
    const x = parseInt(n.slice(i, i + 2), 16) / 255;
    return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * canal(0) + 0.7152 * canal(2) + 0.0722 * canal(4);
}

/** L'écart de lisibilité entre deux couleurs : 1 = confondues, 21 = noir sur blanc. */
export function contraste(a: string, b: string): number {
  const la = lumiere(a);
  const lb = lumiere(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

/** Une charte est sombre quand son fond est plus foncé que son encre. */
export function estSombre(jetons: Pick<JetonsCharte, "cream" | "ink">): boolean {
  return lumiere(jetons.cream) < lumiere(jetons.ink);
}

// ─── Teinte, saturation, clarté — pour remonter une couleur SANS la changer ──
//
// **Pourquoi passer par là plutôt que de mêler vers l'encre.** Éclaircir le
// rouge d'alerte en le mêlant à l'encre d'une charte sombre le tire vers le
// gris-vert : on obtient un brun terne qui ne dit plus « attention », et qui
// se confond avec le bordeaux du dépassement — les deux couleurs qui devaient
// justement rester distinctes (`design-tokens.ts`). En ne touchant qu'à la
// clarté, la teinte du patron survit : sa terre cuite reste une terre cuite,
// son bordeaux reste un bordeaux.
function versTSL(hex: string): [number, number, number] {
  const n = hex.replace("#", "");
  const [r, v, b] = [0, 2, 4].map((i) => parseInt(n.slice(i, i + 2), 16) / 255);
  const haut = Math.max(r, v, b);
  const bas = Math.min(r, v, b);
  const l = (haut + bas) / 2;
  if (haut === bas) return [0, 0, l];
  const d = haut - bas;
  const s = l > 0.5 ? d / (2 - haut - bas) : d / (haut + bas);
  const t = haut === r ? (v - b) / d + (v < b ? 6 : 0) : haut === v ? (b - r) / d + 2 : (r - v) / d + 4;
  return [t / 6, s, l];
}

function depuisTSL(t: number, s: number, l: number): string {
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const canal = (x: number) => {
    if (x < 0) x += 1;
    if (x > 1) x -= 1;
    if (x < 1 / 6) return p + (q - p) * 6 * x;
    if (x < 1 / 2) return q;
    if (x < 2 / 3) return p + (q - p) * (2 / 3 - x) * 6;
    return p;
  };
  const v = s === 0 ? [l, l, l] : [canal(t + 1 / 3), canal(t), canal(t - 1 / 3)];
  return `#${v.map((x) => Math.round(x * 255).toString(16).padStart(2, "0")).join("")}`;
}

/**
 * Décale la CLARTÉ d'une couleur — et rien d'autre — jusqu'à ce qu'elle se
 * détache de tout ce contre quoi elle sera posée.
 *
 * **Elle ne bouge que si elle en a besoin** : sur les cinq chartes claires, le
 * premier essai passe déjà le seuil et la valeur du patron sort intacte. C'est
 * ce qui fait que ce lot ne repeint pas un pixel de ce qu'il regarde tous les
 * jours.
 *
 * **Et elle ne descend jamais en dessous de ce qu'on lui demande** : faute de
 * trouver, elle rend la couleur d'origine plutôt qu'une valeur extrême — un
 * signal délavé qui aurait « passé le seuil » ne dit plus rien.
 */
function detacher(base: string, contre: string[], seuil: number, sens: 1 | -1): string {
  const [t, s, l0] = versTSL(base);
  for (let i = 0; i <= 200; i++) {
    const l = l0 + sens * i * 0.005;
    if (l < 0.02 || l > 0.98) break;
    const essai = depuisTSL(t, s, l);
    if (Math.min(...contre.map((c) => contraste(essai, c))) >= seuil) return essai;
  }
  return base;
}

/** Mélange deux couleurs — sert à dériver ce que la planche ne donnait pas. */
function meler(a: string, b: string, part: number): string {
  const lire = (h: string) => {
    const n = h.replace("#", "");
    return [0, 2, 4].map((i) => parseInt(n.slice(i, i + 2), 16));
  };
  const [ar, av, ab] = lire(a);
  const [br, bv, bb] = lire(b);
  const c = (x: number, y: number) => Math.round(x + (y - x) * part).toString(16).padStart(2, "0");
  return `#${c(ar, br)}${c(av, bv)}${c(ab, bb)}`;
}

/**
 * Construit une charte à partir de ce que la planche donnait.
 *
 * **Les trois voiles reprennent les proportions d'`origine`** — 12 %, 7 %,
 * 28 % de l'encre — au lieu de recopier les `rgba` de la planche : ce sont les
 * mêmes rôles (séparateur, bordure de tuile, chevron), et une proportion
 * commune fait que les six chartes se ressemblent là où elles doivent.
 */
function depuisPlanche(p: {
  fond: string;
  plage: string;
  encre: string;
  gris: string;
  plein: string;
}): JetonsCharte {
  const sombre = lumiere(p.fond) < lumiere(p.encre);
  // Sur une charte sombre on REMONTE la clarté, sur une claire on la descend :
  // dans les deux cas on s'éloigne du fond, jamais on ne s'en rapproche.
  const sens: 1 | -1 = sombre ? 1 : -1;
  return {
    cream: p.fond,
    card: p.plage,
    ink: p.encre,
    // Le texte de second plan : à mi-chemin entre l'encre et le gris, comme
    // `origine` (#4a4a44 entre #1c1c1a et #8a8578).
    inkSoft: meler(p.encre, p.gris, 0.4),
    muted: p.gris,
    rust: p.plein,
    // Le second niveau de l'accent : éclairci vers le fond, comme `origine`.
    rustDeep: meler(p.plein, p.fond, 0.28),
    // Le fond teinté des encarts. Il doit rester DU CÔTÉ DU FOND : sur une
    // charte sombre, la valeur claire d'`origine` (#ece9e1) poserait un pavé
    // blanc au milieu de l'écran.
    rustTint: meler(p.fond, p.encre, 0.07),
    // ─── L'OR NE SUIT PAS LA CHARTE, ET C'EST TOUT L'OBJET DE CE LOT ──────
    //
    // Il vaut la valeur d'Origine sur les huit chartes, au caractère près.
    // Voir `OR_ORIGINE` plus bas pour le pourquoi — c'est sa consigne, et elle
    // ne se dérive pas.
    or: OR_ORIGINE,
    orClair: OR_CLAIR_ORIGINE,
    line: voile(p.encre, "0.12"),
    lineSoft: voile(p.encre, "0.07"),
    chevron: voile(p.encre, "0.28"),
    // Du texte : 4,5 contre les deux fonds sur lesquels il se pose.
    alerte: detacher(ALERTE_ORIGINE, [p.fond, p.plage], 4.5, sens),
    // Des aplats de six pixels, pas du texte : 3 suffit — mais il leur faut
    // AUSSI se détacher de l'accent plein, qui est l'état « complet » juste à
    // côté dans le calendrier. Sans cela, sur une charte sombre, « incomplet »
    // et « complet » deviennent deux blancs, et le mois cesse de se lire d'un
    // coup d'œil — sa seule raison d'être.
    bordeaux: detacher(BORDEAUX_ORIGINE, [p.fond, p.plage, p.plein], 3, sens),
    // Elle descend là où les autres montent : sur un écran sombre, plus la
    // demi-journée est pleine, plus la barre est claire. C'est l'inverse exact
    // d'un écran clair, et c'est la même règle.
    vertPale: detacher(VERT_PALE_ORIGINE, [p.fond, p.plage, p.plein], 3, sombre ? -1 : 1),
  };
}

// ─── Les trois valeurs du patron, celles dont tout le reste part ────────────
//
// Elles vivaient dans `design-tokens.ts`, écrites en clair, avec la mention
// qu'elles « ne changent pas d'une charte à l'autre ». Elles changent : leur
// TEINTE est la sienne et ne bouge pas, leur CLARTÉ s'accorde au fond, sans
// quoi elles disparaissent sur Nuit et sur Sylve.
const ALERTE_ORIGINE = "#9C3B2E";

/**
 * ─── L'OR EST LE MÊME PARTOUT — sa consigne du 31 août 2026 ─────────────────
 *
 * ***« Pour l'apparence, j'aimerais que tout ce qui est en doré sur la version
 * originale apparaisse en doré sur les autres apparences. »***
 *
 * **Ce n'est pas une demande neuve : c'est la GÉNÉRALISATION de celle du
 * 27 août**, qui ne portait que sur une charte — *« lorsque je choisis
 * l'apparence Brume, tout ce qui est en doré sur Origine le reste aussi sur
 * Brume »*. On avait alors corrigé le seul endroit qui perdait l'or sur Brume
 * (le marqueur d'onglet) sans voir que la règle valait pour les six autres.
 *
 * **Ce qui changeait avant, et qu'il ne voulait pas.** La planche donnait à
 * chaque charte son propre second accent, et `or` le recopiait : la sauge de
 * Pierre (`#6f8466`), l'argile de Moka (`#7c5c46`), le prune de Prune
 * (`#7a2f52`), et pour `orClair` des valeurs qui n'avaient plus rien de doré —
 * un bleu sur Brume (`#6f95c4`), un rose sur Prune (`#d9a2bd`), un vert sur
 * Sylve (`#3d6b4a`). Changer d'apparence ne changeait donc pas que le fond :
 * **cela repeignait tout ce que l'or porte** — l'accueil, les libellés d'état,
 * les filets, le sceau, le compteur de la dictée. C'est précisément ce qu'il
 * refuse.
 *
 * **Pourquoi l'or peut rester FIXE là où l'alerte, le bordeaux et le vert pâle
 * doivent bouger** (`detacher`, plus haut) : mesuré sur les huit chartes, il se
 * détache du fond partout, et **mieux sur les deux sombres que sur les cinq
 * claires** — 6,14 sur Nuit et 5,25 sur Sylve, contre 2,77 sur Origine, qui est
 * l'écran qu'il regarde tous les jours. Un or remonté « par précaution » sur le
 * sombre aurait donc corrigé ce qui n'était pas cassé, et cessé d'être le même
 * or. `test-chartes-lisibles.ts` le mesure, charte par charte.
 *
 * **Ce que cela coûte, et il faut le dire :** les valeurs de la planche pour ce
 * second accent sont abandonnées — elles étaient les siennes, choisies au
 * pouce le 14 août. Sa consigne du 31 les remplace ; les deux ne peuvent pas
 * tenir ensemble.
 */
const OR_ORIGINE = "#B98B47";
/** Le même or, remonté — posé sur un aplat plein ou sur une photo. */
const OR_CLAIR_ORIGINE = "#C9A15E";
const BORDEAUX_ORIGINE = "#6E2433";
const VERT_PALE_ORIGINE = "#b9c6b4";

/**
 * ─── CE QU'UNE CHARTE PEUT CHANGER EN PLUS DE LA COULEUR ────────────────────
 *
 * **Sa demande du 24 août 2026, planche 92 en main :** *« ajoute-moi le Brume
 * moderne comme style, mais ne change pas l'appli »*. Les deux moitiés
 * commandent ensemble : la charte porte donc aussi la FORME, et rien ne bouge
 * tant qu'il ne l'a pas choisie.
 *
 * **Pourquoi un champ à part, et pas un jeton de plus.** `JetonsCharte` est
 * parcouru par les dérivations — `estSombre`, `contraste`, la remontée des
 * couleurs de signal — qui supposent toutes que chaque valeur est une couleur.
 * Y glisser une pile de polices ferait calculer une luminance sur
 * « ui-sans-serif », et le résultat ne serait pas une erreur : ce serait un
 * nombre faux, en silence.
 *
 * **Ce que la forme NE porte pas encore, et il faut le dire** (`AGENTS.md`) :
 * les rayons, les ombres et l'air de la planche « Moderne ». Ils sont écrits en
 * dur dans soixante-six fichiers (`rounded-[13px]`, `inset 0 0 0 1px`), et une
 * charte ne peut rien sur ce qui ne passe pas par elle. Les convertir est un
 * lot à part — annoncé, pas fait ici.
 */
export type FormesCharte = {
  /**
   * La pile de polices des TITRES — `--font-display`.
   *
   * C'est la moitié visible de « Moderne » : le Georgia serif contre la police
   * du téléphone. Elle passe déjà par une variable CSS (`globals.css`), donc
   * elle suit la charte sans qu'aucun écran soit touché.
   */
  policeTitres?: string;
  /**
   * Le marqueur de l'onglet courant, dans la barre du bas.
   *
   * **Sa demande du 24 août 2026, devant la planche 92 :** *« modifie aussi la
   * sélection des catégories, juste pour Brume moderne »*. Sur la planche,
   * l'onglet courant y est une pastille arrondie tenue par l'accent ; dans
   * l'application, c'est un trait doré qui glisse.
   *
   * **`undefined` garde le trait**, et c'est ce qui tient sa consigne : les
   * sept autres chartes ne bougent pas d'un pixel.
   *
   * **Le mouvement, lui, ne change pas.** Le marqueur glisse d'un onglet à
   * l'autre sur la même courbe — celle que le patron a retenue en la voyant
   * (« ce G »). Seule son apparence suit la charte ; remplacer le glissement
   * aurait défait un choix qu'il a déjà fait.
   */
  ongletCourant?: "pastille";
};

export const CHARTES: Charte[] = [
  {
    nom: "origine",
    libelle: "Origine",
    dit: "Vos couleurs actuelles : gris-vert, or, et le vert pin pour l'action.",
    sombre: false,
    // **RECOPIÉES, PAS DÉRIVÉES.** Une seule valeur qui s'écarterait ferait
    // bouger l'application sans que personne ne l'ait demandé.
    jetons: {
      cream: "#f5f3ee",
      card: "#faf9f5",
      ink: "#1c1c1a",
      inkSoft: "#4a4a44",
      muted: "#8a8578",
      rust: "#2f3b2f",
      rustDeep: "#4f5f4c",
      rustTint: "#ece9e1",
      or: OR_ORIGINE,
      orClair: OR_CLAIR_ORIGINE,
      line: "rgba(28,28,26,0.12)",
      lineSoft: "rgba(28,28,26,0.07)",
      chevron: "rgba(28,28,26,0.28)",
      alerte: ALERTE_ORIGINE,
      bordeaux: BORDEAUX_ORIGINE,
      vertPale: VERT_PALE_ORIGINE,
    },
  },
  {
    /**
     * ─── BRUME MODERNE — SON CHOIX DU 24 AOÛT 2026, PLANCHE 92 ──────────────
     *
     * *« Ajoute-moi le Brume moderne comme style, mais ne change pas
     * l'appli. »* Elle s'ajoute donc aux sept, sans en remplacer aucune, et
     * `origine` reste le défaut : tant qu'il ne la choisit pas, rien ne bouge.
     *
     * **Les couleurs sont celles de la planche, au caractère près** — pas
     * redérivées. Une seule valeur qui s'écarterait ferait servir autre chose
     * que ce qu'il a validé au pouce.
     *
     * **Pourquoi le fond n'est pas `#ffffff`.** Le blanc pur, sur une dalle de
     * téléphone en plein soleil, éblouit et fait disparaître les séparations
     * fines — or cet écran se lit dehors, sur un chantier. `#f4f7fb` est un
     * blanc froid : il porte le reflet bleuté qu'il demandait sans le prix du
     * blanc pur.
     *
     * **Pourquoi le bleu d'action est marine et non vif.** Un bleu clair a la
     * valeur d'un lien, et l'on appuie dessus par erreur. Surtout, il
     * concurrencerait l'or — qui, ici, veut dire « à faire ». Deux couleurs qui
     * réclament l'attention en même temps n'en obtiennent aucune. C'est la
     * réserve écrite sur la planche à côté d'« Azur », et c'est pour cela
     * qu'Azur n'est pas celle-ci.
     */
    nom: "brume",
    libelle: "Brume moderne",
    dit: "Un blanc froid à reflets bleutés, un bleu marine pour l'action, et les titres dans la police du téléphone.",
    sombre: false,
    jetons: depuisPlanche({
      fond: "#f4f7fb", plage: "#ffffff", encre: "#111823", gris: "#78838f",
      plein: "#22456d",
    }),
    /**
     * **La moitié « moderne », et c'est tout ce que la charte peut en porter.**
     * Les titres quittent le Georgia pour la police du système — celle que son
     * téléphone dessine le mieux, et celle des applications d'aujourd'hui.
     *
     * `ui-sans-serif` d'abord : sur iOS c'est San Francisco, dessiné pour être
     * lu à bout de bras. Les suivantes ne servent qu'aux appareils qui ne la
     * connaissent pas — une pile sans repli rendrait un Times par défaut, soit
     * exactement le contraire de ce qui est demandé.
     *
     * Ce qui MANQUE encore par rapport à la planche — les rayons de 20 px,
     * l'ombre bleutée, l'air en plus — est écrit au-dessus de `FormesCharte` :
     * soixante-six fichiers écrivent ces valeurs en dur, et une charte ne peut
     * rien sur ce qui ne passe pas par elle.
     */
    formes: {
      policeTitres:
        'ui-sans-serif, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", sans-serif',
      ongletCourant: "pastille",
    },
  },
  {
    nom: "pierre",
    libelle: "Pierre",
    // « Aucun or » a été retiré le 31 août 2026 : sa consigne y remet l'or, et
    // une phrase qui décrit la charte d'avant se croit encore.
    dit: "Gris légèrement vert, encre presque noire, sauge désaturée.",
    sombre: false,
    jetons: depuisPlanche({
      fond: "#e8e8e3", plage: "#f4f4f0", encre: "#1b1d19", gris: "#83867c",
      plein: "#1b1d19",
    }),
  },
  {
    nom: "beurre",
    libelle: "Beurre",
    dit: "Le jaune beurre, très pâle, donne une chaleur qu'aucun crème n'atteint.",
    sombre: false,
    jetons: depuisPlanche({
      fond: "#efe7cf", plage: "#f8f3e4", encre: "#26221a", gris: "#8b8368",
      plein: "#26221a",
    }),
  },
  {
    nom: "moka",
    libelle: "Moka",
    // L'argile était le second accent, remplacé par l'or le 31 août 2026.
    dit: "Un moka laiteux, une encre espresso.",
    sombre: false,
    jetons: depuisPlanche({
      fond: "#e6ded5", plage: "#f2ece5", encre: "#2b241e", gris: "#8d8175",
      plein: "#2b241e",
    }),
  },
  {
    nom: "prune",
    libelle: "Prune",
    dit: "Aubergine, rose poudré, cuivre. La plus habillée — celle qui ressemble le moins à un outil.",
    sombre: false,
    jetons: depuisPlanche({
      fond: "#efe6ea", plage: "#f9f2f5", encre: "#23131c", gris: "#8c7481",
      plein: "#3d1730",
    }),
  },
  {
    nom: "sylve",
    libelle: "Sylve",
    dit: "Le vert profond passe du bouton au FOND. Un écran de paysagiste.",
    sombre: true,
    jetons: depuisPlanche({
      fond: "#16241c", plage: "#1e3026", encre: "#e6e6da", gris: "#8ba189",
      plein: "#e6e6da",
    }),
  },
  {
    nom: "nuit",
    libelle: "Nuit",
    dit: "Noir chaud, laiton doux. La plus spectaculaire — et la moins lisible au soleil.",
    sombre: true,
    jetons: depuisPlanche({
      fond: "#101210", plage: "#1a1d19", encre: "#e9e8de", gris: "#84887b",
      plein: "#e9e8de",
    }),
  },
];

/** La charte demandée, ou celle d'origine — jamais une exception. */
export function charte(nom: string | null | undefined): Charte {
  return CHARTES.find((c) => c.nom === nom) ?? CHARTES[0];
}

/** Ce qu'on écrit en base : un nom connu, ou rien. */
export function normaliserCharte(nom: string | null | undefined): NomCharte | null {
  if (!nom) return null;
  const trouvee = CHARTES.find((c) => c.nom === nom);
  return trouvee ? trouvee.nom : null;
}

/**
 * Les variables CSS d'une charte, prêtes à être posées sur la page.
 *
 * **Le nom des variables suit celui des jetons**, pas celui de la planche : ce
 * sont `design-tokens.ts` et lui seul qui les consomment, et un second
 * vocabulaire entre les deux se serait traduit de travers un jour ou l'autre.
 */
/**
 * Les variables d'une charte, sous forme de paires — LA source unique.
 *
 * **Elle est née d'un défaut, le 24 août 2026.** `variablesCss` existait déjà,
 * mais le gabarit ne s'en servait pas : il reparcourait `c.jetons` de son côté
 * (`variablesEnStyle` dans `layout.tsx`). Deux implémentations de la même
 * règle — ce que le §3 de `CLAUDE.md` interdit —, et elles ont divergé au
 * premier changement : la police de « Brume moderne » était bien émise par
 * `variablesCss`, et l'application ne la voyait pas. Le réglage s'écrivait, les
 * couleurs changeaient, la typographie non, et rien ne le disait.
 *
 * Les deux formes dérivent désormais d'ici : ajouter une variable la donne aux
 * deux, ou à aucune.
 */
export function variablesCharte(c: Charte): Record<string, string> {
  const sortie: Record<string, string> = {};
  for (const cle of Object.keys(c.jetons) as (keyof JetonsCharte)[]) {
    sortie[`--atlas-${cle}`] = c.jetons[cle];
  }
  // **LE VERT DU BOUTON PLEIN — ORIGINE ET ELLE SEULE.**
  //
  // *Sa décision du 31 août 2026.* Il a d'abord retenu le vert 8 (Cyprès) sur
  // `appli/le-bouton-qui-repond.html`, puis demandé à voir **#29382F** sur le
  // vrai bouton, les deux côte à côte — et il a tranché : **« je garde le
  // #29382F »**. C'est un vert 11 % plus sombre que celui d'aujourd'hui et à
  // peine plus froid : 6 points de rouge et 3 de vert en moins, rien sur le
  // bleu. Le vert 8, plus tranché, a donc été écarté par lui.
  //
  // Et la question des sept chartes lui étant posée : **« les boutons à changer
  // c'est seulement pour la version origine, ne touche pas aux autres
  // apparences ! »**
  //
  // **POURQUOI UN APLAT S'ÉCRIT COMME UN DÉGRADÉ D'UNE SEULE COULEUR.** Les
  // boutons portent leur fond en style EN LIGNE (`backgroundColor: colors.rust`)
  // — qu'aucune feuille de style ne peut supplanter. Le seul calque qui passe
  // par-dessus sans `!important` est `background-image`, et une image de fond
  // ne prend pas une couleur : d'où `linear-gradient(#29382F, #29382F)`, qui
  // peint un aplat. C'est laid à lire et c'est le prix d'un changement qui ne
  // touche ni les six autres apparences, ni les trente-quatre écrans.
  //
  // **D'où une variable écrite pour une seule charte**, exactement comme les
  // formes juste en dessous : les six autres n'écrivent rien, `globals.css`
  // garde son `none`, aucun dégradé n'est peint, et leur aplat d'action reste
  // celui qu'il a validé — le bleu marine de Brume n'a aucune raison de virer
  // au vert.
  //
  // **Ce que cette variable ne touche PAS, et c'est voulu :** l'accent
  // `rust` lui-même ne bouge pas d'un cheveu. Les textes verts, les icônes,
  // les liserés, les fonds pâles `rustTint` gardent le vert pin. Sa consigne
  // vise les boutons PLEINS — « surtout pas ceux qui sont creux ou d'une autre
  // couleur que la verte » —, et seuls les éléments portant `.atlas-plein` le
  // reçoivent.
  if (c.nom === "origine") {
    sortie["--atlas-plein-fond"] = "linear-gradient(#29382F, #29382F)";
  }

  // **Une forme absente n'écrit RIEN**, et c'est ce qui tient sa consigne du
  // 24 août : « ne change pas l'appli ». Poser `--atlas-police-titres:initial`
  // sur les chartes sans forme aurait écrasé le repli de `globals.css` — donc
  // changé la typographie de tout le monde pour ajouter une option à un seul.
  if (c.formes?.policeTitres) sortie["--atlas-police-titres"] = c.formes.policeTitres;

  // **La pastille se décrit en variables, pas en drapeau lu par un écran.** La
  // barre du bas ne doit rien savoir de la charte : le jour où une deuxième
  // charte voudra ce marqueur, il n'y a rien à rouvrir dans le composant.
  // Chaque variable a pour repli la valeur d'aujourd'hui (`globals.css`), si
  // bien qu'une charte muette laisse le trait doré intact.
  if (c.formes?.ongletCourant === "pastille") {
    sortie["--atlas-onglet-haut"] = "10px";
    sortie["--atlas-onglet-hauteur"] = "100%";
    sortie["--atlas-onglet-rayon"] = "11px";
    // **L'OR, ET NON L'ACCENT — sa consigne du 27 août 2026 :** *« lorsque je
    // choisis l'apparence Brume, tout ce qui est en doré sur Origine le reste
    // aussi sur Brume »*.
    //
    // La pastille était tenue par l'accent : sur Brume, le trait doré du
    // marqueur d'onglet devenait donc bleu marine. **C'était le SEUL endroit de
    // l'accueil où l'or se perdait** — mesuré en relevant la couleur de chaque
    // élément sur les deux chartes, plutôt que cherché à l'œil.
    //
    // **Et le libellé de l'onglet ne change pas non plus** : sur Origine il est
    // à l'encre de l'écran, et rien ne le teintait. La ligne qui le passait à
    // l'accent a donc disparu — sa consigne dit que l'or reste l'or, pas qu'une
    // autre couleur s'invite.
    sortie["--atlas-onglet-fond"] = `color-mix(in srgb, ${c.jetons.or} 11%, transparent)`;
  }
  return sortie;
}

/**
 * TOUTES les variables qu'UNE charte peut poser, quelle qu'elle soit.
 *
 * **Elle existe pour qu'un changement en direct sache RETIRER, pas seulement
 * poser.** Les variables vivent sur `<html>` : passer de « Brume moderne » à
 * une autre charte ne peut pas se contenter d'écrire les nouvelles — il faut
 * effacer celles que la précédente avait posées et que la nouvelle ignore,
 * sinon la pastille d'onglet de Brume survit sur Origine.
 *
 * **Calculée depuis les chartes elles-mêmes**, jamais recopiée : une liste
 * tenue à la main s'oublierait à la première variable ajoutée, et l'oubli ne se
 * verrait que chez lui, en changeant d'apparence.
 */
export function toutesLesVariables(): string[] {
  const noms = new Set<string>();
  for (const c of CHARTES) for (const cle of Object.keys(variablesCharte(c))) noms.add(cle);
  return [...noms];
}

export function variablesCss(c: Charte): string {
  const couleurs = Object.entries(variablesCharte(c)).map(([cle, v]) => `${cle}:${v}`);

  return couleurs.join(";");
}
