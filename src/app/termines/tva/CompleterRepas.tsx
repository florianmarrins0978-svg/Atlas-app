"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { colors, font, libelleCaps } from "@/lib/design-tokens";
import BottomSheet from "@/components/atlas/BottomSheet";
import { recuperation } from "@/lib/achat-tva";
import PreuvesRepas from "./PreuvesRepas";
import { completerRepasAction } from "./actions";

/**
 * Compléter un repas d'affaires noté sans ses preuves.
 *
 * *Sa question du 13 octobre 2026 : « si on n'a pas de stylo pour l'écrire sur
 * le ticket, comment on fait ? »* On l'écrit plus tard, dans le camion, puis
 * on complète ici : le repas compte dès que les trois preuves sont là. Le
 * serveur le recalcule par la même règle (`completerRepasAchat`).
 */
export default function CompleterRepas({
  id,
  avecQui: avecQuiInitial,
  pourquoi: pourquoiInitial,
  justificatif: justificatifInitial,
  totalTtc,
  tauxTva,
  tvaTicket,
}: {
  id: string;
  avecQui: string | null;
  pourquoi: string | null;
  justificatif: boolean;
  totalTtc: number | null;
  tauxTva: number | null;
  tvaTicket: number;
}) {
  const router = useRouter();
  const [ouverte, setOuverte] = useState(false);
  const [enCours, setEnCours] = useState(false);
  const [refus, setRefus] = useState<string | null>(null);
  const [avecQui, setAvecQui] = useState(avecQuiInitial ?? "");
  const [pourquoi, setPourquoi] = useState(pourquoiInitial ?? "");
  const [justificatif, setJustificatif] = useState(justificatifInitial);

  const { manques } = recuperation({
    nature: "repas",
    vehicule: null,
    repas: "affaires",
    avecQui,
    pourquoi,
    justificatif,
    totalTtc,
    tauxTva,
    tvaTicket,
  });

  async function enregistrer() {
    setEnCours(true);
    setRefus(null);
    const fd = new FormData();
    fd.set("avecQui", avecQui);
    fd.set("pourquoi", pourquoi);
    if (justificatif) fd.set("justificatif", "oui");
    const r = await completerRepasAction(id, fd);
    setEnCours(false);
    if (!r.ok) {
      setRefus(r.raison);
      return;
    }
    setOuverte(false);
    router.refresh();
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOuverte(true)}
        data-atlas="completer-repas"
        className="mt-2 rounded-full px-3.5 py-2 text-[12.5px]"
        style={{ border: `1px solid ${colors.line}`, color: colors.inkSoft }}
      >
        Compléter
      </button>

      <BottomSheet open={ouverte} onBackdropClick={() => setOuverte(false)}>
        <p className={`text-center ${libelleCaps}`} style={{ color: colors.or }}>
          Repas d’affaires
        </p>
        <p className="mb-3.5 mt-2 text-center text-[20px]" style={{ fontFamily: font.display }}>
          Ses preuves
        </p>
        <div className="flex flex-col gap-px overflow-hidden rounded-xl" style={{ backgroundColor: colors.lineSoft }}>
          <PreuvesRepas
            avecQui={avecQui}
            pourquoi={pourquoi}
            justificatif={justificatif}
            totalTtc={totalTtc}
            tauxTva={tauxTva}
            onAvecQui={setAvecQui}
            onPourquoi={setPourquoi}
            onJustificatif={setJustificatif}
          />
        </div>
        {manques.length > 0 && (
          <p
            className="mt-2.5 rounded-xl px-3.5 py-3 text-[12.5px] leading-[1.5]"
            style={{ backgroundColor: colors.rustTint, color: colors.inkSoft }}
          >
            Tant qu’il manque une preuve, sa TVA ne compte pas.
          </p>
        )}
        {refus && (
          <p role="alert" className="mt-2.5 text-center text-[13px]" style={{ color: colors.alert }}>
            {refus}
          </p>
        )}
        <button
          type="button"
          onClick={enregistrer}
          disabled={enCours}
          className="atlas-plein mt-3 w-full rounded-full py-[15px] text-[15px]"
          style={{ backgroundColor: colors.plein, color: colors.cream, fontFamily: font.display, opacity: enCours ? 0.35 : 1 }}
        >
          {enCours ? "Enregistrement…" : "Enregistrer"}
        </button>
        <button
          type="button"
          onClick={() => setOuverte(false)}
          className="mt-1.5 w-full rounded-full py-3 text-[14.5px]"
          style={{ color: colors.muted }}
        >
          Annuler
        </button>
      </BottomSheet>
    </>
  );
}
