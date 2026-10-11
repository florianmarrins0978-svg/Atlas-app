"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { colors, font } from "@/lib/design-tokens";
import { codeAction } from "./actions";

/**
 * Le code de l'appli, ou un code de secours : un seul champ, deux textes.
 *
 * **« Ne plus demander sur cet appareil » est coché d'office** : sa réponse
 * « oui » sur la planche. Décoché, le code revient à chaque connexion par mot
 * de passe sur ce téléphone.
 */
export default function FormulaireCode() {
  const [etat, action, enCours] = useActionState(codeAction, undefined);
  const [secours, setSecours] = useState(false);

  return (
    <form action={action} className="flex w-full max-w-[342px] flex-1 flex-col self-center">
      {/* Le chevron montre un SENS, le retour à la porte (`CLAUDE.md` §3). */}
      <Link
        href="/login"
        className="flex flex-shrink-0 items-center gap-[6px] self-start py-2 pr-[10px] pt-[10px] text-[14px]"
        style={{ color: colors.muted }}
        aria-label="Revenir à la connexion"
      >
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M15 5 8 12l7 7" />
        </svg>
        Retour
      </Link>

      <div className="h-[32px] flex-none" aria-hidden="true" />

      <h1
        className="mb-[10px] text-center text-[34px] leading-[1.1]"
        style={{ fontFamily: "ui-serif, Georgia, serif", letterSpacing: "-0.01em" }}
      >
        {secours ? "Code de secours" : "Le code"}
      </h1>
      <p className="mb-[36px] text-center text-[14.5px]" style={{ color: colors.muted }}>
        {secours ? "Un de ceux que vous avez notés." : "Celui de votre appli d'authentification."}
      </p>

      <input
        key={secours ? "secours" : "appli"}
        name="code"
        required
        autoFocus
        aria-label={secours ? "Code de secours" : "Code"}
        placeholder={secours ? "XXXX-XXXX" : "000000"}
        inputMode={secours ? "text" : "numeric"}
        autoComplete={secours ? "off" : "one-time-code"}
        autoCapitalize="characters"
        maxLength={secours ? 10 : 7}
        className="atlas-champ-gelule text-center text-[22px] tracking-[0.3em]"
        data-atlas="code-double-verification"
      />

      <label className="mt-[18px] flex items-center gap-[10px] text-[14.5px]">
        <input type="checkbox" name="retenir" defaultChecked className="h-5 w-5" style={{ accentColor: colors.or }} />
        Ne plus demander sur cet appareil
      </label>

      <p
        className="mb-[6px] mt-[12px] min-h-[19px] text-[13px] leading-[19px]"
        style={{ color: colors.alert }}
        role="alert"
        aria-live="polite"
      >
        {etat?.erreur ?? ""}
      </p>

      {etat?.recommencer ? (
        <Link
          href="/login"
          className="atlas-plein w-full rounded-full py-[18px] text-center text-[17px]"
          style={{ backgroundColor: colors.plein, color: colors.card, fontFamily: font.display }}
        >
          Retour à la connexion
        </Link>
      ) : (
        <button
          type="submit"
          disabled={enCours}
          className="atlas-plein w-full rounded-full py-[18px] text-[17px] transition-transform active:scale-[0.985] disabled:opacity-60"
          style={{
            backgroundColor: colors.plein,
            backgroundImage: `linear-gradient(100deg, ${colors.plein}, color-mix(in srgb, ${colors.or} 35%, ${colors.plein}))`,
            color: colors.card,
            fontFamily: font.display,
          }}
        >
          {enCours ? "Vérification…" : "Entrer"}
        </button>
      )}

      <button
        type="button"
        onClick={() => setSecours((s) => !s)}
        className="mt-[18px] self-center px-2 py-2 text-[14.5px]"
        style={{ color: colors.or }}
      >
        {secours ? "Utiliser l'appli" : "Utiliser un code de secours"}
      </button>

      <div className="min-h-[24px] flex-1" aria-hidden="true" />
    </form>
  );
}
