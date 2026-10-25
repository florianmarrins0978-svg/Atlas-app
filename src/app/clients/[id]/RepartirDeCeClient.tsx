"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { colors } from "@/lib/design-tokens";
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
 * **« Dernier devis » se distingue, les deux autres le suivent.** Neuf fois sur
 * dix il refait la même chose chez le même client ; l'écran doit dire lequel
 * des gestes est l'ordinaire, sinon il faut choisir à chaque fois.
 *
 * **PLUS D'ENCADRÉ DEPUIS LE 25 OCTOBRE 2026**, sur sa planche
 * (`appli/soignee/client.html`) : *« pour les boutons, tu m'enlèves les
 * encadrés, tu ne les soulignes pas non plus ; tu les laisses à la même
 * place »*. Ni aplat ni liseré : le dessin au-dessus du mot, le vert des
 * boutons pour « Dernier devis », l'or pour les deux autres. C'est la couleur
 * qui dit lequel est l'ordinaire, et le dessin qui dit qu'on peut appuyer.
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
    <div className="mx-[22px] mt-[14px]">
      {/* **TROIS GESTES SUR UNE SEULE RANGÉE** — sa demande du 26 septembre
          2026, planche 129 : *« le contrat d'entretien à côté de Autre
          chantier, et que tout rentre sur une seule ligne »*. Chacun prend un
          tiers, son dessin au-dessus de son mot ; un mot trop long passe à la
          ligne de lui-même, et seulement lui (sa réponse du 25 octobre, qui a
          refusé les trois mots forcés sur deux lignes). */}
      <div className={`grid gap-2.5 ${dernierChantierId ? "grid-cols-3" : "grid-cols-2"}`}>
        {dernierChantierId && (
          <button
            type="button"
            onClick={refaire}
            disabled={enCours}
            className={GESTE}
            style={{ color: colors.plein }}
          >
            <svg className="flex-none" width="26" height="26" viewBox="0 0 18 18" fill="none" aria-hidden="true">
              <path
                d="M15.2 9a6.2 6.2 0 1 1-1.9-4.5M15.2 2.4V6h-3.6"
                stroke="currentColor"
                strokeWidth="1.3"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            {enCours ? "Un instant" : "Dernier devis"}
          </button>
        )}
        <button
          type="button"
          onClick={() => router.push(`/chantiers/nouveau?client=${clientId}`)}
          className={GESTE}
          style={{ color: colors.or }}
        >
          <svg className="flex-none" width="26" height="26" viewBox="0 0 18 18" fill="none" aria-hidden="true">
            <path d="M9 3.4v11.2M3.4 9h11.2" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
          </svg>
          Nouveau devis
        </button>
        <button
          type="button"
          onClick={() => router.push(`/clients/${clientId}/contrat`)}
          className={GESTE}
          style={{ color: colors.or }}
          data-atlas="geste-contrat"
        >
          <svg className="flex-none" width="26" height="26" viewBox="0 0 18 18" fill="none" aria-hidden="true">
            <rect x="2.6" y="3.6" width="12.8" height="11.6" rx="2" stroke="currentColor" strokeWidth="1.2" />
            <path d="M2.6 7.4h12.8M6.2 2.2v2.8M11.8 2.2v2.8" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
          </svg>
          Contrat d’entretien
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

/**
 * Un geste sans cadre : le dessin au-dessus du mot, centrés, 76 px de haut pour
 * le pouce. Le mot est écrit entier dans le bouton : c'est ce nom que lisent
 * les lecteurs d'écran, et que le mode d'emploi retrouve dans ce fichier pour
 * prouver que le geste existe (`test-mode-emploi`).
 */
const GESTE =
  "flex min-h-[76px] min-w-0 flex-col items-center justify-center gap-[5px] rounded-[14px] px-1.5 py-2 text-center text-[14.5px] font-bold leading-[1.2] disabled:opacity-70";
