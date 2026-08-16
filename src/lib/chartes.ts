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
};

export type NomCharte = "origine" | "pierre" | "beurre" | "moka" | "prune" | "sylve" | "nuit";

export type Charte = {
  nom: NomCharte;
  /** Ce qu'il lit dans la liste. */
  libelle: string;
  /** Une phrase, la sienne quand elle existe — celle de la planche. */
  dit: string;
  /** Sombre : l'écran est plus foncé que l'encre ne l'est claire. */
  sombre: boolean;
  jetons: JetonsCharte;
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
  bronze: string;
  plein: string;
  pleinSigne: string;
}): JetonsCharte {
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
    or: p.bronze,
    orClair: p.pleinSigne,
    line: voile(p.encre, "0.12"),
    lineSoft: voile(p.encre, "0.07"),
    chevron: voile(p.encre, "0.28"),
  };
}

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
      or: "#B98B47",
      orClair: "#C9A15E",
      line: "rgba(28,28,26,0.12)",
      lineSoft: "rgba(28,28,26,0.07)",
      chevron: "rgba(28,28,26,0.28)",
    },
  },
  {
    nom: "pierre",
    libelle: "Pierre",
    dit: "Gris légèrement vert, encre presque noire, sauge désaturée. Aucun or.",
    sombre: false,
    jetons: depuisPlanche({
      fond: "#e8e8e3", plage: "#f4f4f0", encre: "#1b1d19", gris: "#83867c",
      bronze: "#6f8466", plein: "#1b1d19", pleinSigne: "#8b9d83",
    }),
  },
  {
    nom: "beurre",
    libelle: "Beurre",
    dit: "Le jaune beurre, très pâle, donne une chaleur qu'aucun crème n'atteint.",
    sombre: false,
    jetons: depuisPlanche({
      fond: "#efe7cf", plage: "#f8f3e4", encre: "#26221a", gris: "#8b8368",
      bronze: "#8a6a3a", plein: "#26221a", pleinSigne: "#c2a05f",
    }),
  },
  {
    nom: "moka",
    libelle: "Moka",
    dit: "Un moka laiteux, une encre espresso, une argile pour l'accent.",
    sombre: false,
    jetons: depuisPlanche({
      fond: "#e6ded5", plage: "#f2ece5", encre: "#2b241e", gris: "#8d8175",
      bronze: "#7c5c46", plein: "#2b241e", pleinSigne: "#b99274",
    }),
  },
  {
    nom: "prune",
    libelle: "Prune",
    dit: "Aubergine, rose poudré, cuivre. La plus habillée — celle qui ressemble le moins à un outil.",
    sombre: false,
    jetons: depuisPlanche({
      fond: "#efe6ea", plage: "#f9f2f5", encre: "#23131c", gris: "#8c7481",
      bronze: "#7a2f52", plein: "#3d1730", pleinSigne: "#d9a2bd",
    }),
  },
  {
    nom: "sylve",
    libelle: "Sylve",
    dit: "Le vert profond passe du bouton au FOND. Un écran de paysagiste.",
    sombre: true,
    jetons: depuisPlanche({
      fond: "#16241c", plage: "#1e3026", encre: "#e6e6da", gris: "#8ba189",
      bronze: "#c3b184", plein: "#e6e6da", pleinSigne: "#3d6b4a",
    }),
  },
  {
    nom: "nuit",
    libelle: "Nuit",
    dit: "Noir chaud, laiton doux. La plus spectaculaire — et la moins lisible au soleil.",
    sombre: true,
    jetons: depuisPlanche({
      fond: "#101210", plage: "#1a1d19", encre: "#e9e8de", gris: "#84887b",
      bronze: "#c6a15b", plein: "#e9e8de", pleinSigne: "#8f7130",
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
export function variablesCss(c: Charte): string {
  return (Object.keys(c.jetons) as (keyof JetonsCharte)[])
    .map((cle) => `--atlas-${cle}:${c.jetons[cle]}`)
    .join(";");
}
