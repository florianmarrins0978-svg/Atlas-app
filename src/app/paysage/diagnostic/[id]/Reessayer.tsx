"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import PrimaryButton from "@/components/atlas/PrimaryButton";
import { colors, font } from "@/lib/design-tokens";
import { reprendreAnalyseAction } from "../actions";

/**
 * Les deux gestes qui SERVENT quand personne n'a regardé la photo.
 *
 * Sa planche du 11 septembre 2026. L'écran n'offrait que « Nouvelle photo »,
 * juste sous *« ce n'est pas la photo qui est en cause »* — le seul geste
 * proposé était celui qui ne pouvait rien réparer. Ici : réessayer avec la
 * photo déjà prise (elle est rangée dès l'arrivée, c'est fait pour ça), ou
 * aller voir ce que Réglages dit de l'IA.
 *
 * **L'attente est dite et le bouton se désarme**, comme pour la première
 * photo : un appel de vision prend plusieurs secondes, et deux appuis
 * feraient deux analyses.
 */
export default function Reessayer({ diagnosticId }: { diagnosticId: string }) {
  const [phrase, setPhrase] = useState<string | null>(null);
  const [enCours, demarrer] = useTransition();
  const router = useRouter();

  return (
    <div className="flex flex-col items-center gap-[14px]" data-atlas="diagnostic-reessayer">
      <PrimaryButton
        repere="reessayer-diagnostic"
        disabled={enCours}
        onClick={() =>
          demarrer(async () => {
            setPhrase(null);
            const r = await reprendreAnalyseAction(diagnosticId);
            if (!r.ok) {
              setPhrase(r.phrase);
              return;
            }
            router.refresh();
          })
        }
      >
        {enCours ? "Analyse en cours…" : "Réessayer"}
      </PrimaryButton>

      <Link
        href="/reglages/ia"
        className="inline-flex items-center justify-center px-9 py-[13px] text-[17px]"
        style={{
          borderRadius: 9999,
          fontFamily: font.display,
          color: colors.rust,
          border: `1px solid ${colors.line}`,
        }}
      >
        Réglages de l’IA
      </Link>

      {phrase && (
        <p className="text-center text-[12.5px]" style={{ color: colors.alert }}>
          {phrase}
        </p>
      )}
    </div>
  );
}
