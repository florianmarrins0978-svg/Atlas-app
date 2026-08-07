"use client";

import { useRef, useState } from "react";
import { colors } from "@/lib/design-tokens";
import type { CoordonneesDictees } from "@/lib/coordonnees-dictees";
import { dicterCoordonneesAction } from "./actions";

/**
 * Le micro discret, à droite du titre « Un chantier ».
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
 */
export default function DicterCoordonnees({
  onCoordonnees,
}: {
  onCoordonnees: (c: CoordonneesDictees) => void;
}) {
  const [etat, setEtat] = useState<"repos" | "enregistre" | "traite">("repos");
  const [message, setMessage] = useState<string | null>(null);
  const recorder = useRef<MediaRecorder | null>(null);
  const morceaux = useRef<Blob[]>([]);

  async function demarrer() {
    setMessage(null);
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
    setEtat("traite");
  }

  async function envoyer(blob: Blob) {
    try {
      const fd = new FormData();
      fd.set("fichier", new File([blob], "dictee.webm", { type: blob.type || "audio/webm" }));
      const r = await dicterCoordonneesAction(fd);
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
      setMessage("La dictée n'a pas abouti. Vous pouvez saisir les informations à la main.");
    } finally {
      setEtat("repos");
    }
  }

  const enCours = etat === "enregistre";

  return (
    <div className="flex flex-col items-end">
      <button
        type="button"
        onClick={enCours ? arreter : demarrer}
        disabled={etat === "traite"}
        aria-label={enCours ? "Arrêter la dictée" : "Dicter les informations du client"}
        className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full"
        style={{
          backgroundColor: enCours ? colors.alert : colors.rustTint,
          color: enCours ? "#FFFFFF" : colors.rust,
          opacity: etat === "traite" ? 0.5 : 1,
        }}
      >
        {etat === "traite" ? (
          <span className="text-[11px] font-semibold">…</span>
        ) : (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9">
            <rect x="9" y="3" width="6" height="11" rx="3" />
            <path d="M5 11a7 7 0 0 0 14 0" strokeLinecap="round" />
            <path d="M12 18v3" strokeLinecap="round" />
          </svg>
        )}
      </button>
      {(enCours || message) && (
        <p className="mt-2 max-w-[190px] text-right text-[12px] leading-snug" style={{ color: colors.muted }}>
          {enCours ? "J'écoute — touchez pour arrêter." : message}
        </p>
      )}
    </div>
  );
}
