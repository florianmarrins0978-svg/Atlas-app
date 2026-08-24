"use client";

import { useEffect, useState, useTransition } from "react";
import { colors, font, libelleCaps, texteSituation } from "@/lib/design-tokens";
import { estAbandon, messageRefusCle, phraseAppareils, type CleAppareil } from "@/lib/cle-appareil";
import { defiEnregistrementAction, enregistrerCleAction, retirerCleAction } from "./actions";

/**
 * « Ouvrir avec Face ID » — l'endroit où on l'allume.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * **Sa règle du 23 août 2026 :** *« l'utilisateur va commencer par créer son
 * compte avec son mot de passe et ensuite il décidera s'il veut ouvrir sa
 * session avec le mot de passe ou le Face ID »*. On n'arrive donc ici qu'une
 * fois entré — et le mot de passe reste, quoi qu'il fasse.
 *
 * **Ce que l'écran DOIT dire, et que rien d'autre ne dirait :**
 *
 *   · c'est **par appareil** — allumé sur l'iPhone, il ne l'est pas sur l'iPad ;
 *   · le visage **ne quitte jamais le téléphone** : Atlas ne reçoit qu'une
 *     preuve, jamais une image. C'est vrai (`drizzle/0063_cles_appareil.sql` ne
 *     porte aucune donnée biométrique), et le taire laisserait un artisan
 *     refuser par méfiance une chose qui ne mérite pas cette méfiance ;
 *   · le mot de passe **ne peut pas se retirer** — c'est ce qui fait entrer sur
 *     un téléphone neuf.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * **RIEN NE S'AFFICHE SI L'APPAREIL NE SAIT PAS LE FAIRE**, sauf s'il a déjà
 * des clés ailleurs — auquel cas la liste doit rester atteignable pour qu'il
 * puisse retirer le téléphone qu'il vient de perdre. Un interrupteur qui ne
 * peut pas aboutir se tairait ; une liste qu'on ne peut plus ouvrir enfermerait
 * une porte ouverte.
 */
export default function SectionFaceId({ clesInitiales }: { clesInitiales: CleAppareil[] }) {
  const [cles, setCles] = useState(clesInitiales);
  const [disponible, setDisponible] = useState(false);
  const [teste, setTeste] = useState(false);
  const [refus, setRefus] = useState<string | null>(null);
  const [fait, setFait] = useState<string | null>(null);
  const [enCours, demarrer] = useTransition();

  useEffect(() => {
    let vivant = true;
    import("@simplewebauthn/browser")
      .then(async ({ browserSupportsWebAuthn, platformAuthenticatorIsAvailable }) => {
        const ok = browserSupportsWebAuthn() ? await platformAuthenticatorIsAvailable() : false;
        if (vivant) {
          setDisponible(ok);
          setTeste(true);
        }
      })
      .catch(() => {
        if (vivant) setTeste(true);
      });
    return () => {
      vivant = false;
    };
  }, []);

  function activer() {
    setRefus(null);
    setFait(null);
    demarrer(async () => {
      try {
        const defi = await defiEnregistrementAction();
        if (!defi.ok) {
          setRefus(defi.raison);
          return;
        }
        const { startRegistration } = await import("@simplewebauthn/browser");
        const reponse = await startRegistration(defi.options);
        const r = await enregistrerCleAction(JSON.stringify(reponse));
        if (!r.ok) {
          setRefus(r.raison);
          return;
        }
        setCles(r.cles);
        setFait("Cet appareil est enregistré. Vous pourrez ouvrir Atlas avec Face ID.");
      } catch (erreur) {
        const nom = erreur instanceof Error ? erreur.name : null;
        // **Fermer la fenêtre du système n'est pas une faute.** Rien à l'écran.
        // La seule exception : `InvalidStateError`, que le navigateur rend quand
        // l'appareil est DÉJÀ enregistré — là, le taire laisserait croire que
        // rien ne s'est passé, et il réappuierait.
        if (nom === "InvalidStateError") setRefus(messageRefusCle("deja-enregistree"));
        else setRefus(estAbandon(nom) ? null : messageRefusCle("panne"));
      }
    });
  }

  function retirer(id: string) {
    setRefus(null);
    setFait(null);
    demarrer(async () => {
      const r = await retirerCleAction(id);
      if (!r.ok) {
        setRefus(r.raison);
        return;
      }
      setCles(r.cles);
      setFait("Cet appareil ne peut plus ouvrir Atlas. Votre mot de passe, lui, marche toujours.");
    });
  }

  // Ni disponible ici, ni de clé ailleurs : la rubrique n'aurait rien à dire.
  if (teste && !disponible && cles.length === 0) return null;
  if (!teste) return null;

  return (
    <section className="mx-[26px] mt-[30px] border-t pt-[18px]" style={{ borderColor: colors.line }}>
      <p className={`mb-2.5 ${libelleCaps}`} style={{ color: colors.muted }}>
        Ouvrir avec Face ID
      </p>

      {refus && (
        <p
          role="alert"
          className={`mb-3 rounded-[4px] px-[15px] py-3 ${texteSituation}`}
          style={{ backgroundColor: colors.card, borderLeft: `3px solid ${colors.alert}`, color: colors.alert }}
        >
          {refus}
        </p>
      )}
      {fait && (
        <p
          role="status"
          className={`mb-3 rounded-[4px] px-[15px] py-3 ${texteSituation}`}
          style={{ backgroundColor: colors.card, borderLeft: `3px solid ${colors.or}`, color: colors.ink }}
        >
          {fait}
        </p>
      )}

      {cles.length > 0 && (
        <ul className="mb-3">
          {cles.map((cle) => (
            <li
              key={cle.id}
              className="flex items-center gap-3 border-b py-[13px]"
              style={{ borderColor: colors.line, minHeight: 56 }}
            >
              <span className="min-w-0 flex-1">
                <span className="block" style={{ fontFamily: font.display, fontSize: 16, lineHeight: 1.25 }}>
                  {cle.nomAppareil}
                </span>
                {/* **Une DATE, toujours — jamais « Jamais encore servi » seul.**
                    La capture du 24 août montrait deux lignes « iPhone / Jamais
                    encore servi » strictement identiques : impossible de savoir
                    laquelle retirer. Or c'est le seul moment où l'on ouvre cet
                    écran — un téléphone vient d'être perdu. Deux téléphones du
                    même modèle portent le même nom deviné ; leur date
                    d'enregistrement, elle, les sépare. */}
                <span className={`mt-1 block ${texteSituation}`} style={{ color: colors.muted }}>
                  {cle.dernierUsageLe
                    ? `Dernière ouverture le ${cle.dernierUsageLe.toLocaleDateString("fr-FR")}`
                    : `Enregistré le ${cle.creeLe.toLocaleDateString("fr-FR")}, jamais encore servi`}
                </span>
              </span>
              <button
                type="button"
                onClick={() => retirer(cle.id)}
                disabled={enCours}
                className="flex-none rounded-full px-4 py-2 text-[14px] disabled:opacity-60"
                style={{ backgroundColor: colors.card, color: colors.alert, boxShadow: `inset 0 0 0 1px ${colors.line}` }}
              >
                Retirer
              </button>
            </li>
          ))}
        </ul>
      )}

      {disponible && (
        <button
          type="button"
          onClick={activer}
          disabled={enCours}
          className="w-full rounded-full py-[13px] text-center text-[15px] disabled:opacity-60"
          style={{ backgroundColor: colors.card, color: colors.ink, boxShadow: `inset 0 0 0 1px ${colors.line}` }}
        >
          {enCours ? "En cours…" : "Enregistrer cet appareil"}
        </button>
      )}

      {/* **Les espaces autour des `<b>` sont posés à la main**, et ce n'est pas
          de la superstition : JSX avale l'espace qui borde une balise en fin de
          ligne. La capture du 24 août montrait « chaque appareilséparément » et
          « reste actifet ne peut pas ». Aucun test ne l'aurait vu — c'est la
          cinquième fois dans ce dépôt qu'un défaut sort d'une image regardée
          (`CLAUDE.md` §5). */}
      <p className={`mt-2.5 ${texteSituation}`} style={{ color: colors.muted }}>
        {phraseAppareils(cles.length)}. Sur <b style={{ color: colors.ink }}>chaque appareil</b>{" "}
        séparément. Votre visage ne quitte jamais votre téléphone : Atlas ne reçoit qu&apos;une preuve,
        jamais une image.
        <br />
        <b style={{ color: colors.ink }}>Votre mot de passe reste actif</b>{" "}
        et ne peut pas se retirer — c&apos;est lui qui vous fait entrer sur un téléphone neuf.
      </p>
    </section>
  );
}
