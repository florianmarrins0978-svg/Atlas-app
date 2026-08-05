"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { colors } from "@/lib/design-tokens";
import { preparerDevisDepuisDicteeAction } from "./informations/actions";

// Le geste unique : de la dictée au devis.
//
// **Pourquoi ce bouton existe.** Le patron, le 4 août 2026 : « toujours pas de
// devis créé tout seul à partir de la note vocale ! Problème qui traîne. »
// Chaque maillon existait — brouillon, prestations, prix, devis — et chacun
// était éprouvé. Aucun ne menait au suivant : il enchaînait cinq boutons sur
// quatre écrans, et s'il en oubliait un, un devis à 0,00 € l'attendait au bout.
//
// `docs/AGENT.md` §2 décrivait pourtant l'agent qui « transcrit, structure,
// cherche les tarifs, RÉDIGE LE DEVIS », avec **un seul arrêt** : le patron
// vérifie et valide. C'est cet arrêt-là, et lui seul, qui reste.
//
// Ce que le bouton ne fait pas : envoyer. Le devis est préparé, pas parti.

type Props = {
  chantierId: string;
  /** Sans transcription, il n'y a rien à enchaîner : le bouton ne s'affiche pas. */
  transcriptionDisponible: boolean;
  /** Mis en avant sur l'écran Transcription, discret sur l'écran Informations. */
  variante?: "principal" | "secondaire";
};

type Etat =
  | { type: "repos" }
  | { type: "encours" }
  | { type: "conflit" }
  | { type: "message"; texte: string };

export default function DevisDepuisDictee({ chantierId, transcriptionDisponible, variante = "principal" }: Props) {
  const router = useRouter();
  const [etat, setEtat] = useState<Etat>({ type: "repos" });

  async function lancer(remplacer = false) {
    setEtat({ type: "encours" });
    try {
      const r = await preparerDevisDepuisDicteeAction(chantierId, remplacer);
      if (r.statut === "prepare") {
        // **On l'emmène droit au devis.** Il l'a demandé le 5 août 2026 : « une
        // fois qu'on valide la note vocale, cette page s'ouvre, j'ai accès à la
        // page où il n'y a que le devis, et là je fais mes modifications. Je ne
        // veux pas tous les autres trucs intermédiaires. »
        //
        // Le compte rendu qui s'affichait ici — ce qui a été retenu, à
        // combien — était un écran de plus entre sa dictée et son devis. Ce
        // qu'il devait dire se lit maintenant sur le devis lui-même : les
        // lignes y sont, le total aussi, et la mention « recopiée mot à mot »
        // s'affiche là-bas quand aucun modèle n'a compris la dictée.
        router.push(`/chantiers/${chantierId}/devis-complet`);
        return;
      }
      if (r.statut === "conflit") return setEtat({ type: "conflit" });
      if (r.statut === "transcription_absente") {
        return setEtat({ type: "message", texte: "Aucune dictée transcrite sur ce chantier : il n'y a rien à reprendre." });
      }
      if (r.statut === "transcription_simulee") {
        return setEtat({
          type: "message",
          texte:
            "Votre dictée n'a pas été transcrite : aucun prestataire de transcription n'est encore raccordé. " +
            "Écrivez ce que vous avez dit sur l'écran Transcription, et le devis se fera à partir de là.",
        });
      }
      setEtat({ type: "message", texte: r.erreur });
    } catch {
      setEtat({ type: "message", texte: "La préparation n'a pas abouti. Réessayez." });
    }
  }

  if (!transcriptionDisponible) return null;

  return (
    <div className="flex flex-col gap-2">
      {variante === "principal" ? (
        <button
          type="button"
          onClick={() => lancer()}
          disabled={etat.type === "encours"}
          className="w-full rounded-2xl py-3.5 text-[15px] font-medium text-white disabled:opacity-40"
          style={{ backgroundColor: colors.rust }}
        >
          {etat.type === "encours" ? "Atlas prépare le devis…" : "Créer le devis à partir de ma dictée"}
        </button>
      ) : (
        <button
          type="button"
          onClick={() => lancer()}
          disabled={etat.type === "encours"}
          className="self-start text-[14px] font-medium disabled:opacity-40"
          style={{ color: colors.rust }}
        >
          {etat.type === "encours" ? "Atlas prépare le devis…" : "Aller jusqu'au devis d'un seul geste →"}
        </button>
      )}

      {etat.type === "repos" && variante === "principal" && (
        <p className="text-center text-[12px]" style={{ color: colors.muted }}>
          Prestations, durée, équipe, prix : tout est repris de ce que vous avez dit. Rien ne part au client.
        </p>
      )}

      {etat.type === "message" && (
        <p role="alert" className="text-[13px]" style={{ color: colors.alert }}>
          {etat.texte}
        </p>
      )}

      {etat.type === "conflit" && (
        <div className="rounded-2xl px-4 py-3" style={{ backgroundColor: colors.rustTint }}>
          <p className="text-[13px]" style={{ color: colors.rust }}>
            Vous avez corrigé ce brouillon à la main. Repartir de la dictée effacerait vos corrections.
          </p>
          <div className="mt-3 flex flex-col gap-2">
            <button
              type="button"
              onClick={() => setEtat({ type: "repos" })}
              className="rounded-2xl py-2.5 text-[14px] font-medium"
              style={{ backgroundColor: colors.card, color: colors.ink }}
            >
              Conserver mes corrections
            </button>
            <button
              type="button"
              onClick={() => lancer(true)}
              className="text-[14px] font-medium"
              style={{ color: colors.alert }}
            >
              Repartir de la dictée
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
