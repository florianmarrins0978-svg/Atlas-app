"use client";

import { colors, font } from "@/lib/design-tokens";
import { composerNourrice, HAUT, type NourriceComposee } from "@/lib/arrosage/nourrice-eclatee";
import { PHOTOS_NOURRICE } from "@/lib/arrosage/photos-nourrice";
import { photoDe } from "@/lib/arrosage/photos";
import type { Retouches } from "@/lib/arrosage/retouches";
import { CATALOGUE } from "@/lib/arrosage/catalogue.js";

const CAT = CATALOGUE as unknown as { piece(ref: string): { nom: string; marque?: string } | null };

/**
 * LA NOURRICE ÉCLATÉE, À L'ÉCRAN — le dessin validé le 18 octobre 2026, en
 * SVG : chaque photo à sa place et dans son angle (`nourrice-eclatee.ts`), un
 * numéro par pièce, l'arrivée d'eau fléchée, la voie de chaque réseau dans sa
 * couleur.
 *
 * **Les pièces de la nourrice se touchent par leur NUMÉRO, dans la légende ou
 * dans le bac « Avec la nourrice »** — sa demande du 18 octobre 2026 : sur le
 * dessin, elles sont trop serrées. La phrase en rouge au-dessus du plan le dit.
 *
 * Le fond du dessin reste blanc quelle que soit la charte : les photos sont
 * détourées sur blanc et fondues en `multiply`, et c'est ce qu'il a validé.
 */
export default function NourriceEclatee({
  voies,
  nbGoutte,
  couleurs,
  retouches,
  nombre,
  onTouche,
}: {
  voies: number;
  nbGoutte: number;
  couleurs: string[];
  retouches: Retouches;
  /** Combien de chaque pièce la fiche compte, pour dire « 2 en moins » dans la légende. */
  nombre: Record<string, number>;
  onTouche: (ref: string, nom: string) => void;
}) {
  const n = composerNourrice(voies, nbGoutte);
  if (!n) {
    return (
      <p className="mt-3 text-[14px]" style={{ color: colors.alert }}>
        Aucune fiche de nourrice pour {voies} voies.
      </p>
    );
  }
  const NOMS: Record<string, string> = { "coude-mf": "Coude MF 1\"", mamelon: "Mamelon réduit MM 1\" x 3/4\"", "vanne-purge": "Vanne 3/4\" FF", pehd: "PEHD Ø25" };
  const etatDe = (ref: string) => (retouches.retirees[`nr:${ref}`] || (retouches.nrUne[ref] ?? 0) >= (nombre[ref] ?? 1) ? "retiree" : retouches.remplacees[`nr:${ref}`] ? "changee" : "");
  const nomDe = (ref: string) => {
    const c = retouches.remplacees[`nr:${ref}`];
    if (c) return c.nom;
    const base = NOMS[ref] ?? nomCatalogue(ref);
    return retouches.nrUne[ref] ? `${base}, ${retouches.nrUne[ref]} en moins` : base;
  };
  const couleurTexte = (etat: string) => (etat === "retiree" ? colors.alert : etat === "changee" ? colors.orTexte : colors.inkSoft);

  return (
    <div data-atlas="nourrice-eclatee">
      <div className="mt-3 overflow-hidden rounded-[16px] py-2" style={{ backgroundColor: "#ffffff", boxShadow: `inset 0 0 0 1px ${colors.line}` }}>
        <Dessin n={n} couleurs={couleurs} />
      </div>

      {/* La légende numérotée : c'est elle qu'on touche. */}
      <ol className="mt-3 list-none p-0" style={{ columns: 2, columnGap: 14, fontSize: 12.5, color: colors.inkSoft }}>
        {n.ordre.map((ref, i) => {
          const etat = etatDe(ref);
          return (
            <li key={ref} className="flex gap-1.5 py-[2px]" style={{ breakInside: "avoid" }}>
              <button
                type="button"
                data-atlas="piece-nourrice"
                data-nr={ref}
                onClick={() => onTouche(ref, nomCatalogue(ref))}
                className="flex w-full gap-1.5 border-0 bg-transparent p-0 text-left"
                style={{ font: "inherit", color: "inherit", cursor: "pointer" }}
              >
                <b className="flex-none rounded-full text-center" style={{ width: 17, height: 17, backgroundColor: colors.ink, color: colors.card, fontSize: 10, lineHeight: "17px" }}>
                  {i + 1}
                </b>
                <span style={{ color: couleurTexte(etat), textDecoration: etat === "retiree" ? "line-through" : undefined }}>{nomDe(ref)}</span>
              </button>
            </li>
          );
        })}
      </ol>

      {/* Le bac : ce que la fiche compte et que le dessin ne pose pas (regard, programmateur, pile…). */}
      {Object.keys(n.reste).some((ref) => n.reste[ref] > 0) && (
        <div className="mt-[14px]">
          <h3 className="m-0 text-[14px] font-semibold">Avec la nourrice</h3>
          <div className="mt-2 flex flex-wrap gap-x-2 gap-y-3 rounded-[14px] px-[10px] py-[14px]" style={{ backgroundColor: colors.card }}>
            {Object.keys(n.reste)
              .filter((ref) => n.reste[ref] > 0)
              .map((ref) => {
                const etat = etatDe(ref);
                const montree = retouches.remplacees[`nr:${ref}`]?.ref ?? ref;
                const photo = photoDe(montree);
                return (
                  <button
                    key={ref}
                    type="button"
                    data-atlas="piece-nourrice"
                    data-nr={ref}
                    onClick={() => onTouche(ref, nomCatalogue(ref))}
                    className="flex w-[72px] min-w-0 flex-col items-center border-0 bg-transparent p-0 text-center"
                    style={{ font: "inherit", color: "inherit", cursor: "pointer" }}
                  >
                    <span className="flex aspect-square w-full max-w-[64px] items-center justify-center" style={{ opacity: etat === "retiree" ? 0.35 : 1, filter: etat === "retiree" ? "grayscale(1)" : undefined }}>
                      {photo ? (
                        // eslint-disable-next-line @next/next/no-img-element -- pansement assumé : next/image n’a rien à optimiser sur une photo de pièce servie telle quelle depuis public/, une photo de pièce, servie telle quelle
                        <img src={photo} alt="" style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain" }} />
                      ) : (
                        <span style={{ fontSize: 10, color: colors.muted }}>photo à venir</span>
                      )}
                    </span>
                    <span className="mt-1" style={{ fontSize: 10.5, lineHeight: 1.25, color: couleurTexte(etat), textDecoration: etat === "retiree" ? "line-through" : undefined }}>
                      {n.reste[ref] > 1 ? `${n.reste[ref]}x ` : ""}
                      {nomDe(ref)}
                    </span>
                  </button>
                );
              })}
          </div>
        </div>
      )}
    </div>
  );
}

/** Le nom d'une pièce de nourrice, avec sa marque : le catalogue est du JavaScript, on ne nomme que ce qu'on lit. */
function nomCatalogue(ref: string): string {
  const p = CAT.piece(ref);
  return p ? (p.marque ? `${p.marque} ` : "") + p.nom : ref;
}

/** Le dessin lui-même : un SVG en pixels de dessin, mis à l'échelle par sa largeur. */
function Dessin({ n, couleurs }: { n: NourriceComposee; couleurs: string[] }) {
  const encre = "#4a4a44";
  return (
    <svg
      viewBox={`0 0 ${n.largeur} ${n.hauteur}`}
      className="mx-auto block"
      style={{ width: "100%", maxWidth: n.largeur, height: "auto" }}
      role="img"
      aria-label="La nourrice, pièce par pièce"
    >
      {n.poses.map((p, i) => {
        const href = photoDe(p.ref);
        const m = PHOTOS_NOURRICE[p.ref];
        const cw = m ? m.x1 - m.x0 : 0, ch = m ? m.y1 - m.y0 : 0;
        // La photo détourée : une fenêtre (viewBox) sur la boîte mesurée de la photo entière.
        const fenetre = (w: number, h: number) =>
          href && m ? (
            <svg width={w} height={h} viewBox={`${m.x0} ${m.y0} ${cw} ${ch}`} preserveAspectRatio="none" style={{ mixBlendMode: "multiply" }}>
              <image href={href} width={m.largeur} height={m.hauteur} />
            </svg>
          ) : null;
        if (p.haut) {
          const f = HAUT[p.ref];
          const transforms: string[] = [`translate(${p.x + p.w / 2} ${p.y + p.h / 2})`];
          if (f?.demi) transforms.push("rotate(180)");
          if (f?.miroir) transforms.push("scale(-1 1)");
          return (
            <g key={i}>
              <g transform={transforms.join(" ")}>
                <g transform={`translate(${-p.w / 2} ${-p.h / 2})`}>{fenetre(p.w, p.h)}</g>
              </g>
              <Badge n={p.numero} x={p.x + p.w + 2} y={p.y + 5} />
            </g>
          );
        }
        return (
          <g key={i}>
            <g transform={`translate(${p.x} ${p.y}) rotate(${p.angle}) scale(${p.echelle}) translate(${-p.ax} ${-p.ay})`}>{fenetre(cw, ch)}</g>
            <Badge n={p.numero} x={p.x + 24} y={p.y + p.L / 2} />
          </g>
        );
      })}
      {/* L'arrivée d'eau : le mot en bas, une flèche qui monte jusqu'au PEHD (sa demande du 18 octobre 2026). */}
      <line x1={n.arrivee.x} y1={n.arrivee.bas + 30} x2={n.arrivee.x} y2={n.arrivee.bas + 9} stroke={encre} strokeWidth={1.6} />
      <path d={`M${n.arrivee.x} ${n.arrivee.bas + 4} L${n.arrivee.x - 5} ${n.arrivee.bas + 11} L${n.arrivee.x + 5} ${n.arrivee.bas + 11} Z`} fill={encre} />
      {n.etiquettes.map((e, i) => {
        if ("texte" in e) {
          return (
            <text key={i} x={e.x} y={e.y + 6} textAnchor="middle" dominantBaseline="hanging" fontSize={10} fontWeight={600} fontFamily={font.body} fill={encre}>
              {e.texte}
            </text>
          );
        }
        // Deux voies voisines sont serrées : une sur deux descend ; une voie de
        // goutte-à-goutte le dit sous son numéro, et deux voisines s'écartent de deux lignes.
        const goutte = e.goutte >= 0;
        const dy = goutte ? (e.goutte % 2) * 26 : e.reseau % 2 === 1 ? 13 : 0;
        const couleur = couleurs[e.reseau] ?? encre;
        return (
          <g key={i}>
            <text x={e.x} y={e.y + 6 + dy} textAnchor="middle" dominantBaseline="hanging" fontSize={10} fontWeight={600} fontFamily={font.body} fill={couleur}>
              R{e.reseau + 1}
            </text>
            {goutte && (
              <text x={e.x} y={e.y + 18 + dy} textAnchor="middle" dominantBaseline="hanging" fontSize={10} fontWeight={600} fontFamily={font.body} fill={couleur}>
                goutte-à-goutte
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}

function Badge({ n, x, y }: { n: number; x: number; y: number }) {
  return (
    <g>
      <circle cx={x} cy={y} r={7} fill="#1c1c1a" />
      <text x={x} y={y + 0.5} textAnchor="middle" dominantBaseline="middle" fontSize={9} fontWeight={600} fontFamily={font.body} fill="#ffffff">
        {n}
      </text>
    </g>
  );
}
