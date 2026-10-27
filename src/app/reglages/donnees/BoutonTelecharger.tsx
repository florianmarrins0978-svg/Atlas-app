"use client";

import { useRef, useState } from "react";
import { colors, surPlein } from "@/lib/design-tokens";
import ActionBas from "@/components/atlas/reglages/ActionBas";
import DemanderPreuve from "@/components/atlas/DemanderPreuve";
import { preuveDejaRecenteAction } from "@/app/reglages/connexion/preuve-actions";
import { messagePreuveExigee, GESTES_SENSIBLES } from "@/lib/preuve-recente";
import Picto from "@/components/atlas/reglages/Picto";

/**
 * « Télécharger mes données » — et la vérification d'identité qui le précède.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * **POURQUOI CE BOUTON N'EST PLUS UN SIMPLE LIEN.**
 *
 * `/api/mes-donnees` exige désormais une identité récente (M11) : ce fichier
 * contient toute l'entreprise — clients, prix, factures, photos —, et une
 * session volée ne doit pas suffire à l'emporter.
 *
 * Un lien nu resterait un lien : le navigateur recevrait un refus du serveur et
 * **n'afficherait rien**. Le patron appuierait trois fois, sans savoir. On
 * demande donc l'identité AVANT d'ouvrir l'adresse.
 *
 * **La garde n'est pas ici.** Elle est dans la route, côté serveur, et elle
 * refuse même si l'on ouvre l'adresse à la main. Ce composant évite seulement un
 * refus muet.
 */
export default function BoutonTelecharger({ nomFichier }: { nomFichier: string }) {
  const lien = useRef<HTMLAnchorElement | null>(null);
  const [demande, setDemande] = useState(false);
  const [enCours, setEnCours] = useState(false);

  /**
   * **On garde un VRAI lien, et on ne fait que retenir son appui.**
   *
   * Un bouton et un `window.location.href` perdraient l'attribut `download`,
   * que le dépôt a posé exprès : sans lui, le repli de Safari nomme le fichier
   * d'après l'adresse de la page — « donnees », sans extension, impossible à
   * ouvrir sur un téléphone. Une sauvegarde qui ne s'ouvre pas ne sauvegarde
   * rien (`src/lib/nom-sauvegarde.ts`).
   *
   * Le lien reste donc le lien. On intercepte l'appui le temps de vérifier
   * l'identité, puis on le laisse partir.
   */
  function laisserPartir() {
    // `click()` sur l'ancre elle-même : le navigateur honore alors `download`
    // exactement comme si le doigt l'avait touchée.
    const a = lien.current;
    if (!a) return;
    a.dataset.autorise = "1";
    a.click();
    delete a.dataset.autorise;
  }

  async function auClic(e: React.MouseEvent<HTMLAnchorElement>) {
    if (e.currentTarget.dataset.autorise === "1") return; // notre propre appui
    e.preventDefault();
    setEnCours(true);
    try {
      if (await preuveDejaRecenteAction()) {
        laisserPartir();
        return;
      }
      setDemande(true);
    } finally {
      setEnCours(false);
    }
  }

  return (
    <>
      {/* **La vérification reste HORS de `ActionBas`.** Posée dedans, sa
          feuille hériterait du plan de la colonne fixe (z-10) et passerait
          SOUS la barre du bas (z-20) : le bouton « Continuer » serait couvert,
          et le fichier ne partirait jamais. */}
      <ActionBas>
        <a
          ref={lien}
          href="/api/mes-donnees"
          download={nomFichier}
          onClick={auClic}
          data-atlas="telecharger-mes-donnees"
          className="atlas-plein flex min-h-[56px] w-full items-center justify-center gap-2.5 rounded-full px-[22px] text-[17px] font-semibold no-underline"
          // **`surPlein`, et non `colors.cream`** : sur Nuit et Sylve le vert
          // `plein` devient clair et la crème devient sombre, le mot se
          // perdait dans son bouton (`CLAUDE.md` §3, sept chartes dont deux
          // sombres). `surPlein` est ce qui se pose SUR un aplat, partout.
          style={{ backgroundColor: colors.plein, color: surPlein }}
        >
          <Picto nom="telecharger" />
          {enCours ? "Un instant…" : "Télécharger mes données"}
        </a>
      </ActionBas>

      <DemanderPreuve
        ouvert={demande}
        motif={messagePreuveExigee(GESTES_SENSIBLES.exportComplet)}
        onAbandon={() => setDemande(false)}
        onProuve={() => {
          setDemande(false);
          laisserPartir();
        }}
      />
    </>
  );
}
