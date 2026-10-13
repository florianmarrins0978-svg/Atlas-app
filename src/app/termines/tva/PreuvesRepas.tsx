"use client";

import { colors } from "@/lib/design-tokens";
import { factureRepasExigee } from "@/lib/achat-tva";

/**
 * Les trois preuves d'un repas d'affaires : avec qui, pourquoi, et la pièce.
 *
 * *Sa consigne du 13 octobre 2026 : « qu'on ne puisse pas nous reprocher quoi
 * que ce soit ».* BOI-TVA-DECLA-30-20-20 § 140 et 150 : jusqu'à 150 € HT, la
 * note du restaurant suffit SI le client y écrit le nom et l'adresse de son
 * entreprise ; au delà, il faut une facture à son nom. Planche :
 * `appli/tva-ticket-carburant.html`.
 *
 * **La mention se coche, elle ne s'écrit pas ici** — sa question, *« si on n'a
 * pas de stylo ? »*. Le texte exige qu'elle soit SUR LA NOTE : une case dans
 * l'application donnerait l'air d'être en règle sans l'être. Sans stylo, on
 * l'écrit plus tard, puis on complète le repas depuis la liste.
 *
 * Un seul composant pour la feuille du ticket et pour « Compléter » : deux
 * copies de ces trois cases finiraient par ne plus demander la même chose
 * (`CLAUDE.md` §3).
 */
export default function PreuvesRepas({
  avecQui,
  pourquoi,
  justificatif,
  totalTtc,
  tauxTva,
  onAvecQui,
  onPourquoi,
  onJustificatif,
}: {
  avecQui: string;
  pourquoi: string;
  justificatif: boolean;
  totalTtc: number | null;
  tauxTva: number | null;
  onAvecQui: (v: string) => void;
  onPourquoi: (v: string) => void;
  onJustificatif: (v: boolean) => void;
}) {
  const facture = factureRepasExigee(totalTtc, tauxTva);
  return (
    <>
      <label className="flex items-center justify-between gap-3 px-[15px] py-[13px]" style={{ backgroundColor: colors.card }}>
        <span className="flex-shrink-0 text-[13px]" style={{ color: colors.muted }}>Avec qui</span>
        <input
          value={avecQui}
          onChange={(e) => onAvecQui(e.target.value)}
          placeholder="M. Durand, Durand Immobilier"
          data-atlas="repas-avec-qui"
          className="w-full min-w-0 bg-transparent text-right text-[15.5px] outline-none"
        />
      </label>
      <label className="flex items-center justify-between gap-3 px-[15px] py-[13px]" style={{ backgroundColor: colors.card }}>
        <span className="flex-shrink-0 text-[13px]" style={{ color: colors.muted }}>Pourquoi</span>
        <input
          value={pourquoi}
          onChange={(e) => onPourquoi(e.target.value)}
          placeholder="Devis du jardin"
          data-atlas="repas-pourquoi"
          className="w-full min-w-0 bg-transparent text-right text-[15.5px] outline-none"
        />
      </label>
      <label
        className="flex min-h-[50px] cursor-pointer items-start gap-3 px-[15px] py-[13px] text-[13.5px] leading-[1.4]"
        style={{ backgroundColor: colors.card, color: colors.ink }}
      >
        <input
          type="checkbox"
          checked={justificatif}
          onChange={(e) => onJustificatif(e.target.checked)}
          data-atlas="repas-justificatif"
          className="mt-px h-5 w-5 flex-shrink-0"
          style={{ accentColor: colors.plein }}
        />
        {/* La pièce exigée change avec le montant : la coche dit laquelle, au
            lieu d'une phrase qui expliquerait le seuil. */}
        <span>
          {facture
            ? "J’ai une facture au nom de mon entreprise. Au delà de 150 € HT, la note ne suffit pas."
            : "Le nom et l’adresse de mon entreprise sont écrits sur la note."}
        </span>
      </label>
    </>
  );
}
