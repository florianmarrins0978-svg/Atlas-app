"use client";

import { useEffect, useRef } from "react";
import { colors } from "@/lib/design-tokens";

/**
 * LA SIGNATURE AU DOIGT — sa réponse du 21 septembre 2026 : *« au doigt, sur le
 * téléphone, à chaque fiche »*. Un trait sur une toile, rejoué tel quel quand
 * l'écran se refait ; le PNG part avec la fiche à la signature.
 *
 * Le trait vit dans `trace` (des suites de points), pas dans la toile : une
 * toile se vide au moindre redimensionnement, et il aurait dû re-signer parce
 * qu'il a tourné son téléphone.
 */
export type Trace = number[][][];

export default function Signature({
  trace,
  onTrace,
}: {
  trace: Trace;
  onTrace: (trace: Trace) => void;
}) {
  const toile = useRef<HTMLCanvasElement>(null);
  const cadre = useRef<HTMLDivElement>(null);
  const courant = useRef<number[][] | null>(null);

  useEffect(() => {
    const cv = toile.current;
    const c = cadre.current;
    if (!cv || !c) return;
    const ratio = window.devicePixelRatio || 1;
    const w = c.clientWidth;
    const h = c.clientHeight;
    cv.width = w * ratio;
    cv.height = h * ratio;
    const ctx = cv.getContext("2d");
    if (!ctx) return;
    ctx.scale(ratio, ratio);
    ctx.lineWidth = 2.2;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = getComputedStyle(document.body).getPropertyValue("--atlas-ink").trim() || "#1c1c1a";
    ctx.clearRect(0, 0, w, h);
    for (const t of trace) {
      ctx.beginPath();
      t.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
      ctx.stroke();
    }
  }, [trace]);

  function position(e: React.PointerEvent<HTMLCanvasElement>): [number, number] {
    const r = e.currentTarget.getBoundingClientRect();
    return [e.clientX - r.left, e.clientY - r.top];
  }

  const points = trace.reduce((n, t) => n + t.length, 0);

  return (
    <div>
      <div
        ref={cadre}
        data-atlas="signature"
        className="relative h-[170px] overflow-hidden rounded-[12px]"
        style={{ background: colors.card, boxShadow: `inset 0 0 0 1px ${colors.line}` }}
      >
        <canvas
          ref={toile}
          aria-label="Signature"
          className="block h-full w-full"
          style={{ touchAction: "none", cursor: "crosshair" }}
          onPointerDown={(e) => {
            e.currentTarget.setPointerCapture(e.pointerId);
            courant.current = [position(e)];
            onTrace([...trace, courant.current]);
          }}
          onPointerMove={(e) => {
            if (!courant.current) return;
            courant.current.push(position(e));
            onTrace([...trace.slice(0, -1), [...courant.current]]);
          }}
          onPointerUp={() => {
            courant.current = null;
          }}
          onPointerCancel={() => {
            courant.current = null;
          }}
        />
        <span aria-hidden="true" className="pointer-events-none absolute bottom-[34px] left-[18px] right-[18px] border-t border-dashed" style={{ borderColor: colors.line }} />
        {points === 0 && (
          <span className="pointer-events-none absolute bottom-[10px] left-0 right-0 text-center text-[12px]" style={{ color: colors.muted }}>
            Signez ici, au doigt
          </span>
        )}
      </div>
      <button type="button" onClick={() => onTrace([])} className="ml-auto mt-2 block min-h-[40px] px-1 text-[13.5px] font-semibold" style={{ color: colors.ink }}>
        Effacer
      </button>
    </div>
  );
}

/** Le PNG de la toile, pour la fiche — `null` tant qu'il n'y a rien dessus. */
export function pngDeLaSignature(trace: Trace, largeur = 600, hauteur = 260): string | null {
  const points = trace.reduce((n, t) => n + t.length, 0);
  if (points === 0) return null;
  const cv = document.createElement("canvas");
  cv.width = largeur;
  cv.height = hauteur;
  const ctx = cv.getContext("2d");
  if (!ctx) return null;
  // Les points sont ceux de la toile affichée (≈ 360 × 170) : on les met à
  // l'échelle du PNG, qui doit rester lisible sur le PDF.
  const xs = trace.flat().map(([x]) => x);
  const ys = trace.flat().map(([, y]) => y);
  const echelle = Math.min(largeur / (Math.max(...xs) + 20), hauteur / (Math.max(...ys) + 20), 2);
  ctx.lineWidth = 2.5 * echelle;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.strokeStyle = "#1c1c1a";
  for (const t of trace) {
    ctx.beginPath();
    t.forEach(([x, y], i) => (i ? ctx.lineTo(x * echelle, y * echelle) : ctx.moveTo(x * echelle, y * echelle)));
    ctx.stroke();
  }
  return cv.toDataURL("image/png");
}
