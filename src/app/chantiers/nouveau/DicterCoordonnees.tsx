"use client";

import { useEffect, useRef, useState } from "react";
import { colors, surPlein } from "@/lib/design-tokens";
import PointsQuiSoufflent from "@/components/atlas/PointsQuiSoufflent";
import {
  etapeAttente,
  phraseAttente,
  SEUIL_ABANDON_MS,
  SEUIL_LONGUE_MS,
  type EtapeAttente,
} from "@/lib/attente-longue";
import type { CoordonneesDictees } from "@/lib/coordonnees-dictees";
import { dicterCoordonneesAction } from "./actions";

/**
 * Le micro discret, à droite du titre « Fiche client » (« Un chantier » jusqu'au
 * 16 août 2026).
 *
 * Le patron, le 7 août 2026 : *« à côté de "Un chantier", à droite, je veux une
 * petite touche discrète, juste le signe de la note vocale, pour que je puisse
 * appuyer dessus et parler pour remplir les infos du client si j'ai pas envie
 * de les écrire. »*
 *
 * **Discrète** : le même rond que le bouton de retour, sans libellé. Ce n'est
 * pas l'action principale de l'écran — c'est un raccourci pour qui a les mains
 * prises. Un bouton plein aurait donné l'impression qu'il faut dicter.
 *
 * **Elle remplit, elle ne valide pas.** Les champs se posent dans le
 * formulaire ; le patron les relit et corrige avant de créer le chantier. Un
 * nom mal entendu qui partirait directement sur un devis serait pire que dix
 * secondes de saisie (`CLAUDE.md` §4).
 *
 * **Elle n'écrase jamais ce qui est déjà écrit.** Si le téléphone est saisi et
 * que la dictée n'en dit rien, il reste. Si la dictée en donne un et que le
 * champ est vide, il se remplit. Perdre une saisie parce qu'on a dicté ensuite
 * serait la pire façon d'aider.
 *
 * **L'ATTENTE, refaite le 13 août 2026.** Il avait signalé : *« une fois qu'on a
 * appuyé sur le dictaphone, on ne sait pas ce qui se passe. Les trois petits
 * points sont fixes […] on ne sait pas si ça bug ou non. »* Ce n'était pas une
 * animation arrêtée — c'était le caractère « … », un seul glyphe : il n'y avait
 * rien qui pût bouger.
 *
 * Trois choses ont changé au même endroit, et **elles ne se remplacent pas** :
 *
 * 1. les points **soufflent** — proposition C de
 *    `docs/maquettes/43-l-attente-a-lessai.html`, qu'il a désignée ;
 * 2. le bouton **reste à pleine encre**. Le demi-effacement d'avant était le
 *    vocabulaire d'un bouton éteint ;
 * 3. **une phrase le dit en toutes lettres.** C'est la seule des trois qui
 *    parvient à qui n'a pas les yeux sur l'écran, et probablement la plus utile
 *    des trois : l'écran se taisait pendant le seul moment où l'on se demande
 *    s'il est en panne.
 *
 * `scripts/test-attente-dictee-e2e.ts` mesure le souffle et exige la phrase.
 */
export default function DicterCoordonnees({
  onCoordonnees,
}: {
  onCoordonnees: (c: CoordonneesDictees) => void;
}) {
  const [etat, setEtat] = useState<"repos" | "enregistre" | "traite">("repos");
  const [message, setMessage] = useState<string | null>(null);
  const [attente, setAttente] = useState<EtapeAttente>("normale");
  const recorder = useRef<MediaRecorder | null>(null);
  const morceaux = useRef<Blob[]>([]);

  /**
   * L'attente qui s'éternise se raconte, au lieu de souffler indéfiniment.
   *
   * Deux réveils plutôt qu'une horloge qui tourne : on n'a besoin de rien
   * savoir entre les deux, et un compteur qui bat toutes les secondes ferait
   * repeindre l'écran cinquante fois pour changer deux phrases.
   *
   * Les seuils et les phrases vivent dans `src/lib/attente-longue.ts` — l'écran
   * affiche, il ne décide pas.
   */
  useEffect(() => {
    if (etat !== "traite") return;
    const debut = Date.now();
    // **On relit le temps ÉCOULÉ, on ne pose pas l'étape en dur.** Un téléphone
    // qui s'endort étire ses minuteries : le réveil des douze secondes peut
    // tomber à la cinquantième. Poser « longue » à ce moment-là annoncerait
    // « c'est plus long que d'habitude » alors qu'il faudrait déjà rendre la
    // main. La règle vit dans `attente-longue.ts` et tranche sur la durée
    // réelle, jamais sur celle qu'on espérait.
    const relire = () => setAttente(etapeAttente(Date.now() - debut));
    const longue = setTimeout(relire, SEUIL_LONGUE_MS);
    const abandon = setTimeout(relire, SEUIL_ABANDON_MS);
    return () => {
      clearTimeout(longue);
      clearTimeout(abandon);
    };
  }, [etat]);

  /**
   * Le numéro de la dictée en cours.
   *
   * **Il naît du renoncement.** Tant que l'écran restait bloqué jusqu'à la
   * réponse, une seule dictée pouvait exister. Depuis qu'il rend la main au
   * bout de quarante-cinq secondes, le patron peut redicter pendant que la
   * PREMIÈRE court encore — et celle-ci, en revenant, remettrait l'écran au
   * repos en plein milieu du nouvel enregistrement.
   *
   * Une réponse ne touche donc à l'écran que si elle est encore celle qu'on
   * attend. Si personne n'a redicté, la vieille réponse s'applique — c'est
   * voulu : elle ne remplit que les champs restés vides, et jeter un travail
   * qui a fini d'aboutir serait le gaspiller pour rien.
   */
  const tour = useRef(0);

  async function demarrer() {
    setMessage(null);
    setAttente("normale");
    // Toute dictée encore en vol cesse d'être celle qu'on attend.
    tour.current += 1;
    try {
      const flux = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(flux);
      morceaux.current = [];
      mr.ondataavailable = (e) => {
        if (e.data.size > 0) morceaux.current.push(e.data);
      };
      mr.onstop = async () => {
        // La piste est relâchée dès l'arrêt : sans cela, le voyant du micro
        // reste allumé sur le téléphone, et on croit être encore écouté.
        flux.getTracks().forEach((t) => t.stop());
        await envoyer(new Blob(morceaux.current, { type: mr.mimeType || "audio/webm" }));
      };
      mr.start();
      recorder.current = mr;
      setEtat("enregistre");
    } catch {
      setMessage("Le micro n'est pas accessible. Vérifiez l'autorisation dans votre navigateur.");
      setEtat("repos");
    }
  }

  function arreter() {
    recorder.current?.stop();
    recorder.current = null;
    setAttente("normale");
    setEtat("traite");
  }

  async function envoyer(blob: Blob) {
    const mien = tour.current;
    /** Cette réponse-ci est-elle encore celle que l'écran attend ? */
    const actuelle = () => tour.current === mien;
    try {
      const fd = new FormData();
      fd.set("fichier", new File([blob], "dictee.webm", { type: blob.type || "audio/webm" }));
      const r = await dicterCoordonneesAction(fd);
      if (!actuelle()) return;
      if (!r.ok) {
        setMessage(
          r.raison === "vide"
            ? "Rien n'a été entendu. Réessayez en parlant un peu plus près du téléphone."
            : "La dictée n'a pas pu être transcrite. Vous pouvez saisir les informations à la main."
        );
        return;
      }
      onCoordonnees(r.coordonnees);
      const remplis = Object.values(r.coordonnees).filter(Boolean).length;
      setMessage(
        remplis === 0
          ? "Aucune coordonnée reconnue dans ce que vous avez dit. Rien n'a été rempli."
          : `${remplis} information${remplis > 1 ? "s" : ""} reprise${remplis > 1 ? "s" : ""} — relisez avant de créer.`
      );
    } catch {
      if (actuelle()) {
        setMessage("La dictée n'a pas abouti. Vous pouvez saisir les informations à la main.");
      }
    } finally {
      // Remettre l'écran au repos alors qu'une NOUVELLE dictée enregistre
      // couperait celle-ci en plein milieu : c'est le seul dégât que la
      // réponse en retard puisse faire, et il est évité ici.
      if (actuelle()) setEtat("repos");
    }
  }

  const enCours = etat === "enregistre";

  /**
   * L'écran a renoncé : il rend le micro, et le bouton se presse à nouveau.
   *
   * L'appel, lui, n'est pas interrompu — on ne ferme pas la porte, on rend le
   * geste. S'il finit par répondre et que personne n'a redicté entre-temps, les
   * champs vides se remplissent et l'écran le dit.
   */
  const rendu = etat === "traite" && attente === "abandonnee";
  const travaille = etat === "traite" && !rendu;

  return (
    <div className="flex flex-col items-end">
      <button
        type="button"
        onClick={enCours ? arreter : demarrer}
        disabled={travaille}
        aria-label={
          enCours
            ? "Arrêter la dictée"
            : travaille
              ? "Atlas reprend ce que vous avez dit"
              : "Dicter les informations du client"
        }
        className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full"
        style={{
          // **PLUS D'APLAT AU REPOS — planche « A — Épurée », 2 septembre
          // 2026.** Deux micros vivaient sur cet écran, celui-ci pour les
          // coordonnées et l'anneau pour le chantier, et rien ne les
          // distinguait qu'une taille. Depuis que l'anneau est une tasse, le
          // rond beige d'ici lui répondait comme un second objet plein. Il ne
          // garde qu'un filet : sa fonction n'a pas changé, son rang si.
          //
          // **Il redevient plein pendant qu'il écoute**, et c'est la même
          // règle qu'ailleurs : ce qui est EN TRAIN de se faire porte l'aplat.
          backgroundColor: enCours ? colors.alert : "transparent",
          boxShadow: enCours ? undefined : `inset 0 0 0 1px ${colors.line}`,
          color: enCours ? surPlein : colors.rust,
          // **Pas de demi-effacement pendant le traitement.** Il y en avait un,
          // et c'était la moitié du défaut signalé le 13 août : un bouton à
          // moitié effacé, c'est le vocabulaire d'un bouton ÉTEINT, pas d'un
          // bouton qui travaille. L'écran disait « rien ne se passe » deux fois
          // — par les points immobiles, et par là. Il ne se presse toujours pas
          // (`disabled`), mais il n'a plus l'air mort.
        }}
      >
        {travaille ? (
          <PointsQuiSoufflent />
        ) : (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9">
            <rect x="9" y="3" width="6" height="11" rx="3" />
            <path d="M5 11a7 7 0 0 0 14 0" strokeLinecap="round" />
            <path d="M12 18v3" strokeLinecap="round" />
          </svg>
        )}
      </button>
      {/*
        **La phrase du traitement est la moitié du correctif, et peut-être la
        plus utile.** L'écran parlait quand il écoutait et quand il avait fini,
        et il se taisait exactement pendant le seul moment où l'on se demande
        s'il est en panne. Aucune animation ne dit ce que des mots disent.

        `role="status"` : le changement est annoncé à qui n'a pas les yeux sur
        l'écran. Les points, eux, sont décoratifs et se taisent.
      */}
      {(enCours || etat === "traite" || message) && (
        <p
          role="status"
          className="mt-2 max-w-[190px] text-right text-[12px] leading-snug"
          style={{ color: colors.muted }}
        >
          {enCours
            ? "J'écoute — touchez pour arrêter."
            : etat === "traite"
              ? phraseAttente(attente)
              : message}
        </p>
      )}
    </div>
  );
}
