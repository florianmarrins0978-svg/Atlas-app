"use client";

import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type KeyboardEvent, type PointerEvent } from "react";
import { colors, font, pastelsMainOeuvre, voile } from "@/lib/design-tokens";
import {
  ecrireChoix,
  ecrireUnMontant,
  glisserLeJoint,
  lireChoix,
  PAS_DE_LA_POIGNEE,
  PART_MINIMUM,
  repartirMainOeuvre,
  type ChoixMainOeuvre,
  type QuestionMainOeuvre,
} from "@/lib/main-oeuvre-dictee";

/**
 * La main d'œuvre dictée, à l'arrêt d'avant-chiffrage : sa planche du
 * 21 octobre 2026 (`appli/main-d-oeuvre-repartie.html`), choisie le soir même.
 *
 * Une ligne à part, ou répartie ; une croix qui rend un travail à sa grille,
 * avec la phrase qui le dit. Les montants affichés sont calculés par
 * `repartirMainOeuvre`, la fonction même qui écrira le devis : ce que la barre
 * montre est ce qui partira (`CLAUDE.md` §3).
 *
 * **La barre, sa planche du 27 octobre 2026** (`appli/soignee/main-oeuvre-curseur.html`,
 * vue « Proposé », palette « Jardin ») : une seule barre pour tout le total,
 * un morceau par travail. Elle remplace un curseur natif par travail, où tirer
 * l'un faisait bouger tous les autres, au pas de 1 % (16 € sur 1 600 €), avec
 * des pourcentages qui faisaient 101 %. Désormais une poignée entre deux
 * travaux ne change qu'eux deux, de 10 € en 10 € (`glisserLeJoint`), et le
 * montant se touche pour s'écrire, à l'euro près (`ecrireUnMontant`).
 */
export function choixDeDepart(q: QuestionMainOeuvre): string {
  const choix: ChoixMainOeuvre = {
    mode: "reparti",
    parts: Object.fromEntries(q.travaux.map((t) => [t.cle, t.part])),
    retires: [],
  };
  return ecrireChoix(choix);
}

const euros = (montant: string | number) =>
  `${Number(montant).toLocaleString("fr-FR", { maximumFractionDigits: 2 })} €`;

/** Le filet de carte entre deux morceaux : le joint se lit sans bordure. */
const JOINT = 2;
const HAUTEUR = 64;

type Tenue = { k: number; id: number; x0: number; depart: number[] };

export default function RepartirLaMainOeuvre({
  question,
  valeur,
  onChange,
}: {
  question: QuestionMainOeuvre;
  valeur: string;
  onChange: (valeur: string) => void;
}) {
  const choix = lireChoix(valeur) ?? lireChoix(choixDeDepart(question))!;
  const dedans = question.travaux.filter((t) => !choix.retires.includes(t.cle));
  const repartis = repartirMainOeuvre(
    question.total,
    dedans.map((t) => t.cle),
    choix.parts
  );
  const montants = dedans.map((t) => Number(repartis[t.cle] ?? 0));
  const total = Number(question.total);
  const changer = (suite: Partial<ChoixMainOeuvre>) => onChange(ecrireChoix({ ...choix, ...suite }));
  // Ce que la barre a réglé devient les parts : des montants qui font juste le
  // total, que `repartirMainOeuvre` écrit tels quels sur le devis.
  const poser = (nouveaux: readonly number[]) =>
    changer({ parts: { ...choix.parts, ...Object.fromEntries(dedans.map((t, k) => [t.cle, nouveaux[k]])) } });

  const barre = useRef<HTMLDivElement>(null);
  const bulle = useRef<HTMLDivElement>(null);
  const ecrits = useRef<Record<string, HTMLSpanElement | null>>({});
  const [largeur, setLargeur] = useState(0);
  const [tenue, setTenue] = useState<Tenue | null>(null);
  const [saisie, setSaisie] = useState<{ cle: string; texte: string } | null>(null);
  const [bougent, setBougent] = useState<string[]>([]);

  const reparti = choix.mode === "reparti" && dedans.length > 0 && total > 0;
  const utile = Math.max(0, largeur - JOINT * (dedans.length - 1));
  const rang = (cle: string) => dedans.findIndex((t) => t.cle === cle);
  const teinte = (cle: string) => pastelsMainOeuvre.teintes[Math.max(0, rang(cle)) % pastelsMainOeuvre.teintes.length];

  useEffect(() => {
    const b = barre.current;
    if (!b) return;
    const suivre = new ResizeObserver(() => setLargeur(b.clientWidth));
    suivre.observe(b);
    return () => suivre.disconnect();
  }, [reparti]);

  // **Le montant s'écrit dans son morceau s'il TIENT, mesuré sur son texte** :
  // à 15 px, sinon à 13 px, sinon il se tait et reste sur sa ligne. Un seuil
  // fixe taisait tout montant sous 350 € sur la barre de son téléphone, et avec
  // cinq travaux il ne restait qu'un chiffre (sa capture du 27 octobre 2026).
  // La place se lit sur le montant, pas sur le morceau, qui peut être en train
  // de couler vers sa nouvelle largeur.
  useLayoutEffect(() => {
    dedans.forEach((t, k) => {
      const el = ecrits.current[t.cle];
      if (!el) return;
      const place = (utile * montants[k]) / total;
      el.style.fontSize = "15px";
      let tient = largeur === 0 || el.offsetWidth + 10 <= place;
      if (!tient) {
        el.style.fontSize = "13px";
        tient = el.offsetWidth + 6 <= place;
      }
      el.style.opacity = tient ? "1" : "0";
    });
  });

  const jusquAu = (k: number) => montants.slice(0, k + 1).reduce((s, m) => s + m, 0) / total;
  const xDuJoint = (k: number) => utile * jusquAu(k) + JOINT * k + JOINT / 2;
  // En proportion de la barre, comme les morceaux : juste dès le premier
  // dessin, avant même que la barre soit mesurée.
  const restant = `(100% - ${JOINT * (dedans.length - 1)}px)`;
  const ecoule = tenue ? "" : "transition-[width,margin,left,background-color] duration-[280ms] ease-[cubic-bezier(0.16,1,0.3,1)] motion-reduce:transition-none";

  // La bulle reste dans la barre ; sa pointe, elle, reste sur la poignée.
  useLayoutEffect(() => {
    const b = bulle.current;
    if (!b || !tenue) return;
    const demi = b.offsetWidth / 2;
    const ici = xDuJoint(tenue.k);
    const x = Math.max(demi, Math.min(largeur - demi, ici));
    b.style.left = `${x}px`;
    b.style.setProperty("--pointe", `${ici - x + demi}px`);
  });

  function saisir(e: PointerEvent<HTMLDivElement>, k: number) {
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    setTenue({ k, id: e.pointerId, x0: e.clientX, depart: montants });
  }
  function glisser(e: PointerEvent<HTMLDivElement>) {
    if (!tenue || e.pointerId !== tenue.id || utile <= 0) return;
    const voulu = tenue.depart[tenue.k] + ((e.clientX - tenue.x0) * total) / utile;
    const nouveaux = glisserLeJoint(tenue.depart, tenue.k, voulu);
    if (nouveaux.some((m, i) => m !== montants[i])) poser(nouveaux);
  }
  function lacher(e: PointerEvent<HTMLDivElement>) {
    if (tenue && e.pointerId === tenue.id) setTenue(null);
  }
  function auClavier(e: KeyboardEvent<HTMLDivElement>, k: number) {
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
    e.preventDefault();
    poser(glisserLeJoint(montants, k, montants[k] + (e.key === "ArrowRight" ? PAS_DE_LA_POIGNEE : -PAS_DE_LA_POIGNEE)));
  }

  const minuterie = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => {
    if (minuterie.current) clearTimeout(minuterie.current);
  }, []);
  function finirLaSaisie(garder: boolean) {
    if (!saisie) return;
    const lu = saisie.texte.replace(/[^0-9]/g, "");
    setSaisie(null);
    if (!garder || lu === "") return;
    const r = ecrireUnMontant(montants, rang(saisie.cle), Number(lu));
    poser(r.montants);
    setBougent(r.touches.map((i) => dedans[i].cle));
    if (minuterie.current) clearTimeout(minuterie.current);
    minuterie.current = setTimeout(() => setBougent([]), 1200);
  }

  const voisinsTenus = tenue ? [dedans[tenue.k]?.cle, dedans[tenue.k + 1]?.cle] : [];
  const enMouvement = (cle: string) => bougent.includes(cle) || voisinsTenus.includes(cle);

  const pastille = (actif: boolean) => ({
    backgroundColor: actif ? colors.plein : colors.card,
    color: actif ? colors.cream : colors.ink,
  });
  const ombre = `0 1px 2px ${voile(colors.ink, 0.05)}, 0 6px 18px ${voile(colors.ink, 0.06)}`;
  const filet: CSSProperties = { boxShadow: `inset 0 1px 0 ${colors.line}` };

  return (
    <div data-atlas="question-main-oeuvre">
      <p className="text-[12px]" style={{ color: colors.muted }}>
        {question.detail}
      </p>
      <div className="mt-2 flex flex-col gap-2">
        {(
          [
            ["ligne", "Sur une ligne Main d'œuvre"],
            ["reparti", "Répartis sur les travaux"],
          ] as const
        ).map(([mode, libelle]) => (
          <button
            key={mode}
            type="button"
            aria-pressed={choix.mode === mode}
            onClick={() => changer({ mode })}
            className="rounded-full px-4 py-2.5 text-left text-[14px] font-medium"
            style={pastille(choix.mode === mode)}
          >
            {libelle}
          </button>
        ))}
      </div>

      <div className="mt-4 rounded-[16px] px-4 pb-1.5 pt-[18px]" style={{ backgroundColor: colors.card, boxShadow: ombre }}>
        {reparti && (
          <div
            ref={barre}
            data-atlas="barre-main-oeuvre"
            className="relative select-none"
            style={{ height: HAUTEUR, touchAction: "pan-y", marginBottom: 26 }}
          >
            <div
              className="absolute inset-0 flex overflow-hidden rounded-[16px]"
              style={{ backgroundColor: colors.card }}
            >
              {question.travaux.map((t) => {
                const k = rang(t.cle);
                const m = k >= 0 ? montants[k] : 0;
                return (
                  <div
                    key={t.cle}
                    data-atlas="morceau-main-oeuvre"
                    data-cle={t.cle}
                    className={`relative grid flex-none place-items-center overflow-hidden ${ecoule}`}
                    style={{
                      width: k >= 0 ? `calc(${restant} * ${m / total})` : 0,
                      marginLeft: k > 0 ? JOINT : 0,
                      backgroundColor: k >= 0 ? teinte(t.cle) : "transparent",
                      color: pastelsMainOeuvre.encre,
                    }}
                  >
                    {k >= 0 && (
                      <span
                        ref={(el) => {
                          ecrits.current[t.cle] = el;
                        }}
                        className="whitespace-nowrap tabular-nums transition-opacity duration-150 motion-reduce:transition-none"
                        style={{ fontWeight: 650, letterSpacing: "-0.01em" }}
                      >
                        {euros(m)}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>

            {dedans.slice(0, -1).map((t, k) => {
              const suivant = dedans[k + 1];
              const paire = montants[k] + montants[k + 1];
              const tenueIci = tenue?.k === k;
              return (
                // La poignée : un rond de carte accroché sous le joint, à
                // cheval sur le bord. Posée au milieu de la barre, elle
                // couvrait le montant d'un morceau étroit.
                <div
                  key={t.cle}
                  role="slider"
                  tabIndex={0}
                  data-atlas="poignee-main-oeuvre"
                  aria-label={`Entre ${t.libelle} et ${suivant.libelle}`}
                  aria-valuemin={PART_MINIMUM}
                  aria-valuemax={Math.max(PART_MINIMUM, paire - PART_MINIMUM)}
                  aria-valuenow={montants[k]}
                  aria-valuetext={`${t.libelle} ${euros(montants[k])}, ${suivant.libelle} ${euros(montants[k + 1])}`}
                  onPointerDown={(e) => saisir(e, k)}
                  onPointerMove={glisser}
                  onPointerUp={lacher}
                  onPointerCancel={lacher}
                  onKeyDown={(e) => auClavier(e, k)}
                  className={`absolute z-[2] grid cursor-ew-resize place-items-center outline-none ${ecoule}`}
                  style={{
                    top: "100%",
                    left: `calc(${restant} * ${jusquAu(k)} + ${JOINT * k + JOINT / 2}px)`,
                    width: 48,
                    height: 64,
                    margin: "-32px 0 0 -24px",
                    touchAction: "none",
                    WebkitTapHighlightColor: "transparent",
                  }}
                >
                  <span
                    className="grid place-items-center rounded-full transition-[transform,box-shadow] duration-[180ms] ease-[cubic-bezier(0.16,1,0.3,1)] motion-reduce:transition-none"
                    style={{
                      width: 34,
                      height: 34,
                      backgroundColor: colors.card,
                      transform: tenueIci ? "scale(1.16)" : "none",
                      boxShadow: tenueIci
                        ? `0 0 0 2px ${colors.or}, 0 4px 10px ${voile(colors.ink, 0.16)}, 0 10px 24px ${voile(colors.ink, 0.14)}`
                        : `0 0 0 1px ${voile(colors.ink, 0.06)}, 0 2px 4px ${voile(colors.ink, 0.14)}, 0 6px 14px ${voile(colors.ink, 0.12)}`,
                    }}
                  >
                    <span
                      className="rounded-[1px]"
                      style={{ width: 7, height: 12, borderLeft: `2px solid ${colors.inkSoft}`, borderRight: `2px solid ${colors.inkSoft}` }}
                    />
                  </span>
                </div>
              );
            })}

            {tenue && dedans[tenue.k + 1] && (
              // La bulle pointe la poignée qu'on tient.
              <div
                ref={bulle}
                className="pointer-events-none absolute z-[3] flex items-center gap-2.5 whitespace-nowrap rounded-[10px] px-3 py-[7px] text-[15px] tabular-nums"
                style={{
                  bottom: "calc(100% + 12px)",
                  transform: "translateX(-50%)",
                  backgroundColor: colors.ink,
                  color: colors.card,
                  fontWeight: 650,
                  boxShadow: `0 4px 14px ${voile(colors.ink, 0.22)}`,
                }}
              >
                {euros(montants[tenue.k])}
                <i className="block" style={{ width: 1, height: 16, backgroundColor: voile(colors.card, 0.4) }} />
                {euros(montants[tenue.k + 1])}
                <span
                  className="absolute"
                  style={{
                    left: "var(--pointe, 50%)",
                    bottom: -5,
                    width: 10,
                    height: 10,
                    marginLeft: -5,
                    backgroundColor: colors.ink,
                    transform: "rotate(45deg)",
                    borderRadius: 2,
                  }}
                />
              </div>
            )}
          </div>
        )}

        <div>
          {question.travaux.map((t, i) => {
            const sorti = choix.retires.includes(t.cle);
            const separe = i > 0 ? filet : undefined;
            if (sorti) {
              return (
                <div key={t.cle} className="py-2.5" style={separe}>
                  <div className="flex items-center justify-between gap-3 text-[15px]">
                    <span className="min-w-0 line-through" style={{ color: colors.muted }}>
                      {t.libelle}
                    </span>
                    <button
                      type="button"
                      onClick={() => changer({ retires: choix.retires.filter((r) => r !== t.cle) })}
                      className="min-h-10 text-[14px] font-semibold"
                      style={{ color: colors.rust }}
                    >
                      Remettre
                    </button>
                  </div>
                  <p className="mt-0.5 text-[13px]" style={{ color: colors.rust }}>
                    {t.grille !== null
                      ? `Atlas va se référer à votre grille tarifaire : ${euros(t.grille)}.`
                      : "Pas de prix dans votre grille, cette ligne sera à chiffrer."}
                  </p>
                </div>
              );
            }
            const k = rang(t.cle);
            const voileDeLigne = `color-mix(in srgb, ${teinte(t.cle)} 14%, ${colors.card})`;
            return (
              <div
                key={t.cle}
                data-atlas="travail-main-oeuvre"
                className="flex min-h-[52px] items-center gap-3"
                style={{
                  ...separe,
                  // La ligne qui bouge s'éclaire de la couleur de son morceau.
                  background:
                    reparti && enMouvement(t.cle)
                      ? `linear-gradient(${voileDeLigne}, ${voileDeLigne}) no-repeat center / calc(100% + 16px) 100%`
                      : undefined,
                }}
              >
                {reparti && (
                  <span
                    className="flex-none rounded-full"
                    style={{ width: 12, height: 12, backgroundColor: teinte(t.cle), boxShadow: `inset 0 0 0 1px ${voile(colors.ink, 0.16)}` }}
                  />
                )}
                <span className="min-w-0 flex-1 text-[17px] leading-[1.25]" style={{ color: colors.ink, fontFamily: font.display }}>
                  {t.libelle}
                </span>
                {reparti &&
                  (saisie?.cle === t.cle ? (
                    <span
                      className="inline-flex min-h-11 flex-none items-center gap-1 rounded-[10px] px-2.5"
                      style={{ backgroundColor: colors.cream, boxShadow: `inset 0 0 0 2px ${colors.or}` }}
                    >
                      <input
                        type="text"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        enterKeyHint="done"
                        autoFocus
                        aria-label={`Montant de ${t.libelle}, en euros`}
                        value={saisie.texte}
                        onFocus={(e) => e.currentTarget.select()}
                        onChange={(e) => setSaisie({ cle: t.cle, texte: e.target.value })}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            finirLaSaisie(true);
                          }
                          if (e.key === "Escape") {
                            e.preventDefault();
                            finirLaSaisie(false);
                          }
                        }}
                        onBlur={() => finirLaSaisie(true)}
                        className="w-[4.6ch] border-0 bg-transparent text-right text-[17px] tabular-nums outline-none"
                        style={{ fontWeight: 650, color: colors.ink, caretColor: colors.or }}
                      />
                      <span className="text-[17px]" style={{ fontWeight: 650, color: colors.inkSoft }}>
                        €
                      </span>
                    </span>
                  ) : (
                    // Le montant se touche pour s'écrire : souligné d'or, comme
                    // ce qui s'appuie dans l'appli, et 44 px pour le doigt.
                    <button
                      type="button"
                      data-atlas="montant-main-oeuvre"
                      aria-label={`Écrire le montant de ${t.libelle}`}
                      disabled={dedans.length < 2}
                      onClick={() => setSaisie({ cle: t.cle, texte: String(Math.round(montants[k])) })}
                      className="inline-flex min-h-11 flex-none cursor-text items-center px-0.5 text-[17px] tabular-nums"
                      style={{
                        fontWeight: 650,
                        color: colors.ink,
                        textDecoration: dedans.length < 2 ? "none" : `underline dotted ${colors.or}`,
                        textDecorationThickness: 2,
                        textUnderlineOffset: 6,
                      }}
                    >
                      {montants[k] > 0 ? euros(montants[k]) : "À chiffrer"}
                    </button>
                  ))}
                <button
                  type="button"
                  aria-label={`Retirer ${t.libelle} de la main d'œuvre`}
                  onClick={() => changer({ retires: [...choix.retires, t.cle] })}
                  className="-mr-2.5 grid h-10 w-10 flex-none place-items-center"
                  style={{ color: colors.muted }}
                >
                  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
                    <path d="M6 6l12 12M18 6L6 18" />
                  </svg>
                </button>
              </div>
            );
          })}
        </div>
        <div className="mt-0.5 flex items-baseline justify-between pb-2.5 pt-3" style={filet}>
          <span className="text-[13px]" style={{ color: colors.muted }}>
            Total main d&apos;œuvre
          </span>
          <span className="text-[22px] leading-none tabular-nums" style={{ color: colors.ink, fontFamily: font.display }}>
            {euros(question.total)}
          </span>
        </div>
      </div>
    </div>
  );
}
