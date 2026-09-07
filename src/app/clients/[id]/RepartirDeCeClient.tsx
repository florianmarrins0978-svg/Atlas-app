"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { colors, font, surPlein } from "@/lib/design-tokens";
import { refaireLeChantierAction } from "./actions";

/**
 * REPARTIR DE CE CLIENT — les deux gestes du lot 1, tranchés le 8 septembre 2026.
 *
 * ───────────────────────────────────────────────────────────────────────────
 * **CE QUE CET ÉCRAN N'AVAIT PAS, ET POURQUOI ÇA MANQUAIT.**
 *
 * La fiche d'un client ne menait nulle part. Le patron croyait donc devoir
 * retaper un client qu'Atlas connaît déjà — alors que `rapprocherClient` le
 * retrouve tout seul depuis le 17 août. **Ce qui manquait n'était pas la règle,
 * c'était le chemin.**
 *
 * **Sa proposition retenue, la E** (`appli/le-client-quon-connait.html`) :
 * *« Refaire »* repart de ce qu'on lui a fait la dernière fois ; *« Autre
 * chantier »* ouvre la fiche client, vierge de prestation mais pleine de ses
 * coordonnées.
 *
 * ───────────────────────────────────────────────────────────────────────────
 * **DEUX GESTES, ET PAS UN MOT DE PLUS.**
 *
 * Cet écran a été vidé le 2 septembre — *« tout le reste, tu enlèves, c'est du
 * trop »*, sa quatrième plainte en dix jours sur le nombre de mots. On y ajoute
 * donc deux boutons et **aucune phrase d'explication** : un bouton n'a pas
 * besoin qu'on décrive ce qu'il fait (`CLAUDE.md` §3).
 *
 * **« Refaire » porte l'aplat, « Autre chantier » est creux.** Neuf fois sur
 * dix il refait la même chose chez le même client ; l'écran doit dire lequel
 * des deux est le geste ordinaire, sinon il faut choisir à chaque fois.
 *
 * ───────────────────────────────────────────────────────────────────────────
 * **POURQUOI « AUTRE CHANTIER » NE CRÉE RIEN TOUT DE SUITE.**
 *
 * Il ouvre `/chantiers/nouveau?client=…`, et le chantier ne naît qu'au premier
 * geste réel — une dictée, une photo, un enregistrement (`assurerChantier`).
 * Créer à l'appui laisserait un chantier fantôme à l'accueil chaque fois qu'il
 * appuie puis change d'avis, et il en verrait la trace le soir sans savoir d'où
 * elle vient.
 *
 * « Refaire », lui, crée pour de bon : reprendre un devis n'a de sens que si le
 * devis existe, et c'est un geste qu'on ne fait pas par erreur.
 */
export default function RepartirDeCeClient({
  clientId,
  dernierChantierId,
}: {
  clientId: string;
  /** Absent : il n'a encore rien fait chez ce client, donc rien à refaire. */
  dernierChantierId: string | null;
}) {
  const router = useRouter();
  const [enCours, demarrer] = useTransition();
  const [refus, setRefus] = useState<string | null>(null);

  function refaire() {
    if (!dernierChantierId) return;
    setRefus(null);
    demarrer(async () => {
      const r = await refaireLeChantierAction(clientId, dernierChantierId);
      if (!r.ok) {
        // **Un refus attendu s'affiche, il ne se perd pas dans un `catch {}`.**
        // Le 11 août 2026, « Impossible d'enregistrer la note » ne pouvait être
        // expliqué par personne, faute d'avoir laissé le refus arriver
        // jusqu'à l'écran (`AGENTS.md`).
        setRefus(r.raison);
        return;
      }
      // **La VRAIE page du devis**, sa règle du 8 septembre : *« si
      // l'utilisateur veut rajouter des lignes, modifier des prix, rajouter une
      // TVA ou faire un prix au client, il peut le faire qu'à partir de la page
      // devis la vraie ! »*
      router.push(`/chantiers/${r.chantierId}/devis-complet`);
    });
  }

  return (
    <div className="px-[26px] pt-5">
      <div className="flex flex-wrap gap-2.5">
        {dernierChantierId && (
          <button
            type="button"
            onClick={refaire}
            disabled={enCours}
            className="flex h-[52px] flex-1 items-center justify-center gap-2.5 rounded-full px-5 text-[16px] disabled:opacity-70"
            style={{ backgroundColor: colors.plein, color: surPlein, fontFamily: font.display }}
          >
            <svg width="17" height="17" viewBox="0 0 18 18" fill="none" aria-hidden="true">
              <path
                d="M15.2 9a6.2 6.2 0 1 1-1.9-4.5M15.2 2.4V6h-3.6"
                stroke="currentColor"
                strokeWidth="1.7"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            {enCours ? "Un instant" : "Refaire"}
          </button>
        )}
        <button
          type="button"
          onClick={() => router.push(`/chantiers/nouveau?client=${clientId}`)}
          className="flex h-[52px] flex-1 items-center justify-center gap-2.5 rounded-full px-5 text-[15px]"
          style={{
            color: colors.orTexte,
            boxShadow: `inset 0 0 0 1px ${colors.orTexte}`,
          }}
        >
          <svg width="16" height="16" viewBox="0 0 18 18" fill="none" aria-hidden="true">
            <path d="M9 3.4v11.2M3.4 9h11.2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
          Autre chantier
        </button>
      </div>

      {refus && (
        <p className="mt-2.5 text-[13px] leading-[1.5]" style={{ color: colors.alert }}>
          {refus}
        </p>
      )}
    </div>
  );
}
