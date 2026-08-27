"use client";

import { useState } from "react";
import BottomSheet from "./BottomSheet";
import PrimaryButton from "./PrimaryButton";
import { colors, libelleCaps } from "@/lib/design-tokens";
import { prouverParMotDePasseAction } from "@/app/reglages/connexion/preuve-actions";

/**
 * « Vérifiez que c'est bien vous » — la feuille qui obtient une preuve récente.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * **CE COMPOSANT N'AUTORISE RIEN, ET C'EST LE POINT LE PLUS IMPORTANT.**
 *
 * Il ne rend aucun jeton, ne pose aucun drapeau, n'envoie aucun
 * `reauthenticated: true`. Il appelle une action serveur qui confronte le mot de
 * passe à la base (M9) et, seulement si c'est juste, **écrit une ligne côté
 * serveur** attachée à l'identité de cette session
 * (`src/server/preuve-recente.ts`).
 *
 * Mentir ici ne donnerait aucun droit : le geste sensible revérifie la preuve en
 * base, et refuse encore.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * **CE QU'IL DIT, ET POURQUOI IL LE DIT.** Le message vient du geste demandé
 * (`messagePreuveExigee`), pas d'une phrase générique : « vérifiez que c'est
 * bien vous » sans raison paraît arbitraire, et l'artisan cherche ce qu'il a
 * fait de mal. « Vos coordonnées bancaires figurent sur vos factures » se
 * comprend en une lecture.
 *
 * **L'apparence est celle de la maison** — `BottomSheet`, `PrimaryButton`, les
 * jetons de couleur —, jamais un dessin inventé ici : sept chartes cohabitent,
 * dont deux sombres, et une couleur écrite en clair y serait illisible
 * (`CLAUDE.md` §3).
 */
export default function DemanderPreuve({
  ouvert,
  motif,
  onAbandon,
  onProuve,
}: {
  ouvert: boolean;
  /** Ce que le serveur a répondu — il dit POURQUOI on redemande. */
  motif: string;
  onAbandon: () => void;
  /** Appelé une fois la preuve POSÉE : l'écran peut reprendre son geste. */
  onProuve: () => void;
}) {
  const [motDePasse, setMotDePasse] = useState("");
  const [refus, setRefus] = useState<string | null>(null);
  const [enCours, setEnCours] = useState(false);

  async function prouver() {
    setEnCours(true);
    setRefus(null);
    try {
      const r = await prouverParMotDePasseAction(motDePasse);
      if (!r.ok) {
        setRefus(r.raison);
        return;
      }
      // On oublie la saisie avant de rendre la main : elle n'a plus à vivre.
      setMotDePasse("");
      onProuve();
    } catch {
      // Le message d'une exception levée par une action serveur n'arrive jamais
      // jusqu'à l'artisan (`HANDOVER.md`, piège 0 ter) : on en pose un ici.
      setRefus("La vérification n'a pas abouti. Réessayez.");
    } finally {
      setEnCours(false);
    }
  }

  return (
    <BottomSheet open={ouvert} onBackdropClick={onAbandon}>
      {/* **Un repère stable, pour que les contrôles accusent le bon coupable.**
          Cherchée par son libellé, cette feuille se confondait avec le motif
          juste dessous, qui reprend les mêmes mots — et le contrôle mourait sur
          une ambiguïté plutôt que sur ce qu'il défend. */}
      <p
        data-atlas="demander-preuve"
        className="mb-2 text-center text-[17px]"
        style={{ color: colors.ink }}
      >
        Vérifiez que c&apos;est bien vous
      </p>
      <p className="mb-5 text-center text-[13px] leading-[1.5]" style={{ color: colors.muted }}>
        {motif}
      </p>

      <div className="border-b py-[13px]" style={{ borderColor: colors.line }}>
        <span className={`mb-[5px] block ${libelleCaps}`} style={{ color: colors.muted }}>
          Votre mot de passe
        </span>
        <input
          type="password"
          value={motDePasse}
          autoComplete="current-password"
          aria-label="Votre mot de passe"
          onChange={(e) => setMotDePasse(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && motDePasse !== "" && !enCours) void prouver();
          }}
          className="w-full border-0 bg-transparent p-0 outline-none"
          // 16 px au moins : en dessous, iOS agrandit la page à la mise au point.
          style={{ fontSize: 17, lineHeight: 1.35, color: colors.ink, letterSpacing: "0.18em" }}
        />
      </div>

      {refus && (
        <p role="alert" className="mt-3 text-center text-[13px]" style={{ color: colors.alert }}>
          {refus}
        </p>
      )}

      <div className="mt-6">
        <PrimaryButton disabled={enCours || motDePasse === ""} onClick={prouver} repere="prouver-identite">
          {enCours ? "Vérification…" : "Continuer"}
        </PrimaryButton>
      </div>

      <button
        type="button"
        onClick={onAbandon}
        className="mt-4 block w-full text-center text-[13px]"
        style={{ color: colors.muted }}
      >
        Annuler
      </button>
    </BottomSheet>
  );
}
