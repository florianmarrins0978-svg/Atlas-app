"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { colors, smallCaps } from "@/lib/design-tokens";
import PrimaryButton from "@/components/atlas/PrimaryButton";
import { enregistrerTexteDicteAction } from "./actions";

// Saisie du texte de la dictée, par le patron lui-même.
//
// La dictée reste le but ; ceci est le filet. Tant qu'aucun prestataire de
// transcription n'est raccordé (docs/A-FAIRE.md §1), rien de ce qui suit la
// transcription ne peut être éprouvé : ni l'extraction, ni le brouillon, ni les
// prestations, ni le prix. Le patron écrit donc ce qu'il vient de dire, avec ses
// mots de métier — et c'est justement sur son vocabulaire que l'extraction
// doit être mise à l'épreuve, pas sur un exemple choisi par nous.

type Props = {
  chantierId: string;
  texteActuel: string;
  /** Vrai quand le texte affiché est notre texte de remplacement, pas une dictée. */
  simulee: boolean;
};

export default function TexteDicte({ chantierId, texteActuel, simulee }: Props) {
  const router = useRouter();
  // Le texte de remplacement n'est jamais proposé à la correction : ce n'est
  // pas une transcription imparfaite, c'est l'absence de transcription.
  const [texte, setTexte] = useState(simulee ? "" : texteActuel);
  const [ouvert, setOuvert] = useState(simulee);
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [enregistre, setEnregistre] = useState(false);

  async function enregistrer() {
    setEnCours(true);
    setErreur(null);
    try {
      const r = await enregistrerTexteDicteAction(chantierId, texte);
      if (!r.succes) {
        setErreur(r.erreur);
        return;
      }
      setEnregistre(true);
      router.refresh();
    } catch {
      setErreur("Le texte n'a pas pu être enregistré. Vérifiez votre connexion.");
    } finally {
      setEnCours(false);
    }
  }

  if (!ouvert) {
    return (
      <button
        type="button"
        onClick={() => setOuvert(true)}
        className="mt-5 block w-full px-6 text-center text-[14px] font-medium"
        style={{ color: colors.rust }}
      >
        Corriger le texte à la main
      </button>
    );
  }

  return (
    <div className="mx-6 mt-5 rounded-2xl px-5 py-5" style={{ backgroundColor: colors.card }}>
      <p className={smallCaps} style={{ color: colors.rust, marginBottom: 8 }}>
        Écrire ce que vous avez dit
      </p>

      {/* La raison est déjà donnée juste au-dessus, dans le bloc d'état : la
          répéter ici en ferait deux fois le même paragraphe à l'écran. Ne
          rester que sur ce que le patron doit faire. */}
      {simulee && (
        <p className="mb-3 text-[13px] leading-relaxed" style={{ color: colors.muted }}>
          Écrivez-le ici, avec vos mots : tout le reste du parcours s&apos;enchaînera
          normalement.
        </p>
      )}

      <label htmlFor="texte-dicte" className="sr-only">
        Texte de la dictée
      </label>
      {/* L'exemple porte « Exemple : » en tête, et c'est délibéré : un texte de
          remplacement qui ressemble à une vraie phrase se prend pour du contenu
          déjà saisi. Le patron a cru le champ rempli, a appuyé sur un bouton
          grisé, et en a conclu que l'application ne marchait pas. */}
      <textarea
        id="texte-dicte"
        value={texte}
        onChange={(e) => {
          setTexte(e.target.value);
          setEnregistre(false);
        }}
        rows={6}
        placeholder="Exemple : élagage du grand chêne au fond du jardin, deux jours à deux, broyage sur place…"
        className="w-full rounded-xl px-3 py-3 text-[15px] leading-relaxed"
        style={{ backgroundColor: colors.cream, color: colors.ink, border: `1px solid ${colors.rustTint}` }}
      />

      {erreur && (
        <p className="mt-2 text-[13px]" style={{ color: colors.rust }}>
          {erreur}
        </p>
      )}
      {enregistre && !erreur && (
        <>
          <p className="mt-2 text-[13px]" style={{ color: colors.muted }}>
            Texte enregistré.
          </p>
          {/* Sans ce lien, le patron reste sur cet écran sans savoir que la
              suite l'attend ailleurs — et conclut qu'il ne s'est rien passé. */}
          <a
            href={`/chantiers/${chantierId}/informations`}
            className="mt-1 block text-[14px] font-medium"
            style={{ color: colors.rust }}
          >
            Continuer vers les informations →
          </a>
        </>
      )}

      {/* Un bouton grisé sans explication ressemble à un bouton en panne. */}
      {texte.trim().length === 0 && (
        <p className="mt-2 text-[13px]" style={{ color: colors.muted }}>
          Écrivez d&apos;abord votre texte ci-dessus — le bouton s&apos;activera.
        </p>
      )}

      <div className="mt-4">
        <PrimaryButton onClick={enregistrer} disabled={enCours || texte.trim().length === 0}>
          {enCours ? "Enregistrement…" : "Enregistrer le texte"}
        </PrimaryButton>
      </div>
    </div>
  );
}
