/**
 * LE CROQUIS DE LA FICHE DE SÉCURITÉ — en règles pures.
 *
 * **Ce que la loi demande, et rien d'autre ne bloque.** L'art. R. 717-85-16 du
 * code rural, relu dans la notice MSA 12350 : « une carte ou un croquis du
 * chantier indiquant les accès et voies de circulation ainsi que les végétaux
 * à traiter ». Ces trois-là sont obligatoires (`OBLIGATOIRES_DU_CROQUIS`) ; le
 * reste de la légende vient de l'exemple rempli de la MSA (ligne électrique,
 * zone de stockage, point où le téléphone capte, point de rencontre des
 * secours…), plus la maison qu'il a demandée le 14 octobre 2026 (« un carré
 * automatique pour la maison »).
 *
 * **Sa règle du 14 octobre : « il ne doit pas pouvoir valider le croquis sans
 * ces éléments ».** `manquesDuCroquis` est la seule réponse à « que manque-t-il
 * au croquis ? » : l'éditeur, la fiche et le minimum légal s'en servent tous,
 * jamais une copie.
 *
 * **Le dessin est gardé en repères, pas en image** : il se reprend, se déplace
 * et se corrige, et le PDF le redessine net (`fiche-securite-pdf.ts`). Les
 * coordonnées sont celles d'une feuille de 400 sur 300, quelle que soit la
 * taille de l'écran qui l'a dessiné.
 */

export const LARGEUR_DU_CROQUIS = 400;
export const HAUTEUR_DU_CROQUIS = 300;

/** Un trait se pose en deux appuis (départ, arrivée) ; un repère en un seul ; le crayon suit le doigt. */
export type GenreDOutil = "crayon" | "trait" | "repere";

export const OUTILS_DU_CROQUIS = [
  { t: "crayon", libelle: "Crayon", court: "Crayon", genre: "crayon" },
  { t: "acces", libelle: "Accès au chantier", court: "Accès", genre: "trait" },
  { t: "voie", libelle: "Voie de circulation", court: "Voie", genre: "trait" },
  { t: "abattre", libelle: "Arbre à abattre", court: "À abattre", genre: "repere" },
  { t: "tailler", libelle: "Arbre à tailler", court: "À tailler", genre: "repere" },
  { t: "maison", libelle: "Maison", court: "Maison", genre: "repere" },
  { t: "danger", libelle: "Zone de danger", court: "Danger", genre: "repere" },
  { t: "stockage", libelle: "Stockage et broyage", court: "Stockage", genre: "repere" },
  { t: "ligne", libelle: "Ligne électrique", court: "Ligne élec.", genre: "trait" },
  { t: "reseau", libelle: "Le téléphone capte", court: "Réseau tél.", genre: "repere" },
  { t: "secours", libelle: "Rendez-vous des secours", court: "Secours", genre: "repere" },
  // La limite de parcelle se pose par deux coins opposés et se dessine en
  // rectangle, bords parallèles au cadre — sa demande du 14 octobre : « que ça
  // fasse un carré propre ».
  { t: "limite", libelle: "Limite de parcelle", court: "Limite", genre: "trait" },
  { t: "ruisseau", libelle: "Ruisseau", court: "Ruisseau", genre: "trait" },
] as const;

export type TypeDeMarque = (typeof OUTILS_DU_CROQUIS)[number]["t"];

export type Marque =
  | { t: "crayon"; pts: number[] }
  | { t: "acces" | "voie" | "ligne" | "limite" | "ruisseau"; x: number; y: number; x2: number; y2: number }
  | { t: "abattre" | "tailler" | "maison" | "stockage" | "reseau" | "secours"; x: number; y: number }
  | { t: "danger"; x: number; y: number; mot: string };

export type FondDuCroquis = "photo" | "blanc" | "import";

export type Croquis = {
  /** `null` tant qu'aucun fond n'est choisi : le croquis n'est pas commencé. */
  fond: FondDuCroquis | null;
  /** La photo du chantier, ou le croquis papier importé, sous le dessin. */
  fondPhotoId: string | null;
  marques: Marque[];
};

export function croquisVide(): Croquis {
  return { fond: null, fondPhotoId: null, marques: [] };
}

export const genreDe = (t: TypeDeMarque): GenreDOutil => OUTILS_DU_CROQUIS.find((o) => o.t === t)!.genre;
export const estUnArbre = (m: Marque) => m.t === "abattre" || m.t === "tailler";

/** Les trois éléments que la loi exige sur le croquis. */
export const OBLIGATOIRES_DU_CROQUIS = [
  { mot: "Accès", test: (m: Marque) => m.t === "acces" },
  { mot: "Voie de circulation", test: (m: Marque) => m.t === "voie" },
  { mot: "Arbres à traiter", test: estUnArbre },
] as const;

/** Ce qui manque au croquis pour être conforme, en minuscules, prêt à écrire dans une phrase. */
export function manquesDuCroquis(croquis: Croquis): string[] {
  return OBLIGATOIRES_DU_CROQUIS.filter((o) => !croquis.marques.some(o.test)).map((o) => o.mot.toLowerCase());
}

/** Le numéro qu'un arbre porte sur le croquis : celui des arbres dangereux de la fiche. */
export function numeroDeLArbre(marques: readonly Marque[], rang: number): number {
  return marques.slice(0, rang + 1).filter(estUnArbre).length;
}
export function numeroDeLaZone(marques: readonly Marque[], rang: number): number {
  return marques.slice(0, rang + 1).filter((m) => m.t === "danger").length;
}

/** La limite de parcelle : le rectangle aux bords parallèles au cadre, entre deux coins opposés. */
export function rectangleDeLaLimite(m: { x: number; y: number; x2: number; y2: number }) {
  return { x: Math.min(m.x, m.x2), y: Math.min(m.y, m.y2), largeur: Math.abs(m.x2 - m.x), hauteur: Math.abs(m.y2 - m.y) };
}

/** Un ruisseau ondule entre ses deux appuis : la même ligne qu'un trait, pliée, en courbes. */
export function cheminDuRuisseau(m: { x: number; y: number; x2: number; y2: number }): string {
  const dx = m.x2 - m.x, dy = m.y2 - m.y, l = Math.hypot(dx, dy) || 1, nx = -dy / l, ny = dx / l, pas = Math.max(2, Math.round(l / 28));
  let d = `M${m.x} ${m.y}`;
  for (let i = 1; i <= pas; i++) {
    const t0 = (i - 0.5) / pas, t1 = i / pas, a = i % 2 ? 9 : -9;
    d += ` Q${r1(m.x + dx * t0 + nx * a)} ${r1(m.y + dy * t0 + ny * a)} ${r1(m.x + dx * t1)} ${r1(m.y + dy * t1)}`;
  }
  return d;
}
const r1 = (n: number) => Math.round(n * 10) / 10;

/**
 * **CE QUE LE TÉLÉPHONE ENVOIE SE VÉRIFIE** — la même règle que le reste de la
 * fiche (`contenuRecu`). Un croquis faux rendrait la fiche et son PDF
 * illisibles ; un croquis démesuré remplirait la base. Les bornes sont larges :
 * un croquis dessiné au doigt ne les approche pas.
 */
export const MARQUES_MAX = 300;
export const POINTS_MAX_PAR_TRAIT = 4_000;
export const POINTS_MAX_DU_CROQUIS = 40_000;
export const LONGUEUR_MAX_D_UNE_ZONE = 80;

const TYPES = new Set<string>(OUTILS_DU_CROQUIS.map((o) => o.t));
const IDENTIFIANT = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const dansLeCadre = (n: unknown, max: number): n is number => typeof n === "number" && Number.isFinite(n) && n >= -50 && n <= max + 50;

export function croquisRecu(brut: unknown): { ok: true; croquis: Croquis } | { ok: false; raison: string } {
  if (brut === undefined || brut === null) return { ok: true, croquis: croquisVide() };
  const refus = { ok: false as const, raison: "Le croquis reçu n’a pas la bonne forme." };
  if (typeof brut !== "object" || Array.isArray(brut)) return refus;
  const b = brut as Record<string, unknown>;
  if (b.fond !== null && b.fond !== "photo" && b.fond !== "blanc" && b.fond !== "import") return refus;
  if (b.fondPhotoId !== null && !(typeof b.fondPhotoId === "string" && IDENTIFIANT.test(b.fondPhotoId))) return refus;
  if (!Array.isArray(b.marques) || b.marques.length > MARQUES_MAX) return refus;
  const marques: Marque[] = [];
  let points = 0;
  for (const m of b.marques) {
    if (typeof m !== "object" || m === null || !TYPES.has((m as { t: unknown }).t as string)) return refus;
    const x = m as Record<string, unknown>;
    const t = x.t as TypeDeMarque;
    const genre = genreDe(t);
    if (genre === "crayon") {
      const pts = x.pts;
      if (!Array.isArray(pts) || pts.length < 4 || pts.length > POINTS_MAX_PAR_TRAIT || pts.length % 2 !== 0) return refus;
      if (!pts.every((v, i) => dansLeCadre(v, i % 2 ? HAUTEUR_DU_CROQUIS : LARGEUR_DU_CROQUIS))) return refus;
      points += pts.length;
      marques.push({ t: "crayon", pts: pts.map(Math.round) });
    } else if (genre === "trait") {
      if (![x.x, x.x2].every((v) => dansLeCadre(v, LARGEUR_DU_CROQUIS)) || ![x.y, x.y2].every((v) => dansLeCadre(v, HAUTEUR_DU_CROQUIS))) return refus;
      marques.push({ t, x: Math.round(x.x as number), y: Math.round(x.y as number), x2: Math.round(x.x2 as number), y2: Math.round(x.y2 as number) } as Marque);
    } else {
      if (!dansLeCadre(x.x, LARGEUR_DU_CROQUIS) || !dansLeCadre(x.y, HAUTEUR_DU_CROQUIS)) return refus;
      if (t === "danger") {
        const mot = x.mot ?? "";
        if (typeof mot !== "string" || mot.length > LONGUEUR_MAX_D_UNE_ZONE) return refus;
        marques.push({ t: "danger", x: Math.round(x.x as number), y: Math.round(x.y as number), mot });
      } else {
        marques.push({ t, x: Math.round(x.x as number), y: Math.round(x.y as number) } as Marque);
      }
    }
  }
  if (points > POINTS_MAX_DU_CROQUIS) return { ok: false, raison: "Le croquis est trop chargé : retirez quelques traits de crayon." };
  return { ok: true, croquis: { fond: (b.fond as FondDuCroquis | null) ?? null, fondPhotoId: (b.fondPhotoId as string | null) ?? null, marques } };
}
