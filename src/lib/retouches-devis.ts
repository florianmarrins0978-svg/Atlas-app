// Retoucher un devis à la voix — la règle, sans base ni modèle.
//
// Le patron, le 15 août 2026, en décrivant ce qu'il veut pouvoir dire :
//
//   « supprime-moi la deuxième ligne », « modifie-moi le prix de la taille de
//   haie », « remplace-moi le deux cent cinquante par trois cent cinquante »,
//   « rajoute-moi une ligne, broyage des branches, et tu mets cinq cents
//   euros », « supprime-moi fondage du bois, mais en échange je veux que tu
//   mettes débitage du bois », « tu as fait une faute à tel endroit, corrige
//   la faute ». — *« Je vais pouvoir lui parler comme ça et qu'elle
//   comprenne. »*
//
// ─────────────────────────────────────────────────────────────────────────
// CE QUE CE MODULE FAIT, ET CE QU'IL REFUSE DE FAIRE.
//
// Il prend des RETOUCHES telles que le modèle les a comprises, et dit, pour
// chacune, **sur quelle ligne elle tombe** — ou pourquoi elle ne tombe nulle
// part. Il n'applique rien : c'est l'écran qui montre, et le patron qui
// tranche (`CLAUDE.md` §4).
//
// **Aucun prix ne s'invente, jamais.** « Ajoute le broyage » sans montant rend
// une ligne dont le prix est `null` — et l'écran la signale. Le jour où ce
// module devinerait « le prix habituel du broyage », un devis partirait chez un
// client avec un chiffre que personne n'a dit.
//
// **Une désignation qu'on ne sait pas résoudre n'est jamais devinée au hasard.**
// Deux lignes qui se ressemblent autant l'une que l'autre rendent
// `ambigu` : mieux vaut demander que retirer la mauvaise ligne d'un devis.
// ─────────────────────────────────────────────────────────────────────────

import { LIBELLE_REDUCTION, libelleReduction, pourcentValide } from "./reduction-devis";

/** Une ligne du devis, telle que l'écran la tient. */
export type LigneDevis = {
  id: string;
  libelle: string;
  quantite: string;
  prixUnitaire: string;
};

/**
 * Comment le patron a désigné une ligne.
 *
 * Les deux peuvent être données : « supprime la deuxième, le broyage » — et
 * elles se confirment alors l'une l'autre. Quand elles se contredisent, **le
 * libellé gagne** : on se trompe plus souvent de rang que de nom, surtout après
 * avoir soi-même ajouté une ligne entre-temps.
 */
export type Cible = {
  /** Le rang tel qu'il le compte : 1 = la première ligne du devis. */
  rang?: number | null;
  /** Le nom qu'il a dit, approximatif — « fondage du bois » pour « fendage ». */
  libelle?: string | null;
};

export type Retouche =
  | { type: "prix"; cible: Cible; prixUnitaire: string }
  | { type: "quantite"; cible: Cible; quantite: string }
  /** Renommer, corriger une faute, remplacer un mot par un autre. */
  | { type: "libelle"; cible: Cible; libelle: string }
  | { type: "retirer"; cible: Cible }
  | { type: "ajouter"; libelle: string; quantite: string | null; prixUnitaire: string | null }
  /**
   * Le prix accordé au client — « fais cinq pour cent sur le montant du devis ».
   *
   * *Sa demande du 16 août 2026.* **Elle ne vise aucune ligne** : c'est le
   * document entier qu'elle touche, d'où l'absence de `cible`. `pourcent` à
   * `null` retire la réduction — « finalement, enlève la remise ».
   */
  | { type: "reduction"; pourcent: string | null };

/** Ce que l'écran affichera : la retouche, et la ligne sur laquelle elle tombe. */
export type RetoucheResolue =
  | { etat: "ok"; retouche: Retouche; ligne: LigneDevis | null }
  | { etat: "introuvable"; retouche: Retouche; dit: string }
  | { etat: "ambigu"; retouche: Retouche; dit: string; candidates: LigneDevis[] };

/**
 * Sans accents, sans casse, sans ponctuation, espaces réduits.
 *
 * **Les accents surtout** : une transcription rend « evacuation » aussi souvent
 * qu'« évacuation », et refuser l'un des deux ferait échouer une désignation
 * parfaitement claire à l'oreille.
 */
export function normaliser(texte: string): string {
  return texte
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/**
 * La distance d'édition, bornée — combien de lettres séparent deux mots.
 *
 * **Elle existe pour « fondage » contre « fendage ».** C'est son exemple à lui,
 * et c'est le cas le plus courant : une syllabe avalée par le micro ou par la
 * transcription. Sans elle, la retouche la plus naturelle du monde tomberait
 * dans « introuvable ».
 */
function distance(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  let precedente = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const courante = [i];
    for (let j = 1; j <= b.length; j++) {
      courante[j] = Math.min(
        precedente[j] + 1,
        courante[j - 1] + 1,
        precedente[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)
      );
    }
    precedente = courante;
  }
  return precedente[b.length];
}

/**
 * De 0 (rien à voir) à 1 (le même texte).
 *
 * **Le contenu prime sur la longueur.** « le prix de la taille de haie »
 * désigne « Taille de haie — 12 m » : l'un est contenu dans l'autre, et une
 * distance d'édition brute les déclarerait éloignés parce que l'un est trois
 * fois plus long. On regarde donc d'abord l'inclusion, puis la distance.
 */
export function ressemblance(dit: string, libelle: string): number {
  const a = normaliser(dit);
  const b = normaliser(libelle);
  if (!a || !b) return 0;
  if (a === b) return 1;
  if (b.includes(a) || a.includes(b)) return 0.92;

  // Mot à mot : « broyage branches » retrouve « Broyage des branches » même si
  // le patron saute les petits mots, ce qu'on fait tous en dictant.
  const motsA = a.split(" ").filter((m) => m.length > 2);
  const motsB = b.split(" ").filter((m) => m.length > 2);
  if (motsA.length && motsB.length) {
    const communs = motsA.filter((m) =>
      motsB.some((n) => n === m || distance(m, n) <= (m.length > 5 ? 2 : 1))
    ).length;
    const part = communs / Math.max(motsA.length, motsB.length);
    if (part >= 0.5) return 0.55 + part * 0.35;
  }

  const d = distance(a, b);
  return Math.max(0, 1 - d / Math.max(a.length, b.length));
}

/** En deçà, on ne prétend pas avoir reconnu la ligne. */
export const SEUIL_RECONNAISSANCE = 0.55;

/**
 * Deux candidates séparées de moins que ça sont **indiscernables**.
 *
 * Le devis d'un artisan porte souvent « Élagage — chêne » et « Élagage —
 * frêne » : « modifie l'élagage » ne désigne alors rien, et choisir la première
 * parce qu'elle arrive en tête serait retirer la mauvaise ligne une fois sur
 * deux.
 */
const ECART_AMBIGU = 0.08;

/** Où tombe une désignation, avant qu'on sache ce qu'elle veut changer. */
export type CibleResolue =
  | { etat: "ok"; ligne: LigneDevis }
  | { etat: "introuvable" }
  | { etat: "ambigu"; candidates: LigneDevis[] };

/**
 * Sur quelle ligne tombe une désignation.
 *
 * **Le rang seul suffit** — c'est ce qu'il dit le plus souvent (« la deuxième
 * ligne ») et c'est sans équivoque tant qu'on compte comme lui : 1 pour la
 * première. Hors bornes, on ne se rabat pas sur la dernière : on rend
 * `introuvable`.
 */
export function resoudreCible(
  lignes: readonly LigneDevis[],
  cible: Cible
): CibleResolue {
  const dit = (cible.libelle ?? "").trim();

  if (dit) {
    const notes = lignes
      .map((ligne) => ({ ligne, note: ressemblance(dit, ligne.libelle) }))
      .filter((c) => c.note >= SEUIL_RECONNAISSANCE)
      .sort((a, b) => b.note - a.note);

    if (notes.length === 1) return { etat: "ok", ligne: notes[0].ligne };
    if (notes.length > 1) {
      if (notes[0].note - notes[1].note > ECART_AMBIGU) return { etat: "ok", ligne: notes[0].ligne };
      // **Le rang départage** quand il a dit les deux : « la deuxième, le
      // broyage ». C'est le seul cas où il sert face à un nom.
      const parRang = rangValide(lignes, cible.rang);
      if (parRang && notes.some((c) => c.ligne.id === parRang.id)) {
        return { etat: "ok", ligne: parRang };
      }
      return {
        etat: "ambigu",
        candidates: notes.filter((c) => notes[0].note - c.note <= ECART_AMBIGU).map((c) => c.ligne),
      };
    }
    // Un nom dit mais reconnu nulle part : on ne se rabat PAS sur le rang.
    // Il a nommé quelque chose ; se tromper de ligne serait pire que demander.
    return { etat: "introuvable" };
  }

  const parRang = rangValide(lignes, cible.rang);
  return parRang ? { etat: "ok", ligne: parRang } : { etat: "introuvable" };
}

function rangValide(lignes: readonly LigneDevis[], rang: number | null | undefined): LigneDevis | null {
  if (rang == null || !Number.isFinite(rang)) return null;
  const i = Math.trunc(rang);
  return i >= 1 && i <= lignes.length ? lignes[i - 1] : null;
}

/**
 * Un montant tel que le modèle a pu l'écrire, remis en chiffres.
 *
 * **La virgule d'abord** : il dit « trois cent cinquante », le modèle rend
 * « 350,00 » aussi souvent que « 350.00 », et parfois « 350 € ». Les trois
 * valent le même prix, et refuser deux d'entre elles ferait perdre la retouche
 * la plus banale du devis.
 *
 * Rend `null` sur tout ce qui n'est pas un nombre : **mieux vaut une ligne sans
 * prix qu'un prix inventé** (`CLAUDE.md` §4). « à voir », « le prix habituel »,
 * « environ 500 » côté centaines — rien de tout cela n'est un montant, et
 * l'écran dira que la ligne arrive vide.
 */
export function montantDicte(valeur: unknown): string | null {
  if (typeof valeur === "number") return Number.isFinite(valeur) ? String(valeur) : null;
  if (typeof valeur !== "string") return null;
  const nettoye = valeur
    .replace(/[€\s ]/g, "")
    .replace(/,/g, ".")
    .trim();
  if (!/^-?\d+(\.\d+)?$/.test(nettoye)) return null;
  return nettoye;
}

/**
 * Ce que le modèle a répondu, ramené à des retouches — ou jeté.
 *
 * **Rien n'est toléré au bénéfice du doute.** Une entrée dont le type est
 * inconnu, une modification de prix sans montant lisible, un ajout sans nom :
 * on l'écarte plutôt que d'en faire une retouche approximative. Le patron verra
 * qu'il manque un changement et le redira ; il ne verra pas, en revanche, qu'un
 * chiffre a été mal repris — c'est ce déséquilibre-là qui décide.
 *
 * **Le seul champ qui a le droit d'être vide, c'est le prix d'un ajout.** Il en
 * a fait sa phrase : « rajoute-moi une ligne, broyage des branches » peut très
 * bien s'arrêter là, et la ligne arrive alors à chiffrer.
 */
export function lireRetouchesDuModele(brut: unknown): Retouche[] {
  const liste = Array.isArray(brut)
    ? brut
    : brut && typeof brut === "object" && Array.isArray((brut as { retouches?: unknown }).retouches)
      ? ((brut as { retouches: unknown[] }).retouches as unknown[])
      : [];

  const retouches: Retouche[] = [];
  for (const entree of liste) {
    if (!entree || typeof entree !== "object") continue;
    const e = entree as Record<string, unknown>;
    const texte = (cle: string): string | null => {
      const v = e[cle];
      return typeof v === "string" && v.trim() ? v.trim() : null;
    };
    const cible: Cible = {
      rang: typeof e.rang === "number" && Number.isFinite(e.rang) ? Math.trunc(e.rang) : null,
      libelle: texte("cible"),
    };

    switch (e.type) {
      case "prix": {
        const prix = montantDicte(e.prixUnitaire);
        if (prix !== null) retouches.push({ type: "prix", cible, prixUnitaire: prix });
        break;
      }
      case "quantite": {
        const q = montantDicte(e.quantite);
        if (q !== null) retouches.push({ type: "quantite", cible, quantite: q });
        break;
      }
      case "libelle": {
        const libelle = texte("libelle");
        if (libelle) retouches.push({ type: "libelle", cible, libelle });
        break;
      }
      case "retirer":
        if (cible.libelle || cible.rang != null) retouches.push({ type: "retirer", cible });
        break;
      case "reduction": {
        // **Le pourcentage passe par la règle du devis, pas par la mienne** :
        // les bornes et l'arrondi vivent dans `reduction-devis.ts`, et deux
        // écritures de la même borne finiraient par diverger.
        const dit = e.pourcent;
        // « enlève la remise » : le modèle rend explicitement null, et c'est un
        // ordre valable — à ne pas confondre avec un pourcentage illisible.
        if (dit === null) {
          retouches.push({ type: "reduction", pourcent: null });
          break;
        }
        const p = pourcentValide(dit);
        if (p !== null) retouches.push({ type: "reduction", pourcent: p });
        break;
      }
      case "ajouter": {
        const libelle = texte("libelle");
        if (libelle) {
          retouches.push({
            type: "ajouter",
            libelle,
            quantite: montantDicte(e.quantite),
            prixUnitaire: montantDicte(e.prixUnitaire),
          });
        }
        break;
      }
    }
  }
  return retouches;
}

/**
 * Toutes les retouches, résolues dans l'ordre où il les a dites.
 *
 * **Les lignes ne bougent pas d'une retouche à l'autre.** « Supprime la
 * deuxième et modifie la troisième » se lit sur le devis TEL QU'IL LE VOIT,
 * pas sur celui qu'on obtiendrait après le premier retrait — c'est ainsi qu'il
 * compte, l'écran sous les yeux.
 */
export function resoudreRetouches(
  lignes: readonly LigneDevis[],
  retouches: readonly Retouche[]
): RetoucheResolue[] {
  return retouches.map((retouche) => {
    if (retouche.type === "ajouter" || retouche.type === "reduction") {
      return { etat: "ok", retouche, ligne: null };
    }

    const r = resoudreCible(lignes, retouche.cible);
    const dit = (retouche.cible.libelle ?? "").trim() || `ligne n° ${retouche.cible.rang ?? "?"}`;
    if (r.etat === "ok") return { etat: "ok", retouche, ligne: r.ligne };
    if (r.etat === "ambigu") return { etat: "ambigu", retouche, dit, candidates: r.candidates };
    return { etat: "introuvable", retouche, dit };
  });
}

/**
 * Un changement prêt à être appliqué : une ligne désignée par son identifiant,
 * et ce qu'on y écrit.
 *
 * **Il n'existe pas de `Changement` ambigu ni introuvable** — c'est tout
 * l'intérêt de ce type. Ce qui n'a pas su tomber sur une ligne ne peut pas,
 * par construction, arriver jusqu'à l'enregistrement.
 */
export type Changement =
  | { type: "reduction"; pourcent: string | null }
  | { type: "prix"; ligneId: string; prixUnitaire: string }
  | { type: "quantite"; ligneId: string; quantite: string }
  | { type: "libelle"; ligneId: string; libelle: string }
  | { type: "retirer"; ligneId: string }
  | { type: "ajouter"; libelle: string; quantite: string | null; prixUnitaire: string | null };

/**
 * Ce qu'une retouche donnera si le patron la coche — ou `null` si elle ne peut
 * rien donner.
 *
 * **La même fonction sert à l'écran et à l'enregistrement** (`CLAUDE.md` §3) :
 * une ligne barrée que la confirmation proposerait mais que le serveur
 * refuserait, ou l'inverse, sont deux règles qui finiraient par diverger. Ici,
 * ce qui n'est pas applicable ne s'affiche pas comme cochable.
 */
export function changementApplicable(r: RetoucheResolue): Changement | null {
  // La réduction ne tombe sur aucune ligne : elle vise le devis entier.
  if (r.retouche.type === "reduction") return { type: "reduction", pourcent: r.retouche.pourcent };
  if (r.retouche.type === "ajouter") {
    const { libelle, quantite, prixUnitaire } = r.retouche;
    return { type: "ajouter", libelle, quantite, prixUnitaire };
  }
  if (r.etat !== "ok" || !r.ligne) return null;

  const ligneId = r.ligne.id;
  switch (r.retouche.type) {
    case "prix":
      return { type: "prix", ligneId, prixUnitaire: r.retouche.prixUnitaire };
    case "quantite":
      return { type: "quantite", ligneId, quantite: r.retouche.quantite };
    case "libelle":
      return { type: "libelle", ligneId, libelle: r.retouche.libelle };
    case "retirer":
      return { type: "retirer", ligneId };
  }
}

/**
 * Ce qu'une retouche va changer, en toutes lettres — pour l'écran de
 * confirmation.
 *
 * Écrit ici et pas dans l'écran : c'est la même phrase qui devra un jour être
 * relue dans un journal ou une notification, et deux rédactions du même
 * changement finiraient par se contredire.
 */
export function direRetouche(r: RetoucheResolue): { verbe: string; quoi: string; detail: string } {
  const t = r.retouche;
  if (t.type === "reduction") {
    return t.pourcent === null
      ? {
          verbe: "Retirer",
          quoi: LIBELLE_REDUCTION,
          detail: "Le devis repart à son prix plein",
        }
      : {
          verbe: "Accorder",
          quoi: libelleReduction(t.pourcent) ?? LIBELLE_REDUCTION,
          detail: "Appliqué au total HT — la TVA suit",
        };
  }
  if (t.type === "ajouter") {
    return {
      verbe: "Ajouter",
      quoi: t.libelle,
      detail:
        t.prixUnitaire == null
          ? "Aucun prix dicté — la ligne arrive vide, à vous de la chiffrer"
          : `${t.prixUnitaire} €${t.quantite ? ` × ${t.quantite}` : ""}`,
    };
  }

  if (r.etat !== "ok" || !r.ligne) {
    return {
      verbe: r.etat === "ambigu" ? "À préciser" : "Non trouvé",
      quoi: r.etat === "ok" ? "" : r.dit,
      detail:
        r.etat === "ambigu"
          ? `Plusieurs lignes y répondent : ${r.candidates.map((c) => c.libelle).join(", ")}`
          : "Aucune ligne de ce devis ne porte ce nom",
    };
  }

  switch (t.type) {
    case "prix":
      return {
        verbe: "Changer le prix",
        quoi: r.ligne.libelle,
        detail: `${r.ligne.prixUnitaire} € → ${t.prixUnitaire} €`,
      };
    case "quantite":
      return {
        verbe: "Changer la quantité",
        quoi: r.ligne.libelle,
        detail: `${r.ligne.quantite} → ${t.quantite}`,
      };
    case "libelle":
      return { verbe: "Corriger", quoi: r.ligne.libelle, detail: `→ ${t.libelle}` };
    case "retirer":
      return {
        verbe: "Retirer",
        quoi: r.ligne.libelle,
        detail: `${r.ligne.prixUnitaire} € — la ligne part du devis`,
      };
  }
}
