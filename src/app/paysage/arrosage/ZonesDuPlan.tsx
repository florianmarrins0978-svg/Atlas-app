"use client";

import { useRef, useState } from "react";
import { colors, font, libelleCaps, surPlein } from "@/lib/design-tokens";
import type { ParametresPlan, ZoneParametre } from "@/lib/arrosage/consignes";
import { ajouterUneZone, glisserLaZone, modifierLaZone, nomDeLaZone, supprimerLaZone, type Geste } from "@/lib/arrosage/zones-du-plan";

/**
 * CORRIGER UNE ZONE LUE, EN AJOUTER UNE — « la A », sa réponse du 20 octobre
 * 2026 (`appli/arrosage-cotes-des-zones.html`). « Modifier » à droite du nom de
 * la zone, sur son réseau : la longueur, la largeur, la place au doigt, et
 * Supprimer la zone. « Ajouter une zone » sous les réseaux.
 *
 * Les règles vivent dans `zones-du-plan.ts` : cet écran les appelle et pose
 * les paramètres qu'elles rendent. Le calcul refait le plan, rien d'autre.
 */

const champ = "mt-[5px] block w-full min-w-0 rounded-[10px] border-0 px-[12px] py-3 text-[16px]";
const virgule = (x: number) => String(Math.round(x * 100) / 100).replace(".", ",");
const nombre = (s: string) => Number(s.replace(",", "."));

/** « 12 m sur 10 m », ou « 6 m » pour une haie. */
export function cotesEcrites(z: ZoneParametre): string {
  return z.type === "haie" ? `${virgule(z.ml ?? 0)} m` : `${virgule(z.L ?? 0)} m sur ${virgule(z.l ?? 0)} m`;
}

export function ModifierLaZone({
  zone,
  parametres,
  onParametres,
  onFermer,
}: {
  zone: ZoneParametre;
  parametres: ParametresPlan;
  onParametres: (p: ParametresPlan) => void;
  onFermer: () => void;
}) {
  const haie = zone.type === "haie";
  const [L, setL] = useState(virgule(haie ? zone.ml ?? 0 : zone.L ?? 0));
  const [l, setLl] = useState(virgule(zone.l ?? 0));
  const [refus, setRefus] = useState<string | null>(null);
  // Supprimer se touche deux fois : une zone partie emporte son réseau.
  const [arme, setArme] = useState(false);
  const poser = (g: Geste, apres?: () => void) => {
    if (!g.ok) { setRefus(g.raison); return; }
    setRefus(null);
    onParametres(g.parametres);
    apres?.();
  };

  return (
    <div className="mt-2 rounded-[16px] px-4 pb-4 pt-[14px]" style={{ backgroundColor: colors.card, boxShadow: `0 1px 2px ${colors.line}` }} data-atlas="modifier-la-zone">
      <div className="flex items-center">
        <h3 className="min-w-0 flex-1" style={{ fontFamily: font.display, fontWeight: 400, fontSize: 20, lineHeight: 1.2 }}>{nomDeLaZone(zone)}</h3>
        <button type="button" onClick={onFermer} className="min-h-[44px] bg-transparent px-1 text-[14px] underline" style={{ color: colors.inkSoft }}>
          Fermer
        </button>
      </div>
      <div className={`mt-2 grid gap-2.5 ${haie ? "grid-cols-1" : "grid-cols-2"}`}>
        <label className="min-w-0">
          <span className={`block ${libelleCaps}`} style={{ color: colors.muted }}>Longueur, m</span>
          <input inputMode="decimal" value={L} onChange={(e) => setL(e.target.value)} className={champ} style={{ backgroundColor: colors.cream, color: colors.ink, boxShadow: `inset 0 0 0 1px ${colors.line}` }} data-atlas="zone-longueur" />
        </label>
        {!haie && (
          <label className="min-w-0">
            <span className={`block ${libelleCaps}`} style={{ color: colors.muted }}>Largeur, m</span>
            <input inputMode="decimal" value={l} onChange={(e) => setLl(e.target.value)} className={champ} style={{ backgroundColor: colors.cream, color: colors.ink, boxShadow: `inset 0 0 0 1px ${colors.line}` }} data-atlas="zone-largeur" />
          </label>
        )}
      </div>
      <PoserAuDoigt zone={zone} parametres={parametres} onPosee={(x, y) => poser(glisserLaZone(parametres, zone.id, x, y))} />
      {refus && (
        <p role="alert" className="mt-2 text-[14px]" style={{ color: colors.alert }}>{refus}</p>
      )}
      <button
        type="button"
        onClick={() => poser(modifierLaZone(parametres, zone.id, haie ? { ml: nombre(L) } : { L: nombre(L), l: nombre(l) }))}
        className="atlas-plein mt-3 min-h-[52px] w-full rounded-[12px] border-0 text-[15.5px] font-semibold"
        style={{ backgroundColor: colors.plein, color: surPlein }}
        data-atlas="refaire-le-plan"
      >
        Refaire le plan
      </button>
      <button
        type="button"
        onClick={() => (arme ? poser(supprimerLaZone(parametres, zone.id), onFermer) : setArme(true))}
        className="mt-2 min-h-[50px] w-full rounded-[12px] text-[15.5px]"
        style={{ border: `1px solid ${colors.line}`, backgroundColor: colors.cream, color: colors.alert }}
        data-atlas="supprimer-la-zone"
      >
        {arme ? `Supprimer « ${nomDeLaZone(zone)} » ?` : "Supprimer la zone"}
      </button>
    </div>
  );
}

/**
 * La zone glissée au doigt sur un petit plan de toutes les zones, en mètres.
 * L'aimant de 50 cm se prend dans `glisserLaZone`, au lâcher : pendant le
 * geste, la zone suit le doigt sans sauter.
 */
function PoserAuDoigt({ zone, parametres, onPosee }: { zone: ZoneParametre; parametres: ParametresPlan; onPosee: (x: number, y: number) => void }) {
  const svg = useRef<SVGSVGElement>(null);
  const [glisse, setGlisse] = useState<{ x: number; y: number; dx: number; dy: number } | null>(null);
  const zones = parametres.zones.filter((z) => Number.isFinite(z.x) && Number.isFinite(z.y));
  if (!zones.some((z) => z.id === zone.id)) return null;
  const larg = (z: ZoneParametre) => z.L ?? z.ml ?? 0;
  const haut = (z: ZoneParametre) => (z.type === "haie" ? 0.3 : z.l ?? 0);
  const x0 = Math.min(...zones.map((z) => z.x!)) - 2, y0 = Math.min(...zones.map((z) => z.y!)) - 2;
  const x1 = Math.max(...zones.map((z) => z.x! + larg(z))) + 2, y1 = Math.max(...zones.map((z) => z.y! + haut(z))) + 2;
  const metres = (e: React.PointerEvent) => {
    const m = svg.current?.getScreenCTM();
    if (!m) return null;
    const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(m.inverse());
    return { x: p.x, y: p.y };
  };
  const ici = glisse ?? { x: zone.x!, y: zone.y!, dx: 0, dy: 0 };
  return (
    <>
      <p className="mt-3 text-[13.5px]" style={{ color: colors.muted }}>Glissez la zone à sa place.</p>
      <svg
        ref={svg}
        viewBox={`${x0} ${y0} ${x1 - x0} ${y1 - y0}`}
        className="mt-1 block w-full rounded-[12px]"
        style={{ backgroundColor: colors.cream, boxShadow: `inset 0 0 0 1px ${colors.line}`, touchAction: "none", userSelect: "none", maxHeight: 280 }}
        data-atlas="poser-la-zone"
        // Le doigt se suit sur tout le plan : une zone fine se perd dès qu'il la dépasse.
        onPointerMove={(e) => {
          const m = glisse && metres(e);
          if (glisse && m) setGlisse({ ...glisse, x: m.x - glisse.dx, y: m.y - glisse.dy });
        }}
        onPointerUp={() => {
          if (glisse) onPosee(glisse.x, glisse.y);
          setGlisse(null);
        }}
      >
        {zones.filter((z) => z.id !== zone.id).map((z) => (
          <g key={z.id}>
            <rect x={z.x} y={z.y} width={larg(z)} height={haut(z)} fill={colors.card} stroke={colors.muted} strokeWidth={0.08} />
            <text x={z.x! + 0.3} y={z.y! + 0.8} fontSize={0.6} fill={colors.inkSoft}>{nomDeLaZone(z)}</text>
          </g>
        ))}
        <rect
          x={ici.x} y={ici.y} width={larg(zone)} height={haut(zone)}
          fill={colors.or} fillOpacity={0.35} stroke={colors.ink} strokeWidth={glisse ? 0.16 : 0.08}
        />
        <text x={ici.x} y={ici.y - 0.25} fontSize={0.6} fill={colors.ink}>{nomDeLaZone(zone)}</text>
        {/* Une bande de 30 cm ne s'attrape pas au doigt : la prise déborde d'un demi-mètre. */}
        <rect
          x={ici.x - 0.5} y={ici.y - 0.5} width={larg(zone) + 1} height={haut(zone) + 1} fill="transparent" style={{ cursor: "grab" }}
          onPointerDown={(e) => {
            const m = metres(e);
            if (!m) return;
            e.preventDefault();
            svg.current?.setPointerCapture(e.pointerId);
            setGlisse({ x: zone.x!, y: zone.y!, dx: m.x - zone.x!, dy: m.y - zone.y! });
          }}
        />
      </svg>
    </>
  );
}

export function AjouterUneZone({ parametres, onAjoutee }: { parametres: ParametresPlan; onAjoutee: (p: ParametresPlan, id: number) => void }) {
  const [ouvert, setOuvert] = useState(false);
  const [nom, setNom] = useState("");
  const [arrosage, setArrosage] = useState<"goutte" | "arroseurs">("goutte");
  const [L, setL] = useState("");
  const [l, setLl] = useState("");
  const [refus, setRefus] = useState<string | null>(null);
  const style = { backgroundColor: colors.cream, color: colors.ink, boxShadow: `inset 0 0 0 1px ${colors.line}` };
  if (!ouvert) {
    return (
      <button
        type="button"
        onClick={() => setOuvert(true)}
        className="mt-4 flex min-h-[52px] w-full items-center justify-center rounded-[12px] bg-transparent text-[15.5px]"
        style={{ border: `1.5px dashed ${colors.line}`, color: colors.ink }}
        data-atlas="ajouter-une-zone"
      >
        Ajouter une zone
      </button>
    );
  }
  return (
    <div className="mt-4 rounded-[16px] px-4 pb-4 pt-[14px]" style={{ backgroundColor: colors.card, boxShadow: `0 1px 2px ${colors.line}` }} data-atlas="nouvelle-zone">
      <div className="flex items-center">
        <h3 className="min-w-0 flex-1" style={{ fontFamily: font.display, fontWeight: 400, fontSize: 20, lineHeight: 1.2 }}>Nouvelle zone</h3>
        <button type="button" onClick={() => setOuvert(false)} className="min-h-[44px] bg-transparent px-1 text-[14px] underline" style={{ color: colors.inkSoft }}>
          Fermer
        </button>
      </div>
      <label className="mt-2 block">
        <span className={`block ${libelleCaps}`} style={{ color: colors.muted }}>Nom</span>
        <input value={nom} onChange={(e) => setNom(e.target.value)} className={champ} style={style} data-atlas="nouvelle-zone-nom" />
      </label>
      <label className="mt-2.5 block">
        <span className={`block ${libelleCaps}`} style={{ color: colors.muted }}>Arrosage</span>
        <select value={arrosage} onChange={(e) => setArrosage(e.target.value as "goutte" | "arroseurs")} className={`${champ} appearance-none`} style={style} data-atlas="nouvelle-zone-arrosage">
          <option value="goutte">Goutte-à-goutte</option>
          <option value="arroseurs">Arroseurs</option>
        </select>
      </label>
      <div className="mt-2.5 grid grid-cols-2 gap-2.5">
        <label className="min-w-0">
          <span className={`block ${libelleCaps}`} style={{ color: colors.muted }}>Longueur, m</span>
          <input inputMode="decimal" value={L} onChange={(e) => setL(e.target.value)} className={champ} style={style} data-atlas="nouvelle-zone-longueur" />
        </label>
        <label className="min-w-0">
          <span className={`block ${libelleCaps}`} style={{ color: colors.muted }}>Largeur, m</span>
          <input inputMode="decimal" value={l} onChange={(e) => setLl(e.target.value)} className={champ} style={style} data-atlas="nouvelle-zone-largeur" />
        </label>
      </div>
      {refus && (
        <p role="alert" className="mt-2 text-[14px]" style={{ color: colors.alert }}>{refus}</p>
      )}
      <button
        type="button"
        onClick={() => {
          const g = ajouterUneZone(parametres, { nom, arrosage, L: nombre(L), l: nombre(l) });
          if (!g.ok) { setRefus(g.raison); return; }
          setRefus(null);
          setOuvert(false);
          setNom(""); setL(""); setLl("");
          onAjoutee(g.parametres, g.parametres.zones[g.parametres.zones.length - 1].id);
        }}
        className="atlas-plein mt-3 min-h-[52px] w-full rounded-[12px] border-0 text-[15.5px] font-semibold"
        style={{ backgroundColor: colors.plein, color: surPlein }}
        data-atlas="nouvelle-zone-valider"
      >
        Ajouter au plan
      </button>
    </div>
  );
}
