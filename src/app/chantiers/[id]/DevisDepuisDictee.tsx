"use client";

import { useState } from "react";
import { colors, font, smallCaps } from "@/lib/design-tokens";
import { enEuros } from "@/lib/euros";
import type { RapportDevisDepuisDictee } from "@/server/services/devis-depuis-dictee";
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
  | { type: "fait"; rapport: RapportDevisDepuisDictee }
  | { type: "conflit" }
  | { type: "message"; texte: string };

export default function DevisDepuisDictee({ chantierId, transcriptionDisponible, variante = "principal" }: Props) {
  const [etat, setEtat] = useState<Etat>({ type: "repos" });

  async function lancer(remplacer = false) {
    setEtat({ type: "encours" });
    try {
      const r = await preparerDevisDepuisDicteeAction(chantierId, remplacer);
      if (r.statut === "prepare") return setEtat({ type: "fait", rapport: r.rapport });
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

  if (etat.type === "fait") return <Rapport chantierId={chantierId} rapport={etat.rapport} />;

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

// Ce que le patron doit voir tout de suite : ce qui a été retenu, à combien, et
// ce qui reste à regarder. Pas un « c'est fait » sans contenu — il n'aurait
// aucun moyen de savoir si Atlas a compris sa dictée ou l'a massacrée.
function Rapport({ chantierId, rapport }: { chantierId: string; rapport: RapportDevisDepuisDictee }) {
  const lignes = [
    ...rapport.prestations.map((p) => ({ cle: `p-${p}`, texte: p })),
    ...rapport.materiel.map((m) => ({ cle: `m-${m}`, texte: m })),
  ];

  return (
    <div className="flex flex-col gap-3 rounded-2xl p-4" style={{ backgroundColor: colors.card }}>
      <span className={smallCaps} style={{ color: colors.muted }}>
        Devis préparé
      </span>

      {rapport.lecture === "litterale" && (
        <p className="text-[13px]" style={{ color: colors.rust }}>
          Votre dictée a été recopiée mot à mot : aucun modèle n&apos;était disponible pour la comprendre.
          Relisez les lignes de près.
        </p>
      )}

      <p className="text-[26px]" style={{ fontFamily: font.display }}>
        {enEuros(rapport.totalHt)} HT
      </p>

      {rapport.prix ? (
        <p className="text-[13px]" style={{ color: colors.muted }}>
          {rapport.prix.origine === "tarif"
            ? `Repris de votre tarif « ${rapport.prix.libelle} ».`
            : `Calculé depuis vos paramètres : ${rapport.prix.libelle}.`}
        </p>
      ) : (
        <p className="text-[13px]" style={{ color: colors.alert }}>
          {rapport.prixImpossible ?? "Aucun prix n'a pu être proposé."}
        </p>
      )}

      {lignes.length > 0 && (
        <div className="flex flex-col gap-1">
          {lignes.map((l) => (
            <p key={l.cle} className="text-[14px]">
              {l.texte}
            </p>
          ))}
        </div>
      )}

      {(rapport.dureePrevue || rapport.tailleEquipe) && (
        <p className="text-[13px]" style={{ color: colors.muted }}>
          {[rapport.dureePrevue, rapport.tailleEquipe].filter(Boolean).join(" · ")}
        </p>
      )}

      {rapport.aVerifier.length > 0 && (
        <div>
          <span className={smallCaps} style={{ color: colors.muted }}>
            À regarder
          </span>
          {rapport.aVerifier.map((a, i) => (
            <p key={i} className="text-[13px]" style={{ color: colors.muted }}>
              {a}
            </p>
          ))}
        </div>
      )}

      <a
        href={`/chantiers/${chantierId}/export`}
        className="mt-1 block w-full rounded-2xl py-3 text-center text-[15px] font-medium text-white"
        style={{ backgroundColor: colors.rust }}
      >
        Voir le devis
      </a>
      <p className="text-center text-[12px]" style={{ color: colors.muted }}>
        Rien n&apos;est parti : c&apos;est vous qui décidez de l&apos;envoyer.
      </p>
    </div>
  );
}
