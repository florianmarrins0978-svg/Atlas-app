import Decimal from "decimal.js";

/**
 * La main d'œuvre qu'il DICTE : où elle va sur le devis, et combien.
 *
 * **Sa planche du 21 octobre 2026** (`appli/main-d-oeuvre-repartie.html`),
 * choisie le soir même : *« il y a des utilisateurs qui vont préférer avoir une
 * case main d'œuvre, et d'autres qui vont préférer que ce soit réparti sur
 * l'ensemble des tâches »*. Donc une question à l'arrêt d'avant-chiffrage,
 * des curseurs pour répartir, une croix qui rend un travail à sa grille, et la
 * question qui ne se pose plus quand il a fait trois fois le même choix.
 *
 * **Les jours qu'il dicte couvrent TOUT le chantier** (sa réponse du même
 * soir, « la B ») : 2 hommes, 2 jours, abattage et fente, c'est 1 600 € pour
 * les deux travaux, pas 1 600 € plus la fente. Ce qui sort de la main d'œuvre
 * (la croix) prend son prix ailleurs, sa grille, sinon « à chiffrer ».
 *
 * Fonctions pures : aucune base, aucun écran. L'écran et le chiffrage lisent
 * les MÊMES (`CLAUDE.md` §3).
 */

/** Le sujet sous lequel sa réponse se range dans `precisions_chantier`. */
export const SUJET_MAIN_OEUVRE = "main-oeuvre";

export type ModeMainOeuvre = "ligne" | "reparti";

export type ChoixMainOeuvre = {
  mode: ModeMainOeuvre;
  /** Sa part de chaque travail, par libellé de ligne. Absente : parts égales. */
  parts: Record<string, number>;
  /** Les travaux sortis de la main d'œuvre par la croix : leur grille, sinon à chiffrer. */
  retires: string[];
};

/** Ce que la carte « Avant de chiffrer » montre pour la main d'œuvre. */
export type QuestionMainOeuvre = {
  /** La main d'œuvre dictée, en euros HT, avant tout conducteur retiré. */
  total: string;
  /** « 2 hommes pendant 2 jours, 400 € le jour par homme ». */
  detail: string;
  prixJourHomme: string;
  /** Les travaux qu'elle peut couvrir, avec leur part de départ et le prix de leur grille. */
  travaux: { cle: string; libelle: string; part: number; grille: string | null }[];
  /** Les engins dictés qui partent avec leur conducteur. */
  engins: string[];
  hommes: number;
};

/** Le choix par défaut, tant qu'il n'a rien dit : réparti, parts de sa grille. */
export function choixParDefaut(mode: ModeMainOeuvre = "reparti"): ChoixMainOeuvre {
  return { mode, parts: {}, retires: [] };
}

/**
 * Sa réponse, relue. **Ce qui ne se lit pas ne se devine pas** : une valeur
 * abîmée rend `null`, et le chiffrage repart du choix par défaut plutôt que
 * d'un choix à moitié compris.
 */
export function lireChoix(valeur: string | null | undefined): ChoixMainOeuvre | null {
  if (!valeur) return null;
  let brut: unknown;
  try {
    brut = JSON.parse(valeur);
  } catch {
    return null;
  }
  if (!brut || typeof brut !== "object") return null;
  const b = brut as Record<string, unknown>;
  if (b.mode !== "ligne" && b.mode !== "reparti") return null;
  const parts: Record<string, number> = {};
  if (b.parts && typeof b.parts === "object") {
    for (const [cle, v] of Object.entries(b.parts as Record<string, unknown>)) {
      if (typeof v === "number" && Number.isFinite(v) && v >= 0) parts[cle] = v;
    }
  }
  const retires = Array.isArray(b.retires) ? b.retires.filter((r): r is string => typeof r === "string") : [];
  return { mode: b.mode, parts, retires };
}

/**
 * Les parts de départ des curseurs : **le prix de sa grille** pour un travail
 * qu'elle connaît, **le reste au travail principal** s'il n'a pas de case,
 * sinon aux travaux sans case, et rien aux autres.
 *
 * C'est sa règle du 7 août 2026 (« 850 + 250, pas 1 000 + 100 ») et son « B »
 * du 21 octobre : la fente prend sa case, l'abattage le reste. Un travail
 * détachable sans prix de grille part à zéro, donc « à chiffrer » : le partager
 * à égalité serait inventer le prix d'une fente. Le curseur, lui, le lui rend
 * d'un geste. Une grille qui dépasse la main d'œuvre ne prend que ce qu'il y a.
 */
export function partsDeDepart(
  total: string,
  travaux: readonly { cle: string; grille: string | null; principal: boolean }[]
): Record<string, number> {
  const t = Number(total);
  if (!(t > 0) || travaux.length === 0) return {};
  const sommeGrille = travaux.reduce((s, x) => s + (x.grille !== null ? Number(x.grille) : 0), 0);
  const sansCase = travaux.filter((x) => x.grille === null);
  const principalSansCase = sansCase.filter((x) => x.principal);
  // Le principal prend le reste quand sa grille se tait ; sinon, ce sont les
  // travaux qu'aucune case ne chiffre (sa haie à 300 €, la taille de
  // cohabitation à 500 €, le 21 octobre 2026).
  const recoivent = principalSansCase.length > 0 ? principalSansCase : sansCase;
  const echelle = sommeGrille > t || recoivent.length === 0 ? t / (sommeGrille || 1) : 1;
  const reste = Math.max(0, t - sommeGrille * echelle);
  return Object.fromEntries(
    travaux.map((x) => [
      x.cle,
      x.grille !== null ? Number(x.grille) * echelle : recoivent.includes(x) ? reste / recoivent.length : 0,
    ])
  );
}

export function ecrireChoix(choix: ChoixMainOeuvre): string {
  return JSON.stringify(choix);
}

/**
 * Ce qui s'écrit à côté de sa réponse. **Sans aucun chiffre** : les réponses
 * lisibles sont relues par le chiffrage pour y chercher des mesures, et
 * « 50 % » ne doit jamais y passer pour un diamètre.
 */
export function choixLisible(choix: ChoixMainOeuvre): string {
  return choix.mode === "ligne" ? "main d'œuvre sur une ligne à part" : "main d'œuvre répartie sur les travaux";
}

/**
 * Le mode qu'il a choisi ses trois dernières fois, s'il est le même : la
 * question ne se pose plus. `derniers` va du plus récent au plus ancien.
 */
export const FOIS_POUR_RETENIR = 3;
export function modeRetenu(derniers: readonly (ModeMainOeuvre | null)[]): ModeMainOeuvre | null {
  const trois = derniers.slice(0, FOIS_POUR_RETENIR);
  if (trois.length < FOIS_POUR_RETENIR) return null;
  const premier = trois[0];
  return premier !== null && trois.every((m) => m === premier) ? premier : null;
}

/**
 * Les journées d'homme facturées en main d'œuvre.
 *
 * **Le conducteur d'un engin est l'un des hommes dictés, et il est payé avec
 * l'engin** (sa règle du 21 octobre 2026) : *« s'il dit deux hommes et une
 * mini pelle, sur les deux hommes il y en a un qui sera affilié à la mini
 * pelle ; ça fait 400 plus 500 par jour »*. Chaque engin avec son homme retire
 * donc une journée par jour dicté. Jamais en dessous de zéro.
 */
export function journeesFacturees(jours: number, hommes: number, journeesDeConducteur: number): number {
  return Math.max(0, jours * hommes - journeesDeConducteur);
}

/** Un tarif qui comprend déjà un homme : « Mains d'œuvre plus mini pelle », « avec conducteur ». */
export function tarifAvecSonHomme(intitule: string): boolean {
  // Les mots de SES tarifs, et ceux qu'un autre artisan écrira pour la même
  // chose : les prix varient d'un utilisateur à l'autre, le nom aussi.
  return /\bmains?\s+d.?(œ|oe)uvre\b|\bconducteur\b|\bchauffeur\b|\bop[ée]rateur\b|\bpilote\b|\bavec\s+(un\s+)?(homme|bonhomme|gars|ouvrier)\b/i.test(
    intitule
  );
}

/**
 * La main d'œuvre partagée entre les travaux, à la dizaine (« en HT on fait
 * des prix ronds »). Le DERNIER prend l'écart d'arrondi : la somme tombe
 * toujours juste sur le total, sinon le devis dirait autre chose que la
 * main d'œuvre dictée.
 */
export function repartirMainOeuvre(
  total: string,
  cles: readonly string[],
  parts: Readonly<Record<string, number>>
): Record<string, string> {
  if (cles.length === 0) return {};
  const poids = cles.map((c) => (parts[c] !== undefined && parts[c] >= 0 ? parts[c] : 1));
  const somme = poids.reduce((s, p) => s + p, 0);
  const t = new Decimal(total);
  const montants = poids.map((p) =>
    somme > 0 ? t.times(p).div(somme).div(10).toDecimalPlaces(0, Decimal.ROUND_HALF_UP).times(10) : new Decimal(0)
  );
  const ecart = t.minus(montants.reduce((s, m) => s.plus(m), new Decimal(0)));
  montants[montants.length - 1] = montants[montants.length - 1].plus(ecart);
  return Object.fromEntries(cles.map((c, i) => [c, montants[i].toFixed(2)]));
}

/** Le libellé de la ligne Main d'œuvre : les travaux qu'elle couvre, nommés. */
export function libelleMainOeuvre(travaux: readonly string[]): string {
  if (travaux.length === 0) return "Main d'œuvre";
  const noms = travaux.map((t) => t.charAt(0).toLowerCase() + t.slice(1));
  return `Main d'œuvre : ${noms.join(", ")}`;
}
