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
 * **Ses mots s'accrochent aux entrées d'Atlas**, en or, suivis de « vous ». Ils
 * ne vivent pas à côté : c'est ce qui fait qu'une dictée « écime-moi le
 * tilleul » est reconnue comme un élagage, avec les prix et les questions qui
 * vont avec, au lieu d'ouvrir une prestation neuve.
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
  /** L'entrée dont le champ « + mon mot » est ouvert. Un seul à la fois. */
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

                L'or reste sur SES MOTS, dans la ligne « Aussi appelé » : là, il
                distingue deux choses qui sont vraiment différentes — le mot du
                commun et celui qu'il a ajouté, qu'il peut retirer. */}
            <span className="block text-[17px] leading-[1.25]" style={{ fontFamily: font.display, color: colors.ink }}>
              {carte.nom}
            </span>

            {(carte.motsCommuns.length > 0 || carte.mesMots.length > 0) && (
              <p className="mt-[3px] text-[12.5px] leading-[1.5]" style={{ color: colors.muted }}>
                Aussi appelé : {carte.motsCommuns.join(", ")}
                {carte.motsCommuns.length > 0 && carte.mesMots.length > 0 ? ", " : ""}
                {carte.mesMots.map((m, i) => (
                  <span key={m.id} style={{ color: colors.or }}>
                    {i > 0 ? ", " : ""}
                    {m.mot}
                    <button
                      type="button"
                      aria-label={`Retirer le mot « ${m.mot} »`}
                      onClick={() => retirer(carte, m.id)}
                      // Une croix de trois pixels ne se vise pas au pouce sur un
                      // chantier : la zone touchable est élargie sans grossir le
                      // signe, qui doit rester discret à côté du mot.
                      className="ml-[2px] inline-flex h-[24px] w-[24px] items-center justify-center align-middle"
                      style={{ color: colors.or }}
                    >
                      ×
                    </button>
                  </span>
                ))}
                {carte.mesMots.length > 0 && <span style={{ color: colors.or }}> · vous</span>}
              </p>
            )}

            {ouverte === carte.id ? (
              <div className="mt-[9px] flex items-center gap-[8px]">
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
                  placeholder="Comme vous le dites : « écime »"
                  className="min-w-0 flex-1 rounded-[8px] px-[10px] py-[8px] text-[14px]"
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
                  className="rounded-full px-[15px] py-[8px] text-[13.5px]"
                  style={{ backgroundColor: colors.rust, color: colors.card }}
                >
                  Ajouter
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => ouvrir(carte.id)}
                className="mt-[8px] text-[12.5px]"
                style={{ color: colors.or }}
              >
                + mon mot
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
          className="mt-[12px] w-full rounded-full px-[12px] py-[10px] text-[13.5px]"
          style={{ border: `1px dashed ${colors.or}`, color: colors.or }}
        >
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
              className="min-w-0 flex-1 rounded-[8px] px-[10px] py-[8px] text-[14px]"
              style={{ backgroundColor: colors.cream, border: `1px solid ${colors.line}`, color: colors.ink }}
            />
            <button
              type="button"
              onClick={creer}
              disabled={enCours}
              className="rounded-full px-[15px] py-[8px] text-[13.5px]"
              style={{ backgroundColor: colors.rust, color: colors.card }}
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
