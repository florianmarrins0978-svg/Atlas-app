"use client";

import { useState, useTransition } from "react";
import { NUIT, SERIF } from "@/components/atlas/PorteDeNuit";
import { LONGUEUR_CODE, codeNormalise } from "@/lib/code-verification";

type EtatDuCode = { ok: true } | { ok: false; refus: string; codeMort: boolean };

/**
 * LA CASE DU CODE — une seule pièce, trois écrans.
 *
 * Elle est la dix-septième question de la porte (`creer-un-compte`), l'écran
 * `/verifier-email` où revient un compte qui n'a pas fini, et le code du mot
 * de passe oublié : les mêmes cases, le même bouton, le même « Renvoyer ».
 * Deux dessins du même geste se liraient comme deux gestes, et le second
 * aurait divergé au premier ajustement (`CLAUDE.md` §3).
 *
 * **SIX CASES, UN SEUL CHAMP — planche `appli/verifier-son-email.html`,
 * validée le 11 octobre 2026.** La gélule et son « 000000 » se prenaient pour
 * un code déjà rempli. Les six cases ne sont qu'un dessin : le vrai champ est
 * posé dessus, invisible, et c'est lui que le pouce touche. Six champs
 * séparés auraient perdu ce qui suit.
 *
 * **`autoComplete="one-time-code"`** : l'iPhone lit le code dans Mail et le
 * propose au-dessus du clavier. C'est le geste attendu : il n'a pas à
 * recopier six chiffres depuis une autre application. Et le champ reste en
 * 16 px, sans quoi Safari zoome sur la page en le touchant.
 *
 * **ET UNE SORTIE — sa remarque du 14 septembre 2026, le soir même :** *« je
 * suis bloqué à cette page, il n'existe pas de touche retour si on ne reçoit
 * pas l'email »*. Un code qui n'arrive jamais (adresse mal tapée, boîte
 * pleine, expéditeur refusé) enfermait dans cet écran : la garde renvoie ici
 * depuis partout, et rien n'en sortait. « Retour » ferme la session et rend
 * la porte d'entrée principale, la même action que « Se déconnecter » dans
 * Réglages ; c'est lui qui a choisi le mot, le soir même : *« ou simplement
 * une touche retour, qui ramènerait à la porte d'entrée principale »*. Le
 * compte reste en attente en base ; il n'est ni ouvert, ni perdu. Depuis la
 * planche du 11 octobre, il est en haut à gauche avec son chevron, comme sur
 * les autres écrans de la porte.
 */
export default function SaisieDuCode({
  email,
  avertissement,
  onVerifie,
  verifier,
  renvoyer: renvoyerLeCode,
  sortir: sortirDeLEcran,
}: {
  /** Où le code est parti : l'adresse ENTIÈRE, c'est là qu'il doit regarder. */
  email: string;
  /** Un envoi raté à la création : dit tout de suite, avec « Renvoyer » sous la main. */
  avertissement?: string;
  onVerifie: () => void;
  /**
   * **LES TROIS GESTES VIENNENT DE L'ÉCRAN QUI LA MONTE** (24 septembre 2026).
   * La case sert aussi au mot de passe oublié, où il n'y a pas de session :
   * le code se vérifie sur une adresse, et « Retour » ne déconnecte personne.
   * Le dessin reste unique ; ce qu'il déclenche se choisit dehors.
   */
  verifier: (code: string) => Promise<EtatDuCode>;
  renvoyer: () => Promise<{ ok: true } | { ok: false; refus: string }>;
  sortir: () => Promise<void>;
}) {
  const [code, setCode] = useState("");
  const [refus, setRefus] = useState<string | null>(avertissement ?? null);
  const [renvoye, setRenvoye] = useState(false);
  // Le serveur le dit déjà (`codeMort`) : plus rien à essayer sur ce code.
  // Le gros bouton devient alors « Renvoyer le code », au lieu d'un
  // « Continuer » qui ne mènerait qu'au même refus devant une case vide.
  const [mort, setMort] = useState(false);
  const [actif, setActif] = useState(false);
  const [enCours, demarrer] = useTransition();

  function valider() {
    if (mort) {
      renvoyer();
      return;
    }
    setRenvoye(false);
    // La forme se vérifie ici, avec la même règle que le serveur : pas une
    // seconde règle, la même fonction. Un aller-retour pour dire « six
    // chiffres » ferait attendre le refus le plus simple.
    if (!codeNormalise(code)) {
      setRefus(`Le code fait ${LONGUEUR_CODE} chiffres.`);
      return;
    }
    demarrer(async () => {
      const etat = await verifier(code);
      if (etat.ok) {
        onVerifie();
        return;
      }
      setRefus(etat.refus);
      // Un code mort ne se retape pas : la case se vide, « Renvoyer » passe devant.
      if (etat.codeMort) {
        setCode("");
        setMort(true);
      }
    });
  }

  function sortir() {
    // Pas de `catch` : l'action se termine par une redirection qui remonte
    // jusqu'au routeur ; l'avaler laisserait l'écran en place, cookie effacé.
    demarrer(async () => {
      await sortirDeLEcran();
    });
  }

  function renvoyer() {
    setRefus(null);
    setRenvoye(false);
    demarrer(async () => {
      const etat = await renvoyerLeCode();
      if (etat.ok) {
        setCode("");
        setMort(false);
        setRenvoye(true);
        return;
      }
      setRefus(etat.refus);
    });
  }

  // La case qui attend le chiffre suivant ; la sixième une fois tout tapé.
  const ici = Math.min(code.length, LONGUEUR_CODE - 1);
  // Les cases rougissent sur le code tapé, pas sur un envoi raté : devant des
  // cases vides, le refus parle de la boîte, pas de la saisie.
  const casesEnRefus = refus !== null && !mort && code.length > 0;

  return (
    <>
      {/* Le chevron du retour montre un SENS : ce n'est pas une flèche
          décorative au bout d'un libellé (`CLAUDE.md` §3). */}
      <button
        type="button"
        onClick={sortir}
        disabled={enCours}
        className="flex min-h-[44px] flex-shrink-0 items-center gap-[6px] self-start pr-[10px] pt-[10px] text-[14px] disabled:opacity-60"
        style={{ color: NUIT.muted }}
      >
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M15 5 8 12l7 7" />
        </svg>
        Retour
      </button>

      <div className="flex flex-1 flex-col justify-center pb-5">
        {/* **L'adresse quitte le titre** (planche du 11 octobre 2026) : en
            24 px, un mot sans espace se coupait n'importe où. Elle reste
            entière et lisible : c'est là qu'il doit regarder. */}
        <h1 className="text-[30px] leading-[1.1] tracking-[-0.01em]" style={SERIF}>
          Le code reçu
        </h1>
        <p className="mt-[10px] text-[15px] leading-[1.45]" style={{ color: NUIT.inkSoft, overflowWrap: "anywhere" }}>
          à <b className="font-medium" style={{ color: NUIT.ink }}>{email}</b>
        </p>

        <div className="relative mt-[26px]">
          <div className="grid grid-cols-6 gap-2" aria-hidden="true">
            {Array.from({ length: LONGUEUR_CODE }, (_, i) => {
              const anneau = casesEnRefus
                ? `inset 0 0 0 1.4px ${NUIT.alerte}`
                : actif && i === ici
                  ? `inset 0 0 0 1.6px ${NUIT.or}`
                  : `inset 0 0 0 1px ${NUIT.line}`;
              return (
                <span
                  key={i}
                  className="grid h-[60px] place-items-center rounded-[14px] text-[27px] leading-none tabular-nums"
                  style={{ background: NUIT.card, boxShadow: anneau, color: enCours ? NUIT.muted : NUIT.ink }}
                >
                  {code[i] ?? ""}
                </span>
              );
            })}
          </div>
          <input
            type="text"
            name="code"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={LONGUEUR_CODE}
            value={code}
            onChange={(e) => {
              if (!mort) setRefus(null);
              setRenvoye(false);
              setCode(e.target.value.replace(/\D/g, "").slice(0, LONGUEUR_CODE));
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") valider();
            }}
            onFocus={() => setActif(true)}
            onBlur={() => setActif(false)}
            aria-label="Le code reçu par e-mail"
            className="absolute inset-0 h-full w-full cursor-text border-0 text-[16px] opacity-0 outline-none"
          />
        </div>

        {/* Hauteur réservée : un refus qui apparaît ne pousse pas le bouton
            sous le doigt. */}
        <p
          className="mt-[14px] min-h-[42px] text-[14px] leading-[21px]"
          role="alert"
          aria-live="polite"
          style={{ color: refus ? NUIT.alerte : NUIT.inkSoft }}
        >
          {refus ?? (renvoye ? "Un nouveau code est parti." : "")}
        </p>
      </div>

      <div className="flex-shrink-0">
        <button
          type="button"
          onClick={valider}
          disabled={enCours}
          className="w-full rounded-full py-4 text-[17px] leading-none transition-transform active:scale-[0.985] disabled:opacity-60"
          style={{ background: NUIT.rust, color: NUIT.cream, ...SERIF }}
        >
          {enCours ? "Un instant…" : mort ? "Renvoyer le code" : "Continuer"}
        </button>
        {!mort && (
          <button
            type="button"
            onClick={renvoyer}
            disabled={enCours}
            className="mt-[6px] min-h-[48px] w-full bg-transparent text-[15px] disabled:opacity-60"
            style={{ color: NUIT.inkSoft }}
          >
            Renvoyer le code
          </button>
        )}
      </div>
    </>
  );
}
