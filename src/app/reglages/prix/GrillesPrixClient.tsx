"use client";

import { useState } from "react";
import { colors, font, smallCaps } from "@/lib/design-tokens";
import {
  CELLULE_GRUMES,
  CELLULE_HAIE,
  cellulesDe,
  DIAMETRES,
  HAUTEURS,
  TECHNIQUES,
  type NatureGrille,
} from "@/lib/grille-prix";
import { poserPrixGrilleAction } from "./actions";

type Case = { nature: NatureGrille; cle: string; prix: string; origine: "saisi" | "devis" };

/**
 * Les cinq grilles, dans l'ordre du chantier — pas dans celui du code.
 *
 * L'abattage d'abord : c'est le poste qui porte le plus gros écart chez lui —
 * 600, 1 000 ou 1 400 € pour le même chêne selon la technique. Puis ce qui s'en
 * détache, dans l'ordre où il le fait : les grumes, la fente, la souche.
 *
 * **Trois formes, parce que trois réalités** — et non par goût de la variété :
 *
 * | Forme | Nature | Pourquoi |
 * |---|---|---|
 * | deux axes | abattage, fendage | Deux choses décident du prix, et il faut les croiser |
 * | un axe | dessouchage | Seul le diamètre décide : la hauteur de l'arbre absent ne dit rien |
 * | une case | haie, grumes | Un prix unitaire — au mètre pour l'une, à la tonne pour l'autre |
 */
type FormeGrille = "deux-axes" | "un-axe" | "une-case";

const GRILLES: {
  nature: NatureGrille;
  titre: string;
  aide: string;
  axe: string;
  forme: FormeGrille;
  cleUnique?: string;
  libelleUnique?: string;
}[] = [
  {
    nature: "abattage",
    titre: "Abattre un arbre",
    aide: "Par technique et par diamètre — c'est la technique qui fait le plus gros écart.",
    axe: "Diamètre du tronc",
    forme: "deux-axes",
  },
  {
    nature: "grumes",
    titre: "Enlever les grumes",
    // L'unité est dite à l'écran, parce que c'est elle qui change tout : un
    // prix saisi ici sera MULTIPLIÉ par le tonnage du chantier. Le taire ferait
    // écrire un forfait dans une case qui n'en est pas une.
    aide: "Un prix à la tonne. Atlas le multiplie par le tonnage enlevé sur le chantier.",
    axe: "",
    forme: "une-case",
    cleUnique: CELLULE_GRUMES,
    libelleUnique: "Prix de la tonne",
  },
  {
    nature: "fendage",
    titre: "Fendre le bois",
    aide: "Par hauteur d'arbre et par diamètre : c'est le volume de bois qui décide.",
    axe: "Diamètre du tronc",
    forme: "deux-axes",
  },
  {
    nature: "dessouchage",
    titre: "Dessoucher",
    aide: "Par diamètre de souche seulement : la hauteur de l'arbre qui n'est plus là ne décide de rien.",
    axe: "Diamètre de la souche",
    forme: "un-axe",
  },
  {
    nature: "haie",
    titre: "Tailler une haie",
    aide: "Un seul prix, au mètre linéaire. Atlas le multiplie par la longueur du chantier.",
    axe: "",
    forme: "une-case",
    cleUnique: CELLULE_HAIE,
    libelleUnique: "Prix du mètre linéaire",
  },
];

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
export default function GrillesPrixClient({ initiales }: { initiales: Case[] }) {
  const [cases, setCases] = useState<Map<string, Case>>(
    new Map(initiales.map((c) => [`${c.nature}|${c.cle}`, c]))
  );
  const [ouverte, setOuverte] = useState<string | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);

  async function poser(nature: NatureGrille, cle: string, saisi: string) {
    const identifiant = `${nature}|${cle}`;
    const avant = cases.get(identifiant) ?? null;
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
      if (efface) suivant.delete(identifiant);
      else suivant.set(identifiant, { nature, cle, prix: montant.toFixed(2), origine: "saisi" });
      return suivant;
    });
    setErreur(null);

    try {
      await poserPrixGrilleAction(nature, cle, efface ? "" : String(montant));
    } catch {
      // On remet ce qui était là : un prix affiché mais pas enregistré est pire
      // qu'un prix absent — il se retrouverait sur un devis à la prochaine
      // dictée, et pas dans la grille.
      setCases((m) => {
        const suivant = new Map(m);
        if (avant) suivant.set(identifiant, avant);
        else suivant.delete(identifiant);
        return suivant;
      });
      setErreur("Ce prix n'a pas pu être enregistré. Réessayez.");
    }
  }

  const total = GRILLES.reduce((n, g) => n + cellulesDe(g.nature).length, 0);

  return (
    <div className="mt-6 flex flex-col gap-6 px-6">
      <p className="text-[13px]" style={{ color: colors.muted }}>
        {cases.size === 0
          ? `Aucune case remplie sur ${total}. Atlas posera la question à chaque chantier, et rangera ici ce que vous répondez.`
          : `${cases.size} case${cases.size > 1 ? "s" : ""} remplie${cases.size > 1 ? "s" : ""} sur ${total}.`}
      </p>

      {erreur && (
        <p role="alert" className="text-[13px]" style={{ color: colors.alert }}>
          {erreur}
        </p>
      )}

      {GRILLES.map((grille) => (
        <section key={grille.nature} className="flex flex-col gap-2">
          <h2 className="text-[17px]" style={{ color: colors.ink, fontFamily: font.display }}>
            {grille.titre}
          </h2>
          <p className="text-[13px] leading-snug" style={{ color: colors.muted }}>
            {grille.aide}
          </p>

          {/* Une seule case : la déplier dans un accordéon serait un geste de
              plus pour un seul champ. */}
          {grille.forme === "une-case" ? (
            <div className="rounded-2xl px-4 py-3" style={{ backgroundColor: colors.card }}>
              <Champ
                nature={grille.nature}
                cle={grille.cleUnique!}
                libelle={grille.libelleUnique!}
                contexte={grille.titre}
                posee={cases.get(`${grille.nature}|${grille.cleUnique}`)}
                onPoser={poser}
              />
            </div>
          ) : grille.forme === "un-axe" ? (
            /* Un seul axe : pas d'accordéon non plus. Replier huit champs
               derrière un appui, quand il n'y a qu'une rangée, ajouterait un
               geste sans rien ranger. */
            <div className="flex flex-col gap-2 rounded-2xl px-4 py-3" style={{ backgroundColor: colors.card }}>
              <span className={smallCaps} style={{ color: colors.muted }}>
                {grille.axe}
              </span>
              {DIAMETRES.map((diametre) => (
                <Champ
                  key={diametre.cle}
                  nature={grille.nature}
                  cle={diametre.cle}
                  libelle={diametre.libelle}
                  contexte={grille.titre}
                  posee={cases.get(`${grille.nature}|${diametre.cle}`)}
                  onPoser={poser}
                />
              ))}
            </div>
          ) : (
            lignesDe(grille.nature).map((rangee) => {
              const identifiantRangee = `${grille.nature}|${rangee.cle}`;
              const ouvert = ouverte === identifiantRangee;
              const posees = DIAMETRES.filter((d) =>
                cases.has(`${grille.nature}|${rangee.cle}|${d.cle}`)
              ).length;
              return (
                <div key={identifiantRangee} className="rounded-2xl" style={{ backgroundColor: colors.card }}>
                  <button
                    type="button"
                    onClick={() => setOuverte(ouvert ? null : identifiantRangee)}
                    aria-expanded={ouvert}
                    className="flex w-full items-center justify-between px-4 py-3 text-left"
                  >
                    <span className="text-[15px] font-medium" style={{ color: colors.ink }}>
                      {rangee.titre}
                    </span>
                    <span className="text-[12px]" style={{ color: posees > 0 ? colors.rust : colors.muted }}>
                      {posees} / {DIAMETRES.length}
                    </span>
                  </button>

                  {ouvert && (
                    <div className="flex flex-col gap-2 px-4 pb-4">
                      <span className={smallCaps} style={{ color: colors.muted }}>
                        {grille.axe}
                      </span>
                      {DIAMETRES.map((diametre) => {
                        const cle = `${rangee.cle}|${diametre.cle}`;
                        return (
                          <Champ
                            key={cle}
                            nature={grille.nature}
                            cle={cle}
                            libelle={diametre.libelle}
                            contexte={`${grille.titre} — ${rangee.titre}`}
                            posee={cases.get(`${grille.nature}|${cle}`)}
                            onPoser={poser}
                          />
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </section>
      ))}
    </div>
  );
}

/**
 * Les rangées d'une grille à deux entrées.
 *
 * L'abattage se déplie par TECHNIQUE, le fendage par HAUTEUR — les deux se
 * referment sur les mêmes diamètres. C'est ce que le patron a choisi : chez
 * lui, la technique fait passer un abattage de 600 à 1 400 €, et la hauteur ne
 * décide de rien.
 */
function lignesDe(nature: NatureGrille): { cle: string; titre: string }[] {
  if (nature === "abattage") {
    return TECHNIQUES.map((t) => ({ cle: t.cle, titre: t.libelle[0].toUpperCase() + t.libelle.slice(1) }));
  }
  return HAUTEURS.map((h) => ({ cle: h.cle, titre: `Arbre ${h.libelle}` }));
}

/** Une case : son intitulé, son prix, et d'où il vient. */
function Champ({
  nature,
  cle,
  libelle,
  contexte,
  posee,
  onPoser,
}: {
  nature: NatureGrille;
  cle: string;
  libelle: string;
  /**
   * De quelle grille et de quelle rangée vient ce champ.
   *
   * **Rendu nécessaire le 8 août 2026 par l'arrivée du dessouchage :** « 40 à
   * 50 cm » désigne désormais deux cases à l'écran — un tronc à fendre et une
   * souche à arracher. Le libellé visible reste court, parce que la colonne de
   * gauche dit déjà de quelle grille il s'agit ; c'est le nom ACCESSIBLE qui
   * porte le contexte entier. Sans lui, une personne qui n'utilise pas ses yeux
   * entend cinq fois « 40 à 50 cm » sans savoir lequel elle remplit.
   */
  contexte: string;
  posee: Case | undefined;
  onPoser: (nature: NatureGrille, cle: string, saisi: string) => void;
}) {
  const identifiant = `prix-${nature}-${cle.replace(/\|/g, "-")}`;
  return (
    <div className="flex items-center gap-3">
      <label htmlFor={identifiant} className="flex-1 text-[14px]" style={{ color: colors.ink }}>
        {libelle}
      </label>
      {/* D'où vient ce prix : ce qu'il a décidé, ou ce qu'il a pratiqué. Les
          deux ne se valent pas quand il s'agit d'y faire confiance. */}
      {posee?.origine === "devis" && (
        <span className="text-[11px]" style={{ color: colors.muted }}>
          d&apos;un devis
        </span>
      )}
      <input
        id={identifiant}
        aria-label={`${contexte} — ${libelle}`}
        type="text"
        inputMode="decimal"
        defaultValue={posee ? String(Number(posee.prix)) : ""}
        placeholder="—"
        onBlur={(e) => onPoser(nature, cle, e.target.value)}
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
}
