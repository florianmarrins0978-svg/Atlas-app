"use client";

import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { colors, font, voile } from "@/lib/design-tokens";
import { COULEUR_CATEGORIE, NOM_CATEGORIE, ORDRE_CATEGORIES } from "@/lib/couleurs-comptable";
import { jourComplet, jourEnMots, type Categorie, type Decoupage } from "@/lib/pour-mon-comptable";
import { checkUpAction } from "./actions";
import ArretDuDossier from "./ArretDuDossier";
import CarteARegarder from "./CarteARegarder";
import type { ARegarder, Facture } from "./a-regarder";
import Icone from "./Icone";

/**
 * L'ÉCRAN DU DOSSIER EN COURS — la planche choisie le 25 octobre 2026
 * (`appli/soignee/termines-comptable.html`), rangée dans l'ordre du geste :
 * ce qui attend, puis les mois, puis le dossier à ranger.
 *
 * En tête, le point : combien de lignes attendent, sur une plage rouge, ou
 * « Tout est justifié » en vert, et la banque dessous. Check up est le seul
 * bouton plein, collé en bas ; sans banque et sans rien à vérifier, il
 * disparaît, et « Relier ma banque » devient le bouton plein.
 */

export type Periode = {
  cle: string;
  nom: string;
  etat: string;
  manque: boolean;
  /** « 1 ticket perdu », dit à part sous la barre. */
  perdus: string | null;
  sorties: string;
  entrees: string;
  parCategorie: Partial<Record<Categorie, number>>;
  totalSorties: number;
};

const DECOUPAGES: { cle: Decoupage; nom: string }[] = [
  { cle: "mois", nom: "Mois" },
  { cle: "trimestre", nom: "Trimestre" },
  { cle: "annee", nom: "Année" },
];

const rubrique = "mx-6 mt-7 text-[13px] font-semibold uppercase tracking-[0.14em]";

export default function DossierEnCours({
  dossier,
  banque,
  perdus,
  periodes,
  aRegarder,
  factures,
}: {
  dossier: { du: string; premier: boolean; aujourdhui: string };
  banque: { nom: string; lue: string | null } | null;
  /** Les tickets perdus depuis le début du dossier : « 3 tickets perdus ». */
  perdus: string | null;
  periodes: Record<Decoupage, Periode[]>;
  aRegarder: ARegarder[];
  factures: Facture[];
}) {
  const router = useRouter();
  const [enCours, demarrer] = useTransition();
  const [decoupage, setDecoupage] = useState<Decoupage>("mois");
  const [bilan, setBilan] = useState<string | null>(null);
  const [refus, setRefus] = useState<string | null>(null);
  const [passe, setPasse] = useState<string | null>(null);
  const [arretOuvert, setArretOuvert] = useState(false);

  // Ce qui vient de se faire, le temps de le lire : la carte, elle, s'en va.
  useEffect(() => {
    if (!passe) return;
    const t = setTimeout(() => setPasse(null), 2600);
    return () => clearTimeout(t);
  }, [passe]);

  function checkUp() {
    setRefus(null);
    demarrer(async () => {
      const r = await checkUpAction();
      if (!r.ok) {
        setRefus(r.raison);
        return;
      }
      setBilan(
        r.vues === 0
          ? "Rien à vérifier."
          : `${r.vues} ${r.vues > 1 ? "lignes vues" : "ligne vue"}, ${r.relies} ${r.relies > 1 ? "reliées" : "reliée"}. ${
              r.restent > 0 ? `${r.restent} ${r.restent > 1 ? "attendent" : "attend"} votre réponse.` : "Tout est justifié."
            }`
      );
      router.refresh();
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
  }

  const n = aRegarder.length;
  const aDesLignes = periodes.mois.length > 0;
  // Sans banque et sans ligne, le Check up n'aurait rien à vérifier.
  const avecCheckUp = (banque !== null || aDesLignes) && !arretOuvert;

  return (
    <div className={avecCheckUp ? "pb-28" : ""}>
      <p className="mx-6 mt-2 text-[15px] leading-[1.45]" style={{ color: colors.inkSoft }}>
        Dossier en cours depuis le {jourComplet(dossier.du)}
      </p>

      {banque || aDesLignes ? (
        <section
          className="mx-6 mt-5 rounded-[18px] px-[18px] pb-1.5 pt-4"
          style={{ backgroundColor: n > 0 ? colors.carteRougeFond : colors.carteVertFond }}
          data-atlas="le-point"
          data-ton={n > 0 ? "rouge" : "vert"}
        >
          <p className="flex items-center gap-2.5 text-[23px] leading-[1.2]" style={{ fontFamily: font.display, color: n > 0 ? colors.carteRougeTexte : colors.carteVertTexte }}>
            <Icone nom={n > 0 ? "alerte" : "coche"} taille={24} epaisseur={2} />
            {n > 0 ? `${n} ${n > 1 ? "lignes à justifier" : "ligne à justifier"}` : "Tout est justifié"}
          </p>
          {(bilan || (n === 0 && perdus)) && (
            <p className="mt-1.5 text-[15px] leading-[1.45]" style={{ color: colors.ink }} data-atlas="bilan-check-up">
              {bilan ?? `${perdus} depuis le ${jourEnMots(dossier.du)}.`}
            </p>
          )}
          {refus && (
            <p role="alert" className="mt-2 text-[14px] font-medium" style={{ color: colors.carteRougeTexte }}>
              {refus}
            </p>
          )}
          {/* Sans banque, les lignes déjà lues restent : le point les compte, et
              la banque se relie d'ici. */}
          <div className="mt-3.5 flex items-center gap-2.5 text-[14.5px]" style={{ boxShadow: `inset 0 1px 0 ${colors.line}`, color: colors.ink }} data-atlas="source-du-releve">
            <span className="inline-block h-[9px] w-[9px] flex-none rounded-full" style={{ backgroundColor: banque ? colors.plein : colors.muted }} />
            <span className="min-w-0 flex-1 py-2.5">{!banque ? "Aucune banque reliée" : banque.lue ? `${banque.nom}, lue le ${banque.lue}` : `${banque.nom} reliée`}</span>
            <Link href="/reglages/banque" className="flex min-h-[44px] items-center whitespace-nowrap px-1 text-[15px] font-medium" style={{ color: colors.ink }}>
              {banque ? "Ma banque" : "Relier ma banque"}
            </Link>
          </div>
        </section>
      ) : (
        <section className="mx-6 mt-5 rounded-[18px] px-[18px] pb-[22px] pt-7 text-center" style={{ backgroundColor: colors.card }} data-atlas="sans-banque">
          <span className="inline-flex" style={{ color: colors.or }}>
            <Icone nom="banque" taille={40} epaisseur={1.4} />
          </span>
          <p className="mt-3 text-[20px]" style={{ fontFamily: font.display }}>
            Aucune banque reliée
          </p>
          <p className="mt-1.5 text-[15px]" style={{ color: colors.inkSoft }}>
            Aucune ligne de banque pour l’instant.
          </p>
          <Link href="/reglages/banque" className="atlas-plein mt-5 flex min-h-[54px] items-center justify-center rounded-full px-5 text-[16px] font-medium" style={{ backgroundColor: colors.plein, color: colors.card }} data-atlas="relier-ma-banque">
            Relier ma banque
          </Link>
        </section>
      )}

      {n > 0 && (
        <>
          <h2 className={rubrique} style={{ color: colors.inkSoft, fontFamily: font.body }}>
            À justifier
          </h2>
          <div className="mx-6 mt-3 flex flex-col gap-2.5" data-atlas="a-regarder">
            {aRegarder.map((a) => (
              <CarteARegarder key={a.id} a={a} factures={factures} onFait={setPasse} />
            ))}
          </div>
        </>
      )}

      {aDesLignes && (
        <>
          <h2 className={rubrique} style={{ color: colors.inkSoft, fontFamily: font.body }}>
            Mes relevés
          </h2>
          <div className="mx-6 mt-3 flex rounded-full p-[3px]" style={{ backgroundColor: colors.rustTint }} role="group" aria-label="Découpage">
            {DECOUPAGES.map((d) => (
              <button
                key={d.cle}
                type="button"
                aria-pressed={decoupage === d.cle}
                onClick={() => setDecoupage(d.cle)}
                className="min-h-[44px] flex-1 rounded-full text-[15px] font-medium"
                style={decoupage === d.cle ? { backgroundColor: colors.card, color: colors.ink, boxShadow: `0 0 0 1px ${colors.line}` } : { color: colors.inkSoft }}
              >
                {d.nom}
              </button>
            ))}
          </div>

          <div className="mx-6 mt-3.5 flex flex-wrap gap-x-3.5 gap-y-1.5 text-[14px]" style={{ color: colors.inkSoft }}>
            {ORDRE_CATEGORIES.map((c) => (
              <span key={c} className="inline-flex items-center gap-[7px]">
                <i className="inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: COULEUR_CATEGORIE[c] }} />
                {c === "virement" ? "Virement" : NOM_CATEGORIE[c]}
              </span>
            ))}
          </div>

          <ul className="mx-6 mt-1" data-atlas="periodes">
            {periodes[decoupage].map((p, i) => (
              <li key={p.cle} style={i > 0 ? { boxShadow: `inset 0 1px 0 ${colors.line}` } : undefined}>
                <Link href={`/termines/comptable/${p.cle}`} className="block pb-3 pt-3.5" data-atlas="periode">
                  <span className="flex items-center gap-2.5">
                    <span className="min-w-0 flex-1 text-[19px] leading-[1.25]" style={{ fontFamily: font.display }}>
                      {p.nom}
                    </span>
                    <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-[14px] font-semibold" style={{ color: p.manque ? colors.alert : colors.carteVertTexte }} data-atlas="etat-de-la-periode">
                      <i className="inline-block h-[7px] w-[7px] rounded-full" style={{ backgroundColor: "currentColor" }} />
                      {p.etat}
                    </span>
                    <span style={{ color: colors.chevron }}>
                      <Icone nom="suivant" taille={18} epaisseur={2} />
                    </span>
                  </span>
                  <span className="mt-2.5 flex h-2.5 gap-0.5" aria-hidden="true">
                    {ORDRE_CATEGORIES.map((c) =>
                      p.parCategorie[c] && p.totalSorties > 0 ? (
                        <i key={c} className="block h-full rounded-full" style={{ flex: `${(p.parCategorie[c] ?? 0) / p.totalSorties} 1 0`, minWidth: 4, backgroundColor: COULEUR_CATEGORIE[c] }} />
                      ) : null
                    )}
                    {p.totalSorties === 0 && <i className="block h-full flex-1 rounded-full" style={{ backgroundColor: colors.lineSoft }} />}
                  </span>
                  <span className="mt-2 flex items-baseline gap-3.5 text-[15px] tabular-nums">
                    <span style={{ color: colors.montantSortie }}>−{p.sorties}</span>
                    <span style={{ color: colors.montantEntree }}>+{p.entrees}</span>
                    {p.perdus && (
                      <span className="ml-auto text-[14px]" style={{ color: colors.inkSoft }}>
                        {p.perdus}
                      </span>
                    )}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}

      <h2 className={rubrique} style={{ color: colors.inkSoft, fontFamily: font.body }}>
        Le dossier
      </h2>
      <ArretDuDossier du={dossier.du} premier={dossier.premier} aujourdhui={dossier.aujourdhui} aJustifier={n} ouvert={arretOuvert} onOuvert={setArretOuvert} onPasse={setPasse} />
      <Link href="/termines/comptable/dossiers" className="mx-6 mt-2.5 flex min-h-[64px] items-center gap-3.5 py-2" data-atlas="mes-dossiers">
        <span className="inline-flex h-11 w-11 flex-none items-center justify-center rounded-full" style={{ boxShadow: `inset 0 0 0 1px ${colors.line}`, color: colors.or }}>
          <Icone nom="document" taille={21} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[18px] leading-[1.25]" style={{ fontFamily: font.display }}>
            Mes dossiers justifiés
          </span>
          <span className="mt-0.5 block text-[14px]" style={{ color: colors.inkSoft }}>
            Gardés dix ans
          </span>
        </span>
        <span style={{ color: colors.chevron }}>
          <Icone nom="suivant" taille={20} epaisseur={2} />
        </span>
      </Link>

      {passe && (
        <p role="status" className="atlas-colonne-fixe z-30 mx-6 rounded-[14px] px-4 py-3 text-center text-[15px]" style={{ bottom: `calc(var(--atlas-barre) + ${avecCheckUp ? 88 : 16}px)`, backgroundColor: colors.ink, color: colors.cream }} data-atlas="passe">
          {passe}
        </p>
      )}

      {avecCheckUp && (
        <div className="atlas-colonne-fixe z-20 px-6 pb-3 pt-6" style={{ bottom: "var(--atlas-barre)", background: `linear-gradient(to bottom, ${voile(colors.cream, 0)}, ${colors.cream} 45%)` }}>
          <button
            type="button"
            data-atlas="check-up"
            disabled={enCours}
            onClick={checkUp}
            className="atlas-plein flex min-h-[56px] w-full items-center justify-center gap-2.5 rounded-full px-5 text-[17px] font-medium disabled:opacity-60"
            style={{ backgroundColor: colors.plein, color: colors.card }}
          >
            <Icone nom="scanner" taille={22} />
            {enCours ? "Vérification…" : "Check up"}
          </button>
        </div>
      )}
    </div>
  );
}
