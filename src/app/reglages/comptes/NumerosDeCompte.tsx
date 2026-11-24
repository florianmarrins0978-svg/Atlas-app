"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import BottomSheet from "@/components/atlas/BottomSheet";
import PrimaryButton from "@/components/atlas/PrimaryButton";
import Paquet from "@/components/atlas/reglages/Paquet";
import IconeTrait from "@/components/atlas/IconeTrait";
import { colors, font } from "@/lib/design-tokens";
import { COULEUR_CATEGORIE } from "@/lib/couleurs-comptable";
import {
  CLES_COMPTA,
  FAMILLES,
  NOM_FAMILLE,
  avisSurLeNumero,
  compteSuggere,
  couleurDe,
  familleDe,
  intituleDuCompte,
  lireNumeroDeCompte,
  nomCategorie,
  numeroDuCompte,
  raisonDu,
  type CleCompta,
  type NumerosChoisis,
  type Situation,
} from "@/lib/categories-comptables";
import { poserNumeroAction, rendreLesNumerosAction } from "./actions";

/**
 * La liste des numéros, par familles, et la feuille qui en change un.
 *
 * La saisie se relit avec la MÊME règle que le serveur (`lireNumeroDeCompte`) :
 * l'écran dit le refus avant l'appui, le serveur le redit s'il passe quand même.
 */
export default function NumerosDeCompte({ patron, situation, choisis }: { patron: boolean; situation: Situation; choisis: NumerosChoisis }) {
  const router = useRouter();
  const [enCours, demarrer] = useTransition();
  const [ouverte, setOuverte] = useState<CleCompta | null>(null);
  const [saisie, setSaisie] = useState("");
  const [refus, setRefus] = useState<string | null>(null);
  const [dit, setDit] = useState<string | null>(null);

  const changes = CLES_COMPTA.filter((c) => choisis[c] !== undefined);

  function ouvrir(cle: CleCompta) {
    setOuverte(cle);
    setSaisie(numeroDuCompte(cle, situation, choisis));
    setRefus(null);
  }
  function enregistrer(valeur: string | null) {
    if (!ouverte) return;
    const cle = ouverte;
    if (valeur !== null) {
      const lu = lireNumeroDeCompte(valeur);
      if (!lu.ok) {
        setRefus(lu.raison);
        return;
      }
    }
    demarrer(async () => {
      const r = await poserNumeroAction(cle, valeur);
      if (!r.ok) {
        setRefus(r.raison);
        return;
      }
      setOuverte(null);
      setDit(`${nomCategorie(cle)} : ${r.numero ?? compteSuggere(cle, situation)}, repris dans le PDF, l'Excel et le FEC.`);
      router.refresh();
    });
  }
  function toutRendre() {
    demarrer(async () => {
      const r = await rendreLesNumerosAction();
      if (!r.ok) {
        setDit(r.raison);
        return;
      }
      setDit("Les numéros proposés sont revenus.");
      router.refresh();
    });
  }

  const lu = ouverte ? lireNumeroDeCompte(saisie) : null;
  const intitule = ouverte && lu?.ok ? (intituleDuCompte(lu.numero) ?? "Absent de la liste de Cause : un numéro du plan de votre comptable.") : null;
  const avis = ouverte && lu?.ok ? avisSurLeNumero(ouverte, lu.numero, situation) : null;

  return (
    <>
      <p className="mx-[22px] mt-1 text-[15.5px] leading-[1.45]" style={{ color: colors.inkSoft }} data-atlas="comptes-situation">
        {changes.length === 0
          ? "Les mêmes dans le PDF, l'Excel et le FEC."
          : `${changes.length === 1 ? "Un numéro changé" : `${changes.length} numéros changés`}, repris dans le PDF, l'Excel et le FEC.`}
      </p>
      {dit && (
        <p className="mx-[22px] mt-3 text-[15px] font-semibold" style={{ color: colors.ink }} role="status" data-atlas="comptes-dit">
          {dit}
        </p>
      )}

      {FAMILLES.map((famille) => {
        const cles = CLES_COMPTA.filter((c) => familleDe(c) === famille);
        return (
          <Paquet key={famille} titre={NOM_FAMILLE[famille]} dataAtlas={`comptes-${famille}`}>
            <ul>
              {cles.map((cle, i) => {
                const numero = numeroDuCompte(cle, situation, choisis);
                const change = choisis[cle] !== undefined;
                const contenu = (
                  <>
                    <i className="inline-block h-2.5 w-2.5 flex-none rounded-full" style={{ backgroundColor: COULEUR_CATEGORIE[couleurDe(cle)] }} />
                    <span className="min-w-0 flex-1">
                      <span className="block text-[17px] leading-[1.3]" style={{ fontFamily: font.display }}>
                        {nomCategorie(cle)}
                      </span>
                      {change && (
                        <span className="mt-0.5 block text-[14px]" style={{ color: colors.inkSoft }}>
                          Proposé : {compteSuggere(cle, situation)}
                        </span>
                      )}
                    </span>
                    <span className="flex-none text-[17px] font-bold tabular-nums" style={{ color: colors.orTexte }} data-atlas="numero-du-compte">
                      {numero}
                    </span>
                    {patron && <IconeTrait nom="suivant" taille={18} />}
                  </>
                );
                return (
                  <li key={cle} style={i > 0 ? { boxShadow: `inset 0 1px 0 ${colors.line}` } : undefined}>
                    {patron ? (
                      <button type="button" onClick={() => ouvrir(cle)} className="flex min-h-[56px] w-full items-center gap-3 py-2.5 text-left" data-atlas={`compte-${cle}`}>
                        {contenu}
                      </button>
                    ) : (
                      <div className="flex min-h-[56px] items-center gap-3 py-2.5" data-atlas={`compte-${cle}`}>
                        {contenu}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          </Paquet>
        );
      })}

      {patron && changes.length > 0 && (
        <div className="mx-[22px] mt-6">
          <button type="button" disabled={enCours} onClick={toutRendre} className="min-h-[48px] text-[15.5px] font-semibold" style={{ color: colors.orTexte }} data-atlas="rendre-les-numeros">
            Revenir aux numéros proposés
          </button>
        </div>
      )}

      <BottomSheet open={ouverte !== null} onBackdropClick={() => setOuverte(null)}>
        {ouverte && (
          <div data-atlas="feuille-compte">
            <h2 className="text-[26px] leading-[1.15]" style={{ fontFamily: font.display }}>
              {nomCategorie(ouverte)}
            </h2>
            <input
              value={saisie}
              onChange={(e) => {
                setSaisie(e.target.value.replace(/\D/g, ""));
                setRefus(null);
              }}
              inputMode="numeric"
              autoComplete="off"
              maxLength={10}
              aria-label={`Numéro de compte, ${nomCategorie(ouverte)}`}
              aria-invalid={lu ? !lu.ok : false}
              className="mt-4 block min-h-[64px] w-full rounded-lg px-4 text-[30px] font-bold tabular-nums tracking-[0.04em]"
              style={{ backgroundColor: colors.card, color: colors.ink, boxShadow: `inset 0 0 0 ${lu && !lu.ok ? 2 : 1.5}px ${lu && !lu.ok ? colors.alert : colors.line}` }}
              data-atlas="saisie-du-compte"
            />
            <p className="mt-2.5 min-h-[22px] text-[15px]" style={{ color: lu && !lu.ok ? colors.alert : colors.inkSoft }} data-atlas="intitule-du-compte">
              {lu && !lu.ok ? lu.raison : avis ? `${intitule} ${avis}` : intitule}
            </p>
            <p className="mt-4 rounded-lg px-4 py-3 text-[15px] leading-[1.45]" style={{ backgroundColor: colors.card, color: colors.ink }}>
              Proposé par Cause : <b>{compteSuggere(ouverte, situation)}</b>
              {intituleDuCompte(compteSuggere(ouverte, situation)) ? `, ${intituleDuCompte(compteSuggere(ouverte, situation))}` : ""}.
              <br />
              {raisonDu(ouverte, situation)}
            </p>
            {refus && (
              <p role="alert" className="mt-3 text-[15px] font-semibold" style={{ color: colors.alert }}>
                {refus}
              </p>
            )}
            <div className="mt-5 grid gap-1">
              <PrimaryButton pleineLargeur disabled={enCours || !lu?.ok} onClick={() => enregistrer(saisie)} repere="enregistrer-le-compte">
                Enregistrer
              </PrimaryButton>
              {saisie !== compteSuggere(ouverte, situation) && (
                <button type="button" disabled={enCours} onClick={() => enregistrer(null)} className="min-h-[48px] text-[15.5px] font-semibold" style={{ color: colors.orTexte }} data-atlas="reprendre-le-propose">
                  Reprendre le numéro proposé
                </button>
              )}
            </div>
          </div>
        )}
      </BottomSheet>
    </>
  );
}
