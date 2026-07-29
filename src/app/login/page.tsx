"use client";

import { useActionState } from "react";
import { connexionAction } from "./actions";

export default function LoginPage() {
  const [etat, action, enCours] = useActionState(connexionAction, undefined);

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#F4EFE8] p-6">
      <form action={action} className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-sm">
        <h1 className="mb-6 text-[22px] font-semibold text-ink" style={{ fontFamily: "ui-serif, Georgia, serif" }}>
          Connexion à Atlas
        </h1>

        <label className="mb-1 block text-xs font-medium text-ink/60">Email</label>
        <input
          name="email"
          type="email"
          required
          autoComplete="username"
          className="mb-4 w-full rounded-xl border border-black/10 px-4 py-2.5 text-[15px]"
        />

        <label className="mb-1 block text-xs font-medium text-ink/60">Mot de passe</label>
        <input
          name="password"
          type="password"
          required
          autoComplete="current-password"
          className="mb-4 w-full rounded-xl border border-black/10 px-4 py-2.5 text-[15px]"
        />

        {etat?.erreur && <p className="mb-4 text-[13px] text-red-600">{etat.erreur}</p>}

        <button
          type="submit"
          disabled={enCours}
          className="w-full rounded-xl bg-[#B5502F] py-3 text-[15px] font-medium text-white disabled:opacity-50"
        >
          {enCours ? "Connexion…" : "Se connecter"}
        </button>
      </form>
    </div>
  );
}
