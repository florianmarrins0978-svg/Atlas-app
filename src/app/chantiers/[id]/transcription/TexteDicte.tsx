"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { colors, libelleCaps, texteSituation } from "@/lib/design-tokens";
import PrimaryButton from "@/components/atlas/PrimaryButton";
import { enregistrerTexteDicteAction } from "./actions";

// Saisie du texte de la dictée, par le patron lui-même.
//
// La dictée reste le but ; ceci est le filet — quand elle n'est pas transcrite,
// quand le prestataire a rendu une erreur, ou quand elle l'est de travers. Le
// patron écrit ce qu'il vient de dire, avec ses mots de métier, et c'est
// justement sur son vocabulaire que l'extraction doit être mise à l'épreuve.
//
// **La raison de la panne n'est plus répétée ici** (5 septembre 2026) : l'écran
// la dit juste au-dessus, dans l'état où il se trouve. La redire en ferait deux
// fois le même paragraphe.

type Props = {
  chantierId: string;
  texteActuel: string;
  /** La case s'ouvre d'emblée : quand écrire est la seule chose utile. */
  ouvrir: boolean;
  /** Ce que dit le bouton tant que la case est fermée. */
  libelleFerme?: string;
  /**
   * Où se pose ce bouton tant qu'il est fermé.
   *
   * **Vu en capture, et invisible autrement :** dans l'état « échec », il
   * s'affichait CENTRÉ juste sous « Relancer depuis la note vocale », qui est
   * aligné à gauche. Deux gestes de même rang, deux alignements — c'est
   * exactement le genre de détail qu'aucun test ne voit et que l'œil accroche.
   * Sous les actions centrées de l'état « écoutée », en revanche, le centre est
   * le bon choix.
   */
  aligne?: "gauche" | "centre";
};

export default function TexteDicte({ chantierId, texteActuel, ouvrir, libelleFerme, aligne = "centre" }: Props) {
  const router = useRouter();
  const [texte, setTexte] = useState(texteActuel);
  const [ouvert, setOuvert] = useState(ouvrir);
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
        className={`mt-6 block w-full px-6 ${aligne === "centre" ? "text-center" : "text-left"} ${libelleCaps}`}
        style={{ color: colors.rust }}
      >
        {libelleFerme ?? "Corriger le texte à la main"}
      </button>
    );
  }

  return (
    <div className="mx-6 mt-6 rounded-[4px] px-5 py-5" style={{ backgroundColor: colors.card }}>
      <p className={libelleCaps} style={{ color: colors.rust, marginBottom: 10 }}>
        Écrire ce que vous avez dit
      </p>

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
        className="w-full rounded-[4px] px-3 py-3 text-[15px] leading-relaxed"
        style={{ backgroundColor: colors.cream, color: colors.ink, border: `1px solid ${colors.rustTint}` }}
      />

      {erreur && (
        <p className="mt-2 text-[13px]" style={{ color: colors.alert }}>
          {erreur}
        </p>
      )}
      {enregistre && !erreur && (
        <>
          <p className={`mt-2 ${texteSituation}`} style={{ color: colors.muted }}>
            Texte enregistré.
          </p>
          {/* Sans ce lien, le patron reste sur cet écran sans savoir que la
              suite l'attend ailleurs — et conclut qu'il ne s'est rien passé. */}
          <a
            href={`/chantiers/${chantierId}/informations`}
            className={`mt-2 block ${libelleCaps}`}
            style={{ color: colors.rust }}
          >
            Continuer vers les informations
          </a>
        </>
      )}

      {/* Un bouton grisé sans explication ressemble à un bouton en panne. */}
      {texte.trim().length === 0 && (
        <p className={`mt-2 ${texteSituation}`} style={{ color: colors.muted }}>
          Le bouton s&apos;active dès que vous écrivez.
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
