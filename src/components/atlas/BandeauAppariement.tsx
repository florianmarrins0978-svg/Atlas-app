"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { colors, font } from "@/lib/design-tokens";
import type { Appariement } from "@/server/planning/appariement";

/**
 * « L'après-midi est libre. Le plus proche : … »
 *
 * **Sa demande du 13 août 2026, et son choix du 16 :** la composition 2 —
 * le bandeau sous la journée — mais **avec plusieurs propositions comme la 3**,
 * et **par la route** (`docs/maquettes/57-apparier-deux-demi-journees.html`).
 *
 * ————————————————————————————————————————————————————————————————
 * **CE QUI COMPTE LE PLUS ICI N'EST PAS LE CAS QUI MARCHE.** Trois défauts de
 * ce dépôt ont eu la même racine : un écran qui ne dit rien passe pour une
 * panne. Ce bandeau a donc quatre états, et les trois derniers ont autant de
 * soin que le premier :
 *
 *   · des propositions, classées, la plus proche en tête ;
 *   · **rien d'assez proche** — avec le nombre et la distance du plus proche,
 *     sinon « rien à proposer » se lit comme « je n'ai pas cherché » ;
 *   · **un chantier qu'on n'a pas su situer** — nommé, avec le chemin pour
 *     corriger son adresse ;
 *   · **aucun chantier d'une demi-journée en attente** — le cas ordinaire, et
 *     alors le bandeau ne s'affiche pas du tout plutôt que de meubler.
 *
 * **Il ne planifie rien de lui-même.** Chaque proposition attend un appui.
 */

export type CibleAppariement = { jour: string; moment: "matin" | "apres_midi"; rang: number };

export default function BandeauAppariement({
  chantierEnPlaceId,
  cible,
  onCaler,
  charger,
}: {
  /** Le chantier déjà posé sur l'autre demi-journée : le point de départ. */
  chantierEnPlaceId: string;
  cible: CibleAppariement;
  onCaler: (chantierId: string, cible: CibleAppariement) => Promise<{ succes: boolean; erreur?: string }>;
  charger: (chantierEnPlaceId: string, sansSeuil: boolean) => Promise<Appariement>;
}) {
  const [sansSeuil, setSansSeuil] = useState(false);
  const [enCours, setEnCours] = useState<string | null>(null);
  const [refus, setRefus] = useState<string | null>(null);

  // **La réponse est rangée AVEC la question qui l'a produite.** Un simple
  // `setResultat(null)` en tête d'effet aurait fait le même office, en
  // repeignant l'écran deux fois par changement. Ici, une réponse qui ne
  // correspond plus à la demande en cours est simplement ignorée — c'est aussi
  // ce qui protège de la réponse lente qui revient après la rapide.
  const cle = `${chantierEnPlaceId}|${sansSeuil}`;
  const [reponse, setReponse] = useState<{ cle: string; valeur: Appariement | null }>({
    cle: "",
    valeur: null,
  });

  useEffect(() => {
    let vivant = true;
    charger(chantierEnPlaceId, sansSeuil).then(
      (r) => {
        if (vivant) setReponse({ cle, valeur: r });
      },
      () => {
        // **Une panne ne fabrique pas un état trompeur.** Sans propositions, le
        // bandeau disparaît — mieux vaut l'écran d'avant qu'un « rien à
        // proposer » qui affirmerait avoir cherché.
        if (vivant) setReponse({ cle, valeur: null });
      }
    );
    return () => {
      vivant = false;
    };
  }, [cle, chantierEnPlaceId, sansSeuil, charger]);

  const resultat = reponse.cle === cle ? reponse.valeur : null;

  // Tant que la mesure n'est pas revenue, rien ne s'affiche : un bandeau qui
  // apparaît vide puis se remplit fait sauter la journée sous le pouce.
  if (!resultat) return null;

  const { propositions, ecartes, departNonSitue, sansAdresse } = resultat;
  const moment = cible.moment === "matin" ? "Le matin" : "L’après-midi";

  if (departNonSitue) {
    return (
      <Cadre pointille>
        <p style={{ color: colors.ink }}>
          <b style={{ fontWeight: 600 }}>Je ne sais pas situer ce chantier.</b>{" "}
          {departNonSitue.adresse ? (
            <>Son adresse — «&nbsp;{departNonSitue.adresse}&nbsp;» — n’a pas été reconnue, donc aucune distance n’est comparable.</>
          ) : (
            <>Il n’a pas d’adresse, donc aucune distance n’est comparable.</>
          )}
        </p>
        <Lien href={`/chantiers/${departNonSitue.chantierId}/devis-complet`}>Corriger l’adresse →</Lien>
      </Cadre>
    );
  }

  if (propositions.length === 0) {
    // **Aucun candidat du tout : on se tait.** Le patron n'a aucun chantier
    // d'une demi-journée en attente — lui annoncer qu'il n'y a rien à proposer
    // serait du bruit sur l'écran qu'il consulte le plus.
    if (ecartes.combien === 0 && sansAdresse.length === 0) return null;

    return (
      <Cadre pointille>
        {ecartes.combien > 0 ? (
          <p style={{ color: colors.ink }}>
            <b style={{ fontWeight: 600 }}>Rien d’assez proche.</b>{" "}
            {ecartes.combien === 1 ? "Le seul chantier" : `Les ${ecartes.combien} chantiers`} d’une demi-journée
            qui {ecartes.combien === 1 ? "attend" : "attendent"} une date{" "}
            {ecartes.combien === 1 ? "est" : "sont"} à plus de {Math.round(resultat.seuilKm)} km — le plus proche à{" "}
            {Math.round(ecartes.plusProcheKm ?? 0)} km à vol d’oiseau.
          </p>
        ) : (
          <p style={{ color: colors.ink }}>
            <b style={{ fontWeight: 600 }}>Rien à proposer.</b> {sansAdresse.length === 1 ? "Un chantier attend" : `${sansAdresse.length} chantiers attendent`} une date, mais{" "}
            {sansAdresse.length === 1 ? "son adresse n’a pas pu être située" : "leurs adresses n’ont pas pu être situées"}.
          </p>
        )}
        {ecartes.combien > 0 && !sansSeuil && (
          <button type="button" onClick={() => setSansSeuil(true)} data-atlas="voir-quand-meme">
            <Lien>Voir quand même →</Lien>
          </button>
        )}
      </Cadre>
    );
  }

  return (
    <div
      data-atlas="appariement"
      className="mt-3 rounded px-3.5 py-3"
      style={{ backgroundColor: colors.card, borderLeft: `2px solid ${colors.or}` }}
    >
      <p className="text-[13.5px] leading-[1.5]">
        {moment} est libre.{" "}
        <span style={{ color: colors.muted }}>
          {propositions.length === 1 ? "Le plus proche" : "Les plus proches"} du chantier
          {resultat.depart?.ou ? ` de ${resultat.depart.ou}` : ""} :
        </span>
      </p>

      <ul className="mt-2">
        {propositions.map((p) => (
          <li
            key={p.chantierId}
            className="flex items-baseline justify-between gap-2.5 py-2.5"
            style={{ borderTop: `1px solid ${colors.line}` }}
          >
            <span className="min-w-0">
              <span className="block truncate" style={{ fontFamily: font.display, fontSize: 16, lineHeight: 1.2 }}>
                {p.nom}
              </span>
              <span className="mt-0.5 block text-[11.5px]" style={{ color: colors.muted }}>
                {[p.ou, p.phrase].filter(Boolean).join(" · ")}
              </span>
            </span>
            <button
              type="button"
              data-atlas="caler"
              data-chantier={p.chantierId}
              disabled={enCours !== null}
              onClick={async () => {
                setEnCours(p.chantierId);
                setRefus(null);
                try {
                  const r = await onCaler(p.chantierId, cible);
                  if (!r.succes) setRefus(r.erreur ?? "Ce créneau vient d’être pris.");
                } finally {
                  setEnCours(null);
                }
              }}
              className="shrink-0 rounded-full px-4 py-2 text-[13px] disabled:opacity-40"
              style={{ backgroundColor: colors.rust, color: colors.cream }}
            >
              {enCours === p.chantierId ? "On pose…" : "Caler"}
            </button>
          </li>
        ))}
      </ul>

      {refus && (
        <p role="alert" className="mt-2 text-[12.5px]" style={{ color: colors.alert }}>
          {refus}
        </p>
      )}

      {/* **Ce qui a été écarté se dit, même quand il y a des propositions.**
          Sans cette ligne, le patron ne sait pas si trois est tout ce qu'il y a
          ou seulement ce qu'on a bien voulu lui montrer. */}
      {ecartes.combien > 0 && !sansSeuil && (
        <p className="mt-2 text-[11.5px]" style={{ color: colors.muted }}>
          {ecartes.combien} autre{ecartes.combien > 1 ? "s" : ""} à plus de {Math.round(resultat.seuilKm)} km.{" "}
          <button type="button" onClick={() => setSansSeuil(true)} data-atlas="voir-quand-meme">
            <span style={{ color: colors.or, fontWeight: 600 }}>Voir quand même →</span>
          </button>
        </p>
      )}

      {sansAdresse.length > 0 && (
        <p className="mt-2 text-[11.5px]" style={{ color: colors.muted }}>
          {sansAdresse.length} chantier{sansAdresse.length > 1 ? "s" : ""} sans adresse reconnue
          {sansAdresse.length === 1 ? ` (${sansAdresse[0].nom})` : ""} — {sansAdresse.length === 1 ? "il n’est" : "ils ne sont"} pas
          comparable{sansAdresse.length > 1 ? "s" : ""}.
        </p>
      )}
    </div>
  );
}

function Cadre({ children, pointille }: { children: React.ReactNode; pointille?: boolean }) {
  return (
    <div
      data-atlas="appariement-muet"
      className="mt-3 rounded px-3.5 py-3 text-[12.8px] leading-[1.55]"
      style={{
        border: pointille ? `1px dashed ${colors.line}` : undefined,
        backgroundColor: pointille ? undefined : colors.card,
        color: colors.muted,
      }}
    >
      {children}
    </div>
  );
}

function Lien({ href, children }: { href?: string; children: React.ReactNode }) {
  const style = { color: colors.or, fontWeight: 600 } as const;
  if (!href) return <span className="mt-2 inline-block text-[13px]" style={style}>{children}</span>;
  return (
    <Link href={href} className="mt-2 inline-block text-[13px]" style={style}>
      {children}
    </Link>
  );
}
