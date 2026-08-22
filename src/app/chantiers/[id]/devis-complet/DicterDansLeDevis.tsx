"use client";

import { useEffect, useRef, useState } from "react";
import { colors, font, libelleCaps } from "@/lib/design-tokens";
import BottomSheet from "@/components/atlas/BottomSheet";
import PointsQuiSoufflent from "@/components/atlas/PointsQuiSoufflent";
import PrimaryButton from "@/components/atlas/PrimaryButton";
import {
  etapeAttente,
  phraseAttente,
  SEUIL_ABANDON_MS,
  SEUIL_LONGUE_MS,
  type EtapeAttente,
} from "@/lib/attente-longue";
import { changementApplicable, direRetouche, type Changement, type RetoucheResolue } from "@/lib/retouches-devis";
import { dicterRetouchesDevisAction } from "./actions";

/**
 * Le micro du devis — en haut à droite, comme sur la fiche du client.
 *
 * Le patron, le 15 août 2026 : *« Rajoutes-moi un petit dictaphone en haut à
 * droite comme il y a pour les infos clients quand tu fais un nouveau chantier,
 * pour pouvoir dicter à l'intérieur du devis s'il y a des choses à reprendre ou
 * à modifier. Et je veux que tu mettes exactement les mêmes trois petits points
 * quand ils chargent, les trois petits points qui soufflent. »*
 *
 * Puis, sur ce qu'il veut pouvoir dire : *« supprime-moi la deuxième ligne,
 * modifie-moi le prix de la taille de haie, remplace-moi le deux cent cinquante
 * par trois cent cinquante, rajoute-moi une ligne, broyage des branches et tu
 * mets cinq cents euros […] Je vais pouvoir lui parler comme ça et qu'elle
 * comprenne. »*
 *
 * **Elle propose, il coche** — proposition A de
 * `docs/maquettes/54-dicter-dans-le-devis.html`. Rien ne bouge sur le devis
 * avant son appui, et il décoche ce qui ne va pas. Ces lignes SONT le document
 * que son client recevra : une lecture qui se trompe d'un chiffre coûte un
 * avoir (`CLAUDE.md` §4).
 *
 * **Le dessin est repris tel quel de `DicterCoordonnees`** — 44 px, le même
 * rond discret, l'alerte pendant qu'il parle, les points qui soufflent pendant
 * le traitement. C'est ce qu'il a demandé mot pour mot, et c'est aussi la règle
 * : deux micros différents dans la même application se liraient comme deux
 * fonctions différentes.
 */
export default function DicterDansLeDevis({
  chantierId,
  onApplique,
}: {
  chantierId: string;
  /** Les changements cochés, à appliquer. Rend les lignes telles qu'elles sont après coup. */
  onApplique: (changements: Changement[]) => Promise<void>;
}) {
  const [etat, setEtat] = useState<"repos" | "enregistre" | "traite">("repos");
  const [message, setMessage] = useState<string | null>(null);
  const [attente, setAttente] = useState<EtapeAttente>("normale");
  const [propositions, setPropositions] = useState<RetoucheResolue[] | null>(null);
  const [transcription, setTranscription] = useState("");
  const [ecartees, setEcartees] = useState<Set<number>>(new Set());
  const [applique, setApplique] = useState(false);
  const recorder = useRef<MediaRecorder | null>(null);
  const morceaux = useRef<Blob[]>([]);

  // L'attente qui s'éternise se raconte, exactement comme sur la fiche du
  // client : deux réveils plutôt qu'une horloge, et la règle vit dans
  // `attente-longue.ts` — l'écran affiche, il ne décide pas.
  useEffect(() => {
    if (etat !== "traite") return;
    const debut = Date.now();
    const relire = () => setAttente(etapeAttente(Date.now() - debut));
    const longue = setTimeout(relire, SEUIL_LONGUE_MS);
    const abandon = setTimeout(relire, SEUIL_ABANDON_MS);
    return () => {
      clearTimeout(longue);
      clearTimeout(abandon);
    };
  }, [etat]);

  /** Le numéro de la dictée en cours — une réponse en retard ne touche plus l'écran. */
  const tour = useRef(0);

  async function demarrer() {
    setMessage(null);
    setAttente("normale");
    tour.current += 1;
    try {
      const flux = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(flux);
      morceaux.current = [];
      mr.ondataavailable = (e) => {
        if (e.data.size > 0) morceaux.current.push(e.data);
      };
      mr.onstop = async () => {
        // Sans cela, le voyant du micro reste allumé sur le téléphone et l'on
        // croit être encore écouté.
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
    const actuelle = () => tour.current === mien;
    try {
      const fd = new FormData();
      fd.set("fichier", new File([blob], "dictee.webm", { type: blob.type || "audio/webm" }));
      const r = await dicterRetouchesDevisAction(chantierId, fd);
      if (!actuelle()) return;
      if (!r.ok) {
        setMessage(
          r.raison === "vide"
            ? "Rien n'a été entendu. Réessayez en parlant un peu plus près du téléphone."
            : r.raison === "simulee"
              ? // **Ne jamais présenter le texte de remplacement comme une dictée.**
                // Sans service de transcription, ce qui revient n'est pas ce
                // qu'il a dit — et un devis ne se corrige pas d'après une phrase
                // que personne n'a prononcée.
                "Aucun service de transcription n'est branché sur cette installation : votre dictée n'a pas pu être lue."
              : "La dictée n'a pas pu être transcrite. Vous pouvez corriger le devis à la main."
        );
        return;
      }
      setTranscription(r.transcription);
      setEcartees(new Set());
      setApplique(false);
      if (!r.comprises) {
        // **Le modèle n'a pas répondu : on montre ce qu'il a dit, sans rien
        // proposer.** Deviner des changements sans lui reviendrait à toucher aux
        // prix d'un devis au petit bonheur.
        setPropositions([]);
        return;
      }
      if (r.retouches.length === 0) {
        setMessage("Aucun changement n'a été compris dans ce que vous avez dit. Le devis n'a pas bougé.");
        return;
      }
      setPropositions(r.retouches);
    } catch {
      if (actuelle()) setMessage("La dictée n'a pas abouti. Vous pouvez corriger le devis à la main.");
    } finally {
      if (actuelle()) setEtat("repos");
    }
  }

  /**
   * Ce qui partira si le patron appuie.
   *
   * **La même fonction sert à l'affichage et à l'envoi** (`CLAUDE.md` §3) :
   * `changementApplicable` décide de ce qui est cochable, et c'est exactement
   * ce qui est appliqué. Une ligne montrée comme cochable qu'un second calcul
   * refuserait ensuite serait le pire des deux mondes.
   */
  const retenus = (propositions ?? [])
    .map((r, i) => ({ i, c: changementApplicable(r) }))
    .filter((x) => x.c !== null && !ecartees.has(x.i))
    .map((x) => x.c as Changement);

  async function appliquer() {
    setApplique(true);
    try {
      await onApplique(retenus);
      setPropositions(null);
      setMessage(
        retenus.length === 1 ? "Un changement appliqué." : `${retenus.length} changements appliqués.`
      );
    } catch {
      setMessage("Les changements n'ont pas pu être enregistrés. Le devis n'a pas bougé.");
      setPropositions(null);
    } finally {
      setApplique(false);
    }
  }

  const enCours = etat === "enregistre";
  const rendu = etat === "traite" && attente === "abandonnee";
  const travaille = etat === "traite" && !rendu;

  return (
    <div className="flex flex-col items-end">
      <button
        type="button"
        onClick={enCours ? arreter : demarrer}
        disabled={travaille}
        aria-label={
          enCours ? "Arrêter la dictée" : travaille ? "Atlas reprend ce que vous avez dit" : "Dicter dans le devis"
        }
        className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full"
        style={{
          // **Le rond est `card` ici, et `rustTint` sur la fiche du client.**
          // Ce n'est pas une seconde façon de dessiner le micro : c'est le même
          // rond sur un autre fond. Cette page-ci est teintée (`rustTint`), et
          // un rond `rustTint` sur un fond `rustTint` disparaît purement et
          // simplement — vu à la capture, jamais à la mesure. La maquette 54 le
          // montrait posé sur la page, et c'est ce qu'il a validé.
          backgroundColor: enCours ? colors.alert : colors.card,
          color: enCours ? "#FFFFFF" : colors.rust,
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

      {/* L'écran se taisait exactement pendant le seul moment où l'on se demande
          s'il est en panne. `role="status"` le dit à qui n'a pas les yeux
          dessus ; les points, décoratifs, se taisent. */}
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

      <FeuilleRetouches
        propositions={propositions}
        transcription={transcription}
        ecartees={ecartees}
        onBasculer={(i) =>
          setEcartees((cur) => {
            const suivant = new Set(cur);
            if (suivant.has(i)) suivant.delete(i);
            else suivant.add(i);
            return suivant;
          })
        }
        nombreRetenu={retenus.length}
        enCours={applique}
        onAppliquer={appliquer}
        onFermer={() => setPropositions(null)}
      />
    </div>
  );
}

/**
 * Ce qu'Atlas a compris, avant que rien ne bouge.
 *
 * **Chaque proposition se décoche.** C'est le prix de la proposition A, et il
 * est assumé : une lecture qui se trompe sur un chiffre coûte cher, donc rien
 * ne s'applique sans un regard.
 *
 * **Ce qui n'a pas su tomber sur une ligne reste affiché, barré.** Le cacher
 * ferait croire qu'on n'a pas entendu la phrase ; le montrer dit précisément ce
 * qui manque — un nom qui ne correspond à rien, ou deux lignes qui se
 * ressemblent trop.
 */
function FeuilleRetouches({
  propositions,
  transcription,
  ecartees,
  onBasculer,
  nombreRetenu,
  enCours,
  onAppliquer,
  onFermer,
}: {
  propositions: RetoucheResolue[] | null;
  transcription: string;
  ecartees: Set<number>;
  onBasculer: (i: number) => void;
  nombreRetenu: number;
  enCours: boolean;
  onAppliquer: () => void;
  onFermer: () => void;
}) {
  if (!propositions) return null;

  return (
    <BottomSheet open onBackdropClick={onFermer}>
      <p className={`mb-1 text-center ${libelleCaps}`} style={{ color: colors.or }}>
        Ce qu’Atlas a compris
      </p>
      <p
        className="text-center"
        style={{ fontFamily: font.display, fontSize: 21, lineHeight: 1.24, color: colors.ink }}
      >
        {propositions.length === 0
          ? "Rien n’a été proposé"
          : propositions.length === 1
            ? "Un changement"
            : `${propositions.length} changements`}
      </p>

      {transcription && (
        <p className="mt-2 text-center text-[12.5px] italic leading-snug" style={{ color: colors.muted }}>
          « {transcription} »
        </p>
      )}

      <div className="my-4 h-px" style={{ backgroundColor: colors.lineSoft }} />

      {propositions.length === 0 && (
        <p className="mb-2 text-[13px] leading-relaxed" style={{ color: colors.muted }}>
          Votre dictée a été recopiée, mais aucun changement n’a pu en être tiré. Le devis n’a pas bougé —
          corrigez les lignes à la main en relisant ce que vous avez dit.
        </p>
      )}

      {propositions.map((r, i) => {
        const dit = direRetouche(r);
        const applicable = changementApplicable(r) !== null;
        const retenu = applicable && !ecartees.has(i);
        return (
          <button
            key={i}
            type="button"
            aria-pressed={retenu}
            disabled={!applicable || enCours}
            onClick={() => onBasculer(i)}
            className="flex w-full items-start justify-between gap-3 border-b py-[13px] text-left"
            style={{ borderColor: colors.line, opacity: applicable ? 1 : 0.66 }}
          >
            <span className="flex min-w-0 flex-col gap-[3px]">
              {/* Verbe, ligne, détail : chacun sur sa ligne. Côte à côte, ils se
                  lisaient comme une seule phrase et l'on ne voyait plus où
                  s'arrêtait le nom de la prestation. */}
              <span className={libelleCaps} style={{ color: applicable ? colors.or : colors.alert }}>
                {dit.verbe}
              </span>
              <span style={{ fontFamily: font.display, fontSize: 16.5, lineHeight: 1.22 }}>{dit.quoi}</span>
              <span
                className="text-[12px] leading-snug"
                style={{ color: r.etat === "ok" && estSansPrix(r) ? colors.alert : colors.muted }}
              >
                {dit.detail}
              </span>
            </span>
            <span
              aria-hidden="true"
              className="pt-[2px] text-[15px]"
              style={{ color: colors.or, opacity: retenu ? 1 : 0 }}
            >
              ✓
            </span>
          </button>
        );
      })}

      {nombreRetenu > 0 && (
        <div className="mt-5">
          <PrimaryButton onClick={onAppliquer} disabled={enCours} repere="appliquer-retouches">
            {nombreRetenu === 1 ? "Appliquer ce changement" : `Appliquer les ${nombreRetenu} changements`}
          </PrimaryButton>
        </div>
      )}

      <button
        type="button"
        onClick={onFermer}
        disabled={enCours}
        className="mt-1.5 w-full py-[13px] text-[15px]"
        style={{ color: colors.muted }}
      >
        Ne rien changer
      </button>
    </BottomSheet>
  );
}

/** Un ajout dicté sans montant : la ligne arrivera vide, et ça se voit en rouge. */
function estSansPrix(r: RetoucheResolue): boolean {
  return r.retouche.type === "ajouter" && r.retouche.prixUnitaire === null;
}
