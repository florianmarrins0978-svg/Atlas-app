"use client";

import { useState, useTransition } from "react";
import { CHAMP, NUIT, SERIF } from "@/components/atlas/PorteDeNuit";
import { renvoyerLeCodeAction, verifierLeCodeAction } from "@/app/verifier-email/actions";
import { LONGUEUR_CODE, codeNormalise } from "@/lib/code-verification";

/**
 * LA CASE DU CODE — une seule pièce, deux écrans.
 *
 * Elle est la dix-septième question de la porte (`creer-un-compte`) ET l'écran
 * `/verifier-email` où revient un compte qui n'a pas fini : la même case, le
 * même bouton, le même « Renvoyer ». Deux dessins du même geste se liraient
 * comme deux gestes, et le second aurait divergé au premier ajustement
 * (`CLAUDE.md` §3). Elle est dessinée comme les seize questions d'avant —
 * gélule sombre, titre serif, bouton rouille — pour qu'il ne sente pas qu'il a
 * changé d'écran.
 *
 * **`autoComplete="one-time-code"`** : l'iPhone lit le code dans Mail et le
 * propose au-dessus du clavier. C'est le geste attendu — il n'a pas à
 * recopier six chiffres depuis une autre application.
 */
export default function SaisieDuCode({
  email,
  avertissement,
  onVerifie,
}: {
  /** Où le code est parti — l'adresse ENTIÈRE, c'est là qu'il doit regarder. */
  email: string;
  /** Un envoi raté à la création : dit tout de suite, avec « Renvoyer » sous la main. */
  avertissement?: string;
  onVerifie: () => void;
}) {
  const [code, setCode] = useState("");
  const [refus, setRefus] = useState<string | null>(avertissement ?? null);
  const [renvoye, setRenvoye] = useState(false);
  const [enCours, demarrer] = useTransition();

  function valider() {
    setRenvoye(false);
    // La forme se vérifie ici, avec la même règle que le serveur — pas une
    // seconde règle, la même fonction. Un aller-retour pour dire « six
    // chiffres » ferait attendre le refus le plus simple.
    if (!codeNormalise(code)) {
      setRefus(`Le code fait ${LONGUEUR_CODE} chiffres.`);
      return;
    }
    demarrer(async () => {
      const etat = await verifierLeCodeAction(code);
      if (etat.ok) {
        onVerifie();
        return;
      }
      setRefus(etat.refus);
      // Un code mort ne se retape pas : la case se vide, « Renvoyer » reste.
      if (etat.codeMort) setCode("");
    });
  }

  function renvoyer() {
    setRefus(null);
    setRenvoye(false);
    demarrer(async () => {
      const etat = await renvoyerLeCodeAction();
      if (etat.ok) {
        setCode("");
        setRenvoye(true);
        return;
      }
      setRefus(etat.refus);
    });
  }

  return (
    <>
      <div className="flex flex-1 flex-col justify-center py-6">
        {/* **L'adresse casse où il faut, jamais l'écran.** Vu sur la capture
            du 14 septembre 2026 : « anne-1789378208779@exemple.fr » sortait
            du bord droit — un mot sans espace ne se replie pas tout seul.
            Elle reste entière et lisible : c'est là qu'il doit regarder. */}
        <h1 className="mb-4 text-[30px] leading-[1.1]" style={SERIF}>
          Le code reçu à{" "}
          <span className="break-all text-[24px]">{email}</span>
        </h1>
        <input
          type="text"
          name="code"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={LONGUEUR_CODE + 2}
          placeholder={"0".repeat(LONGUEUR_CODE)}
          value={code}
          onChange={(e) => {
            setRefus(null);
            setCode(e.target.value);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") valider();
          }}
          aria-label="Le code reçu par e-mail"
          className="w-full rounded-full px-5 py-[15px] text-center text-[22px] tracking-[0.35em] outline-none"
          style={CHAMP}
        />
        {/* Même hauteur réservée que sur les seize questions : un refus qui
            apparaît ne pousse pas le bouton sous le doigt. */}
        <p className="mt-3 min-h-[19px] text-[13px] leading-[19px]" role="alert" aria-live="polite" style={{ color: refus ? NUIT.alerte : NUIT.muted }}>
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
          {enCours ? "Un instant…" : "Continuer"}
        </button>
        <button
          type="button"
          onClick={renvoyer}
          disabled={enCours}
          className="w-full bg-transparent pb-1 pt-[13px] text-[14.5px] disabled:opacity-60"
          style={{ color: NUIT.muted }}
        >
          Renvoyer le code
        </button>
      </div>
    </>
  );
}
