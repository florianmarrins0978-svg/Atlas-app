import { and, asc, eq, isNull, sql } from "drizzle-orm";
import { withEntreprise } from "../db/with-entreprise";
import { grillePrix, naturesGrille, tranchesGrille } from "../db/schema";
import type { Ctx } from "./context";
import {
  AXES_PAR_DEFAUT,
  NATURES_PAR_DEFAUT,
  casesDUneForme,
  cellulesDeNature,
  cleDeNaturePerso,
  libelleDeTranche,
  nouvelleCleTranche,
  rangerTranche,
  uniteDeAxe,
  type Axes,
  type FormeGrille,
  type Grilles,
  type Nature,
  type NomAxe,
  type Technique,
  type Tranche,
} from "../../lib/grille-prix";

/**
 * Les tranches et les travaux réglés par l'artisan — sa demande du 14 août 2026 :
 * *« je dois pouvoir ajouter ou retirer des cases. »*
 *
 * **Ce fichier ne décide rien.** Les bornes, le nommage des clés, le refus d'un
 * recouvrement et le décompte des cases vivent dans `src/lib/grille-prix.ts` :
 * fonctions pures, éprouvables sans base, et discutables avec le patron sans
 * lire une requête. Ici on lit et on écrit.
 *
 * **Tout passe par `withEntreprise`** — ce sont ses prix de vente, et une
 * requête posée hors de ce cadre ne renverrait rien, silencieusement
 * (`CLAUDE.md` §3).
 */

/** Les cinq natures que le moteur de chiffrage sait reconnaître dans une dictée. */
const INTEGREES = new Set(NATURES_PAR_DEFAUT.map((n) => n.cle));

type LigneTranche = typeof tranchesGrille.$inferSelect;
type LigneNature = typeof naturesGrille.$inferSelect;

function enTranche(l: LigneTranche): Tranche {
  return { cle: l.cle, de: Number(l.de), a: l.a === null ? null : Number(l.a), libelle: l.libelle };
}

function enNature(l: LigneNature): Nature {
  const depart = NATURES_PAR_DEFAUT.find((n) => n.cle === l.cle);
  return {
    cle: l.cle,
    titre: l.titre,
    aide: l.aide,
    axe: l.axeLibelle,
    forme: l.forme,
    // La clé de la case unique ne se règle pas : c'est `ml` pour la haie et
    // `tonne` pour les grumes depuis leurs migrations, et un travail ajouté par
    // le patron n'en a qu'une, nommée une fois pour toutes.
    cleUnique: depart?.cleUnique ?? (l.forme === "une-case" ? "unique" : undefined),
    libelleUnique: l.libelleUnique ?? depart?.libelleUnique ?? "Prix unitaire",
    integree: INTEGREES.has(l.cle),
  };
}

/**
 * Les grilles d'une entreprise : ses axes et ses travaux.
 *
 * **Une entreprise qui n'a jamais rien touché n'a aucune ligne**, et reçoit les
 * valeurs de départ du code. Ce n'est pas une commodité : écrire ces lignes à
 * la migration les aurait figées une seconde fois, et corriger une borne
 * d'origine aurait demandé une migration de plus.
 *
 * **Un axe vidé exprès reste vide.** Si des lignes existent et qu'elles sont
 * toutes retirées, on rend une liste vide — pas les tranches de départ. Le
 * contraire ferait réapparaître ce qu'il vient d'enlever.
 */
export async function lireGrilles(ctx: Ctx): Promise<Grilles> {
  return withEntreprise(ctx.utilisateurId, ctx.entrepriseId, async (tx) => {
    const [tranches, natures] = await Promise.all([
      tx.select().from(tranchesGrille).orderBy(asc(tranchesGrille.rang), asc(tranchesGrille.de)),
      tx.select().from(naturesGrille).orderBy(asc(naturesGrille.rang)),
    ]);
    return assembler(tranches, natures);
  });
}

function assembler(tranches: LigneTranche[], natures: LigneNature[]): Grilles {
  const parAxe = (axe: NomAxe) => tranches.filter((t) => t.axe === axe);
  const vivantes = (axe: NomAxe) => parAxe(axe).filter((t) => t.retireeLe === null).map(enTranche);

  const axes: Axes = {
    diametres: parAxe("diametre").length === 0 ? AXES_PAR_DEFAUT.diametres : vivantes("diametre"),
    hauteurs: parAxe("hauteur").length === 0 ? AXES_PAR_DEFAUT.hauteurs : vivantes("hauteur"),
    techniques:
      parAxe("technique").length === 0
        ? AXES_PAR_DEFAUT.techniques
        : vivantes("technique").map<Technique>((t) => ({ cle: t.cle, libelle: t.libelle })),
  };

  return {
    axes,
    natures:
      natures.length === 0
        ? NATURES_PAR_DEFAUT
        : natures.filter((n) => n.retireeLe === null).map(enNature),
  };
}

// ---------------------------------------------------------------------------
// Le premier geste recopie ce qui servait jusque-là
// ---------------------------------------------------------------------------

/**
 * Recopie les tranches de départ d'un axe, si l'artisan n'y a jamais touché.
 *
 * **Sans cela, son premier ajout effacerait tout le reste.** Un axe sans ligne
 * signifie « les tranches de départ » ; y insérer une seule ligne le ferait
 * basculer sur « une seule tranche, la sienne », et les huit diamètres
 * disparaîtraient d'un coup — avec les prix qui s'y rattachent.
 */
async function materialiserAxe(
  tx: Parameters<Parameters<typeof withEntreprise>[2]>[0],
  entrepriseId: string,
  axe: NomAxe
): Promise<void> {
  const deja = await tx.select({ id: tranchesGrille.id }).from(tranchesGrille).where(eq(tranchesGrille.axe, axe));
  if (deja.length > 0) return;

  const depart: { cle: string; de: number; a: number | null; libelle: string }[] =
    axe === "diametre"
      ? AXES_PAR_DEFAUT.diametres.map((t) => ({ ...t }))
      : axe === "hauteur"
        ? AXES_PAR_DEFAUT.hauteurs.map((t) => ({ ...t }))
        : AXES_PAR_DEFAUT.techniques.map((t) => ({ cle: t.cle, de: 0, a: null, libelle: t.libelle }));

  await tx.insert(tranchesGrille).values(
    depart.map((t, rang) => ({
      entrepriseId,
      axe,
      cle: t.cle,
      de: t.de.toFixed(2),
      a: t.a === null ? null : t.a.toFixed(2),
      libelle: t.libelle,
      rang,
    }))
  );
}

/** Même chose pour les travaux : les cinq d'origine, recopiés au premier geste. */
async function materialiserNatures(
  tx: Parameters<Parameters<typeof withEntreprise>[2]>[0],
  entrepriseId: string
): Promise<void> {
  const deja = await tx.select({ id: naturesGrille.id }).from(naturesGrille);
  if (deja.length > 0) return;

  await tx.insert(naturesGrille).values(
    NATURES_PAR_DEFAUT.map((n, rang) => ({
      entrepriseId,
      cle: n.cle,
      titre: n.titre,
      aide: n.aide,
      axeLibelle: n.axe,
      forme: n.forme,
      libelleUnique: n.libelleUnique ?? null,
      rang,
    }))
  );
}

// ---------------------------------------------------------------------------
// Ajouter
// ---------------------------------------------------------------------------

export type Ajout = { ok: true; cle: string; cases: number } | { ok: false; raison: string };

/**
 * Ajoute une tranche à un axe — ou dit pourquoi c'est impossible.
 *
 * **Le refus est une réponse** (`docs/AGENT.md` §3), et il remonte jusqu'à
 * l'écran : un recouvrement silencieusement accepté ferait chiffrer un arbre
 * dans la mauvaise case, et cela ne se verrait que sur le devis du client.
 */
export async function ajouterTranche(
  ctx: Ctx,
  axe: NomAxe,
  demande: { de: number; a: number | null; libelle?: string }
): Promise<Ajout> {
  return withEntreprise(ctx.utilisateurId, ctx.entrepriseId, async (tx) => {
    await materialiserAxe(tx, ctx.entrepriseId, axe);

    const lignes = await tx.select().from(tranchesGrille).where(eq(tranchesGrille.axe, axe));
    const vivantes = lignes.filter((l) => l.retireeLe === null).map(enTranche);
    // Les clés RETIRÉES comptent aussi : réemployer `d90` ferait hériter la
    // tranche neuve des prix de l'ancienne.
    const prises = new Set(lignes.map((l) => l.cle));

    const cle = nouvelleCleTranche(axe, demande.de, prises);
    const libelle = (demande.libelle ?? "").trim() || libelleDeTranche(demande.de, demande.a, uniteDeAxe(axe));
    const range = rangerTranche(vivantes, { de: demande.de, a: demande.a, libelle, cle });
    if ("raison" in range) return { ok: false as const, raison: range.raison };

    await tx.insert(tranchesGrille).values({
      entrepriseId: ctx.entrepriseId,
      axe,
      cle,
      de: demande.de.toFixed(2),
      a: demande.a === null ? null : demande.a.toFixed(2),
      libelle,
      rang: range.tranches.findIndex((t) => t.cle === cle),
    });
    await renumeroter(tx, axe, range.tranches);

    const grilles = assembler(await tx.select().from(tranchesGrille), await tx.select().from(naturesGrille));
    return { ok: true as const, cle, cases: casesApresAjout(axe, grilles) };
  });
}

/**
 * Ajoute une façon d'abattre — même table, bornes muettes.
 *
 * Une technique n'a pas de bornes : c'est son libellé qui dit tout. La ranger
 * dans la même table que les diamètres évite d'écrire deux fois le même retrait
 * réversible, et deux mécaniques de retrait finissent par diverger.
 */
export async function ajouterTechnique(ctx: Ctx, libelle: string): Promise<Ajout> {
  const propre = libelle.trim();
  if (propre === "") return { ok: false, raison: "Donnez un nom à cette façon d'abattre." };
  if (propre.length > 80) return { ok: false, raison: "Ce nom est trop long." };

  return withEntreprise(ctx.utilisateurId, ctx.entrepriseId, async (tx) => {
    await materialiserAxe(tx, ctx.entrepriseId, "technique");
    const lignes = await tx.select().from(tranchesGrille).where(eq(tranchesGrille.axe, "technique"));
    if (lignes.some((l) => l.retireeLe === null && l.libelle.toLowerCase() === propre.toLowerCase())) {
      return { ok: false as const, raison: "Cette façon d'abattre existe déjà." };
    }
    const prises = new Set(lignes.map((l) => l.cle));
    const cle = cleDeTechnique(propre, prises);

    await tx.insert(tranchesGrille).values({
      entrepriseId: ctx.entrepriseId,
      axe: "technique",
      cle,
      de: "0",
      a: null,
      libelle: propre,
      rang: lignes.length,
    });

    const grilles = assembler(await tx.select().from(tranchesGrille), await tx.select().from(naturesGrille));
    return { ok: true as const, cle, cases: casesApresAjout("technique", grilles) };
  });
}

function cleDeTechnique(libelle: string, prises: ReadonlySet<string>): string {
  const base =
    "t_" +
    (libelle
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "")
      .slice(0, 30) || "facon");
  if (!prises.has(base)) return base;
  for (let n = 2; n < 1000; n++) if (!prises.has(`${base}_${n}`)) return `${base}_${n}`;
  throw new Error("Impossible de nommer cette façon d'abattre.");
}

/** Combien de cases une tranche de plus vient de poser, sur toutes les grilles. */
function casesApresAjout(axe: NomAxe, grilles: Grilles): number {
  // Les axes rendus par `assembler` comptent déjà la tranche neuve : on
  // demande donc ce que vaut UNE tranche de cet axe, hors elle-même.
  const sansElle: Axes = {
    ...grilles.axes,
    diametres: axe === "diametre" ? grilles.axes.diametres.slice(1) : grilles.axes.diametres,
    hauteurs: axe === "hauteur" ? grilles.axes.hauteurs.slice(1) : grilles.axes.hauteurs,
    techniques: axe === "technique" ? grilles.axes.techniques.slice(1) : grilles.axes.techniques,
  };
  return grilles.natures.reduce(
    (n, nature) => n + (cellulesDeNature(nature, grilles.axes).length - cellulesDeNature(nature, sansElle).length),
    0
  );
}

/** Ajoute un travail à lui. */
export async function ajouterNature(
  ctx: Ctx,
  demande: { titre: string; forme: FormeGrille; aide?: string; libelleUnique?: string }
): Promise<Ajout> {
  const titre = demande.titre.trim();
  if (titre === "") return { ok: false, raison: "Donnez un nom à ce travail." };
  if (titre.length > 80) return { ok: false, raison: "Ce nom est trop long." };

  return withEntreprise(ctx.utilisateurId, ctx.entrepriseId, async (tx) => {
    await materialiserNatures(tx, ctx.entrepriseId);
    const lignes = await tx.select().from(naturesGrille);
    if (lignes.some((l) => l.retireeLe === null && l.titre.toLowerCase() === titre.toLowerCase())) {
      return { ok: false as const, raison: "Un travail porte déjà ce nom." };
    }
    const cle = cleDeNaturePerso(titre, new Set(lignes.map((l) => l.cle)));

    await tx.insert(naturesGrille).values({
      entrepriseId: ctx.entrepriseId,
      cle,
      titre,
      aide: (demande.aide ?? "").trim(),
      axeLibelle: demande.forme === "une-case" ? "" : "Diamètre",
      forme: demande.forme,
      libelleUnique: demande.forme === "une-case" ? (demande.libelleUnique ?? "Prix unitaire") : null,
      rang: lignes.length,
    });

    const grilles = assembler(await tx.select().from(tranchesGrille), await tx.select().from(naturesGrille));
    return { ok: true as const, cle, cases: casesDUneForme(demande.forme, grilles.axes) };
  });
}

// ---------------------------------------------------------------------------
// Retirer — et rendre
// ---------------------------------------------------------------------------

/** Ce qu'un retrait emporte : de quoi l'annoncer avant de le faire, et le défaire après. */
export type Retrait = { prixEmportes: number };

/**
 * Retire une tranche. **Aucun prix n'est effacé.**
 *
 * Les cases de `grille_prix` restent en place : une clé qu'aucune tranche ne
 * reconnaît est ignorée à la lecture, jamais supprimée (`lireGrillePrix`).
 * Rendre la tranche les fait revenir telles quelles — c'est ce qui rend
 * « Annuler » honnête.
 */
export async function retirerTranche(ctx: Ctx, axe: NomAxe, cle: string): Promise<Retrait> {
  return withEntreprise(ctx.utilisateurId, ctx.entrepriseId, async (tx) => {
    await materialiserAxe(tx, ctx.entrepriseId, axe);
    const emportes = await compterPrix(tx, axe, cle);
    await tx
      .update(tranchesGrille)
      .set({ retireeLe: sql`now()` })
      .where(and(eq(tranchesGrille.axe, axe), eq(tranchesGrille.cle, cle), isNull(tranchesGrille.retireeLe)));
    return { prixEmportes: emportes };
  });
}

/** Défait un retrait de tranche. Les prix reviennent avec elle. */
export async function rendreTranche(ctx: Ctx, axe: NomAxe, cle: string): Promise<void> {
  await withEntreprise(ctx.utilisateurId, ctx.entrepriseId, async (tx) => {
    await tx
      .update(tranchesGrille)
      .set({ retireeLe: null })
      .where(and(eq(tranchesGrille.axe, axe), eq(tranchesGrille.cle, cle)));
  });
}

export async function retirerNature(ctx: Ctx, cle: string): Promise<Retrait> {
  return withEntreprise(ctx.utilisateurId, ctx.entrepriseId, async (tx) => {
    await materialiserNatures(tx, ctx.entrepriseId);
    const prix = await tx.select({ n: sql<number>`count(*)::int` }).from(grillePrix).where(eq(grillePrix.nature, cle));
    await tx
      .update(naturesGrille)
      .set({ retireeLe: sql`now()` })
      .where(and(eq(naturesGrille.cle, cle), isNull(naturesGrille.retireeLe)));
    return { prixEmportes: prix[0]?.n ?? 0 };
  });
}

export async function rendreNature(ctx: Ctx, cle: string): Promise<void> {
  await withEntreprise(ctx.utilisateurId, ctx.entrepriseId, async (tx) => {
    await tx.update(naturesGrille).set({ retireeLe: null }).where(eq(naturesGrille.cle, cle));
  });
}

/**
 * Combien de prix une tranche porte, toutes grilles confondues.
 *
 * **Compté sur les CLÉS de case, pas deviné.** Une case s'appelle `h10|d40`,
 * `au_pied|d70` ou `d40` selon la grille : la tranche `d40` apparaît donc à
 * trois endroits différents de la même chaîne. Le motif ci-dessous les couvre
 * tous les trois, et rien d'autre — `d4` ne doit pas compter pour `d40`.
 */
async function compterPrix(
  tx: Parameters<Parameters<typeof withEntreprise>[2]>[0],
  axe: NomAxe,
  cle: string
): Promise<number> {
  const r = await tx
    .select({ n: sql<number>`count(*)::int` })
    .from(grillePrix)
    .where(sql`${grillePrix.cellule} = ${cle} OR ${grillePrix.cellule} LIKE ${cle + "|%"} OR ${grillePrix.cellule} LIKE ${"%|" + cle}`);
  void axe;
  return r[0]?.n ?? 0;
}

/**
 * Combien de prix chaque tranche d'un axe porte — pour l'écran « Mes mesures ».
 *
 * C'est ce chiffre qui transforme un retrait aveugle en décision : « 3 prix »
 * à côté d'une tranche dit ce qu'on s'apprête à ranger.
 */
export async function prixParTranche(ctx: Ctx, axe: NomAxe): Promise<Map<string, number>> {
  return withEntreprise(ctx.utilisateurId, ctx.entrepriseId, async (tx) => {
    const [tranches, cases] = await Promise.all([
      tx.select().from(tranchesGrille).where(eq(tranchesGrille.axe, axe)),
      tx.select({ cellule: grillePrix.cellule }).from(grillePrix),
    ]);
    const cles =
      tranches.length > 0
        ? tranches.filter((t) => t.retireeLe === null).map((t) => t.cle)
        : axe === "diametre"
          ? AXES_PAR_DEFAUT.diametres.map((t) => t.cle)
          : axe === "hauteur"
            ? AXES_PAR_DEFAUT.hauteurs.map((t) => t.cle)
            : AXES_PAR_DEFAUT.techniques.map((t) => t.cle);

    const compte = new Map<string, number>(cles.map((c) => [c, 0]));
    for (const { cellule } of cases) {
      for (const morceau of cellule.split("|")) {
        const n = compte.get(morceau);
        if (n !== undefined) compte.set(morceau, n + 1);
      }
    }
    return compte;
  });
}

/** Remet les rangs dans l'ordre des bornes, pour que l'écran lise du plus petit au plus grand. */
async function renumeroter(
  tx: Parameters<Parameters<typeof withEntreprise>[2]>[0],
  axe: NomAxe,
  ordre: readonly Tranche[]
): Promise<void> {
  for (const [rang, t] of ordre.entries()) {
    await tx
      .update(tranchesGrille)
      .set({ rang })
      .where(and(eq(tranchesGrille.axe, axe), eq(tranchesGrille.cle, t.cle)));
  }
}
