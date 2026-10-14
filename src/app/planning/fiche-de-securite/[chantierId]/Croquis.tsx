"use client";

import { useRef, useState } from "react";
import { colors, font, surPlein, voile } from "@/lib/design-tokens";
import {
  HAUTEUR_DU_CROQUIS,
  LARGEUR_DU_CROQUIS,
  OBLIGATOIRES_DU_CROQUIS,
  OUTILS_DU_CROQUIS,
  cheminDuRuisseau,
  genreDe,
  manquesDuCroquis,
  numeroDeLArbre,
  numeroDeLaZone,
  rectangleDeLaLimite,
  type Croquis,
  type FondDuCroquis,
  type Marque,
  type TypeDeMarque,
} from "@/lib/croquis-securite";

/**
 * LE CROQUIS DE LA FICHE — l'aperçu dans l'étape, et l'éditeur en plein écran.
 *
 * Codé d'après la planche `appli/fiche-de-securite-mieux.html`, éprouvée par
 * lui le 14 octobre 2026, remarque après remarque :
 *
 * - *« il faut qu'il soit à portée de doigt tout le temps »* : l'éditeur prend
 *   l'écran, le dessin en haut, les treize outils en grille dessous ;
 * - *« si on reste appuyé, il faut pouvoir le déplacer, et lorsqu'on lâche il
 *   se pose »* : un repère suit le doigt, et appuyer sur un repère posé le
 *   reprend au lieu d'en poser un second par-dessus ;
 * - *« il fait des traits saccadés »* : le trait en cours vit dans son propre
 *   élément, qu'on allonge sans jamais redessiner l'écran, et il reçoit tous les
 *   points du doigt (`getCoalescedEvents`). Redessiner à chaque mouvement
 *   remplaçait le dessin sous le doigt : il ne restait que des tirets ;
 * - *« il ne doit pas pouvoir valider le croquis sans ces éléments »* :
 *   « Terminé » refuse tant que `manquesDuCroquis` n'est pas vide ; la flèche
 *   retour sort sans valider, pour ne pas enfermer.
 *
 * La position du doigt se lit avec la géométrie réelle du dessin
 * (`getScreenCTM`), pas avec la boîte qui le contient : un dessin réduit pour
 * tenir en hauteur laisse des marges, et la boîte mentait alors sur l'endroit.
 */

const NS = "http://www.w3.org/2000/svg";

export function DessinDuCroquis({ croquis, fondUrl, svgRef, className }: { croquis: Croquis; fondUrl: string | null; svgRef?: React.Ref<SVGSVGElement>; className?: string }) {
  return (
    <svg ref={svgRef} viewBox={`0 0 ${LARGEUR_DU_CROQUIS} ${HAUTEUR_DU_CROQUIS}`} className={className} role="img" aria-label="Croquis du chantier" style={{ display: "block", width: "100%", height: "100%", touchAction: "none" }}>
      <Fond croquis={croquis} fondUrl={fondUrl} />
      {croquis.marques.map((m, rang) => (
        <g key={rang} data-m={rang}>
          <DessinDUneMarque m={m} rang={rang} marques={croquis.marques} />
        </g>
      ))}
    </svg>
  );
}

function Fond({ croquis, fondUrl }: { croquis: Croquis; fondUrl: string | null }) {
  // La photo se montre ENTIÈRE (`meet`), jamais rognée : le PDF la pose entière dans le même cadre, et
  // un repère posé sur un arbre doit retomber sur cet arbre, à l'écran comme sur la feuille imprimée.
  if (fondUrl) {
    return (
      <>
        <rect width={LARGEUR_DU_CROQUIS} height={HAUTEUR_DU_CROQUIS} fill={colors.rustTint} />
        <image href={fondUrl} x={0} y={0} width={LARGEUR_DU_CROQUIS} height={HAUTEUR_DU_CROQUIS} preserveAspectRatio="xMidYMid meet" />
      </>
    );
  }
  if (croquis.fond === "blanc") {
    return (
      <>
        <rect width={LARGEUR_DU_CROQUIS} height={HAUTEUR_DU_CROQUIS} fill={colors.card} />
        {Array.from({ length: 13 }, (_, i) => Array.from({ length: 10 }, (_, j) => <circle key={`${i}-${j}`} cx={15 + i * 31} cy={15 + j * 31} r={1.3} fill={colors.line} />))}
      </>
    );
  }
  return <rect width={LARGEUR_DU_CROQUIS} height={HAUTEUR_DU_CROQUIS} fill={colors.rustTint} />;
}

type StyleDeTrait = { stroke: string; strokeWidth: number; strokeDasharray?: string; strokeOpacity?: number };
const STYLE_DU_TRAIT: Record<string, StyleDeTrait> = {
  acces: { stroke: colors.rust, strokeWidth: 5, strokeDasharray: "10 7" },
  voie: { stroke: colors.or, strokeWidth: 8, strokeOpacity: 0.8 },
  ligne: { stroke: colors.alert, strokeWidth: 3, strokeDasharray: "14 4 2 4" },
  limite: { stroke: colors.ink, strokeWidth: 2, strokeDasharray: "3 5" },
  ruisseau: { stroke: colors.rustDeep, strokeWidth: 6 },
};

function DessinDUneMarque({ m, rang, marques }: { m: Marque; rang: number; marques: readonly Marque[] }) {
  switch (m.t) {
    case "crayon":
      return <polyline points={m.pts.join(" ")} fill="none" stroke={colors.ink} strokeWidth={3.5} strokeLinecap="round" strokeLinejoin="round" />;
    case "ruisseau":
      return <path d={cheminDuRuisseau(m)} fill="none" strokeLinecap="round" {...STYLE_DU_TRAIT.ruisseau} />;
    case "limite": {
      const r = rectangleDeLaLimite(m);
      return <rect x={r.x} y={r.y} width={r.largeur} height={r.hauteur} fill="none" {...STYLE_DU_TRAIT.limite} />;
    }
    case "acces":
    case "voie":
    case "ligne":
      return <line x1={m.x} y1={m.y} x2={m.x2} y2={m.y2} strokeLinecap="round" {...STYLE_DU_TRAIT[m.t]} />;
    case "abattre":
    case "tailler": {
      const plein = m.t === "abattre";
      return (
        <>
          <circle cx={m.x} cy={m.y} r={15} fill={plein ? colors.alert : colors.card} stroke={plein ? colors.card : colors.or} strokeWidth={plein ? 2 : 4} />
          <text x={m.x} y={m.y + 6} textAnchor="middle" fontSize={17} fontWeight={700} fill={plein ? surPlein : colors.ink}>{numeroDeLArbre(marques, rang)}</text>
        </>
      );
    }
    case "maison":
      return (
        <>
          <rect x={m.x - 34} y={m.y - 26} width={68} height={52} fill={voile(colors.or, 0.35)} stroke={colors.ink} strokeWidth={2} />
          <path d={`M${m.x - 34} ${m.y - 26} L${m.x + 34} ${m.y + 26} M${m.x + 34} ${m.y - 26} L${m.x - 34} ${m.y + 26}`} stroke={colors.ink} strokeWidth={1} opacity={0.35} />
        </>
      );
    case "danger": {
      const n = numeroDeLaZone(marques, rang);
      return (
        <>
          <circle cx={m.x} cy={m.y} r={46} fill={voile(colors.alert, 0.12)} stroke={colors.alert} strokeWidth={3} strokeDasharray="7 5" />
          <text data-zone={n} x={m.x} y={m.y + 64} textAnchor="middle" fontSize={14} fontWeight={700} fill={colors.alert}>{m.mot || `Zone ${n}`}</text>
        </>
      );
    }
    case "stockage":
      return <rect x={m.x - 36} y={m.y - 22} width={72} height={44} rx={4} fill={voile(colors.or, 0.13)} stroke={colors.or} strokeWidth={2.5} strokeDasharray="6 4" />;
    case "reseau":
      return (
        <g transform={`translate(${m.x - 14} ${m.y - 14})`}>
          <rect x={0} y={18} width={7} height={10} fill={colors.rust} />
          <rect x={10} y={10} width={7} height={18} fill={colors.rust} />
          <rect x={20} y={2} width={7} height={26} fill={colors.rust} />
        </g>
      );
    case "secours":
      return (
        <>
          <rect x={m.x - 15} y={m.y - 15} width={30} height={30} rx={6} fill={colors.plein} />
          <path d={`M${m.x - 8} ${m.y}h16M${m.x} ${m.y - 8}v16`} stroke={surPlein} strokeWidth={4} strokeLinecap="round" />
        </>
      );
  }
}

/** Le petit symbole d'un outil : sur son bouton, et dans la légende. */
export function SymboleDOutil({ t }: { t: TypeDeMarque }) {
  const corps = (() => {
    switch (t) {
      case "crayon":
        return <path d="M4 18c3-1 5-6 8-7s4 2 6-2" stroke={colors.ink} strokeWidth={2.2} fill="none" strokeLinecap="round" />;
      case "abattre":
        return <circle cx={11} cy={11} r={8.5} fill={colors.alert} />;
      case "tailler":
        return <circle cx={11} cy={11} r={8.5} fill={colors.card} stroke={colors.or} strokeWidth={2.4} />;
      case "maison":
        return (
          <>
            <rect x={4} y={8} width={14} height={11} fill={voile(colors.or, 0.35)} stroke={colors.ink} strokeWidth={1.4} />
            <path d="M3 9 11 3l8 6" fill="none" stroke={colors.ink} strokeWidth={1.6} strokeLinejoin="round" />
          </>
        );
      case "danger":
        return <circle cx={11} cy={11} r={8.5} fill={voile(colors.alert, 0.12)} stroke={colors.alert} strokeWidth={2} strokeDasharray="3 2.5" />;
      case "stockage":
        return <rect x={3} y={6} width={16} height={11} rx={2} fill={voile(colors.or, 0.13)} stroke={colors.or} strokeWidth={1.6} strokeDasharray="3 2" />;
      case "reseau":
        return (
          <>
            <rect x={4} y={13} width={3} height={5} fill={colors.rust} />
            <rect x={9.5} y={9} width={3} height={9} fill={colors.rust} />
            <rect x={15} y={5} width={3} height={13} fill={colors.rust} />
          </>
        );
      case "secours":
        return (
          <>
            <rect x={3} y={3} width={16} height={16} rx={3} fill={colors.plein} />
            <path d="M7.5 11h7M11 7.5v7" stroke={surPlein} strokeWidth={2.2} strokeLinecap="round" />
          </>
        );
      default: {
        const style = STYLE_DU_TRAIT[t];
        return <path d="M3 18 19 4" fill="none" strokeLinecap="round" stroke={style.stroke} strokeDasharray={style.strokeDasharray} strokeWidth={2.6} />;
      }
    }
  })();
  return <svg width={20} height={20} viewBox="0 0 22 22" aria-hidden="true">{corps}</svg>;
}

/** Les trois éléments que la loi exige, cochés à mesure qu'ils sont posés. */
export function ObligatoiresDuCroquis({ croquis }: { croquis: Croquis }) {
  return (
    <>
      <p className="m-0 mb-1.5 text-[12.5px]" style={{ color: colors.muted }}>Obligatoire sur le croquis :</p>
      <div className="flex flex-wrap gap-1.5">
        {OBLIGATOIRES_DU_CROQUIS.map((o) => {
          const pose = croquis.marques.some(o.test);
          return (
            <span key={o.mot} data-atlas="obligatoire-du-croquis" data-pose={pose} className="inline-flex min-h-[32px] items-center gap-1.5 rounded-full py-1 pl-1.5 pr-2.5 text-[13px]" style={{ background: pose ? voile(colors.plein, 0.16) : voile(colors.or, 0.13), color: pose ? colors.rust : colors.orTexte }}>
              <span aria-hidden="true" className="grid h-[18px] w-[18px] place-items-center rounded-full" style={{ background: pose ? colors.plein : colors.card, color: pose ? surPlein : "transparent", boxShadow: pose ? "none" : `inset 0 0 0 1.5px ${colors.vertPale}` }}>
                <svg width="11" height="11" viewBox="0 0 16 16" fill="none"><path d="M3 8.4 6.3 11.7 13 5" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" /></svg>
              </span>
              {o.mot}
            </span>
          );
        })}
      </div>
    </>
  );
}

const FONDS: readonly (readonly [FondDuCroquis, string])[] = [
  ["photo", "Photo"],
  ["blanc", "Page blanche"],
  ["import", "Importé"],
];

export function EditeurDuCroquis({
  croquis,
  fondUrl,
  onChange,
  onFond,
  onFermer,
}: {
  croquis: Croquis;
  fondUrl: string | null;
  onChange: (c: Croquis) => void;
  onFond: (fond: FondDuCroquis) => void;
  onFermer: () => void;
}) {
  const [outil, setOutil] = useState<TypeDeMarque>("crayon");
  const [debut, setDebut] = useState<{ x: number; y: number } | null>(null);
  const [refus, setRefus] = useState<string | null>(null);
  const svg = useRef<SVGSVGElement>(null);
  // Le geste en cours vit hors de React : un rendu par mouvement de doigt, c'est le trait haché.
  const geste = useRef<{ trait: SVGPolylineElement; points: number[] } | { prise: number; origine: { x: number; y: number }; groupe: SVGGElement | null } | null>(null);
  const manques = manquesDuCroquis(croquis);

  const point = (ev: { clientX: number; clientY: number }) => {
    const s = svg.current!;
    const q = new DOMPoint(ev.clientX, ev.clientY).matrixTransform(s.getScreenCTM()!.inverse());
    return { x: Math.round(q.x), y: Math.round(q.y) };
  };
  const ajouter = (m: Marque) => onChange({ ...croquis, marques: [...croquis.marques, m] });

  function appuyer(ev: React.PointerEvent<SVGSVGElement>) {
    setRefus(null);
    const p = point(ev);
    const genre = genreDe(outil);
    if (genre === "crayon") {
      ev.currentTarget.setPointerCapture(ev.pointerId);
      const trait = document.createElementNS(NS, "polyline");
      for (const [k, v] of Object.entries({ fill: "none", stroke: colors.ink, "stroke-width": "3.5", "stroke-linecap": "round", "stroke-linejoin": "round", points: `${p.x},${p.y}` })) trait.setAttribute(k, v);
      svg.current!.appendChild(trait);
      geste.current = { trait, points: [p.x, p.y] };
      return;
    }
    if (genre === "trait") {
      if (!debut) {
        setDebut(p);
        return;
      }
      ajouter({ t: outil, x: debut.x, y: debut.y, x2: p.x, y2: p.y } as Marque);
      setDebut(null);
      return;
    }
    // Un repère : on reprend celui qu'on touche, sinon on en pose un neuf ; il suit le doigt jusqu'au lâcher.
    const repris = croquis.marques.findLastIndex((m) => "x" in m && !("x2" in m) && Math.hypot(m.x - p.x, m.y - p.y) < (m.t === "maison" || m.t === "danger" ? 40 : 22));
    ev.currentTarget.setPointerCapture(ev.pointerId);
    if (repris >= 0) {
      geste.current = { prise: repris, origine: p, groupe: svg.current!.querySelector(`g[data-m="${repris}"]`) };
      return;
    }
    const neuve: Marque = outil === "danger" ? { t: "danger", x: p.x, y: p.y, mot: "" } : ({ t: outil, x: p.x, y: p.y } as Marque);
    ajouter(neuve);
    geste.current = { prise: croquis.marques.length, origine: p, groupe: null };
  }

  function bouger(ev: React.PointerEvent<SVGSVGElement>) {
    const g = geste.current;
    if (!g) return;
    if ("trait" in g) {
      for (const e of ev.nativeEvent.getCoalescedEvents?.() ?? [ev.nativeEvent]) {
        const p = point(e);
        g.points.push(p.x, p.y);
      }
      g.trait.setAttribute("points", pairs(g.points));
      return;
    }
    const p = point(ev);
    g.groupe ??= svg.current!.querySelector(`g[data-m="${g.prise}"]`);
    g.groupe?.setAttribute("transform", `translate(${p.x - g.origine.x} ${p.y - g.origine.y})`);
  }

  function lacher(ev: React.PointerEvent<SVGSVGElement>) {
    const g = geste.current;
    geste.current = null;
    if (!g) return;
    if ("trait" in g) {
      g.trait.remove();
      if (g.points.length >= 4) ajouter({ t: "crayon", pts: g.points });
      return;
    }
    // Le décalage posé à la main s'efface avant que React redessine le repère à sa nouvelle place.
    g.groupe?.removeAttribute("transform");
    const p = point(ev);
    const dx = p.x - g.origine.x, dy = p.y - g.origine.y;
    if (dx === 0 && dy === 0) return;
    onChange({ ...croquis, marques: croquis.marques.map((m, i) => (i === g.prise && "x" in m && !("x2" in m) ? { ...m, x: m.x + dx, y: m.y + dy } : m)) });
  }

  const consigne = refus
    ?? (outil === "crayon" ? "Dessinez du doigt."
      : outil === "limite" ? (debut ? "Touchez le coin opposé." : "Touchez un coin de la parcelle.")
      : genreDe(outil) === "trait" ? (debut ? "Touchez où le trait arrive." : "Touchez où le trait part.")
      : "Touchez pour poser. Restez appuyé pour déplacer.");

  return (
    <div data-atlas="editeur-du-croquis" className="fixed inset-0 z-[60] flex flex-col" style={{ background: colors.cream, color: colors.ink, fontFamily: font.body }}>
      <div className="flex flex-none items-center gap-3 px-3 pb-1.5 pl-0.5 pt-[max(6px,env(safe-area-inset-top))]" style={{ minHeight: 56 }}>
        <button type="button" aria-label="Fermer sans valider" data-atlas="fermer-le-croquis" onClick={onFermer} className="grid h-11 w-10 flex-none place-items-center" style={{ color: colors.rust }}>
          <svg width="22" height="22" viewBox="0 0 20 20" fill="none"><path d="M12.5 4 6.5 10l6 6" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </button>
        <button type="button" data-atlas="retirer-le-dernier" onClick={() => { setDebut(null); if (!debut) onChange({ ...croquis, marques: croquis.marques.slice(0, -1) }); }} className="min-h-[44px] whitespace-nowrap text-[13.5px] font-bold">Retirer le dernier</button>
        <button type="button" data-atlas="tout-effacer" onClick={() => { setDebut(null); onChange({ ...croquis, marques: [] }); }} className="min-h-[44px] whitespace-nowrap text-[13.5px] font-bold">Tout effacer</button>
        <button
          type="button"
          data-atlas="croquis-termine"
          aria-disabled={manques.length > 0}
          onClick={() => (manques.length ? setRefus(`Il manque encore : ${manques.join(", ")}.`) : onFermer())}
          className="ml-auto min-h-[40px] flex-none rounded-full px-[18px] text-[15px]"
          style={{ fontFamily: font.display, background: colors.plein, color: surPlein, opacity: manques.length ? 0.45 : 1 }}
        >
          Terminé
        </button>
      </div>
      <div className="grid flex-none grid-cols-3 gap-1.5 px-3">
        {FONDS.map(([v, mot]) => (
          <button key={v} type="button" aria-pressed={croquis.fond === v} onClick={() => onFond(v)} className="flex min-h-[44px] items-center justify-center rounded-full px-1.5 text-center text-[13.5px] leading-[1.15]" style={{ background: croquis.fond === v ? voile(colors.plein, 0.16) : colors.card, boxShadow: `inset 0 0 0 ${croquis.fond === v ? "1.5px" : "1px"} ${croquis.fond === v ? colors.rust : colors.line}`, color: croquis.fond === v ? colors.rust : colors.ink, fontWeight: croquis.fond === v ? 600 : 400 }}>
            {mot}
          </button>
        ))}
      </div>
      <div className="flex-none px-3 pt-2">
        <ObligatoiresDuCroquis croquis={croquis} />
      </div>
      <div className="flex min-h-0 flex-1 flex-col px-3 pt-2">
        <div className="min-h-0 flex-1 overflow-hidden rounded-[12px]" style={{ background: colors.rustTint, boxShadow: `inset 0 0 0 1px ${colors.line}` }}>
          <svg
            ref={svg}
            data-atlas="dessin-du-croquis"
            viewBox={`0 0 ${LARGEUR_DU_CROQUIS} ${HAUTEUR_DU_CROQUIS}`}
            onPointerDown={appuyer}
            onPointerMove={bouger}
            onPointerUp={lacher}
            onPointerCancel={lacher}
            style={{ display: "block", width: "100%", height: "100%", touchAction: "none" }}
          >
            <Fond croquis={croquis} fondUrl={fondUrl} />
            {croquis.marques.map((m, rang) => (
              <g key={rang} data-m={rang}>
                <DessinDUneMarque m={m} rang={rang} marques={croquis.marques} />
              </g>
            ))}
            {debut && <circle cx={debut.x} cy={debut.y} r={7} fill={colors.ink} />}
          </svg>
        </div>
        <p data-atlas="consigne-du-croquis" className="m-0 py-1.5 text-center text-[12.5px]" style={{ color: refus ? colors.alert : colors.muted, fontWeight: refus ? 600 : 400 }}>{consigne}</p>
      </div>
      <div className="grid flex-none grid-cols-5 gap-1.5 border-t px-3 pb-[max(14px,env(safe-area-inset-bottom))] pt-2" style={{ borderColor: colors.lineSoft }}>
        {OUTILS_DU_CROQUIS.map((o) => (
          <button key={o.t} type="button" data-atlas={`outil-${o.t}`} aria-pressed={outil === o.t} aria-label={o.libelle} onClick={() => { setOutil(o.t); setDebut(null); setRefus(null); }} className="flex min-h-[56px] min-w-0 flex-col items-center justify-center gap-1 rounded-[12px] text-center text-[11.5px] leading-[1.1]" style={{ background: outil === o.t ? voile(colors.plein, 0.16) : colors.card, boxShadow: `inset 0 0 0 ${outil === o.t ? "1.5px" : "1px"} ${outil === o.t ? colors.plein : colors.line}` }}>
            <SymboleDOutil t={o.t} />
            <span>{o.court}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

const pairs = (pts: number[]) => {
  let s = "";
  for (let i = 0; i < pts.length; i += 2) s += `${i ? " " : ""}${pts[i]},${pts[i + 1]}`;
  return s;
};

/** La légende : les outils effectivement posés, avec leur symbole. */
export function LegendeDuCroquis({ croquis }: { croquis: Croquis }) {
  const poses = new Set(croquis.marques.map((m) => m.t));
  const outils = OUTILS_DU_CROQUIS.filter((o) => o.t !== "crayon" && poses.has(o.t));
  if (outils.length === 0) return null;
  return (
    <ul className="m-0 mt-2.5 list-none p-0">
      {outils.map((o) => (
        <li key={o.t} className="flex min-h-[30px] items-center gap-2.5 text-[13.5px]"><SymboleDOutil t={o.t} /> {o.libelle}</li>
      ))}
    </ul>
  );
}

