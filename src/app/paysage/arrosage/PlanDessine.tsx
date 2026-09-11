import { colors, font, libelleCaps, voile } from "@/lib/design-tokens";
import type { Dessin } from "@/lib/arrosage/plan-dessine";

/**
 * LE PLAN, À L'ÉCRAN — sa demande du 21 août 2026.
 *
 * *« Il manque la photo, le schéma avec les réseaux, et l'implantation des
 * arroseurs. Les différents réseaux de couleurs. »* La maquette validée est
 * `appli/arrosage-plan.html`, refaite le 11 septembre 2026 dans
 * `appli/arrosage-plan-et-pieces.html` ; ce composant en est le portage, à
 * ceci près qu'il ne dessine plus SON jardin mais celui que le croquis donne.
 *
 * **Le SVG travaille EN MÈTRES**, et c'est ce qui rend le dessin vérifiable :
 * un contrôle peut lire `points="0,4 0,0 6,0"` et retrouver les cotes, ce qui
 * serait impossible sur des pixels. Le `viewBox` fait toute la mise à
 * l'échelle ; aucune longueur n'est convertie à la main nulle part.
 *
 * **Rien n'est écrit ici qui ne se déduise du dessin** (`plan-dessine.ts`) : ni
 * un compte de pièces, ni un métré. Un récapitulatif figé sous un tableau qui
 * dit autre chose est le défaut qu'il a relevé le 21 août — « 9 tés + 4
 * coudes » sous un tableau qui en annonçait 8 et 5.
 *
 * **AUCUNE COULEUR ÉCRITE EN CLAIR — corrigé le 11 septembre 2026.** Ce dessin
 * portait six couleurs en dur (`#1A1A18`, `#E9ECE0`, `#7C8271`…) : sur Nuit et
 * Sylve, la nourrice se dessinait en noir sur une carte noire, et les cotes
 * disparaissaient. Tout suit désormais la charte — `colors.*`, et `voile()`
 * pour ce qui se pose en transparence (`CLAUDE.md` §3). Les couleurs des
 * RÉSEAUX viennent du calcul, et elles sont saturées à dessein : elles se
 * lisent sur les huit fonds.
 */

/** La tranchée : un voile d'encre, jamais une terre écrite en clair. Elle ne peut se confondre avec aucune couleur de réseau. */
const TRANCHEE = voile(colors.ink, 0.22);

export default function PlanDessine({ dessin }: { dessin: Dessin }) {
  const traits = {
    contour: 0.26,
    ligne: 0.26,
    /** L'antenne Ø16 : plus fine que la ligne Ø25, comme sur le chantier. */
    antenne: 0.13,
    tranchee: 0.95,
  };

  return (
    <div data-atlas="plan-dessine">
      <p className={`mx-[22px] mt-7 ${libelleCaps}`} style={{ color: colors.muted }}>
        Le plan · {dessin.metresTranchee.toString().replace(".", ",")} ml de tranchée
      </p>

      <div className="mx-[22px] mt-2 rounded-[12px] p-3" style={{ backgroundColor: colors.card }}>
        <svg
          viewBox={dessin.viewBox}
          className="block w-full"
          role="img"
          aria-label="Plan du jardin : la nourrice, la tranchée et les réseaux"
        >
          {/* **LES PORTÉES SE DÉCOUPENT SUR LA PELOUSE.** Sans ce masque, les
              cercles débordent de tous les côtés et noient le dessin sous des
              aplats pâles — vu à la capture du 23 août. Ils débordent d'ailleurs
              pour de bon : un arroseur de coin projette au-delà de la limite,
              et c'est justement ce qu'on ne veut pas montrer comme arrosé. */}
          <defs>
            <clipPath id="pelouse-plan">
              {dessin.contours.map((c, i) => (
                <polygon key={i} points={enPoints(c)} />
              ))}
            </clipPath>
          </defs>

          {/* La pelouse, puis ce qui n'en est pas — une terrasse au milieu se
              découpe dedans, sinon le tuyau paraîtrait passer dessous. */}
          {dessin.contours.map((c, i) => (
            <polygon key={`f${i}`} points={enPoints(c)} fill={voile(colors.plein, 0.16)} stroke="none" />
          ))}
          {dessin.trous.map((c, i) => (
            <polygon key={`t${i}`} points={enPoints(c)} fill={colors.card} stroke="none" />
          ))}

          {/* **LA TRANCHÉE D'ABORD, SOUS TOUT LE RESTE.** C'est une saignée dans
              la terre, large ; les tuyaux qui y passent sont des traits fins.
              La dessiner par-dessus masquerait les lignes qu'elle porte. */}
          {dessin.tranchee.map((s, i) => (
            <line
              key={`s${i}`}
              x1={s.de.x}
              y1={s.de.y}
              x2={s.a.x}
              y2={s.a.y}
              stroke={TRANCHEE}
              strokeWidth={traits.tranchee}
              strokeLinecap="round"
              data-atlas="tranchee"
            />
          ))}

          {dessin.contours.map((c, i) => (
            <polygon key={`b${i}`} points={enPoints(c)} fill="none" stroke={voile(colors.ink, 0.45)} strokeWidth={traits.contour} />
          ))}
          {dessin.trous.map((c, i) => (
            <polygon key={`bt${i}`} points={enPoints(c)} fill="none" stroke={voile(colors.ink, 0.45)} strokeWidth={traits.contour} />
          ))}

          {/* Les cotes, mesurées sur le trait — jamais recopiées de la saisie. */}
          {dessin.cotes.map((c, i) => (
            <text
              key={`c${i}`}
              x={c.x}
              y={c.y}
              textAnchor={c.ancre}
              fontSize={0.95}
              fontFamily={font.display}
              fill={colors.muted}
              data-atlas="cote"
            >
              {c.texte}
            </text>
          ))}

          {/* Le cheminement hors pelouse : en pointillé, parce qu'il n'est PAS
              mesuré. Un trait plein ferait croire à un métré. */}
          {dessin.liaisons.map((s, i) => (
            <line
              key={`l${i}`}
              x1={s.de.x}
              y1={s.de.y}
              x2={s.a.x}
              y2={s.a.y}
              stroke={colors.ink}
              strokeWidth={0.2}
              strokeDasharray="0.5 0.4"
              data-atlas="liaison"
            />
          ))}

          {/* Les portées, en aplat très pâle : c'est ce qui montre qu'il ne
              reste pas de coin sec, sans avoir à le faire croire sur parole. */}
          {dessin.reseaux.map((r) =>
            r.tetes.map((t, i) => (
              <circle
                key={`p${r.numero}-${i}`}
                cx={t.x}
                cy={t.y}
                r={t.portee}
                fill={r.couleur}
                fillOpacity={0.13}
                clipPath="url(#pelouse-plan)"
              />
            ))
          )}

          {dessin.reseaux.map((r) => (
            <g key={`r${r.numero}`} data-atlas="reseau" data-reseau={r.numero}>
              {r.traits.map((t, i) => (
                <line
                  key={i}
                  x1={arrondi(t.de.x)}
                  y1={arrondi(t.de.y)}
                  x2={arrondi(t.a.x)}
                  y2={arrondi(t.a.y)}
                  stroke={r.couleur}
                  strokeWidth={traits.ligne}
                  strokeLinecap="round"
                />
              ))}
              {/* **L'antenne Ø16, du pied sur la ligne à la tête** — sa règle du
                  11 septembre : le Ø25 passe, l'antenne va chercher l'arroseur.
                  Plus fine que la ligne, pour qu'on voie laquelle se creuse. */}
              {r.antennes.map((a, i) => (
                <line
                  key={`a${i}`}
                  x1={arrondi(a.de.x)}
                  y1={arrondi(a.de.y)}
                  x2={arrondi(a.a.x)}
                  y2={arrondi(a.a.y)}
                  stroke={r.couleur}
                  strokeWidth={traits.antenne}
                  strokeLinecap="round"
                  data-atlas="antenne"
                />
              ))}
              {/* Le losange n'arrose rien : la ligne s'y sépare en deux. À côté
                  d'un arroseur, c'est le té égal qui s'ajoute à son té taraudé. */}
              {r.jonctions.map((p, i) => (
                <rect
                  key={`j${i}`}
                  x={p.x - 0.38}
                  y={p.y - 0.38}
                  width={0.76}
                  height={0.76}
                  transform={`rotate(45 ${p.x} ${p.y})`}
                  fill={colors.card}
                  stroke={r.couleur}
                  strokeWidth={0.26}
                  data-piece="jonction"
                />
              ))}
              {/* **Deux têtes au même point se dessinent côte à côte** — sa règle
                  du 11 septembre : le point vrai est `x, y`, le symbole s'écarte
                  de `decalage` pour qu'on voie les deux. */}
              {r.tetes.map((t, i) =>
                t.forme === "rond" ? (
                  <circle
                    key={`h${i}`}
                    cx={t.x + t.decalage.x}
                    cy={t.y + t.decalage.y}
                    r={t.plein ? 0.5 : 0.42}
                    fill={t.plein ? r.couleur : colors.card}
                    stroke={r.couleur}
                    strokeWidth={t.plein ? 0.2 : 0.34}
                    data-famille="turbine"
                    data-piece={t.plein ? "te" : "coude"}
                  />
                ) : (
                  <rect
                    key={`h${i}`}
                    x={t.x + t.decalage.x - 0.44}
                    y={t.y + t.decalage.y - 0.44}
                    width={0.88}
                    height={0.88}
                    rx={0.12}
                    fill={t.plein ? r.couleur : colors.card}
                    stroke={r.couleur}
                    strokeWidth={t.plein ? 0.2 : 0.34}
                    data-famille="tuyere"
                    data-piece={t.plein ? "te" : "coude"}
                  />
                )
              )}
            </g>
          ))}

          {/* La nourrice, à l'endroit qu'IL a posé — jamais déplacée d'office. */}
          <g data-atlas="nourrice">
            <rect
              x={dessin.nourrice.x - 0.75}
              y={dessin.nourrice.y - 1.4}
              width={1.5}
              height={2.8}
              rx={0.3}
              fill={colors.card}
              stroke={colors.ink}
              strokeWidth={0.22}
            />
            <text
              x={dessin.etiquetteNourrice.x}
              y={dessin.etiquetteNourrice.y}
              textAnchor={dessin.etiquetteNourrice.ancre}
              fontSize={0.95}
              fontFamily={font.display}
              fill={colors.ink}
            >
              nourrice
            </text>
          </g>
        </svg>
      </div>

      {/* ── La légende : elle MONTRE, elle ne décrit pas ────────────────────
          Sa correction du 21 août : « pour ton schéma, tu as marqué plein — à
          côté, tu peux mettre un rond plein ». Un mot qui nomme une forme sans
          la dessiner oblige à revenir au plan pour comprendre. */}
      <div className="mx-[22px] mt-3 rounded-[12px] px-4 py-3" style={{ backgroundColor: colors.card }}>
        <Legende symbole={<circle r={0.72} fill={colors.ink} />} texte={<><b>rond</b> : une turbine</>} />
        <Legende
          symbole={<rect x={-0.66} y={-0.66} width={1.32} height={1.32} rx={0.18} fill={colors.ink} />}
          texte={<><b>carré</b> : une tuyère</>}
        />
        <Legende
          symbole={<circle r={0.72} fill={colors.ink} />}
          texte={<><b>plein</b> : la ligne continue · té taraudé 25×3/4″×25</>}
        />
        <Legende
          symbole={<circle r={0.6} fill={colors.card} stroke={colors.ink} strokeWidth={0.3} />}
          texte={<><b>creux</b> : la ligne s’arrête là · coude taraudé 25×3/4″</>}
        />
        <Legende
          symbole={
            <rect x={-0.56} y={-0.56} width={1.12} height={1.12} transform="rotate(45)" fill={colors.card} stroke={colors.ink} strokeWidth={0.3} />
          }
          texte={<><b>losange</b> : la ligne se sépare · té égal 25×25×25</>}
        />
        <Legende
          symbole={<line x1={-0.85} y1={0} x2={0.85} y2={0} stroke={colors.ink} strokeWidth={0.18} />}
          texte={<><b>trait fin</b> : l’antenne Ø16 rigide, 2 m au plus</>}
        />
        <Legende
          symbole={<line x1={-0.85} y1={0} x2={0.85} y2={0} stroke={TRANCHEE} strokeWidth={0.9} />}
          texte={<>la tranchée</>}
        />
      </div>
    </div>
  );
}

function enPoints(p: { x: number; y: number }[]) {
  return p.map((q) => `${arrondi(q.x)},${arrondi(q.y)}`).join(" ");
}

/** Trois décimales suffisent au millimètre — au-delà, le SVG devient illisible. */
function arrondi(v: number) {
  return Math.round(v * 1000) / 1000;
}

function Legende({ symbole, texte }: { symbole: React.ReactNode; texte: React.ReactNode }) {
  return (
    <p className="flex items-center gap-2.5 py-[5px] text-[13.5px]">
      <svg viewBox="-1 -1 2 2" className="h-[15px] w-[15px] flex-none" aria-hidden="true">
        {symbole}
      </svg>
      <span className="min-w-0 flex-1">{texte}</span>
    </p>
  );
}
