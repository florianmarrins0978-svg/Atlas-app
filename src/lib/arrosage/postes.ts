import { CATALOGUE } from "./catalogue.js";
import type { Dessin, ReseauDessine, Tete, ZoneDessinee } from "./plan-dessine";
import { piecesDuPlan, type LigneCalcul } from "./pieces";
import { photoDe } from "./photos";
import type { PieceChoisie, Retouches } from "./retouches";
import type { LePlan } from "./le-plan";
import { ROBINET, departRetenu, nomDuTuyau, type Depart, type Montage } from "./robinet";

/**
 * LES PIÈCES POSÉES — chaque pièce du plan à sa place, avec sa photo, et ce
 * qu'il en a fait.
 *
 * C'est le cœur de l'écran qu'il a validé le 18 octobre 2026
 * (`appli/arrosage-plan.html`) : *« si le jardin c'est un carré, tu remets le
 * plan avec un carré et les pièces au bon endroit »*. Chaque tête porte son
 * té ou son coude taraudé (plein ou creux sur le dessin, donc LU sur le dessin)
 * et son arroseur ; le té égal se pose SUR le croisement ; les SBE et le PEBD
 * de chaque tête comptent dans la liste et se montrent une fois, dans la
 * chaîne d'une tête, sous le plan.
 *
 * **Tout est compté en posant, et rien n'est recopié.** La planche comptait
 * pendant qu'elle dessinait ; ici la même marche produit une structure que
 * l'écran dessine et que la liste lit : les postes, et le compte par groupe.
 * Une pièce supprimée reste à sa place, barrée ; une pièce changée compte sa
 * remplaçante ; une pièce ajoutée entre dans son groupe. Les clés des postes
 * sont celles des retouches (`retouches.ts`).
 *
 * **La place d'un té ou d'un coude sort du CALCUL, pas de l'écran** : `plein`
 * et `jonctions` viennent de `plan-dessine.ts`, et `pieces.ts` compte les
 * mêmes raccords sur les mêmes têtes. Un contrôle confronte les deux.
 */

export type Poste = {
  cle: string;
  ref: string;
  nom: string;
  /** Ce que la vignette écrit sous la photo. */
  detail: string;
  q: number;
  u: "u" | "ml";
  photo: string | null;
  /** La photo de la buse, au pied d'une tuyère. */
  pied: string | null;
  retiree: boolean;
  changee: PieceChoisie | null;
  ajoutee: boolean;
};

export type Ligne = { nom: string; q: number; u: string; nomCourt?: string; enMoins?: number };
/** Le compte par groupe (`amenee`, `sonde`, `r0`, `r1`…), puis par référence. */
export type Compte = Record<string, Record<string, Ligne>>;

export type Maillon = {
  type: "raccord" | "sbeb" | "pebd" | "sbeh" | "corps";
  /** Les clés de cette pièce sur chaque tête du réseau : toucher la chaîne les vise toutes. */
  cles: string[];
  libelle: string;
  photo: string | null;
  pied: string | null;
  etat: "" | "retiree" | "changee";
};

export type PosePlan = {
  /** En pourcentage du cadre : la place vraie de la tête. */
  gauche: number;
  haut: number;
  /** Le té égal posé SUR le croisement ; les autres pièces descendent alors juste dessous. */
  egal: Poste | null;
  pieces: Poste[];
};

export type PlanDesPieces = {
  largeur: number;
  hauteur: number;
  contours: string[];
  traits: { x1: number; y1: number; x2: number; y2: number }[];
  antennes: { x1: number; y1: number; x2: number; y2: number }[];
  poses: PosePlan[];
};

export type ReseauPostes = {
  i: number;
  nom: string;
  couleur: string;
  goutte: boolean;
  /** Le PEHD Ø25 du réseau, mesuré sur le tracé, ou « à mesurer » pour un goutte-à-goutte. */
  pe: Poste;
  metres: string;
  plan: PlanDesPieces | null;
  /** « Sur ce plan : 9x turbine 3504, 6x té taraudé… », lu sur ce que le plan vient de poser. */
  compteDuPlan: string | null;
  chaine: Maillon[] | null;
  /** Le rail d'un goutte-à-goutte : coude taraudé, té ou coude Palaplast, couronnes, bouchon. */
  rail: Poste[];
  /** Le tube du goutte-à-goutte, tel que le catalogue le décrit (« 2 l/h tous les 33 cm »), sinon `null`. */
  tube: string | null;
  ajoutees: Poste[];
};

export type Postes = {
  amenee: Poste[];
  sonde: Poste | null;
  teflon: Poste | null;
  grillage: { q: number; nom: string; detail: string } | null;
  reseaux: ReseauPostes[];
  compte: Compte;
};

type Cat = {
  piece(ref: string): { nom: string; marque?: string } | null;
  piecesReseau: Record<string, { nom: string; marque?: string }>;
  pieceAjoutable(ref: string): { ref: string; nom: string } | null;
  coudes: { ref: string; nom: string; detail: string; filetage: string }[];
  corps: { ref: string; nom: string; filetage: string; pourType: string }[];
  buses: { ref: string; nom: string; colisage?: number }[];
  corpsDeLaBuse(buse: unknown): { ref: string; nom: string; filetage: string } | null;
  gaines: { ref: string; nom: string; detail: string }[];
  materiel: { ref: string; nom: string; regle?: string }[];
  referenceDe(ref: string): string | null;
  ficheNourrice(n: number, goutte: number): { nom: string; pieces: { ref: string; q: number }[] } | null;
};
const CAT = CATALOGUE as unknown as Cat;

const TE_LIGNE = "te-taraude-25-34-25";
const COUDE_LIGNE = "coude-taraude-25-34";
const TE_EGAL = "te-25-25-25";
const PEBD16 = "pebd16";
const GRILLAGE = "grillage-bleu";
const TEFLON = "BDV999";
const TUBE_TORO = "UGGCBL23050";
const JONCTION_16 = "MID6301";
const TE_PALAPLAST = "MID6321";
const COUDE_PALAPLAST = "MID6341";
const BOUCHON_PALAPLAST = "MID6371";

/** Le nom d'une pièce : celui que le calcul a écrit sur sa ligne, sinon celui du catalogue. */
export function nomDe(ref: string, materiel: LigneCalcul[]): string {
  const l = materiel.find((m) => m.ref === ref);
  if (l) return l.nom;
  const p = CAT.piece(ref) ?? CAT.piecesReseau[ref] ?? CAT.pieceAjoutable(ref);
  return p ? (("marque" in p && p.marque ? `${p.marque} ` : "") + p.nom) : ref;
}

/** Sur un robinet : le montage qu'il a choisi, la double sortie, et le tuyau qui part (`null` : celui que l'outil choisit). */
export type Robinet = { montage: Montage; double: boolean; depart: Depart | null };

export type EntreePostes = {
  plan: LePlan;
  dessin: Dessin | null;
  compteur: boolean;
  /** L'amenée calculée sur le croquis, ou `null` quand elle n'a pas pu l'être. */
  amenee: number | null;
  /** Le montage au robinet ; `null` au compteur. */
  robinet?: Robinet | null;
  retouches: Retouches;
};

/** Le titre du premier groupe de la liste : d'où part l'eau, et jusqu'où. */
export function titreDuDepart(compteur: boolean, robinet: Robinet | null | undefined): string {
  if (compteur) return "Du compteur à la nourrice";
  return robinet?.montage === "nez" ? "Au robinet" : "Du robinet à la nourrice";
}

export function composerLesPostes({ plan, dessin, compteur, amenee, robinet = null, retouches: r }: EntreePostes): Postes {
  const M = plan.materiel;
  const compte: Compte = {};
  let groupe = "amenee";
  const ligneDe = (ref: string, nom: string, u: string): Ligne => {
    const g = (compte[groupe] = compte[groupe] ?? {});
    return (g[ref] = g[ref] ?? { nom, q: 0, u });
  };
  const piece = (cle: string, ref: string, nom: string, detail: string): Poste => {
    const changee = r.remplacees[cle] ?? null;
    const montree = changee ? changee.ref : ref;
    return {
      cle, ref: montree, nom: changee ? changee.nom : nom, detail: changee ? changee.nom : detail,
      q: 1, u: "u", photo: photoDe(montree), pied: null,
      retiree: Boolean(r.retirees[cle]), changee, ajoutee: cle.startsWith("plus:"),
    };
  };
  /** Poser compte la pièce dans le groupe courant, sauf supprimée ; une remplaçante compte pour une. */
  const poser = (cle: string, ref: string, nom: string, detail: string, q?: number, u: "u" | "ml" = "u"): Poste => {
    const changee = r.remplacees[cle];
    if (!r.retirees[cle]) {
      const l = ligneDe(changee ? changee.ref : ref, changee ? changee.nom : nom, changee ? "u" : u);
      l.q += changee || q === undefined ? 1 : q;
    }
    const p = piece(cle, ref, nom, detail);
    return { ...p, q: q ?? 1, u };
  };
  const tuyere = (cle: string, corps: { ref: string; nom: string }, buse: { ref: string; nom: string; colisage?: number }): Poste => {
    const p = poser(cle, corps.ref, corps.nom, `${corps.nom.replace("Tuyère ", "")} et ${buse.nom}`);
    if (!r.retirees[cle] && !r.remplacees[cle]) {
      ligneDe(buse.ref, `Rain Bird Tuyères ${buse.nom}${buse.colisage ? `, par ${buse.colisage}` : ""}`, "u").q += 1;
    }
    return r.remplacees[cle] ? p : { ...p, pied: photoDe(buse.ref) };
  };
  const ajoutees = (ou: string): Poste[] =>
    r.ajoutees.filter((a) => a.ou === ou).map((a) => poser(`plus:${a.n}`, a.ref, a.nom, "ajoutée", 1));

  // ── La sonde de pluie, posée au-dessus de la nourrice, comptée avec elle ──
  groupe = "sonde";
  let sonde: Poste | null = null;
  if (r.sonde) {
    const option = CAT.materiel.find((x) => x.regle === "option");
    if (option) sonde = poser("nr:sonde", option.ref, option.nom, option.nom, 1);
  }

  // ── Du piquage à la nourrice : les lignes que le calcul a déjà écrites ──
  groupe = "amenee";
  const amenees: Poste[] = [];
  if (robinet && !compteur) {
    // **LE MONTAGE AU ROBINET, pièce sous pièce** (sa planche du 18 octobre
    // 2026) : la double sortie s'il la veut, le programmateur au nez de
    // robinet, le raccord du tuyau qui part, le tuyau. Ces pièces ne sont pas
    // au calcul : elles se posent ici, et la liste les compte comme les autres.
    const nez = robinet.montage === "nez";
    const depart = departRetenu(plan, robinet.depart);
    const rac = ROBINET.raccord[depart];
    const tuyau = nomDuTuyau(depart);
    if (robinet.double) amenees.push(poser("am:double", ROBINET.double.ref, ROBINET.double.nom, "Double sortie", 1));
    if (nez) amenees.push(poser("am:prog", ROBINET.programmateur.ref, ROBINET.programmateur.nom, "Programmateur nez de robinet", 1));
    amenees.push(poser("am:raccord", rac.ref, rac.nom, rac.nom, 1));
    // Au nez de robinet, le tuyau va jusqu'au réseau et sa longueur n'est pas
    // comptée ; avec la nourrice, c'est l'amenée calculée sur le croquis.
    const metres = nez ? null : amenee !== null ? Math.ceil(amenee) : null;
    amenees.push(poser("am:pe", "pe25-amenee", `${tuyau}, ${nez ? "du robinet au réseau" : "du robinet à la nourrice"}`, metres !== null ? `${tuyau}, ${metres} m` : `${tuyau}, à mesurer`, metres ?? 0, "ml"));
  } else {
    for (const l of plan.pieces.filter((p) => p.ou === "amenee")) {
      if (l.ref === TE_EGAL) amenees.push(poser("am:te", TE_EGAL, nomDe(TE_EGAL, M), "Té égal au compteur", 1));
      else if (l.ref === "pe25-amenee") amenees.push(poser("am:pe", "pe25-amenee", l.nom, l.q !== null ? `${l.nom}, ${l.q} m` : `${l.nom}, à mesurer`, l.q ?? 0, "ml"));
    }
    // Le té égal d'abord, comme on pose : il coupe la ligne avant tout tuyau.
    amenees.sort((a, b) => (a.cle === "am:te" ? -1 : b.cle === "am:te" ? 1 : 0));
  }
  // Le téflon entre avec le montage du départ : un rouleau (sa demande du 18 octobre 2026).
  let teflon: Poste | null = null;
  if (r.teflon) {
    const t = CAT.pieceAjoutable(TEFLON);
    if (t) teflon = poser("op:teflon", TEFLON, t.nom, t.nom, 1);
  }
  amenees.push(...ajoutees("amenee"));

  // ── Les réseaux ─────────────────────────────────────────────────────────
  const corpsTuyere = CAT.corps.find((c) => c.pourType === "tuyere" && M.some((m) => m.ref === c.ref)) ?? null;
  const sbeBas = CAT.coudes.find((c) => c.filetage === "3/4") ?? null;
  const reseaux: ReseauPostes[] = plan.secteurs.map((s, i) => {
    const rd = dessin?.reseaux.find((x) => x.numero === i) ?? null;
    groupe = `r${i}`;
    const goutte = s.famille === "Goutte-à-goutte";
    if (goutte || !rd) {
      // Le calcul ne trace pas la ligne d'un goutte-à-goutte : sa longueur reste « à mesurer ».
      const metres = rd ? `${rd.metresTuyau} m` : "à mesurer";
      const pe = poser(`r${i}:pe`, "pe25", "PEHD Ø25", `PEHD Ø25, ${metres}`, rd ? rd.metresTuyau : 0, "ml");
      const rail: Poste[] = [poser(`r${i}:coude`, COUDE_LIGNE, nomDe(COUDE_LIGNE, M), "Coude taraudé")];
      rail.push(r.sortie === "ligne"
        ? poser(`r${i}:coude16`, COUDE_PALAPLAST, nomDe(COUDE_PALAPLAST, M), "coude Palaplast Ø16")
        : poser(`r${i}:te16`, TE_PALAPLAST, nomDe(TE_PALAPLAST, M), "té Palaplast Ø16"));
      const n = M.find((m) => m.ref === TUBE_TORO)?.q ?? 0;
      const j = M.find((m) => m.ref === JONCTION_16)?.q ?? 0;
      for (let c = 0; c < n; c++) {
        if (c > 0 && c <= j) rail.push(poser(`r${i}:jonction${c}`, JONCTION_16, nomDe(JONCTION_16, M), "jonction Palaplast Ø16"));
        rail.push(poser(`r${i}:couronne${c}`, TUBE_TORO, nomDe(TUBE_TORO, M), `tube Toro, couronne de ${r.couronne} m`));
      }
      if (r.sortie === "ligne") rail.push(poser(`r${i}:bouchon`, BOUCHON_PALAPLAST, nomDe(BOUCHON_PALAPLAST, M), "bouchon Palaplast Ø16"));
      const tube = goutte ? CAT.gaines[0]?.detail ?? null : null;
      return { i, nom: s.nom, couleur: plan.couleurs[i], goutte: true, pe, metres, plan: null, compteDuPlan: null, chaine: null, rail, tube, ajoutees: ajoutees(`r${i}`) };
    }
    const pe = poser(`r${i}:pe`, "pe25", "PEHD Ø25", `PEHD Ø25, ${rd.metresTuyau} m`, rd.metresTuyau, "ml");
    const { plan: planPieces, chaine } = planDesPieces(rd, i);
    return { i, nom: s.nom, couleur: plan.couleurs[i], goutte: false, pe, metres: `${rd.metresTuyau} m`, plan: planPieces, compteDuPlan: compteDuPlan(i), chaine, rail: [], tube: null, ajoutees: ajoutees(`r${i}`) };
  });

  /** La zone du calcul qui pose cette tête à ce point, pour ce réseau. */
  function zoneDeLaTete(t: Tete, i: number): ZoneDessinee | undefined {
    return plan.dessinDuCalcul.find((z) => z.points?.some((q) => q.reseau === i && Math.abs(q.x - t.x) < 1e-6 && Math.abs(q.y - t.y) < 1e-6));
  }

  function planDesPieces(rd: ReseauDessine, i: number): { plan: PlanDesPieces; chaine: Maillon[] | null } {
    const pts = [...rd.tetes.map((q) => ({ x: q.x, y: q.y })), ...rd.jonctions];
    const x0 = Math.min(...pts.map((q) => q.x)) - 1.6, x1 = Math.max(...pts.map((q) => q.x)) + 1.6;
    const y0 = Math.min(...pts.map((q) => q.y)) - 1.6, y1 = Math.max(...pts.map((q) => q.y)) + 1.6;
    const W = 100, H = ((y1 - y0) / (x1 - x0)) * W;
    const px = (x: number) => ((x - x0) / (x1 - x0)) * W, py = (y: number) => ((y - y0) / (x1 - x0)) * W;
    const contours = (dessin?.contours ?? []).map((c) => c.map((q) => `${px(q.x)},${py(q.y)}`).join(" "));
    const seg = (s: { de: { x: number; y: number }; a: { x: number; y: number } }) => ({ x1: px(s.de.x), y1: py(s.de.y), x2: px(s.a.x), y2: py(s.a.y) });
    const poses: PosePlan[] = [];
    const pris = new Set<number>();
    const cles: Record<Maillon["type"], string[]> = { raccord: [], sbeb: [], pebd: [], sbeh: [], corps: [] };
    let premiere: { corps: { ref: string; nom: string; filetage: string } | null; buse: { ref: string; nom: string } | null; sbeHaut: { ref: string; nom: string; detail: string; filetage: string } | null } | null = null;
    rd.tetes.forEach((q, j) => {
      const z = zoneDeLaTete(q, i);
      const buse = z ? CAT.buses.find((b) => b.nom === z.buse) ?? null : null;
      const corps = q.forme === "carre" ? corpsTuyere : buse ? CAT.corpsDeLaBuse(buse) : null;
      const k = `r${i}:t${j}`;
      const raccord = q.plein ? TE_LIGNE : COUDE_LIGNE;
      const sbeHaut = corps ? CAT.coudes.find((c) => c.filetage === corps.filetage) ?? null : null;
      if (!premiere) premiere = { corps, buse: q.forme === "carre" ? buse : null, sbeHaut };
      cles.raccord.push(`${k}:raccord`); cles.sbeb.push(`${k}:sbeb`); cles.pebd.push(`${k}:pebd`);
      if (sbeHaut) cles.sbeh.push(`${k}:sbeh`);
      if (corps) cles.corps.push(`${k}:corps`);
      const posteRaccord = poser(`${k}:raccord`, raccord, nomDe(raccord, M), q.plein ? "Té taraudé" : "Coude taraudé");
      // Comptés ici, montrés une fois dans la chaîne sous le plan.
      if (sbeBas) poser(`${k}:sbeb`, sbeBas.ref, `${sbeBas.nom}, ${sbeBas.detail}`, "SBE 3/4\"");
      poser(`${k}:pebd`, PEBD16, nomDe(PEBD16, M), "PEBD Ø16, 2 m", 2, "ml");
      if (sbeHaut) poser(`${k}:sbeh`, sbeHaut.ref, `${sbeHaut.nom}, ${sbeHaut.detail}`, `SBE ${sbeHaut.filetage}"`);
      const posteCorps = corps
        ? q.forme === "carre" && buse ? tuyere(`${k}:corps`, corps, buse) : poser(`${k}:corps`, corps.ref, corps.nom, z?.buse ?? corps.nom)
        : null;
      let n = -1;
      rd.jonctions.forEach((o, m) => { if (!pris.has(m) && Math.abs(o.x - q.x) + Math.abs(o.y - q.y) < 1.5) n = m; });
      const gauche = px(q.x), haut = (py(q.y) / H) * 100;
      if (n >= 0) {
        pris.add(n);
        // Le té égal SUR le croisement, l'arroseur à gauche du trait et le té taraudé à droite, juste dessous.
        const egal = poser(`r${i}:j${n}`, TE_EGAL, nomDe(TE_EGAL, M), "Té égal, la ligne se sépare");
        poses.push({ gauche, haut, egal, pieces: posteCorps ? [posteCorps, posteRaccord] : [posteRaccord] });
      } else {
        poses.push({ gauche, haut, egal: null, pieces: posteCorps ? [posteRaccord, posteCorps] : [posteRaccord] });
      }
    });
    rd.jonctions.forEach((o, m) => {
      if (pris.has(m)) return;
      poses.push({ gauche: px(o.x), haut: (py(o.y) / H) * 100, egal: poser(`r${i}:j${m}`, TE_EGAL, nomDe(TE_EGAL, M), "Té égal, la ligne se sépare"), pieces: [] });
    });

    // La chaîne d'une tête, « la B » : la photo montrée est celle de la remplaçante quand il a changé la pièce.
    const montre = (t: Maillon["type"], ref: string | null) => {
      const c = cles[t];
      const changee = c.length ? r.remplacees[c[0]] : undefined;
      return photoDe(changee ? changee.ref : ref);
    };
    const etatDe = (t: Maillon["type"]): Maillon["etat"] => {
      const c = cles[t];
      if (c.length && c.every((x) => r.retirees[x])) return "retiree";
      if (c.length && r.remplacees[c[0]]) return "changee";
      return "";
    };
    const p = premiere as { corps: { ref: string; nom: string } | null; buse: { ref: string; nom: string } | null; sbeHaut: { ref: string; filetage: string } | null } | null;
    const chaine: Maillon[] | null = p
      ? [
          { type: "raccord", cles: cles.raccord, libelle: "Té ou coude taraudé", photo: montre("raccord", TE_LIGNE), pied: null, etat: etatDe("raccord") },
          { type: "sbeb", cles: cles.sbeb, libelle: "SBE 3/4\" vissé sur le té ou le coude", photo: montre("sbeb", sbeBas?.ref ?? null), pied: null, etat: etatDe("sbeb") },
          { type: "pebd", cles: cles.pebd, libelle: "PEBD Ø16, 2 m, emboîté", photo: montre("pebd", PEBD16), pied: null, etat: etatDe("pebd") },
          { type: "sbeh", cles: cles.sbeh, libelle: `SBE ${p.sbeHaut?.filetage ?? ""}" vissé sous l’arroseur`, photo: p.sbeHaut ? montre("sbeh", p.sbeHaut.ref) : null, pied: null, etat: etatDe("sbeh") },
          { type: "corps", cles: cles.corps, libelle: p.corps ? p.corps.nom + (p.buse ? ` et sa buse ${p.buse.nom}` : "") : "", photo: p.corps ? montre("corps", p.corps.ref) : null, pied: p.buse ? photoDe(p.buse.ref) : null, etat: etatDe("corps") },
        ]
      : null;
    return {
      plan: { largeur: W, hauteur: H, contours, traits: rd.traits.map(seg), antennes: rd.antennes.map(seg), poses },
      chaine,
    };
  }

  /** « Sur ce plan : … » lit le compte du réseau, jamais un second calcul. */
  function compteDuPlan(i: number): string | null {
    const g = compte[`r${i}`] ?? {};
    const NOMS: Record<string, string> = { [TE_LIGNE]: "té taraudé", [COUDE_LIGNE]: "coude taraudé", [TE_EGAL]: "té égal" };
    const corps = new Set(CAT.corps.map((c) => c.ref));
    const parts = Object.keys(g).filter((ref) => corps.has(ref) && g[ref].q).map((ref) => `${g[ref].q}x ${g[ref].nom.charAt(0).toLowerCase()}${g[ref].nom.slice(1)}`);
    for (const ref of Object.keys(NOMS)) if (g[ref]?.q) parts.push(`${g[ref].q}x ${NOMS[ref]}`);
    return parts.length ? `Sur ce plan : ${parts.join(", ")}.` : null;
  }

  // ── Le grillage avertisseur : toute la tranchée, amenée comprise ────────
  let grillage: Postes["grillage"] = null;
  if (r.grillage && dessin) {
    const g = piecesDuPlan(M, dessin, { compteur, seuil25: plan.tuyau.seuil25, amenee, goutte: plan.goutteAGoutte, grillage: true }).find((x) => x.ref === GRILLAGE);
    if (g) grillage = { q: g.q ?? 1, nom: g.nom, detail: g.detail ?? "" };
  }

  return { amenee: amenees, sonde, teflon, grillage, reseaux, compte };
}

// ═══ LA LISTE : la nourrice, puis chaque réseau ═══════════════════════════════
//
// *« En premier la nourrice avec la liste des pièces, ensuite réseau 1, la
// liste des pièces, réseau 2… »* (18 octobre 2026), et pour le fournisseur,
// tout additionné : *« lui va devoir se faire chier à compter trois pour le
// réseau 1, trois pour le réseau 2 »*.

export type Groupe = { titre: string; couleur?: string; lignes: Record<string, Ligne>; retirees: Record<string, Ligne> };

/** La nourrice se compte sur SA fiche, comme le dessin du regard. */
export function groupeNourrice(plan: LePlan, postes: Postes, r: Retouches): { nom: string; lignes: Record<string, Ligne>; nombre: Record<string, number> } {
  const nbGoutte = plan.secteurs.filter((s) => s.famille === "Goutte-à-goutte").length;
  const fiche = CAT.ficheNourrice(plan.secteurs.length, nbGoutte);
  const g: Record<string, Ligne> = {};
  for (const x of fiche?.pieces ?? []) (g[x.ref] = g[x.ref] ?? { nom: nomDe(x.ref, []), q: 0, u: "u" }).q += x.q;
  // La sonde se compte comme elle est posée au-dessus du regard : changée ou supprimée, la liste suit.
  for (const [ref, l] of Object.entries(postes.compte.sonde ?? {})) g[ref] = l;
  const h: Record<string, Ligne> = {};
  for (const ref of Object.keys(g)) {
    if (r.retirees[`nr:${ref}`]) continue;
    const c = r.remplacees[`nr:${ref}`];
    if (c) { (h[c.ref] = h[c.ref] ?? { nom: c.nom, q: 0, u: "u" }).q += g[ref].q; continue; }
    // Plusieurs exemplaires dont il n'en change que quelques-uns : ceux-là sortent
    // du compte, et leur remplaçante entre dans la liste de la nourrice (`ajoutees`, `de`).
    const q = g[ref].q - (r.nrUne[ref] ?? 0);
    if (q > 0) h[ref] = { nom: g[ref].nom, q, u: g[ref].u };
  }
  const nombre: Record<string, number> = {};
  for (const ref of Object.keys(g)) nombre[ref] = g[ref].q;
  return { nom: fiche ? fiche.nom : "La nourrice", lignes: h, nombre };
}

export function groupesDeLaListe(plan: LePlan, postes: Postes, r: Retouches, compteur: boolean, robinet: Robinet | null = null): Groupe[] {
  const n = groupeNourrice(plan, postes, r);
  const out: Omit<Groupe, "retirees">[] = [{ titre: titreDuDepart(compteur, robinet), lignes: postes.compte.amenee ?? {} }];
  // Au programmateur en nez de robinet, il n'y a pas de nourrice : rien à compter pour elle.
  if (compteur || robinet?.montage !== "nez") out.push({ titre: n.nom, lignes: n.lignes });
  plan.secteurs.forEach((s, i) => out.push({ titre: `Réseau ${i + 1}, ${s.nom}`, couleur: plan.couleurs[i], lignes: postes.compte[`r${i}`] ?? {} }));
  // Le grillage couvre toute la tranchée : il se compte dans la liste de l'outil, pas réseau par réseau.
  if (postes.grillage) {
    out.push({ titre: "Pour toute la tranchée", lignes: { [GRILLAGE]: { nom: `${postes.grillage.nom}, ${postes.grillage.detail}`, nomCourt: postes.grillage.nom, q: postes.grillage.q, u: "u" } } });
  }
  // Ce qu'il a changé dans la liste : k pièces en moins sur une ligne de q, la
  // ligne reste avec q − k et le dit ; toutes en moins, elle passe aux retirées ;
  // les pièces ajoutées entrent au nombre choisi.
  return out.map((g) => {
    const lignes: Record<string, Ligne> = {}, retirees: Record<string, Ligne> = {};
    for (const ref of Object.keys(g.lignes)) {
      const e = g.lignes[ref], k = r.listeRetirees[`${g.titre}|${ref}`] ?? 0;
      if (k >= e.q || (k > 0 && e.u === "ml")) retirees[ref] = e;
      else if (k > 0) lignes[ref] = { nom: e.nom, q: e.q - k, u: e.u, enMoins: k };
      else lignes[ref] = e;
    }
    for (const a of r.ajoutees.filter((a) => a.ou === `liste:${g.titre}`)) {
      (lignes[a.ref] = lignes[a.ref] ?? { nom: a.nom, q: 0, u: "u" }).q += a.q;
    }
    return { titre: g.titre, couleur: g.couleur, lignes, retirees };
  });
}

/** Le nom pour le comptoir : la marque devant, et la référence quand elle a été relevée (jamais inventée). */
function nomFournisseur(ref: string, nom: string, materiel: LigneCalcul[]): string {
  // La référence est celle que le calcul a posée sur la ligne : une couronne de
  // 100 m n'a pas celle de la couronne de 50 m d'Aqua Plus.
  const ligne = materiel.find((l) => l.ref === ref);
  const p = CAT.piece(ref) ?? CAT.piecesReseau[ref];
  const marque = p?.marque;
  const reference = ligne ? ligne.reference : CAT.referenceDe(ref);
  return (marque && !nom.includes(marque) ? `${marque} ` : "") + nom + (reference ? `, réf. ${reference}` : "");
}

/** Le message au fournisseur : tout additionné, sans prix. */
export function messageAuFournisseur(groupes: Groupe[], materiel: LigneCalcul[]): string {
  const total: Record<string, { nom: string; q: number; u: string; inconnu: boolean }> = {};
  const ordre: string[] = [];
  for (const g of groupes) {
    for (const [ref, e] of Object.entries(g.lignes)) {
      if (!total[ref]) { total[ref] = { nom: e.nomCourt ?? e.nom, q: 0, u: e.u, inconnu: false }; ordre.push(ref); }
      total[ref].q += e.q;
      // Une longueur qu'un réseau ne donne pas ne disparaît pas dans la somme.
      if (e.u === "ml" && !e.q) total[ref].inconnu = true;
    }
  }
  const lignes = ordre.map((ref) => {
    const e = total[ref], nom = nomFournisseur(ref, e.nom, materiel);
    return e.u === "ml" ? (e.q ? `${e.q} m de ${nom}${e.inconnu ? ", plus une longueur à mesurer" : ""}` : `${nom} : longueur à mesurer`) : `${e.q}x ${nom}`;
  });
  return ["Bonjour,", "", "Voici ma commande pour un chantier d’arrosage :", "", ...lignes, "", "Merci."].join("\n");
}

/**
 * LE POINTILLÉ NE SE DESSINE QUE SOUS LE RÉSEAU QUI L'EMPRUNTE (sa réponse du
 * 18 octobre 2026). Une liaison va de la nourrice au bord d'une zone qui n'est
 * pas d'un seul tenant avec elle : elle appartient aux réseaux de cette zone.
 * Un passage caché sous le rectangle de la nourrice (1,5 m de large) ne se voit
 * pas : ni pointillé, ni phrase (*« mets-le seulement sous le réseau où il y a
 * le pointillé »*).
 */
export function liaisonsDuReseau(dessin: Dessin, plan: Pick<LePlan, "dessinDuCalcul" | "reseauxDeZone">, i: number): Dessin["liaisons"] {
  const zones = plan.dessinDuCalcul.filter((z) => (plan.reseauxDeZone[String(z.id)] ?? []).includes(i));
  return dessin.liaisons.filter((l) => {
    if (Math.hypot(l.a.x - l.de.x, l.a.y - l.de.y) - 0.75 < 0.5) return false;
    return zones.some((z) => l.a.x >= z.x - 0.01 && l.a.x <= z.x + z.L + 0.01 && l.a.y >= z.y - 0.01 && l.a.y <= z.y + z.l + 0.01);
  });
}

/** La zone de goutte-à-goutte qu'un réseau arrose, pour la border de sa couleur sur le plan. */
export function zoneGoutteDuReseau(plan: Pick<LePlan, "dessinDuCalcul" | "reseauxDeZone">, i: number): ZoneDessinee | null {
  return plan.dessinDuCalcul.find((z) => z.cle === "gaine" && (plan.reseauxDeZone[String(z.id)] ?? []).includes(i)) ?? null;
}

/** « 13x », « 48 m », « à mesurer » : la quantité telle qu'elle s'écrit sur une ligne. */
export function quantiteDeLigne(e: { q: number; u: string }): string {
  return e.u === "ml" ? (e.q ? `${e.q} m` : "à mesurer") : `${e.q}x`;
}
