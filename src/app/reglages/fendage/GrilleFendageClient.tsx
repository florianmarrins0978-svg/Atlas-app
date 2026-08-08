"use client";

import { useState } from "react";
import { colors, smallCaps } from "@/lib/design-tokens";
import { DIAMETRES, HAUTEURS } from "@/lib/grille-fendage";
import { poserPrixFendageAction } from "./actions";

type Case = { cle: string; prix: string; origine: "saisi" | "devis" };

/**
 * La grille de fendage, telle qu'on la remplit sur un téléphone.
 *
 * **Pourquoi pas un tableau à double entrée.** Huit colonnes de diamètres sur un
 * écran de 393 pixels donneraient des colonnes de quarante pixels : illisibles,
 * et impossibles à viser du pouce. La grille est donc dépliée en six blocs — un
 * par hauteur —, chacun listant ses huit diamètres. C'est le même objet, dans
 * l'ordre où l'on raisonne : on sait d'abord la taille de l'arbre.
 *
 * **Les cases remplies se voient d'un coup d'œil**, et celles qui viennent d'un
 * devis réel le disent. Le patron doit pouvoir distinguer ce qu'il a décidé à
 * l'avance de ce qu'il a réellement pratiqué — les deux ne se valent pas quand
 * il s'agit de faire confiance à un chiffre.
 */
export default function GrilleFendageClient({ initiales }: { initiales: Case[] }) {
  const [cases, setCases] = useState<Map<string, Case>>(new Map(initiales.map((c) => [c.cle, c])));
  const [ouverte, setOuverte] = useState<string | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);

  const remplies = cases.size;
  const total = HAUTEURS.length * DIAMETRES.length;

  async function poser(cle: string, saisi: string) {
    const avant = cases.get(cle) ?? null;
    // Les mêmes tolérances que le serveur (`lireMontant`) : « 1 200 », « 250 € »,
    // « 250,50 ». Sans elles, l'écran effacerait une case que le serveur, lui,
    // aurait remplie — et le patron verrait son prix disparaître au moment même
    // où il le pose.
    const valeur = saisi.replace(/[\s\u00a0\u202f]/g, "").replace("€", "").replace(",", ".");
    const montant = Number(valeur);
    const efface = valeur === "" || !Number.isFinite(montant) || montant <= 0;

    // Rien n'a changé : ne pas écrire, pour ne pas transformer une case posée à
    // la main en observation, ni réveiller une révision pour rien.
    if ((avant?.prix ?? "") === (efface ? "" : montant.toFixed(2))) return;

    setCases((m) => {
      const suivant = new Map(m);
      if (efface) suivant.delete(cle);
      else suivant.set(cle, { cle, prix: montant.toFixed(2), origine: "saisi" });
      return suivant;
    });
    setErreur(null);

    try {
      await poserPrixFendageAction(cle, efface ? "" : String(montant));
    } catch {
      // On remet ce qui était là : un prix affiché mais pas enregistré est pire
      // qu'un prix absent — il se retrouverait sur un devis à la prochaine
      // dictée, et pas dans la grille.
      setCases((m) => {
        const suivant = new Map(m);
        if (avant) suivant.set(cle, avant);
        else suivant.delete(cle);
        return suivant;
      });
      setErreur("Ce prix n'a pas pu être enregistré. Réessayez.");
    }
  }

  return (
    <div className="mt-6 flex flex-col gap-3 px-6">
      <p className="text-[13px]" style={{ color: colors.muted }}>
        {remplies === 0
          ? `Aucune case remplie sur ${total}. Atlas posera la question à chaque fente, et rangera ici ce que vous répondez.`
          : `${remplies} case${remplies > 1 ? "s" : ""} remplie${remplies > 1 ? "s" : ""} sur ${total}.`}
      </p>

      {erreur && (
        <p className="text-[13px]" style={{ color: colors.alert }}>
          {erreur}
        </p>
      )}

      {HAUTEURS.map((hauteur) => {
        const ouvert = ouverte === hauteur.cle;
        const posees = DIAMETRES.filter((d) => cases.has(`${hauteur.cle}|${d.cle}`)).length;
        return (
          <div key={hauteur.cle} className="rounded-2xl" style={{ backgroundColor: colors.card }}>
            <button
              type="button"
              onClick={() => setOuverte(ouvert ? null : hauteur.cle)}
              aria-expanded={ouvert}
              className="flex w-full items-center justify-between px-4 py-3 text-left"
            >
              <span className="text-[15px] font-medium" style={{ color: colors.ink }}>
                Arbre {hauteur.libelle}
              </span>
              <span className="text-[12px]" style={{ color: posees > 0 ? colors.rust : colors.muted }}>
                {posees} / {DIAMETRES.length}
              </span>
            </button>

            {ouvert && (
              <div className="flex flex-col gap-2 px-4 pb-4">
                <span className={smallCaps} style={{ color: colors.muted }}>
                  Diamètre du tronc
                </span>
                {DIAMETRES.map((diametre) => {
                  const cle = `${hauteur.cle}|${diametre.cle}`;
                  const posee = cases.get(cle);
                  return (
                    <div key={cle} className="flex items-center gap-3">
                      <label htmlFor={`prix-${cle}`} className="flex-1 text-[14px]" style={{ color: colors.ink }}>
                        {diametre.libelle}
                      </label>
                      {posee?.origine === "devis" && (
                        <span className="text-[11px]" style={{ color: colors.muted }}>
                          d&apos;un devis
                        </span>
                      )}
                      <input
                        id={`prix-${cle}`}
                        type="text"
                        inputMode="decimal"
                        defaultValue={posee ? String(Number(posee.prix)) : ""}
                        placeholder="—"
                        onBlur={(e) => poser(cle, e.target.value)}
                        className="w-24 rounded-xl px-3 py-2 text-right text-[14px]"
                        style={{
                          backgroundColor: colors.cream,
                          color: colors.ink,
                          border: `1px solid ${posee ? "transparent" : colors.rustTint}`,
                        }}
                      />
                      <span className="text-[13px]" style={{ color: colors.muted }}>
                        €
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
