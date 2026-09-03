"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { colors, font } from "@/lib/design-tokens";
import { casesParTranche, type Grilles, type NomAxe } from "@/lib/grille-prix";
import {
  ajouterTechniqueAction,
  ajouterTrancheAction,
  rendreTrancheAction,
  retirerTrancheAction,
} from "../actions";

/**
 * « Mes mesures » — les trois axes, réglés une fois pour toutes.
 *
 * **Sa demande du 14 août 2026 :** *« je dois pouvoir ajouter ou retirer des
 * cases. »* La même tranche de diamètre sert à abattre, à fendre et à
 * dessoucher ; la voir trois fois dans « Mes prix » ne dit pas qu'elle est
 * unique, et laisse croire qu'on peut la régler pour l'une sans toucher aux
 * autres. Cet écran-là le dit en une ligne.
 *
 * **Chaque tranche annonce combien de prix elle porte.** C'est ce chiffre qui
 * transforme un retrait aveugle en décision : « 3 prix » à côté d'une tranche
 * dit ce qu'on s'apprête à ranger. Sans lui, il faudrait ouvrir trois grilles
 * pour le savoir.
 */
export default function MesMesuresClient({
  grilles,
  prixParAxe,
}: {
  grilles: Grilles;
  /** Combien de prix chaque tranche porte, par axe puis par clé. */
  prixParAxe: Record<NomAxe, Record<string, number>>;
}) {
  const [erreur, setErreur] = useState<string | null>(null);
  const [defait, setDefait] = useState<{ axe: NomAxe; cle: string; nom: string; prix: number } | null>(null);
  const router = useRouter();

  const BLOCS: { axe: NomAxe; titre: string; aide: string; lignes: { cle: string; libelle: string }[] }[] = [
    {
      axe: "diametre",
      titre: "Diamètres",
      aide: sert("diametre", grilles),
      lignes: grilles.axes.diametres.map((t) => ({ cle: t.cle, libelle: t.libelle })),
    },
    {
      axe: "hauteur",
      titre: "Hauteurs d'arbre",
      aide: sert("hauteur", grilles),
      lignes: grilles.axes.hauteurs.map((t) => ({ cle: t.cle, libelle: t.libelle })),
    },
    {
      axe: "technique",
      titre: "Façons d'abattre",
      aide: sert("technique", grilles),
      lignes: grilles.axes.techniques.map((t) => ({ cle: t.cle, libelle: t.libelle })),
    },
  ];

  return (
    <div className="mt-6 flex flex-col gap-6 px-6">
      {erreur && (
        <p role="alert" className="text-[13px]" style={{ color: colors.alert }}>
          {erreur}
        </p>
      )}

      {BLOCS.map((bloc) => (
        <section key={bloc.axe} className="flex flex-col gap-2">
          <h2 className="text-[17px]" style={{ color: colors.ink, fontFamily: font.display }}>
            {bloc.titre}
          </h2>
          <p className="text-[13px] leading-snug" style={{ color: colors.muted }}>
            {bloc.aide}
          </p>

          <div className="flex flex-col gap-2 rounded-[4px] px-4 py-3" style={{ backgroundColor: colors.card }}>
            {bloc.lignes.length === 0 && (
              <p className="py-2 text-[13px]" style={{ color: colors.muted }}>
                Plus aucune tranche. Les grilles qui s&apos;en servent n&apos;ont plus de case.
              </p>
            )}
            {bloc.lignes.map((ligne) => {
              const prix = prixParAxe[bloc.axe]?.[ligne.cle] ?? 0;
              return (
                <div key={ligne.cle} className="flex min-h-10 items-center gap-3">
                  <span className="flex-1 text-[14px]" style={{ color: colors.ink }}>
                    {ligne.libelle}
                  </span>
                  <span className="text-[11.5px]" style={{ color: prix > 0 ? colors.rust : colors.muted }}>
                    {prix > 0 ? `${prix} prix` : "vide"}
                  </span>
                  <Croix
                    libelle={`Retirer ${ligne.libelle}`}
                    onErreur={setErreur}
                    onRetirer={async () => {
                      const r = await retirerTrancheAction(bloc.axe, ligne.cle);
                      setDefait({ axe: bloc.axe, cle: ligne.cle, nom: ligne.libelle, prix: r.prixEmportes });
                      router.refresh();
                    }}
                  />
                </div>
              );
            })}

            {bloc.axe === "technique" ? (
              <AjouterFacon onErreur={setErreur} />
            ) : (
              <AjouterTranche axe={bloc.axe} grilles={grilles} onErreur={setErreur} />
            )}
          </div>
        </section>
      ))}

      {defait && (
        <div
          role="status"
          // **Il l'a demandé dedans le 31 août.** Le bandeau prend le vert des
          // boutons pleins. Il ne prend PAS de geste utile : rien ne s'y
          // appuie — `:active` ne se déclenchera jamais, et c'est normal.
          className="atlas-plein flex items-center gap-3 rounded-[4px] px-4 py-3"
          style={{ backgroundColor: colors.plein, color: colors.card }}
        >
          <span className="flex-1 text-[12.5px] leading-snug">
            {defait.nom} retirée
            {defait.prix > 0
              ? ` — ${defait.prix} prix rangé${defait.prix > 1 ? "s" : ""} avec elle.`
              : " — aucun prix n'était posé."}
          </span>
          <button
            type="button"
            onClick={async () => {
              await rendreTrancheAction(defait.axe, defait.cle);
              setDefait(null);
              router.refresh();
            }}
            className="min-h-9 rounded-full px-4 py-2 text-[13px] font-semibold"
            style={{ backgroundColor: colors.card, color: colors.rust }}
          >
            Annuler
          </button>
          <button type="button" onClick={() => setDefait(null)} aria-label="Fermer" className="h-9 w-9 flex-none text-[17px]">
            ×
          </button>
        </div>
      )}
    </div>
  );
}

/** À quelles grilles cet axe sert — nommées, pas comptées. */
function sert(axe: NomAxe, grilles: Grilles): string {
  const { parNature } = casesParTranche(axe, grilles);
  if (parNature.length === 0) return "Aucune grille ne s'en sert pour l'instant.";
  const noms = parNature.map((x) => x.nature.titre.toLowerCase()).join(", ");
  return `Sert à ${parNature.length} grille${parNature.length > 1 ? "s" : ""} : ${noms}.`;
}

function AjouterTranche({
  axe,
  grilles,
  onErreur,
}: {
  axe: NomAxe;
  grilles: Grilles;
  onErreur: (m: string | null) => void;
}) {
  const [ouvert, setOuvert] = useState(false);
  const [de, setDe] = useState("");
  const [a, setA] = useState("");
  const [enCours, setEnCours] = useState(false);
  const router = useRouter();
  const unite = axe === "hauteur" ? "m" : "cm";
  const consequence = casesParTranche(axe, grilles);

  if (!ouvert) {
    return (
      <button
        type="button"
        onClick={() => setOuvert(true)}
        className="flex min-h-[44px] w-full items-center gap-2 py-2 text-left text-[14px] font-medium"
        style={{ color: colors.rust }}
      >
        <span className="text-[17px] leading-none">+</span>{" "}
        {axe === "hauteur" ? "Ajouter une hauteur" : "Ajouter un diamètre"}
      </button>
    );
  }

  return (
    <div className="flex flex-col gap-2 py-2">
      <div className="flex items-center gap-2">
        <input
          value={de}
          onChange={(e) => setDe(e.target.value)}
          inputMode="decimal"
          placeholder="de 90"
          aria-label={`Borne basse, en ${unite}`}
          className="min-w-0 flex-1 rounded-[4px] border-0 px-3 py-2.5 outline-none"
          style={{ backgroundColor: colors.cream, color: colors.ink, fontSize: "16px" }}
        />
        <input
          value={a}
          onChange={(e) => setA(e.target.value)}
          inputMode="decimal"
          placeholder="à 120"
          aria-label={`Borne haute, en ${unite} — vide pour « et plus »`}
          className="min-w-0 flex-1 rounded-[4px] border-0 px-3 py-2.5 outline-none"
          style={{ backgroundColor: colors.cream, color: colors.ink, fontSize: "16px" }}
        />
        <button
          type="button"
          disabled={enCours}
          onClick={async () => {
            setEnCours(true);
            onErreur(null);
            const r = await ajouterTrancheAction(
              axe,
              Number(de.replace(",", ".")),
              a.trim() === "" ? null : Number(a.replace(",", "."))
            );
            setEnCours(false);
            if (!r.ok) {
              onErreur(r.raison);
              return;
            }
            setOuvert(false);
            setDe("");
            setA("");
            router.refresh();
          }}
          className="atlas-plein min-h-[40px] rounded-full px-4 py-2 text-[14px] font-medium disabled:opacity-40"
          style={{ backgroundColor: colors.plein, color: colors.card }}
        >
          Ajouter
        </button>
      </div>
      <p
        className="rounded-[4px] px-3 py-2 text-[12px] leading-snug"
        style={{ backgroundColor: colors.rustTint, color: colors.inkSoft }}
      >
        {consequence.total > 0
          ? `${consequence.total} case${consequence.total > 1 ? "s" : ""} s'ajouteront : ${consequence.parNature
              .map((x) => `${x.cases} pour ${x.nature.titre.toLowerCase()}`)
              .join(", ")}.`
          : "Aucune case ne s'ajoutera : aucune grille ne se sert de cet axe."}
      </p>
    </div>
  );
}

function AjouterFacon({ onErreur }: { onErreur: (m: string | null) => void }) {
  const [ouvert, setOuvert] = useState(false);
  const [nom, setNom] = useState("");
  const [enCours, setEnCours] = useState(false);
  const router = useRouter();

  if (!ouvert) {
    return (
      <button
        type="button"
        onClick={() => setOuvert(true)}
        className="flex min-h-[44px] w-full items-center gap-2 py-2 text-left text-[14px] font-medium"
        style={{ color: colors.rust }}
      >
        <span className="text-[17px] leading-none">+</span> Ajouter une façon
      </button>
    );
  }

  return (
    <div className="flex items-center gap-2 py-2">
      <input
        value={nom}
        onChange={(e) => setNom(e.target.value)}
        placeholder="Abattage par câble"
        aria-label="Nom de la façon d'abattre"
        className="min-w-0 flex-1 rounded-[4px] border-0 px-3 py-2.5 outline-none"
        style={{ backgroundColor: colors.cream, color: colors.ink, fontSize: "16px" }}
      />
      <button
        type="button"
        disabled={enCours}
        onClick={async () => {
          setEnCours(true);
          onErreur(null);
          const r = await ajouterTechniqueAction(nom);
          setEnCours(false);
          if (!r.ok) {
            onErreur(r.raison);
            return;
          }
          setOuvert(false);
          setNom("");
          router.refresh();
        }}
        className="atlas-plein min-h-[40px] rounded-full px-4 py-2 text-[14px] font-medium disabled:opacity-40"
        style={{ backgroundColor: colors.plein, color: colors.card }}
      >
        Ajouter
      </button>
    </div>
  );
}

function Croix({
  libelle,
  onRetirer,
  onErreur,
}: {
  libelle: string;
  onRetirer: () => Promise<void>;
  onErreur: (m: string | null) => void;
}) {
  const [enCours, setEnCours] = useState(false);
  return (
    <button
      type="button"
      aria-label={libelle}
      disabled={enCours}
      onClick={async () => {
        setEnCours(true);
        onErreur(null);
        try {
          await onRetirer();
        } catch {
          onErreur("Ce retrait n'a pas pu être enregistré. Réessayez.");
        } finally {
          setEnCours(false);
        }
      }}
      className="flex h-9 w-9 flex-none items-center justify-center text-[17px] disabled:opacity-40"
      style={{ color: colors.muted }}
    >
      ×
    </button>
  );
}
