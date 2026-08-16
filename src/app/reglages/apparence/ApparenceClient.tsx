"use client";

import { useState, useTransition } from "react";
import { colors, font, libelleCaps, texteSituation } from "@/lib/design-tokens";
import { CHARTES, type Charte, type NomCharte } from "@/lib/chartes";
import { choisirCharteAction } from "./actions";

/**
 * « Apparence » — les sept chartes du patron.
 *
 * *Choisies le 14 août 2026 sur la planche des seize
 * (`docs/maquettes/11-ecran-retenu-seize-couleurs.html`) :* ***« garde
 * seulement pour l'instant nuit, beurre, moka, pierre, sylve »***, *plus Prune,
 * puis* ***« oui garde Origine en défaut, fais les sept »***.
 *
 * **CHAQUE LIGNE SE MONTRE DANS SA PROPRE COULEUR**, et c'est tout l'écran.
 * « Chaleureux », « sobre », « spectaculaire » : personne ne choisit une
 * couleur sur un adjectif — c'était déjà la règle de la planche. La pastille
 * n'est donc pas une vignette décorative : c'est l'écran en réduction, fond,
 * carte, encre et accent compris.
 *
 * **Le mode sombre est DANS la liste**, il n'est pas à côté. Nuit et Sylve sont
 * sombres ; deux réglages séparés se seraient contredits dès qu'on aurait
 * choisi « Nuit » avec le sombre éteint.
 */
export default function ApparenceClient({ initiale }: { initiale: NomCharte }) {
  const [choisie, setChoisie] = useState<NomCharte>(initiale);
  const [refus, setRefus] = useState<string | null>(null);
  const [enCours, demarrer] = useTransition();

  function choisir(nom: NomCharte) {
    const avant = choisie;
    // Prise à l'écran sans attendre le serveur : le doigt a fait son geste, et
    // une pastille qui met une seconde à se remplir se touche deux fois.
    setChoisie(nom);
    demarrer(async () => {
      const r = await choisirCharteAction(nom);
      if (!r.ok) {
        setChoisie(avant);
        setRefus(r.raison);
        return;
      }
      setRefus(null);
    });
  }

  return (
    <div className="pb-24">
      {refus && (
        <p
          role="alert"
          className={`mx-[26px] mt-4 rounded-[4px] px-[15px] py-3 ${texteSituation}`}
          style={{ backgroundColor: colors.card, borderLeft: `3px solid ${colors.alert}`, color: colors.alert }}
        >
          {refus}
        </p>
      )}

      <p className={`mx-[26px] mt-[26px] ${texteSituation}`} style={{ color: colors.muted }}>
        La couleur change <b style={{ color: colors.ink, fontWeight: 500 }}>toute l&apos;application</b>, tout de
        suite. Elle n&apos;appartient qu&apos;à vous : vos devis et vos factures gardent leur apparence.
      </p>

      <section className="mx-[26px] mt-[30px] border-t pt-[18px]" style={{ borderColor: colors.line }}>
        <p className={`mb-2.5 ${libelleCaps}`} style={{ color: colors.muted }}>
          Votre charte
        </p>
        {CHARTES.map((c) => (
          <LigneCharte
            key={c.nom}
            charte={c}
            prise={choisie === c.nom}
            enCours={enCours}
            onChoisir={() => choisir(c.nom)}
          />
        ))}
      </section>

      <p
        className={`mx-[26px] mt-[30px] border-t pt-[18px] ${texteSituation}`}
        style={{ borderColor: colors.line, color: colors.muted }}
      >
        Deux d&apos;entre elles sont sombres — <b style={{ color: colors.ink, fontWeight: 500 }}>Nuit</b> et{" "}
        <b style={{ color: colors.ink, fontWeight: 500 }}>Sylve</b>. Elles se lisent mal en plein soleil : sur un
        chantier, à midi, l&apos;écran clair reste le plus sûr.
      </p>
    </div>
  );
}

/**
 * Une charte, montrée dans ses propres couleurs.
 *
 * **La pastille n'emploie PAS `colors.*`** — elle emploie les jetons de la
 * charte qu'elle représente. C'est la seule façon de la voir avant de la
 * choisir, et c'est le principe de la planche : montrer, pas décrire.
 */
function LigneCharte({
  charte,
  prise,
  enCours,
  onChoisir,
}: {
  charte: Charte;
  prise: boolean;
  enCours: boolean;
  onChoisir: () => void;
}) {
  const j = charte.jetons;
  return (
    <button
      type="button"
      onClick={onChoisir}
      disabled={enCours}
      aria-pressed={prise}
      aria-label={charte.libelle}
      data-charte={charte.nom}
      className="flex w-full items-center gap-[13px] border-b py-[14px] text-left last:border-b-0 disabled:opacity-60"
      style={{ borderColor: colors.line, minHeight: 60 }}
    >
      {/* L'écran en réduction : le fond, une carte posée dessus, l'encre, et le
          bouton d'action dans son plein. Quatre valeurs suffisent à reconnaître
          une charte — la planche entière tient sur ces quatre-là. */}
      <span
        aria-hidden="true"
        className="flex h-[46px] w-[46px] flex-none flex-col justify-between overflow-hidden rounded-[4px] p-[5px]"
        style={{ backgroundColor: j.cream, boxShadow: `inset 0 0 0 1px ${j.line}` }}
      >
        <span className="block h-[13px] w-full rounded-[2px]" style={{ backgroundColor: j.card }}>
          <span className="ml-[3px] block h-[3px] w-[18px] rounded-full" style={{ backgroundColor: j.ink, marginTop: 5 }} />
        </span>
        <span className="flex items-center gap-[3px]">
          <span className="block h-[10px] flex-1 rounded-[2px]" style={{ backgroundColor: j.rust }} />
          <span className="block h-[10px] w-[10px] flex-none rounded-full" style={{ backgroundColor: j.or }} />
        </span>
      </span>

      <span className="min-w-0 flex-1">
        <span className="flex items-baseline gap-2">
          <span style={{ fontFamily: font.display, fontSize: 17, lineHeight: 1.25, color: colors.ink }}>
            {charte.libelle}
          </span>
          {charte.sombre && (
            <span className={libelleCaps} style={{ color: colors.or }}>
              Sombre
            </span>
          )}
        </span>
        <span className={`mt-1 block ${texteSituation}`} style={{ color: colors.muted }}>
          {charte.dit}
        </span>
      </span>

      {/* La pastille du choix, comme sur l'écran du régime de TVA : pleine d'or
          quand elle est prise, un simple cercle sinon. */}
      <span
        aria-hidden="true"
        className="h-[19px] w-[19px] flex-none rounded-full"
        style={{ boxShadow: prise ? `inset 0 0 0 6px ${colors.or}` : `inset 0 0 0 1px ${colors.line}` }}
      />
    </button>
  );
}
