"use client";

import { colors, voile } from "@/lib/design-tokens";
import type { Poste } from "@/lib/arrosage/postes";

/**
 * UNE PIÈCE, EN PHOTO — la vignette que toute la planche validée emploie :
 * la photo dans un cadre, son nom dessous, et ce qu'il en a fait.
 *
 * **« B, avec cadre »** (18 octobre 2026) : le blanc des photos se fond dans la
 * carte par `mix-blend-mode: multiply`, le cadre reste. **Supprimée, elle
 * RESTE**, grisée et barrée d'un trait rouge (17 octobre) : une pièce qui
 * disparaît se croit oubliée. Changée ou ajoutée, un liseré doré le dit.
 *
 * Quatre tailles, celles de la planche : 88 sur le plateau de l'amenée, 54 dans
 * un rail, 44 pour le tuyau d'un réseau, 32 posée sur le plan du jardin.
 */
export default function Vignette({
  poste,
  taille = 88,
  sansNom = false,
  surPlanEgal = false,
  onClick,
}: {
  poste: Poste;
  taille?: 88 | 54 | 44 | 32;
  sansNom?: boolean;
  /** Le té égal posé sur le croisement : son liseré le distingue de la tête voisine. */
  surPlanEgal?: boolean;
  onClick?: () => void;
}) {
  const rayon = taille >= 54 ? 12 : taille === 44 ? 9 : 7;
  const marge = taille === 88 ? 10 : taille === 54 ? 6 : 4;
  // Planche soignée du 26 octobre 2026 : un filet posé sur la photo, plus d'ombre portée.
  const liseret = poste.changee || poste.ajoutee || surPlanEgal ? `0 0 0 2px ${colors.or}` : OMBRE_VIGNETTE;
  const mention = poste.retiree ? "supprimée" : poste.changee ? "changée" : "";
  return (
    <button
      type="button"
      onClick={onClick}
      data-atlas="piece"
      data-cle={poste.cle}
      data-etat={poste.retiree ? "retiree" : poste.changee ? "changee" : poste.ajoutee ? "ajoutee" : "proposee"}
      aria-label={poste.nom}
      className="relative m-0 flex flex-col items-center border-0 bg-transparent p-0 text-center"
      style={{ width: taille, color: "inherit", font: "inherit", cursor: onClick ? "pointer" : "default" }}
    >
      <span
        className="relative flex items-center justify-center"
        style={{
          width: taille, height: taille, borderRadius: rayon, backgroundColor: colors.card, boxShadow: liseret,
          filter: poste.retiree ? "grayscale(1)" : undefined, opacity: poste.retiree ? 0.45 : 1,
        }}
      >
        {poste.photo ? (
          // eslint-disable-next-line @next/next/no-img-element -- pansement assumé : next/image n’a rien à optimiser sur une photo de pièce servie telle quelle depuis public/, une photo de pièce, servie telle quelle ; pas d'optimisation à lui faire payer
          <img src={poste.photo} alt="" style={{ maxWidth: taille - marge, maxHeight: taille - marge, objectFit: "contain", mixBlendMode: "multiply" }} />
        ) : (
          <span
            className="flex h-full w-full items-center justify-center p-1 text-center"
            style={{ border: `1.5px dashed ${colors.line}`, borderRadius: rayon, fontSize: taille >= 54 ? 10.5 : 7, lineHeight: 1.25, color: colors.muted }}
          >
            photo à venir
          </span>
        )}
        {poste.pied && (
          // eslint-disable-next-line @next/next/no-img-element -- pansement assumé : next/image n’a rien à optimiser sur une photo de pièce servie telle quelle depuis public/, la buse au pied de sa tuyère
          <img
            src={poste.pied}
            alt=""
            className="absolute"
            style={{ right: -5, bottom: -5, width: taille <= 32 ? "60%" : "50%", maxHeight: taille <= 32 ? "60%" : "50%", borderRadius: taille <= 32 ? 5 : 8, backgroundColor: colors.card, boxShadow: `0 1px 3px ${colors.line}` }}
          />
        )}
        {poste.retiree && (
          <span
            aria-hidden="true"
            className="absolute"
            style={{ left: "8%", right: "8%", top: "50%", height: 2.5, borderRadius: 2, backgroundColor: colors.alert, transform: "rotate(-35deg)", opacity: 1 }}
          />
        )}
      </span>
      {!sansNom && (
        <>
          <span
            className="mt-[6px] block"
            style={{
              fontSize: taille === 88 ? 11.5 : 10.5, lineHeight: 1.3,
              color: poste.retiree ? colors.muted : poste.changee ? colors.orTexte : colors.inkSoft,
              textDecoration: poste.retiree ? "line-through" : undefined, textDecorationColor: colors.alert, textDecorationThickness: 2,
            }}
          >
            {poste.detail}
          </span>
          {mention && (
            <span className="block" style={{ fontSize: 10, color: colors.orTexte }}>
              {mention}
            </span>
          )}
        </>
      )}
    </button>
  );
}

/** Le voile de la carte sous une photo : exporté pour que le plan des pièces et la chaîne dessinent le même cadre. */
export const OMBRE_VIGNETTE = `0 0 0 1px ${voile(colors.ink, 0.12)}`;
