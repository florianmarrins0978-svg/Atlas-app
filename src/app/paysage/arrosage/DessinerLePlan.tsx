"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { colors, font, libelleCaps, surPlein, voile } from "@/lib/design-tokens";
import { etatDuCroquis, LIBELLES, zoneMesuree } from "@/lib/arrosage/croquis-complet";
import { longueurDeLAmenee } from "@/lib/arrosage/geometrie-croquis";
import {
  croquisDuDessin,
  empriseDesDalles,
  lignesDeLaZone,
  lireLeDessin,
  morceauxDe,
  NOMS_DES_ZONES,
  phrasesDuDessin,
  PHRASE_RANGEE_DROITE,
  redressee,
  zonesQuiDebordent,
  type DessinDuPlan,
  type PointMetres,
  type ZoneDessinee,
} from "@/lib/arrosage/dessin-du-plan";
import {
  arriveeA,
  auPas,
  cadreDe,
  cheminDe,
  COINS,
  COTES,
  cotesAuxBords,
  dallesDeLaRangee,
  echantillonsRangee,
  formeLibre,
  longueurDeLaRangee,
  pointDuCote,
  poigneesRangee,
  rangeeDansLeTerrain,
  sommetsDe,
  surLaRangee,
  tirerCoin,
  tirerCote,
  tirerRangee,
  type Coin,
  type Cote,
  type Rangee,
  type Rectangle,
} from "@/lib/arrosage/formes-du-dessin";
import PointsQuiSoufflent from "@/components/atlas/PointsQuiSoufflent";
import { phraseDuManque, type AVerifier, type PlanLu } from "@/lib/arrosage/plan-lu";

/**
 * DESSINER LE PLAN — sa planche B, choisie le 18 octobre 2026 (*« la B, parce
 * qu'il faut que ça soit à l'échelle »*), puis *« tu peux coder »*.
 *
 * **À l'échelle** : il tape les métrés du terrain, puis ceux de chaque zone ;
 * la zone se pose à sa taille, il la glisse à sa place. Tout ce que la planche
 * a reçu de lui est là :
 *
 * | | sa demande |
 * |---|---|
 * | la haie | « la largeur de la haie, pas simplement la longueur » ; ses lignes proposées par la largeur, réglables par − et +, sans plafond |
 * | le cadre | « je peux poser un carré de 12 par 12 alors que mon cadre fait 10 par 10, il faut pouvoir bloquer ça » |
 * | l'échelle | « un centième, un deux centième », puis « 2, 3 centièmes » : jusqu'au 5/100 ; deux doigts agrandissent là où ils sont posés, un doigt fait glisser |
 * | les arbres | « des ronds un peu chiffonnés » ; ils se dessinent et ne changent rien au plan |
 * | les dalles | deux touches, la distance préécrite, puis une dalle ; « On les arrose ? » : celles qu'on n'arrose pas coupent la zone |
 * | la maison | « oui, tu peux l'ajouter » : elle ne s'arrose pas, et coupe ce qu'elle chevauche |
 * | les cotes | « un compteur qui décompte » : l'objet tenu porte ses quatre distances aux bords, le doigt avance par pas |
 * | les courbes | « que ça crée une courbure », « un dallage en S », les coins qu'on rabat, et « Forme d'origine » |
 *
 * **Le piquage ne se contredit pas** : « Compteur » ou « Robinet » posé ici
 * règle aussi « Le piquage se fait… » au-dessus, qui commande le débit.
 *
 * Les règles (ce qui tient dans le terrain, le découpage, l'aimant, les
 * courbes, ce qui manque, l'amenée) sont celles du serveur, prises dans
 * `src/lib/arrosage/` : l'écran ne décide de rien qu'il ne refasse là-bas, et
 * il relit son propre envoi par `lireLeDessin` avant de proposer le plan.
 */

type Sorte = ZoneDessinee["type"] | "maison";
type Outil = "arbre" | "dalles" | "nourrice" | "compteur" | "robinet";
type Zone = Omit<ZoneDessinee, "type"> & { type: Sorte; id: string; aVerifier?: AVerifier };
type Arbre = { id: string; nom: string | null; d: number; x: number; y: number };
type Dalles = Rangee & { id: string; nom: string | null; L: number; l: number; e: number | null; arrosees?: boolean };

const SORTES: Sorte[] = ["gazon", "potager", "massif", "haie", "maison"];
/** Un centimètre d'écran, en pixels CSS : ce que vaut un mètre à 1/100. */
const PX_PAR_CM = 96 / 2.54;
/** Ce qui entoure le terrain, en pixels d'écran : la place de ses cotes. */
const MARGE_PX = 30;
/** Son plan du Vésinet est au 2/100 : « qu'on puisse changer le chiffre 1 ». */
const ECHELLES: [string, string][] = [["200", "1/200"], ["100", "1/100"], ["50", "2/100"], ["33.333333", "3/100"], ["25", "4/100"], ["20", "5/100"]];

function nombre(v: string): number | null {
  const n = parseFloat(v.replace(",", ".").replace(/\s/g, ""));
  return Number.isFinite(n) && n > 0 && n <= 500 ? n : null;
}
function ecrit(n: number): string {
  return String(Math.round(n * 100) / 100).replace(".", ",");
}
function ecritLignes(n: number): string {
  return n === 1 ? "une ligne" : `${n} lignes`;
}
function ecritDalles(n: number): string {
  return n === 1 ? "une dalle" : `${n} dalles`;
}
function borne(v: number, max: number): number {
  return Math.max(0, Math.min(max, v));
}
function nomDe(z: Zone): string {
  return z.nom ?? NOMS_DES_ZONES[z.type];
}
function deformee(o: Zone | Dalles | undefined): boolean {
  if (!o) return false;
  return "a" in o ? !!o.courbe : o.type !== "maison" && formeLibre(o);
}

/** La feuille qui s'ouvre : ce qu'on pose, ou ce qu'on corrige. */
type Feuille =
  | { sorte: "zone"; zone: Zone; neuve: boolean }
  | { sorte: "arbre"; arbre: Arbre; neuf: boolean }
  | { sorte: "dalles"; dalles: Dalles; neuves: boolean }
  | { sorte: "point"; quoi: "nourrice" | "piquage" };

type Prise =
  | { quoi: "objet"; id: string; depart: PointMetres; bouge: boolean; avant: Zone | Arbre | Dalles | PointMetres }
  | { quoi: "plan"; toucher: string | null; bouge: boolean; cx: number; cy: number; sl: number; st: number }
  | { quoi: "forme"; id: string; genre: "cote" | "coin" | "rangee"; cle: string };

export default function DessinerLePlan({
  piquage,
  onPiquage,
  onFaire,
  enCours,
  depart,
}: {
  /** La valeur de « Le piquage se fait… » : `compteur` ou `ailleurs` (le robinet). */
  piquage: string;
  onPiquage: (valeur: "compteur" | "ailleurs") => void;
  /** Le dessin, prêt à partir au serveur. */
  onFaire: (dessin: string) => void;
  enCours: boolean;
  /** Le plan lu sur la photo, à vérifier : le dessin s'ouvre avec lui (planche du 21 octobre 2026). */
  depart?: PlanLu;
}) {
  const [terrainSaisi, setTerrainSaisi] = useState(depart ? { L: ecrit(depart.dessin.terrain.L), l: ecrit(depart.dessin.terrain.l) } : { L: "", l: "" });
  const T = { L: nombre(terrainSaisi.L), l: nombre(terrainSaisi.l) };
  const cadre = T.L !== null && T.l !== null ? { L: T.L, l: T.l } : null;
  const [echelle, setEchelle] = useState<number | null>(null);
  /** Ce que les deux doigts ajoutent à l'échelle choisie : 1, rien. */
  const [loupe, setLoupe] = useState(1);
  const [zones, setZones] = useState<Zone[]>(() => (depart ? depart.dessin.zones.map((z, i) => ({ ...z, id: `lu${i + 1}` })) : []));
  const [arbres, setArbres] = useState<Arbre[]>([]);
  const [dalles, setDalles] = useState<Dalles[]>([]);
  const [nourrice, setNourrice] = useState<PointMetres | null>(depart?.dessin.nourrice ?? null);
  const [piquagePlace, setPiquagePlace] = useState<PointMetres | null>(depart?.dessin.piquage ?? null);
  const [outil, setOutil] = useState<Outil | null>(null);
  const [departDalles, setDepartDalles] = useState<PointMetres | null>(null);
  const [choisie, setChoisie] = useState<string | null>(null);
  /** L'objet tenu ou touché, dont les cotes vont jusqu'aux bords. */
  const [cotesDe, setCotesDe] = useState<string | null>(null);
  const [feuille, setFeuille] = useState<Feuille | null>(null);
  const suivant = useRef(1);
  const prise = useRef<Prise | null>(null);
  const doigts = useRef(new Map<number, { x: number; y: number }>());
  const pince = useRef<{ ecart: number; loupe: number; cible: PointMetres } | null>(null);
  const ancre = useRef<{ cible: PointMetres; x: number; y: number } | null>(null);
  const svg = useRef<SVGSVGElement>(null);
  const boite = useRef<HTMLDivElement>(null);
  const [largeur, setLargeur] = useState(320);

  // La largeur du cadre commande le dessin « tout le terrain » : elle se mesure,
  // et se remesure quand le téléphone tourne.
  useEffect(() => {
    const b = boite.current;
    if (!b) return;
    const mesurer = () => setLargeur(Math.max(1, b.clientWidth - 20));
    mesurer();
    const o = new ResizeObserver(mesurer);
    o.observe(b);
    return () => o.disconnect();
  }, []);

  // ── L'échelle : combien de pixels pour un mètre ───────────────────────────
  const vue = cadre ?? { L: 10, l: 10 };
  const ajuste = (largeur - 2 * MARGE_PX) / vue.L;
  const voulu = echelle && cadre ? (PX_PAR_CM * 100) / echelle : ajuste;
  const parM = Math.max(ajuste, voulu) * loupe;
  const agrandi = parM > ajuste + 1e-6;
  /** Une taille d'écran (en pixels), dite en mètres : les traits et les lettres gardent leur taille. */
  const px = (n: number) => n / parM;
  const m = px(MARGE_PX);

  // Deux doigts : le point du plan pincé reste sous les doigts. Le défilement se
  // règle une fois le plan redessiné à sa nouvelle taille.
  useLayoutEffect(() => {
    const a = ancre.current, s = svg.current, b = boite.current;
    if (!a || !s || !b) return;
    ancre.current = null;
    const c = s.getScreenCTM();
    if (!c) return;
    b.scrollLeft += c.a * a.cible.x + c.c * a.cible.y + c.e - a.x;
    b.scrollTop += c.b * a.cible.x + c.d * a.cible.y + c.f - a.y;
  }, [loupe]);

  const sortePiquage = piquage === "compteur" ? "compteur" : "robinet";
  const ids = (prefixe: string) => `${prefixe}${suivant.current++}`;

  // ── Le terrain change : tout garde ses mètres, et reste dedans ────────────
  function surTerrain(champ: "L" | "l", v: string) {
    const saisi = { ...terrainSaisi, [champ]: v };
    setTerrainSaisi(saisi);
    const L = nombre(saisi.L), l = nombre(saisi.l);
    if (L === null || l === null) return;
    const dedans = (p: PointMetres) => ({ x: borne(p.x, L), y: borne(p.y, l) });
    setZones((zs) => zs.map((z) => ({ ...z, x: borne(z.x, Math.max(0, L - z.L)), y: borne(z.y, Math.max(0, l - z.l)) })));
    setArbres((as) => as.map((a) => ({ ...a, ...dedans(a) })));
    setDalles((ds) => ds.map((d) => ({ ...d, a: dedans(d.a), b: dedans(d.b) })));
    setNourrice((p) => (p ? dedans(p) : p));
    setPiquagePlace((p) => (p ? dedans(p) : p));
  }

  // ── Le doigt ──────────────────────────────────────────────────────────────
  function versLePlan(x: number, y: number): PointMetres {
    const ctm = svg.current!.getScreenCTM()!.inverse();
    const p = new DOMPoint(x, y).matrixTransform(ctm);
    return { x: p.x, y: p.y };
  }
  function enMetres(e: React.PointerEvent): PointMetres {
    return versLePlan(e.clientX, e.clientY);
  }
  function dansLeTerrain(p: PointMetres): PointMetres {
    return cadre ? { x: borne(p.x, cadre.L), y: borne(p.y, cadre.l) } : p;
  }
  function objet(id: string): Zone | Arbre | Dalles | PointMetres | null {
    if (id === "nourrice") return nourrice;
    if (id === "piquage") return piquagePlace;
    return zones.find((z) => z.id === id) ?? arbres.find((a) => a.id === id) ?? dalles.find((d) => d.id === id) ?? null;
  }
  /** Remet un objet tel qu'il était : ce que le premier doigt tenait, quand le second arrive. */
  function remettre(id: string, o: Zone | Arbre | Dalles | PointMetres) {
    if (id === "nourrice") setNourrice(o as PointMetres);
    else if (id === "piquage") setPiquagePlace(o as PointMetres);
    else if (id.startsWith("z")) setZones((zs) => zs.map((x) => (x.id === id ? (o as Zone) : x)));
    else if (id.startsWith("a")) setArbres((as) => as.map((x) => (x.id === id ? (o as Arbre) : x)));
    else setDalles((ds) => ds.map((x) => (x.id === id ? (o as Dalles) : x)));
  }

  function appui(e: React.PointerEvent<SVGSVGElement>) {
    if (!cadre || (e.button !== undefined && e.button !== 0)) return;
    const p = dansLeTerrain(enMetres(e));
    const tire = (e.target as Element).closest("[data-courbe],[data-coin],[data-rangee]");
    if (tire && !outil) {
      const genre = tire.hasAttribute("data-coin") ? "coin" : tire.hasAttribute("data-rangee") ? "rangee" : "cote";
      const [id, cle] = (tire.getAttribute(`data-${genre === "cote" ? "courbe" : genre}`) ?? "").split(":");
      prise.current = { quoi: "forme", id, genre, cle };
      e.currentTarget.setPointerCapture(e.pointerId);
      return;
    }
    if (outil === "nourrice" || outil === "compteur" || outil === "robinet") {
      if (outil === "nourrice") setNourrice(p);
      else {
        setPiquagePlace(p);
        onPiquage(outil === "compteur" ? "compteur" : "ailleurs");
      }
      setOutil(null);
      return;
    }
    if (outil === "arbre") {
      setOutil(null);
      setFeuille({ sorte: "arbre", arbre: { id: "", nom: null, d: 0, x: p.x, y: p.y }, neuf: true });
      return;
    }
    if (outil === "dalles") {
      if (!departDalles) { setDepartDalles(p); return; }
      setDepartDalles(null);
      setOutil(null);
      setFeuille({ sorte: "dalles", dalles: { id: "", nom: null, L: 0, l: 0, e: null, a: departDalles, b: p }, neuves: true });
      return;
    }
    const cible = (e.target as Element).closest("[data-objet]");
    const id = cible?.getAttribute("data-objet") ?? null;
    const b = boite.current!;
    // Plan agrandi, presque tout l'écran est couvert de zones : le doigt y fait
    // glisser le plan, et ne déplace que la zone choisie en la touchant. Les
    // petits signes (nourrice, piquage) se prennent toujours.
    if (id && (!agrandi || id === "nourrice" || id === "piquage" || id === choisie)) {
      const avant = objet(id);
      if (!avant) return;
      prise.current = { quoi: "objet", id, depart: p, bouge: false, avant: structuredClone(avant) };
      if (id !== "nourrice" && id !== "piquage") setChoisie(id);
      setCotesDe(id);
    } else if (agrandi) {
      prise.current = { quoi: "plan", toucher: id, bouge: false, cx: e.clientX, cy: e.clientY, sl: b.scrollLeft, st: b.scrollTop };
    } else {
      setChoisie(null);
      setCotesDe(null);
      return;
    }
    if (!id) { setChoisie(null); setCotesDe(null); }
    e.currentTarget.setPointerCapture(e.pointerId);
  }

  function glisse(e: React.PointerEvent<SVGSVGElement>) {
    const pr = prise.current;
    if (!pr || !cadre) return;
    if (pr.quoi === "plan") {
      if (Math.abs(e.clientX - pr.cx) + Math.abs(e.clientY - pr.cy) > 6) pr.bouge = true;
      boite.current!.scrollLeft = pr.sl - (e.clientX - pr.cx);
      boite.current!.scrollTop = pr.st - (e.clientY - pr.cy);
      return;
    }
    const p = enMetres(e);
    if (pr.quoi === "forme") {
      if (pr.genre === "rangee") {
        // La courbe passe par le doigt, mais elle peut sortir du terrain entre
        // ses points : ce tirage-là ne se prend pas.
        setDalles((ds) => ds.map((d) => {
          if (d.id !== pr.id) return d;
          const courbe = tirerRangee(d, pr.cle === "1" ? 1 : 0, dansLeTerrain(p));
          return rangeeDansLeTerrain({ ...d, courbe }, cadre) ? { ...d, courbe } : d;
        }));
      } else {
        setZones((zs) => zs.map((z) => {
          if (z.id !== pr.id) return z;
          return pr.genre === "coin" ? { ...z, coins: tirerCoin(z, pr.cle as Coin, p, cadre) } : { ...z, courbes: tirerCote(z, pr.cle as Cote, p, cadre) };
        }));
      }
      return;
    }
    const dx = p.x - pr.depart.x, dy = p.y - pr.depart.y;
    if (!pr.bouge && Math.abs(dx) + Math.abs(dy) < px(6)) return;
    pr.bouge = true;
    const a = pr.avant;
    // Le doigt avance par pas, pour que les cotes tombent juste.
    const pas = (v: number) => auPas(v, echelle);
    const point = (q: PointMetres) => ({ x: borne(pas(q.x + dx), cadre.L), y: borne(pas(q.y + dy), cadre.l) });
    if (pr.id === "nourrice") setNourrice(point(a as PointMetres));
    else if (pr.id === "piquage") setPiquagePlace(point(a as PointMetres));
    else if (pr.id.startsWith("z")) {
      const z = a as Zone;
      setZones((zs) => zs.map((x) => (x.id === pr.id ? { ...x, x: borne(pas(z.x + dx), Math.max(0, cadre.L - z.L)), y: borne(pas(z.y + dy), Math.max(0, cadre.l - z.l)) } : x)));
    } else if (pr.id.startsWith("a")) {
      const ar = a as Arbre;
      setArbres((as) => as.map((x) => (x.id === pr.id ? { ...x, ...point(ar) } : x)));
    } else {
      // Les deux bouts d'une rangée bougent ensemble, et restent dans le terrain.
      const d = a as Dalles;
      const mx = Math.min(d.a.x, d.b.x), Mx = Math.max(d.a.x, d.b.x), my = Math.min(d.a.y, d.b.y), My = Math.max(d.a.y, d.b.y);
      const ddx = Math.max(-mx, Math.min(cadre.L - Mx, pas(dx))), ddy = Math.max(-my, Math.min(cadre.l - My, pas(dy)));
      setDalles((ds) => ds.map((x) => (x.id === pr.id ? { ...x, a: { x: d.a.x + ddx, y: d.a.y + ddy }, b: { x: d.b.x + ddx, y: d.b.y + ddy } } : x)));
    }
  }

  function relache() {
    const pr = prise.current;
    prise.current = null;
    if (!pr || pr.quoi === "forme" || pr.bouge) return;
    const id = pr.quoi === "plan" ? pr.toucher : pr.id;
    if (!id) return;
    // Un simple toucher ouvre ce qu'on a touché.
    if (id === "nourrice" || id === "piquage") { setFeuille({ sorte: "point", quoi: id }); return; }
    setChoisie(id);
    setCotesDe(id);
    const z = zones.find((x) => x.id === id);
    if (z) { setFeuille({ sorte: "zone", zone: z, neuve: false }); return; }
    const ar = arbres.find((x) => x.id === id);
    if (ar) { setFeuille({ sorte: "arbre", arbre: ar, neuf: false }); return; }
    const d = dalles.find((x) => x.id === id);
    if (d) setFeuille({ sorte: "dalles", dalles: d, neuves: false });
  }

  // ── Deux doigts : la loupe ────────────────────────────────────────────────
  // Sa demande du 19 octobre : « zoomer à n'importe quel endroit de la carte
  // avec mes deux doigts, et après avec le slide je me déplace ».
  function lesDeux() {
    const [a, b] = [...doigts.current.values()];
    return { ecart: Math.hypot(a.x - b.x, a.y - b.y) || 1, x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
  }
  function doigtPose(e: React.PointerEvent<SVGSVGElement>) {
    doigts.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (doigts.current.size === 2) {
      // Le premier doigt tenait peut-être un objet : il le lâche là où il était.
      const pr = prise.current;
      if (pr?.quoi === "objet") remettre(pr.id, pr.avant);
      prise.current = null;
      const d = lesDeux();
      pince.current = { ecart: d.ecart, loupe, cible: versLePlan(d.x, d.y) };
      return;
    }
    if (!pince.current) appui(e);
  }
  function doigtGlisse(e: React.PointerEvent<SVGSVGElement>) {
    if (doigts.current.has(e.pointerId)) doigts.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const pi = pince.current;
    if (pi) {
      if (doigts.current.size < 2) return;
      const d = lesDeux();
      ancre.current = { cible: pi.cible, x: d.x, y: d.y };
      setLoupe(Math.max(1, Math.min(40, (pi.loupe * d.ecart) / pi.ecart)));
      return;
    }
    glisse(e);
  }
  function doigtLeve(e: React.PointerEvent<SVGSVGElement>) {
    doigts.current.delete(e.pointerId);
    if (pince.current) { if (doigts.current.size < 2) pince.current = null; return; }
    relache();
  }

  function poserZone(z: Zone, neuve: boolean) {
    if (!cadre) return;
    if (neuve) {
      // Posée au milieu du terrain, un peu décalée de la précédente : il la
      // glisse ensuite à sa place. La place n'est pas une donnée, la cote si.
      const decale = (zones.length % 5) * 1;
      const posee = { ...z, id: ids("z"), x: borne(cadre.L / 2 - z.L / 2 + decale, Math.max(0, cadre.L - z.L)), y: borne(cadre.l / 2 - z.l / 2 + decale, Math.max(0, cadre.l - z.l)) };
      setZones((zs) => [...zs, posee]);
      setChoisie(posee.id);
      setCotesDe(posee.id);
    } else {
      setZones((zs) => zs.map((x) => (x.id === z.id ? { ...z, x: borne(z.x, Math.max(0, cadre.L - z.L)), y: borne(z.y, Math.max(0, cadre.l - z.l)) } : x)));
    }
    setFeuille(null);
  }

  /** « Forme d'origine » : les côtés droits, les coins à leur place. */
  function formeDOrigine(id: string) {
    setZones((zs) => zs.map((z) => (z.id === id ? { ...z, courbes: undefined, coins: undefined } : z)));
    setDalles((ds) => ds.map((d) => (d.id === id ? { ...d, courbe: undefined } : d)));
  }

  // ── Ce que l'outil comprend : la règle du serveur, rejouée ici ────────────
  const dessin: DessinDuPlan | null = cadre
    ? {
        terrain: cadre,
        // Ce qui part au serveur : la zone, sans ce qui ne sert qu'à l'écran.
        zones: zones
          .filter((z) => z.type !== "maison")
          .map((z): ZoneDessinee => ({
            type: z.type as ZoneDessinee["type"], nom: z.nom, L: z.L, l: z.l, x: z.x, y: z.y,
            ...(z.lignes !== undefined ? { lignes: z.lignes } : {}),
            ...(z.ecartLignes !== undefined ? { ecartLignes: z.ecartLignes } : {}),
            ...(z.courbes ? { courbes: z.courbes } : {}),
            ...(z.coins ? { coins: z.coins } : {}),
          })),
        maisons: zones.filter((z) => z.type === "maison").map((z) => ({ nom: z.nom, L: z.L, l: z.l, x: z.x, y: z.y })),
        // Les dalles qu'on arrose ne changent rien au plan : elles ne partent pas.
        dalles: dalles.filter((d) => d.arrosees === false).map((d) => ({ a: d.a, b: d.b, l: d.l, ...(d.courbe ? { courbe: d.courbe } : {}) })),
        nourrice,
        piquage: piquagePlace,
      }
    : null;
  const debordent = cadre ? zonesQuiDebordent({ terrain: cadre, zones }) : [];
  const relu = dessin ? lireLeDessin(dessin) : null;
  const croquis = dessin ? croquisDuDessin(dessin, sortePiquage) : null;
  const etat = etatDuCroquis({
    zonesMesurees: croquis ? croquis.zones.filter(zoneMesuree).length : 0,
    nourrice: nourrice !== null,
    piquage: piquagePlace !== null,
    branchement: piquage,
  });
  const amenee =
    croquis && croquis.nourrice && croquis.piquage
      ? longueurDeLAmenee(
          croquis.piquage,
          croquis.nourrice,
          croquis.zones.filter(zoneMesuree).map((z) => ({
            position: z.x !== null && z.y !== null ? { x: z.x, y: z.y } : null,
            largeurFraction: z.largeurFraction,
            hauteurFraction: z.hauteurFraction,
            L: z.L,
            l: z.l,
            ml: z.ml,
          }))
        )
      : null;
  // Une cote que le croquis ne porte pas ne part jamais : il la tape d'abord.
  const manquantes = zones.flatMap((z) => (z.aVerifier?.manque ?? []).map((c) => phraseDuManque({ type: z.type as ZoneDessinee["type"], nom: z.nom }, c)));
  const pret = etat.complet && debordent.length === 0 && relu?.ok === true && manquantes.length === 0;
  const morceaux = (z: Zone) => (dessin && z.type !== "maison" ? morceauxDe(z as ZoneDessinee, dessin) : { parts: [cadreDe(z)], coupeurs: [] });

  const objetChoisi = choisie ? zones.find((z) => z.id === choisie) ?? dalles.find((d) => d.id === choisie) : undefined;
  const courbable = !!objetChoisi && ("a" in objetChoisi || objetChoisi.type !== "maison");

  const consigne = !cadre
    ? "Les métrés du terrain d’abord."
    : outil === "nourrice" ? "Touchez l’endroit de la nourrice."
    : outil === "compteur" ? "Touchez l’endroit du compteur."
    : outil === "robinet" ? "Touchez l’endroit du robinet."
    : outil === "arbre" ? "Touchez le centre de l’arbre."
    : outil === "dalles" ? (departDalles ? "Touchez l’arrivée des dalles." : "Touchez le départ des dalles.")
    : courbable ? "Tirez un point vert pour courber."
    : depart ? "Touchez une zone pour la corriger, glissez-la pour la placer."
    : agrandi ? "Touchez une zone pour la choisir, puis glissez-la."
    : "";

  /** Ce qu'occupe l'objet dont on montre les cotes : un rectangle, ou un point. */
  function emprise(id: string): Rectangle | null {
    const o = objet(id);
    if (!o) return null;
    if ("a" in o) return empriseDesDalles(o);
    if ("L" in o) return { x: o.x, y: o.y, L: o.L, l: o.l };
    return { x: o.x, y: o.y, L: 0, l: 0 };
  }

  const champ = "mt-[5px] block w-full min-w-0 rounded-[10px] border-0 px-[12px] py-3 text-[16px]";
  const styleChamp = { backgroundColor: colors.cream, color: colors.ink, boxShadow: `inset 0 0 0 1px ${colors.line}` };
  const texteDetache = { stroke: colors.card, strokeWidth: px(2.6), paintOrder: "stroke" as const, strokeLinejoin: "round" as const };

  /** Un point à tirer : petit à l'œil, large sous le doigt. Rond au milieu d'un côté, carré au coin. */
  const aTirer = (q: PointMetres, attr: Record<string, string>, carre = false) => (
    <g key={Object.values(attr)[0]} {...attr} transform={`translate(${q.x} ${q.y}) scale(${px(1)})`} style={{ cursor: "move" }}>
      <circle r={20} fill="transparent" />
      {carre ? (
        <rect x={-6.5} y={-6.5} width={13} height={13} rx={1.8} fill={colors.card} stroke={colors.plein} strokeWidth={3} />
      ) : (
        <circle r={7} fill={colors.card} stroke={colors.plein} strokeWidth={3} />
      )}
    </g>
  );

  function dessinZone(z: Zone) {
    const hors = debordent.includes(z);
    const est = choisie === z.id;
    const { parts } = morceaux(z);
    const lz = z.type === "haie" || z.type === "massif" ? lignesDeLaZone(z.type, z.L, z.l, z) : null;
    // Une cote absente du croquis se dit « ? » ; ses lignes en dépendent.
    const manque = z.aVerifier?.manque ?? [];
    const cotes = `${manque.includes("L") ? "?" : ecrit(z.L)} × ${manque.includes("l") ? "?" : ecrit(z.l)}${lz && !manque.length ? `, ${ecritLignes(lz.lignes)}` : ""}${parts.length > 1 ? `, en ${parts.length} parts` : ""}`;
    const aRevoir = hors || manque.length > 0;
    const teinteCotes = aRevoir ? colors.alert : z.aVerifier?.deduites.length ? colors.orTexte : colors.inkSoft;
    const deuxLignes = z.l >= px(30);
    const tient = (t: string, taille: number) => Math.min(px(taille), Math.max(px(6), (z.L - px(5)) / (t.length * 0.56)));
    // Coupée, la zone porte son nom dans son plus grand morceau : au centre, il
    // tombait sous la rangée ou la maison.
    const grand = parts.length > 1 ? parts.reduce((g, q) => (q.L * q.l > g.L * g.l ? q : g)) : { x: z.x, y: z.y, L: z.L, l: z.l };
    const cx = grand.x + grand.L / 2, cy = grand.y + grand.l / 2;
    const bord = {
      fill: remplissage(z.type),
      stroke: aRevoir ? colors.alert : est ? colors.ink : colors.rustDeep,
      strokeWidth: px(est ? 3 : 1.5),
      strokeDasharray: aRevoir ? `${px(5)} ${px(4)}` : undefined,
    };
    const nom = nomDe(z);
    return (
      <g key={z.id} data-objet={z.id} style={{ cursor: "grab" }}>
        {formeLibre(z) ? <path d={cheminDe(z)} {...bord} /> : <rect x={z.x} y={z.y} width={z.L} height={z.l} rx={px(2.5)} {...bord} />}
        {deuxLignes ? (
          <>
            <text x={cx} y={cy - px(2)} textAnchor="middle" fontSize={tient(nom, 11)} fill={colors.ink} {...texteDetache}>{nom}</text>
            <text x={cx} y={cy + px(11)} textAnchor="middle" fontSize={tient(cotes, 10)} fill={teinteCotes} {...texteDetache}>{cotes}</text>
          </>
        ) : (
          <text x={cx} y={cy + px(3.5)} textAnchor="middle" fontSize={tient(`${nom}, ${cotes}`, 10)} fill={teinteCotes} {...texteDetache}>
            {`${nom}, ${cotes}`}
          </text>
        )}
        {est && z.type !== "maison" && (
          <>
            {COTES.map((c) => aTirer(pointDuCote(z, c), { "data-courbe": `${z.id}:${c}` }))}
            {COINS.map((c) => aTirer(sommetsDe(z)[c], { "data-coin": `${z.id}:${c}` }, true))}
          </>
        )}
      </g>
    );
  }

  function dessinDalles(d: Dalles) {
    const r = dallesDeLaRangee(d);
    const ang = Math.atan2(d.b.y - d.a.y, d.b.x - d.a.x);
    // Le nom au-dessus de la rangée (à droite si elle est debout).
    let nx = -Math.sin(ang), ny = Math.cos(ang);
    if (ny > 1e-6 || (Math.abs(ny) <= 1e-6 && nx < 0)) { nx = -nx; ny = -ny; }
    const ecart = d.l / 2 + px(Math.abs(ny) <= 1e-6 ? 16 : 10);
    const teinte = { fill: voile(colors.muted, 0.6), stroke: colors.inkSoft, strokeWidth: px(1) };
    const e = d.courbe ? echantillonsRangee(d) : null;
    return (
      <g key={d.id} data-objet={d.id} style={{ cursor: "grab" }}>
        {e ? (
          <>
            <path d={`M${e.pts.map((q) => `${q.x} ${q.y}`).join("L")}`} fill="none" stroke="transparent" strokeWidth={Math.max(px(26), d.l)} strokeLinecap="round" />
            {/* Courbée : chaque dalle se pose sur la courbe, tournée comme elle. */}
            {Array.from({ length: r.n }, (_, i) => {
              const q = surLaRangee(e, r.depart + i * (d.L + (d.e ?? 0)) + d.L / 2);
              return <rect key={i} x={-d.L / 2} y={-d.l / 2} width={d.L} height={d.l} transform={`translate(${q.x} ${q.y}) rotate(${(q.angle * 180) / Math.PI})`} {...teinte} />;
            })}
          </>
        ) : (
          <>
            <line x1={d.a.x} y1={d.a.y} x2={d.b.x} y2={d.b.y} stroke="transparent" strokeWidth={Math.max(px(26), d.l)} strokeLinecap="round" />
            <g transform={`translate(${d.a.x} ${d.a.y}) rotate(${(ang * 180) / Math.PI})`}>
              {Array.from({ length: r.n }, (_, i) => (
                <rect key={i} x={r.depart + i * (d.L + (d.e ?? 0))} y={-d.l / 2} width={d.L} height={d.l} {...teinte} />
              ))}
            </g>
          </>
        )}
        <text x={(d.a.x + d.b.x) / 2 + nx * ecart} y={(d.a.y + d.b.y) / 2 + ny * ecart + px(3)} textAnchor="middle" fontSize={px(9.5)} fill={colors.ink} {...texteDetache}>
          {`${d.nom ?? "Dalles"}, ${ecritDalles(r.n)}`}
        </text>
        {choisie === d.id && poigneesRangee(d).map((q, i) => aTirer(q, { "data-rangee": `${d.id}:${i}` }))}
      </g>
    );
  }

  /** LES QUATRE COTES de l'objet tenu, jusqu'aux bords du terrain : « une ligne
   *  horizontale, verticale, avec les bonnes distances ». Une cote nulle (collé
   *  au bord) ne se dessine pas. */
  function dessinCotes(id: string) {
    const b = emprise(id);
    if (!b || !cadre) return null;
    const d = cotesAuxBords(b, cadre);
    const cx = b.x + b.L / 2, cy = b.y + b.l / 2, tic = px(4);
    const traits: [number, number, number, number, number][] = [
      [0, cy, b.x, cy, d.gauche],
      [b.x + b.L, cy, cadre.L, cy, d.droite],
      [cx, 0, cx, b.y, d.haut],
      [cx, b.y + b.l, cx, cadre.l, d.bas],
    ];
    const trait = { stroke: colors.orTexte, strokeWidth: px(1.2) };
    return (
      <g data-atlas="cotes-aux-bords" pointerEvents="none">
        {traits.filter((t) => t[4] >= 0.005).map(([x1, y1, x2, y2, v], i) => {
          const couche = Math.abs(y2 - y1) < 1e-9;
          return (
            <g key={i}>
              <line x1={x1} y1={y1} x2={x2} y2={y2} {...trait} />
              {[[x1, y1], [x2, y2]].map(([x, y], k) => (
                <line key={k} {...(couche ? { x1: x, y1: y - tic, x2: x, y2: y + tic } : { x1: x - tic, y1: y, x2: x + tic, y2: y })} {...trait} />
              ))}
              <text
                x={couche ? (x1 + x2) / 2 : x1 + px(5)}
                y={couche ? y1 - px(5) : (y1 + y2) / 2 + px(3.5)}
                textAnchor={couche ? "middle" : "start"}
                fontSize={px(10)}
                fontWeight={600}
                fill={colors.orTexte}
                {...texteDetache}
              >
                {`${ecrit(v)} m`}
              </text>
            </g>
          );
        })}
      </g>
    );
  }

  return (
    <div data-atlas="dessiner-le-plan" className="mt-5">
      <div className="mx-[22px]">
        <span className={`block ${libelleCaps}`} style={{ color: colors.or }}>Le terrain, en mètres</span>
        <div className="mt-1 grid grid-cols-2 gap-2">
          {(["L", "l"] as const).map((c) => (
            <span key={c} className="min-w-0">
              <label className={`block ${libelleCaps}`} style={{ color: colors.muted }} htmlFor={`terrain-${c}`}>
                {c === "L" ? "Longueur" : "Largeur"}
              </label>
              <input
                id={`terrain-${c}`}
                inputMode="decimal"
                enterKeyHint="done"
                autoComplete="off"
                value={terrainSaisi[c]}
                onChange={(e) => surTerrain(c, e.target.value)}
                className={champ}
                style={styleChamp}
              />
            </span>
          ))}
        </div>
        <label className={`mt-[10px] block ${libelleCaps}`} style={{ color: colors.muted }} htmlFor="echelle">
          Échelle
        </label>
        <select
          id="echelle"
          disabled={!cadre}
          value={echelle === null ? "" : String(echelle)}
          onChange={(e) => {
            setEchelle(e.target.value ? Number(e.target.value) : null);
            setLoupe(1);
          }}
          className={`${champ} appearance-none`}
          style={{ ...styleChamp, minHeight: 50 }}
        >
          <option value="">Tout le terrain</option>
          {ECHELLES.map(([v, nom]) => <option key={v} value={v}>{nom}</option>)}
        </select>
      </div>

      <div ref={boite} className="mx-[22px] mt-3 overflow-auto rounded-[14px] p-[10px]" style={{ backgroundColor: colors.card, maxHeight: "68vh", overscrollBehavior: "contain" }}>
        <svg
          ref={svg}
          data-atlas="toile"
          role="img"
          aria-label="Le terrain et ses zones"
          viewBox={`${-m} ${-m} ${vue.L + 2 * m} ${vue.l + 2 * m}`}
          style={{ display: "block", width: agrandi ? Math.round((vue.L + 2 * m) * parM) : "100%", height: "auto", touchAction: "none", userSelect: "none" }}
          onPointerDown={doigtPose}
          onPointerMove={doigtGlisse}
          onPointerUp={doigtLeve}
          onPointerCancel={(e) => { doigts.current.delete(e.pointerId); pince.current = null; prise.current = null; }}
        >
          <rect x={0} y={0} width={vue.L} height={vue.l} rx={px(4)} fill={colors.cream} stroke={colors.ink} strokeWidth={px(1.6)} />
          <text x={vue.L / 2} y={-px(9)} textAnchor="middle" fontSize={px(11)} fill={cadre ? colors.inkSoft : colors.alert}>
            {T.L !== null ? `${ecrit(T.L)} m` : "? m"}
          </text>
          <text x={-px(9)} y={vue.l / 2} textAnchor="middle" fontSize={px(11)} fill={cadre ? colors.inkSoft : colors.alert} transform={`rotate(-90 ${-px(9)} ${vue.l / 2})`}>
            {T.l !== null ? `${ecrit(T.l)} m` : "? m"}
          </text>

          {/* Les maisons par-dessus les zones qu'elles coupent. */}
          {zones.filter((z) => z.type !== "maison").map(dessinZone)}
          {zones.filter((z) => z.type === "maison").map(dessinZone)}
          {/* Les morceaux d'une zone coupée ou courbe, en pointillé : ce sont eux
              que le calcul reçoit, et le long d'eux qu'il pose les arroseurs. */}
          {zones.filter((z) => z.type !== "maison").flatMap((z) => {
            const { parts } = morceaux(z);
            if (parts.length < 2 && !formeLibre(z)) return [];
            return parts.map((q, i) => (
              <rect key={`${z.id}-${i}`} data-atlas="morceau" x={q.x} y={q.y} width={q.L} height={q.l} fill="none" stroke={colors.plein} strokeWidth={px(1.6)} strokeDasharray={`${px(5)} ${px(3.5)}`} pointerEvents="none" />
            ));
          })}

          {dalles.map(dessinDalles)}

          {arbres.map((a) => (
            <g key={a.id} data-objet={a.id} style={{ cursor: "grab" }}>
              <path d={festons(a.x, a.y, a.d / 2, px)} fill={voile(colors.plein, 0.52)} stroke={colors.rustDeep} strokeWidth={px(1.5)} />
              <text x={a.x} y={a.y + a.d / 2 + px(12)} textAnchor="middle" fontSize={px(9.5)} fill={colors.ink} {...texteDetache}>
                {`${a.nom ?? "Arbre"}, Ø ${ecrit(a.d)} m`}
              </text>
            </g>
          ))}

          {departDalles && <circle cx={departDalles.x} cy={departDalles.y} r={px(5)} fill={colors.ink} />}

          {piquagePlace && (
            <g data-objet="piquage" style={{ cursor: "grab" }} transform={`translate(${piquagePlace.x} ${piquagePlace.y}) scale(${px(1)})`}>
              <rect x={-20} y={-20} width={40} height={40} fill="transparent" />
              {sortePiquage === "robinet" ? (
                <>
                  {/* Sa règle du 18 octobre : une petite croix blanche, et « robinet » à côté. */}
                  <path d="M-6 0H6M0 -6V6" stroke={colors.ink} strokeWidth={5} strokeLinecap="round" />
                  <path d="M-6 0H6M0 -6V6" stroke="#ffffff" strokeWidth={2.2} strokeLinecap="round" />
                </>
              ) : (
                <>
                  <circle r={6.5} fill={colors.card} stroke={colors.ink} strokeWidth={2.2} />
                  <circle r={2} fill={colors.ink} />
                </>
              )}
              {/* Dans la moitié droite, le mot passe à gauche : au bord, il sortait du dessin. */}
              <text x={cadre && piquagePlace.x > cadre.L / 2 ? -10 : 10} y={4} textAnchor={cadre && piquagePlace.x > cadre.L / 2 ? "end" : "start"} fontSize={10} fontWeight={600} fill={colors.ink} stroke={colors.card} strokeWidth={2.6} paintOrder="stroke" strokeLinejoin="round">
                {sortePiquage}
              </text>
            </g>
          )}
          {nourrice && (
            <g data-objet="nourrice" style={{ cursor: "grab" }} transform={`translate(${nourrice.x} ${nourrice.y}) scale(${px(1)})`}>
              <rect x={-20} y={-20} width={40} height={40} fill="transparent" />
              <rect x={-12} y={-7} width={24} height={14} rx={2} fill={colors.ink} />
              <text y={20} textAnchor="middle" fontSize={10} fontWeight={600} fill={colors.ink} stroke={colors.card} strokeWidth={2.6} paintOrder="stroke" strokeLinejoin="round">
                nourrice
              </text>
            </g>
          )}
          {cotesDe && dessinCotes(cotesDe)}
        </svg>
      </div>

      <p data-atlas="consigne-dessin" aria-live="polite" className="mx-[22px] mt-2 min-h-[21px] text-[14px]" style={{ color: colors.inkSoft }}>
        {consigne}
      </p>
      {choisie && deformee(objetChoisi) && (
        <button
          type="button"
          data-atlas="forme-d-origine"
          onClick={() => formeDOrigine(choisie)}
          className="mx-[22px] mt-[6px] min-h-[44px] rounded-full px-[18px] text-[14px] font-medium"
          style={{ border: `1px solid ${colors.line}`, backgroundColor: colors.cream, color: colors.ink }}
        >
          Forme d’origine
        </button>
      )}

      <div role="toolbar" aria-label="Ajouter" className="mx-[22px] mt-2 flex flex-wrap gap-[6px]">
        {SORTES.map((s) => (
          <Bouton key={s} actif={false} desactive={!cadre} onClick={() => setFeuille({ sorte: "zone", zone: { id: "", type: s, nom: null, L: 0, l: 0, x: 0, y: 0 }, neuve: true })}>
            <svg viewBox="0 0 18 18" width={18} height={18} aria-hidden="true">
              {s === "maison" ? (
                <path d="M3 8.5L9 3.5L15 8.5V15H3Z" fill={remplissage(s)} stroke={colors.ink} strokeLinejoin="round" />
              ) : (
                <rect x={2} y={s === "haie" ? 7 : 4} width={14} height={s === "haie" ? 4 : 10} rx={1.5} fill={remplissage(s)} stroke={colors.rustDeep} />
              )}
            </svg>
            {NOMS_DES_ZONES[s]}
          </Bouton>
        ))}
        {(
          [
            ["arbre", "Arbre"],
            ["dalles", "Dalles"],
            ["nourrice", "Nourrice"],
            ["compteur", "Compteur"],
            ["robinet", "Robinet"],
          ] as const
        ).map(([o, nom]) => (
          <Bouton key={o} actif={outil === o} desactive={!cadre} onClick={() => { setDepartDalles(null); setOutil(outil === o ? null : o); }}>
            <SigneOutil outil={o} />
            {nom}
          </Bouton>
        ))}
      </div>

      <ul data-atlas="etat-dessin" aria-live="polite" className="mx-[22px] mt-[14px] list-none p-0">
        {manquantes.map((p) => <Ligne key={p} rouge>{p}</Ligne>)}
        {cadre && etat.manque.map((q) => <Ligne key={q} rouge>{LIBELLES[q].titre}</Ligne>)}
        {debordent.map((z) => (
          <Ligne key={z.id} rouge>
            {`Pas de plan : ${nomDe(z)} (${ecrit(z.L)} × ${ecrit(z.l)} m) ne tient pas dans le terrain de ${ecrit(cadre!.L)} × ${ecrit(cadre!.l)} m.`}
          </Ligne>
        ))}
        {debordent.length === 0 && relu && !relu.ok && <Ligne rouge>{relu.raison}</Ligne>}
        {depart?.reserves.map((r) => <Ligne key={r}>{r}</Ligne>)}
        {dessin && phrasesDuDessin(dessin).map((p) => <Ligne key={p}>{p}</Ligne>)}
        {amenee && (amenee.ok ? (
          <Ligne bon>{`${sortePiquage === "robinet" ? "Du robinet" : "Du compteur"} à la nourrice : ${ecrit(amenee.metres)} m.`}</Ligne>
        ) : (
          <Ligne rouge>{`L’amenée n’est pas comptée : ${amenee.raison}.`}</Ligne>
        ))}
      </ul>

      {pret && dessin && (
        <button
          type="button"
          data-atlas="faire-le-plan"
          disabled={enCours}
          onClick={() => onFaire(JSON.stringify(dessin))}
          className="atlas-plein mx-[22px] mt-[14px] flex min-h-[56px] w-[calc(100%-44px)] items-center justify-center gap-2 rounded-full border-0 text-[15px] font-semibold"
          style={{ backgroundColor: colors.plein, color: surPlein }}
        >
          {enCours ? (
            <>
              Calcul du plan
              <PointsQuiSoufflent />
            </>
          ) : (
            "Faire le plan"
          )}
        </button>
      )}

      {feuille && cadre && (
        <FeuilleDuDessin
          feuille={feuille}
          cadre={cadre}
          onFermer={() => setFeuille(null)}
          onZone={poserZone}
          onArbre={(a, neuf) => {
            setArbres((as) => (neuf ? [...as, { ...a, id: ids("a") }] : as.map((x) => (x.id === a.id ? a : x))));
            setFeuille(null);
          }}
          onDalles={(d, neuves) => {
            setDalles((ds) => (neuves ? [...ds, { ...d, id: ids("d") }] : ds.map((x) => (x.id === d.id ? d : x))));
            setFeuille(null);
          }}
          onFormeDOrigine={(id) => {
            formeDOrigine(id);
            setFeuille(null);
          }}
          onSupprimer={() => {
            const f = feuille;
            if (f.sorte === "point") (f.quoi === "nourrice" ? setNourrice : setPiquagePlace)(null);
            else if (f.sorte === "zone") setZones((zs) => zs.filter((z) => z.id !== f.zone.id));
            else if (f.sorte === "arbre") setArbres((as) => as.filter((a) => a.id !== f.arbre.id));
            else setDalles((ds) => ds.filter((d) => d.id !== f.dalles.id));
            setChoisie(null);
            setCotesDe(null);
            setFeuille(null);
          }}
          sortePiquage={sortePiquage}
        />
      )}
    </div>
  );
}

/** La zone vue de dessus, ses lignes et leur écart coté, puis le tube qu'elles
 *  demandent : ce que la planche du 22 octobre 2026 lui a montré. */
function CoupeDesLignes({ lignes, ecart, long, travers }: { lignes: number; ecart: number; long: number; travers: number }) {
  const W = 10, H = Math.max(1.6, Math.min(5, (W * travers) / Math.max(long, 0.1))), k = H / travers;
  return (
    <>
      <svg viewBox={`-2.8 -0.6 ${W + 5.6} ${H + 1.4}`} style={{ display: "block", width: "100%", height: "auto", marginTop: 10 }} aria-hidden="true">
        <rect x={0} y={0} width={W} height={H} rx={0.08} fill={voile(colors.plein, 0.34)} stroke={colors.rustDeep} strokeWidth={0.05} />
        {Array.from({ length: lignes }, (_, i) => {
          const y = Math.min(travers, (i + 1) * ecart) * k;
          return <line key={i} x1={0.15} y1={y} x2={W - 0.15} y2={y} stroke={colors.ink} strokeWidth={0.07} />;
        })}
        <line x1={-0.5} y1={0} x2={-0.5} y2={ecart * k} stroke={colors.orTexte} strokeWidth={0.04} />
        <line x1={-0.65} y1={0} x2={-0.35} y2={0} stroke={colors.orTexte} strokeWidth={0.04} />
        <line x1={-0.65} y1={ecart * k} x2={-0.35} y2={ecart * k} stroke={colors.orTexte} strokeWidth={0.04} />
        <text x={-0.62} y={(ecart * k) / 2 + 0.14} textAnchor="end" fontSize={0.42} fontWeight={600} fill={colors.orTexte}>{Math.round(ecart * 100)} cm</text>
        <text x={W / 2} y={H + 0.6} textAnchor="middle" fontSize={0.42} fill={colors.inkSoft}>{ecrit(long)} m</text>
      </svg>
      <p className="mt-2 text-[15px]" style={{ color: colors.inkSoft }}>{Math.ceil(lignes * long - 1e-9)} m de tube.</p>
    </>
  );
}

function remplissage(type: Sorte): string {
  if (type === "maison") return voile(colors.muted, 0.42);
  if (type === "gazon") return voile(colors.vertPale, 0.75);
  if (type === "haie") return voile(colors.plein, 0.34);
  if (type === "potager") return voile(colors.orClair, 0.38);
  return voile(colors.rustDeep, 0.24);
}

/** L'arbre de son plan : un rond aux bords festonnés. */
function festons(cx: number, cy: number, r: number, px: (n: number) => number): string {
  const lobes = Math.max(7, Math.min(14, Math.round(r / px(1) / 4)));
  let d = "";
  for (let i = 0; i <= lobes; i++) {
    const ang = (i / lobes) * 2 * Math.PI;
    const x = cx + Math.cos(ang) * r * 0.9, y = cy + Math.sin(ang) * r * 0.9;
    if (i === 0) { d += `M${x} ${y}`; continue; }
    const mi = ((i - 0.5) / lobes) * 2 * Math.PI;
    d += `Q${cx + Math.cos(mi) * r * 1.12} ${cy + Math.sin(mi) * r * 1.12} ${x} ${y}`;
  }
  return `${d}Z`;
}

/** Un outil actif est en `plein`, comme tous les boutons pleins de l'application
 *  (sa règle du 19 octobre 2026), jamais en noir. */
function Bouton({ actif, desactive, onClick, children }: { actif: boolean; desactive: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={actif}
      disabled={desactive}
      onClick={onClick}
      className="flex min-h-[44px] items-center gap-2 rounded-full py-[6px] pl-[10px] pr-[14px] text-[14.5px] disabled:opacity-45"
      style={actif ? { backgroundColor: colors.plein, color: surPlein, border: `1px solid ${colors.plein}` } : { backgroundColor: colors.card, color: colors.ink, border: `1px solid ${colors.line}` }}
    >
      {children}
    </button>
  );
}

function SigneOutil({ outil }: { outil: Outil }) {
  const fond = voile(colors.muted, 0.6);
  return (
    <svg viewBox="0 0 18 18" width={18} height={18} aria-hidden="true">
      {outil === "arbre" && <path d={festons(9, 9, 6.5, () => 0.4)} fill={voile(colors.plein, 0.52)} stroke={colors.rustDeep} />}
      {outil === "dalles" && [1.5, 7.2, 12.9].map((x) => <rect key={x} x={x} y={5} width={3.6} height={8} rx={0.6} fill={fond} stroke="currentColor" strokeWidth={0.8} />)}
      {outil === "nourrice" && <rect x={3} y={5.5} width={12} height={7} rx={1} fill="currentColor" />}
      {outil === "compteur" && (
        <>
          <circle cx={9} cy={9} r={5} fill={colors.card} stroke="currentColor" strokeWidth={1.6} />
          <circle cx={9} cy={9} r={1.5} fill="currentColor" />
        </>
      )}
      {outil === "robinet" && (
        <>
          <path d="M4 9H14M9 4V14" stroke="currentColor" strokeWidth={4} strokeLinecap="round" />
          <path d="M4 9H14M9 4V14" stroke="#ffffff" strokeWidth={1.7} strokeLinecap="round" />
        </>
      )}
    </svg>
  );
}

function Ligne({ rouge, bon, children }: { rouge?: boolean; bon?: boolean; children: React.ReactNode }) {
  return (
    <li className="flex gap-[10px] py-[5px] text-[14.5px] leading-[1.45]" style={rouge ? { color: colors.alert, fontWeight: 600 } : undefined}>
      <span aria-hidden="true" className="mt-2 h-[7px] w-[7px] flex-none rounded-full" style={{ backgroundColor: rouge ? colors.alert : bon ? colors.plein : colors.muted }} />
      <span>{children}</span>
    </li>
  );
}

/**
 * La feuille des cotes. **En B, c'est la cote qui donne la taille** : sans
 * elle, rien ne se pose. Toucher à côté referme (le pavé de l'iPhone n'a pas
 * de touche OK) ; ce qui n'était pas encore posé s'abandonne.
 */
function FeuilleDuDessin({
  feuille,
  cadre,
  onFermer,
  onZone,
  onArbre,
  onDalles,
  onFormeDOrigine,
  onSupprimer,
  sortePiquage,
}: {
  feuille: Feuille;
  cadre: { L: number; l: number };
  onFermer: () => void;
  onZone: (z: Zone, neuve: boolean) => void;
  onArbre: (a: Arbre, neuf: boolean) => void;
  onDalles: (d: Dalles, neuves: boolean) => void;
  onFormeDOrigine: (id: string) => void;
  onSupprimer: () => void;
  sortePiquage: string;
}) {
  const z = feuille.sorte === "zone" ? feuille.zone : null;
  const ar = feuille.sorte === "arbre" ? feuille.arbre : null;
  const da = feuille.sorte === "dalles" ? feuille.dalles : null;
  const neuf = (feuille.sorte === "zone" && feuille.neuve) || (feuille.sorte === "arbre" && feuille.neuf) || (feuille.sorte === "dalles" && feuille.neuves);
  const montre = (n: number | null | undefined) => (n ? ecrit(n) : "");

  const [nom, setNom] = useState(z?.nom ?? ar?.nom ?? da?.nom ?? "");
  // Une cote que le croquis ne porte pas s'ouvre VIDE : la taille dessinée
  // n'est pas une cote, et la laisser là la ferait valider sans la lire.
  const manque = z?.aVerifier?.manque ?? [];
  const [L, setL] = useState(manque.includes("L") ? "" : montre(z?.L ?? da?.L));
  const [l, setl] = useState(manque.includes("l") ? "" : montre(z?.l ?? da?.l));
  const [d, setD] = useState(montre(ar?.d));
  const [e, setE] = useState(montre(da?.e));
  const [dist, setDist] = useState(da ? ecrit(longueurDeLaRangee(da)) : "");
  /** « On les arrose ? » Pas de réponse d'office : il la donne. */
  const [arrosees, setArrosees] = useState<boolean | null>(da?.arrosees ?? null);
  /** Une seule source à la fois : le nombre choisi aux boutons, ou l'écart
   *  tapé ; ni l'un ni l'autre, c'est la proposition de la règle. */
  const [reglage, setReglage] = useState<{ lignes?: number; ecartLignes?: number }>(
    z?.lignes ? { lignes: z.lignes } : z?.ecartLignes ? { ecartLignes: z.ecartLignes } : {}
  );
  const [ecartTape, setEcartTape] = useState(z?.ecartLignes ? String(Math.round(z.ecartLignes * 100)) : "");
  const [invalides, setInvalides] = useState<string[]>([]);
  const [erreur, setErreur] = useState("");

  const titre =
    feuille.sorte === "point" ? (feuille.quoi === "nourrice" ? "La nourrice" : sortePiquage === "robinet" ? "Le robinet" : "Le compteur")
    : z ? nomDe(z)
    : ar ? (ar.nom || "Arbre")
    : (da?.nom || "Dalles");

  const touche = (champ: string, setter: (v: string) => void) => (v: string) => {
    setter(v);
    setInvalides((xs) => xs.filter((x) => x !== champ));
    setErreur("");
  };
  const goutte = z?.type === "haie" || z?.type === "massif" ? lignesDeLaZone(z.type, nombre(L), nombre(l), reglage) : null;

  function refuse(champs: [string, number | null][]): boolean {
    const vides = champs.filter(([, v]) => v === null).map(([c]) => c);
    setInvalides(vides);
    return vides.length > 0;
  }

  function valider() {
    if (feuille.sorte === "point") { onFermer(); return; }
    const leNom = nom.trim() || null;
    if (z) {
      const nL = nombre(L), nl = nombre(l);
      if (refuse([["L", nL], ["l", nl]])) return;
      const trop = [nL! > cadre.L + 1e-9 ? "L" : null, nl! > cadre.l + 1e-9 ? "l" : null].filter((x): x is string => x !== null);
      if (trop.length) { setInvalides(trop); setErreur(neTientPas(cadre)); return; }
      // Validée, la zone est vérifiée : ses cotes sont les siennes.
      onZone({ ...z, aVerifier: undefined, nom: leNom, L: nL!, l: nl!, lignes: goutte ? reglage.lignes : undefined, ecartLignes: goutte ? reglage.ecartLignes : undefined }, neuf);
    } else if (ar) {
      const nd = nombre(d);
      if (refuse([["d", nd]])) return;
      if (nd! > Math.max(cadre.L, cadre.l) + 1e-9) { setInvalides(["d"]); setErreur(neTientPas(cadre)); return; }
      onArbre({ ...ar, nom: leNom, d: nd! }, neuf);
    } else if (da) {
      const nDist = nombre(dist), nL = nombre(L), nl = nombre(l);
      if (refuse([["dist", nDist], ["L", nL], ["l", nl]])) return;
      if (arrosees === null) { setErreur("Dites si on les arrose."); return; }
      let b = arriveeA(da, nDist!);
      if (da.courbe) {
        if (!rangeeDansLeTerrain({ ...da, b }, cadre)) { setInvalides(["dist"]); setErreur(neTientPas(cadre)); return; }
      } else if (!arrosees) {
        // Celles qu'on n'arrose pas coupent la zone : le calcul ne connaît que
        // des rectangles, la rangée est donc droite, ou refusée.
        const droite = redressee(da.a, b);
        if (!droite) { setErreur(PHRASE_RANGEE_DROITE); return; }
        b = droite;
      }
      if (b.x < -1e-6 || b.y < -1e-6 || b.x > cadre.L + 1e-6 || b.y > cadre.l + 1e-6) { setInvalides(["dist"]); setErreur(neTientPas(cadre)); return; }
      if (nL! > nDist! + 1e-9) { setInvalides(["L"]); setErreur(`Plus longue que la distance, qui fait ${ecrit(nDist!)} m.`); return; }
      onDalles({ ...da, nom: leNom, L: nL!, l: nl!, e: nombre(e), b, arrosees }, neuf);
    }
  }

  function tourner() {
    const nL = nombre(L), nl = nombre(l);
    if (z && nL !== null && nl !== null && (nl > cadre.L + 1e-9 || nL > cadre.l + 1e-9)) { setErreur(neTientPas(cadre)); return; }
    setL(l);
    setl(L);
  }

  const noteDalles = (() => {
    if (!da) return "";
    // Le compte suit la longueur d'une dalle : c'est elle qui se pose dans le sens de la rangée.
    const nDist = nombre(dist), nL = nombre(L);
    if (nDist === null || nL === null) return "";
    const r = dallesDeLaRangee({ ...da, L: nL, e: nombre(e), b: arriveeA(da, nDist) });
    return `${ecritDalles(r.n)} sur ${ecrit(r.dist)} m.`;
  })();

  const champ = "mt-[5px] block w-full min-w-0 rounded-[10px] border-0 px-[12px] py-3 text-[16px]";
  const style = (c: string) => ({
    backgroundColor: colors.cream,
    color: colors.ink,
    boxShadow: `inset 0 0 0 ${invalides.includes(c) ? 2 : 1}px ${invalides.includes(c) ? colors.alert : colors.line}`,
  });
  const libelle = (pour: string, texte: string, haut = 12) => (
    <label className={`block ${libelleCaps}`} style={{ color: colors.muted, marginTop: haut }} htmlFor={pour}>
      {texte}
    </label>
  );
  const nombreChamp = (id: string, valeur: string, changer: (v: string) => void, auto = false) => (
    <input id={id} inputMode="decimal" enterKeyHint="done" autoComplete="off" autoFocus={auto} value={valeur} onChange={(ev) => changer(ev.target.value)} className={champ} style={style(id.replace("feuille-", ""))} />
  );
  const fermer = () => (neuf ? onFermer() : valider());
  const choix = (presse: boolean) => (presse
    ? { border: `1px solid ${colors.plein}`, backgroundColor: colors.plein, color: surPlein }
    : { border: `1px solid ${colors.line}`, backgroundColor: colors.cream, color: colors.ink });
  const aDeformer = !neuf && (z ? deformee(z) : da ? deformee(da) : false);

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center" style={{ backgroundColor: "rgba(0,0,0,.35)" }} onClick={fermer} data-atlas="feuille-dessin">
      <div
        role="dialog"
        aria-modal="true"
        aria-label={titre}
        onClick={(ev) => ev.stopPropagation()}
        onKeyDown={(ev) => { if (ev.key === "Escape") fermer(); if (ev.key === "Enter" && (ev.target as HTMLElement).tagName === "INPUT") { ev.preventDefault(); valider(); } }}
        className="atlas-feuille max-w-[430px] overflow-auto px-4 pt-[18px]"
        style={{ maxHeight: "86vh", backgroundColor: colors.cream, borderRadius: "18px 18px 0 0", paddingBottom: "calc(24px + env(safe-area-inset-bottom, 0px))" }}
      >
        <h2 className="m-0" style={{ fontFamily: font.display, fontWeight: 400, fontSize: 21, lineHeight: 1.2 }}>{titre}</h2>

        {feuille.sorte !== "point" && (
          <>
            {libelle("feuille-nom", "Nom", 14)}
            <input id="feuille-nom" autoComplete="off" value={nom} placeholder={z ? NOMS_DES_ZONES[z.type] : ar ? "Arbre" : "Dalles"} onChange={(ev) => setNom(ev.target.value)} className={champ} style={style("nom")} />
          </>
        )}
        {da && (
          <>
            {libelle("feuille-dist", "Distance")}
            {nombreChamp("feuille-dist", dist, touche("dist", setDist), true)}
          </>
        )}
        {(z || da) && (
          <div className="mt-3 grid grid-cols-2 gap-2">
            <span className="min-w-0">
              {libelle("feuille-L", da ? "Longueur d’une dalle" : "Longueur", 0)}
              {nombreChamp("feuille-L", L, (v) => {
                touche("L", setL)(v);
                // Le massif se compte sur son petit côté : la longueur peut l'être.
                if (z?.type === "massif" && reglage.lignes) setReglage({});
              }, !da)}
            </span>
            <span className="min-w-0">
              {libelle("feuille-l", da ? "Largeur d’une dalle" : "Largeur", 0)}
              {nombreChamp("feuille-l", l, (v) => {
                touche("l", setl)(v);
                // Une largeur changée garde l'écart tapé, mais un nombre de
                // lignes n'avait de sens que pour l'ancienne largeur.
                if (reglage.lignes) setReglage({});
              })}
            </span>
          </div>
        )}
        {z?.aVerifier?.deduites.map((d) => (
          <p key={d.champ} className="mt-[6px] text-[13px]" style={{ color: colors.orTexte }}>
            {`${d.champ === "L" ? "Longueur" : "Largeur"} pas écrite sur le croquis : ${d.depuis}.`}
          </p>
        ))}
        {ar && (
          <>
            {libelle("feuille-d", "Diamètre")}
            {nombreChamp("feuille-d", d, touche("d", setD), true)}
          </>
        )}
        {da && (
          <>
            {libelle("feuille-e", "Espacement entre deux dalles")}
            {nombreChamp("feuille-e", e, touche("e", setE))}
            <span id="arrosees-titre" className={`block ${libelleCaps}`} style={{ color: colors.muted, marginTop: 12 }}>On les arrose ?</span>
            <div role="group" aria-labelledby="arrosees-titre" className="mt-[6px] grid grid-cols-2 gap-2">
              {([[true, "Oui"], [false, "Non"]] as const).map(([v, mot]) => (
                <button
                  key={mot}
                  type="button"
                  aria-pressed={arrosees === v}
                  onClick={() => { setArrosees(v); setErreur(""); }}
                  className="min-h-[48px] rounded-full text-[15px] font-semibold"
                  style={choix(arrosees === v)}
                >
                  {mot}
                </button>
              ))}
            </div>
          </>
        )}
        {noteDalles && <p className="mt-[6px] text-[13px]" style={{ color: colors.muted }}>{noteDalles}</p>}
        {erreur && <p role="alert" className="mt-2 text-[14px] font-semibold" style={{ color: colors.alert }}>{erreur}</p>}

        {z && (z.type === "haie" || z.type === "massif") && (
          <div className="mt-[14px]">
            <span id="lignes-titre" className={`block ${libelleCaps}`} style={{ color: colors.muted }}>Lignes de goutte-à-goutte</span>
            <div role="group" aria-labelledby="lignes-titre" className="mt-[6px] grid items-center gap-2" style={{ gridTemplateColumns: "56px 1fr 56px" }}>
              <button type="button" aria-label="Une ligne de moins" disabled={!goutte || goutte.lignes <= 1} onClick={() => { if (goutte) { setReglage({ lignes: goutte.lignes - 1 }); setEcartTape(""); } }} className="min-h-[52px] rounded-full text-[22px] disabled:opacity-45" style={{ border: `1px solid ${colors.line}`, backgroundColor: colors.cream, color: colors.ink }}>−</button>
              <output aria-live="polite" className="text-center text-[17px]">{goutte ? ecritLignes(goutte.lignes) : "?"}</output>
              <button type="button" aria-label="Une ligne de plus" disabled={!goutte} onClick={() => { if (goutte) { setReglage({ lignes: goutte.lignes + 1 }); setEcartTape(""); } }} className="min-h-[52px] rounded-full text-[22px] disabled:opacity-45" style={{ border: `1px solid ${colors.line}`, backgroundColor: colors.cream, color: colors.ink }}>+</button>
            </div>
            {/* Sa demande du 22 octobre 2026 : l'écart s'écrit aussi, en cm. Le
                champ et les boutons se tiennent : taper l'écart refait le nombre
                de lignes, un bouton refait l'écart. */}
            <div className="mt-[10px] grid grid-cols-2 items-end gap-2">
              <span className="min-w-0">
                {libelle("feuille-ecart", "Écart, cm", 0)}
                {nombreChamp("feuille-ecart", ecartTape !== "" || !goutte ? ecartTape : String(Math.round(goutte.ecart * 100)), (v) => {
                  setEcartTape(v);
                  // Sous 5 cm, l'écart ne se pose pas : la vérification du serveur
                  // le refuserait, et la proposition reste.
                  const n = nombre(v);
                  setReglage(n && n >= 5 ? { ecartLignes: n / 100 } : {});
                })}
              </span>
              {goutte && <p className="pb-3 text-[14px]" style={{ color: colors.inkSoft }}>La première à {Math.round(goutte.ecart * 100)} cm du bord.</p>}
            </div>
            {goutte && (
              <p className="mt-[6px] text-[13px]" style={{ color: colors.muted }}>
                {goutte.lignes === goutte.propose && Math.abs(goutte.ecart - goutte.ecartOffice) < 0.005
                  ? "Proposé."
                  : `Proposé : ${ecritLignes(goutte.propose)}, tous les ${Math.round(goutte.ecartOffice * 100)} cm.`}
              </p>
            )}
            {goutte && nombre(L) && nombre(l) && <CoupeDesLignes lignes={goutte.lignes} ecart={goutte.ecart} long={z.type === "haie" ? nombre(L)! : Math.max(nombre(L)!, nombre(l)!)} travers={z.type === "haie" ? nombre(l)! : Math.min(nombre(L)!, nombre(l)!)} />}
          </div>
        )}

        <div className="mt-[18px] grid grid-cols-2 gap-2">
          {!neuf && feuille.sorte !== "point" && feuille.sorte !== "arbre" && (
            <button type="button" onClick={tourner} className="min-h-[56px] rounded-full text-[15px] font-semibold" style={{ border: `1px solid ${colors.line}`, backgroundColor: colors.cream, color: colors.ink }}>
              Tourner
            </button>
          )}
          <button
            type="button"
            data-atlas="feuille-valider"
            onClick={valider}
            className={`atlas-plein min-h-[56px] rounded-full border-0 text-[15px] font-semibold ${!neuf && feuille.sorte !== "point" && feuille.sorte !== "arbre" ? "" : "col-span-2"}`}
            style={{ backgroundColor: colors.plein, color: surPlein }}
          >
            {feuille.sorte === "point" ? "Fermer" : neuf ? "Poser" : "Valider"}
          </button>
        </div>
        {aDeformer && (
          <button type="button" onClick={() => onFormeDOrigine((z ?? da)!.id)} className="mr-[18px] mt-[6px] min-h-[44px] border-0 bg-transparent p-0 text-[14px] underline" style={{ color: colors.inkSoft }}>
            Forme d’origine
          </button>
        )}
        {!neuf && (
          <button type="button" onClick={onSupprimer} className="mt-[6px] min-h-[44px] border-0 bg-transparent p-0 text-[14px] underline" style={{ color: colors.alert }}>
            Supprimer
          </button>
        )}
      </div>
    </div>
  );
}

function neTientPas(cadre: { L: number; l: number }): string {
  return `Ne tient pas dans le terrain, qui fait ${ecrit(cadre.L)} × ${ecrit(cadre.l)} m.`;
}
