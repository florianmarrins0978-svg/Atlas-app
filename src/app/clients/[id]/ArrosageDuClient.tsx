"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type React from "react";
import { colors, font, surPlein, voile } from "@/lib/design-tokens";
import Goutte from "@/components/atlas/Goutte";
import BottomSheet from "@/components/atlas/BottomSheet";
import UndoToast from "@/components/atlas/UndoToast";
import PrimaryButton from "@/components/atlas/PrimaryButton";
import {
  ceQuiEstPose,
  jourChoisissable,
  moisDuPrevoir,
  phraseDuFait,
  phraseDuPrevu,
  type CeQueLaFicheDit,
} from "@/lib/hivernage";
import { grilleDuMois, jourLisibleCourt, MOIS_LONGS } from "@/lib/mois";
import type { QuandPoser } from "@/lib/planning-jour";
import {
  annulerHivernageFaitAction,
  cePlanningPorteAction,
  noterHivernageFaitAction,
  prevoirLHivernageAction,
  repondreSurLArrosageAction,
} from "./actions-hivernage";
import { supprimerChantierAction } from "@/app/planning/actions";

/**
 * L'ARROSAGE DU CLIENT, SUR SA FICHE — sa planche du 5 novembre 2026
 * (`appli/soignee/hiverner-l-arrosage.html`, « la B » le 6 novembre).
 *
 * **Juste sous ses coordonnées, au-dessus des trois gestes** : la place de la
 * planche. Ce qui s'y dit est décidé par `ceQueLaFicheDit` (`src/lib/`), et
 * cet écran ne fait que le montrer :
 *
 *   - les deux questions, l'une après l'autre (arrosage, puis hivernage) ;
 *   - « Arrosage à hiverner », avec « Le prévoir » (ou « Le voir » quand c'est
 *     posé) et « C'est fait » ;
 *   - « Hiverné le 3 novembre » une fois fait, jusqu'à la fin de la saison.
 *
 * **« Le prévoir » pose au planning** (sa demande du 6 novembre : *« choisir
 * une date et qu'elle se pose sur le planning »*) : le mois, le jour, puis le
 * matin, l'après-midi ou la journée, chaque moment disant ce qui y est déjà.
 * Rien ne se choisit d'office.
 */
export default function ArrosageDuClient({
  clientId,
  nomClient,
  dit,
  aujourdHui,
  peutPoser,
}: {
  clientId: string;
  nomClient: string;
  dit: NonNullable<CeQueLaFicheDit>;
  /** Le jour tel que le SERVEUR le compte, à l'heure de son atelier. */
  aujourdHui: string;
  /** Poser au planning, c'est écrire le planning : le patron et le commercial. */
  peutPoser: boolean;
}) {
  const router = useRouter();
  const [enCours, demarrer] = useTransition();
  const [refus, setRefus] = useState<string | null>(null);
  const [tiroir, setTiroir] = useState<{ message: string; annuler: () => Promise<unknown> } | null>(null);
  const [feuilleOuverte, setFeuilleOuverte] = useState(false);

  function repondre(question: "arrosage" | "hivernage", oui: boolean) {
    setRefus(null);
    demarrer(async () => {
      const r = await repondreSurLArrosageAction(clientId, question, oui);
      if (!r.ok) setRefus(r.raison);
      else router.refresh();
    });
  }

  function cestFait() {
    setRefus(null);
    demarrer(async () => {
      const r = await noterHivernageFaitAction(clientId);
      if (!r.ok) {
        setRefus(r.raison);
        return;
      }
      router.refresh();
      setTiroir({
        message: "Hiverné. La goutte part.",
        annuler: async () => {
          await annulerHivernageFaitAction(clientId, r.precedent);
          router.refresh();
        },
      });
    });
  }

  return (
    <>
      {(dit.genre === "question-arrosage" || dit.genre === "question-hivernage") && (
        <div
          className="mx-[22px] mt-3 rounded-[6px] px-4 pb-4 pt-[14px]"
          data-atlas={dit.genre === "question-arrosage" ? "question-arrosage" : "question-hivernage"}
          style={{ backgroundColor: colors.carteBleuFond }}
        >
          <p className="text-[16px] leading-[1.45]" style={{ color: colors.ink }}>
            <strong className="block font-bold" style={{ color: colors.carteBleuTexte }}>
              {dit.genre === "question-arrosage" ? dit.pourquoi : "Il a un arrosage automatique."}
            </strong>
            {dit.genre === "question-arrosage" ? "Ce client a un arrosage automatique ?" : "Vous faites son hivernage ?"}
          </p>
          <div className="mt-[14px] grid grid-cols-2 gap-2.5">
            <Bouton plein disabled={enCours} onClick={() => repondre(dit.genre === "question-arrosage" ? "arrosage" : "hivernage", true)} repere="repondre-oui">
              Oui
            </Bouton>
            <Bouton disabled={enCours} onClick={() => repondre(dit.genre === "question-arrosage" ? "arrosage" : "hivernage", false)} repere="repondre-non">
              Non
            </Bouton>
          </div>
        </div>
      )}

      {dit.genre === "a-hiverner" && (
        <div className="mx-[22px] mt-3 rounded-[6px] px-4 pb-4 pt-[14px]" data-atlas="arrosage-a-hiverner" style={{ backgroundColor: colors.card }}>
          <div className="flex items-center gap-3">
            <Goutte taille={36} />
            <span className="min-w-0">
              <span className="block text-[20px] leading-[1.2]" style={{ fontFamily: font.display, color: colors.ink }}>
                Arrosage à hiverner
              </span>
              {dit.prevu && (
                <span className="mt-[3px] block text-[14.5px] font-semibold" data-atlas="hivernage-prevu" style={{ color: colors.carteBleuTexte }}>
                  {phraseDuPrevu(dit.prevu)}
                </span>
              )}
            </span>
          </div>
          <div className={`mt-[14px] grid gap-2.5 ${dit.prevu || peutPoser ? "grid-cols-2" : "grid-cols-1"}`}>
            {dit.prevu ? (
              <Link
                href={`/planning?chantier=${dit.prevu.chantierId}`}
                data-atlas="voir-l-hivernage"
                className="flex min-h-[44px] items-center justify-center gap-2 rounded-[12px] px-3 text-[15px] font-bold"
                style={{ color: colors.ink, boxShadow: `inset 0 0 0 1.5px ${colors.line}` }}
              >
                <DessinCalendrier />
                Le voir
              </Link>
            ) : (
              peutPoser && (
                <Bouton disabled={enCours} onClick={() => setFeuilleOuverte(true)} repere="prevoir-l-hivernage">
                  <DessinCalendrier />
                  Le prévoir
                </Bouton>
              )
            )}
            <Bouton plein disabled={enCours} onClick={cestFait} repere="hivernage-fait">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M5 12.5l4.5 4.5L19 7.5" />
              </svg>
              C’est fait
            </Bouton>
          </div>
        </div>
      )}

      {dit.genre === "hiverne" && (
        <p className="mx-[22px] mt-3" data-atlas="hiverne-le">
          <span
            className="inline-flex min-h-[28px] items-center rounded-full px-3 text-[14px] font-bold"
            style={{ backgroundColor: colors.carteVertFond, color: colors.carteVertTexte }}
          >
            {phraseDuFait(dit.le)}
          </span>
        </p>
      )}

      {refus && !feuilleOuverte && (
        <p role="alert" className="mx-[22px] mt-2 text-[14px] font-semibold" style={{ color: colors.alert }}>
          {refus}
        </p>
      )}

      {feuilleOuverte && (
        <FeuilleDuPrevoir
          clientId={clientId}
          nomClient={nomClient}
          aujourdHui={aujourdHui}
          fermer={() => setFeuilleOuverte(false)}
          pose={(chantierId) => {
            setFeuilleOuverte(false);
            router.refresh();
            setTiroir({
              message: "Posé au planning.",
              annuler: async () => {
                await supprimerChantierAction(chantierId);
                router.refresh();
              },
            });
          }}
        />
      )}

      <UndoToast
        open={tiroir !== null}
        message={tiroir?.message ?? ""}
        onUndo={() => {
          const t = tiroir;
          setTiroir(null);
          if (t) demarrer(async () => void (await t.annuler()));
        }}
        onDismiss={() => setTiroir(null)}
      />
    </>
  );
}

const MOMENTS: { cle: QuandPoser; libelle: string }[] = [
  { cle: "matin", libelle: "Le matin" },
  { cle: "apres_midi", libelle: "L’après-midi" },
  { cle: "journee", libelle: "La journée" },
];

/**
 * LA FEUILLE DE « LE PRÉVOIR » : le mois, le jour, le moment, puis le planning.
 *
 * **Ce que le planning porte arrive après l'ouverture** (`cePlanningPorteAction`) :
 * tant qu'il n'est pas lu, la feuille ne dit ni « Libre » ni un nom. Elle ne
 * promet pas un matin libre qu'elle n'a pas regardé.
 */
function FeuilleDuPrevoir({
  clientId,
  nomClient,
  aujourdHui,
  fermer,
  pose,
}: {
  clientId: string;
  nomClient: string;
  aujourdHui: string;
  fermer: () => void;
  pose: (chantierId: string) => void;
}) {
  const mois = moisDuPrevoir(aujourdHui);
  const [rang, setRang] = useState(0);
  const [jour, setJour] = useState<string | null>(null);
  const [moment, setMoment] = useState<QuandPoser | null>(null);
  const [porte, setPorte] = useState<Record<string, string[]> | null>(null);
  const [illisible, setIllisible] = useState(false);
  const [refus, setRefus] = useState<string | null>(null);
  const [enCours, demarrer] = useTransition();

  // Une seule lecture par ouverture : la feuille se démonte en se fermant.
  // **Une lecture qui échoue se DIT**, et ne devient jamais « Libre »
  // partout : un matin qu'elle n'a pas pu regarder ne se promet pas libre.
  useEffect(() => {
    let ouverte = true;
    cePlanningPorteAction().then(
      (lue) => {
        if (ouverte) setPorte(lue);
      },
      () => {
        if (ouverte) setIllisible(true);
      }
    );
    return () => {
      ouverte = false;
    };
  }, []);

  const vu = mois[rang];
  if (!vu) return null;
  const cases = grilleDuMois(vu.annee, vu.mois);
  const occupe = (j: string) => Boolean(porte && (porte[`${j}:matin`]?.length || porte[`${j}:apres_midi`]?.length));

  function poser() {
    if (!jour || !moment) return;
    setRefus(null);
    demarrer(async () => {
      const r = await prevoirLHivernageAction(clientId, jour, moment);
      if (!r.ok) setRefus(r.raison);
      else pose(r.chantierId);
    });
  }

  return (
    <BottomSheet open onBackdropClick={fermer}>
      <div data-atlas="feuille-prevoir-hivernage">
        <h2 className="text-[26px] leading-[1.15]" style={{ fontFamily: font.display, color: colors.ink }}>
          Prévoir l’hivernage
        </h2>
        <p className="mb-[18px] mt-1 text-[15px]" style={{ color: colors.inkSoft }}>
          {nomClient}
        </p>

        <div className="mb-1.5 flex items-center justify-between">
          <BoutonMois sens="avant" disabled={rang === 0} onClick={() => setRang(rang - 1)} />
          <span className="text-[21px] leading-[1.2]" style={{ fontFamily: font.display, color: colors.ink }}>
            {MOIS_LONGS[vu.mois].charAt(0).toUpperCase() + MOIS_LONGS[vu.mois].slice(1)} {vu.annee}
          </span>
          <BoutonMois sens="apres" disabled={rang === mois.length - 1} onClick={() => setRang(rang + 1)} />
        </div>
        <div aria-hidden="true" className="grid grid-cols-7 gap-1 pb-1 text-center text-[12.5px] font-bold" style={{ color: colors.muted }}>
          {["L", "M", "M", "J", "V", "S", "D"].map((n, i) => (
            <span key={i}>{n}</span>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {cases.map((c) =>
            c.horsMois ? (
              <span key={c.jour} />
            ) : (
              <button
                key={c.jour}
                type="button"
                data-jour={c.jour}
                disabled={!jourChoisissable(c.jour, aujourdHui)}
                aria-pressed={c.jour === jour}
                aria-label={jourLisibleCourt(c.jour)}
                onClick={() => {
                  setJour(c.jour);
                  setMoment(null);
                }}
                className="relative h-11 rounded-[10px] text-[16px] disabled:cursor-default"
                style={{
                  fontVariantNumeric: "tabular-nums lining-nums",
                  backgroundColor: c.jour === jour ? colors.plein : "transparent",
                  color: c.jour === jour ? surPlein : jourChoisissable(c.jour, aujourdHui) ? colors.ink : voile(colors.ink, 0.35),
                }}
              >
                {c.numero}
                {/* Un point d'or sous un jour qui porte déjà quelque chose. */}
                {occupe(c.jour) && (
                  <span
                    aria-hidden="true"
                    className="absolute bottom-[5px] left-1/2 h-[5px] w-[5px] -translate-x-1/2 rounded-full"
                    style={{ backgroundColor: c.jour === jour ? surPlein : colors.or }}
                  />
                )}
              </button>
            )
          )}
        </div>

        {jour && (
          <div className="mt-[22px]" role="group" aria-label="Quel moment">
            <p className={`mb-2.5 text-[13px] font-semibold uppercase tracking-[0.12em]`} style={{ color: colors.inkSoft }}>
              {jourLisibleCourt(jour)}
            </p>
            {MOMENTS.map((m, i) => {
              const qui = porte ? ceQuiEstPose(porte[`${jour}:matin`] ?? [], porte[`${jour}:apres_midi`] ?? [], m.cle) : null;
              return (
                <button
                  key={m.cle}
                  type="button"
                  aria-pressed={moment === m.cle}
                  data-atlas={`moment-${m.cle}`}
                  onClick={() => setMoment(m.cle)}
                  className={`flex min-h-[56px] w-full items-center justify-between gap-3 rounded-[12px] px-4 text-left text-[16px] font-semibold ${i > 0 ? "mt-2" : ""}`}
                  style={{
                    color: colors.ink,
                    backgroundColor: colors.card,
                    boxShadow: moment === m.cle ? `inset 0 0 0 2px ${colors.rust}` : `inset 0 0 0 1px ${colors.line}`,
                  }}
                >
                  {m.libelle}
                  {porte && (
                    <span
                      className="min-w-0 text-right text-[15px]"
                      style={{ color: qui ? colors.inkSoft : colors.carteVertTexte, fontWeight: qui ? 500 : 600 }}
                    >
                      {qui ?? "Libre"}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        )}

        {jour && illisible && (
          <p className="mt-2 text-[14px]" style={{ color: colors.inkSoft }}>
            Le planning ne s’est pas lu : regardez-le avant de poser.
          </p>
        )}

        {refus && (
          <p role="alert" className="mt-3 text-[14px] font-semibold" style={{ color: colors.alert }}>
            {refus}
          </p>
        )}

        <div className="mt-[22px]">
          <PrimaryButton onClick={poser} disabled={!jour || !moment || enCours} pleineLargeur repere="poser-l-hivernage">
            {enCours ? "Pose en cours…" : "Le poser au planning"}
          </PrimaryButton>
        </div>
        <button
          type="button"
          onClick={fermer}
          className="mt-2 flex min-h-[48px] w-full items-center justify-center text-[15px] font-semibold"
          style={{ color: colors.inkSoft }}
        >
          Annuler
        </button>
      </div>
    </BottomSheet>
  );
}

/** Le mois d'avant, le mois d'après : un chevron dessiné, il feuillette. */
function BoutonMois({ sens, disabled, onClick }: { sens: "avant" | "apres"; disabled: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={sens === "avant" ? "Le mois d’avant" : "Le mois d’après"}
      className="grid h-11 w-11 place-items-center rounded-full disabled:cursor-default"
      style={{ color: disabled ? voile(colors.or, 0.28) : colors.or }}
    >
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d={sens === "avant" ? "M15 5l-7 7 7 7" : "M9 5l7 7-7 7"} />
      </svg>
    </button>
  );
}

/** Le calendrier au trait de la planche. */
function DessinCalendrier() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3.5" y="5" width="17" height="15.5" rx="2" />
      <path d="M3.5 10h17M8 3v4M16 3v4" />
    </svg>
  );
}

/** Un bouton de la plage : plein pour ce qui conclut, creux pour le reste. */
function Bouton({
  plein = false,
  disabled,
  onClick,
  repere,
  children,
}: {
  plein?: boolean;
  disabled: boolean;
  onClick: () => void;
  repere: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      data-atlas={repere}
      className="flex min-h-[44px] items-center justify-center gap-2 rounded-[12px] px-3 text-[15px] font-bold"
      style={
        plein
          ? { backgroundColor: colors.plein, color: surPlein }
          : { color: colors.ink, boxShadow: `inset 0 0 0 1.5px ${colors.line}`, backgroundColor: "transparent" }
      }
    >
      {children}
    </button>
  );
}
