"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { colors, font, libelleCaps } from "@/lib/design-tokens";
import type { MotPropose } from "@/lib/mots-a-retenir";
import { ecarterMotAction, retenirMotProposeAction } from "./actions";

/**
 * Ce qu'Atlas a entendu et ne connaît pas — sa demande du 17 août 2026.
 *
 * *« ça veut dire que le document s'autoalimente à chaque fois qu'on rajoute un
 * nouveau mot dans un devis et qu'il comprend ce que c'est ? »* — la réponse
 * était non, il a répondu « fais-le ».
 *
 * **Atlas propose, il n'écrit pas.** Deux boutons, et le « non » est retenu
 * pour toujours (migration 0053) : une proposition qui revient après un refus
 * n'est plus une proposition.
 *
 * **L'extrait de la dictée est montré, et ce n'est pas un ornement.** « écime »
 * seul ne lui dit rien trois semaines plus tard ; « faut m'écimer le tilleul du
 * fond » lui rend la scène, et il tranche en une seconde.
 */
export default function MotsProposes({ proposes }: { proposes: MotPropose[] }) {
  const router = useRouter();
  const [restants, setRestants] = useState(proposes);
  const [enCours, setEnCours] = useState<string | null>(null);

  if (restants.length === 0) return null;

  async function repondre(p: MotPropose, retenir: boolean) {
    if (enCours) return;
    setEnCours(p.mot);
    try {
      if (retenir) await retenirMotProposeAction(p.entreeId, p.mot);
      else await ecarterMotAction(p.mot);
      setRestants((cur) => cur.filter((x) => x.mot !== p.mot));
      // Le mot retenu doit apparaître dans sa carte, en doré, tout de suite :
      // sans ce rafraîchissement il faudrait quitter l'écran pour le voir, et
      // rien ne prouverait que le « oui » a servi à quelque chose.
      if (retenir) router.refresh();
    } finally {
      setEnCours(null);
    }
  }

  return (
    <section className="mx-[26px] mt-[26px]">
      <p className={`mb-[10px] ${libelleCaps}`} style={{ color: colors.or }}>
        Atlas a entendu ces mots
      </p>

      <ul className="flex flex-col gap-[9px]">
        {restants.map((p) => (
          <li
            key={p.mot}
            className="rounded-[11px] px-[13px] py-[12px]"
            style={{ backgroundColor: colors.card, border: `1px solid ${colors.or}` }}
          >
            <span className="block text-[17px] leading-[1.25]" style={{ fontFamily: font.display }}>
              « {p.mot} »
            </span>
            <p className="mt-[3px] text-[12.5px] leading-[1.5]" style={{ color: colors.muted }}>
              Dans votre dictée : « {p.extrait} »
            </p>
            <p className="mt-[7px] text-[13.5px] leading-[1.45]">
              Le retenir comme un mot pour <b>{p.entreeNom}</b> ?
            </p>

            <div className="mt-[10px] flex items-center gap-[8px]">
              <button
                type="button"
                onClick={() => repondre(p, true)}
                disabled={enCours === p.mot}
                className="atlas-plein rounded-full px-[15px] py-[8px] text-[13.5px]"
                style={{ backgroundColor: colors.rust, color: colors.card }}
              >
                Oui, retenir
              </button>
              <button
                type="button"
                onClick={() => repondre(p, false)}
                disabled={enCours === p.mot}
                className="rounded-full px-[15px] py-[8px] text-[13.5px]"
                style={{ border: `1px solid ${colors.line}`, color: colors.muted }}
              >
                Non
              </button>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
