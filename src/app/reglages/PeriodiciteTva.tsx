"use client";

import { useState } from "react";
import { colors } from "@/lib/design-tokens";
import type { PeriodiciteTva } from "@/server/periode-tva";
import { mettreAJourPeriodiciteTvaAction } from "./actions";
import ChoixEnMots from "@/components/atlas/reglages/ChoixEnMots";

/**
 * « Votre TVA » — au mois, ou au trimestre.
 *
 * *Posé le 12 août 2026, à sa demande : « pour moi la TVA on doit la donner
 * tous les mois et pas tous les trimestres. Et si jamais c'est à nous de
 * choisir, dans ce cas-là il faut que l'utilisateur ait le choix. »*
 *
 * **Le mois est pris d'avance parce que c'est le défaut LÉGAL**, pas une
 * préférence : la déclaration CA3 est mensuelle, et le trimestre est une option
 * ouverte seulement quand la TVA due de l'année précédente est sous 4 000 €.
 * C'est la base qui le porte (`PERIODICITE_TVA_PAR_DEFAUT`), et le mois vient
 * en premier.
 *
 * **Et l'application ne dira JAMAIS lequel s'applique.** Le seuil porte sur la
 * TVA *due* — collectée moins déductible — et Atlas ne connaît que la
 * collectée. Faire mine de conseiller ici serait inventer une donnée
 * (`CLAUDE.md` §4).
 */
export default function PeriodiciteTvaReglage({ initiale }: { initiale: PeriodiciteTva }) {
  const [choix, setChoix] = useState<PeriodiciteTva>(initiale);
  const [enCours, setEnCours] = useState(false);

  async function choisir(valeur: PeriodiciteTva) {
    if (valeur === choix || enCours) return;
    const avant = choix;
    setChoix(valeur); // optimiste : le doigt doit voir tout de suite
    setEnCours(true);
    try {
      const r = await mettreAJourPeriodiciteTvaAction(valeur);
      // **On affiche ce que la base porte, jamais ce qu'on a demandé.** Un
      // refus silencieux laisserait sinon un réglage coché qui n'existe pas.
      setChoix(r.periodiciteTva);
    } catch {
      setChoix(avant);
    } finally {
      setEnCours(false);
    }
  }

  return (
    // **`data-atlas` plutôt qu'un titre à lire.** Sa suite visait le mot
    // « Votre TVA », qui avait disparu — elle serait morte sur un renommage,
    // c'est-à-dire sur du code juste (`CLAUDE.md` §5 bis). Ce marqueur-ci ne
    // se renomme pas pour faire joli.
    //
    // Aucun retrait horizontal : ce réglage vit DANS le paquet « Votre TVA »,
    // qui pose déjà les marges de l'écran.
    <section data-atlas="periodicite-tva" className="mt-[18px]">
      {/* Un libellé en toutes lettres, comme toutes les lignes des réglages
          soignés : il dit ce que le titre du paquet ne dit pas, « à quel
          rythme vous la déclarez ». */}
      <p className="mb-2 text-[14px] font-semibold" style={{ color: colors.inkSoft }}>
        À quel rythme vous la déclarez
      </p>

      <ChoixEnMots
        libelle="À quel rythme vous déclarez la TVA"
        options={[
          { valeur: "mensuelle", libelle: "Tous les mois" },
          { valeur: "trimestrielle", libelle: "Tous les trimestres" },
        ]}
        valeur={choix}
        onChoix={choisir}
      />

      {/* **La phrase « Le mois est le défaut. Le trimestre s'obtient sous
          condition. » est partie le 26 octobre 2026**, à sa demande, sur la
          planche soignée (`appli/soignee/reglages-identite.html`, « Deux
          phrases partent »). Elle avait été raccourcie le 24 août ; il l'a
          retirée tout à fait. Le défaut légal reste tenu par la base, et le
          mois reste le premier des deux mots. */}
    </section>
  );
}
