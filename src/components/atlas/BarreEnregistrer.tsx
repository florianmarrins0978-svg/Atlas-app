"use client";

import { useEffect, useRef, useState } from "react";
import { colors } from "@/lib/design-tokens";

/**
 * Le bouton d'enregistrement posé SUR l'écran — sa réponse « À » du 14 août 2026.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * **ELLE ÉTAIT ÉCRITE TROIS FOIS, ET C'EST CE QUI A LAISSÉ PASSER LE DÉFAUT.**
 *
 * Le 6 septembre 2026, `ARCHITECTURE.md` §264 a corrigé cette barre sur
 * « Devis & factures » : elle était rendue **en permanence**, opaque, haute de
 * 85 px, et le contenu passait dessous — sur le premier écran, elle coupait
 * « Moyens de paiement acceptés » en deux, son interrupteur compris.
 *
 * Le correctif n'a atteint qu'un écran sur trois. « Mon entreprise » et « Mon
 * compte » portaient **leur propre copie** de la même barre, à quelques lignes
 * près, et rien dans le code ne le disait. C'est exactement la faute du §263 —
 * *une pièce partagée ne corrige que ceux qui s'en servent* —, sauf qu'ici il
 * n'y avait même pas de pièce partagée : il y avait trois jumelles.
 *
 * `CLAUDE.md` §3 : une allure ne se recopie pas dans un écran, elle s'ajoute
 * aux pièces partagées. La voici, et les trois écrans s'en servent.
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * **ELLE N'EXISTE QUE S'IL Y A QUELQUE CHOSE À ENREGISTRER.** C'est la règle du
 * §264 : une bande collée ne coûte pas sa hauteur une fois, elle la coûte à
 * chaque position de défilement. Sur une page de quatre mille pixels, une barre
 * de 85 px cache 85 px **partout**.
 *
 * **Ce n'est pas un geste caché** (`PRODUCT.md`) : rien ne se découvre, elle
 * revient d'elle-même dès qu'il touche à un champ.
 *
 * Elle se pose sur `--atlas-barre`, jamais sur un nombre écrit à la main : la
 * hauteur de la barre du bas comprend `env(safe-area-inset-bottom)`, nulle sur
 * un ordinateur et d'une vingtaine de pixels sur un iPhone à encoche.
 */
export default function BarreEnregistrer({
  aEcrire,
  enCours,
  refus = null,
  onEnregistrer,
}: {
  /** Y a-t-il quelque chose à enregistrer ? */
  aEcrire: boolean;
  enCours: boolean;
  /**
   * Ce qui EMPÊCHE d'enregistrer, dit en deux mots sur le bouton — « Message
   * incomplet ». La barre reste alors visible et le bouton refuse : un refus
   * qui disparaîtrait laisserait croire que c'est parti.
   */
  refus?: string | null;
  onEnregistrer: () => void;
}) {
  /**
   * **Le « Enregistré ✓ » qui s'attarde, et qui s'en va.**
   *
   * Sans lui, la barre disparaîtrait à l'instant même où il appuie, et il ne
   * saurait pas si c'est parti ou si le bouton a raté. La confirmation reste
   * donc le temps de se lire — deux secondes et demie —, puis rend la place.
   *
   * **Elle vit ICI et non dans les écrans**, sinon les trois la réécriraient
   * chacun à sa façon, ce qui est précisément d'où l'on vient.
   */
  const [vientDEnregistrer, setVientDEnregistrer] = useState(false);
  const enCoursAvant = useRef(enCours);
  useEffect(() => {
    if (enCoursAvant.current && !enCours) setVientDEnregistrer(true);
    enCoursAvant.current = enCours;
  }, [enCours]);
  useEffect(() => {
    if (!vientDEnregistrer) return;
    const t = setTimeout(() => setVientDEnregistrer(false), 2500);
    return () => clearTimeout(t);
  }, [vientDEnregistrer]);

  if (!aEcrire && !enCours && !refus && !vientDEnregistrer) return null;

  const rien = !aEcrire && !enCours;

  return (
    <div
      data-atlas="barre-enregistrer"
      className="fixed inset-x-0 z-10 mx-auto max-w-md border-t px-[26px] pb-4 pt-3.5"
      style={{ bottom: "var(--atlas-barre)", backgroundColor: colors.cream, borderColor: colors.line }}
    >
      <button
        type="button"
        onClick={onEnregistrer}
        disabled={rien || refus !== null}
        // **Passé au vert des boutons le 4 septembre 2026.** Il l'a relevé
        // lui-même — *« j'avais demandé à changer tous les boutons en vert
        // clair »* —, et ce bouton-ci avait échappé au balayage du 3 : il ne
        // portait pas `atlas-plein`, et le contrôle ne regardait QUE ce qui la
        // portait. Il la porte maintenant, et il est donc gardé.
        //
        // **La classe n'est posée que quand le bouton est ALLUMÉ** : éteint, il
        // est creux et gris, et le voile de l'appui n'aurait rien à éclaircir.
        className={`block w-full rounded-full py-[15px] text-center text-[16px] ${
          rien || refus ? "" : "atlas-plein"
        }`}
        style={{
          backgroundColor: rien || refus ? colors.card : colors.plein,
          color: rien || refus ? colors.muted : colors.cream,
          boxShadow: rien || refus ? `inset 0 0 0 1px ${colors.line}` : "none",
        }}
      >
        {enCours ? "Enregistrement…" : refus ? refus : rien ? "Enregistré ✓" : "Enregistrer"}
      </button>
    </div>
  );
}
