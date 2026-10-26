"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { colors, font, surPlein, voile } from "@/lib/design-tokens";
import ActionDuBas from "./ActionDuBas";
import Icone from "./Icones";
import { etatDuCroquis, zoneMesuree } from "@/lib/arrosage/croquis-complet";
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
  type SensDesLignes,
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
 * | le zoom | d'abord une échelle en centièmes (« un centième, un deux centième ») ; remplacée le 22 octobre 2026 par − et + sous le dessin, sa planche revue avec impeccable. Deux doigts agrandissent là où ils sont posés, un doigt fait glisser |
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
type Outil = "arbre" | "arbuste" | "dalles" | "nourrice" | "compteur" | "robinet";
type Zone = Omit<ZoneDessinee, "type"> & { type: Sorte; id: string; aVerifier?: AVerifier };
/** Un arbre ou un arbuste : un rond chiffonné ; l'arbuste en blanc, pour les
 *  différencier (sa demande du 22 octobre 2026). Ni l'un ni l'autre ne change le plan. */
type Arbre = { id: string; sorte: "arbre" | "arbuste"; nom: string | null; d: number; x: number; y: number };
const NOM_DU_ROND = { arbre: "Arbre", arbuste: "Arbuste" } as const;
type Dalles = Rangee & { id: string; nom: string | null; L: number; l: number; e: number | null; arrosees?: boolean };

const SORTES: Sorte[] = ["gazon", "potager", "massif", "haie", "maison"];
/** Ce qui entoure le terrain, en pixels d'écran : la place de ses cotes. */
const MARGE_PX = 30;
/** Le zoom : un appui sur + rapproche d'autant, et les deux doigts vont jusqu'à 40. */
const PAS_DU_ZOOM = 1.5;
const ZOOM_MAX = 40;

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
/** L'objet sans les clés nommées : un réglage qui en remplace un autre. */
function sans<T extends object>(o: T, ...cles: (keyof T)[]): T {
  const c = { ...o };
  for (const k of cles) delete c[k];
  return c;
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
  // Le zoom − et + remplace l'échelle en centièmes (planche du 22 octobre
  // 2026) : « 1/200 » ne se lit pas sur un chantier, « voir plus près » si.
  const parM = ajuste * loupe;
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
  /**
   * À quelle liste appartient un objet. Elle se CHERCHE : la première lettre de
   * l'identifiant la devinait (« z » une zone, « a » un arbre), et les zones
   * lues sur la photo, nommées « lu1 », passaient pour des dalles et ne
   * suivaient plus le doigt (sa capture du 23 octobre 2026).
   */
  function sorteDe(id: string): "nourrice" | "piquage" | "zone" | "arbre" | "dalles" {
    if (id === "nourrice" || id === "piquage") return id;
    if (zones.some((z) => z.id === id)) return "zone";
    return arbres.some((a) => a.id === id) ? "arbre" : "dalles";
  }
  /** Remet un objet tel qu'il était : ce que le premier doigt tenait, quand le second arrive. */
  function remettre(id: string, o: Zone | Arbre | Dalles | PointMetres) {
    const sorte = sorteDe(id);
    if (sorte === "nourrice") setNourrice(o as PointMetres);
    else if (sorte === "piquage") setPiquagePlace(o as PointMetres);
    else if (sorte === "zone") setZones((zs) => zs.map((x) => (x.id === id ? (o as Zone) : x)));
    else if (sorte === "arbre") setArbres((as) => as.map((x) => (x.id === id ? (o as Arbre) : x)));
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
    if (outil === "arbre" || outil === "arbuste") {
      setOutil(null);
      setFeuille({ sorte: "arbre", arbre: { id: "", sorte: outil, nom: null, d: 0, x: p.x, y: p.y }, neuf: true });
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
    const pas = (v: number) => auPas(v, loupe);
    const point = (q: PointMetres) => ({ x: borne(pas(q.x + dx), cadre.L), y: borne(pas(q.y + dy), cadre.l) });
    const sorte = sorteDe(pr.id);
    if (sorte === "nourrice") setNourrice(point(a as PointMetres));
    else if (sorte === "piquage") setPiquagePlace(point(a as PointMetres));
    else if (sorte === "zone") {
      const z = a as Zone;
      setZones((zs) => zs.map((x) => (x.id === pr.id ? { ...x, x: borne(pas(z.x + dx), Math.max(0, cadre.L - z.L)), y: borne(pas(z.y + dy), Math.max(0, cadre.l - z.l)) } : x)));
    } else if (sorte === "arbre") {
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
      setLoupe(Math.max(1, Math.min(ZOOM_MAX, (pi.loupe * d.ecart) / pi.ecart)));
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
    : outil === "arbuste" ? "Touchez le centre de l’arbuste."
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
        <h2 className="m-0" style={{ fontFamily: font.display, fontWeight: 400, fontSize: 21, lineHeight: 1.2 }}>Le terrain</h2>
        <div className="mt-3 grid grid-cols-2 gap-[10px]">
          {(["L", "l"] as const).map((c) => (
            <span key={c} className="min-w-0">
              <label className="block text-[14.5px] font-semibold" style={{ color: colors.inkSoft }} htmlFor={`terrain-${c}`}>
                {c === "L" ? "Longueur" : "Largeur"}
              </label>
              <span className="relative block">
                <input
                  id={`terrain-${c}`}
                  inputMode="decimal"
                  enterKeyHint="done"
                  autoComplete="off"
                  value={terrainSaisi[c]}
                  onChange={(e) => surTerrain(c, e.target.value)}
                  className={champ}
                  style={{ ...styleChamp, paddingRight: 40 }}
                />
                <span aria-hidden="true" className="pointer-events-none absolute right-[14px] top-1/2 mt-[2px] -translate-y-1/2 text-[14px]" style={{ color: colors.muted }}>m</span>
              </span>
            </span>
          ))}
        </div>
      </div>

      <div ref={boite} className="mx-[22px] mt-3 overflow-auto rounded-[6px] p-[10px]" style={{ backgroundColor: colors.card, maxHeight: "68vh", overscrollBehavior: "contain" }}>
        <svg
          ref={svg}
          data-atlas="toile"
          role="img"
          aria-label="Le terrain et ses zones"
          viewBox={`${-m} ${-m} ${vue.L + 2 * m} ${vue.l + 2 * m}`}
          // Safari ne lit que la forme préfixée : sans elle, un appui long sur le
          // nom d'une zone sélectionne le texte et lui reprend le doigt.
          style={{ display: "block", width: agrandi ? Math.round((vue.L + 2 * m) * parM) : "100%", height: "auto", touchAction: "none", userSelect: "none", WebkitUserSelect: "none", WebkitTouchCallout: "none" }}
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

          {/* Les petits par-dessus les grands : un arbuste sous un arbre resterait inattrapable. */}
          {[...arbres].sort((a, b) => b.d - a.d).map((a) => (
            <g key={a.id} data-objet={a.id} style={{ cursor: "grab" }}>
              <path d={festons(a.x, a.y, a.d / 2, px)} fill={a.sorte === "arbuste" ? colors.card : voile(colors.plein, 0.52)} stroke={colors.rustDeep} strokeWidth={px(1.5)} strokeLinejoin="round" />
              <text x={a.x} y={a.y + a.d / 2 + px(12)} textAnchor="middle" fontSize={px(9.5)} fill={colors.ink} {...texteDetache}>
                {`${a.nom ?? NOM_DU_ROND[a.sorte]}, Ø ${ecrit(a.d)} m`}
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

      {/* Le zoom vit sous le dessin, à côté de la consigne : posé dessus, il
          cachait ce qui est dans le coin, la nourrice la première. */}
      <div className="mx-[22px] mt-[10px] flex items-center gap-3">
        <p data-atlas="consigne-dessin" aria-live="polite" className="m-0 min-h-[21px] flex-1 text-[14.5px] leading-[1.4]" style={{ color: colors.inkSoft }}>
          {consigne}
        </p>
        <div role="group" aria-label="Zoom" className="flex flex-none gap-2">
          {([["Voir plus loin", false], ["Voir plus près", true]] as const).map(([nom, plus]) => (
            <button
              key={nom}
              type="button"
              aria-label={nom}
              data-atlas={plus ? "zoom-plus" : "zoom-moins"}
              disabled={!cadre || (plus ? loupe >= ZOOM_MAX : loupe <= 1)}
              onClick={() => setLoupe((z) => (plus ? Math.min(ZOOM_MAX, z * PAS_DU_ZOOM) : Math.max(1, z / PAS_DU_ZOOM)))}
              className="flex h-12 w-12 items-center justify-center rounded-full bg-transparent disabled:opacity-40"
              style={{ boxShadow: `inset 0 0 0 1.5px ${colors.line}`, color: colors.ink }}
            >
              <SigneMoinsPlus plus={plus} />
            </button>
          ))}
        </div>
      </div>
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

      {/* **TROIS FAMILLES AU LIEU DE DIX BOUTONS EN VRAC** — sa planche du
          22 octobre 2026 revue avec impeccable : ce qui s'arrose, ce qu'on
          contourne, et l'eau. Au compteur ou au robinet, un seul bouton, celui
          que « Le piquage se fait… » a choisi. */}
      <div className="mx-[22px] mt-1">
        {(
          [
            ["À arroser", (["gazon", "potager", "massif", "haie"] as const).map((s) => ({ cle: s, nom: NOMS_DES_ZONES[s] }))],
            ["À contourner", [{ cle: "maison", nom: NOMS_DES_ZONES.maison }, { cle: "arbre", nom: "Arbre" }, { cle: "arbuste", nom: "Arbuste" }, { cle: "dalles", nom: "Dalles" }]],
            ["L’eau", [{ cle: sortePiquage, nom: sortePiquage === "robinet" ? "Robinet" : "Compteur" }, { cle: "nourrice", nom: "Nourrice" }]],
          ] as const
        ).map(([titre, outils]) => (
          <div key={titre} className="mt-[14px]">
            <span className="block text-[13px] font-semibold uppercase tracking-[0.12em]" style={{ color: colors.inkSoft }}>{titre}</span>
            <div role="toolbar" aria-label={titre} className="mt-2 grid grid-cols-4 gap-2">
              {outils.map(({ cle, nom }) => {
                const estZone = (SORTES as readonly string[]).includes(cle);
                const actif = !estZone && outil === cle;
                return (
                  <button
                    key={cle}
                    type="button"
                    data-outil={cle}
                    aria-pressed={actif}
                    disabled={!cadre}
                    onClick={() => {
                      if (estZone) { setFeuille({ sorte: "zone", zone: { id: "", type: cle as Sorte, nom: null, L: 0, l: 0, x: 0, y: 0 }, neuve: true }); return; }
                      setDepartDalles(null);
                      const o = cle as Outil;
                      setOutil(outil === o ? null : o);
                      // Les outils sont sous le dessin : il faut le voir pour toucher l'endroit.
                      if (outil !== o) boite.current?.scrollIntoView({ block: "center", behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
                    }}
                    className="flex min-h-[76px] flex-col items-center justify-center gap-[6px] rounded-[12px] border-0 px-1 py-2 text-[14px] disabled:opacity-45"
                    style={actif
                      ? { backgroundColor: colors.plein, color: surPlein }
                      : { backgroundColor: colors.card, color: colors.ink, boxShadow: `inset 0 0 0 1px ${colors.line}` }}
                  >
                    <span className="block h-[18px] scale-[1.35]">{estZone ? <SigneZone sorte={cle as Sorte} /> : <SigneOutil outil={cle as Outil} />}</span>
                    <span>{nom}</span>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      <ul data-atlas="etat-dessin" aria-live="polite" className="mx-[22px] mt-[14px] list-none p-0">
        {manquantes.map((p) => <Ligne key={p} rouge>{p}</Ligne>)}
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

      {/* **AVANT LE PLAN : QUATRE ÉTAPES COCHÉES** (planche du 22 octobre
          2026). Les lignes rouges « il manque » deviennent une liste qui se
          coche au fil du dessin, et ce qui manque se pose d'ici. « Faire le
          plan » reste visible, grisé tant que tout n'est pas là. */}
      <section aria-labelledby="avant-le-plan" className="mx-[22px] mt-[22px] rounded-[6px] px-[18px] pb-2 pt-4" style={{ backgroundColor: colors.card }}>
        <h3 id="avant-le-plan" className="m-0" style={{ fontFamily: font.display, fontWeight: 400, fontSize: 19 }}>Avant le plan</h3>
        <ol data-atlas="etapes-du-plan" className="m-0 mt-[10px] list-none p-0">
          {(
            [
              ["terrain", "Le terrain", !!cadre],
              ["zone", "Une zone à arroser", !etat.manque.includes("metres")],
              [sortePiquage, sortePiquage === "robinet" ? "Le robinet" : "Le compteur", piquagePlace !== null],
              ["nourrice", "La nourrice", nourrice !== null],
            ] as const
          ).map(([cle, nom, fait]) => (
            <li key={cle} data-etape={cle} data-fait={fait} className="flex min-h-[52px] items-center gap-3 py-[6px] text-[16px]" style={{ borderTop: `1px solid ${colors.line}`, color: fait ? colors.ink : colors.inkSoft }}>
              <span aria-hidden="true" className="flex h-6 w-6 flex-none items-center justify-center rounded-full" style={fait ? { backgroundColor: colors.carteVertFond } : { boxShadow: `inset 0 0 0 1.5px ${colors.line}` }}>
                {fait && (
                  <svg width={12} height={12} viewBox="0 0 12 12"><path d="M2.5 6.2l2.3 2.3L9.5 3.6" fill="none" stroke={colors.carteVertTexte} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" /></svg>
                )}
              </span>
              <span>{nom}</span>
              {!fait && (
                <button
                  type="button"
                  className="ml-auto min-h-[44px] rounded-full px-[18px] text-[15px] font-semibold"
                  style={{ boxShadow: `inset 0 0 0 1.5px ${colors.line}`, backgroundColor: colors.cream, color: colors.ink }}
                  onClick={() => {
                    if (cle === "terrain") { document.getElementById("terrain-L")?.focus(); return; }
                    if (cle === "zone") { setFeuille({ sorte: "zone", zone: { id: "", type: "gazon", nom: null, L: 0, l: 0, x: 0, y: 0 }, neuve: true }); return; }
                    setDepartDalles(null);
                    setOutil(cle);
                    boite.current?.scrollIntoView({ block: "center", behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
                  }}
                >
                  {cle === "terrain" ? "Écrire" : "Poser"}
                </button>
              )}
            </li>
          ))}
        </ol>
      </section>

      {/* **FAIRE LE PLAN, SOUS LE POUCE** — sa planche soignée du 26 octobre
          2026 : collé en bas pendant qu'il vérifie le dessin, grisé tant que
          tout n'est pas là, comme avant. */}
      <ActionDuBas>
        <button
          type="button"
          data-atlas="faire-le-plan"
          disabled={!pret || !dessin || enCours}
          onClick={() => dessin && onFaire(JSON.stringify(dessin))}
          className="atlas-plein flex min-h-[56px] w-full items-center justify-center gap-[10px] rounded-full border-0 text-[17px] font-semibold"
          style={pret ? { backgroundColor: colors.plein, color: surPlein } : { backgroundColor: colors.rustTint, color: colors.muted }}
        >
          {enCours ? (
            <>
              Calcul du plan
              <PointsQuiSoufflent />
            </>
          ) : (
            <>
              <Icone nom="etincelle" />
              Faire le plan
            </>
          )}
        </button>
      </ActionDuBas>

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

/** La zone vue EN TRAVERS, comme on la creuse : sa largeur à plat, les tuyaux
 *  en points, l'écart du bord coté en or, l'écart entre deux en encre. Sa
 *  planche du 22 octobre 2026. */
function CoupeDesLignes({ lignes, bord, entre, long, travers }: { lignes: number; bord: number; entre: number; long: number; travers: number }) {
  const W = 10, k = W / travers, sol = 2.1;
  const xs = Array.from({ length: lignes }, (_, i) => Math.min(travers, bord + i * entre) * k);
  const milieu = (a: number, b: number) => Math.max(0.7, Math.min(W - 0.7, (a + b) / 2));
  // Deux écarts serrés : le second monte d'un étage, les chiffres ne se
  // couvrent plus. L'étage ne se réserve que s'il sert.
  const monte = lignes >= 2 && Math.abs(milieu(xs[0], xs[1]) - milieu(0, xs[0])) < 1.9 ? 0.85 : 0;
  const halo = { stroke: colors.card, strokeWidth: 0.12, paintOrder: "stroke" as const };
  const cote = (x1: number, x2: number, couleur: string, t: string, haut: number) => {
    if (x2 - x1 < 1e-6) return null;
    const y = 1.1 - haut, bas = haut ? y + 0.15 : 1.25;
    return (
      <g>
        <line x1={x1} y1={y} x2={x2} y2={y} stroke={couleur} strokeWidth={0.035} />
        <line x1={x1} y1={y - 0.15} x2={x1} y2={bas} stroke={couleur} strokeWidth={0.035} />
        <line x1={x2} y1={y - 0.15} x2={x2} y2={bas} stroke={couleur} strokeWidth={0.035} />
        <text x={milieu(x1, x2)} y={y - 0.38} textAnchor="middle" fontSize={0.42} fontWeight={600} fill={couleur} {...halo}>{t}</text>
      </g>
    );
  };
  return (
    <svg viewBox={`-0.4 ${0.1 - monte} ${W + 0.8} ${3.4 + monte}`} style={{ display: "block", width: "100%", height: "auto", marginTop: 6 }} aria-hidden="true">
      <rect x={0} y={sol} width={W} height={0.7} rx={0.08} fill={voile(colors.plein, 0.3)} stroke={colors.rustDeep} strokeWidth={0.03} />
      {xs.map((x, i) => (
        <g key={i}>
          <line x1={x} y1={1.15} x2={x} y2={sol} stroke={colors.line} strokeWidth={0.03} strokeDasharray="0.08 0.08" />
          <circle cx={x} cy={sol + 0.12} r={0.17} fill={colors.ink} />
        </g>
      ))}
      {lignes >= 1 && cote(0, xs[0], colors.orTexte, `${Math.round(bord * 100)} cm`, 0)}
      {lignes >= 2 && cote(xs[0], xs[1], colors.ink, `${Math.round(entre * 100)} cm`, monte)}
      <text x={W / 2} y={sol + 1.25} textAnchor="middle" fontSize={0.42} fill={colors.inkSoft} {...halo}>{`${ecrit(travers)} m en travers, lignes de ${ecrit(long)} m`}</text>
    </svg>
  );
}

/** Le − et le + se dessinent, d'un même trait : un caractère change de graisse
 *  et de place d'une police à l'autre. */
function SigneMoinsPlus({ plus }: { plus: boolean }) {
  return (
    <svg width={20} height={20} viewBox="0 0 20 20" aria-hidden="true">
      <path d={`M4 10h12${plus ? "M10 4v12" : ""}`} stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" />
    </svg>
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


function SigneZone({ sorte }: { sorte: Sorte }) {
  return (
    <svg viewBox="0 0 18 18" width={18} height={18} aria-hidden="true">
      {sorte === "maison" ? (
        <path d="M3 8.5L9 3.5L15 8.5V15H3Z" fill={remplissage(sorte)} stroke={colors.ink} strokeLinejoin="round" />
      ) : (
        <rect x={2} y={sorte === "haie" ? 7 : 4} width={14} height={sorte === "haie" ? 4 : 10} rx={1.5} fill={remplissage(sorte)} stroke={colors.rustDeep} />
      )}
    </svg>
  );
}

function SigneOutil({ outil }: { outil: Outil }) {
  const fond = voile(colors.muted, 0.6);
  return (
    <svg viewBox="0 0 18 18" width={18} height={18} aria-hidden="true">
      {outil === "arbre" && <path d={festons(9, 9, 6.5, () => 0.4)} fill={voile(colors.plein, 0.52)} stroke={colors.rustDeep} />}
      {outil === "arbuste" && <path d={festons(9, 9, 4.5, () => 0.3)} fill={colors.card} stroke={colors.rustDeep} />}
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
  /** Pour le nombre, une seule source à la fois : les boutons, ou l'écart
   *  entre deux lignes tapé ; ni l'un ni l'autre, c'est la proposition. Le bord
   *  et le sens se gardent toujours (planche du 22 octobre 2026). */
  const [reglage, setReglage] = useState<{ lignes?: number; ecartLignes?: number; ecartBord?: number; sensLignes?: SensDesLignes }>({
    ...(z?.lignes ? { lignes: z.lignes } : z?.ecartLignes ? { ecartLignes: z.ecartLignes } : {}),
    ...(z?.ecartBord ? { ecartBord: z.ecartBord } : {}),
    ...(z?.sensLignes ? { sensLignes: z.sensLignes } : {}),
  });
  const [entreTape, setEntreTape] = useState("");
  const [bordTape, setBordTape] = useState("");
  const [invalides, setInvalides] = useState<string[]>([]);
  const [erreur, setErreur] = useState("");

  const titre =
    feuille.sorte === "point" ? (feuille.quoi === "nourrice" ? "La nourrice" : sortePiquage === "robinet" ? "Le robinet" : "Le compteur")
    : z ? nomDe(z)
    : ar ? (ar.nom || NOM_DU_ROND[ar.sorte])
    : (da?.nom || "Dalles");

  const touche = (champ: string, setter: (v: string) => void) => (v: string) => {
    setter(v);
    setInvalides((xs) => xs.filter((x) => x !== champ));
    setErreur("");
  };
  const goutte = z?.type === "haie" || z?.type === "massif" ? lignesDeLaZone(z.type, nombre(L), nombre(l), reglage) : null;
  const bordTrop = !!goutte && goutte.bord >= goutte.travers - 1e-9;

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
      if (bordTrop) { setInvalides(["bord"]); setErreur("Le bord dépasse la largeur."); return; }
      onZone({
        ...z, aVerifier: undefined, nom: leNom, L: nL!, l: nl!,
        lignes: goutte ? reglage.lignes : undefined,
        ecartLignes: goutte ? reglage.ecartLignes : undefined,
        ecartBord: goutte ? reglage.ecartBord : undefined,
        sensLignes: goutte ? reglage.sensLignes : undefined,
      }, neuf);
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
    <label className="block text-[14.5px] font-semibold" style={{ color: colors.inkSoft, marginTop: haut }} htmlFor={pour}>
      {texte}
    </label>
  );
  // L'unité se lit dans la case (planche du 22 octobre 2026) : « 12 m » se
  // vérifie d'un regard, « 12 » laisse deviner si ce sont des mètres.
  const nombreChamp = (id: string, valeur: string, changer: (v: string) => void, auto = false, unite = "m") => (
    <span className="relative block">
      <input id={id} inputMode="decimal" enterKeyHint="done" autoComplete="off" autoFocus={auto} value={valeur} onChange={(ev) => changer(ev.target.value)} className={champ} style={{ ...style(id.replace("feuille-", "")), paddingRight: 40 }} />
      <span aria-hidden="true" className="pointer-events-none absolute right-[14px] top-1/2 mt-[2px] -translate-y-1/2 text-[14px]" style={{ color: colors.muted }}>{unite}</span>
    </span>
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
        className="atlas-feuille max-w-[430px] overflow-auto px-4 pt-[2px]"
        style={{ maxHeight: "86vh", backgroundColor: colors.cream, borderRadius: "18px 18px 0 0", paddingBottom: "calc(24px + env(safe-area-inset-bottom, 0px))" }}
      >
        {/* **LA POIGNÉE REFERME, SANS RIEN VALIDER** — sa demande du 23 octobre
            2026 : *« rajoute le trait en haut pour pouvoir refermer la
            page »*. Le fond, lui, valide : sur une zone lue sans cotes, il
            refuse, et la feuille restait ouverte sans autre issue que de
            taper des chiffres. La poignée se touche ou se tire vers le bas
            (le doigt est capturé, il peut sortir du trait), et reste en haut
            quand la feuille défile. Même dessin que `BottomSheet`. */}
        <button
          type="button"
          aria-label="Refermer"
          data-atlas="feuille-poignee"
          onPointerDown={(ev) => ev.currentTarget.setPointerCapture(ev.pointerId)}
          onPointerUp={onFermer}
          onClick={(ev) => { if (ev.detail === 0) onFermer(); }}
          className="sticky top-0 z-10 -mx-4 mb-1 flex h-7 w-[calc(100%+2rem)] items-center justify-center"
          style={{ backgroundColor: colors.cream, touchAction: "none" }}
        >
          <span className="h-1 w-10 rounded-full" style={{ backgroundColor: colors.line }} />
        </button>
        <h2 className="m-0" style={{ fontFamily: font.display, fontWeight: 400, fontSize: 21, lineHeight: 1.2 }}>{titre}</h2>

        {feuille.sorte !== "point" && (
          <>
            {libelle("feuille-nom", "Nom", 14)}
            <input id="feuille-nom" autoComplete="off" value={nom} placeholder={z ? NOMS_DES_ZONES[z.type] : ar ? NOM_DU_ROND[ar.sorte] : "Dalles"} onChange={(ev) => setNom(ev.target.value)} className={champ} style={style("nom")} />
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
                // Un nombre de lignes n'avait de sens que pour l'ancienne cote.
                if (reglage.lignes) setReglage((r) => sans(r, "lignes"));
              }, !da)}
            </span>
            <span className="min-w-0">
              {libelle("feuille-l", da ? "Largeur d’une dalle" : "Largeur", 0)}
              {nombreChamp("feuille-l", l, (v) => {
                touche("l", setl)(v);
                // Une largeur changée garde les écarts, mais un nombre de
                // lignes n'avait de sens que pour l'ancienne largeur.
                if (reglage.lignes) setReglage((r) => sans(r, "lignes"));
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
            <span id="arrosees-titre" className="block text-[14.5px] font-semibold" style={{ color: colors.inkSoft, marginTop: 12 }}>On les arrose ?</span>
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

        {/* **LE GOUTTE-À-GOUTTE, SA PLANCHE DU 22 OCTOBRE 2026**
            (`appli/arrosage-feuille-des-lignes.html`, « code ça ») : le sens,
            dans la longueur ou dans la largeur (« c'est pas la même chose »),
            la coupe, le nombre de lignes, et deux écarts à taper, du bord et
            entre deux lignes. */}
        {z && (z.type === "haie" || z.type === "massif") && (
          <section aria-labelledby="gag-titre" className="mt-[18px] rounded-[16px] px-4 pb-4 pt-[18px]" style={{ backgroundColor: colors.card, boxShadow: `inset 0 0 0 1px ${colors.line}` }}>
            <h3 id="gag-titre" className="m-0" style={{ fontFamily: font.display, fontWeight: 400, fontSize: 19, lineHeight: 1.2 }}>Goutte-à-goutte</h3>
            <div role="radiogroup" aria-label="Sens des lignes" className="mt-3 grid grid-cols-2 rounded-full p-1" style={{ backgroundColor: colors.cream, boxShadow: `inset 0 0 0 1px ${colors.line}` }}>
              {(["longueur", "largeur"] as const).map((sens) => {
                const oui = goutte?.sens === sens;
                return (
                  <button
                    key={sens}
                    type="button"
                    role="radio"
                    aria-checked={oui}
                    data-sens={sens}
                    disabled={!goutte}
                    onClick={() => setReglage((r) => ({ ...sans(r, "lignes"), sensLignes: sens }))}
                    className="min-h-[44px] rounded-full border-0 text-[14.5px] font-semibold"
                    style={{ backgroundColor: oui ? colors.plein : "transparent", color: oui ? surPlein : colors.inkSoft }}
                  >
                    {sens === "longueur" ? "Dans la longueur" : "Dans la largeur"}
                  </button>
                );
              })}
            </div>
            {goutte && !bordTrop && <CoupeDesLignes lignes={goutte.lignes} bord={goutte.bord} entre={goutte.entre} long={goutte.long} travers={goutte.travers} />}
            <div role="group" aria-label="Nombre de lignes" className="mt-[18px] flex items-center gap-3">
              <button type="button" aria-label="Une ligne de moins" disabled={!goutte || bordTrop || goutte.lignes <= 1} onClick={() => { if (goutte) { setReglage((r) => ({ ...sans(r, "ecartLignes"), lignes: goutte.lignes - 1 })); setEntreTape(""); } }} className="flex h-14 w-14 flex-none items-center justify-center rounded-full disabled:opacity-40" style={{ border: `1px solid ${colors.line}`, backgroundColor: colors.card, color: colors.ink }}>
                <SigneMoinsPlus plus={false} />
              </button>
              <output aria-live="polite" className="flex-1 text-center">
                <span className="block" style={{ fontFamily: font.display, fontSize: 38, lineHeight: 1, fontVariantNumeric: "tabular-nums" }}>{goutte && !bordTrop ? goutte.lignes : "?"}</span>
                <span className="mt-1 block text-[13px]" style={{ color: colors.muted }}>{goutte?.lignes === 1 ? "ligne" : "lignes"}</span>
              </output>
              <button type="button" aria-label="Une ligne de plus" disabled={!goutte || bordTrop} onClick={() => { if (goutte) { setReglage((r) => ({ ...sans(r, "ecartLignes"), lignes: goutte.lignes + 1 })); setEntreTape(""); } }} className="flex h-14 w-14 flex-none items-center justify-center rounded-full disabled:opacity-40" style={{ border: `1px solid ${colors.line}`, backgroundColor: colors.card, color: colors.ink }}>
                <SigneMoinsPlus plus />
              </button>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <span className="min-w-0">
                {libelle("feuille-bord", "Du bord", 0)}
                {nombreChamp("feuille-bord", bordTape !== "" || !goutte ? bordTape : String(Math.round(goutte.bord * 100)), (v) => {
                  setBordTape(v);
                  setInvalides((xs) => xs.filter((x) => x !== "bord"));
                  setErreur("");
                  // Sous 5 cm, l'écart ne se pose pas : la vérification du serveur
                  // le refuserait, et l'office reste.
                  const n = nombre(v);
                  setReglage((r) => (n && n >= 5 ? { ...r, ecartBord: n / 100 } : sans(r, "ecartBord")));
                }, false, "cm")}
              </span>
              <span className="min-w-0">
                {libelle("feuille-entre", "Entre deux", 0)}
                {nombreChamp("feuille-entre", entreTape !== "" || !goutte ? entreTape : goutte.lignes > 1 ? String(Math.round(goutte.entre * 100)) : "", (v) => {
                  setEntreTape(v);
                  const n = nombre(v);
                  setReglage((r) => (n && n >= 5 ? { ...sans(r, "lignes"), ecartLignes: n / 100 } : sans(r, "ecartLignes")));
                }, false, "cm")}
              </span>
            </div>
            {bordTrop && <p role="alert" className="mt-2 text-[14px] font-semibold" style={{ color: colors.alert }}>Le bord dépasse la largeur.</p>}
            {goutte && (() => {
              const estPropose = goutte.lignes === goutte.propose && Math.abs(goutte.bord - goutte.ecartOffice) < 0.005 && (goutte.lignes <= 1 || Math.abs(goutte.entre - goutte.ecartOffice) < 0.005);
              return (
                <div className="mt-[10px] flex min-h-[44px] items-center gap-[10px]">
                  <p className="m-0 flex-1 text-[13.5px] leading-[1.4]" style={{ color: colors.muted }}>
                    {estPropose ? "Proposé." : `Proposé : ${ecritLignes(goutte.propose)}, tous les ${Math.round(goutte.ecartOffice * 100)} cm.`}
                  </p>
                  {!estPropose && (
                    <button type="button" data-atlas="remettre-lignes" onClick={() => { setReglage(({ sensLignes }) => (sensLignes ? { sensLignes } : {})); setEntreTape(""); setBordTape(""); setInvalides((xs) => xs.filter((x) => x !== "bord")); }} className="min-h-[44px] flex-none rounded-full px-4 text-[14px] font-semibold" style={{ border: `1px solid ${colors.line}`, backgroundColor: colors.cream, color: colors.ink }}>
                      Remettre
                    </button>
                  )}
                </div>
              );
            })()}
            {goutte && !bordTrop && (
              <p className="m-0 mt-[14px] flex items-baseline gap-[6px] pt-3" style={{ borderTop: `1px solid ${colors.line}` }}>
                <span style={{ fontFamily: font.display, fontSize: 26, lineHeight: 1 }}>{Math.ceil(goutte.lignes * goutte.long - 1e-9)}</span>
                <span className="text-[14px]" style={{ color: colors.inkSoft }}>m de tube</span>
              </p>
            )}
          </section>
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
