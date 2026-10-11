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
 * **LE MOT A CHANGÉ LE 9 SEPTEMBRE 2026, et c'est lui qui l'a entendu :**
 * *« la phrase "Refaire", c'est pas bizarre ? ça sonne bizarre »*. Il avait
 * raison — « Refaire » se lit comme « recommencer parce que c'était raté ».
 * C'est **« Dernier devis »**, avec la flèche qui tourne.
 *
 * *Ce qu'on lui a dit et qui reste vrai* : le mot peut se lire « ouvrir mon
 * dernier devis », alors qu'il en crée un neuf. La flèche circulaire porte le
 * « de nouveau », et l'écran suivant est un devis vide de tout numéro — il n'y
 * a pas d'ambiguïté qui survive au premier usage.
 *
 * *« Dernier devis »* repart de ce qu'on lui a fait la dernière fois ; *« Autre
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
 * **LE MOT « NOUVEAU DEVIS » EST LE SIEN, depuis le 26 septembre 2026** :
 * *« faut l'appeler nouveau devis, pas autre chantier ? »*. Ce qu'il veut en
 * appuyant, c'est un devis ; le chantier n'est que le chemin. Et à côté de
 * « Dernier devis », l'opposition se lit sans rien expliquer. Le geste, lui,
 * n'a pas bougé : il ouvre la fiche d'un chantier vierge.
 *
 * **« Dernier devis » porte l'aplat, « Nouveau devis » est creux.** Neuf fois sur
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
 * « Dernier devis », lui, crée pour de bon : reprendre un devis n'a de sens que si le
 * devis existe, et c'est un geste qu'on ne fait pas par erreur.
 */
export default function RepartirDeCeClient({
  clientId,
  dernierChantierId,
}: {
  clientId: string;
  /**
   * Le chantier du DERNIER DEVIS de ce client — absent s’il n’en a aucun.
   *
   * **Ce n’était pas ça jusqu’au 9 septembre 2026, et il l’a vu sur sa propre
   * fiche** : le bouton tenait au dernier chantier TERMINÉ. Julien portait un
   * devis du 7 septembre et le bouton n’était pas là — un devis envoyé n’est
   * pas un chantier fini, et la plupart de ses clients n’en ont aucun. Le
   * geste était donc invisible chez presque tout le monde.
   */
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
    <div className="px-4 pt-5">
      {/* **TROIS GESTES SUR UNE SEULE RANGÉE** — sa demande du 26 septembre
          2026, planche 129 : *« le contrat d'entretien à côté de Autre
          chantier, et que tout rentre sur une seule ligne »*. Chacun prend un
          tiers et son libellé passe sur deux lignes, mesuré sans débordement
          à 390 et 360 px. L'espace entre les deux mots reste dans le texte :
          c'est lui qui garde « Dernier devis » comme nom du bouton. */}
      <div className="flex gap-1.5">
        {dernierChantierId && (
          <button
            type="button"
            onClick={refaire}
            disabled={enCours}
            className="flex h-14 min-w-0 flex-1 basis-0 items-center justify-center gap-1.5 rounded-full px-2 text-left text-[14.5px] leading-[1.15] disabled:opacity-70"
            style={{ backgroundColor: colors.plein, color: surPlein, fontFamily: font.display }}
          >
            <svg className="flex-none" width="17" height="17" viewBox="0 0 18 18" fill="none" aria-hidden="true">
              <path
                d="M15.2 9a6.2 6.2 0 1 1-1.9-4.5M15.2 2.4V6h-3.6"
                stroke="currentColor"
                strokeWidth="1.7"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            {enCours ? "Un instant" : <DeuxLignes libelle="Dernier devis" />}
          </button>
        )}
        <button
          type="button"
          onClick={() => router.push(`/chantiers/nouveau?client=${clientId}`)}
          className={CREUX}
          style={{
            color: colors.orTexte,
            boxShadow: `inset 0 0 0 1px ${colors.orTexte}`,
          }}
        >
          <svg className="flex-none" width="16" height="16" viewBox="0 0 18 18" fill="none" aria-hidden="true">
            <path d="M9 3.4v11.2M3.4 9h11.2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
          <DeuxLignes libelle="Nouveau devis" />
        </button>
        <button
          type="button"
          onClick={() => router.push(`/clients/${clientId}/contrat`)}
          className={CREUX}
          style={{
            color: colors.orTexte,
            boxShadow: `inset 0 0 0 1px ${colors.orTexte}`,
          }}
          data-atlas="geste-contrat"
        >
          <svg className="flex-none" width="16" height="16" viewBox="0 0 18 18" fill="none" aria-hidden="true">
            <rect x="2.6" y="3.6" width="12.8" height="11.6" rx="2" stroke="currentColor" strokeWidth="1.6" />
            <path d="M2.6 7.4h12.8M6.2 2.2v2.8M11.8 2.2v2.8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          </svg>
          <DeuxLignes libelle="Contrat d’entretien" />
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

const CREUX =
  "flex h-14 min-w-0 flex-1 basis-0 items-center justify-center gap-1.5 rounded-full px-2 text-left text-[13.5px] leading-[1.15]";

/**
 * Un libellé sur deux lignes, coupé après son premier mot. **Il s'écrit
 * entier** : c'est ce nom que lisent les lecteurs d'écran, et que le mode
 * d'emploi retrouve dans ce fichier pour prouver que le geste existe
 * (`test-mode-emploi`).
 */
function DeuxLignes({ libelle }: { libelle: string }) {
  const coupure = libelle.indexOf(" ");
  if (coupure < 0) return <span className="min-w-0">{libelle}</span>;
  return (
    <span className="min-w-0">
      {libelle.slice(0, coupure)} <span className="block">{libelle.slice(coupure + 1)}</span>
    </span>
  );
}
