import PastilleIcone from "@/components/atlas/reglages/PastilleIcone";
import { colors, font, voile } from "@/lib/design-tokens";
import type { EtatAffiche, SigneAbonnement } from "@/lib/abonnements";
import Picto from "@/components/atlas/reglages/Picto";

/**
 * **L'état de l'abonnement, d'un coup d'œil** (planche des Réglages soignés,
 * 26 octobre 2026) : les jours d'essai dans un carré doré, l'abonnement qui
 * court sur une pastille verte, et ce qui demande un geste (essai fini,
 * paiement en attente, arrêt demandé) sur une plage ambre, à la place d'un
 * titre rouge. Ce qui se montre vient d'`etatAffiche` : ce bloc ne redécide
 * pas lequel des états est le sien.
 */
export default function EtatDeLAbonnement({ etat }: { etat: EtatAffiche }) {
  const attention = etat.ton === "attention";
  return (
    <div
      data-atlas="etat-abonnement"
      className="flex items-center gap-3.5 rounded-[6px] px-[18px] py-4"
      style={{ backgroundColor: attention ? colors.carteAmbreFond : colors.card }}
    >
      <SigneDeLEtat signe={etat.signe} attention={attention} />
      <span className="min-w-0 flex-1">
        <span className="block text-[21px] leading-[1.2]" style={{ fontFamily: font.display }}>
          {etat.titre}
        </span>
        {etat.detail && (
          <span className="mt-1 block text-[15px] leading-[1.45]" style={{ color: attention ? colors.ink : colors.inkSoft }}>
            {etat.detail}
          </span>
        )}
      </span>
    </div>
  );
}

/**
 * Le carré ou la pastille à gauche du titre. Le carré porte un CHIFFRE (des
 * jours, une date) ; la pastille, un dessin. Doré ou vert quand tout va,
 * ambre dès que l'état demande un geste.
 */
function SigneDeLEtat({ signe, attention }: { signe: SigneAbonnement; attention: boolean }) {
  if (signe.genre === "jours" || signe.genre === "echeance") {
    const chiffre = signe.genre === "jours" ? signe.nombre : signe.jour;
    const dessous = signe.genre === "jours" ? (signe.nombre > 1 ? "jours" : "jour") : signe.mois;
    return (
      <span
        aria-hidden
        className="w-[52px] flex-none rounded-[10px] pb-[7px] pt-2 text-center leading-none"
        style={{ backgroundColor: voile(attention ? colors.carteAmbreTexte : colors.or, attention ? 0.16 : 0.14) }}
      >
        <span className="block text-[24px] leading-none" style={{ fontFamily: font.display, fontVariantNumeric: "lining-nums" }}>
          {chiffre}
        </span>
        <span className="mt-1 block text-[13px] font-bold" style={{ color: attention ? colors.carteAmbreTexte : colors.or }}>
          {dessous}
        </span>
      </span>
    );
  }
  const dessin = signe.genre === "paiement" ? "carte" : signe.genre === "ferme" ? "cadenas" : "couronne";
  const ton = attention ? "ambre" : signe.genre === "formule" ? "vert" : undefined;
  return (
    <PastilleIcone ton={ton}>
      <Picto nom={dessin} />
    </PastilleIcone>
  );
}
