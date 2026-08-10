"use client";

import { useState } from "react";
import Link from "next/link";
import { colors, font, libelleCaps } from "@/lib/design-tokens";
import { formatEuros, libelleEncart, type MoisTermine } from "@/lib/termines-par-mois";

/**
 * Le fil de « Terminés » — un mois, ses factures, et ce qui attend.
 *
 * *Choisi par le patron le 10 août 2026 sur maquette
 * (`maquettes/atlas-facturer.html`, `docs/INTEGRER-ORIGINE.md` §6 quinquies).*
 *
 * **Le même fil que la liste des chantiers** : marge de 47 px pour le mois,
 * filet d'un pixel, une perle par ligne. Deux écrans qui se ressemblent
 * s'apprennent une seule fois.
 *
 * **Des filets, jamais de pavé.** L'ancien écran empilait trois sortes de pavés
 * arrondis, dont un seul plein — le relevé de TVA. L'œil allait donc d'abord
 * sur ce qu'on consulte une fois par trimestre.
 *
 * **Les montants tiennent une colonne** (`tabular-nums`, alignés à droite) et
 * **rien ne s'ajoute après** : un chevron en bout de ligne leur vole 24 px et
 * brise la colonne.
 */
export default function FilTermines({ mois }: { mois: MoisTermine[] }) {
  return (
    <div className="relative mx-[26px] mt-6">
      {/* Le fil lui-même. Il court du premier mois au dernier, derrière les
          perles — d'où les fonds opaques qui le masquent au bon endroit. */}
      <span
        aria-hidden="true"
        className="absolute w-px"
        style={{ left: 47, top: 14, bottom: 16, backgroundColor: colors.line }}
      />
      {mois.map((m) => (
        <MoisDuFil key={m.cle} mois={m} />
      ))}
    </div>
  );
}

function MoisDuFil({ mois }: { mois: MoisTermine }) {
  // **Replié au repos.** L'écran s'appelle « Terminés » : il montre d'abord ce
  // qui est fait. L'encart appelle, il n'occupe pas.
  const [ouvert, setOuvert] = useState(false);
  const encart = libelleEncart(mois.aFacturer.length);
  // **Un montant inconnu ne s'écrit pas « 0,00 € ».** Un chantier sans devis
  // chiffré n'attend pas zéro euro : on ne sait pas. L'annoncer à zéro dirait
  // au patron qu'il n'y a rien à encaisser là où il y a peut-être tout.
  const montantConnu = mois.aFacturer.some((l) => l.montant !== null);

  return (
    <div>
      <div className="relative grid grid-cols-[47px_1fr] gap-x-[26px] pb-1 pt-3.5">
        {/* La pastille est posée SUR LE FIL, pas dans la marge : celle-ci fait
            47 px et n'a pas de place en trop — la pastille y chevauchait le nom
            du mois. Son fond opaque masque le filet qui passe dessous. */}
        {encart && (
          <span
            aria-hidden="true"
            data-atlas="pastille"
            className="absolute flex items-center justify-center rounded-full"
            style={{
              left: 47,
              top: 19,
              transform: "translate(-50%, -50%)",
              width: 22,
              height: 22,
              backgroundColor: colors.or,
              color: colors.cream,
              fontSize: 11,
              fontVariantNumeric: "tabular-nums",
            }}
          >
            {mois.aFacturer.length}
          </span>
        )}
        {/* **Le nom du mois déborde vers la GAUCHE, jamais vers la droite.**
            « juillet » ne tient pas dans les 47 px de la marge, et une ligne
            trop longue déborde toujours du côté de la fin de ligne — `text-right`
            n'y change rien, c'est du CSS, pas un réglage. Il passait donc sous
            la pastille, dont le fond opaque lui mangeait sa dernière lettre.
            `justify-self: end` fait tenir la boîte au texte et la colle à la fin
            de la colonne : ce qui dépasse part dans la marge de 26 px, où il y a
            la place, et le fil ne bouge pas. Mesuré, pas supposé. */}
        <span
          data-atlas="nom-du-mois"
          className="text-right"
          style={{ justifySelf: "end", paddingRight: encart ? 24 : 13 }}
        >
          <b className="block font-normal" style={{ fontFamily: font.display, fontSize: 17, lineHeight: 1 }}>
            {mois.nom}
          </b>
          <span
            className="mt-1 block text-[9px] uppercase"
            style={{ color: colors.muted, letterSpacing: "0.16em" }}
          >
            {mois.annee || ""}
          </span>
        </span>
        <span
          className="self-center text-right text-[11px] uppercase"
          style={{ color: colors.muted, letterSpacing: "0.2em", fontVariantNumeric: "tabular-nums", minWidth: 0 }}
        >
          {mois.totalFacture > 0 ? formatEuros(mois.totalFacture) : ""}
        </span>
      </div>

      {encart && (
        <>
          {/* 44 px de haut : une ligne de 9,5 px se rate deux fois sur trois. */}
          <button
            type="button"
            onClick={() => setOuvert((v) => !v)}
            aria-expanded={ouvert}
            data-atlas="encart-a-facturer"
            className="flex h-[44px] w-full items-center gap-[9px] pl-[73px]"
            style={{ color: colors.or, WebkitTapHighlightColor: "transparent" }}
          >
            <span className={libelleCaps} style={{ letterSpacing: "0.22em", whiteSpace: "nowrap" }}>
              {encart}
            </span>
            {montantConnu && (
              <span
                className="text-[12px]"
                style={{ fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap", opacity: 0.8 }}
              >
                {formatEuros(mois.totalPrevu)}
              </span>
            )}
            <span
              aria-hidden="true"
              className="ml-auto text-[15px]"
              style={{
                transform: ouvert ? "rotate(90deg)" : "none",
                transition: "transform .3s cubic-bezier(.22,.61,.36,1)",
              }}
            >
              ›
            </span>
          </button>

          {/* Le volet : une grille de 0fr à 1fr, qui se déplie sans hauteur
              codée en dur — un `max-height` deviné casse dès qu'il y a une
              ligne de plus. */}
          <div
            data-atlas="volet-a-facturer"
            className="grid"
            style={{
              gridTemplateRows: ouvert ? "1fr" : "0fr",
              transition: "grid-template-rows .42s cubic-bezier(.22,.61,.36,1)",
            }}
          >
            <div style={{ overflow: "hidden" }}>
              {mois.aFacturer.map((l) => (
                <LigneDuFil key={l.id} ligne={l} creuse />
              ))}
              {/* **La source du montant se dit UNE FOIS, sous les lignes.** La
                  répéter sur chacune y ajoutait une étiquette insécable, et une
                  étiquette insécable dans une piste `1fr` élargit la piste :
                  les montants sortaient de 13 px de leur colonne. */}
              <p className="mb-2.5 mt-0.5 pl-[73px] text-[12px]" style={{ color: colors.muted }}>
                Montants prévus aux devis.
              </p>
            </div>
          </div>
        </>
      )}

      {mois.facturees.map((l) => (
        <LigneDuFil key={l.id} ligne={l} />
      ))}
    </div>
  );
}

/**
 * Une ligne du fil : la perle, le nom, la référence, le montant.
 *
 * **La perle CREUSE veut dire « pas encore facturé »** — le même signe que
 * l'anneau du planning, qui veut dire « il reste de la place ». Un signe appris
 * une fois sert sur deux écrans.
 */
function LigneDuFil({
  ligne,
  creuse = false,
}: {
  ligne: MoisTermine["facturees"][number];
  creuse?: boolean;
}) {
  return (
    <div className="grid grid-cols-[47px_1fr] gap-x-[26px]" data-atlas="ligne-terminee">
      <span className="relative" style={{ minWidth: 0 }}>
        <span
          aria-hidden="true"
          className="absolute rounded-full"
          style={{
            left: 47,
            top: 22,
            width: 7,
            height: 7,
            transform: "translate(-50%, -50%)",
            backgroundColor: creuse ? colors.cream : colors.or,
            boxShadow: creuse
              ? `inset 0 0 0 1px ${colors.or}, 0 0 0 4px ${colors.cream}`
              : `0 0 0 4px ${colors.cream}`,
          }}
        />
      </span>
      <Link
        href={`/chantiers/${ligne.id}/facture`}
        className="flex items-baseline justify-between gap-4 py-3.5"
        style={{ borderBottom: `1px solid ${colors.line}`, minWidth: 0 }}
      >
        <span className="min-w-0">
          <b
            className="block truncate font-normal"
            style={{ fontFamily: font.display, fontSize: 17, lineHeight: 1.2, color: colors.ink }}
          >
            {ligne.nom}
          </b>
          <span
            className="mt-[3px] block truncate text-[11px] uppercase"
            style={{ color: colors.muted, letterSpacing: "0.14em" }}
          >
            {reference(ligne)}
          </span>
        </span>
        {/* **Rien ne s'ajoute après le montant.** Un chevron lui volerait 24 px
            et briserait la colonne. `nowrap` : « 1 240,00 € » cassait en deux
            et poussait le « € » seul à la ligne. */}
        <span
          className="flex-none"
          style={{
            fontFamily: font.display,
            fontSize: 16,
            lineHeight: 1.2,
            fontVariantNumeric: "tabular-nums",
            whiteSpace: "nowrap",
            color: ligne.aFacturer ? colors.or : colors.ink,
          }}
        >
          {ligne.montant === null ? "—" : formatEuros(ligne.montant)}
        </span>
      </Link>
    </div>
  );
}

/** « F2026-0006 · le 2 », ou « Le 20 août » tant que rien n'est facturé. */
function reference(ligne: MoisTermine["facturees"][number]): string {
  const jour = ligne.datePlanifiee
    ? new Date(`${ligne.datePlanifiee}T12:00:00Z`).getUTCDate()
    : null;
  if (ligne.factureNumero) return jour ? `${ligne.factureNumero} · le ${jour}` : ligne.factureNumero;
  const mois = ligne.datePlanifiee
    ? new Date(`${ligne.datePlanifiee}T12:00:00Z`).toLocaleDateString("fr-FR", {
        month: "long",
        timeZone: "UTC",
      })
    : null;
  return jour && mois ? `Le ${jour} ${mois}` : "Date inconnue";
}
