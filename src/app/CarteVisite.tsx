"use client";

import { useState } from "react";
import { colors, font, surPlein } from "@/lib/design-tokens";
import { carteVisiteVueAction } from "./actions";

/**
 * LA VISITE GUIDÉE, PROPOSÉE UNE SEULE FOIS SUR L'ACCUEIL — sa planche du
 * 23 novembre 2026 (`appli/vente/cause-2-inscription.html`, l'étape
 * « L'appli ») et son oui : *« une seule fois au premier accueil ; et qu'il
 * puisse, s'il ne veut pas la faire, enlever le bouton »*.
 *
 * Les deux gestes éteignent la carte pour de bon (`carteVisiteVueAction`,
 * migration 0194) : « Faire la visite » parce qu'elle est faite, « Non merci »
 * parce qu'elle est refusée.
 *
 * **La visite est servie par l'appli elle-même** (`/visite-guidee`, le même
 * fichier que le site) : « Quitter la visite » ramène à la page d'où l'on
 * vient, donc ici, à Chantiers. Ouverte sur le site, elle ramène au site.
 * Une page d'un autre site ne saurait pas revenir dans l'appli installée.
 */
export default function CarteVisite() {
  const [partie, setPartie] = useState(false);
  if (partie) return null;

  // La marque part AVANT la page : une navigation lancée tout de suite
  // couperait l'action en route, et la carte reviendrait au retour.
  const faire = (e: React.MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault();
    const vers = e.currentTarget.href;
    void carteVisiteVueAction().finally(() => window.location.assign(vers));
  };
  const nonMerci = () => {
    setPartie(true);
    void carteVisiteVueAction();
  };

  return (
    <section
      data-atlas="carte-visite"
      aria-labelledby="carte-visite-titre"
      className="mx-[26px] mt-7 rounded-[6px] px-[18px] pb-[14px] pt-[18px]"
      style={{ backgroundColor: colors.card, boxShadow: `inset 0 0 0 1px ${colors.line}` }}
    >
      <h2 id="carte-visite-titre" className="text-[22px] leading-[1.2]" style={{ fontFamily: font.display, fontWeight: 400 }}>
        La visite guidée
      </h2>
      <p className="mt-1 text-[15px] leading-[1.45]" style={{ color: colors.inkSoft }}>
        Dix minutes, sur des données d’essai.
      </p>
      <div className="mt-[14px] flex items-center gap-2">
        <a
          href="/visite-guidee"
          data-atlas="carte-visite-faire"
          onClick={faire}
          className="atlas-plein inline-flex min-h-[48px] items-center rounded-full px-[22px] text-[16px] font-semibold"
          style={{ backgroundColor: colors.plein, color: surPlein }}
        >
          Faire la visite
        </a>
        <button
          type="button"
          data-atlas="carte-visite-non"
          onClick={nonMerci}
          className="min-h-[48px] px-[14px] text-[16px] font-semibold"
          style={{ color: colors.inkSoft }}
        >
          Non merci
        </button>
      </div>
    </section>
  );
}
