"use client";

import { useState } from "react";
import { colors, libelleCaps } from "@/lib/design-tokens";

/**
 * UNE VALEUR QU'ON TOUCHE POUR LA COPIER — sa demande du 8 septembre 2026 :
 * *« tu rajoutes le numéro de facture en cliquable (copier-coller) automatique
 * pour les virements bancaires »*.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * **POURQUOI UN BOUTON, ET NON UN TEXTE À SÉLECTIONNER.** Sur un téléphone,
 * sélectionner « FR76 3000 6000 0112 3456 7890 189 » au doigt demande un appui
 * long, deux poignées à déplacer et un menu — quatre gestes que la moitié des
 * gens ne connaît pas, et c'est exactement le public de ce produit
 * (`PRODUCT.md`, « Accessibility »). Un appui, et c'est copié.
 *
 * **Cinquante-deux pixels de haut**, comme toutes les cibles de ce produit : la
 * page se lit dehors, souvent d'une main.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * **CE QU'ON COPIE N'EST PAS CE QU'ON MONTRE, et c'est délibéré.** L'IBAN
 * s'affiche par groupes de quatre parce qu'il se relit ainsi ; il se copie NU,
 * parce que c'est ce qu'attend un formulaire de virement — beaucoup les
 * refusent avec des espaces. Les deux formes viennent de la même fonction
 * (`src/lib/modalites-paiement.ts`).
 *
 * **Le repli sans `navigator.clipboard` n'est pas une coquetterie** : l'API
 * n'existe qu'en contexte sécurisé, et son banc d'essai n'est pas toujours en
 * HTTPS. Sans lui, le bouton ne ferait rien et personne ne saurait pourquoi.
 */
export default function PastilleACopier({
  quoi,
  affiche,
  aCopier,
}: {
  quoi: string;
  affiche: string;
  aCopier: string;
}) {
  const [copie, setCopie] = useState(false);

  async function copier() {
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(aCopier);
      } else {
        const zone = document.createElement("textarea");
        zone.value = aCopier;
        zone.style.position = "fixed";
        zone.style.opacity = "0";
        document.body.appendChild(zone);
        zone.select();
        try {
          document.execCommand("copy");
        } finally {
          document.body.removeChild(zone);
        }
      }
      setCopie(true);
      window.setTimeout(() => setCopie(false), 2000);
    } catch {
      // **Muet, et c'est le bon choix ici.** Un navigateur peut refuser le
      // presse-papier ; le client voit toujours la valeur écrite en clair
      // au-dessus et peut la recopier. Un message rouge lui ferait croire que
      // sa facture a un problème.
    }
  }

  return (
    <button
      type="button"
      onClick={copier}
      // **`rounded-full`, et c'est la batterie qui l'a exigé.** Écrite en
      // `rounded-xl`, la pastille a fait rougir `test-boutons-arrondis.ts` :
      // sa règle du 12 août 2026 veut la même forme pour tout ce qui s'appuie,
      // et une pastille qui se touche est un bouton. La maquette portait un
      // coin de douze pixels ; c'est elle qui avait tort.
      className="mt-2.5 flex w-full items-center justify-between gap-3 rounded-full px-4 py-2 text-left transition-transform active:scale-[0.995]"
      style={{
        backgroundColor: colors.rustTint,
        boxShadow: `inset 0 0 0 ${copie ? "1.5px" : "1px"} ${copie ? colors.plein : colors.line}`,
        minHeight: 52,
      }}
    >
      <span className="min-w-0">
        <span className={`block ${libelleCaps}`} style={{ color: colors.muted, fontSize: 9.5 }}>
          {quoi}
        </span>
        <span className="mt-0.5 block text-[16px] leading-[1.35]" style={{ color: colors.ink }}>
          {affiche}
        </span>
      </span>
      <span
        className="flex-none text-[13px] font-medium"
        style={{ color: copie ? colors.plein : colors.rust }}
      >
        {copie ? "Copié" : "Copier"}
      </span>
    </button>
  );
}
