"use client";

import { useState, useTransition } from "react";
import { colors, font, libelleCaps, texteSituation } from "@/lib/design-tokens";
import type { EtatDoubleVerification } from "@/server/repositories/double-verification";
import {
  commencerActivationAction,
  confirmerActivationAction,
  desactiverAction,
  type DebutActivationEcran,
} from "./double-verification-actions";

/**
 * LA DOUBLE VÉRIFICATION — `appli/double-verification.html`, onglet 1.
 *
 * Trois étapes : ajouter Atlas à l'appli, taper le premier code, noter les
 * codes de secours. **Rien ne se ferme avant le premier code juste** : une
 * activation abandonnée en route ne laisse personne dehors.
 *
 * **Le téléphone et l'ordinateur ne voient pas la même étape 1**, et c'est sa
 * question du 30 septembre qui l'a imposé : *« comment il clique sur scanner
 * dans l'appli s'il est pas encore dans l'appli ? »*. Depuis le téléphone, on
 * ne scanne pas l'écran qu'on tient : un bouton ouvre l'appli d'authentification
 * (lien `otpauth://`). Depuis un ordinateur, le code carré. La clé à recopier
 * reste affichée dans les deux cas. Ce qui distingue les deux est l'absence de
 * survol (`hover: none`), la marque d'un écran tactile.
 *
 * Utilisée deux fois : sa rubrique de Réglages, et l'écran où le patron est
 * envoyé tant qu'il ne l'a pas activée (`apresActivation` le ramène alors chez
 * lui).
 */
export default function SectionDoubleVerification({
  etatInitial,
  obligatoire,
  apresActivation,
}: {
  etatInitial: EtatDoubleVerification;
  obligatoire: boolean;
  apresActivation?: () => void;
}) {
  const [etat, setEtat] = useState(etatInitial);
  const [etape, setEtape] = useState<0 | 1 | 2 | 3>(0);
  const [debut, setDebut] = useState<Extract<DebutActivationEcran, { ok: true }> | null>(null);
  const [codes, setCodes] = useState<string[]>([]);
  const [notes, setNotes] = useState(false);
  const [desactivation, setDesactivation] = useState(false);
  const [saisie, setSaisie] = useState("");
  const [refus, setRefus] = useState<string | null>(null);
  const [enCours, demarrer] = useTransition();

  function basculer() {
    setRefus(null);
    setSaisie("");
    if (etat.active) {
      if (!obligatoire) setDesactivation((d) => !d);
      return;
    }
    if (etape > 0) {
      setEtape(0);
      return;
    }
    demarrer(async () => {
      const r = await commencerActivationAction();
      if (!r.ok) {
        setRefus(r.message);
        return;
      }
      setDebut(r);
      setEtape(1);
    });
  }

  function verifier() {
    setRefus(null);
    demarrer(async () => {
      const r = await confirmerActivationAction(saisie);
      if (!r.ok) {
        setRefus(r.message);
        return;
      }
      setCodes(r.codesSecours);
      setSaisie("");
      setEtape(3);
    });
  }

  function desactiverMaintenant() {
    setRefus(null);
    demarrer(async () => {
      const r = await desactiverAction(saisie);
      if (!r.ok) {
        setRefus(r.message);
        return;
      }
      setEtat({ active: false, codesRestants: 0 });
      setDesactivation(false);
      setSaisie("");
    });
  }

  function telecharger() {
    const texte = `Atlas, codes de secours\nChacun ouvre une fois.\n\n${codes.join("\n")}\n`;
    const lien = document.createElement("a");
    lien.href = URL.createObjectURL(new Blob([texte], { type: "text/plain" }));
    lien.download = "atlas-codes-de-secours.txt";
    lien.click();
    URL.revokeObjectURL(lien.href);
  }

  function terminer() {
    setEtat({ active: true, codesRestants: codes.length });
    setEtape(0);
    setCodes([]);
    setNotes(false);
    apresActivation?.();
  }

  const allume = etat.active || etape > 0;
  // Désactiver accepte aussi un code de secours, qui porte des lettres : le
  // clavier chiffré l'empêcherait d'être tapé sur un téléphone.
  const champCode = (chiffresSeuls: boolean) => (
    <input
      value={saisie}
      onChange={(e) => setSaisie(e.target.value)}
      inputMode={chiffresSeuls ? "numeric" : "text"}
      autoComplete="one-time-code"
      placeholder={chiffresSeuls ? "000000" : "Code"}
      aria-label="Code"
      className="atlas-champ-gelule mb-3 w-full text-center text-[20px] tracking-[0.3em]"
      data-atlas="code-activation"
    />
  );

  return (
    // Pas d'intitulé : elle est toujours seule sur un écran qui porte déjà le
    // titre « Double vérification ».
    <section className="mx-[26px] mt-[12px]">

      <div className="flex items-center gap-3 py-[10px]" style={{ minHeight: 44 }}>
        <span className="min-w-0 flex-1">
          <span className="block" style={{ fontFamily: font.display, fontSize: 16, lineHeight: 1.25 }}>
            Code de l&apos;appli d&apos;authentification
          </span>
          {etat.active && (
            <span className={`mt-1 block ${texteSituation}`} style={{ color: colors.inkSoft }} data-atlas="double-verification-active">
              Activée. {etat.codesRestants} code{etat.codesRestants > 1 ? "s" : ""} de secours restant{etat.codesRestants > 1 ? "s" : ""}.
            </span>
          )}
        </span>
        <button
          type="button"
          role="switch"
          aria-checked={allume}
          aria-label="Double vérification"
          data-atlas="double-verification"
          disabled={enCours || (etat.active && obligatoire)}
          onClick={basculer}
          className="relative h-7 w-[46px] flex-none rounded-full disabled:opacity-60"
          style={{ backgroundColor: allume ? colors.rust : colors.line }}
        >
          <span
            className="absolute top-[3px] h-[22px] w-[22px] rounded-full transition-[left]"
            style={{ left: allume ? 21 : 3, backgroundColor: colors.card }}
          />
        </button>
      </div>

      {refus && (
        <p
          role="alert"
          className={`mb-3 rounded-[4px] px-[15px] py-3 ${texteSituation}`}
          style={{ backgroundColor: colors.card, borderLeft: `3px solid ${colors.alert}`, color: colors.alert }}
        >
          {refus}
        </p>
      )}

      {etape === 1 && debut && (
        <div className="pb-2">
          <p className={`mb-3 ${libelleCaps}`} style={{ color: colors.inkSoft }}>
            Étape 1 sur 3
          </p>
          {/* Le téléphone : un bouton qui ouvre l'appli. */}
          <div className="hidden [@media(hover:none)]:block">
            <p className={`mb-3 ${texteSituation}`} style={{ color: colors.inkSoft }}>
              Il vous faut une appli d&apos;authentification, comme Google Authenticator.
            </p>
            <a
              href={debut.uri}
              className="mb-4 block w-full rounded-full py-[12px] text-center text-[15px]"
              style={{ backgroundColor: colors.card, color: colors.ink, boxShadow: `inset 0 0 0 1px ${colors.line}` }}
            >
              Ajouter à mon appli d&apos;authentification
            </a>
          </div>
          {/* L'ordinateur : le code carré, à scanner avec le téléphone. */}
          <div className="[@media(hover:none)]:hidden">
            <p className={`mb-3 ${texteSituation}`} style={{ color: colors.inkSoft }}>
              Scannez ce code avec l&apos;appli d&apos;authentification de votre téléphone.
            </p>
            <svg
              viewBox={`-4 -4 ${debut.carre.cotes + 8} ${debut.carre.cotes + 8}`}
              width={200}
              height={200}
              className="mx-auto mb-4 block rounded-[12px]"
              role="img"
              aria-label="Code à scanner"
              shapeRendering="crispEdges"
              data-atlas="code-carre"
            >
              {/* Blanc et noir FIXES, et c'est la seule exception aux jetons :
                  sur les chartes sombres, un code aux couleurs inversées ne se
                  lit pas avec toutes les applis. */}
              <rect x={-4} y={-4} width={debut.carre.cotes + 8} height={debut.carre.cotes + 8} fill="#ffffff" />
              <path d={debut.carre.chemin} fill="#000000" />
            </svg>
          </div>
          <p className={`mb-1 text-center ${texteSituation}`} style={{ color: colors.inkSoft }}>
            Ou tapez cette clé dans l&apos;appli :
          </p>
          <p className="mb-4 text-center font-mono text-[15px] tracking-[0.12em]" data-atlas="cle-double-verification">
            {debut.cle}
          </p>
          <button
            type="button"
            onClick={() => setEtape(2)}
            className="atlas-plein w-full rounded-full py-[13px] text-[16px]"
            style={{ backgroundColor: colors.plein, color: colors.cream }}
          >
            Continuer
          </button>
        </div>
      )}

      {etape === 2 && (
        <div className="pb-2">
          <p className={`mb-3 ${libelleCaps}`} style={{ color: colors.inkSoft }}>
            Étape 2 sur 3
          </p>
          <p className={`mb-3 ${texteSituation}`} style={{ color: colors.inkSoft }}>
            Tapez le code que l&apos;appli affiche.
          </p>
          {champCode(true)}
          <button
            type="button"
            onClick={verifier}
            disabled={enCours || saisie.trim() === ""}
            className="atlas-plein w-full rounded-full py-[13px] text-[16px] disabled:opacity-60"
            style={{ backgroundColor: colors.plein, color: colors.cream }}
          >
            {enCours ? "Vérification…" : "Vérifier"}
          </button>
        </div>
      )}

      {etape === 3 && (
        <div className="pb-2">
          <p className={`mb-3 ${libelleCaps}`} style={{ color: colors.inkSoft }}>
            Étape 3 sur 3
          </p>
          <p className={`mb-3 ${texteSituation}`} style={{ color: colors.inkSoft }}>
            Vos codes de secours. Chacun ouvre une fois, si vous perdez votre téléphone. Notez-les sur papier.
          </p>
          <ul
            className="mb-3 grid grid-cols-2 gap-x-4 gap-y-2 rounded-[12px] p-4 font-mono text-[15px] tracking-[0.06em]"
            style={{ backgroundColor: colors.card, boxShadow: `inset 0 0 0 1px ${colors.line}` }}
            data-atlas="codes-secours"
          >
            {codes.map((c) => (
              <li key={c}>{c}</li>
            ))}
          </ul>
          <button
            type="button"
            onClick={telecharger}
            className="mb-3 w-full rounded-full py-[11px] text-center text-[15px]"
            style={{ backgroundColor: colors.card, color: colors.ink, boxShadow: `inset 0 0 0 1px ${colors.line}` }}
          >
            Télécharger
          </button>
          <label className="mb-3 flex items-center gap-[10px] text-[15px]">
            <input
              type="checkbox"
              checked={notes}
              onChange={(e) => setNotes(e.target.checked)}
              className="h-5 w-5"
              style={{ accentColor: colors.or }}
            />
            Je les ai notés
          </label>
          <button
            type="button"
            onClick={terminer}
            disabled={!notes}
            className="atlas-plein w-full rounded-full py-[13px] text-[16px] disabled:opacity-60"
            style={{ backgroundColor: colors.plein, color: colors.cream }}
          >
            Terminer
          </button>
        </div>
      )}

      {desactivation && etat.active && !obligatoire && (
        <div className="pb-2">
          <p className={`mb-3 ${texteSituation}`} style={{ color: colors.inkSoft }}>
            Pour la désactiver, tapez un code de l&apos;appli ou un code de secours.
          </p>
          {champCode(false)}
          <button
            type="button"
            onClick={desactiverMaintenant}
            disabled={enCours || saisie.trim() === ""}
            className="w-full rounded-full py-[11px] text-center text-[15px] disabled:opacity-60"
            style={{ backgroundColor: colors.card, color: colors.alert, boxShadow: `inset 0 0 0 1px ${colors.line}` }}
          >
            Désactiver
          </button>
        </div>
      )}
    </section>
  );
}
