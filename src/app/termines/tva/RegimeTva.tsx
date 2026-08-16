"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { colors } from "@/lib/design-tokens";
import { reglerExigibiliteAction } from "./actions";
import type { Exigibilite } from "@/lib/exigibilite-tva";

/**
 * Quand la TVA devient exigible — le réglage, posé là où la question se pose.
 *
 * **Sa question du 14 août 2026 :** *« si un client décide de ne pas me payer,
 * je vais avoir des problèmes. »* Il avait raison : pour une prestation de
 * services, la TVA est due **à l'encaissement** (CGI art. 269-2-c), et les
 * débits sont une **option** qui se demande à l'administration.
 *
 * **Ce n'est pas une préférence d'écran, c'est une DÉCLARATION.** D'où la
 * phrase qui accompagne le choix : ce que le patron coche ici doit correspondre
 * à ce que les impôts savent de lui. Le même parti que la périodicité
 * (`RythmeTva`), pour la même raison — Atlas ne devine pas un régime fiscal.
 */
export default function RegimeTva({ actuelle }: { actuelle: Exigibilite }) {
  const [choisie, setChoisie] = useState<Exigibilite>(actuelle);
  const [enCours, setEnCours] = useState(false);
  const router = useRouter();

  async function choisir(regime: Exigibilite) {
    if (regime === choisie) return;
    setChoisie(regime);
    setEnCours(true);
    try {
      await reglerExigibiliteAction(regime);
      router.refresh();
    } catch {
      setChoisie(actuelle);
    } finally {
      setEnCours(false);
    }
  }

  const OPTIONS: { valeur: Exigibilite; titre: string; quoi: string }[] = [
    {
      valeur: "encaissements",
      titre: "Quand le client me paie",
      quoi: "Le régime par défaut d'une prestation de services.",
    },
    {
      valeur: "debits",
      titre: "Quand j'émets la facture",
      quoi: "Le régime des débits — sur option auprès des impôts.",
    },
  ];

  return (
    <div className="mt-5 px-6">
      <div role="radiogroup" aria-label="Quand ma TVA devient exigible" className="flex flex-col gap-2">
        {OPTIONS.map((o) => (
          <button
            key={o.valeur}
            type="button"
            role="radio"
            aria-checked={choisie === o.valeur}
            disabled={enCours}
            onClick={() => choisir(o.valeur)}
            className="flex min-h-[44px] items-start gap-2.5 px-1 py-2.5 text-left disabled:opacity-50"
            style={{ borderBottom: `1px solid ${colors.line}` }}
          >
            <span
              aria-hidden
              className="mt-[3px] h-[18px] w-[18px] flex-none rounded-full"
              style={{
                border: `1.5px solid ${choisie === o.valeur ? colors.rust : colors.muted}`,
                backgroundColor: choisie === o.valeur ? colors.rust : "transparent",
                boxShadow: choisie === o.valeur ? `inset 0 0 0 3px ${colors.cream}` : undefined,
              }}
            />
            <span className="min-w-0">
              <span className="block text-[14px] font-medium" style={{ color: colors.ink }}>
                {o.titre}
              </span>
              <span className="text-[12px]" style={{ color: colors.muted }}>
                {o.quoi}
              </span>
            </span>
          </button>
        ))}
      </div>
      <p className="mt-2 text-[12px] leading-snug" style={{ color: colors.muted }}>
        Ce choix doit correspondre à ce que les impôts savent de vous. Dans le doute, votre comptable
        le dit en une phrase.
      </p>
    </div>
  );
}
