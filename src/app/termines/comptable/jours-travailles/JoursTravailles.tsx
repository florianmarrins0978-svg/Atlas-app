"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { colors, font, voile } from "@/lib/design-tokens";
import BottomSheet from "@/components/atlas/BottomSheet";
import Icone from "@/components/atlas/IconeTrait";
import { transmettreLePdf } from "@/components/atlas/transmettre-le-pdf";
import {
  LIBELLE_MOTIF_CORRECTION,
  MOTIFS_EN_MOINS,
  MOTIFS_EN_PLUS,
  JOURS_MAX_DU_MOIS,
  enJours,
  joursSaisisLus,
  nombreDeJours,
  type MotifCorrection,
} from "@/lib/jours-travailles";
import {
  TEINTES_ZONES,
  couleurDeLaCase,
  manqueAuxZones,
  nomDeLaTeinte,
  phraseDuManque,
  type TeinteZones,
  type Zone,
} from "@/lib/zones-deplacement";
import { choisirLaTeinteAction, corrigerLesJoursAction, corrigerLesZonesAction } from "./actions";
import type { JourDeZone, SalarieVu } from "./vue";

/**
 * L'écran Jours travaillés : sa planche A, et ses zones d'office quand Équipe
 * les a réglées.
 *
 * **Une feuille par salarié, qui porte les deux** : le chiffre du mois (moins,
 * plus, tapé ; « Pourquoi ? » dès qu'il bouge), et, dessous, ses jours par zone.
 * Les deux planches dessinaient chacune la sienne ; réunies, il n'a qu'un
 * endroit où corriger un salarié.
 */

type Case = { cle: string; nom: string; court: string; sous: string; k: number };

type Props = {
  mois: string;
  nomDuMois: string;
  court: string;
  precedent: string;
  suivant: string | null;
  resume: string;
  peutCorriger: boolean;
  peutRegler: boolean;
  sombre: boolean;
  jamaisRegle: boolean;
  zones: null | { resume: string; zones: Zone[]; teinte: TeinteZones; departSitue: boolean };
  salaries: SalarieVu[];
};

const rubrique = "text-[13px] font-semibold uppercase tracking-[0.14em]";
// Posées à la main : `globals.css` met la serif des titres, en 400, sur les
// `h2` et `h3`, et un intertitre de feuille est un libellé.
const rubriqueStyle = { color: colors.inkSoft, fontFamily: font.body, fontWeight: 600 } as const;

function lesCases(zones: Zone[]): Case[] {
  const c: Case[] = zones.map((z, i) => ({
    cle: `z${i}`,
    nom: z.nom,
    court: z.nom,
    sous: `de ${nombreDeJours(i === 0 ? 0 : zones[i - 1].km)} à ${nombreDeJours(z.km)} km`,
    k: i,
  }));
  const fin = zones.length ? zones[zones.length - 1].km : 0;
  c.push({ cle: "hors", nom: "Hors zone", court: `+${nombreDeJours(fin)} km`, sous: `plus de ${nombreDeJours(fin)} km`, k: zones.length });
  return c;
}

function valeur(s: SalarieVu): number {
  return s.saisi ?? s.calcul;
}

function compte(s: SalarieVu, cle: string): number {
  if (!s.zones) return 0;
  return s.zones.corrigees[cle] ?? s.zones.calcul[cle] ?? 0;
}

function corrigee(s: SalarieVu, cle: string): boolean {
  return !!s.zones && cle in s.zones.corrigees;
}

/** Ce qui se lit sous le nom : la correction et son motif, ou les absences. */
function situation(s: SalarieVu): { texte: string; ambre?: boolean } {
  const e = valeur(s) - s.calcul;
  if (e !== 0) {
    if (!s.motif) return { texte: "Corrigé, pourquoi ?", ambre: true };
    return { texte: `${LIBELLE_MOTIF_CORRECTION[s.motif]}, ${enJours(Math.abs(e))}${e > 0 ? " de plus" : ""}` };
  }
  const dits = [...s.absences.map((a) => a.texte), ...s.feries];
  if (dits.length) return { texte: dits.join(", et ") };
  return { texte: "Aucune absence notée" };
}

export default function JoursTravailles(p: Props) {
  const router = useRouter();
  const [, demarrer] = useTransition();
  const [salaries, setSalaries] = useState(p.salaries);
  const [teinte, setTeinte] = useState<TeinteZones>(p.zones?.teinte ?? "turquoise");
  const [ouvert, setOuvert] = useState<number | null>(null);
  const [zoneOuverte, setZoneOuverte] = useState<{ rang: number; cle: string } | null>(null);
  const [palette, setPalette] = useState<string | null>(null);
  const [refus, setRefus] = useState<string | null>(null);
  const [envoi, setEnvoi] = useState(false);

  // Le serveur a relu : ce qu'il rend fait foi. Repris pendant le rendu, comme
  // React le recommande pour un état qui suit ses propriétés.
  const [lus, setLus] = useState(p.salaries);
  if (lus !== p.salaries) {
    setLus(p.salaries);
    setSalaries(p.salaries);
  }
  const teinteLue = p.zones?.teinte ?? "turquoise";
  const [teinteVue, setTeinteVue] = useState(teinteLue);
  if (teinteVue !== teinteLue) {
    setTeinteVue(teinteLue);
    setTeinte(teinteLue);
  }

  const cases = p.zones ? lesCases(p.zones.zones) : [];
  const n = cases.length;
  const couleur = (k: number) => {
    const c = couleurDeLaCase(k, n, teinte);
    return p.sombre
      ? { fond: c.sombre, encre: c.encreSombre ? colors.ink : colors.card }
      : { fond: c.clair, encre: c.encreClaire ? colors.card : colors.ink };
  };
  // « Hors zone » ne paraît que si quelqu'un en a : sinon la colonne ne dit rien.
  const colonnes = cases.filter((c) => c.cle !== "hors" || salaries.some((s) => compte(s, "hors") > 0));
  const parLigne = colonnes.length <= 6 ? colonnes.length : Math.ceil(colonnes.length / 2);

  const manque = (s: SalarieVu) => (p.zones ? manqueAuxZones(valeur(s), cases.map((c) => compte(s, c.cle))) : 0);

  function poser(rang: number, f: (s: SalarieVu) => SalarieVu) {
    setSalaries((avant) => avant.map((s) => (s.rang === rang ? f(s) : s)));
  }

  function enregistrer(geste: () => Promise<{ ok: true } | { ok: false; raison: string }>) {
    setRefus(null);
    demarrer(async () => {
      const r = await geste();
      if (!r.ok) setRefus(r.raison);
      router.refresh();
    });
  }

  // Un chiffre TAPÉ ne s'enregistre qu'une fois la frappe posée : « 15 » passe
  // par « 1 », et ce « 1 » ne doit jamais partir chez le comptable.
  const plusTard = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => {
    if (plusTard.current) clearTimeout(plusTard.current);
  }, []);

  function changerLesJours(s: SalarieVu, v: number, tape = false) {
    const borne = Math.max(0, Math.min(JOURS_MAX_DU_MOIS, Math.round(v * 2) / 2));
    const saisi = borne === s.calcul ? null : borne;
    const avant = valeur(s) - s.calcul;
    const apres = (saisi ?? s.calcul) - s.calcul;
    // Le motif ne survit pas à un changement de sens : un congé ne dit rien
    // d'un samedi travaillé.
    const motif = apres === 0 || avant < 0 !== apres < 0 ? null : s.motif;
    poser(s.rang, (x) => ({ ...x, saisi, motif }));
    if (plusTard.current) clearTimeout(plusTard.current);
    const geste = () => enregistrer(() => corrigerLesJoursAction(s.rang, p.mois, saisi, motif));
    if (tape) plusTard.current = setTimeout(geste, 900);
    else geste();
  }

  function choisirLeMotif(s: SalarieVu, m: MotifCorrection) {
    const motif = s.motif === m ? null : m;
    poser(s.rang, (x) => ({ ...x, motif }));
    enregistrer(() => corrigerLesJoursAction(s.rang, p.mois, s.saisi, motif));
  }

  function changerUneZone(s: SalarieVu, cle: string, pas: number) {
    if (!s.zones) return;
    const v = Math.max(0, compte(s, cle) + pas);
    const corrigees = { ...s.zones.corrigees };
    if (v === (s.zones.calcul[cle] ?? 0)) delete corrigees[cle];
    else corrigees[cle] = v;
    poser(s.rang, (x) => (x.zones ? { ...x, zones: { ...x.zones, corrigees } } : x));
    enregistrer(() => corrigerLesZonesAction(s.rang, p.mois, corrigees));
  }

  function remettreLesZones(s: SalarieVu) {
    poser(s.rang, (x) => (x.zones ? { ...x, zones: { ...x.zones, corrigees: {} } } : x));
    enregistrer(() => corrigerLesZonesAction(s.rang, p.mois, {}));
  }

  function choisirLaTeinte(t: TeinteZones) {
    setTeinte(t);
    setPalette(null);
    enregistrer(() => choisirLaTeinteAction(t));
  }

  async function envoyer() {
    setEnvoi(true);
    setRefus(null);
    try {
      await transmettreLePdf(`/termines/comptable/jours-travailles/pdf?mois=${p.mois}`, `Jours travaillés, ${p.nomDuMois}.pdf`);
    } catch {
      setRefus("Le PDF n’a pas pu se préparer. Réessayez.");
    } finally {
      setEnvoi(false);
    }
  }

  function fermer() {
    setOuvert(null);
    setPalette(null);
  }

  const s = salaries.find((x) => x.rang === ouvert) ?? null;
  const jz = zoneOuverte ? salaries.find((x) => x.rang === zoneOuverte.rang) ?? null : null;

  return (
    <div className="px-6">
      <div className="mt-2 flex items-center justify-between gap-2 rounded-[22px] p-1.5" style={{ backgroundColor: colors.card }}>
        <Link
          href={`?mois=${p.precedent}`}
          aria-label="Le mois d’avant"
          className="grid h-14 w-14 flex-none place-items-center rounded-full"
          style={{ color: colors.or }}
          data-atlas="mois-avant"
        >
          <Icone nom="retour" taille={26} epaisseur={2} />
        </Link>
        <span className="text-center text-[26px] leading-[1.1]" style={{ fontFamily: font.display }} data-atlas="mois">
          {p.nomDuMois}
        </span>
        {p.suivant ? (
          <Link
            href={`?mois=${p.suivant}`}
            aria-label="Le mois d’après"
            className="grid h-14 w-14 flex-none place-items-center rounded-full"
            style={{ color: colors.or }}
            data-atlas="mois-apres"
          >
            <Icone nom="suivant" taille={26} epaisseur={2} />
          </Link>
        ) : (
          <span aria-hidden="true" className="grid h-14 w-14 flex-none place-items-center" style={{ color: voile(colors.or, 0.28) }}>
            <Icone nom="suivant" taille={26} epaisseur={2} />
          </span>
        )}
      </div>
      <p className="mx-1 mt-3 text-center text-[15px] leading-[1.45]" style={{ color: colors.inkSoft }}>
        {p.resume}
      </p>

      {p.zones && (
        <div className="mx-0.5 mt-4 flex items-center justify-between gap-3 text-[15px] font-semibold" style={{ color: colors.inkSoft }}>
          <span>{p.zones.resume}</span>
          {p.peutRegler && (
            <Link href="/reglages/equipe/zones?depuis=jours" className="flex min-h-[44px] items-center text-[15px] font-bold" style={{ color: colors.orTexte }}>
              Modifier
            </Link>
          )}
        </div>
      )}

      {salaries.length === 0 ? (
        <p className="mt-6 text-[15.5px]" style={{ color: colors.inkSoft }}>
          Aucun salarié réglé. <Link href="/reglages/equipe" style={{ color: colors.orTexte, fontWeight: 700 }}>Régler</Link>
        </p>
      ) : (
        <div className="mt-[18px] rounded-[22px] px-[18px]" style={{ backgroundColor: colors.card }} data-atlas="salaries">
          {salaries.map((x, i) => {
            const sit = situation(x);
            const m = manque(x);
            const v = valeur(x);
            return (
              <div key={x.rang} className="relative flex flex-col gap-2.5 py-4" data-atlas={`salarie-${x.rang}`}>
                {i > 0 && <span aria-hidden="true" className="absolute left-[58px] right-0 top-0 h-px" style={{ backgroundColor: colors.line }} />}
                <button type="button" onClick={() => setOuvert(x.rang)} className="flex w-full items-center gap-3.5 text-left">
                  <span
                    aria-hidden="true"
                    className="grid h-11 w-11 flex-none place-items-center rounded-full text-[18px]"
                    style={{ fontFamily: font.display, backgroundColor: colors.rustTint, color: colors.rust }}
                  >
                    {x.nom.charAt(0)}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[19px] leading-[1.25]" style={{ fontFamily: font.display }}>
                      {x.nom}
                    </span>
                    <span
                      className="mt-[3px] block text-[14px] leading-[1.4]"
                      style={{ color: sit.ambre ? colors.carteAmbreTexte : colors.inkSoft, fontWeight: sit.ambre ? 600 : 400 }}
                    >
                      {sit.texte}
                    </span>
                  </span>
                  <span className="min-w-[56px] flex-none text-right" style={{ color: m !== 0 ? colors.carteRougeTexte : colors.ink }} data-atlas="compte">
                    <b className="block text-[30px] font-normal leading-none tabular-nums" style={{ fontFamily: font.display }}>
                      {nombreDeJours(v)}
                    </b>
                    <small className="mt-1 block text-[13px]" style={{ color: m !== 0 ? colors.carteRougeTexte : colors.inkSoft }}>
                      {Math.abs(v) < 2 ? "jour" : "jours"}
                    </small>
                  </span>
                </button>

                {p.zones && (
                  <>
                    <span aria-hidden="true" className="flex h-2 gap-0.5">
                      {colonnes.map((c) => {
                        const nb = compte(x, c.cle);
                        return nb ? <i key={c.cle} className="block min-w-1 rounded-[2px]" style={{ flex: `${nb} 1 0`, backgroundColor: couleur(c.k).fond }} /> : null;
                      })}
                    </span>
                    <span className="grid items-end gap-[5px]" style={{ gridTemplateColumns: `repeat(${parLigne}, minmax(0, 1fr))` }}>
                      {colonnes.map((c) => {
                        const nb = compte(x, c.cle);
                        const coul = couleur(c.k);
                        return (
                          <button
                            key={c.cle}
                            type="button"
                            disabled={nb === 0}
                            onClick={() => setZoneOuverte({ rang: x.rang, cle: c.cle })}
                            aria-label={`${x.nom}, ${c.nom}, ${enJours(nb)}`}
                            className="block min-w-0 text-center"
                            data-atlas={`case-${c.cle}`}
                          >
                            <small className="mb-[3px] block min-h-[14px] text-[11px] font-semibold leading-[1.2] [overflow-wrap:anywhere]" style={{ color: colors.inkSoft }}>
                              {c.court}
                            </small>
                            <b
                              className="block rounded-[9px] pb-1.5 pt-[7px] text-[19px] font-semibold leading-none tabular-nums"
                              style={{
                                fontFamily: font.display,
                                backgroundColor: nb === 0 ? "transparent" : coul.fond,
                                color: nb === 0 ? colors.muted : coul.encre,
                                fontWeight: nb === 0 ? 400 : 600,
                                boxShadow:
                                  nb === 0 ? `inset 0 0 0 1.5px ${colors.line}` : corrigee(x, c.cle) ? `inset 0 -3px 0 ${colors.or}` : undefined,
                              }}
                            >
                              {nb}
                            </b>
                          </button>
                        );
                      })}
                    </span>
                    {m !== 0 && (
                      <span className="-mt-0.5 block text-[14.5px] font-bold" style={{ color: colors.carteRougeTexte }} data-atlas="manque">
                        {phraseDuManque(m)}
                      </span>
                    )}
                  </>
                )}
              </div>
            );
          })}
        </div>
      )}

      {!p.zones && p.jamaisRegle && p.peutRegler && salaries.length > 0 && (
        <div
          className="mt-3.5 flex min-h-[60px] w-full items-center gap-3 rounded-[22px] pl-4 pr-1.5 text-[15.5px]"
          style={{ backgroundColor: colors.card, color: colors.ink }}
          data-atlas="invitation-zones"
        >
          <span style={{ color: colors.or }}>
            <Icone nom="lieu" taille={20} />
          </span>
          <span className="min-w-0 flex-1">Vos salariés ont des zones de déplacement ?</span>
          <Link href="/reglages/equipe/zones?depuis=jours" className="flex min-h-[48px] flex-none items-center rounded-full px-3 font-bold" style={{ color: colors.orTexte }}>
            Régler
          </Link>
        </div>
      )}

      {p.zones && !p.zones.departSitue && (
        <p className="mt-3 text-[14.5px] font-semibold" style={{ color: colors.carteRougeTexte }}>
          L’adresse de l’entreprise n’a pas pu être située : aucun chantier n’a de zone.
        </p>
      )}

      {refus && (
        <p role="alert" className="mt-4 text-[15px] font-semibold" style={{ color: colors.carteRougeTexte }}>
          {refus}
        </p>
      )}

      {salaries.length > 0 && (
        <button
          type="button"
          onClick={envoyer}
          disabled={envoi}
          className="atlas-plein mt-[22px] flex min-h-[56px] w-full items-center justify-center gap-2.5 rounded-full px-5 text-[17px] font-medium disabled:opacity-60"
          style={{ backgroundColor: colors.plein, color: colors.card }}
          data-atlas="envoyer-jours"
        >
          <Icone nom="envoyer" taille={20} />
          Envoyer à mon comptable
        </button>
      )}

      <BottomSheet open={s !== null} onBackdropClick={fermer}>
        {s && (
          <FeuilleDuSalarie
            s={s}
            court={p.court}
            resume={p.resume}
            peutCorriger={p.peutCorriger}
            cases={cases}
            couleur={couleur}
            teinte={teinte}
            palette={palette}
            sombre={p.sombre}
            manque={manque(s)}
            onJours={(v, tape) => changerLesJours(s, v, tape)}
            onMotif={(m) => choisirLeMotif(s, m)}
            onZone={(cle, pas) => changerUneZone(s, cle, pas)}
            onRemettreZones={() => remettreLesZones(s)}
            onPalette={(cle) => setPalette(palette === cle ? null : cle)}
            onTeinte={choisirLaTeinte}
            onFermer={fermer}
          />
        )}
      </BottomSheet>

      <BottomSheet open={jz !== null && zoneOuverte !== null} onBackdropClick={() => setZoneOuverte(null)}>
        {jz && zoneOuverte && (
          <JoursDUneZone
            s={jz}
            c={cases.find((c) => c.cle === zoneOuverte.cle) ?? cases[0]}
            n={compte(jz, zoneOuverte.cle)}
            corrigee={corrigee(jz, zoneOuverte.cle)}
            jours={jz.zones?.jours[zoneOuverte.cle] ?? []}
            fond={couleur((cases.find((c) => c.cle === zoneOuverte.cle) ?? cases[0]).k).fond}
            onFermer={() => setZoneOuverte(null)}
          />
        )}
      </BottomSheet>
    </div>
  );
}

// ─── LA FEUILLE D'UN SALARIÉ ────────────────────────────────────────────────

function FeuilleDuSalarie(f: {
  s: SalarieVu;
  court: string;
  resume: string;
  peutCorriger: boolean;
  cases: Case[];
  couleur: (k: number) => { fond: string; encre: string };
  teinte: TeinteZones;
  palette: string | null;
  sombre: boolean;
  manque: number;
  onJours: (v: number, tape?: boolean) => void;
  onMotif: (m: MotifCorrection) => void;
  onZone: (cle: string, pas: number) => void;
  onRemettreZones: () => void;
  onPalette: (cle: string) => void;
  onTeinte: (t: TeinteZones) => void;
  onFermer: () => void;
}) {
  const { s } = f;
  const v = valeur(s);
  const ecart = v - s.calcul;
  const [tape, setTape] = useState(nombreDeJours(v));
  const enFrappe = useRef(false);
  // Le chiffre tapé garde son curseur : on ne le réécrit que hors de la frappe.
  useEffect(() => {
    if (!enFrappe.current) setTape(nombreDeJours(v));
  }, [v]);

  const motifs = ecart < 0 ? MOTIFS_EN_MOINS : MOTIFS_EN_PLUS;
  const lignes = f.cases.filter((c) => c.cle !== "hors" || compte(s, c.cle) > 0 || corrigee(s, c.cle));

  return (
    <div data-atlas="feuille-salarie">
      <h2 className="text-[26px] leading-[1.15]" style={{ fontFamily: font.display }}>
        {s.nom} en {f.court}
      </h2>
      <p className="mb-[22px] mt-1 text-[15px]" style={{ color: colors.inkSoft }}>
        {f.resume}
      </p>

      {f.peutCorriger ? (
        <div className="flex items-center justify-center gap-5">
          <button
            type="button"
            aria-label="Un jour de moins"
            onClick={() => f.onJours(v - 1)}
            className="grid h-14 w-14 place-items-center rounded-full"
            style={{ boxShadow: `inset 0 0 0 1.5px ${colors.line}`, color: colors.ink }}
          >
            <Icone nom="moins" taille={24} epaisseur={2} />
          </button>
          <input
            type="text"
            inputMode="decimal"
            autoComplete="off"
            aria-label={`Jours travaillés de ${s.nom}`}
            value={tape}
            onFocus={() => (enFrappe.current = true)}
            onChange={(e) => {
              setTape(e.target.value);
              const lu = joursSaisisLus(e.target.value);
              if (lu !== null && lu !== v) f.onJours(lu, true);
            }}
            onBlur={() => {
              enFrappe.current = false;
              setTape(nombreDeJours(v));
            }}
            className="w-[120px] rounded-none border-0 border-b-2 bg-transparent pb-2 pt-1 text-center text-[48px] leading-none tabular-nums outline-none"
            style={{ fontFamily: font.display, color: colors.ink, borderColor: colors.line }}
            data-atlas="jours-saisis"
          />
          <button
            type="button"
            aria-label="Un jour de plus"
            onClick={() => f.onJours(v + 1)}
            className="grid h-14 w-14 place-items-center rounded-full"
            style={{ boxShadow: `inset 0 0 0 1.5px ${colors.line}`, color: colors.ink }}
          >
            <Icone nom="plus" taille={24} epaisseur={2} />
          </button>
        </div>
      ) : (
        <p className="text-center text-[48px] leading-none tabular-nums" style={{ fontFamily: font.display }}>
          {nombreDeJours(v)}
        </p>
      )}
      <p className="mt-2 text-center text-[15px]" style={{ color: colors.inkSoft }}>
        jours travaillés
      </p>

      {ecart !== 0 && (
        <>
          <div
            className="mt-[22px] flex items-center justify-between gap-3 rounded-[12px] py-1 pl-4 pr-1.5 text-[15px]"
            style={{ backgroundColor: voile(colors.or, 0.13), color: colors.ink }}
          >
            <span>Le calcul disait {nombreDeJours(s.calcul)}.</span>
            {f.peutCorriger && (
              <button type="button" onClick={() => f.onJours(s.calcul)} className="min-h-[44px] px-2.5 font-bold" style={{ color: colors.orTexte }} data-atlas="remettre-jours">
                Remettre {nombreDeJours(s.calcul)}
              </button>
            )}
          </div>
          <h3 className="mb-3 mt-6 text-[20px] leading-[1.25]" style={{ fontFamily: font.display }}>
            Pourquoi {enJours(Math.abs(ecart))} de {ecart < 0 ? "moins" : "plus"} ?
          </h3>
          <div className="grid grid-cols-2 gap-2.5" role="group" aria-label="Pourquoi">
            {motifs.map((m) => (
              <button
                key={m}
                type="button"
                disabled={!f.peutCorriger}
                aria-pressed={s.motif === m}
                onClick={() => f.onMotif(m)}
                className="min-h-[54px] rounded-full px-3 text-[16px] font-semibold"
                style={{
                  backgroundColor: colors.card,
                  color: colors.ink,
                  boxShadow: s.motif === m ? `inset 0 0 0 2px ${colors.rust}` : `inset 0 0 0 1px ${colors.line}`,
                }}
                data-motif={m}
              >
                {LIBELLE_MOTIF_CORRECTION[m]}
              </button>
            ))}
          </div>
        </>
      )}

      {s.zones && (
        <>
          <h3 className={`mb-1 mt-[26px] ${rubrique}`} style={rubriqueStyle}>
            Par zone
          </h3>
          {f.manque !== 0 && (
            <div className="mb-3.5 mt-2 rounded-[14px] px-4 py-3 text-[15px]" style={{ backgroundColor: colors.carteRougeFond, color: colors.ink }} data-atlas="manque-zones">
              {s.nom} a travaillé {enJours(v)}. <b style={{ color: colors.carteRougeTexte }}>{phraseDuManque(f.manque)}</b>
              {f.manque > 0 &&
                s.zones.sansZone.slice(0, f.manque).map((d) => (
                  <span key={d} className="mt-1.5 block font-semibold">
                    {d}
                  </span>
                ))}
            </div>
          )}
          <div className="rounded-[22px] px-4" style={{ backgroundColor: colors.card }}>
            {lignes.map((c, i) => {
              const nb = compte(s, c.cle);
              const ouverte = f.palette === c.cle;
              return (
                <div key={c.cle} className="relative">
                  {i > 0 && <span aria-hidden="true" className="absolute inset-x-0 top-0 h-px" style={{ backgroundColor: colors.line }} />}
                  <div className="flex min-h-[64px] items-center gap-3">
                    <button
                      type="button"
                      aria-expanded={ouverte}
                      aria-label={`Couleur de ${c.nom}`}
                      onClick={() => f.onPalette(c.cle)}
                      disabled={!f.peutCorriger}
                      className="relative h-[22px] w-[22px] flex-none rounded-full after:absolute after:-inset-[11px] after:content-['']"
                      style={{
                        backgroundColor: f.couleur(c.k).fond,
                        boxShadow: `0 0 0 2px ${colors.card}, 0 0 0 ${ouverte ? 4 : 3.5}px ${ouverte ? colors.or : colors.line}`,
                      }}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block text-[18px] leading-[1.2]" style={{ fontFamily: font.display }}>
                        {c.nom}
                      </span>
                      <span className="mt-0.5 block text-[13.5px]" style={{ color: colors.inkSoft }}>
                        {c.sous}
                      </span>
                    </span>
                    {f.peutCorriger && (
                      <button
                        type="button"
                        disabled={nb === 0}
                        aria-label={`Un jour de moins en ${c.nom}`}
                        onClick={() => f.onZone(c.cle, -1)}
                        className="grid h-11 w-11 flex-none place-items-center rounded-full"
                        style={{ boxShadow: `inset 0 0 0 1.5px ${colors.line}`, color: nb === 0 ? colors.chevron : colors.ink }}
                      >
                        <Icone nom="moins" taille={20} epaisseur={2} />
                      </button>
                    )}
                    <span
                      className="w-[34px] flex-none text-center text-[24px] leading-none tabular-nums"
                      style={{ fontFamily: font.display, color: corrigee(s, c.cle) ? colors.orTexte : colors.ink }}
                      data-atlas={`zone-${c.cle}`}
                    >
                      {nb}
                    </span>
                    {f.peutCorriger && (
                      <button
                        type="button"
                        aria-label={`Un jour de plus en ${c.nom}`}
                        onClick={() => f.onZone(c.cle, 1)}
                        className="grid h-11 w-11 flex-none place-items-center rounded-full"
                        style={{ boxShadow: `inset 0 0 0 1.5px ${colors.line}`, color: colors.ink }}
                        data-atlas={`plus-${c.cle}`}
                      >
                        <Icone nom="plus" taille={20} epaisseur={2} />
                      </button>
                    )}
                  </div>
                  {ouverte && <Palette cases={f.cases.length} teinte={f.teinte} sombre={f.sombre} onTeinte={f.onTeinte} />}
                </div>
              );
            })}
          </div>
          {Object.keys(s.zones.corrigees).length > 0 && f.peutCorriger && (
            <button type="button" onClick={f.onRemettreZones} className="mt-1 flex min-h-[48px] w-full items-center justify-center font-bold" style={{ color: colors.orTexte }}>
              Remettre le calcul
            </button>
          )}
        </>
      )}

      <h3 className={`mb-1 mt-[26px] ${rubrique}`} style={rubriqueStyle}>
        Absences notées
      </h3>
      {s.absences.length ? (
        s.absences.map((a, i) => (
          <div key={i} className="flex min-h-[50px] items-center justify-between gap-3 text-[15.5px]" style={{ boxShadow: `inset 0 -1px 0 ${colors.line}` }}>
            <span>{a.texte.charAt(0).toUpperCase() + a.texte.slice(1)}</span>
            <span className="flex-none tabular-nums" style={{ color: colors.inkSoft }}>
              {enJours(a.jours)}
            </span>
          </div>
        ))
      ) : (
        <p className="flex min-h-[50px] items-center text-[15.5px]" style={{ color: colors.inkSoft }}>
          Aucune en {f.court}
        </p>
      )}

      {/* Ce que le planning lui a fait travailler un férié : déjà compté, il
          se lit ici pour qu'on sache d'où vient le jour de plus. */}
      {s.feries.length > 0 && (
        <div className="mt-2" data-atlas="feries-travailles">
          {s.feries.map((t) => (
            <p key={t} className="flex min-h-[50px] items-center text-[15.5px]" style={{ boxShadow: `inset 0 -1px 0 ${colors.line}` }}>
              {t}
            </p>
          ))}
        </div>
      )}

      <button type="button" onClick={f.onFermer} className="mt-3.5 flex min-h-[48px] w-full items-center justify-center" style={{ color: colors.inkSoft }}>
        Fermer
      </button>
    </div>
  );
}

/** Les sept dégradés : un appui, et toutes les zones prennent celui-là. */
function Palette(p: { cases: number; teinte: TeinteZones; sombre: boolean; onTeinte: (t: TeinteZones) => void }) {
  return (
    <div className="pb-3.5 pt-0.5" data-atlas="palette-zones">
      <div className="grid grid-cols-4 gap-x-1.5 gap-y-2.5" role="group" aria-label="Couleur des zones">
        {TEINTES_ZONES.map((t) => {
          const pas = Array.from({ length: p.cases }, (_, k) => {
            const c = couleurDeLaCase(k, p.cases, t);
            return p.sombre ? c.sombre : c.clair;
          });
          const choisie = p.teinte === t;
          return (
            <button
              key={t}
              type="button"
              aria-pressed={choisie}
              onClick={() => p.onTeinte(t)}
              className="flex min-h-[60px] flex-col items-center gap-[5px] py-1 text-[12px] font-semibold"
              style={{ color: choisie ? colors.ink : colors.inkSoft }}
              data-teinte={t}
            >
              <i
                className="block h-[46px] w-[34px] rounded-[9px]"
                style={{
                  background: `linear-gradient(to bottom, ${pas.join(", ")})`,
                  boxShadow: choisie ? `0 0 0 2px ${colors.card}, 0 0 0 4px ${colors.or}` : `inset 0 0 0 1px ${colors.line}`,
                }}
              />
              {nomDeLaTeinte(t)}
            </button>
          );
        })}
      </div>
      <p className="mt-2 text-[13.5px]" style={{ color: colors.inkSoft }}>
        Toutes les zones, chez tous les salariés.
      </p>
    </div>
  );
}

// ─── LES JOURS D'UNE ZONE ───────────────────────────────────────────────────

function JoursDUneZone(z: { s: SalarieVu; c: Case; n: number; corrigee: boolean; jours: JourDeZone[]; fond: string; onFermer: () => void }) {
  const titre = z.c.cle === "hors" ? "hors zone" : z.c.nom.replace(/^Zone /, "zone ");
  return (
    <div data-atlas="jours-zone">
      <div className="flex items-center gap-3">
        <span aria-hidden="true" className="h-[18px] w-[18px] flex-none rounded-[5px]" style={{ backgroundColor: z.fond }} />
        <h2 className="text-[26px] leading-[1.15]" style={{ fontFamily: font.display }}>
          {z.s.nom}, {titre}
        </h2>
      </div>
      <p className="mb-4 mt-1 text-[15px]" style={{ color: colors.inkSoft }}>
        {z.c.sous.charAt(0).toUpperCase() + z.c.sous.slice(1)}, {enJours(z.n)}
      </p>
      {z.corrigee && (
        <p className="mb-3 rounded-[14px] px-4 py-3 text-[15px]" style={{ backgroundColor: voile(colors.or, 0.13), color: colors.ink }}>
          Corrigé à la main : <b>{enJours(z.n)}</b>, le planning en trouve {enJours(z.jours.length)}.
        </p>
      )}
      <div className="rounded-[22px] px-4" style={{ backgroundColor: colors.card }}>
        {z.jours.map((j, i) => {
          const d = new Date(`${j.jour}T12:00:00Z`);
          return (
            <div key={j.jour} className="relative flex min-h-[66px] items-center gap-3.5 py-2.5">
              {i > 0 && <span aria-hidden="true" className="absolute left-[62px] right-0 top-0 h-px" style={{ backgroundColor: colors.line }} />}
              <span className="w-12 flex-none text-center">
                <b className="block text-[22px] font-normal leading-none" style={{ fontFamily: font.display }}>
                  {d.getUTCDate()}
                </b>
                <span className="text-[12.5px]" style={{ color: colors.inkSoft }}>
                  {d.toLocaleDateString("fr-FR", { weekday: "long", timeZone: "UTC" })}
                </span>
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[18px] leading-[1.25]" style={{ fontFamily: font.display }}>
                  {j.ville}
                </span>
                {(j.rue || (j.chez && !j.depot)) && (
                  <span className="mt-0.5 block text-[14px] leading-[1.35]" style={{ color: colors.inkSoft }}>
                    {[j.rue, j.chez && !j.depot ? `chez ${j.chez.replace(/^(M\.|Mme) /, "$1 ")}` : null].filter(Boolean).join(", ")}
                  </span>
                )}
              </span>
              {j.km !== null && (
                <span className="flex-none text-[14.5px] font-semibold tabular-nums" style={{ color: colors.inkSoft }}>
                  {nombreDeJours(j.km)}&nbsp;km
                </span>
              )}
            </div>
          );
        })}
        {z.jours.length === 0 && (
          <p className="flex min-h-[60px] items-center text-[15px]" style={{ color: colors.inkSoft }}>
            Aucun jour trouvé au planning.
          </p>
        )}
      </div>
      <button type="button" onClick={z.onFermer} className="mt-3.5 flex min-h-[48px] w-full items-center justify-center" style={{ color: colors.inkSoft }}>
        Fermer
      </button>
    </div>
  );
}
