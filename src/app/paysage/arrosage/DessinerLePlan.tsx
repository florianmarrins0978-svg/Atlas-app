"use client";

import { useEffect, useRef, useState } from "react";
import { colors, font, libelleCaps, surPlein, voile } from "@/lib/design-tokens";
import { etatDuCroquis, LIBELLES, zoneMesuree } from "@/lib/arrosage/croquis-complet";
import { longueurDeLAmenee } from "@/lib/arrosage/geometrie-croquis";
import {
  croquisDuDessin,
  lignesProposees,
  zonesQuiDebordent,
  type PointMetres,
  type ZoneDessinee,
} from "@/lib/arrosage/dessin-du-plan";
import PointsQuiSoufflent from "@/components/atlas/PointsQuiSoufflent";

/**
 * DESSINER LE PLAN — sa planche B, choisie le 18 octobre 2026 (*« la B, parce
 * qu'il faut que ça soit à l'échelle »*), puis *« tu peux coder »*.
 *
 * **À l'échelle** : il tape les métrés du terrain, puis ceux de chaque zone ;
 * la zone se pose à sa taille, il la glisse à sa place. Tout ce que la planche
 * a reçu de lui le même soir est là :
 *
 * | | sa demande |
 * |---|---|
 * | la haie | « la largeur de la haie, pas simplement la longueur » ; ses lignes proposées par la largeur, réglables par − et +, sans plafond |
 * | le cadre | « je peux poser un carré de 12 par 12 alors que mon cadre fait 10 par 10, il faut pouvoir bloquer ça » |
 * | l'échelle | « un centième, un deux centième, pour être plus précis » : à 1/100, un mètre fait un centimètre d'écran |
 * | les arbres | « des ronds un peu chiffonnés ; on marquerait arbre et la taille du rond » |
 * | les dalles | « on cliquerait un endroit, puis un deuxième » ; la distance préécrite, puis la longueur et la largeur d'une dalle, et l'espacement |
 *
 * **Les arbres et les dalles se dessinent, le calcul ne les lit pas** : ils ne
 * partent pas au serveur, et l'écran le dit.
 *
 * **Le piquage ne se contredit pas** : « Compteur » ou « Robinet » posé ici
 * règle aussi « Le piquage se fait… » au-dessus, qui commande le débit.
 *
 * Les règles (ce qui tient dans le terrain, la proposition de lignes, ce qui
 * manque, l'amenée) sont celles du serveur, prises dans `src/lib/arrosage/` :
 * l'écran ne décide de rien qu'il ne refasse là-bas.
 */

type Sorte = "gazon" | "potager" | "massif" | "haie";
type Outil = "arbre" | "dalles" | "nourrice" | "compteur" | "robinet";
type Zone = ZoneDessinee & { id: string; lignesChoisies?: boolean };
type Arbre = { id: string; nom: string | null; d: number; x: number; y: number };
type Dalles = { id: string; nom: string | null; L: number; l: number; e: number | null; a: PointMetres; b: PointMetres };

const NOMS: Record<Sorte, string> = { gazon: "Pelouse", potager: "Potager", massif: "Massif", haie: "Haie" };
/** Un centimètre d'écran, en pixels CSS : ce que vaut un mètre à 1/100. */
const PX_PAR_CM = 96 / 2.54;
/** Ce qui entoure le terrain, en pixels d'écran : la place de ses cotes. */
const MARGE_PX = 30;

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

/**
 * Combien de dalles tiennent entre les deux points, centrées, jamais étirées.
 *
 * **La longueur d'une dalle se pose dans le sens de la rangée, sa largeur en
 * travers** : sa remarque du 19 octobre 2026, « les dalles se mettent d'office
 * à l'envers, on est obligé de les tourner ». C'était l'inverse jusque-là.
 */
function rangee(d: { L: number; l: number; e: number | null; a: PointMetres; b: PointMetres }) {
  const dist = Math.hypot(d.b.x - d.a.x, d.b.y - d.a.y);
  const e = d.e ?? 0;
  const n = d.L > 0 ? Math.max(1, Math.floor((dist + e) / (d.L + e) + 1e-9)) : 0;
  const occupe = n * d.L + Math.max(0, n - 1) * e;
  return { n, dist, depart: (dist - occupe) / 2 };
}
/** L'arrivée qui met la rangée à la distance tapée ; le départ ne bouge pas. */
function arriveeA(a: PointMetres, b: PointMetres, metres: number): PointMetres {
  let dx = b.x - a.x, dy = b.y - a.y;
  let n = Math.hypot(dx, dy);
  if (n < 1e-9) { dx = 1; dy = 0; n = 1; }
  return { x: a.x + (dx / n) * metres, y: a.y + (dy / n) * metres };
}

/** La feuille qui s'ouvre : ce qu'on pose, ou ce qu'on corrige. */
type Feuille =
  | { sorte: "zone"; zone: Zone; neuve: boolean }
  | { sorte: "arbre"; arbre: Arbre; neuf: boolean }
  | { sorte: "dalles"; dalles: Dalles; neuves: boolean }
  | { sorte: "point"; quoi: "nourrice" | "piquage" };

type Prise =
  | { quoi: "objet"; id: string; depart: PointMetres; bouge: boolean; avant: Zone | Arbre | Dalles | PointMetres }
  | { quoi: "plan"; toucher: string | null; bouge: boolean; cx: number; cy: number; sl: number; st: number };

export default function DessinerLePlan({
  piquage,
  onPiquage,
  onFaire,
  enCours,
}: {
  /** La valeur de « Le piquage se fait… » : `compteur` ou `ailleurs` (le robinet). */
  piquage: string;
  onPiquage: (valeur: "compteur" | "ailleurs") => void;
  /** Le dessin, prêt à partir au serveur. */
  onFaire: (dessin: string) => void;
  enCours: boolean;
}) {
  const [terrainSaisi, setTerrainSaisi] = useState({ L: "", l: "" });
  const T = { L: nombre(terrainSaisi.L), l: nombre(terrainSaisi.l) };
  const cadre = T.L !== null && T.l !== null ? { L: T.L, l: T.l } : null;
  const [echelle, setEchelle] = useState<number | null>(null);
  const [zones, setZones] = useState<Zone[]>([]);
  const [arbres, setArbres] = useState<Arbre[]>([]);
  const [dalles, setDalles] = useState<Dalles[]>([]);
  const [nourrice, setNourrice] = useState<PointMetres | null>(null);
  const [piquagePlace, setPiquagePlace] = useState<PointMetres | null>(null);
  const [outil, setOutil] = useState<Outil | null>(null);
  const [departDalles, setDepartDalles] = useState<PointMetres | null>(null);
  const [choisie, setChoisie] = useState<string | null>(null);
  const [feuille, setFeuille] = useState<Feuille | null>(null);
  const suivant = useRef(1);
  const prise = useRef<Prise | null>(null);
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
  const parM = Math.max(ajuste, voulu);
  const agrandi = parM > ajuste + 1e-6;
  /** Une taille d'écran (en pixels), dite en mètres : les traits et les lettres gardent leur taille. */
  const px = (n: number) => n / parM;
  const m = px(MARGE_PX);

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
  function enMetres(e: React.PointerEvent): PointMetres {
    const s = svg.current!;
    const ctm = s.getScreenCTM()!.inverse();
    const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(ctm);
    return { x: p.x, y: p.y };
  }
  function dansLeTerrain(p: PointMetres): PointMetres {
    return cadre ? { x: borne(p.x, cadre.L), y: borne(p.y, cadre.l) } : p;
  }
  function objet(id: string): Zone | Arbre | Dalles | PointMetres | null {
    if (id === "nourrice") return nourrice;
    if (id === "piquage") return piquagePlace;
    return zones.find((z) => z.id === id) ?? arbres.find((a) => a.id === id) ?? dalles.find((d) => d.id === id) ?? null;
  }

  function appui(e: React.PointerEvent<SVGSVGElement>) {
    if (!cadre || (e.button !== undefined && e.button !== 0)) return;
    const p = dansLeTerrain(enMetres(e));
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
    } else if (agrandi) {
      prise.current = { quoi: "plan", toucher: id, bouge: false, cx: e.clientX, cy: e.clientY, sl: b.scrollLeft, st: b.scrollTop };
    } else {
      setChoisie(null);
      return;
    }
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
    const dx = p.x - pr.depart.x, dy = p.y - pr.depart.y;
    if (!pr.bouge && Math.abs(dx) + Math.abs(dy) < px(6)) return;
    pr.bouge = true;
    const a = pr.avant;
    if (pr.id === "nourrice") setNourrice(dansLeTerrain({ x: (a as PointMetres).x + dx, y: (a as PointMetres).y + dy }));
    else if (pr.id === "piquage") setPiquagePlace(dansLeTerrain({ x: (a as PointMetres).x + dx, y: (a as PointMetres).y + dy }));
    else if (pr.id.startsWith("z")) {
      const z = a as Zone;
      setZones((zs) => zs.map((x) => (x.id === pr.id ? { ...x, x: borne(z.x + dx, Math.max(0, cadre.L - z.L)), y: borne(z.y + dy, Math.max(0, cadre.l - z.l)) } : x)));
    } else if (pr.id.startsWith("a")) {
      const ar = a as Arbre;
      setArbres((as) => as.map((x) => (x.id === pr.id ? { ...x, ...dansLeTerrain({ x: ar.x + dx, y: ar.y + dy }) } : x)));
    } else {
      // Les deux bouts d'une rangée bougent ensemble, et restent dans le terrain.
      const d = a as Dalles;
      const mx = Math.min(d.a.x, d.b.x), Mx = Math.max(d.a.x, d.b.x), my = Math.min(d.a.y, d.b.y), My = Math.max(d.a.y, d.b.y);
      const ddx = Math.max(-mx, Math.min(cadre.L - Mx, dx)), ddy = Math.max(-my, Math.min(cadre.l - My, dy));
      setDalles((ds) => ds.map((x) => (x.id === pr.id ? { ...x, a: { x: d.a.x + ddx, y: d.a.y + ddy }, b: { x: d.b.x + ddx, y: d.b.y + ddy } } : x)));
    }
  }

  function relache() {
    const pr = prise.current;
    prise.current = null;
    if (!pr || pr.bouge) return;
    const id = pr.quoi === "plan" ? pr.toucher : pr.id;
    if (!id) return;
    // Un simple toucher ouvre ce qu'on a touché.
    if (id === "nourrice" || id === "piquage") { setFeuille({ sorte: "point", quoi: id }); return; }
    setChoisie(id);
    const z = zones.find((x) => x.id === id);
    if (z) { setFeuille({ sorte: "zone", zone: z, neuve: false }); return; }
    const ar = arbres.find((x) => x.id === id);
    if (ar) { setFeuille({ sorte: "arbre", arbre: ar, neuf: false }); return; }
    const d = dalles.find((x) => x.id === id);
    if (d) setFeuille({ sorte: "dalles", dalles: d, neuves: false });
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
    } else {
      setZones((zs) => zs.map((x) => (x.id === z.id ? { ...z, x: borne(z.x, Math.max(0, cadre.L - z.L)), y: borne(z.y, Math.max(0, cadre.l - z.l)) } : x)));
    }
    setFeuille(null);
  }

  // ── Ce que l'outil comprend : la règle du serveur, rejouée ici ────────────
  const dessin = cadre
    ? {
        terrain: cadre,
        // Ce qui part au serveur : la zone, sans ce qui ne sert qu'à l'écran.
        zones: zones.map((z): ZoneDessinee => ({
          type: z.type, nom: z.nom, L: z.L, l: z.l, x: z.x, y: z.y,
          ...(z.lignesHaie !== undefined ? { lignesHaie: z.lignesHaie } : {}),
        })),
        nourrice,
        piquage: piquagePlace,
      }
    : null;
  const debordent = cadre ? zonesQuiDebordent({ terrain: cadre, zones }) : [];
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
  const pret = etat.complet && debordent.length === 0;

  const consigne = !cadre
    ? "Les métrés du terrain d’abord."
    : outil === "nourrice" ? "Touchez l’endroit de la nourrice."
    : outil === "compteur" ? "Touchez l’endroit du compteur."
    : outil === "robinet" ? "Touchez l’endroit du robinet."
    : outil === "arbre" ? "Touchez le centre de l’arbre."
    : outil === "dalles" ? (departDalles ? "Touchez l’arrivée des dalles." : "Touchez le départ des dalles.")
    : agrandi ? "Touchez une zone pour la choisir, puis glissez-la."
    : "";

  const champ = "mt-[5px] block w-full min-w-0 rounded-[10px] border-0 px-[12px] py-3 text-[16px]";
  const styleChamp = { backgroundColor: colors.cream, color: colors.ink, boxShadow: `inset 0 0 0 1px ${colors.line}` };
  const texteDetache = { stroke: colors.card, strokeWidth: px(2.6), paintOrder: "stroke" as const, strokeLinejoin: "round" as const };

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
          value={echelle ?? ""}
          onChange={(e) => setEchelle(e.target.value ? Number(e.target.value) : null)}
          className={`${champ} appearance-none`}
          style={{ ...styleChamp, minHeight: 50 }}
        >
          <option value="">Tout le terrain</option>
          <option value="200">1/200</option>
          <option value="100">1/100</option>
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
          onPointerDown={appui}
          onPointerMove={glisse}
          onPointerUp={relache}
          onPointerCancel={() => { prise.current = null; }}
        >
          <rect x={0} y={0} width={vue.L} height={vue.l} rx={px(4)} fill={colors.cream} stroke={colors.ink} strokeWidth={px(1.6)} />
          <text x={vue.L / 2} y={-px(9)} textAnchor="middle" fontSize={px(11)} fill={cadre ? colors.inkSoft : colors.alert}>
            {T.L !== null ? `${ecrit(T.L)} m` : "? m"}
          </text>
          <text x={-px(9)} y={vue.l / 2} textAnchor="middle" fontSize={px(11)} fill={cadre ? colors.inkSoft : colors.alert} transform={`rotate(-90 ${-px(9)} ${vue.l / 2})`}>
            {T.l !== null ? `${ecrit(T.l)} m` : "? m"}
          </text>

          {zones.map((z) => {
            const hors = debordent.includes(z);
            const est = choisie === z.id;
            const cotes = `${ecrit(z.L)} × ${ecrit(z.l)}${z.type === "haie" && z.lignesHaie ? `, ${ecritLignes(z.lignesHaie)}` : ""}`;
            const deuxLignes = z.l >= px(30);
            const tient = (t: string, taille: number) => Math.min(px(taille), Math.max(px(6), (z.L - px(5)) / (t.length * 0.56)));
            return (
              <g key={z.id} data-objet={z.id} style={{ cursor: "grab" }}>
                <rect
                  x={z.x}
                  y={z.y}
                  width={z.L}
                  height={z.l}
                  rx={px(2.5)}
                  fill={remplissage(z.type)}
                  stroke={hors ? colors.alert : est ? colors.ink : colors.rustDeep}
                  strokeWidth={px(est ? 3 : 1.5)}
                  strokeDasharray={hors ? `${px(5)} ${px(4)}` : undefined}
                />
                {deuxLignes ? (
                  <>
                    <text x={z.x + z.L / 2} y={z.y + z.l / 2 - px(2)} textAnchor="middle" fontSize={tient(z.nom ?? NOMS[z.type], 11)} fill={colors.ink} {...texteDetache}>
                      {z.nom ?? NOMS[z.type]}
                    </text>
                    <text x={z.x + z.L / 2} y={z.y + z.l / 2 + px(11)} textAnchor="middle" fontSize={tient(cotes, 10)} fill={hors ? colors.alert : colors.inkSoft} {...texteDetache}>
                      {cotes}
                    </text>
                  </>
                ) : (
                  <text x={z.x + z.L / 2} y={z.y + z.l / 2 + px(3.5)} textAnchor="middle" fontSize={tient(`${z.nom ?? NOMS[z.type]}, ${cotes}`, 10)} fill={hors ? colors.alert : colors.inkSoft} {...texteDetache}>
                    {`${z.nom ?? NOMS[z.type]}, ${cotes}`}
                  </text>
                )}
              </g>
            );
          })}

          {dalles.map((d) => {
            const r = rangee(d);
            const ang = Math.atan2(d.b.y - d.a.y, d.b.x - d.a.x);
            // Le nom au-dessus de la rangée (à droite si elle est debout).
            let nx = -Math.sin(ang), ny = Math.cos(ang);
            if (ny > 1e-6 || (Math.abs(ny) <= 1e-6 && nx < 0)) { nx = -nx; ny = -ny; }
            const ecart = d.l / 2 + px(Math.abs(ny) <= 1e-6 ? 16 : 10);
            return (
              <g key={d.id} data-objet={d.id} style={{ cursor: "grab" }}>
                <line x1={d.a.x} y1={d.a.y} x2={d.b.x} y2={d.b.y} stroke="transparent" strokeWidth={Math.max(px(26), d.l)} strokeLinecap="round" />
                <g transform={`translate(${d.a.x} ${d.a.y}) rotate(${(ang * 180) / Math.PI})`}>
                  {Array.from({ length: r.n }, (_, i) => (
                    <rect key={i} x={r.depart + i * (d.L + (d.e ?? 0))} y={-d.l / 2} width={d.L} height={d.l} fill={voile(colors.muted, 0.6)} stroke={colors.inkSoft} strokeWidth={px(1)} />
                  ))}
                </g>
                <text x={(d.a.x + d.b.x) / 2 + nx * ecart} y={(d.a.y + d.b.y) / 2 + ny * ecart + px(3)} textAnchor="middle" fontSize={px(9.5)} fill={colors.ink} {...texteDetache}>
                  {`${d.nom ?? "Dalles"}, ${ecritDalles(r.n)}`}
                </text>
              </g>
            );
          })}

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
              <text x={10} y={4} fontSize={10} fontWeight={600} fill={colors.ink} stroke={colors.card} strokeWidth={2.6} paintOrder="stroke" strokeLinejoin="round">
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
        </svg>
      </div>

      <p data-atlas="consigne-dessin" aria-live="polite" className="mx-[22px] mt-2 min-h-[21px] text-[14px]" style={{ color: colors.inkSoft }}>
        {consigne}
      </p>

      <div role="toolbar" aria-label="Ajouter" className="mx-[22px] mt-2 flex flex-wrap gap-[6px]">
        {(Object.keys(NOMS) as Sorte[]).map((s) => (
          <Bouton key={s} actif={false} desactive={!cadre} onClick={() => setFeuille({ sorte: "zone", zone: { id: "", type: s, nom: null, L: 0, l: 0, x: 0, y: 0 }, neuve: true })}>
            <svg viewBox="0 0 18 18" width={18} height={18} aria-hidden="true">
              <rect x={2} y={s === "haie" ? 7 : 4} width={14} height={s === "haie" ? 4 : 10} rx={1.5} fill={remplissage(s)} stroke={colors.rustDeep} />
            </svg>
            {NOMS[s]}
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
        {cadre && etat.manque.map((q) => <Ligne key={q} rouge>{LIBELLES[q].titre}</Ligne>)}
        {debordent.map((z) => (
          <Ligne key={z.id} rouge>
            {`Pas de plan : ${z.nom ?? NOMS[z.type]} (${ecrit(z.L)} × ${ecrit(z.l)} m) ne tient pas dans le terrain de ${ecrit(cadre!.L)} × ${ecrit(cadre!.l)} m.`}
          </Ligne>
        ))}
        {(arbres.length > 0 || dalles.length > 0) && <Ligne>Les arbres et les dalles se dessinent, le calcul ne les lit pas encore.</Ligne>}
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
          onSupprimer={() => {
            const f = feuille;
            if (f.sorte === "point") (f.quoi === "nourrice" ? setNourrice : setPiquagePlace)(null);
            else if (f.sorte === "zone") setZones((zs) => zs.filter((z) => z.id !== f.zone.id));
            else if (f.sorte === "arbre") setArbres((as) => as.filter((a) => a.id !== f.arbre.id));
            else setDalles((ds) => ds.filter((d) => d.id !== f.dalles.id));
            setChoisie(null);
            setFeuille(null);
          }}
          sortePiquage={sortePiquage}
        />
      )}
    </div>
  );
}

function remplissage(type: Sorte): string {
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

function Bouton({ actif, desactive, onClick, children }: { actif: boolean; desactive: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={actif}
      disabled={desactive}
      onClick={onClick}
      className="flex min-h-[44px] items-center gap-2 rounded-full py-[6px] pl-[10px] pr-[14px] text-[14.5px] disabled:opacity-45"
      style={actif ? { backgroundColor: colors.ink, color: colors.card, border: `1px solid ${colors.ink}` } : { backgroundColor: colors.card, color: colors.ink, border: `1px solid ${colors.line}` }}
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
  onSupprimer,
  sortePiquage,
}: {
  feuille: Feuille;
  cadre: { L: number; l: number };
  onFermer: () => void;
  onZone: (z: Zone, neuve: boolean) => void;
  onArbre: (a: Arbre, neuf: boolean) => void;
  onDalles: (d: Dalles, neuves: boolean) => void;
  onSupprimer: () => void;
  sortePiquage: string;
}) {
  const z = feuille.sorte === "zone" ? feuille.zone : null;
  const ar = feuille.sorte === "arbre" ? feuille.arbre : null;
  const da = feuille.sorte === "dalles" ? feuille.dalles : null;
  const neuf = (feuille.sorte === "zone" && feuille.neuve) || (feuille.sorte === "arbre" && feuille.neuf) || (feuille.sorte === "dalles" && feuille.neuves);
  const montre = (n: number | null | undefined) => (n ? ecrit(n) : "");

  const [nom, setNom] = useState(z?.nom ?? ar?.nom ?? da?.nom ?? "");
  const [L, setL] = useState(montre(z?.L ?? da?.L));
  const [l, setl] = useState(montre(z?.l ?? da?.l));
  const [d, setD] = useState(montre(ar?.d));
  const [e, setE] = useState(montre(da?.e));
  const [dist, setDist] = useState(da ? ecrit(Math.hypot(da.b.x - da.a.x, da.b.y - da.a.y)) : "");
  const [lignes, setLignes] = useState<{ n: number | null; choisies: boolean }>({
    n: z?.lignesHaie ?? lignesProposees(z ? z.l || null : null),
    choisies: !!z?.lignesChoisies,
  });
  const [invalides, setInvalides] = useState<string[]>([]);
  const [erreur, setErreur] = useState("");

  const titre =
    feuille.sorte === "point" ? (feuille.quoi === "nourrice" ? "La nourrice" : sortePiquage === "robinet" ? "Le robinet" : "Le compteur")
    : z ? (z.nom || NOMS[z.type as Sorte])
    : ar ? (ar.nom || "Arbre")
    : (da?.nom || "Dalles");

  const touche = (champ: string, setter: (v: string) => void) => (v: string) => {
    setter(v);
    setInvalides((xs) => xs.filter((x) => x !== champ));
    setErreur("");
  };
  const propose = z?.type === "haie" ? lignesProposees(nombre(l)) : null;

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
      onZone({ ...z, nom: leNom, L: nL!, l: nl!, ...(z.type === "haie" ? { lignesHaie: lignes.n ?? propose ?? 1, lignesChoisies: lignes.choisies } : {}) }, neuf);
    } else if (ar) {
      const nd = nombre(d);
      if (refuse([["d", nd]])) return;
      if (nd! > Math.max(cadre.L, cadre.l) + 1e-9) { setInvalides(["d"]); setErreur(neTientPas(cadre)); return; }
      onArbre({ ...ar, nom: leNom, d: nd! }, neuf);
    } else if (da) {
      const nDist = nombre(dist), nL = nombre(L), nl = nombre(l);
      if (refuse([["dist", nDist], ["L", nL], ["l", nl]])) return;
      const b = arriveeA(da.a, da.b, nDist!);
      if (b.x < -1e-6 || b.y < -1e-6 || b.x > cadre.L + 1e-6 || b.y > cadre.l + 1e-6) { setInvalides(["dist"]); setErreur(neTientPas(cadre)); return; }
      if (nL! > nDist! + 1e-9) { setInvalides(["L"]); setErreur(`Plus longue que la distance, qui fait ${ecrit(nDist!)} m.`); return; }
      onDalles({ ...da, nom: leNom, L: nL!, l: nl!, e: nombre(e), b }, neuf);
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
    const r = rangee({ L: nL, l: nombre(l) ?? 0, e: nombre(e), a: da.a, b: arriveeA(da.a, da.b, nDist) });
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
            <input id="feuille-nom" autoComplete="off" value={nom} placeholder={z ? NOMS[z.type as Sorte] : ar ? "Arbre" : "Dalles"} onChange={(ev) => setNom(ev.target.value)} className={champ} style={style("nom")} />
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
              {nombreChamp("feuille-L", L, touche("L", setL), !da)}
            </span>
            <span className="min-w-0">
              {libelle("feuille-l", da ? "Largeur d’une dalle" : "Largeur", 0)}
              {nombreChamp("feuille-l", l, (v) => {
                touche("l", setl)(v);
                if (z?.type === "haie" && !lignes.choisies) setLignes({ n: lignesProposees(nombre(v)), choisies: false });
              })}
            </span>
          </div>
        )}
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
          </>
        )}
        {noteDalles && <p className="mt-[6px] text-[13px]" style={{ color: colors.muted }}>{noteDalles}</p>}
        {erreur && <p role="alert" className="mt-2 text-[14px] font-semibold" style={{ color: colors.alert }}>{erreur}</p>}

        {z?.type === "haie" && (
          <div className="mt-[14px]">
            <span id="lignes-titre" className={`block ${libelleCaps}`} style={{ color: colors.muted }}>Lignes de goutte-à-goutte</span>
            <div role="group" aria-labelledby="lignes-titre" className="mt-[6px] grid items-center gap-2" style={{ gridTemplateColumns: "56px 1fr 56px" }}>
              <button type="button" aria-label="Une ligne de moins" disabled={!lignes.n || lignes.n <= 1} onClick={() => setLignes({ n: Math.max(1, (lignes.n ?? 1) - 1), choisies: true })} className="min-h-[52px] rounded-full text-[22px] disabled:opacity-45" style={{ border: `1px solid ${colors.line}`, backgroundColor: colors.cream, color: colors.ink }}>−</button>
              <output aria-live="polite" className="text-center text-[17px]">{lignes.n ? ecritLignes(lignes.n) : "?"}</output>
              <button type="button" aria-label="Une ligne de plus" onClick={() => setLignes({ n: (lignes.n ?? propose ?? 1) + 1, choisies: true })} className="min-h-[52px] rounded-full text-[22px]" style={{ border: `1px solid ${colors.line}`, backgroundColor: colors.cream, color: colors.ink }}>+</button>
            </div>
            {propose && <p className="mt-[6px] text-[13px]" style={{ color: colors.muted }}>{propose === lignes.n ? "Proposé." : `Proposé : ${ecritLignes(propose)}.`}</p>}
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
