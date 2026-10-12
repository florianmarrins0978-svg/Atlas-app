"use client";

import { useState } from "react";
import { colors, font, libelleCaps } from "@/lib/design-tokens";
import type { CarteCatalogue } from "@/lib/mots-catalogue";
import type { Famille } from "@/server/repositories/mots-catalogue";
import { ajouterMotAction, creerEntreeAction, retirerMotAction } from "./actions";

/**
 * Le catalogue, et ses mots par-dessus — arrangement **B** de la planche 72,
 * choisi par le patron le 17 août 2026.
 *
 * **Ses mots s'accrochent aux entrées d'Atlas**, chacun sur sa ligne sous la
 * carte. Ils ne vivent pas à côté : c'est ce qui fait qu'une dictée « écime-moi
 * le tilleul » est reconnue comme un élagage, avec les prix et les questions
 * qui vont avec, au lieu d'ouvrir une prestation neuve.
 *
 * **La ligne les distingue, plus la couleur** — planche
 * `appli/catalogue-les-mots.html`, validée le 11 octobre 2026. Ils étaient
 * fondus en or dans « Aussi appelé », suivis d'une croix et de « dont les
 * vôtres », et l'en-tête devait expliquer le code couleur. Une ligne par mot,
 * avec « Retirer » au bout, se comprend sans légende : seuls ses mots se
 * retirent. L'or ne reste que sur les gestes d'ajout.
 *
 * **Rien ne retire un mot d'Atlas**, et l'écran ne le propose pas : il est
 * commun à toutes les entreprises. On n'ajoute que par-dessus.
 */
export default function MesMots({
  famille,
  titre,
  cartesInitiales,
  libelleNouvelle,
}: {
  famille: Famille;
  titre: string;
  cartesInitiales: CarteCatalogue[];
  libelleNouvelle: string;
}) {
  const [cartes, setCartes] = useState<CarteCatalogue[]>(cartesInitiales);
  /** L'entrée dont le champ « Ajouter un mot » est ouvert. Un seul à la fois. */
  const [ouverte, setOuverte] = useState<string | null>(null);
  const [saisie, setSaisie] = useState("");
  const [nouvelle, setNouvelle] = useState<string | null>(null);
  const [refus, setRefus] = useState<string | null>(null);
  const [enCours, setEnCours] = useState(false);

  function ouvrir(id: string) {
    setOuverte((cur) => (cur === id ? null : id));
    setSaisie("");
    setRefus(null);
  }

  async function poserLeMot(carte: CarteCatalogue) {
    if (enCours) return;
    setEnCours(true);
    setRefus(null);
    try {
      const reponse = await ajouterMotAction(famille, carte.id, saisie);
      if (!reponse.ok) {
        setRefus(reponse.phrase);
        return;
      }
      setCartes((cur) =>
        cur.map((c) => (c.id === carte.id ? { ...c, mesMots: [...c.mesMots, reponse.mot] } : c))
      );
      setSaisie("");
      setOuverte(null);
    } finally {
      setEnCours(false);
    }
  }

  async function creer() {
    if (enCours) return;
    setEnCours(true);
    setRefus(null);
    try {
      const reponse = await creerEntreeAction(famille, nouvelle ?? "");
      if (!reponse.ok) {
        setRefus(reponse.phrase);
        return;
      }
      setCartes((cur) => [
        ...cur,
        { id: reponse.mot.id, nom: reponse.mot.mot, motsCommuns: [], mesMots: [], aMoi: true },
      ]);
      setNouvelle(null);
    } finally {
      setEnCours(false);
    }
  }

  async function retirer(carte: CarteCatalogue, motId: string) {
    await retirerMotAction(motId);
    setCartes((cur) =>
      // Retirer une entrée à lui l'efface avec les mots qu'il y avait posés
      // (`ON DELETE CASCADE`) : l'écran fait de même, sans quoi il resterait une
      // carte fantôme jusqu'au prochain chargement.
      carte.aMoi && carte.id === motId
        ? cur.filter((c) => c.id !== motId)
        : cur.map((c) => (c.id === carte.id ? { ...c, mesMots: c.mesMots.filter((m) => m.id !== motId) } : c))
    );
  }

  return (
    <section className="mx-[26px] mt-[26px]">
      <p className={`mb-[10px] ${libelleCaps}`} style={{ color: colors.muted }}>
        {titre}
      </p>

      <ul className="flex flex-col gap-[9px]">
        {cartes.map((carte) => (
          <li
            key={carte.id}
            className="rounded-[11px] px-[13px] py-[11px]"
            style={{ backgroundColor: colors.card, border: `1px solid ${colors.lineSoft}` }}
          >
            {/* **Le nom d'une prestation est TOUJOURS en noir**, qu'elle vienne
                du catalogue commun ou qu'il l'ait ajoutée lui-même.

                Il portait l'or quand elle était à lui — une marque de
                provenance. **Le patron l'a écartée le 17 août 2026** en voyant
                « Entretient » en doré à côté d'« Élagage » en noir : *« les
                nouvelles prestations doivent toujours être en noir, pas en
                doré »*. Et il a raison sur le fond : deux couleurs de titre dans
                la même liste se lisent comme deux NATURES de prestation, pas
                comme deux provenances — or c'est la même chose, et il la
                cochera de la même façon sur un chantier.

                Ses mots à lui ont leur ligne, sous « Aussi appelé » : la ligne
                et « Retirer » disent qu'ils sont à lui, sans couleur à
                expliquer (11 octobre 2026). */}
            <span className="block text-[17px] leading-[1.25]" style={{ fontFamily: font.display, color: colors.ink }}>
              {carte.nom}
            </span>

            {carte.motsCommuns.length > 0 && (
              <p className="mt-[3px] text-[12.5px] leading-[1.5]" style={{ color: colors.muted }}>
                Aussi appelé : {carte.motsCommuns.join(", ")}
              </p>
            )}

            {carte.mesMots.length > 0 && (
              <ul data-atlas="mes-mots" className="mt-[10px]" style={{ borderTop: `1px solid ${colors.line}` }}>
                {carte.mesMots.map((m) => (
                  <li
                    key={m.id}
                    className="flex min-h-[46px] items-center gap-[10px]"
                    style={{ borderBottom: `1px solid ${colors.line}` }}
                  >
                    <span
                      aria-hidden="true"
                      className="h-[6px] w-[6px] flex-none rounded-full"
                      // L'encre, pas le vert pin : un aplat `rust` se lit comme un bouton
                      // (`test-boutons-pleins.ts`), et ce point ne fait que marquer la ligne.
                      style={{ backgroundColor: colors.ink }}
                    />
                    <span className="flex-1 text-[15px]" style={{ color: colors.ink }}>
                      {m.mot}
                    </span>
                    <button
                      type="button"
                      aria-label={`Retirer le mot « ${m.mot} »`}
                      onClick={() => retirer(carte, m.id)}
                      className={`min-h-[44px] pl-[12px] ${libelleCaps}`}
                      style={{ color: colors.inkSoft }}
                    >
                      Retirer
                    </button>
                  </li>
                ))}
              </ul>
            )}

            {ouverte === carte.id ? (
              <div className="flex items-center gap-[8px] pb-[4px] pt-[10px]">
                <input
                  autoFocus
                  value={saisie}
                  onChange={(e) => setSaisie(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") poserLeMot(carte);
                  }}
                  // **Le mot se dit court.** Atlas rapproche par inclusion : le
                  // mot posé doit se retrouver dans la phrase dictée. « écime »
                  // attrape « écime-moi le tilleul » ; « écimage », non.
                  //
                  // **16 px, et l'exemple raccourci** (11 octobre 2026) : en
                  // dessous, le téléphone zoome sur le champ ; à 16 px,
                  // « Comme vous le dites : « écime » » était coupé.
                  placeholder="Par exemple : écime"
                  className="min-h-[48px] min-w-0 flex-1 rounded-[12px] px-[12px] py-[11px] text-[16px]"
                  style={{
                    backgroundColor: colors.cream,
                    border: `1px solid ${colors.line}`,
                    color: colors.ink,
                  }}
                />
                <button
                  type="button"
                  onClick={() => poserLeMot(carte)}
                  disabled={enCours}
                  className="atlas-plein rounded-full px-[15px] py-[8px] text-[13.5px]"
                  style={{ backgroundColor: colors.plein, color: colors.card }}
                >
                  Ajouter
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => ouvrir(carte.id)}
                // 44 px de haut : « + mon mot » en 12,5 px ne se visait pas au
                // pouce sur un chantier (11 octobre 2026).
                className="flex min-h-[44px] w-full items-center gap-[9px] text-left text-[14px]"
                style={{ color: colors.or }}
              >
                <Plus />
                Ajouter un mot
              </button>
            )}

            {refus && ouverte === carte.id && (
              <p className="mt-[6px] text-[12px] leading-[1.5]" style={{ color: colors.alert }}>
                {refus}
              </p>
            )}
          </li>
        ))}
      </ul>

      {nouvelle === null ? (
        <button
          type="button"
          onClick={() => {
            setNouvelle("");
            setRefus(null);
          }}
          // Une ligne de texte, plus un grand cadre en pointillés or : deux
          // cadres pareils pesaient plus lourd que les cartes qu'ils suivent
          // (planche `appli/catalogue-les-mots.html`, 11 octobre 2026).
          className="mt-[6px] flex min-h-[52px] w-full items-center gap-[9px] px-[4px] text-left text-[14px]"
          style={{ color: colors.or }}
        >
          <Plus />
          {libelleNouvelle}
        </button>
      ) : (
        <div className="mt-[12px]">
          <div className="flex items-center gap-[8px]">
            <input
              autoFocus
              value={nouvelle}
              onChange={(e) => setNouvelle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") creer();
              }}
              placeholder="Son nom"
              // 16 px, comme le champ d'un mot : en dessous, le téléphone zoome.
              className="min-h-[48px] min-w-0 flex-1 rounded-[12px] px-[12px] py-[11px] text-[16px]"
              style={{ backgroundColor: colors.cream, border: `1px solid ${colors.line}`, color: colors.ink }}
            />
            <button
              type="button"
              onClick={creer}
              disabled={enCours}
              className="atlas-plein rounded-full px-[15px] py-[8px] text-[13.5px]"
              style={{ backgroundColor: colors.plein, color: colors.card }}
            >
              Créer
            </button>
          </div>
          {refus && (
            <p className="mt-[6px] text-[12px] leading-[1.5]" style={{ color: colors.alert }}>
              {refus}
            </p>
          )}
        </div>
      )}
    </section>
  );
}

/** Le signe des deux gestes d'ajout, dessiné : un « + » tapé dans le libellé
 *  se lisait comme un mot de plus. */
function Plus() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true" className="flex-none">
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}
