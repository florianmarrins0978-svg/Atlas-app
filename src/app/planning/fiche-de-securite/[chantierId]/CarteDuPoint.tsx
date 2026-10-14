"use client";

import { useEffect, useRef, useState } from "react";
import { colors, font, surPlein, voile } from "@/lib/design-tokens";
import {
  ZOOM_MAX,
  ZOOM_MIN,
  ZOOM_PAR_DEFAUT,
  adresseDeLaTuile,
  ecrireLeGps,
  lireLeGps,
  pointSousLAppui,
  tuilesAutour,
  type FondDeCarte,
} from "@/lib/carte-du-point";

// LA VRAIE CARTE DU POINT GPS — sa planche du 14 octobre 2026,
// `appli/fiche-securite-carte-gps.html`, et son « ça marche, code ça ».
//
// La carte s'ouvre sur le point relevé ; avant tout relevé, sur l'adresse du
// chantier quand Atlas la sait située. Un appui déplace le point : sous les
// arbres, le GPS se trompe de quelques maisons, et c'est lui qui sait où il est.

const HAUTEUR = 260;

/** L'adresse officielle au point, demandée à Atlas. `null` quand rien n'y est connu ou que le service ne répond pas. */
export async function adresseAuPoint(gps: string): Promise<string | null> {
  try {
    const r = await fetch(`/api/carte/adresse?gps=${encodeURIComponent(gps)}`);
    if (!r.ok) return null;
    const { adresse } = (await r.json()) as { adresse: string | null };
    return adresse;
  } catch (erreur) {
    console.error("[carte] adresse au point", erreur);
    return null;
  }
}

export function CarteDuPoint({ gps, repli, onPoint }: { gps: string; repli: { lat: number; lon: number } | null; onPoint: (gps: string) => void }) {
  const [zoom, setZoom] = useState(ZOOM_PAR_DEFAUT);
  const [fond, setFond] = useState<FondDeCarte>("plan");
  const [largeur, setLargeur] = useState(0);
  const boite = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = boite.current;
    if (!el) return;
    const mesure = new ResizeObserver(() => setLargeur(el.clientWidth));
    mesure.observe(el);
    return () => mesure.disconnect();
  }, []);

  const releve = lireLeGps(gps);
  const centre = releve ?? repli;
  if (!centre) return null;
  const tuiles = largeur ? tuilesAutour(centre, zoom, largeur, HAUTEUR) : [];

  function toucher(ev: React.MouseEvent<HTMLDivElement>) {
    if (!centre || (ev.target as HTMLElement).closest("button")) return;
    const b = ev.currentTarget.getBoundingClientRect();
    onPoint(ecrireLeGps(pointSousLAppui(centre, zoom, ev.clientX - b.left - b.width / 2, ev.clientY - b.top - b.height / 2)));
  }

  return (
    <div className="mt-2.5">
      <div
        ref={boite}
        data-atlas="carte-du-point"
        onClick={toucher}
        className="relative cursor-crosshair overflow-hidden rounded-[14px]"
        style={{ height: HAUTEUR, background: colors.rustTint, boxShadow: `inset 0 0 0 1px ${colors.line}` }}
      >
        {tuiles.map((t) => (
          <div
            key={`${fond}-${zoom}-${t.x}-${t.y}`}
            aria-hidden="true"
            className="pointer-events-none absolute h-64 w-64 bg-cover"
            style={{ left: t.gauche, top: t.haut, backgroundImage: `url(${adresseDeLaTuile(fond, zoom, t.x, t.y)})` }}
          />
        ))}
        {releve && (
          <>
            <span aria-hidden="true" className="pointer-events-none absolute h-[70px] w-[70px] rounded-full" style={{ left: "50%", top: "50%", margin: "-35px 0 0 -35px", background: voile(colors.alert, 0.22) }} />
            <svg aria-hidden="true" data-atlas="repere-du-point" className="pointer-events-none absolute" width="34" height="44" viewBox="0 0 34 44" style={{ left: "50%", top: "50%", transform: "translate(-50%, -100%)" }}>
              <path d="M17 43c-12-16-16-23-16-28a16 16 0 1 1 32 0c0 5-4 12-16 28z" fill={colors.alert} stroke={colors.card} strokeWidth="2" />
              <circle cx="17" cy="15" r="6" fill={colors.card} />
            </svg>
          </>
        )}
        <div className="absolute left-2 top-2 flex rounded-full p-[3px]" style={{ background: colors.card, boxShadow: `0 2px 6px ${voile(colors.ink, 0.18)}` }}>
          {(["plan", "photo"] as const).map((f) => (
            <button key={f} type="button" aria-pressed={fond === f} onClick={() => setFond(f)} className="min-h-[38px] rounded-full px-3 text-[13.5px]" style={{ background: fond === f ? colors.plein : "transparent", color: fond === f ? surPlein : colors.rust }}>
              {f === "plan" ? "Plan" : "Photo aérienne"}
            </button>
          ))}
        </div>
        <div className="absolute right-2 top-2 flex flex-col gap-1.5">
          {([["+", "Rapprocher", 1], ["−", "Éloigner", -1]] as const).map(([signe, nom, pas]) => (
            <button key={nom} type="button" aria-label={nom} onClick={() => setZoom((z) => Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, z + pas)))} className="h-11 w-11 rounded-xl text-[22px] leading-none" style={{ background: colors.card, color: colors.rust, fontFamily: font.display, boxShadow: `0 2px 6px ${voile(colors.ink, 0.18)}` }}>
              {signe}
            </button>
          ))}
        </div>
        <span className="absolute bottom-1.5 right-2 rounded-md px-1.5 text-[10.5px]" style={{ background: voile(colors.card, 0.8), color: colors.ink }}>IGN</span>
      </div>
      <p className="m-0 mt-2 text-[13px] leading-[1.45]" style={{ color: colors.muted }}>
        {releve ? "Sous les arbres, le GPS peut se tromper de quelques mètres. Touchez la carte à l’endroit exact du chantier." : "Touchez la carte à l’endroit exact du chantier."}
      </p>
    </div>
  );
}
