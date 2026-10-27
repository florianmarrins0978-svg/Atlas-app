"use client";

import { useState, useTransition } from "react";
import { colors, font, surPlein, voile } from "@/lib/design-tokens";
import type { EtatDoubleVerification } from "@/server/repositories/double-verification";
import ActionBas from "@/components/atlas/reglages/ActionBas";
import PastilleIcone from "@/components/atlas/reglages/PastilleIcone";
import PlageTon, { teintesDuTon } from "@/components/atlas/reglages/PlageTon";
import Trace from "@/components/atlas/reglages/Trace";
import {
  commencerActivationAction,
  confirmerActivationAction,
  desactiverAction,
  type DebutActivationEcran,
} from "./double-verification-actions";

/**
 * LA DOUBLE VÉRIFICATION — `appli/double-verification.html`, onglet 1, puis sa
 * planche soignée du 26 octobre 2026
 * (`appli/soignee/reglages-connexion-double-verification.html`, vue Proposé).
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
 * **Ce que la planche soignée change, et rien d'autre** : l'étape se lit d'un
 * coup d'œil (trois traits dorés, « Étape 2 sur 3 » en toutes lettres) ; le
 * bouton de chaque étape passe sous le pouce, au-dessus de la barre, toujours
 * au même endroit ; allumée, elle le dit en vert ; obligatoire pour le rôle,
 * une ligne le dit au lieu d'un interrupteur grisé qui ne répond rien.
 *
 * Utilisée deux fois : sa rubrique de Réglages, et l'écran où le patron est
 * envoyé tant qu'il ne l'a pas activée (`apresActivation` le ramène alors chez
 * lui). Ce que cet écran-là pose sous la section passe par `children`, au-dessus
 * du bouton du bas : posé après, il serait caché par lui.
 */
export default function SectionDoubleVerification({
  etatInitial,
  obligatoire,
  apresActivation,
  children,
}: {
  etatInitial: EtatDoubleVerification;
  obligatoire: boolean;
  apresActivation?: () => void;
  children?: React.ReactNode;
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
  /** Elle tient, et le rôle interdit de l'éteindre : l'interrupteur ne peut rien. */
  const verrouillee = etat.active && obligatoire;
  const vert = teintesDuTon("vert");
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
      // Le code se tape dans une grande case, en gros chiffres (sa planche
      // soignée) : six chiffres lus sur un autre écran, recopiés sans
      // lunettes.
      className={`block w-full rounded-[14px] border-0 text-center font-mono outline-none ${
        chiffresSeuls ? "min-h-[64px] text-[30px] tracking-[0.32em]" : "min-h-[56px] text-[20px] tracking-[0.2em]"
      } placeholder:text-[color:var(--atlas-inkSoft)] placeholder:opacity-45`}
      style={{ backgroundColor: colors.card, color: colors.ink, boxShadow: `inset 0 0 0 1px ${colors.line}` }}
      data-atlas="code-activation"
    />
  );

  return (
    // Pas d'intitulé : elle est toujours seule sur un écran qui porte déjà le
    // titre « Double vérification ».
    <section className="mx-[22px] mt-[18px]">
      <div className="rounded-[6px] p-[18px]" style={{ backgroundColor: colors.card }}>
        <div className="flex min-h-[64px] items-center gap-3.5">
          {/* Le bouclier passe au vert une fois qu'elle tient : c'est la couleur
              de ce qui marche, partout dans l'appli. */}
          <PastilleIcone ton={etat.active ? "vert" : undefined}>
            <Trace>
              <path d="M12 3.5l7 2.8v5.2c0 4.6-3 7.9-7 9-4-1.1-7-4.4-7-9V6.3z" />
              {etat.active && <path d="M8.8 12l2.3 2.3 4.2-4.6" />}
            </Trace>
          </PastilleIcone>
          <span className="min-w-0 flex-1">
            <span className="block" style={{ fontFamily: font.display, fontSize: 18, lineHeight: 1.25 }}>
              Code de l&apos;appli d&apos;authentification
            </span>
            {etat.active && (
              <span
                className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1.5 text-[14.5px]"
                style={{ color: colors.inkSoft }}
                data-atlas="double-verification-active"
              >
                <span
                  className="inline-flex min-h-[28px] items-center gap-[7px] rounded-full px-[11px] text-[13.5px] font-semibold"
                  style={{ backgroundColor: vert.fond, color: vert.texte }}
                >
                  <span aria-hidden className="h-[7px] w-[7px] rounded-full" style={{ backgroundColor: "currentColor" }} />
                  Activée
                </span>
                <span>
                  {etat.codesRestants} code{etat.codesRestants > 1 ? "s" : ""} de secours restant
                  {etat.codesRestants > 1 ? "s" : ""}.
                </span>
              </span>
            )}
          </span>
          <button
            type="button"
            role="switch"
            aria-checked={allume}
            aria-label="Double vérification"
            data-atlas="double-verification"
            disabled={enCours || verrouillee}
            onClick={basculer}
            className="relative h-8 w-[52px] flex-none rounded-full disabled:opacity-55"
            // Allumé, le vert des bascules des Réglages soignés (sa planche du
            // 26 octobre 2026), comme les autres interrupteurs de la série ;
            // sur Nuit et Sylve ce vert est clair, et la pastille `card` s'y lit.
            style={{ backgroundColor: allume ? colors.plein : voile(colors.ink, 0.18) }}
          >
            <span
              aria-hidden
              className="absolute top-[3px] h-[26px] w-[26px] rounded-full transition-[left]"
              style={{ left: allume ? 23 : 3, backgroundColor: colors.card }}
            />
          </button>
        </div>
        {/* **Obligatoire pour le rôle, et l'écran le DIT** (sa planche
            soignée) : un interrupteur grisé qui ne répond rien se lit comme une
            panne. Vrai seulement là où la règle s'applique — le patron et la
            facturation, en production (`doubleVerificationObligatoire`). */}
        {verrouillee && (
          <p
            className="mt-3 flex items-center gap-2 pt-3 text-[14.5px]"
            style={{ color: colors.inkSoft, boxShadow: `inset 0 1px 0 ${colors.line}` }}
          >
            <span className="flex" style={{ color: colors.or }}>
              <Trace taille={18}>{TRACE_CADENAS}</Trace>
            </span>
            Obligatoire pour votre rôle.
          </p>
        )}
      </div>

      {refus && (
        <div role="alert" className="mt-3">
          <PlageTon ton="rouge">{refus}</PlageTon>
        </div>
      )}

      {/* **Éteinte, ce qu'elle ajoute à la connexion** (sa planche soignée) :
          l'écran était vide sous l'interrupteur, et rien ne disait à quoi il
          sert. Ce que la plage dit est vrai dans le code, et il ne faut pas le
          lui faire dire davantage :
            · un mot de passe juste ne suffit plus, `authorize` réclame le code
              (`src/server/double-verification-connexion.ts`) ;
            · Face ID n'y passe jamais, il vaut déjà deux preuves ;
            · « Ne plus demander sur cet appareil », coché d'office, dispense
              d'un code pendant trente jours un appareil qui l'a déjà donné.
          D'où « sur un nouvel appareil » : sans ces mots, la plage promettait
          un code à chaque connexion, ce qui n'est pas vrai. */}
      {!etat.active && etape === 0 && (
        <>
          <div className="mt-4">
            <PlageTon ton="bleu">
              <span className="block font-semibold" style={{ color: colors.ink }}>
                Allumée, sur un nouvel appareil :
              </span>
              <span className="mt-3 grid grid-cols-[1fr_auto_1fr] items-center gap-2">
                <Preuve trace={TRACE_CADENAS}>Votre mot de passe</Preuve>
                <span className="flex" style={{ color: colors.inkSoft }}>
                  <Trace taille={20}>{TRACE_PLUS}</Trace>
                </span>
                <Preuve trace={TRACE_TELEPHONE}>Le code de votre téléphone</Preuve>
              </span>
            </PlageTon>
          </div>
          <p className="mt-2.5 text-center text-[14px]" style={{ color: colors.inkSoft }}>
            Face ID entre sans code.
          </p>
        </>
      )}

      {etape === 1 && debut && (
        <div>
          <Etapes faite={1} />
          {/* Le téléphone : un bouton qui ouvre l'appli. Creux et doré, parce
              que le seul plein de l'écran est Continuer, sous le pouce. */}
          <div className="hidden [@media(hover:none)]:block">
            <p className={DIT}>Il vous faut une appli d&apos;authentification, comme Google Authenticator.</p>
            <a
              href={debut.uri}
              className="flex min-h-[56px] w-full items-center justify-center gap-2.5 rounded-full px-[22px] text-center text-[17px] font-semibold"
              style={{ color: colors.or, boxShadow: `inset 0 0 0 1.5px ${voile(colors.or, 0.7)}` }}
            >
              <Trace>{TRACE_TELEPHONE}</Trace>
              Ajouter à mon appli d&apos;authentification
            </a>
          </div>
          {/* L'ordinateur : le code carré, à scanner avec le téléphone. */}
          <div className="[@media(hover:none)]:hidden">
            <p className={DIT}>Scannez ce code avec l&apos;appli d&apos;authentification de votre téléphone.</p>
            <svg
              viewBox={`-4 -4 ${debut.carre.cotes + 8} ${debut.carre.cotes + 8}`}
              width={200}
              height={200}
              className="mx-auto block rounded-[12px]"
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
          <p className="mb-1.5 mt-[18px] text-center text-[14.5px]" style={{ color: colors.inkSoft }}>
            Ou tapez cette clé dans l&apos;appli :
          </p>
          <p
            className="rounded-[6px] px-2.5 py-3.5 text-center font-mono text-[17px] leading-[1.5] tracking-[0.08em]"
            style={{ backgroundColor: colors.card, color: colors.ink, wordSpacing: "0.25em" }}
            data-atlas="cle-double-verification"
          >
            {debut.cle}
          </p>
        </div>
      )}

      {etape === 2 && (
        <div>
          <Etapes faite={2} />
          <p className={DIT}>Tapez le code que l&apos;appli affiche.</p>
          {champCode(true)}
        </div>
      )}

      {etape === 3 && (
        <div>
          <Etapes faite={3} />
          <p className={DIT}>
            Vos codes de secours. Chacun ouvre une fois, si vous perdez votre téléphone. Notez-les sur papier.
          </p>
          {/* Dix codes, deux par ligne, dans une plage : on les recopie d'un
              coup d'œil, sans perdre sa ligne. */}
          <ul
            className="grid grid-cols-2 gap-x-4 gap-y-2.5 rounded-[6px] px-[18px] py-4 text-center font-mono text-[16.5px] tracking-[0.05em]"
            style={{ backgroundColor: colors.card }}
            data-atlas="codes-secours"
          >
            {codes.map((c) => (
              <li key={c}>{c}</li>
            ))}
          </ul>
          <button
            type="button"
            onClick={telecharger}
            className="mt-4 flex min-h-[56px] w-full items-center justify-center gap-2.5 rounded-full px-[22px] text-[17px] font-semibold"
            style={{ color: colors.ink, boxShadow: `inset 0 0 0 1.5px ${colors.line}` }}
          >
            <Trace>{TRACE_TELECHARGER}</Trace>
            Télécharger
          </button>
          <label className="mt-2.5 flex min-h-[56px] items-center gap-3 text-[16px] font-semibold">
            <input
              type="checkbox"
              checked={notes}
              onChange={(e) => setNotes(e.target.checked)}
              className="m-0 h-[26px] w-[26px] flex-none"
              style={{ accentColor: colors.or }}
            />
            Je les ai notés
          </label>
        </div>
      )}

      {desactivation && etat.active && !obligatoire && (
        <div>
          <p className={`${DIT} mt-5`}>Pour la désactiver, tapez un code de l&apos;appli ou un code de secours.</p>
          {champCode(false)}
          <button
            type="button"
            onClick={desactiverMaintenant}
            disabled={enCours || saisie.trim() === ""}
            className="mt-4 flex min-h-[56px] w-full items-center justify-center rounded-full px-[22px] text-[17px] font-semibold disabled:opacity-60"
            style={{ color: colors.alert, boxShadow: `inset 0 0 0 1.5px ${colors.line}` }}
          >
            Désactiver
          </button>
        </div>
      )}

      {children}

      {/* **Continuer, Vérifier, Terminer : sous le pouce, toujours au même
          endroit** (sa planche soignée). Au milieu de l'écran, chaque étape
          posait son bouton plus bas que la précédente, et le pouce le
          cherchait. Les autres gestes restent creux. */}
      {etape === 1 && debut && (
        <ActionBas>
          <BoutonPlein onClick={() => setEtape(2)}>Continuer</BoutonPlein>
        </ActionBas>
      )}
      {etape === 2 && (
        <ActionBas>
          <BoutonPlein onClick={verifier} eteint={enCours || saisie.trim() === ""}>
            {enCours ? "Vérification…" : "Vérifier"}
          </BoutonPlein>
        </ActionBas>
      )}
      {etape === 3 && (
        <ActionBas>
          <BoutonPlein onClick={terminer} eteint={!notes}>
            Terminer
          </BoutonPlein>
        </ActionBas>
      )}
    </section>
  );
}

/** La phrase d'une étape : ce qu'il faut faire, dans les mots d'aujourd'hui. */
const DIT = "mb-3.5 text-[15.5px] leading-[1.45]";

/**
 * L'étape d'un coup d'œil : trois traits qui se remplissent d'or, puis le mot
 * en toutes lettres. En capitales espacées de 11 px, « ÉTAPE 2 SUR 3 » se
 * déchiffrait ; les traits se lisent avant même le mot.
 */
function Etapes({ faite }: { faite: 1 | 2 | 3 }) {
  return (
    <>
      <span aria-hidden className="mb-2 mt-[22px] flex gap-1.5">
        {[1, 2, 3].map((n) => (
          <span
            key={n}
            className="h-1 flex-1 rounded-full"
            style={{ backgroundColor: n <= faite ? colors.or : voile(colors.ink, 0.12) }}
          />
        ))}
      </span>
      <p className="mb-3 text-[14.5px] font-semibold" style={{ color: colors.inkSoft }}>
        Étape {faite} sur 3
      </p>
    </>
  );
}

/** Une des deux preuves de la connexion, sur sa petite plage. */
function Preuve({ trace, children }: { trace: React.ReactNode; children: React.ReactNode }) {
  return (
    <span
      className="flex flex-col items-center gap-1.5 rounded-[6px] px-1.5 py-3 text-center text-[14.5px] font-semibold leading-[1.25]"
      style={{ backgroundColor: colors.card }}
    >
      <span className="flex" style={{ color: colors.or }}>
        <Trace>{trace}</Trace>
      </span>
      {children}
    </span>
  );
}

/** Le seul bouton plein de l'écran, collé au-dessus de la barre. */
function BoutonPlein({
  onClick,
  eteint = false,
  children,
}: {
  onClick: () => void;
  eteint?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={eteint}
      className={`flex min-h-[56px] w-full items-center justify-center rounded-full px-[22px] text-[17px] font-semibold ${
        eteint ? "" : "atlas-plein"
      }`}
      style={{
        backgroundColor: eteint ? colors.line : colors.plein,
        color: eteint ? colors.inkSoft : surPlein,
      }}
    >
      {children}
    </button>
  );
}

const TRACE_CADENAS = (
  <>
    <rect x="5" y="10.5" width="14" height="10" rx="2" />
    <path d="M8 10.5V8a4 4 0 0 1 8 0v2.5" />
  </>
);
const TRACE_TELEPHONE = (
  <path d="M6.6 3.5h2.9l1.5 4.4-2 1.3a11 11 0 0 0 5.8 5.8l1.3-2 4.4 1.5v2.9a2 2 0 0 1-2.2 2A16.5 16.5 0 0 1 4.6 5.7a2 2 0 0 1 2-2.2z" />
);
const TRACE_PLUS = <path d="M12 5v14M5 12h14" />;
const TRACE_TELECHARGER = <path d="M12 4v11M7.5 10.5L12 15l4.5-4.5M5 19.5h14" />;
