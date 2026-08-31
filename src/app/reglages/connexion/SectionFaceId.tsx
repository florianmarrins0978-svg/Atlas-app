"use client";

import { useEffect, useState, useTransition } from "react";
import { colors, font, libelleCaps, texteSituation } from "@/lib/design-tokens";
import { estAbandon, messageRefusCle, type CleAppareil } from "@/lib/cle-appareil";
import { defiEnregistrementAction, enregistrerCleAction, retirerCleAction } from "./actions";
import DemanderPreuve from "@/components/atlas/DemanderPreuve";

/**
 * « Ouvrir avec Face ID » — l'endroit où on l'allume.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * **Sa règle du 23 août 2026 :** *« l'utilisateur va commencer par créer son
 * compte avec son mot de passe et ensuite il décidera s'il veut ouvrir sa
 * session avec le mot de passe ou le Face ID »*. On n'arrive donc ici qu'une
 * fois entré — et le mot de passe reste, quoi qu'il fasse.
 *
 * **CE QUE L'ÉCRAN DISAIT, ET QU'IL NE DIT PLUS — 31 août 2026.** Quatre lignes
 * grises promettaient ici que c'est par appareil, que le visage ne quitte
 * jamais le téléphone, et que le mot de passe reste actif. Il les a fait
 * retirer avec toutes les autres : *« supprime toutes les petites phrases en
 * gris sous les boutons, garde que les titres »*.
 *
 * **Les faits n'ont pas bougé** — `drizzle/0063_cles_appareil.sql` ne porte
 * aucune donnée biométrique, et c'est la base, pas une phrase, que
 * `test-face-id-e2e.ts` interroge. Ce qui a disparu, c'est la promesse écrite :
 * un artisan méfiant n'a plus de quoi se rassurer à l'écran. Le lui redire
 * demanderait un autre endroit que cette rubrique — pas ces quatre lignes.
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

  /**
   * Le geste qu'on REPRENDRA une fois l'identité prouvée.
   *
   * Sans cela, l'artisan taperait son mot de passe puis devrait réappuyer sur
   * « Activer » — et sur un chantier, un geste qu'on refait est un geste qu'on
   * abandonne.
   */
  const [preuveDemandee, setPreuveDemandee] = useState<{ motif: string; reprendre: () => void } | null>(
    null
  );

  function activer() {
    setRefus(null);
    setFait(null);
    demarrer(async () => {
      try {
        // **Lu dans le GESTE, jamais pendant le rendu** — c'est ce qui
        // distingue cet appel du défaut d'hydratation que le dépôt interdit
        // (`ARCHITECTURE.md` §68, §81, §177).
        const defi = await defiEnregistrementAction(window.location.origin);
        if (!defi.ok) {
          setRefus(defi.raison);
          return;
        }
        const { startRegistration } = await import("@simplewebauthn/browser");
        const reponse = await startRegistration(defi.options);
        const r = await enregistrerCleAction(JSON.stringify(reponse));
        if (!r.ok) {
          // Le serveur réclame une identité récente : on la demande, puis on
          // reprend le geste tout seul.
          if (r.preuveExigee) {
            setPreuveDemandee({ motif: r.raison, reprendre: activer });
            return;
          }
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
        // **Le journal d'abord.** Le navigateur nomme la vraie cause —
        // `SecurityError` quand le domaine ne s'accorde pas — et sans elle on
        // répare une panne imaginée (`AGENTS.md`).
        console.error("[face-id] activation refusée par le navigateur", nom, erreur);
        if (nom === "InvalidStateError") setRefus(messageRefusCle("deja-enregistree"));
        // **« panne-activation », et non « panne ».** On est DÉJÀ entré ici :
        // « entrez votre mot de passe » demanderait un geste qu'il vient de
        // faire, et se lirait comme une panne d'Atlas.
        else setRefus(estAbandon(nom) ? null : messageRefusCle("panne-activation"));
      }
    });
  }

  function retirer(id: string) {
    setRefus(null);
    setFait(null);
    demarrer(async () => {
      const r = await retirerCleAction(id);
      if (!r.ok) {
        if (r.preuveExigee) {
          setPreuveDemandee({ motif: r.raison, reprendre: () => retirer(id) });
          return;
        }
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
    <section className="mx-[26px] mt-[12px] border-t pt-[10px]" style={{ borderColor: colors.line }}>
      <p className={`mb-1.5 ${libelleCaps}`} style={{ color: colors.muted }}>
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
              className="flex items-center gap-3 border-b py-[10px]"
              style={{ borderColor: colors.line, minHeight: 44 }}
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
          className="w-full rounded-full py-[11px] text-center text-[15px] disabled:opacity-60"
          style={{ backgroundColor: colors.card, color: colors.ink, boxShadow: `inset 0 0 0 1px ${colors.line}` }}
        >
          {enCours ? "En cours…" : "Enregistrer cet appareil"}
        </button>
      )}

      {/* **LA GLOSE EST PARTIE — sa demande du 31 août 2026 :** *« supprime
          toutes les petites phrases en gris sous les boutons, garde que les
          titres »*. Quatre lignes vivaient ici : c'est par appareil, le visage
          ne quitte pas le téléphone, le mot de passe reste actif.

          **Ce que ce retrait coûte, et il faut le savoir avant de le défaire :**
          l'écran ne promet plus rien à celui qui hésite à donner son visage.
          Rien ne change dans les faits — `drizzle/0063_cles_appareil.sql` ne
          porte aucune donnée biométrique, et `test-face-id-e2e.ts` le vérifie
          en base plutôt que dans une phrase. C'est la promesse ÉCRITE qui a
          disparu, pas la garantie. */}

      {/* **La feuille n'autorise rien** : elle obtient une preuve côté serveur,
          puis on REPREND le geste. Sans cette reprise, l'artisan taperait son
          mot de passe et devrait réappuyer — un geste qu'on refait est un geste
          qu'on abandonne. */}
      <DemanderPreuve
        ouvert={preuveDemandee !== null}
        motif={preuveDemandee?.motif ?? ""}
        onAbandon={() => setPreuveDemandee(null)}
        onProuve={() => {
          const reprendre = preuveDemandee?.reprendre;
          setPreuveDemandee(null);
          reprendre?.();
        }}
      />
    </section>
  );
}
